import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Lightbulb,
    Clock,
    Lock,
    Building2,
    ChevronDown,
    BookOpen,
    AlertTriangle,
} from "lucide-react";
import { langLabel, timeAgo } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { diffCls } from "@/pages/ProblemsPage";
import { useSubmissionsQuery } from "@/hooks/useProblemsQuery";

// ═══════════════════════════════════════════════════════════════
//  fmtInput — safe: params may be short, input may be non-string
// ═══════════════════════════════════════════════════════════════
export const fmtInput = (params, input) => {
    if (typeof input !== "string") return "—";
    const lines = input.split("\n");
    const ps = Array.isArray(params) ? params : [];
    return lines
        .map((v, i) => `${ps[i]?.name ?? `arg${i}`} = ${v}`)
        .join(", ");
};

// ═══════════════════════════════════════════════════════════════
//  Hints — collapsible list
// ═══════════════════════════════════════════════════════════════
function Hints({ hints }) {
    const [open, setOpen] = useState({});

    if (!Array.isArray(hints) || hints.length === 0) return null;

    return (
        <div className="mt-8 divide-y border-y" data-testid="hints-section">
            {hints.map((h, i) => {
                if (h == null) return null;
                return (
                    <div key={i}>
                        <button
                            onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                            data-testid={`hint-toggle-${i + 1}`}
                            className="w-full flex items-center justify-between py-3 text-sm font-medium hover:text-primary transition-colors"
                        >
                            <span className="flex items-center gap-2">
                                <Lightbulb className="w-4 h-4 text-medium" />
                                Hint {i + 1}
                            </span>
                            <ChevronDown
                                className={`w-4 h-4 transition-transform ${
                                    open[i] ? "rotate-180" : ""
                                }`}
                            />
                        </button>
                        {open[i] && (
                            <p
                                className="pb-4 text-sm text-muted-foreground leading-6 prose-lc"
                                data-testid={`hint-content-${i + 1}`}
                                // Hints come from LeetCode, sanitized upstream
                                dangerouslySetInnerHTML={{ __html: String(h) }}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Understand section
// ═══════════════════════════════════════════════════════════════
function Understand({ p }) {
    const explanation = p?.explanation;
    const edgeCases = Array.isArray(p?.edgeCases) ? p.edgeCases : [];

    if (!explanation && edgeCases.length === 0) return null;

    return (
        <div
            className="mt-8 rounded-xl border bg-secondary/40 p-4"
            data-testid="understand-section"
        >
            {explanation && (
                <>
                    <p className="flex items-center gap-2 font-semibold text-sm mb-2">
                        <BookOpen className="w-4 h-4 text-primary" />
                        Understand the problem
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground mb-3">
                        {explanation}
                    </p>
                </>
            )}
            {edgeCases.length > 0 && (
                <>
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-hard" />
                        Edge cases to handle
                    </p>
                    <ul
                        className="list-disc pl-5 space-y-1 text-sm text-muted-foreground"
                        data-testid="edge-cases-list"
                    >
                        {edgeCases.map((e, i) => (
                            <li key={`${e}-${i}`}>{String(e)}</li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Description — main tab
// ═══════════════════════════════════════════════════════════════
function Description({ p }) {
    // Null-safe fallbacks
    const tags = Array.isArray(p?.tags) ? p.tags : [];
    const companies = Array.isArray(p?.companies) ? p.companies : [];
    const sampleTests = Array.isArray(p?.sampleTests) ? p.sampleTests : [];
    const constraints = Array.isArray(p?.constraints) ? p.constraints : [];
    const hints = Array.isArray(p?.hints) ? p.hints : [];
    const params = Array.isArray(p?.params) ? p.params : [];

    return (
        <div className="rise">
            <h1
                className="font-heading text-2xl font-bold tracking-tight"
                data-testid="problem-title"
            >
                {p?.id != null ? `${p.id}. ` : ""}
                {p?.title || "Untitled"}
            </h1>

            <div className="flex flex-wrap items-center gap-2 mt-3 mb-6">
                {p?.difficulty && (
                    <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary ${
                            diffCls[p.difficulty] || ""
                        }`}
                        data-testid="problem-difficulty"
                    >
                        {p.difficulty}
                    </span>
                )}
                {tags.map((t) => (
                    <span
                        key={t}
                        className="text-xs px-2.5 py-1 rounded-full bg-secondary text-muted-foreground"
                    >
                        {t}
                    </span>
                ))}
            </div>

            {companies.length > 0 && (
                <div
                    className="flex flex-wrap items-center gap-2 -mt-3 mb-6"
                    data-testid="problem-companies"
                >
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    {companies.map((c) => (
                        <Link
                            key={c}
                            to={`/companies/${encodeURIComponent(c)}`}
                            data-testid={`company-chip-${c
                                .toLowerCase()
                                .replace(/\s+/g, "-")}`}
                            className="text-xs px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                        >
                            {c}
                        </Link>
                    ))}
                </div>
            )}

            {/* Description HTML — LeetCode content, sanitized upstream */}
            {p?.description && (
                <div
                    className="prose-lc text-[15px]"
                    dangerouslySetInnerHTML={{ __html: p.description }}
                />
            )}

            {/* Samples */}
            {sampleTests.map((t, i) => (
                <div key={i} className="mt-5" data-testid={`example-${i + 1}`}>
                    <p className="font-semibold text-sm mb-2">Example {i + 1}:</p>
                    <div className="border-l-2 border-border pl-4 font-mono text-[13px] leading-7">
                        <div>
                            <span className="font-semibold">Input:</span>{" "}
                            <span className="text-muted-foreground">
                                {fmtInput(params, t?.input)}
                            </span>
                        </div>
                        <div>
                            <span className="font-semibold">Output:</span>{" "}
                            <span className="text-muted-foreground">
                                {t?.expected ?? "—"}
                            </span>
                        </div>
                    </div>
                </div>
            ))}

            {/* Constraints */}
            {constraints.length > 0 && (
                <>
                    <p className="font-semibold text-sm mt-7 mb-2">Constraints:</p>
                    <ul className="list-disc pl-5 space-y-1.5">
                        {constraints.map((c, i) => (
                            <li key={i}>
                                <code className="font-mono text-[12.5px] px-1.5 py-0.5 rounded bg-secondary border">
                                    {String(c)}
                                </code>
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <Understand p={p} />
            {hints.length > 0 && <Hints hints={hints} />}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Editorial tab
// ═══════════════════════════════════════════════════════════════
function Editorial({ p }) {
    const ed = p?.editorial || {};
    const hasApproach = !!ed.approach;
    const hasComplexity = !!ed.complexity;
    const hasCode = !!ed.code;

    return (
        <div className="rise space-y-5" data-testid="editorial-content">
            <div className="flex items-center gap-2 text-primary">
                <Lightbulb className="w-5 h-5" />
                <h2 className="font-heading text-xl font-bold">Approach</h2>
            </div>
            <p className="leading-7 text-[15px]">
                {hasApproach ? ed.approach : "See LeetCode for editorial."}
            </p>
            {hasComplexity && (
                <div className="text-sm px-3 py-2 rounded-lg bg-secondary inline-block font-mono">
                    {ed.complexity}
                </div>
            )}
            {hasCode && (
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Reference Solution
                    </p>
                    <pre className="font-mono text-[13px] leading-6 p-4 rounded-xl bg-console border overflow-auto">
                        {ed.code}
                    </pre>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Submissions — now uses cached hook
// ═══════════════════════════════════════════════════════════════
function Submissions({ slug, refreshKey, onLoad }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { data: rows, isLoading, isError } = useSubmissionsQuery(slug);

    // Force refetch when parent increments refreshKey (after a new submit)
    // (TanStack handles this via cache invalidation in Workspace, but we
    //  also key off refreshKey so old call-sites keep working.)
    const [, force] = useState(0);
    useEffect(() => {
        if (refreshKey != null) force((n) => n + 1);
    }, [refreshKey]);

    // Guest → locked view
    if (!user || user === false) {
        return (
            <div
                className="h-full grid place-items-center text-center py-16"
                data-testid="submissions-locked"
            >
                <div>
                    <Lock className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-sm mb-4">
                        Sign in to see your submissions
                    </p>
                    <button
                        onClick={() =>
                            navigate("/login", {
                                state: { from: `/problems/${slug}` },
                            })
                        }
                        className="text-sm font-semibold px-4 py-2 rounded-full bg-primary text-primary-foreground hover:opacity-90"
                        data-testid="submissions-login-button"
                    >
                        Sign in
                    </button>
                </div>
            </div>
        );
    }

    // Auth still checking
    if (user === null) {
        return (
            <p className="text-sm text-muted-foreground">Loading…</p>
        );
    }

    if (isError) {
        return (
            <p
                className="text-sm text-muted-foreground py-10 text-center"
                data-testid="submissions-error"
            >
                Could not load submissions.
            </p>
        );
    }

    if (isLoading && !rows) {
        return <p className="text-sm text-muted-foreground">Loading…</p>;
    }

    const list = Array.isArray(rows) ? rows : [];

    if (!list.length) {
        return (
            <p
                className="text-sm text-muted-foreground py-10 text-center"
                data-testid="submissions-empty"
            >
                No submissions yet.
            </p>
        );
    }

    return (
        <div
            className="divide-y rounded-xl border overflow-hidden"
            data-testid="submissions-list"
        >
            {list.map((s) => {
                const status = s.status || "Attempted";
                const accepted = status === "Accepted";
                return (
                    <button
                        key={
                            s.submission_id ||
                            `${s.slug}-${s.created_at}-${s.language}`
                        }
                        onClick={() => onLoad?.(s)}
                        data-testid={`submission-row-${s.submission_id}`}
                        className="w-full grid grid-cols-[1fr_90px_80px] items-center px-4 py-3 text-left text-sm hover:bg-accent transition-colors"
                    >
                        <span className="min-w-0">
                            <span
                                className={`font-semibold ${
                                    accepted ? "text-easy" : "text-hard"
                                }`}
                            >
                                {accepted ? "Accepted" : status.split(" ")[0]}
                            </span>
                            <span className="block text-xs text-muted-foreground truncate">
                                {s.created_at ? timeAgo(s.created_at) : ""}
                                {" · "}
                                {s.passed ?? 0}/{s.total ?? 0} passed
                            </span>
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-secondary w-fit">
                            {langLabel(s.language)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {s.runtimeMs ?? 0} ms
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Tabs
// ═══════════════════════════════════════════════════════════════
const TABS = [
    ["description", "Description"],
    ["solutions", "Editorial"],
    ["submissions", "Submissions"],
];

// ═══════════════════════════════════════════════════════════════
//  LeftPanel — main export
// ═══════════════════════════════════════════════════════════════
export default function LeftPanel({ p, tab, setTab, refreshKey, onLoad }) {
    // Guard: parent may render before problem loads
    const activeTab = useMemo(() => tab || "description", [tab]);

    return (
        <div className="h-full flex flex-col bg-card rounded-lg border overflow-hidden">
            <div className="h-10 flex items-center gap-1 px-2 border-b bg-secondary/50 shrink-0">
                {TABS.map(([id, label]) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        data-testid={`workspace-tab-${id}`}
                        className={`text-sm px-3 py-1 rounded-md transition-colors ${
                            activeTab === id
                                ? "bg-background font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-auto p-5">
                {!p ? (
                    <p className="text-sm text-muted-foreground">Loading problem…</p>
                ) : (
                    <>
                        {activeTab === "description" && <Description p={p} />}
                        {activeTab === "solutions" && <Editorial p={p} />}
                        {activeTab === "submissions" && (
                            <Submissions
                                slug={p.slug}
                                refreshKey={refreshKey}
                                onLoad={onLoad}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}