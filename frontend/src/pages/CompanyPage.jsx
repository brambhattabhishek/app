import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CircleDashed } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { diffCls } from "@/pages/ProblemsPage";
import { useCompanyQuery } from "@/hooks/useProblemsQuery";

export default function CompanyPage() {
    const { name } = useParams();
    const { user } = useAuth();
    const { data: d, isLoading, error, isError } = useCompanyQuery(name);

    // ─── Error state ───────────────────────────────────
    if (isError) {
        const msg =
            error?.response?.status === 404
                ? `Company "${name}" not found`
                : error?.response?.data?.error ||
                error?.message ||
                "Failed to load company";
        return (
            <div className="p-6 sm:p-10 text-xs sm:text-sm text-hard" data-testid="company-error">
                {msg}
                <Link to="/companies" className="block mt-4 text-primary hover:underline">
                    ← Back to all companies
                </Link>
            </div>
        );
    }

    // ─── Loading ───────────────────────────────────────
    if (isLoading && !d) {
        return (
            <div className="p-6 sm:p-10 text-xs sm:text-sm text-muted-foreground" data-testid="company-loading">
                Loading…
            </div>
        );
    }

    // ─── No data ───────────────────────────────────────
    if (!d) {
        return (
            <div className="p-6 sm:p-10 text-xs sm:text-sm text-muted-foreground">
                No data available
            </div>
        );
    }

    const pct = d.total ? Math.round((d.solved / d.total) * 100) : 0;

    return (
        <main
            className="relative z-10 max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-10"
            data-testid="company-page"
        >
            {/* ─── Back link ────────────────────────────── */}
            <Link
                to="/companies"
                className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground mb-4 sm:mb-6"
            >
                <ArrowLeft className="w-4 h-4" /> All companies
            </Link>

            {/* ─── Header ───────────────────────────────── */}
            <div className="rise flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6 mb-6 sm:mb-8">
                <div className="min-w-0">
                    <h1
                        className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight truncate"
                        data-testid="company-name"
                    >
                        {d.name || "Company"}
                    </h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        {d.total} problems asked in {d.name} interviews
                    </p>
                </div>

                {user && (
                    <div className="w-full sm:min-w-[260px] sm:w-auto" data-testid="company-progress">
                        <div className="flex justify-between text-xs sm:text-sm mb-1.5">
                            <span className="font-semibold">Your progress</span>
                            <span className="text-muted-foreground">
                                {d.solved}/{d.total} · {pct}%
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 text-[10px] sm:text-xs">
                            {["Easy", "Medium", "Hard"].map((k) => (
                                <span key={k} className={diffCls[k]}>
                                    {k} {d.byDifficulty?.[k]?.solved ?? 0}/
                                    {d.byDifficulty?.[k]?.total ?? 0}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Problems list ────────────────────────── */}
            <div
                className="rounded-xl border bg-card divide-y overflow-hidden"
                data-testid="company-problems"
            >
                {/* Column headers — visible on sm+ */}
                <div className="hidden sm:grid sm:grid-cols-[32px_1fr_90px_70px] px-4 h-9 items-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b bg-secondary/30">
                    <span></span>
                    <span>Title</span>
                    <span>Acceptance</span>
                    <span>Difficulty</span>
                </div>

                {d.problems?.length ? (
                    d.problems.map((p) => (
                        <Link
                            key={p.slug}
                            to={`/problems/${p.slug}`}
                            data-testid={`company-problem-${p.id}`}
                            className="grid grid-cols-[24px_1fr_60px] sm:grid-cols-[32px_1fr_90px_70px] items-center gap-2 sm:gap-0 px-3 sm:px-4 py-2.5 sm:py-0 sm:h-12 text-xs sm:text-sm hover:bg-accent transition-colors"
                        >
                            <span className="shrink-0">
                                {p.status === "solved" ? (
                                    <CheckCircle2 className="w-4 h-4 text-easy" />
                                ) : p.status === "attempted" ? (
                                    <CircleDashed className="w-4 h-4 text-medium" />
                                ) : null}
                            </span>
                            <span className="font-medium truncate min-w-0">
                                {p.id}. {p.title}
                            </span>
                            {/* Acceptance — hidden on mobile, shown sm+ */}
                            <span className="hidden sm:block text-muted-foreground">
                                {(p.acceptance ?? 0).toFixed(1)}%
                            </span>
                            <span
                                className={`font-semibold text-right sm:text-left ${diffCls[p.difficulty]}`}
                            >
                                {p.difficulty === "Medium" ? "Med." : p.difficulty}
                            </span>
                        </Link>
                    ))
                ) : (
                    <div className="p-6 sm:p-10 text-center text-xs sm:text-sm text-muted-foreground">
                        No problems available for this company yet.
                    </div>
                )}
            </div>
        </main>
    );
}