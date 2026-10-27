import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
    Flame,
    CalendarDays,
    Target,
    Send,
    MapPin,
    Phone,
    KeyRound,
    Coins,
    Award,
    LogIn,
    Loader2,
} from "lucide-react";
import EditProfile from "@/components/EditProfile";
import AvatarUpload from "@/components/AvatarUpload";
import Socials from "@/components/Socials";
import { langLabel, timeAgo } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { diffCls } from "@/pages/ProblemsPage";
import { useProfileQuery } from "@/hooks/useProblemsQuery";

// ═══════════════════════════════════════════════════════════════
//  Card — surface container
// ═══════════════════════════════════════════════════════════════
const Card = ({ children, className = "", delay = 0, ...rest }) => (
    <div
        className={`rise rounded-2xl border bg-card p-4 sm:p-6 ${className}`}
        style={{ animationDelay: `${delay}ms` }}
        {...rest}
    >
        {children}
    </div>
);

// ═══════════════════════════════════════════════════════════════
//  SolvedRing — responsive, null-safe
// ═══════════════════════════════════════════════════════════════
function SolvedRing({ d }) {
    const r = 58;
    const c = 2 * Math.PI * r;
    const total = Number(d?.totalProblems) || 0;
    const solved = Number(d?.solved) || 0;
    const pct = total ? Math.min(solved / total, 1) : 0;

    const solvedBy = d?.solvedBy || {};
    const totals = d?.totals || {};

    return (
        <div
            className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8"
            data-testid="profile-solved-stats-chart"
        >
            {/* Ring */}
            <div className="relative w-24 h-24 sm:w-36 sm:h-36 shrink-0">
                <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                    <circle
                        cx="70"
                        cy="70"
                        r={r}
                        fill="none"
                        stroke="hsl(var(--secondary))"
                        strokeWidth="10"
                    />
                    <circle
                        cx="70"
                        cy="70"
                        r={r}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={c}
                        strokeDashoffset={c * (1 - pct)}
                        style={{ transition: "stroke-dashoffset 1s ease" }}
                    />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">
                    <div>
                        <div
                            className="font-heading text-xl sm:text-3xl font-bold"
                            data-testid="profile-solved-count"
                        >
                            {solved}
                            <span className="text-xs sm:text-base text-muted-foreground">
                                /{total}
                            </span>
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">
                            Solved
                        </div>
                    </div>
                </div>
            </div>

            {/* Easy/Med/Hard breakdown */}
            <div className="w-full flex-1 space-y-2 sm:space-y-3">
                {["Easy", "Medium", "Hard"].map((k) => {
                    const t = Number(totals[k]) || 0;
                    const s = Number(solvedBy[k]) || 0;
                    return (
                        <div key={k}>
                            <div className="flex justify-between text-xs sm:text-sm mb-1">
                                <span className={`font-semibold ${diffCls[k] || ""}`}>{k}</span>
                                <span className="text-muted-foreground">
                                    {s}/{t}
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                <div
                                    className={`h-full ${(diffCls[k] || "").replace("text", "bg")}`}
                                    style={{
                                        width: `${t ? (s / t) * 100 : 0}%`,
                                        transition: "width .8s ease",
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Heatmap — memoized, null-safe
// ═══════════════════════════════════════════════════════════════
function Heatmap({ data }) {
    const weeks = useMemo(() => {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const start = new Date(today);
        start.setUTCDate(start.getUTCDate() - 52 * 7 - today.getUTCDay());

        const out = [];
        for (let w = 0; w < 53; w++) {
            const days = [];
            for (let i = 0; i < 7; i++) {
                const dt = new Date(start);
                dt.setUTCDate(start.getUTCDate() + w * 7 + i);
                const k = dt.toISOString().slice(0, 10);
                days.push(dt > today ? null : { k, n: Number(data?.[k]) || 0 });
            }
            out.push(days);
        }
        return out;
    }, [data]);

    const shade = (n) =>
        n === 0
            ? "hsl(var(--secondary))"
            : `hsl(var(--primary) / ${Math.min(0.3 + n * 0.18, 1)})`;

    return (
        <div className="overflow-x-auto" data-testid="profile-submissions-heatmap">
            <div className="flex gap-[2px] sm:gap-[3px] w-max">
                {weeks.map((week, i) => (
                    <div key={i} className="flex flex-col gap-[2px] sm:gap-[3px]">
                        {week.map((c, j) => (
                            <div
                                key={j}
                                title={c ? `${c.n} submissions on ${c.k}` : ""}
                                className="w-[9px] h-[9px] sm:w-[11px] sm:h-[11px] rounded-[2px] sm:rounded-[3px]"
                                style={{
                                    background: c ? shade(c.n) : "transparent",
                                }}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Stat
// ═══════════════════════════════════════════════════════════════
const Stat = ({ icon: Icon, label, value, testid }) => (
    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-secondary grid place-items-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
            <div
                className="font-heading text-base sm:text-xl font-bold truncate"
                data-testid={testid}
            >
                {value}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {label}
            </div>
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════
//  Loading skeleton
// ═══════════════════════════════════════════════════════════════
function ProfileSkeleton() {
    return (
        <main className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-10 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            <div className="lg:row-span-2 rounded-2xl border bg-card p-6 animate-pulse space-y-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-secondary" />
                    <div className="flex-1 space-y-2">
                        <div className="h-5 w-40 bg-secondary rounded" />
                        <div className="h-3 w-56 bg-secondary rounded" />
                    </div>
                </div>
                <div className="h-3 w-full bg-secondary rounded" />
                <div className="h-3 w-3/4 bg-secondary rounded" />
                <div className="grid grid-cols-2 gap-4 pt-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-secondary" />
                            <div className="flex-1 space-y-1">
                                <div className="h-4 w-12 bg-secondary rounded" />
                                <div className="h-3 w-20 bg-secondary rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="lg:col-span-2 rounded-2xl border bg-card p-6 animate-pulse">
                <div className="h-4 w-32 bg-secondary rounded mb-4" />
                <div className="flex items-center gap-6">
                    <div className="w-36 h-36 rounded-full bg-secondary" />
                    <div className="flex-1 space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-3 bg-secondary rounded" />
                        ))}
                    </div>
                </div>
            </div>
            <div className="lg:col-span-2 rounded-2xl border bg-card p-6 animate-pulse">
                <div className="h-4 w-40 bg-secondary rounded mb-4" />
                <div className="h-24 bg-secondary rounded" />
            </div>
        </main>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Empty / error fallback
// ═══════════════════════════════════════════════════════════════
function ProfileFallback({ message, onRetry }) {
    return (
        <div className="min-h-[calc(100vh-48px)] grid place-items-center px-4 text-center">
            <div>
                <p className="text-sm text-muted-foreground mb-3">{message}</p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
                    >
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Main Profile Page
// ═══════════════════════════════════════════════════════════════
export default function ProfilePage() {
    const { user, setUser } = useAuth();
    const { data: fetchedData, isLoading, isError, refetch } = useProfileQuery();
    const [localOverride, setLocalOverride] = useState(null);

    const d = localOverride || fetchedData;

    // ═══ Auth states ═══
    if (user === null) return <ProfileSkeleton />; // auth checking
    if (user === false)
        return <Navigate to="/login" state={{ from: "/profile" }} replace />;

    // ═══ Data states ═══
    if (isError)
        return (
            <ProfileFallback
                message="Could not load your profile."
                onRetry={() => refetch()}
            />
        );
    if (isLoading && !d) return <ProfileSkeleton />;
    if (!d || !d.user)
        return <ProfileFallback message="No profile data available." />;

    // ═══ Derived data ═══
    const u = d.user;
    const languages = d.languages || {};
    const langTotal = Object.values(languages).reduce(
        (a, b) => a + (Number(b) || 0),
        0
    );
    const providersList = Array.isArray(u.providers)
        ? u.providers
        : u.provider
            ? [u.provider]
            : [];

    const handleUserUpdate = (newUser) => {
        setLocalOverride({ ...d, user: newUser });
        setUser(newUser);
    };

    return (
        <main
            className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-10 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5"
            data-testid="profile-page"
        >
            {/* ═══ Identity Card (left) ═══ */}
            <Card
                className="lg:row-span-2 flex flex-col gap-4 sm:gap-6"
                data-testid="profile-identity-card"
            >
                <div className="flex items-center gap-3 sm:gap-4">
                    <AvatarUpload user={u} onChange={handleUserUpdate} />
                    <div className="min-w-0">
                        <h1
                            className="font-heading text-lg sm:text-2xl font-bold truncate"
                            data-testid="profile-name"
                        >
                            {u.name || "Anonymous"}
                        </h1>
                        {u.email && (
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                {u.email}
                            </p>
                        )}
                    </div>
                </div>

                {u.bio && (
                    <p className="text-xs sm:text-sm leading-6" data-testid="profile-bio">
                        {u.bio}
                    </p>
                )}

                <Socials socials={u.socials} />

                <div
                    className="space-y-1.5 text-[11px] sm:text-xs text-muted-foreground"
                    data-testid="profile-details"
                >
                    {u.location && (
                        <p className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{u.location}</span>
                        </p>
                    )}
                    {u.phone && (
                        <p className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            {u.phone}
                        </p>
                    )}
                    {providersList.length > 0 && (
                        <p className="flex items-center gap-2">
                            <KeyRound className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                                Sign-in: {providersList.join(", ")}
                            </span>
                        </p>
                    )}
                    {u.created_at && (
                        <p>
                            Joined{" "}
                            {new Date(u.created_at).toLocaleDateString(undefined, {
                                month: "long",
                                year: "numeric",
                            })}
                            {" · "}
                            {u.login_count || 0} logins
                            {u.last_login_at &&
                                ` · last ${new Date(u.last_login_at).toLocaleString()}`}
                        </p>
                    )}
                </div>

                {!!u.interests?.length && (
                    <div className="flex flex-wrap gap-1.5" data-testid="profile-interests">
                        {u.interests.map((t) => (
                            <span
                                key={t}
                                className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-secondary"
                            >
                                {t}
                            </span>
                        ))}
                    </div>
                )}

                <EditProfile user={u} onSaved={handleUserUpdate} />

                {/* Stats 2×3 grid */}
                <div className="grid grid-cols-2 gap-3 sm:gap-5">
                    <Stat
                        icon={Flame}
                        label="Day streak"
                        value={d.streak ?? 0}
                        testid="profile-streak"
                    />
                    <Stat
                        icon={CalendarDays}
                        label="Active days"
                        value={d.activeDays ?? 0}
                        testid="profile-active-days"
                    />
                    <Stat
                        icon={Send}
                        label="Submissions"
                        value={d.totalSubmissions ?? 0}
                        testid="profile-total-submissions"
                    />
                    <Stat
                        icon={Target}
                        label="Acceptance"
                        value={`${d.acceptanceRate ?? 0}%`}
                        testid="profile-acceptance-rate"
                    />
                    <Stat
                        icon={Flame}
                        label="Daily best"
                        value={`${u.daily_streak || 0}/${u.daily_best || 0}`}
                        testid="profile-daily-streak"
                    />
                    <Stat
                        icon={Coins}
                        label="Coins"
                        value={u.coins || 0}
                        testid="profile-coins"
                    />
                </div>

                {/* Languages */}
                <div>
                    <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 sm:mb-3">
                        Languages
                    </p>
                    {langTotal === 0 && (
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            No submissions yet.
                        </p>
                    )}
                    <div className="space-y-2 sm:space-y-3" data-testid="profile-languages">
                        {Object.entries(languages)
                            .filter(([, n]) => Number(n) > 0)
                            .sort((a, b) => b[1] - a[1])
                            .map(([l, n]) => (
                                <div key={l}>
                                    <div className="flex justify-between text-xs sm:text-sm mb-1">
                                        <span>{langLabel(l)}</span>
                                        <span className="text-muted-foreground">
                                            {n}
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all"
                                            style={{
                                                width: `${langTotal ? (n / langTotal) * 100 : 0}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                    </div>
                </div>
            </Card>

            {/* ═══ About + badges ═══ */}
            {(u.about || u.badges?.length) && (
                <Card
                    className="lg:col-span-2"
                    delay={40}
                    data-testid="profile-about-card"
                >
                    {u.about && (
                        <>
                            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 sm:mb-3">
                                About
                            </p>
                            <p
                                className="text-xs sm:text-sm leading-7 whitespace-pre-line break-words"
                                data-testid="profile-about"
                            >
                                {u.about}
                            </p>
                        </>
                    )}
                    {!!u.badges?.length && (
                        <div
                            className={`flex flex-wrap gap-2 ${u.about ? "mt-3 sm:mt-4" : ""}`}
                            data-testid="profile-badges"
                        >
                            {u.badges.map((b) => (
                                <span
                                    key={b}
                                    className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full bg-primary/15 text-primary"
                                >
                                    <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                    {b}
                                </span>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            {/* ═══ Solved ring ═══ */}
            <Card className="lg:col-span-2" delay={80}>
                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 sm:mb-5">
                    Solved problems
                </p>
                <SolvedRing d={d} />
            </Card>

            {/* ═══ Heatmap ═══ */}
            <Card className="lg:col-span-2" delay={160}>
                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 sm:mb-4">
                    {d.totalSubmissions ?? 0} submissions in the past year
                </p>
                <Heatmap data={d.heatmap} />
            </Card>

            {/* ═══ Recent submissions ═══ */}
            <Card className="lg:col-span-3" delay={240}>
                <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 sm:mb-4">
                    Recent submissions
                </p>
                <div className="divide-y" data-testid="profile-recent-submissions-table">
                    {(!d.recent || d.recent.length === 0) && (
                        <p className="text-xs sm:text-sm text-muted-foreground py-6 flex items-center gap-2">
                            <LogIn className="w-3.5 h-3.5 text-primary" />
                            Nothing yet —{" "}
                            <Link to="/" className="text-primary font-semibold hover:underline">
                                solve your first problem
                            </Link>
                            .
                        </p>
                    )}
                    {(d.recent || []).map((s) => {
                        const status = s.status || "Attempted";
                        const isAccepted = status === "Accepted";
                        return (
                            <Link
                                to={`/problems/${s.slug}`}
                                key={s.submission_id || `${s.slug}-${s.created_at}`}
                                className="grid grid-cols-[1fr_70px] sm:grid-cols-[1fr_120px_90px_80px] items-center gap-2 sm:gap-0 py-2.5 sm:py-3 text-xs sm:text-sm hover:bg-accent/50 px-1 sm:px-2 rounded-md transition-colors"
                            >
                                <span className="font-medium truncate min-w-0">
                                    {s.title || s.slug}
                                </span>
                                <span
                                    className={`font-semibold text-right sm:text-left ${
                                        isAccepted ? "text-easy" : "text-hard"
                                    }`}
                                >
                                    {isAccepted ? "Accepted" : status.split(" ")[0]}
                                </span>
                                <span className="hidden sm:block text-xs text-muted-foreground">
                                    {langLabel(s.language)}
                                </span>
                                <span className="hidden sm:block text-xs text-muted-foreground text-right whitespace-nowrap">
                                    {s.created_at ? timeAgo(s.created_at) : ""}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </Card>
        </main>
    );
}