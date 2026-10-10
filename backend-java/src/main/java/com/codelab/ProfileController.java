package com.codelab;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.concurrent.TimeUnit;

import static com.mongodb.client.model.Filters.and;
import static com.mongodb.client.model.Filters.eq;

@RestController
@RequestMapping("/api")
public class ProfileController {
    @Autowired MongoTemplate mongo;
    @Autowired AuthService auth;
    @Autowired Storage storage;
    static final Map<String, String> IMAGE_TYPES = Map.of("image/png", "png", "image/jpeg", "jpg", "image/webp", "webp", "image/gif", "gif");
    static final long MAX_AVATAR = 3L * 1024 * 1024;

    @PostMapping("/profile/avatar")
    public Map<String, Object> upload(@RequestHeader(value = "Authorization", required = false) String h, @RequestParam("file") MultipartFile file) throws Exception {
        Document u = auth.require(h);
        String ct = Optional.ofNullable(file.getContentType()).orElse("");
        if (!IMAGE_TYPES.containsKey(ct)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PNG, JPG, WEBP or GIF images are allowed");
        if (file.getSize() > MAX_AVATAR) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image must be under 3 MB");
        String uid = u.getString("user_id");
        String fileId = UUID.randomUUID().toString();
        String path = storage.put("algoforge/avatars/" + uid + "/" + fileId + "." + IMAGE_TYPES.get(ct), file.getBytes(), ct);
        var files = mongo.getCollection("files");
        files.updateMany(and(eq("user_id", uid), eq("kind", "avatar")), new Document("$set", new Document("is_deleted", true)));
        files.insertOne(new Document("file_id", fileId).append("user_id", uid).append("kind", "avatar").append("storage_path", path)
                .append("content_type", ct).append("size", file.getSize()).append("original_filename", file.getOriginalFilename())
                .append("is_deleted", false).append("created_at", new Date()));
        mongo.getCollection("users").updateOne(eq("user_id", uid), new Document("$set", new Document("picture", "/api/avatars/" + fileId)));
        return AuthService.publicUser(mongo.getCollection("users").find(eq("user_id", uid)).first());
    }

    @DeleteMapping("/profile/avatar")
    public Map<String, Object> removeAvatar(@RequestHeader(value = "Authorization", required = false) String h) {
        Document u = auth.require(h);
        String uid = u.getString("user_id");
        mongo.getCollection("files").updateMany(and(eq("user_id", uid), eq("kind", "avatar")), new Document("$set", new Document("is_deleted", true)));
        mongo.getCollection("users").updateOne(eq("user_id", uid), new Document("$set", new Document("picture", null)));
        return AuthService.publicUser(mongo.getCollection("users").find(eq("user_id", uid)).first());
    }

    @GetMapping("/avatars/{fileId}")
    public ResponseEntity<byte[]> avatar(@PathVariable String fileId) throws Exception {
        Document f = mongo.getCollection("files").find(and(eq("file_id", fileId), eq("kind", "avatar"), eq("is_deleted", false))).first();
        if (f == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Not found");
        Storage.Obj o = storage.get(f.getString("storage_path"));
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(f.getString("content_type")))
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic()).body(o.data());
    }
}
