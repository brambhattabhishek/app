import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { Avatar } from "@/components/Navbar";

// ═══════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════
const MAX_SIZE = 3 * 1024 * 1024;      // 3 MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const ACCEPTED_EXT = /\.(png|jpe?g|webp|gif)$/i;

// ═══════════════════════════════════════════════════════════════
//  Component
// ═══════════════════════════════════════════════════════════════
export default function AvatarUpload({ user, onChange }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);

  const anyBusy = busy || removing;

  // ═══════════════════════════════════════════════════════════
  //  Upload
  // ═══════════════════════════════════════════════════════════
  const upload = async (file) => {
    if (!file || anyBusy) return;

    // Validate — content-type may be empty on some browsers; fall back to extension
    const typeOk = file.type
        ? ACCEPTED_TYPES.includes(file.type.toLowerCase())
        : ACCEPTED_EXT.test(file.name || "");
    if (!typeOk) {
      toast.error("Choose a PNG, JPG, WEBP or GIF image");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Image must be under 3 MB");
      return;
    }
    if (file.size === 0) {
      toast.error("That image is empty");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/profile/avatar", fd);
      onChange?.(data);
      toast.success("Profile photo updated");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
      // Reset input so same file can be picked again
      if (ref.current) ref.current.value = "";
    }
  };

  // ═══════════════════════════════════════════════════════════
  //  Remove
  // ═══════════════════════════════════════════════════════════
  const remove = async () => {
    if (anyBusy) return;
    setRemoving(true);
    try {
      const { data } = await api.delete("/profile/avatar");
      onChange?.(data);
      toast("Photo removed");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setRemoving(false);
    }
  };

  // ═══════════════════════════════════════════════════════════
  //  Trigger file picker safely
  // ═══════════════════════════════════════════════════════════
  const openPicker = () => {
    if (anyBusy) return;
    ref.current?.click();
  };

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    // Reset here too — belt & braces, since upload() may fail before its finally
    if (e.target) e.target.value = "";
  };

  const hasPicture = !!user?.picture;

  return (
      <div className="relative shrink-0">
        {/* Avatar button */}
        <button
            type="button"
            onClick={openPicker}
            disabled={anyBusy}
            className="group relative rounded-full disabled:opacity-60 disabled:cursor-wait"
            data-testid="avatar-upload-button"
            title={anyBusy ? "Please wait…" : "Change photo"}
            aria-label="Change profile photo"
        >
          <Avatar user={user} size={72} />
          <span
              className="absolute inset-0 rounded-full bg-black/55 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden="true"
          >
                    {anyBusy ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                        <Camera className="w-5 h-5 text-white" />
                    )}
                </span>
        </button>

        {/* Remove button */}
        {hasPicture && (
            <button
                type="button"
                onClick={remove}
                disabled={anyBusy}
                data-testid="avatar-remove-button"
                title="Remove photo"
                aria-label="Remove profile photo"
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-secondary border grid place-items-center hover:text-hard disabled:opacity-50 disabled:cursor-wait transition-colors"
            >
              {removing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                  <Trash2 className="w-3 h-3" />
              )}
            </button>
        )}

        {/* Hidden file input */}
        <input
            ref={ref}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={onFileChange}
            disabled={anyBusy}
            data-testid="avatar-file-input"
        />
      </div>
  );
}