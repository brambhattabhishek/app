import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CircleDashed } from "lucide-react";
import { api, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { diffCls } from "@/pages/ProblemsPage";

export default function CompanyPage() {
  const { name } = useParams();
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (user === null) return;
    api.get(`/companies/${encodeURIComponent(name)}`).then(({ data }) => setD(data)).catch((e) => setError(errMsg(e)));
  }, [name, user]);

  if (error) return <div className="p-10 text-sm text-hard" data-testid="company-error">{error}</div>;
  if (!d) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  const pct = d.total ? Math.round((d.solved / d.total) * 100) : 0;

  return (
    <main className="relative z-10 max-w-5xl mx-auto px-6 py-10" data-testid="company-page">
      <Link to="/companies" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="w-4 h-4" />All companies</Link>
      <div className="rise flex flex-wrap items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="font-heading text-4xl font-bold tracking-tight" data-testid="company-name">{d.name}</h1>
          <p className="text-muted-foreground mt-1">{d.total} problems asked in {d.name} interviews</p>
        </div>
        {user && (
          <div className="min-w-[260px]" data-testid="company-progress">
            <div className="flex justify-between text-sm mb-1.5"><span className="font-semibold">Your progress</span><span className="text-muted-foreground">{d.solved}/{d.total} · {pct}%</span></div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
            <div className="flex gap-4 mt-2 text-xs">
              {["Easy", "Medium", "Hard"].map((k) => <span key={k} className={diffCls[k]}>{k} {d.byDifficulty[k].solved}/{d.byDifficulty[k].total}</span>)}
            </div>
          </div>
        )}
      </div>
      <div className="rounded-xl border bg-card divide-y overflow-hidden" data-testid="company-problems">
        {d.problems.map((p) => (
          <Link key={p.slug} to={`/problems/${p.slug}`} data-testid={`company-problem-${p.id}`}
            className="grid grid-cols-[32px_1fr_90px_70px] items-center px-4 h-12 text-sm hover:bg-accent transition-colors">
            <span>{p.status === "solved" ? <CheckCircle2 className="w-4 h-4 text-easy" /> : p.status === "attempted" ? <CircleDashed className="w-4 h-4 text-medium" /> : null}</span>
            <span className="font-medium truncate">{p.id}. {p.title}</span>
            <span className="text-muted-foreground">{p.acceptance.toFixed(1)}%</span>
            <span className={`font-semibold ${diffCls[p.difficulty]}`}>{p.difficulty}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
