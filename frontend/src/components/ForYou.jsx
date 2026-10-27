import { Link } from "react-router-dom";
import { History, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { diffCls } from "@/pages/ProblemsPage";
import { useRecommendationsQuery } from "@/hooks/useProblemsQuery";

// ═══════════════════════════════════════════════════════════
//  MiniCard — single recommended/pending problem tile
// ═══════════════════════════════════════════════════════════
function MiniCard({ p, testid }) {
    if (!p?.slug) return null;
    const difficulty = p.difficulty || "Medium";
    const reason = (p.reason || "").trim();

    return (
        <Link
            to={`/problems/${p.slug}`}
            data-testid={testid}
            className="group w-[240px] shrink-0 rounded-xl border bg-card p-4 hover:border-primary/60 transition-colors flex flex-col"
        >
            <div className="flex items-center justify-between text-xs mb-2">
                <span className={`font-semibold ${diffCls[difficulty] || ""}`}>
                    {difficulty}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-transform" />
            </div>

            <div className="font-medium text-sm leading-snug line-clamp-2 min-h-[2.5rem]">
                {p.id != null ? `${p.id}. ` : ""}
                {p.title || "Untitled"}
            </div>

            {reason && (
                <div
                    className="text-xs text-muted-foreground mt-2 truncate"
                    title={reason}
                >
                    {reason}
                </div>
            )}

            {!!p.companies?.length && (
                <div className="text-[10px] text-muted-foreground mt-1.5 truncate">
                    {p.companies.slice(0, 2).join(" · ")}
                    {p.companies.length > 2 ? ` +${p.companies.length - 2}` : ""}
                </div>
            )}
        </Link>
    );
}

// ═══════════════════════════════════════════════════════════
//  Skeleton row — one horizontal scroll strip of placeholders
// ═══════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════
//  Section header — small reusable block for consistency
// ═══════════════════════════════════════════════════════════
function SectionHeader({ icon: Icon, iconCls, title, subtitle }) {
    return (
        <>
            <h2 className="flex items-center gap-2 font-heading font-semibold text-base sm:text-lg mb-1">
                <Icon className={`w-4 h-4 ${iconCls}`} />
                {title}
            </h2>
            {subtitle && (
                <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>
            )}
            {!subtitle && <div className="mb-2" />}
        </>
    );
}

// ═══════════════════════════════════════════════════════════
//  Main component
// ═══════════════════════════════════════════════════════════
export default function ForYou() {
    const { user } = useAuth();
    const { data: d, isLoading, isError, error } = useRecommendationsQuery();

    // ═══ Not logged in — hide entirely ═══
    // (Auth not yet checked → also hide, not loading)
    if (!user || user === null) return null;

    // ═══ Error — hide silently (don't break page layout) ═══
    if (isError) {
        if (import.meta?.env?.DEV) {
            console.warn("[ForYou] recommendations failed:", error?.message);
        }
        return null;
    }

    // ═══ First load skeleton (no cache) ═══
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

    // ═══ No data / empty — hide ═══
    const pending = Array.isArray(d?.pending) ? d.pending : [];
    const recommended = Array.isArray(d?.recommended) ? d.recommended : [];
    const topTags = Array.isArray(d?.topTags) ? d.topTags : [];

    if (!d || (pending.length === 0 && recommended.length === 0)) return null;

    const topTagsLabel = topTags.length > 0 ? topTags.join(", ") : "";
    const recommendSubtitle = topTagsLabel
        ? `Based on what you solve most: ${topTagsLabel}`
        : "Pick up a fresh challenge based on your activity";

    return (
        <section
            className="rise flex flex-col gap-6 mb-8 min-w-0"
            data-testid="for-you-section"
        >
            {/* ═══ Pending — "continue where you left off" ═══ */}
            {pending.length > 0 && (
                <div className="min-w-0">
                    <SectionHeader
                        icon={History}
                        iconCls="text-medium"
                        title="Continue where you left off"
                    />
                    <div
                        className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1"
                        data-testid="pending-problems"
                    >
                        {pending.map((p) => (
                            <MiniCard
                                key={p.slug}
                                p={p}
                                testid={`pending-${p.slug}`}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ Recommended — based on top tags / interests ═══ */}
            {recommended.length > 0 && (
                <div className="min-w-0">
                    <SectionHeader
                        icon={Sparkles}
                        iconCls="text-primary"
                        title="Recommended for you"
                        subtitle={recommendSubtitle}
                    />
                    <div
                        className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1"
                        data-testid="recommended-problems"
                    >
                        {recommended.map((p) => (
                            <MiniCard
                                key={p.slug}
                                p={p}
                                testid={`recommended-${p.slug}`}
                            />
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}