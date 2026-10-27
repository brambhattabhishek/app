import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Loader2, X } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { SOCIALS } from "@/components/Socials";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const input =
    "w-full h-10 px-3 rounded-lg bg-secondary border border-transparent focus:border-primary outline-none text-sm transition-colors";

// Normalize a value to a trimmed string, or ""
const s = (v) => (typeof v === "string" ? v : "");

// Empty-form shape — single source of truth for reset behaviour
const emptyForm = {
  name: "",
  bio: "",
  about: "",
  location: "",
  phone: "",
  interests: [],
  socials: {},
  daily_reminder: false,
};

// Build form state from the passed `user` object safely
const fromUser = (u) => ({
  name: s(u?.name),
  bio: s(u?.bio),
  about: s(u?.about),
  location: s(u?.location),
  phone: s(u?.phone),
  interests: Array.isArray(u?.interests) ? [...u.interests] : [],
  socials: u?.socials && typeof u.socials === "object" ? { ...u.socials } : {},
  daily_reminder: !!u?.daily_reminder,
});

export default function EditProfile({ user, onSaved }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [tags, setTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Populate form on open + fetch tag list once
  useEffect(() => {
    if (!open) return;
    setForm(fromUser(user));

    let cancelled = false;
    setTagsLoading(true);
    api.get("/problems")
        .then(({ data }) => {
          if (cancelled) return;
          const all = Array.isArray(data) ? data : [];
          const uniq = [
            ...new Set(
                all.flatMap((p) => (Array.isArray(p?.tags) ? p.tags : []))
            ),
          ].sort();
          setTags(uniq);
        })
        .catch(() => {
          if (!cancelled) setTags([]);
        })
        .finally(() => {
          if (!cancelled) setTagsLoading(false);
        });

    return () => {
      cancelled = true;
    };
  }, [open, user]);

  // Patch helper — shallow merge into form
  const patch = (updates) => setForm((prev) => ({ ...prev, ...updates }));

  // Toggle an interest tag (max 10 enforced server-side too)
  const toggleInterest = (t) => {
    setForm((prev) => {
      const has = prev.interests.includes(t);
      if (has) {
        return { ...prev, interests: prev.interests.filter((x) => x !== t) };
      }
      if (prev.interests.length >= 10) {
        toast.error("You can select up to 10 interests");
        return prev;
      }
      return { ...prev, interests: [...prev.interests, t] };
    });
  };

  // Dirty check — enables/disables Save button
  const isDirty = useMemo(() => {
    const a = JSON.stringify(fromUser(user));
    const b = JSON.stringify(form);
    return a !== b;
  }, [user, form]);

  // Validation (client-side, mirrors backend)
  const validate = () => {
    const name = form.name.trim();
    if (!name) return "Name is required";
    if (name.length > 60) return "Name must be 60 characters or fewer";

    if (form.bio.length > 280) return "Bio must be 280 characters or fewer";
    if (form.about.length > 1500) return "About must be 1500 characters or fewer";
    if (form.location.length > 80) return "Location must be 80 characters or fewer";

    const phone = form.phone.replace(/[\s-]/g, "");
    if (phone && !/^\+[1-9]\d{7,14}$/.test(phone))
      return "Phone must include country code (e.g., +919876543210)";

    // Social links — must be https:// on allowed host if set
    for (const { key, label } of SOCIALS) {
      const v = (form.socials?.[key] || "").trim();
      if (!v) continue;
      if (!/^https:\/\//i.test(v))
        return `${label} link must start with https://`;
      try {
        // eslint-disable-next-line no-new
        new URL(v);
      } catch {
        return `${label} link is not a valid URL`;
      }
    }

    return null;
  };

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;

    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    // Only send socials that have a value
    const socials = {};
    for (const { key } of SOCIALS) {
      const v = (form.socials?.[key] || "").trim();
      if (v) socials[key] = v;
    }

    const payload = {
      name: form.name.trim(),
      bio: form.bio.trim(),
      about: form.about.trim(),
      location: form.location.trim(),
      phone: form.phone.replace(/[\s-]/g, ""),
      interests: form.interests,
      socials,
      daily_reminder: !!form.daily_reminder,
    };

    setBusy(true);
    try {
      const { data } = await api.put("/profile", payload);
      onSaved?.(data);
      toast.success("Profile updated");
      setOpen(false);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenChange = (next) => {
    // Prevent closing while saving
    if (busy) return;
    setOpen(next);
  };

  return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <button
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border hover:border-primary hover:text-primary transition-colors"
              data-testid="edit-profile-button"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit profile
          </button>
        </DialogTrigger>

        <DialogContent
            className="max-w-lg max-h-[90vh] overflow-y-auto"
            data-testid="edit-profile-dialog"
            // Prevent closing on overlay click while saving
            onPointerDownOutside={(e) => busy && e.preventDefault()}
            onEscapeKeyDown={(e) => busy && e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="font-heading">Edit profile</DialogTitle>
          </DialogHeader>

          <form onSubmit={save} className="grid gap-3">
            {/* ── Basic info ── */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Name <span className="text-hard">*</span>
              </label>
              <input
                  className={`${input} mt-1`}
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  maxLength={60}
                  data-testid="profile-name-input"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Location
              </label>
              <input
                  className={`${input} mt-1`}
                  placeholder="City, Country"
                  value={form.location}
                  onChange={(e) => patch({ location: e.target.value })}
                  maxLength={80}
                  data-testid="profile-location-input"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Phone (for SMS updates)
              </label>
              <input
                  className={`${input} mt-1`}
                  type="tel"
                  placeholder="+919876543210"
                  value={form.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                  data-testid="profile-phone-input"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Headline / short bio
              </label>
              <input
                  className={`${input} mt-1`}
                  placeholder="SDE @ Company · Solving for interviews"
                  value={form.bio}
                  onChange={(e) => patch({ bio: e.target.value })}
                  maxLength={280}
                  data-testid="profile-bio-input"
              />
              <p className="text-[10px] text-muted-foreground text-right mt-0.5">
                {form.bio.length}/280
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                About me
              </label>
              <textarea
                  className={`${input} h-24 py-2 mt-1`}
                  placeholder="Experience, goals, what you're preparing for"
                  value={form.about}
                  onChange={(e) => patch({ about: e.target.value })}
                  maxLength={1500}
                  data-testid="profile-about-input"
              />
              <p className="text-[10px] text-muted-foreground text-right mt-0.5">
                {form.about.length}/1500
              </p>
            </div>

            {/* ── Social profiles ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Social profiles
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SOCIALS.map(({ key, label, placeholder }) => (
                    <div key={key} className="relative">
                      <input
                          className={`${input} h-9 text-xs pr-8`}
                          type="url"
                          placeholder={placeholder}
                          aria-label={label}
                          value={form.socials?.[key] || ""}
                          onChange={(e) =>
                              patch({
                                socials: {
                                  ...form.socials,
                                  [key]: e.target.value,
                                },
                              })
                          }
                          data-testid={`social-input-${key}`}
                      />
                      {form.socials?.[key] && (
                          <button
                              type="button"
                              aria-label={`Clear ${label}`}
                              onClick={() =>
                                  patch({
                                    socials: {
                                      ...form.socials,
                                      [key]: "",
                                    },
                                  })
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-background"
                          >
                            <X className="w-3 h-3" />
                          </button>
                      )}
                    </div>
                ))}
              </div>
            </div>

            {/* ── Daily reminder ── */}
            <label className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5 text-sm cursor-pointer">
              <span className="flex-1">Email me a daily challenge reminder</span>
              <Switch
                  checked={!!form.daily_reminder}
                  onCheckedChange={(v) => patch({ daily_reminder: v })}
                  data-testid="daily-reminder-switch"
              />
            </label>

            {/* ── Interests ── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Interests (used for recommendations)
              </p>
              {tagsLoading && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Loading topics…
                  </p>
              )}
              {!tagsLoading && tags.length === 0 && (
                  <p className="text-xs text-muted-foreground mb-2">
                    No topics available yet.
                  </p>
              )}
              {tags.length > 0 && (
                  <>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto pr-1">
                      {tags.map((t) => {
                        const active = form.interests?.includes(t);
                        return (
                            <button
                                type="button"
                                key={t}
                                onClick={() => toggleInterest(t)}
                                data-testid={`interest-${t
                                    .toLowerCase()
                                    .replace(/[^a-z]+/g, "-")}`}
                                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                    active
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                              {t}
                            </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {form.interests.length}/10 selected
                    </p>
                  </>
              )}
            </div>

            {/* ── Save ── */}
            <button
                disabled={busy || !isDirty}
                className="h-10 rounded-lg bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 mt-1"
                data-testid="profile-save-button"
                title={!isDirty && !busy ? "No changes to save" : ""}
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {busy ? "Saving…" : isDirty ? "Save changes" : "No changes"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
  );
}