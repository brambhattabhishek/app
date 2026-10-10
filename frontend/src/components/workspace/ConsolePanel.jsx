import { useEffect, useState } from "react";
import { Plus, X, Loader2, FlaskConical, Terminal, ListChecks } from "lucide-react";

const ok = (s) => s === "Accepted";

function CaseChips({ n, active, setActive, marks, onRemove, onAdd }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="group relative">
          <button onClick={() => setActive(i)} data-testid={`case-chip-${i + 1}`}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${active === i ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"}`}>
            {marks && <span className={`w-1.5 h-1.5 rounded-full ${marks[i] ? "bg-easy" : "bg-hard"}`} />}Case {i + 1}
          </button>
          {onRemove && n > 1 && (
            <button onClick={() => onRemove(i)} data-testid={`case-remove-${i + 1}`} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-muted-foreground text-background hidden group-hover:grid place-items-center"><X className="w-2.5 h-2.5" /></button>
          )}
        </div>
      ))}
      {onAdd && n < 8 && <button onClick={onAdd} data-testid="case-add-button" className="w-7 h-7 grid place-items-center rounded-lg text-muted-foreground hover:bg-secondary"><Plus className="w-4 h-4" /></button>}
    </div>
  );
}

const Field = ({ label, value, tone, testid }) => (
  <div className="mb-3">
    <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
    <pre data-testid={testid} className={`font-mono text-[13px] px-3 py-2 rounded-lg bg-secondary whitespace-pre-wrap break-all ${tone || ""}`}>{value === null || value === undefined || value === "" ? "—" : value}</pre>
  </div>
);

function Testcases({ params, cases, setCases }) {
  const [active, setActive] = useState(0);
  const idx = Math.min(active, cases.length - 1);
  const update = (pi, v) => setCases(cases.map((c, i) => (i === idx ? c.map((x, j) => (j === pi ? v : x)) : c)));
  if (!cases.length) return null;
  return (
    <div>
      <CaseChips n={cases.length} active={idx} setActive={setActive}
        onRemove={(i) => { setCases(cases.filter((_, j) => j !== i)); setActive(0); }}
        onAdd={() => { setCases([...cases, [...cases[idx]]]); setActive(cases.length); }} />
      {params.map((p, pi) => (
        <div key={p.name} className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5 font-mono">{p.name} =</p>
          <input value={cases[idx][pi]} onChange={(e) => update(pi, e.target.value)} data-testid={`testcase-input-${p.name}`} spellCheck={false}
            className="w-full font-mono text-[13px] px-3 py-2 rounded-lg bg-secondary border border-transparent focus:border-primary outline-none transition-colors" />
        </div>
      ))}
    </div>
  );
}

function RunResult({ r, params }) {
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [r]);
  const c = r.cases?.[active];
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <h3 data-testid="result-status" className={`font-heading text-xl font-bold ${ok(r.status) ? "text-easy" : "text-hard"}`}>{r.status}</h3>
        <span className="text-xs text-muted-foreground">Runtime: {r.runtimeMs} ms</span>
      </div>
      {r.error && <pre data-testid="result-error" className="font-mono text-xs p-3 rounded-lg mb-4 whitespace-pre-wrap text-hard bg-[color:var(--hard)]/10">{r.error}</pre>}
      {!!r.cases?.length && (
        <>
          <CaseChips n={r.cases.length} active={active} setActive={setActive} marks={r.cases.map((x) => x.passed)} />
          {params.map((p, i) => <Field key={p.name} label={`${p.name} =`} value={c.input.split("\n")[i]} />)}
          <Field label="Output" value={c.output} tone={c.passed ? "" : "text-hard"} testid="result-output" />
          <Field label="Expected" value={c.expected} tone="text-easy" testid="result-expected" />
          {c.stdout?.trim() && <Field label="Stdout" value={c.stdout.trim()} testid="result-stdout" />}
        </>
      )}
    </div>
  );
}

function SubmitResult({ r, params }) {
  const f = r.failedCase;
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <h3 data-testid="result-status" className={`font-heading text-2xl font-bold ${ok(r.status) ? "text-easy" : "text-hard"}`}>{r.status}</h3>
        <span className="text-sm text-muted-foreground" data-testid="result-passed">{r.passed} / {r.total} testcases passed</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">Runtime {r.runtimeMs} ms · submitted just now</p>
      {r.error && <pre data-testid="result-error" className="font-mono text-xs p-3 rounded-lg mb-4 whitespace-pre-wrap text-hard bg-[color:var(--hard)]/10">{r.error}</pre>}
      {f && !r.error?.includes("Compile") && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Failed testcase</p>
          {params.map((p, i) => <Field key={p.name} label={`${p.name} =`} value={f.input.split("\n")[i]} />)}
          <Field label="Output" value={f.output} tone="text-hard" testid="result-output" />
          <Field label="Expected" value={f.expected} tone="text-easy" testid="result-expected" />
        </>
      )}
    </div>
  );
}

function ConsoleLogs({ r }) {
  if (!r) return <p className="text-sm text-muted-foreground">Logs from print / console.log statements appear here.</p>;
  const logs = (r.cases || []).map((c, i) => [i, c.stdout?.trim()]).filter(([, s]) => s);
  return (
    <div className="font-mono text-[13px] space-y-3" data-testid="console-logs">
      {logs.map(([i, s]) => <div key={i}><p className="text-xs text-muted-foreground mb-1">// Case {i + 1}</p><pre className="whitespace-pre-wrap">{s}</pre></div>)}
      {r.failedCase?.stdout?.trim() && <pre className="whitespace-pre-wrap">{r.failedCase.stdout.trim()}</pre>}
      {r.error && <pre className="whitespace-pre-wrap text-hard">{r.error}</pre>}
      {!logs.length && !r.error && !r.failedCase?.stdout?.trim() && <p className="text-muted-foreground">No output.</p>}
    </div>
  );
}

const TABS = [["testcase", "Testcase", FlaskConical], ["result", "Test Result", ListChecks], ["console", "Console", Terminal]];

export default function ConsolePanel({ p, cases, setCases, result, tab, setTab, busy }) {
  return (
    <div className="h-full flex flex-col bg-card rounded-lg border overflow-hidden">
      <div className="h-10 flex items-center gap-1 px-2 border-b bg-secondary/50">
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} data-testid={`console-tab-${id}`}
            className={`text-sm px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors ${tab === id ? "bg-background font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className={`w-3.5 h-3.5 ${id === "result" ? "text-easy" : id === "testcase" ? "text-primary" : ""}`} />{label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4" data-testid="console-output-area">
        {tab === "testcase" && <Testcases params={p.params} cases={cases} setCases={setCases} />}
        {tab === "result" && (busy ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="result-pending"><Loader2 className="w-4 h-4 animate-spin" />{busy === "submit" ? "Judging against all testcases…" : "Running…"}</div>
        ) : !result ? <p className="text-sm text-muted-foreground">You must run your code first.</p>
          : result.kind === "submit" ? <SubmitResult r={result} params={p.params} /> : <RunResult r={result} params={p.params} />)}
        {tab === "console" && <ConsoleLogs r={result} />}
      </div>
    </div>
  );
}
