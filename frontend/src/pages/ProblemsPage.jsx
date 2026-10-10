import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, CircleDashed, Search, Shuffle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ForYou from "@/components/ForYou";
import AdSlot from "@/components/AdSlot";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const diffCls = { Easy: "text-easy", Medium: "text-medium", Hard: "text-hard" };

function StatCard({ label, solved, total, cls, delay }) {
  const pct = total ? (solved / total) * 100 : 0;
  return (
    <div className="rise rounded-xl border bg-card p-4" style={{ animationDelay: `${delay}ms` }} data-testid={`stat-${label.toLowerCase()}`}>
      <div className={`text-xs font-semibold uppercase tracking-wider ${cls}`}>{label}</div>
      <div className="mt-2 font-heading text-2xl font-bold">{solved}<span className="text-muted-foreground text-base font-medium">/{total}</span></div>
      <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full ${cls.replace("text", "bg")}`} style={{ width: `${pct}%`, transition: "width .8s ease" }} />
      </div>
    </div>
  );
}

export default function ProblemsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [diff, setDiff] = useState("all");
  const [status, setStatus] = useState("all");
  const [tag, setTag] = useState(null);
  const [company, setCompany] = useState("all");

  useEffect(() => {
    if (user === null) return;
    api.get("/problems").then(({ data }) => setItems(data));
  }, [user]);

  const tags = useMemo(() => [...new Set(items.flatMap((p) => p.tags))].sort(), [items]);
  const companies = useMemo(() => [...new Set(items.flatMap((p) => p.companies || []))].sort(), [items]);
  const rows = items.filter((p) =>
    (diff === "all" || p.difficulty === diff) &&
    (status === "all" || p.status === status) &&
    (!tag || p.tags.includes(tag)) &&
    (company === "all" || (p.companies || []).includes(company)) &&
    (p.title.toLowerCase().includes(q.toLowerCase()) || String(p.id) === q.trim()));
  const count = (d, s) => items.filter((p) => p.difficulty === d && (!s || p.status === "solved")).length;

  return (
    <main className="relative z-10 max-w-6xl mx-auto px-6 py-10">
      <div className="rise flex flex-wrap items-end justify-between gap-6 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Problem Set</p>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight">Sharpen the blade.</h1>
          <p className="text-muted-foreground mt-2 max-w-lg">Curated interview classics. Run code freely as a guest — sign in to submit and track your progress.</p>
        </div>
        <button data-testid="random-problem-button" onClick={() => items.length && navigate(`/problems/${items[Math.floor(Math.random() * items.length)].slug}`)}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full border hover:border-primary hover:text-primary transition-colors">
          <Shuffle className="w-4 h-4" /> Pick one for me
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Easy" solved={count("Easy", true)} total={count("Easy")} cls="text-easy" delay={60} />
        <StatCard label="Medium" solved={count("Medium", true)} total={count("Medium")} cls="text-medium" delay={120} />
        <StatCard label="Hard" solved={count("Hard", true)} total={count("Hard")} cls="text-hard" delay={180} />
      </div>

      <ForYou />

      <div className="flex flex-wrap gap-2 mb-4">
        {tags.map((t) => (
          <button key={t} onClick={() => setTag(tag === t ? null : t)} data-testid={`filter-tag-badge-${t.toLowerCase().replace(/\s+/g, "-")}`}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${tag === t ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground hover:border-foreground/30"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions" data-testid="problems-search-input"
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-secondary border border-transparent focus:border-primary outline-none text-sm transition-colors" />
        </div>
        <Select value={diff} onValueChange={setDiff}>
          <SelectTrigger className="w-36 h-9" data-testid="filter-difficulty-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "Easy", "Medium", "Hard"].map((d) => <SelectItem key={d} value={d} data-testid={`difficulty-option-${d}`}>{d === "all" ? "Difficulty" : d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={company} onValueChange={setCompany}>
          <SelectTrigger className="w-40 h-9" data-testid="filter-company-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Company</SelectItem>
            {companies.map((c) => <SelectItem key={c} value={c} data-testid={`company-option-${c.toLowerCase().replace(/\s+/g, "-")}`}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36 h-9" data-testid="filter-status-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[["all", "Status"], ["todo", "Todo"], ["attempted", "Attempted"], ["solved", "Solved"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border overflow-hidden bg-card" data-testid="problems-table">
        <div className="grid grid-cols-[48px_1fr_110px_90px] sm:grid-cols-[56px_1fr_260px_110px_90px] px-4 h-10 items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
          <span>Status</span><span>Title</span><span className="hidden sm:block">Topics</span><span>Acceptance</span><span>Difficulty</span>
        </div>
        {rows.map((p, i) => (
          <Link to={`/problems/${p.slug}`} key={p.slug} data-testid={`problem-row-${p.id}`}
            className={`grid grid-cols-[48px_1fr_110px_90px] sm:grid-cols-[56px_1fr_260px_110px_90px] px-4 h-14 items-center text-sm hover:bg-accent transition-colors ${i % 2 ? "bg-secondary/40" : ""}`}>
            <span>{p.status === "solved" ? <CheckCircle2 className="w-4 h-4 text-easy" /> : p.status === "attempted" ? <CircleDashed className="w-4 h-4 text-medium" /> : null}</span>
            <span className="truncate pr-4">
              <span className="font-medium" data-testid={`problem-title-link-${p.id}`}>{p.id}. {p.title}</span>
              {!!p.companies?.length && <span className="block text-[11px] text-muted-foreground truncate" data-testid={`problem-companies-${p.id}`}>{p.companies.join(" · ")}</span>}
            </span>
            <span className="hidden sm:flex gap-1.5 overflow-hidden">{p.tags.slice(0, 2).map((t) => <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground whitespace-nowrap">{t}</span>)}</span>
            <span className="text-muted-foreground">{p.acceptance.toFixed(1)}%</span>
            <span className={`font-semibold ${diffCls[p.difficulty]}`}>{p.difficulty === "Medium" ? "Med." : p.difficulty}</span>
          </Link>
        ))}
        {!rows.length && <div className="p-10 text-center text-muted-foreground text-sm" data-testid="problems-empty">No problems match your filters.</div>}
      </div>
      <AdSlot id="problems-bottom" className="mt-8" />
    </main>
  );
}
