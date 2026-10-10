import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/api";
import { Avatar } from "@/components/Navbar";

const MAX = 3 * 1024 * 1024;

export default function AvatarUpload({ user, onChange }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return toast.error("Choose a PNG, JPG, WEBP or GIF image");
    if (file.size > MAX) return toast.error("Image must be under 3 MB");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/profile/avatar", fd);
      onChange(data);
      toast.success("Profile photo updated");
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); ref.current.value = ""; }
  };

  const remove = async () => {
    try { const { data } = await api.delete("/profile/avatar"); onChange(data); toast("Photo removed"); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="relative shrink-0">
      <button type="button" onClick={() => ref.current.click()} className="group relative rounded-full" data-testid="avatar-upload-button" title="Change photo">
        <Avatar user={user} size={72} />
        <span className="absolute inset-0 rounded-full bg-black/55 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
          {busy ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
        </span>
      </button>
      {user.picture && (
        <button type="button" onClick={remove} data-testid="avatar-remove-button" title="Remove photo"
          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-secondary border grid place-items-center hover:text-hard"><Trash2 className="w-3 h-3" /></button>
      )}
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => upload(e.target.files[0])} data-testid="avatar-file-input" />
    </div>
  );
}
