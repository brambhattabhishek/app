import { Link } from "react-router-dom";
import { History, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { diffCls } from "@/pages/ProblemsPage";
import { useRecommendationsQuery } from "@/hooks/useProblemsQuery";

function MiniCard({ p, testid }) {
    return (
        <Link
            to={`/problems/${p.slug}`}
            data-testid={testid}
            className="group w-[240px] shrink-0 rounded-xl border bg-card p-4 hover:border-primary/60 transition-colors"
        >
            <div className="flex items-center justify-between text-xs mb-2">
                <span className={`font-semibold ${diffCls[p.difficulty]}`}>{p.difficulty}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="font-medium text-sm leading-snug">
                {p.id}. {p.title}
            </div>
            <div className="text-xs text-muted-foreground mt-2 truncate">{p.reason}</div>
        </Link>
    );
}

function SkeletonRow() {
    return (
        <div className="flex gap-3 overflow-hidden pb-1">
            {[1, 2, 3].map((i) => (
                <div
                    key={i}
                    className="w-[240px] shrink-0 rounded-xl border bg-card p-4 animate-pulse"
                >
                    <div className="h-3 w-16 bg-secondary rounded mb-3" />
                    <div className="h-4 w-full bg-secondary rounded mb-2" />
                    <div className="h-3 w-32 bg-secondary rounded" />
                </div>
            ))}
        </div>
    );
}

export default function ForYou() {
    const { user } = useAuth();
    const { data: d, isLoading } = useRecommendationsQuery();

    // Not logged in — hide entirely
    if (!user) return null;

    // Loading skeleton — only first time (no cache)
    if (isLoading && !d) {
        return (
            <section
                className="rise flex flex-col gap-6 mb-8 min-w-0"
                data-testid="for-you-loading"
            >
                <div className="min-w-0">
                    <div className="h-5 w-56 bg-secondary rounded mb-3 animate-pulse" />
                    <SkeletonRow />
                </div>
                <div className="min-w-0">
                    <div className="h-5 w-48 bg-secondary rounded mb-1 animate-pulse" />
                    <div className="h-3 w-64 bg-secondary rounded mb-3 animate-pulse" />
                    <SkeletonRow />
                </div>
            </section>
        );
    }

    // No data or empty arrays — hide
    if (!d || (!d.pending?.length && !d.recommended?.length)) return null;

    return (
        <section
            className="rise flex flex-col gap-6 mb-8 min-w-0"
            data-testid="for-you-section"
        >
            {!!d.pending?.length && (
                <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-heading font-semibold text-lg mb-3">
                        <History className="w-4 h-4 text-medium" />
                        Continue where you left off
                    </h2>
                    <div
                        className="flex gap-3 overflow-x-auto pb-1"
                        data-testid="pending-problems"
                    >
                        {d.pending.map((p) => (
                            <MiniCard key={p.slug} p={p} testid={`pending-${p.slug}`} />
                        ))}
                    </div>
                </div>
            )}
            {!!d.recommended?.length && (
                <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-heading font-semibold text-lg mb-1">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Recommended for you
                    </h2>
                    <p className="text-xs text-muted-foreground mb-3">
                        Based on what you solve most: {(d.topTags || []).join(", ")}
                    </p>
                    <div
                        className="flex gap-3 overflow-x-auto pb-1"
                        data-testid="recommended-problems"
                    >
                        {d.recommended.map((p) => (
                            <MiniCard key={p.slug} p={p} testid={`recommended-${p.slug}`} />
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}