import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Loader2 } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const input = "w-full h-10 px-3 rounded-lg bg-secondary border border-transparent focus:border-primary outline-none text-sm transition-colors";

export default function EditProfile({ user, onSaved }) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState([]);
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF({ name: user.name || "", bio: user.bio || "", location: user.location || "", phone: user.phone || "", interests: user.interests || [] });
    api.get("/problems").then(({ data }) => setTags([...new Set(data.flatMap((p) => p.tags))].sort()));
  }, [open, user]);

  const toggle = (t) => setF({ ...f, interests: f.interests.includes(t) ? f.interests.filter((x) => x !== t) : [...f.interests, t] });
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put("/profile", f);
      onSaved(data);
      toast.success("Profile updated");
      setOpen(false);
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border hover:border-primary hover:text-primary transition-colors" data-testid="edit-profile-button"><Pencil className="w-3.5 h-3.5" />Edit profile</button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" data-testid="edit-profile-dialog">
        <DialogHeader><DialogTitle className="font-heading">Edit profile</DialogTitle></DialogHeader>
        <form onSubmit={save} className="grid gap-3">
          <input className={input} placeholder="Name" value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="profile-name-input" />
          <input className={input} placeholder="Location" value={f.location || ""} onChange={(e) => setF({ ...f, location: e.target.value })} data-testid="profile-location-input" />
          <input className={input} placeholder="Mobile with country code (+91...) — for SMS updates" value={f.phone || ""} onChange={(e) => setF({ ...f, phone: e.target.value })} data-testid="profile-phone-input" />
          <textarea className={`${input} h-20 py-2`} placeholder="Short bio" value={f.bio || ""} onChange={(e) => setF({ ...f, bio: e.target.value })} data-testid="profile-bio-input" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Interests (used for recommendations)</p>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto">
              {tags.map((t) => (
                <button type="button" key={t} onClick={() => toggle(t)} data-testid={`interest-${t.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${f.interests?.includes(t) ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>
              ))}
            </div>
          </div>
          <button disabled={busy} className="h-10 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60" data-testid="profile-save-button">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}Save
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
