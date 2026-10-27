import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, CircleDashed, Search, Shuffle, X, LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ForYou from "@/components/ForYou";
import DailyChallenge from "@/components/DailyChallenge";
import AdSlot from "@/components/AdSlot";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProblemsQuery } from "@/hooks/useProblemsQuery";

export const diffCls = { Easy: "text-easy", Medium: "text-medium", Hard: "text-hard" };

function StatCard({ label, solved, total, cls, delay }) {
    const pct = total ? (solved / total) * 100 : 0;
    return (
        <div
            className="rise rounded-xl border bg-card p-3 sm:p-4"
            style={{ animationDelay: `${delay}ms` }}
            data-testid={`stat-${label.toLowerCase()}`}
        >
            <div className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${cls}`}>
                {label}
            </div>
            <div className="mt-1.5 sm:mt-2 font-heading text-lg sm:text-2xl font-bold">
                {solved}
                <span className="text-muted-foreground text-sm sm:text-base font-medium">/{total}</span>
            </div>
            <div className="mt-2 sm:mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                    className={`h-full rounded-full ${cls.replace("text", "bg")}`}
                    style={{ width: `${pct}%`, transition: "width .8s ease" }}
                />
            </div>
        </div>
    );
}

function SkeletonRows() {
    return (
        <div className="rounded-xl border overflow-hidden bg-card">
            <div className="h-10 bg-secondary/30 border-b" />
            {Array.from({ length: 8 }).map((_, i) => (
                <div
                    key={i}
                    className="h-14 flex items-center gap-3 px-4 border-b last:border-0 animate-pulse"
                >
                    <div className="w-4 h-4 rounded bg-secondary shrink-0" />
                    <div className="h-3.5 bg-secondary rounded w-1/2" />
                    <div className="ml-auto h-3 w-16 bg-secondary rounded" />
                </div>
            ))}
        </div>
    );
}

export default function ProblemsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { data: items = [], isLoading } = useProblemsQuery();

    const [q, setQ] = useState("");
    const [diff, setDiff] = useState("all");
    const [status, setStatus] = useState("all");
    const [tag, setTag] = useState(null);
    const [company, setCompany] = useState("all");

    const isGuest = !user && user !== null;
    const authLoading = user === null;

    const tags = useMemo(
        () => [...new Set(items.flatMap((p) => p.tags || []))].sort(),
        [items]
    );
    const companies = useMemo(
        () => [...new Set(items.flatMap((p) => p.companies || []))].sort(),
        [items]
    );

    const rows = useMemo(() => {
        const query = q.toLowerCase().trim();
        return items.filter((p) => {
            const title = (p.title || "").toLowerCase();
            return (
                (diff === "all" || p.difficulty === diff) &&
                (status === "all" || p.status === status) &&
                (!tag || (p.tags || []).includes(tag)) &&
                (company === "all" || (p.companies || []).includes(company)) &&
                (!query || title.includes(query) || String(p.id) === query)
            );
        });
    }, [items, q, diff, status, tag, company]);

    const count = (d, solvedOnly) =>
        items.filter((p) => p.difficulty === d && (!solvedOnly || p.status === "solved")).length;

    const hasActiveFilters =
        diff !== "all" || status !== "all" || company !== "all" || !!tag || !!q.trim();

    const clearFilters = () => {
        setQ("");
        setDiff("all");
        setStatus("all");
        setCompany("all");
        setTag(null);
    };

    const pickRandom = () => {
        if (!items.length) return;
        const random = items[Math.floor(Math.random() * items.length)];
        navigate(`/problems/${random.slug}`);
    };

    // ═══════════════════════════════════════════════════════
    // Initial loading (no cache, no placeholder data)
    // ═══════════════════════════════════════════════════════
    if (isLoading && items.length === 0) {
        return (
            <main className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-10">
                <div className="mb-6 sm:mb-8">
                    <div className="h-3 w-24 bg-secondary rounded mb-3 animate-pulse" />
                    <div className="h-8 sm:h-10 w-64 bg-secondary rounded mb-2 animate-pulse" />
                    <div className="h-3 w-96 max-w-full bg-secondary rounded animate-pulse" />
                </div>
                <SkeletonRows />
            </main>
        );
    }

    return (
        <main className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-10">

            {/* ═══ Guest banner ═══ */}
            {isGuest && (
                <div
                    className="rise mb-4 sm:mb-6 flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-[11px] sm:text-xs"
                    data-testid="guest-banner"
                >
                    <LogIn className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-muted-foreground min-w-0">
                        <strong className="text-foreground">Guest mode:</strong>{" "}
                        Browse and run code freely.{" "}
                        <Link to="/login" className="text-primary font-semibold hover:underline">
                            Sign in
                        </Link>{" "}
                        to submit, get a daily challenge, and track your progress.
                    </span>
                </div>
            )}

            {/* ═══ Header ═══ */}
            <div className="rise flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6 mb-6 sm:mb-8">
                <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">
                        Problem Set
                    </p>
                    <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
                        Sharpen the blade.
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-lg">
                        Curated interview classics. Run code freely as a guest — sign in to submit and track your progress.
                    </p>
                </div>
                <button
                    data-testid="random-problem-button"
                    onClick={pickRandom}
                    disabled={!items.length}
                    className="flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-full border hover:border-primary hover:text-primary transition-colors self-start shrink-0 disabled:opacity-50"
                >
                    <Shuffle className="w-4 h-4" />
                    <span>Pick one</span>
                </button>
            </div>

            {/* ═══ Stats ═══ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
                <StatCard label="Easy" solved={count("Easy", true)} total={count("Easy")} cls="text-easy" delay={60} />
                <StatCard label="Medium" solved={count("Medium", true)} total={count("Medium")} cls="text-medium" delay={120} />
                <StatCard label="Hard" solved={count("Hard", true)} total={count("Hard")} cls="text-hard" delay={180} />
            </div>

            {/* ═══ Daily + ForYou (both self-hide for guests appropriately) ═══ */}
            <DailyChallenge />
            <ForYou />

            {/* ═══ Tag pills ═══ */}
            {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                    {tags.map((t) => (
                        <button
                            key={t}
                            onClick={() => setTag(tag === t ? null : t)}
                            data-testid={`filter-tag-badge-${t.toLowerCase().replace(/\s+/g, "-")}`}
                            className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1 rounded-full border transition-colors whitespace-nowrap ${
                                tag === t
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "text-muted-foreground hover:text-foreground hover:border-foreground/30"
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            )}

            {/* ═══ Filters ═══ */}
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 mb-3 sm:mb-4">
                <div className="relative flex-1 min-w-0">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search questions"
                        data-testid="problems-search-input"
                        className="w-full h-10 pl-9 pr-9 rounded-lg bg-secondary border border-transparent focus:border-primary outline-none text-sm transition-colors"
                    />
                    {q && (
                        <button
                            onClick={() => setQ("")}
                            data-testid="problems-search-clear"
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background"
                            aria-label="Clear search"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
                    <Select value={diff} onValueChange={setDiff}>
                        <SelectTrigger className="h-10 text-xs sm:w-32" data-testid="filter-difficulty-select">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {["all", "Easy", "Medium", "Hard"].map((d) => (
                                <SelectItem key={d} value={d} data-testid={`difficulty-option-${d}`}>
                                    {d === "all" ? "Difficulty" : d}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={company} onValueChange={setCompany}>
                        <SelectTrigger className="h-10 text-xs sm:w-36" data-testid="filter-company-select">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Company</SelectItem>
                            {companies.map((c) => (
                                <SelectItem
                                    key={c}
                                    value={c}
                                    data-testid={`company-option-${c.toLowerCase().replace(/\s+/g, "-")}`}
                                >
                                    {c}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={status} onValueChange={setStatus} disabled={isGuest}>
                        <SelectTrigger className="h-10 text-xs sm:w-32" data-testid="filter-status-select">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[["all", "Status"], ["todo", "Todo"], ["attempted", "Attempted"], ["solved", "Solved"]].map(([v, l]) => (
                                <SelectItem key={v} value={v}>
                                    {l}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* ═══ Active filter summary + clear ═══ */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 mb-3 text-[11px] sm:text-xs text-muted-foreground">
                    <span>
                        {rows.length} of {items.length} shown
                    </span>
                    <button
                        onClick={clearFilters}
                        className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md hover:bg-secondary hover:text-foreground transition-colors"
                        data-testid="problems-clear-filters"
                    >
                        <X className="w-3 h-3" />
                        Clear filters
                    </button>
                </div>
            )}

            {/* ═══ Problems table ═══ */}
            <div className="rounded-xl border overflow-hidden bg-card" data-testid="problems-table">
                <div className="hidden sm:grid sm:grid-cols-[56px_1fr_260px_110px_90px] px-4 h-10 items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b bg-secondary/30">
                    <span>Status</span>
                    <span>Title</span>
                    <span>Topics</span>
                    <span>Acceptance</span>
                    <span>Difficulty</span>
                </div>

                {rows.map((p, i) => {
                    const title = p.title || "Untitled";
                    const acceptance = typeof p.acceptance === "number" ? p.acceptance : 0;
                    return (
                        <Link
                            to={`/problems/${p.slug}`}
                            key={p.slug}
                            data-testid={`problem-row-${p.id}`}
                            className={`grid grid-cols-[28px_1fr_70px] sm:grid-cols-[56px_1fr_260px_110px_90px] items-center gap-2 sm:gap-0 px-3 sm:px-4 py-2.5 sm:py-0 sm:h-14 text-xs sm:text-sm hover:bg-accent transition-colors ${
                                i % 2 ? "bg-secondary/40" : ""
                            }`}
                        >
                            <span className="shrink-0">
                                {p.status === "solved" ? (
                                    <CheckCircle2 className="w-4 h-4 text-easy" aria-label="Solved" />
                                ) : p.status === "attempted" ? (
                                    <CircleDashed className="w-4 h-4 text-medium" aria-label="Attempted" />
                                ) : null}
                            </span>
                            <span className="min-w-0">
                                <span
                                    className="font-medium truncate block"
                                    data-testid={`problem-title-link-${p.id}`}
                                >
                                    {p.id}. {title}
                                </span>
                                {!!p.companies?.length && (
                                    <span
                                        className="block text-[10px] sm:text-[11px] text-muted-foreground truncate sm:hidden"
                                        data-testid={`problem-companies-${p.id}`}
                                    >
                                        {p.companies.join(" · ")}
                                    </span>
                                )}
                            </span>
                            <span className="hidden sm:flex gap-1.5 overflow-hidden">
                                {(p.tags || []).slice(0, 2).map((t) => (
                                    <span
                                        key={t}
                                        className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground whitespace-nowrap"
                                    >
                                        {t}
                                    </span>
                                ))}
                            </span>
                            <span className="hidden sm:block text-muted-foreground text-right sm:text-left">
                                {acceptance.toFixed(1)}%
                            </span>
                            <span
                                className={`font-semibold text-right sm:text-left ${diffCls[p.difficulty] || ""}`}
                            >
                                {p.difficulty === "Medium" ? "Med." : p.difficulty || "—"}
                            </span>
                        </Link>
                    );
                })}

                {!rows.length && (
                    <div
                        className="p-6 sm:p-10 text-center text-xs sm:text-sm"
                        data-testid="problems-empty"
                    >
                        {items.length === 0 ? (
                            <p className="text-muted-foreground">
                                No problems available yet. Check back soon.
                            </p>
                        ) : (
                            <>
                                <p className="text-muted-foreground mb-3">
                                    No problems match your filters.
                                </p>
                                <button
                                    onClick={clearFilters}
                                    className="text-primary font-semibold hover:underline text-xs sm:text-sm"
                                >
                                    Clear all filters
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <AdSlot id="problems-bottom" className="mt-6 sm:mt-8" />
        </main>
    );
}