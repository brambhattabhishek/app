import {
  Github,
  Linkedin,
  Twitter,
  Youtube,
  Instagram,
  Globe,
  Code2,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
//  Socials config — single source of truth
// ═══════════════════════════════════════════════════════════════
export const SOCIALS = [
  {
    key: "github",
    label: "GitHub",
    placeholder: "https://github.com/you",
    icon: Github,
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/in/you",
    icon: Linkedin,
  },
  {
    key: "twitter",
    label: "X / Twitter",
    placeholder: "https://x.com/you",
    icon: Twitter,
  },
  {
    key: "leetcode",
    label: "LeetCode",
    placeholder: "https://leetcode.com/u/you",
    icon: Code2,
  },
  {
    key: "youtube",
    label: "YouTube",
    placeholder: "https://youtube.com/@you",
    icon: Youtube,
  },
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/you",
    icon: Instagram,
  },
  {
    key: "website",
    label: "Website",
    placeholder: "https://your.site",
    icon: Globe,
  },
];

// Validate URL is http(s) — refuse javascript: etc.
const safeHref = (v) => {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════
//  Socials
// ═══════════════════════════════════════════════════════════════
export default function Socials({ socials }) {
  if (!socials || typeof socials !== "object") return null;

  // Build list of (key, label, icon, href) tuples that are valid
  const items = SOCIALS.map((s) => {
    const href = safeHref(socials[s.key]);
    return href ? { ...s, href } : null;
  }).filter(Boolean);

  if (!items.length) return null;

  return (
      <div className="flex flex-wrap gap-2" data-testid="profile-socials">
        {items.map(({ key, label, icon: Icon, href }) => (
            <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                title={label}
                aria-label={label}
                data-testid={`social-link-${key}`}
                className="w-9 h-9 grid place-items-center rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
            </a>
        ))}
      </div>
  );
}