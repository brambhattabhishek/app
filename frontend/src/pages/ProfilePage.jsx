import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Flame, CalendarDays, Target, Send, MapPin, Phone, KeyRound, Coins, Award } from "lucide-react";
import EditProfile from "@/components/EditProfile";
import AvatarUpload from "@/components/AvatarUpload";
import Socials from "@/components/Socials";
import { langLabel, timeAgo } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { diffCls } from "@/pages/ProblemsPage";
import { useProfileQuery } from "@/hooks/useProblemsQuery";

const Card = ({ children, className = "", delay = 0, ...rest }) => (
    <div className={`rise rounded-2xl border bg-card p-6 ${className}`} style={{ animationDelay: `${delay}ms` }} {...rest}>{children}</div>
);

function SolvedRing({ d }) {
  const r = 58, c = 2 * Math.PI * r, pct = d.totalProblems ? d.solved / d.totalProblems : 0;
  return (
      <div className="flex items-center gap-8 flex-wrap" data-testid="profile-solved-stats-chart">
        <div className="relative w-36 h-36">
          <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
            <circle cx="70" cy="70" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="10" />
            <circle cx="70" cy="70" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset 1s ease" }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div><div className="font-heading text-3xl font-bold" data-testid="profile-solved-count">{d.solved}<span className="text-base text-muted-foreground">/{d.totalProblems}</span></div><div className="text-xs text-muted-foreground">Solved</div></div>
          </div>
        </div>
        <div className="flex-1 min-w-[180px] space-y-3">
          {["Easy", "Medium", "Hard"].map((k) => (
              <div key={k}>
                <div className="flex justify-between text-sm mb-1"><span className={`font-semibold ${diffCls[k]}`}>{k}</span><span className="text-muted-foreground">{d.solvedBy[k]}/{d.totals[k]}</span></div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden"><div className={`h-full ${diffCls[k].replace("text", "bg")}`} style={{ width: `${d.totals[k] ? (d.solvedBy[k] / d.totals[k]) * 100 : 0}%` }} /></div>
              </div>
          ))}
        </div>
      </div>
  );
}

function Heatmap({ data }) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today); start.setUTCDate(start.getUTCDate() - 52 * 7 - today.getUTCDay());
  const weeks = [];
  for (let w = 0; w < 53; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start); dt.setUTCDate(start.getUTCDate() + w * 7 + d);
      const k = dt.toISOString().slice(0, 10);
      days.push(dt > today ? null : { k, n: data[k] || 0 });
    }
    weeks.push(days);
  }
  const shade = (n) => (n === 0 ? "hsl(var(--secondary))" : `hsl(var(--primary) / ${Math.min(0.3 + n * 0.18, 1)})`);
  return (
      <div className="overflow-x-auto" data-testid="profile-submissions-heatmap">
        <div className="flex gap-[3px] w-max">
          {weeks.map((w, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {w.map((c, j) => <div key={j} title={c ? `${c.n} submissions on ${c.k}` : ""} className="w-[11px] h-[11px] rounded-[3px]" style={{ background: c ? shade(c.n) : "transparent" }} />)}
              </div>
          ))}
        </div>
      </div>
  );
}

