import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCompaniesQuery } from "@/hooks/useProblemsQuery";   // ★

export default function CompaniesPage() {
    const { user } = useAuth();
    const { data: list = [], isLoading } = useCompaniesQuery();   // ★
    const [q, setQ] = useState("");

    const rows = list.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

    if (isLoading && list.length === 0) {
        return <div className="p-10 text-muted-foreground text-sm">Loading companies…</div>;
    }

    return (
        <main className="relative z-10 max-w-6xl mx-auto px-6 py-10" data-testid="companies-page">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Company practice</p>
            <h1 className="font-heading text-4xl font-bold tracking-tight mb-2">Prep for the room you'll be in.</h1>
            <p className="text-muted-foreground mb-8 max-w-xl">Problems grouped by companies that have asked them in interviews.</p>
            <div className="relative max-w-sm mb-6">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies" data-testid="companies-search-input"
                       className="w-full h-9 pl-9 pr-3 rounded-lg bg-secondary border border-transparent focus:border-primary outline-none text-sm" />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {rows.map((c, i) => (
                    <Link key={c.name} to={`/companies/${encodeURIComponent(c.name)}`} data-testid={`company-card-${c.name.toLowerCase().replace(/\s+/g, "-")}`}
                          className="rise group rounded-xl border bg-card p-5 hover:border-primary/60 transition-colors" style={{ animationDelay: `${i * 30}ms` }}>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-9 h-9 rounded-lg bg-secondary grid place-items-center font-heading font-bold text-primary">{c.name[0]}</span>
                            <span className="font-heading font-semibold text-lg group-hover:text-primary transition-colors">{c.name}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1.5"><span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{c.count} problems</span>{user && <span>{c.solved}/{c.count} solved</span>}</div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden"><div className="h-full bg-primary" style={{ width: `${(c.solved / c.count) * 100}%` }} /></div>
                    </Link>
                ))}
            </div>
        </main>
    );
}