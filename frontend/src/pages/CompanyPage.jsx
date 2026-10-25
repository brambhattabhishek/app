import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CircleDashed } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { diffCls } from "@/pages/ProblemsPage";
import { useCompanyQuery } from "@/hooks/useProblemsQuery";

export default function CompanyPage() {
    const { name } = useParams();
    const { user } = useAuth();
    const { data: d, isLoading, error, isError } = useCompanyQuery(name);

    // Error state — 404 ya network error
    if (isError) {
        const msg =
            error?.response?.status === 404
                ? `Company "${name}" not found`
                : error?.response?.data?.error || error?.message || "Failed to load company";
        return (
            <div className="p-10 text-sm text-hard" data-testid="company-error">
                {msg}
                <Link to="/companies" className="block mt-4 text-primary hover:underline">
                    ← Back to all companies
                </Link>
            </div>
        );
    }

    // Loading — only on very first load (no cache)
    if (isLoading && !d) {
        return <div className="p-10 text-sm text-muted-foreground" data-testid="company-loading">Loading…</div>;
    }

    // No data (shouldn't happen after isError/isLoading checks, but defensive)
    if (!d) {
        return <div className="p-10 text-sm text-muted-foreground">No data available</div>;
    }

    const pct = d.total ? Math.round((d.solved / d.total) * 100) : 0;

    return (
        <main className="relative z-10 max-w-5xl mx-auto px-6 py-10" data-testid="company-page">
            <Link
                to="/companies"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
            >
                <ArrowLeft className="w-4 h-4" /> All companies
            </Link>

            <div className="rise flex flex-wrap items-end justify-between gap-6 mb-8">
                <div>
                    <h1
                        className="font-heading text-4xl font-bold tracking-tight"
                        data-testid="company-name"
                    >
                        {d.name}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {d.total} problems asked in {d.name} interviews
                    </p>
                </div>

                {user && (
                    <div className="min-w-[260px]" data-testid="company-progress">
                        <div className="flex justify-between text-sm mb-1.5">
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
                        <div className="flex gap-4 mt-2 text-xs">
                            {["Easy", "Medium", "Hard"].map((k) => (
                                <span key={k} className={diffCls[k]}>
                  {k} {d.byDifficulty?.[k]?.solved ?? 0}/{d.byDifficulty?.[k]?.total ?? 0}
                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div
                className="rounded-xl border bg-card divide-y overflow-hidden"
                data-testid="company-problems"
            >
                {d.problems?.length ? (
                    d.problems.map((p) => (
                        <Link
                            key={p.slug}
                            to={`/problems/${p.slug}`}
                            data-testid={`company-problem-${p.id}`}
                            className="grid grid-cols-[32px_1fr_90px_70px] items-center px-4 h-12 text-sm hover:bg-accent transition-colors"
                        >
              <span>
                {p.status === "solved" ? (
                    <CheckCircle2 className="w-4 h-4 text-easy" />
                ) : p.status === "attempted" ? (
                    <CircleDashed className="w-4 h-4 text-medium" />
                ) : null}
              </span>
                            <span className="font-medium truncate">
                {p.id}. {p.title}
              </span>
                            <span className="text-muted-foreground">
                {(p.acceptance ?? 0).toFixed(1)}%
              </span>
                            <span className={`font-semibold ${diffCls[p.difficulty]}`}>
                {p.difficulty}
              </span>
                        </Link>
                    ))
                ) : (
                    <div className="p-10 text-center text-sm text-muted-foreground">
                        No problems available for this company yet.
                    </div>
                )}
            </div>
        </main>
    );
}