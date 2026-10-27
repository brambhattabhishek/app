import { useEffect, useMemo, useState } from "react";
import {
    Plus,
    X,
    Loader2,
    FlaskConical,
    Terminal,
    ListChecks,
    AlertTriangle,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════
const ok = (s) => s === "Accepted";

// "Ran" = reference output not available (guest / no editorial).
// Show as informational rather than error.
const neutral = (s) => s === "Ran" || s === "OK";

// Status → tone class
const statusTone = (s) => {
    if (ok(s)) return "text-easy";
    if (neutral(s)) return "text-medium";
    return "text-hard";
};

// ═══════════════════════════════════════════════════════════════
//  CaseChips — case selector with pass/fail/neutral dots
// ═══════════════════════════════════════════════════════════════
function CaseChips({ n, active, setActive, marks, comparable, onRemove, onAdd }) {
    return (
        <div className="flex flex-wrap items-center gap-2 mb-4">
            {Array.from({ length: n }).map((_, i) => {
                // Determine dot tone: passed? failed? not comparable?
                const m = marks ? marks[i] : null;
                const comp = comparable ? comparable[i] : true;
                const dotCls = m === true
                    ? "bg-easy"
                    : m === false && !comp
                        ? "bg-medium"
                        : "bg-hard";

                return (
                    <div key={i} className="group relative">
                        <button
                            onClick={() => setActive(i)}
                            data-testid={`case-chip-${i + 1}`}
                            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                                active === i
                                    ? "bg-secondary text-foreground"
                                    : "text-muted-foreground hover:bg-secondary/60"
                            }`}
                        >
                            {marks && (
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${dotCls}`}
                                    aria-label={m ? "passed" : "failed"}
                                />
                            )}
                            Case {i + 1}
                        </button>
                        {onRemove && n > 1 && (
                            <button
                                onClick={() => onRemove(i)}
                                data-testid={`case-remove-${i + 1}`}
                                aria-label={`Remove case ${i + 1}`}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-muted-foreground text-background hidden group-hover:grid place-items-center"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        )}
                    </div>
                );
            })}
            {onAdd && n < 8 && (
                <button
                    onClick={onAdd}
                    data-testid="case-add-button"
                    aria-label="Add testcase"
                    className="w-7 h-7 grid place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
                >
                    <Plus className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Field — labelled monospace preformatted value
// ═══════════════════════════════════════════════════════════════
const Field = ({ label, value, tone, testid }) => (
    <div className="mb-3">
        <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
        <pre
            data-testid={testid}
            className={`font-mono text-[13px] px-3 py-2 rounded-lg bg-secondary whitespace-pre-wrap break-all ${
                tone || ""
            }`}
        >
            {value === null || value === undefined || value === ""
                ? "—"
                : value}
        </pre>
    </div>
);

// ═══════════════════════════════════════════════════════════════
//  Testcases — editable case inputs
// ═══════════════════════════════════════════════════════════════
function Testcases({ params = [], cases = [], setCases }) {
    const [active, setActive] = useState(0);

    // Reset active if cases shrink below it
    useEffect(() => {
        if (active > cases.length - 1) setActive(0);
    }, [cases.length, active]);

    const idx = Math.min(active, Math.max(cases.length - 1, 0));
    const current = cases[idx] || [];

    const update = (pi, v) => {
        setCases(
            cases.map((c, i) =>
                i === idx ? c.map((x, j) => (j === pi ? v : x)) : c
            )
        );
    };

    const onRemove = (i) => {
        setCases(cases.filter((_, j) => j !== i));
        setActive(0);
    };

    const onAdd = () => {
        if (cases.length >= 8) return;
        const seed = current.length
            ? [...current]
            : params.map(() => "");
        setCases([...cases, seed]);
        setActive(cases.length);
    };

    if (!cases.length)
        return (
            <p className="text-sm text-muted-foreground">
                No test cases available for this problem.
            </p>
        );

    return (
        <div>
            <CaseChips
                n={cases.length}
                active={idx}
                setActive={setActive}
                onRemove={onRemove}
                onAdd={onAdd}
            />
            {params.map((p, pi) => (
                <div key={p.name} className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1.5 font-mono">
                        {p.name} =
                    </p>
                    <input
                        value={current[pi] ?? ""}
                        onChange={(e) => update(pi, e.target.value)}
                        data-testid={`testcase-input-${p.name}`}
                        spellCheck={false}
                        className="w-full font-mono text-[13px] px-3 py-2 rounded-lg bg-secondary border border-transparent focus:border-primary outline-none transition-colors"
                    />
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  RunResult — result of POST /run
// ═══════════════════════════════════════════════════════════════
function RunResult({ r, params = [] }) {
    const [active, setActive] = useState(0);
    useEffect(() => setActive(0), [r]);

    const caseList = Array.isArray(r.cases) ? r.cases : [];
    const c = caseList[Math.min(active, caseList.length - 1)];

    if (!c) return <p className="text-sm text-muted-foreground">No output.</p>;

    const passedList = caseList.map((x) => x.passed);
    const comparableList = caseList.map((x) => x.comparable !== false);

    return (
        <div>
            {/* Status header */}
            <div className="flex items-baseline gap-3 mb-4 flex-wrap">
                <h3
                    data-testid="result-status"
                    className={`font-heading text-xl font-bold ${statusTone(r.status)}`}
                >
                    {r.status}
                </h3>
                <span className="text-xs text-muted-foreground">
                    Runtime: {r.runtimeMs ?? 0} ms
                </span>
                {r.status === "Ran" && (
                    <span className="flex items-center gap-1 text-xs text-medium">
                        <AlertTriangle className="w-3 h-3" />
                        Reference output unavailable
                    </span>
                )}
            </div>

            {/* Global error */}
            {r.error && (
                <pre
                    data-testid="result-error"
                    className="font-mono text-xs p-3 rounded-lg mb-4 whitespace-pre-wrap text-hard bg-[color:var(--hard)]/10"
                >
                    {r.error}
                </pre>
            )}

            {/* Per-case view */}
            {caseList.length > 0 && (
                <>
                    <CaseChips
                        n={caseList.length}
                        active={active}
                        setActive={setActive}
                        marks={passedList}
                        comparable={comparableList}
                    />

                    {/* Input fields (one per param) */}
                    {params.map((p, i) => (
                        <Field
                            key={p.name}
                            label={`${p.name} =`}
                            value={
                                typeof c.input === "string"
                                    ? c.input.split("\n")[i]
                                    : undefined
                            }
                        />
                    ))}

                    <Field
                        label="Output"
                        value={c.output}
                        tone={
                            c.comparable === false
                                ? ""
                                : c.passed
                                    ? ""
                                    : "text-hard"
                        }
                        testid="result-output"
                    />

                    <Field
                        label="Expected"
                        value={c.expected}
                        tone={c.comparable === false ? "text-muted-foreground" : "text-easy"}
                        testid="result-expected"
                    />

                    {c.stdout?.trim() && (
                        <Field
                            label="Stdout"
                            value={c.stdout.trim()}
                            testid="result-stdout"
                        />
                    )}
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  SubmitResult — result of POST /submit
// ═══════════════════════════════════════════════════════════════
function SubmitResult({ r, params = [] }) {
    const f = r.failedCase;
    const passed = r.passed ?? 0;
    const total = r.total ?? 0;

    return (
        <div>
            <div className="flex items-baseline gap-3 mb-1 flex-wrap">
                <h3
                    data-testid="result-status"
                    className={`font-heading text-2xl font-bold ${statusTone(r.status)}`}
                >
                    {r.status}
                </h3>
                <span
                    className="text-sm text-muted-foreground"
                    data-testid="result-passed"
                >
                    {passed} / {total} testcases passed
                </span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
                Runtime {r.runtimeMs ?? 0} ms · submitted just now
            </p>

            {r.error && (
                <pre
                    data-testid="result-error"
                    className="font-mono text-xs p-3 rounded-lg mb-4 whitespace-pre-wrap text-hard bg-[color:var(--hard)]/10"
                >
                    {r.error}
                </pre>
            )}

            {f && !r.error?.toLowerCase?.().includes?.("compile") && (
                <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Failed testcase
                    </p>
                    {params.map((p, i) => (
                        <Field
                            key={p.name}
                            label={`${p.name} =`}
                            value={
                                typeof f.input === "string"
                                    ? f.input.split("\n")[i]
                                    : undefined
                            }
                        />
                    ))}
                    <Field
                        label="Output"
                        value={f.output}
                        tone="text-hard"
                        testid="result-output"
                    />
                    <Field
                        label="Expected"
                        value={f.expected}
                        tone="text-easy"
                        testid="result-expected"
                    />
                    {f.stdout?.trim() && (
                        <Field
                            label="Stdout"
                            value={f.stdout.trim()}
                            testid="result-stdout"
                        />
                    )}
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  ConsoleLogs
// ═══════════════════════════════════════════════════════════════
function ConsoleLogs({ r }) {
    if (!r)
        return (
            <p className="text-sm text-muted-foreground">
                Logs from print / console.log statements appear here.
            </p>
        );

    const caseLogs = (Array.isArray(r.cases) ? r.cases : [])
        .map((c, i) => [i, (c.stdout || "").trim()])
        .filter(([, s]) => s);

    const hasAny =
        caseLogs.length > 0 ||
        !!r.error ||
        !!r.failedCase?.stdout?.trim();

    return (
        <div className="font-mono text-[13px] space-y-3" data-testid="console-logs">
            {caseLogs.map(([i, s]) => (
                <div key={i}>
                    <p className="text-xs text-muted-foreground mb-1">
                        // Case {i + 1}
                    </p>
                    <pre className="whitespace-pre-wrap break-all">{s}</pre>
                </div>
            ))}
            {r.failedCase?.stdout?.trim() && (
                <div>
                    <p className="text-xs text-muted-foreground mb-1">
                        // Failed case
                    </p>
                    <pre className="whitespace-pre-wrap break-all">
                        {r.failedCase.stdout.trim()}
                    </pre>
                </div>
            )}
            {r.error && (
                <pre className="whitespace-pre-wrap break-all text-hard">
                    {r.error}
                </pre>
            )}
            {!hasAny && <p className="text-muted-foreground">No output.</p>}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
//  Tabs
// ═══════════════════════════════════════════════════════════════
const TABS = [
    ["testcase", "Testcase", FlaskConical],
    ["result", "Test Result", ListChecks],
    ["console", "Console", Terminal],
];

// ═══════════════════════════════════════════════════════════════
//  ConsolePanel — main export
// ═══════════════════════════════════════════════════════════════
export default function ConsolePanel({ p, cases, setCases, result, tab, setTab, busy }) {
    const params = useMemo(() => p?.params || [], [p]);

    // Prevent crash if p missing
    if (!p) {
        return (
            <div className="h-full flex items-center justify-center bg-card rounded-lg border">
                <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-card rounded-lg border overflow-hidden">
            {/* ── Tabs ── */}
            <div className="h-10 flex items-center gap-1 px-2 border-b bg-secondary/50 shrink-0">
                {TABS.map(([id, label, Icon]) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        data-testid={`console-tab-${id}`}
                        className={`text-sm px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                            tab === id
                                ? "bg-background font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Icon
                            className={`w-3.5 h-3.5 ${
                                id === "result"
                                    ? "text-easy"
                                    : id === "testcase"
                                        ? "text-primary"
                                        : ""
                            }`}
                        />
                        {label}
                    </button>
                ))}
            </div>

            {/* ── Content ── */}
            <div
                className="flex-1 overflow-auto p-4"
                data-testid="console-output-area"
            >
                {tab === "testcase" && (
                    <Testcases params={params} cases={cases} setCases={setCases} />
                )}

                {tab === "result" &&
                    (busy ? (
                        <div
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                            data-testid="result-pending"
                        >
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {busy === "submit"
                                ? "Judging against all testcases…"
                                : "Running…"}
                        </div>
                    ) : !result ? (
                        <p className="text-sm text-muted-foreground">
                            You must run your code first.
                        </p>
                    ) : result.kind === "submit" ? (
                        <SubmitResult r={result} params={params} />
                    ) : (
                        <RunResult r={result} params={params} />
                    ))}

                {tab === "console" && <ConsoleLogs r={result} />}
            </div>
        </div>
    );
}