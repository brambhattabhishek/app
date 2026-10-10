import { Github, Linkedin, Twitter, Youtube, Instagram, Globe, Code2 } from "lucide-react";

export const SOCIALS = [
  { key: "github", label: "GitHub", placeholder: "https://github.com/you", icon: Github },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/you", icon: Linkedin },
  { key: "twitter", label: "X / Twitter", placeholder: "https://x.com/you", icon: Twitter },
  { key: "leetcode", label: "LeetCode", placeholder: "https://leetcode.com/u/you", icon: Code2 },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@you", icon: Youtube },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/you", icon: Instagram },
  { key: "website", label: "Website", placeholder: "https://your.site", icon: Globe },
];

export default function Socials({ socials }) {
  const items = SOCIALS.filter((s) => socials?.[s.key]);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="profile-socials">
      {items.map(({ key, label, icon: Icon }) => (
        <a key={key} href={socials[key]} target="_blank" rel="noopener noreferrer nofollow" title={label} data-testid={`social-link-${key}`}
          className="w-9 h-9 grid place-items-center rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors">
          <Icon className="w-4 h-4" />
        </a>
      ))}
    </div>
  );
}