const Stat = ({ icon: Icon, label, value, testid }) => (
    <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-secondary grid place-items-center"><Icon className="w-4 h-4 text-primary" /></div>
      <div><div className="font-heading text-xl font-bold" data-testid={testid}>{value}</div><div className="text-xs text-muted-foreground">{label}</div></div></div>
);

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { data: fetchedData, isLoading } = useProfileQuery();
  const [localOverride, setLocalOverride] = useState(null);

  // Use local override (after avatar/edit changes) OR fetched data
  const d = localOverride || fetchedData;

  if (user === false) return <Navigate to="/login" state={{ from: "/profile" }} replace />;
  if (isLoading && !d) return <div className="p-10 text-muted-foreground text-sm">Loading profile…</div>;
  if (!d) return <div className="p-10 text-muted-foreground text-sm">No profile data</div>;

  const langTotal = Object.values(d.languages).reduce((a, b) => a + b, 0);

  const handleUserUpdate = (u) => {
    setLocalOverride({ ...d, user: u });
    setUser(u);
  };

  return (
      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:row-span-2 flex flex-col gap-6" data-testid="profile-identity-card">
          <div className="flex items-center gap-4">
            <AvatarUpload user={d.user} onChange={handleUserUpdate} />
            <div className="min-w-0"><h1 className="font-heading text-2xl font-bold truncate" data-testid="profile-name">{d.user.name}</h1><p className="text-sm text-muted-foreground truncate">{d.user.email}</p></div>
          </div>
          {d.user.bio && <p className="text-sm leading-6" data-testid="profile-bio">{d.user.bio}</p>}
          <Socials socials={d.user.socials} />
          <div className="space-y-1.5 text-xs text-muted-foreground" data-testid="profile-details">
            {d.user.location && <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" />{d.user.location}</p>}
            {d.user.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{d.user.phone}</p>}
            <p className="flex items-center gap-2"><KeyRound className="w-3.5 h-3.5" />Sign-in: {(d.user.providers || [d.user.provider]).join(", ")}</p>
            <p>Joined {new Date(d.user.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })} · {d.user.login_count || 0} logins{d.user.last_login_at ? ` · last ${new Date(d.user.last_login_at).toLocaleString()}` : ""}</p>
          </div>
          {!!d.user.interests?.length && (
              <div className="flex flex-wrap gap-1.5" data-testid="profile-interests">{d.user.interests.map((t) => <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary">{t}</span>)}</div>
          )}
          <EditProfile user={d.user} onSaved={handleUserUpdate} />
          <div className="grid grid-cols-2 gap-5">
            <Stat icon={Flame} label="Day streak" value={d.streak} testid="profile-streak" />
            <Stat icon={CalendarDays} label="Active days" value={d.activeDays} testid="profile-active-days" />
            <Stat icon={Send} label="Submissions" value={d.totalSubmissions} testid="profile-total-submissions" />
            <Stat icon={Target} label="Acceptance" value={`${d.acceptanceRate}%`} testid="profile-acceptance-rate" />
            <Stat icon={Flame} label="Daily streak (best)" value={`${d.user.daily_streak || 0} (${d.user.daily_best || 0})`} testid="profile-daily-streak" />
            <Stat icon={Coins} label="Coins" value={d.user.coins || 0} testid="profile-coins" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Languages</p>
            {!langTotal && <p className="text-sm text-muted-foreground">No submissions yet.</p>}
            <div className="space-y-3" data-testid="profile-languages">
              {Object.entries(d.languages).sort((a, b) => b[1] - a[1]).map(([l, n]) => (
                  <div key={l}><div className="flex justify-between text-sm mb-1"><span>{langLabel(l)}</span><span className="text-muted-foreground">{n}</span></div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(n / langTotal) * 100}%` }} /></div></div>
              ))}
            </div>
          </div>
        </Card>
        {(d.user.about || d.user.badges?.length) && (
            <Card className="lg:col-span-2" delay={40} data-testid="profile-about-card">
              {d.user.about && <><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">About</p><p className="text-sm leading-7 whitespace-pre-line" data-testid="profile-about">{d.user.about}</p></>}
              {!!d.user.badges?.length && (
                  <div className={`flex flex-wrap gap-2 ${d.user.about ? "mt-4" : ""}`} data-testid="profile-badges">
                    {d.user.badges.map((b) => <span key={b} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/15 text-primary"><Award className="w-3.5 h-3.5" />{b}</span>)}
                  </div>
              )}
            </Card>
        )}
        <Card className="lg:col-span-2" delay={80}><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">Solved problems</p><SolvedRing d={d} /></Card>
        <Card className="lg:col-span-2" delay={160}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">{d.totalSubmissions} submissions in the past year</p>
          <Heatmap data={d.heatmap} />
        </Card>
        <Card className="lg:col-span-3" delay={240}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Recent submissions</p>
          <div className="divide-y" data-testid="profile-recent-submissions-table">
            {!d.recent.length && <p className="text-sm text-muted-foreground py-6">Nothing yet — <Link to="/" className="text-primary font-semibold">solve your first problem</Link>.</p>}
            {d.recent.map((s) => (
                <Link to={`/problems/${s.slug}`} key={s.submission_id} className="grid grid-cols-[1fr_120px_90px_80px] items-center py-3 text-sm hover:bg-accent/50 px-2 rounded-md transition-colors">
                  <span className="font-medium truncate">{s.title}</span>
                  <span className={`font-semibold ${s.status === "Accepted" ? "text-easy" : "text-hard"}`}>{s.status}</span>
                  <span className="text-xs text-muted-foreground">{langLabel(s.language)}</span>
                  <span className="text-xs text-muted-foreground text-right">{timeAgo(s.created_at)}</span>
                </Link>
            ))}
          </div>
        </Card>
      </main>
  );
}