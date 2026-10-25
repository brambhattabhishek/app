import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCompaniesQuery } from "@/hooks/useProblemsQuery";

export default function CompaniesPage() {
    const { user } = useAuth();
    const { data: list = [], isLoading } = useCompaniesQuery();
    const [q, setQ] = useState("");

    // ★ Filter with null-safe name
    const rows = list.filter((c) =>
        (c.name || "").toLowerCase().includes(q.toLowerCase())
    );

    if (isLoading && list.length === 0) {
        return (
            <div className="p-6 sm:p-10 text-muted-foreground text-sm">
                Loading companies…
            </div>
        );
    }

    return (
        <main
            className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-10"
            data-testid="companies-page"
        >
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">
                Company practice
            </p>
            <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Prep for the room you'll be in.
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8 max-w-xl">
                Problems grouped by companies that have asked them in interviews.
            </p>

            <div className="relative max-w-sm mb-4 sm:mb-6">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search companies"
                    data-testid="companies-search-input"
                    className="w-full h-10 pl-9 pr-3 rounded-lg bg-secondary border border-transparent focus:border-primary outline-none text-sm"
                />
            </div>

            {rows.length === 0 ? (
                <div
                    className="p-6 sm:p-10 text-center text-xs sm:text-sm text-muted-foreground"
                    data-testid="companies-empty"
                >
                    {list.length === 0
                        ? "No companies imported yet. Go to Admin → Import Companies to add some."
                        : "No companies match your search."}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {rows.map((c, i) => {
                        const name = c.name || "Unknown";
                        const count = c.count ?? 0;
                        const solved = c.solved ?? 0;
                        const pct = count > 0 ? (solved / count) * 100 : 0;
                        const slug = name.toLowerCase().replace(/\s+/g, "-");

                        return (
                            <Link
                                key={name}
                                to={`/companies/${encodeURIComponent(name)}`}
                                data-testid={`company-card-${slug}`}
                                className="rise group rounded-xl border bg-card p-4 sm:p-5 hover:border-primary/60 transition-colors"
                                style={{ animationDelay: `${i * 30}ms` }}
                            >
                                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                                    <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-secondary grid place-items-center font-heading font-bold text-primary text-sm shrink-0">
                                        {name[0] || "?"}
                                    </span>
                                    <span className="font-heading font-semibold text-sm sm:text-lg group-hover:text-primary transition-colors truncate">
                                        {name}
                                    </span>
                                </div>
                                <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground mb-1.5">
                                    <span className="flex items-center gap-1">
                                        <Building2 className="w-3 h-3 shrink-0" />
                                        {count} problems
                                    </span>
                                    {user && (
                                        <span className="whitespace-nowrap">
                                            {solved}/{count}
                                        </span>
                                    )}
                                </div>
                                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                                    <div
                                        className="h-full bg-primary"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </main>
    );
}