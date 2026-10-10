import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lightbulb, Clock, Lock } from "lucide-react";
import { api, langLabel, timeAgo } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { diffCls } from "@/pages/ProblemsPage";

export const fmtInput = (params, input) =>
  input.split("\n").map((v, i) => `${params[i]?.name} = ${v}`).join(", ");

function Description({ p }) {
  return (
    <div className="rise">
      <h1 className="font-heading text-2xl font-bold tracking-tight" data-testid="problem-title">{p.id}. {p.title}</h1>
      <div className="flex flex-wrap items-center gap-2 mt-3 mb-6">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary ${diffCls[p.difficulty]}`} data-testid="problem-difficulty">{p.difficulty}</span>
        {p.tags.map((t) => <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">{t}</span>)}
      </div>
      <div className="prose-lc text-[15px]" dangerouslySetInnerHTML={{ __html: p.description }} />
      {p.sampleTests.map((t, i) => (
        <div key={i} className="mt-5" data-testid={`example-${i + 1}`}>
          <p className="font-semibold text-sm mb-2">Example {i + 1}:</p>
          <div className="border-l-2 border-border pl-4 font-mono text-[13px] leading-7">
            <div><span className="font-semibold">Input:</span> <span className="text-muted-foreground">{fmtInput(p.params, t.input)}</span></div>
            <div><span className="font-semibold">Output:</span> <span className="text-muted-foreground">{t.expected}</span></div>
          </div>
        </div>
      ))}
      <p className="font-semibold text-sm mt-7 mb-2">Constraints:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        {p.constraints.map((c) => <li key={c}><code className="font-mono text-[12.5px] px-1.5 py-0.5 rounded bg-secondary border">{c}</code></li>)}
      </ul>
    </div>
  );
}

function Editorial({ p }) {
  return (
    <div className="rise space-y-5" data-testid="editorial-content">
      <div className="flex items-center gap-2 text-primary"><Lightbulb className="w-5 h-5" /><h2 className="font-heading text-xl font-bold">Approach</h2></div>
      <p className="leading-7 text-[15px]">{p.editorial.approach}</p>
      <div className="text-sm px-3 py-2 rounded-lg bg-secondary inline-block font-mono">{p.editorial.complexity}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Python3</p>
        <pre className="font-mono text-[13px] leading-6 p-4 rounded-xl bg-console border overflow-auto">{p.editorial.code}</pre>
      </div>
    </div>
  );
}

function Submissions({ slug, refreshKey, onLoad }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!user) return;
    api.get("/submissions", { params: { slug } }).then(({ data }) => setRows(data));
  }, [user, slug, refreshKey]);

  if (!user) return (
    <div className="h-full grid place-items-center text-center py-16" data-testid="submissions-locked">
      <div><Lock className="w-8 h-8 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground text-sm mb-4">Sign in to see your submissions</p>
        <button onClick={() => navigate("/login", { state: { from: `/problems/${slug}` } })} className="text-sm font-semibold px-4 py-2 rounded-full bg-primary text-primary-foreground" data-testid="submissions-login-button">Sign in</button></div>
    </div>
  );
  if (!rows) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!rows.length) return <p className="text-sm text-muted-foreground py-10 text-center" data-testid="submissions-empty">No submissions yet.</p>;
  return (
    <div className="divide-y rounded-xl border overflow-hidden" data-testid="submissions-list">
      {rows.map((s) => (
        <button key={s.submission_id} onClick={() => onLoad(s)} data-testid={`submission-row-${s.submission_id}`}
          className="w-full grid grid-cols-[1fr_90px_80px] items-center px-4 py-3 text-left text-sm hover:bg-accent transition-colors">
          <span>
            <span className={`font-semibold ${s.status === "Accepted" ? "text-easy" : "text-hard"}`}>{s.status}</span>
            <span className="block text-xs text-muted-foreground">{timeAgo(s.created_at)} · {s.passed}/{s.total} passed</span>
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-secondary w-fit">{langLabel(s.language)}</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{s.runtimeMs} ms</span>
        </button>
      ))}
    </div>
  );
}

const TABS = [["description", "Description"], ["solutions", "Editorial"], ["submissions", "Submissions"]];

export default function LeftPanel({ p, tab, setTab, refreshKey, onLoad }) {
  return (
    <div className="h-full flex flex-col bg-card rounded-lg border overflow-hidden">
      <div className="h-10 flex items-center gap-1 px-2 border-b bg-secondary/50">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} data-testid={`workspace-tab-${id}`}
            className={`text-sm px-3 py-1 rounded-md transition-colors ${tab === id ? "bg-background font-semibold" : "text-muted-foreground hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-5">
        {tab === "description" && <Description p={p} />}
        {tab === "solutions" && <Editorial p={p} />}
        {tab === "submissions" && <Submissions slug={p.slug} refreshKey={refreshKey} onLoad={onLoad} />}
      </div>
    </div>
  );
}
