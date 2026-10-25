import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Users, Activity, LogIn, Eye, Send, Plus, Loader2,
    Database, RefreshCw, Building2, Trash2
} from "lucide-react";
import { api, errMsg, timeAgo } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const Stat = ({ icon: Icon, label, value, id }) => (
    <div className="rounded-xl border bg-card p-4" data-testid={`admin-stat-${id}`}>
        <Icon className="w-4 h-4 text-primary mb-2" />
        <div className="font-heading text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
    </div>
);

// ═══════════════════════════════════════════════════════════════
//  1. Add Problems Panel
// ═══════════════════════════════════════════════════════════════
const AddProblemsPanel = ({ onAdded }) => {
    const queryClient = useQueryClient();
    const [numbers, setNumbers] = useState("");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    const submit = async () => {
        const trimmed = numbers.trim();
        if (!trimmed) return;
        setBusy(true);
        setResult(null);
        try {
            const { data } = await api.post("/admin/leetcode/add", { numbers: trimmed });
            setResult({ ok: true, added: data?.added ?? [] });
            setNumbers("");
            queryClient.invalidateQueries({ queryKey: ["problems"] });
            queryClient.invalidateQueries({ queryKey: ["companies"] });
            queryClient.invalidateQueries({ queryKey: ["recommendations"] });
            onAdded?.();
        } catch (e) {
            setResult({ ok: false, error: errMsg(e) });
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="rounded-xl border border-primary/20 bg-card p-4 shadow-sm" data-testid="admin-add-problems">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                Add Problems (Auto-detects companies)
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    value={numbers}
                    onChange={(e) => setNumbers(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
                    placeholder="e.g. 1 3 5  or  1,3,5"
                    className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    disabled={busy}
                />
                <button
                    onClick={submit}
                    disabled={busy || !numbers.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {busy ? "Adding…" : "Add"}
                </button>
            </div>
            {busy && (
                <p className="mt-2 text-xs text-muted-foreground">
                    8-15 sec per problem (auto-detect companies)
                </p>
            )}
            {result?.ok && (
                <p className="mt-2 text-xs text-green-500">
                    Added {result.added.length} problem(s): {result.added.join(", ")}
                </p>
            )}
            {result && !result.ok && <p className="mt-2 text-xs text-red-500">{result.error}</p>}
        </section>
    );
};

// ═══════════════════════════════════════════════════════════════
//  2. ★ DELETE Problems Panel (NEW)
// ═══════════════════════════════════════════════════════════════
const DeleteProblemsPanel = ({ onDeleted }) => {
    const queryClient = useQueryClient();
    const [items, setItems] = useState("");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [confirm, setConfirm] = useState(false);

    const submit = async () => {
        const trimmed = items.trim();
        if (!trimmed) return;

        if (!confirm) {
            setConfirm(true);
            return;
        }

        setBusy(true);
        setResult(null);
        setConfirm(false);
        try {
            const { data } = await api.post("/admin/leetcode/delete", { numbers: trimmed });
            setResult({
                ok: true,
                deleted: data?.deleted ?? [],
                deletedSlugs: data?.deletedSlugs ?? [],
                notFound: data?.notFound ?? [],
                errors: data?.errors ?? [],
            });
            setItems("");

            // Invalidate all caches
            queryClient.invalidateQueries({ queryKey: ["problems"] });
            queryClient.invalidateQueries({ queryKey: ["companies"] });
            queryClient.invalidateQueries({ queryKey: ["recommendations"] });
            queryClient.invalidateQueries({ queryKey: ["daily"] });

            onDeleted?.();
        } catch (e) {
            setResult({ ok: false, error: errMsg(e) });
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="rounded-xl border border-red-500/30 bg-card p-4 shadow-sm" data-testid="admin-delete-problems">
            <p className="text-xs font-semibold uppercase tracking-wider text-red-500 mb-3">
                ⚠️ Delete Problems (number or slug)
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    value={items}
                    onChange={(e) => { setItems(e.target.value); setConfirm(false); }}
                    onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
                    placeholder="e.g. 1 3 two-sum valid-parentheses"
                    className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500/40"
                    disabled={busy}
                />
                <button
                    onClick={submit}
                    disabled={busy || !items.trim()}
                    className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                        confirm ? "bg-red-600 hover:bg-red-700 animate-pulse" : "bg-red-500 hover:bg-red-600"
                    }`}
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {busy ? "Deleting…" : confirm ? "Click to confirm" : "Delete"}
                </button>
            </div>
            {confirm && (
                <p className="mt-2 text-xs text-red-400 font-semibold">
                    ⚠️ Are you sure? Click "Click to confirm" again to permanently delete.
                </p>
            )}
            {busy && (
                <p className="mt-2 text-xs text-muted-foreground">Deleting from MongoDB + JSON…</p>
            )}
            {result?.ok && (
                <>
                    {result.deleted.length > 0 && (
                        <p className="mt-2 text-xs text-green-500">
                            ✅ Deleted {result.deleted.length} problem(s): {result.deleted.join(", ")}
                        </p>
                    )}
                    {result.notFound.length > 0 && (
                        <p className="mt-2 text-xs text-yellow-500">
                            ⚠️ Not found: {result.notFound.join(", ")}
                        </p>
                    )}
                    {result.errors.length > 0 && (
                        <p className="mt-2 text-xs text-red-500">
                            ❌ Errors: {result.errors.join("; ")}
                        </p>
                    )}
                    {result.deleted.length === 0 && result.notFound.length === 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">Nothing deleted.</p>
                    )}
                </>
            )}
            {result && !result.ok && <p className="mt-2 text-xs text-red-500">{result.error}</p>}
        </section>
    );
};

// ═══════════════════════════════════════════════════════════════
//  3. Company Import Panel
// ═══════════════════════════════════════════════════════════════
const CompanyImportPanel = () => {
    const queryClient = useQueryClient();
    const [companies, setCompanies] = useState("Accenture, Amazon, Google, Microsoft, Meta");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    const submit = async () => {
        const list = companies.split(",").map(s => s.trim()).filter(Boolean);
        if (!list.length) return;
        setBusy(true);
        setResult(null);
        try {
            const { data } = await api.post("/admin/leetcode/import-companies", { companies: list });
            setResult({ ok: true, summary: data.result?._summary });
            queryClient.invalidateQueries({ queryKey: ["companies"] });
            queryClient.invalidateQueries({ queryKey: ["problems"] });
            queryClient.invalidateQueries({ queryKey: ["recommendations"] });
        } catch (e) {
            setResult({ ok: false, error: errMsg(e) });
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="rounded-xl border bg-card p-4" data-testid="admin-company-import">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Import Companies (from GitHub)
            </p>
            <textarea
                value={companies}
                onChange={(e) => setCompanies(e.target.value)}
                placeholder="Accenture, Amazon, Google, Microsoft, Meta"
                className="w-full h-20 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 mb-2"
                disabled={busy}
            />
            <button
                onClick={submit}
                disabled={busy || !companies.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                {busy ? "Importing…" : "Import Companies"}
            </button>
            {busy && <p className="mt-2 text-xs text-muted-foreground">~5 sec per company</p>}
            {result?.ok && result.summary && (
                <p className="mt-2 text-xs text-green-500">
                    Imported {result.summary.totalCompanies} companies, updated {result.summary.totalProblemsUpdated} problems
                </p>
            )}
            {result && !result.ok && <p className="mt-2 text-xs text-red-500">{result.error}</p>}
        </section>
    );
};

// ═══════════════════════════════════════════════════════════════
//  4. System Tools Panel
// ═══════════════════════════════════════════════════════════════
const SystemToolsPanel = ({ onMigrated }) => {
    const queryClient = useQueryClient();
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);

    const handleMigrate = async () => {
        if (!window.confirm("Copy all local JSON problems into MongoDB?")) return;
        setBusy(true); setMsg(null);
        try {
            const { data } = await api.post("/admin/leetcode/migrate-json");
            setMsg({ ok: true, text: `Migrated ${data.migrated} problems to DB.` });
            queryClient.invalidateQueries({ queryKey: ["problems"] });
            queryClient.invalidateQueries({ queryKey: ["companies"] });
            queryClient.invalidateQueries({ queryKey: ["recommendations"] });
            onMigrated?.();
        } catch (e) {
            setMsg({ ok: false, text: errMsg(e) });
        } finally { setBusy(false); }
    };

    const handleFetchAll = async () => {
        if (!window.confirm("Fetch ALL problems from LeetCode? Takes 30-60 min in background.")) return;
        setBusy(true); setMsg(null);
        try {
            await api.post("/admin/leetcode/fetch-all", {});
            setMsg({ ok: true, text: "Background sync started. Check logs." });
            queryClient.invalidateQueries({ queryKey: ["problems"] });
            queryClient.invalidateQueries({ queryKey: ["companies"] });
            queryClient.invalidateQueries({ queryKey: ["recommendations"] });
        } catch (e) {
            const is409 = e?.response?.status === 409;
            setMsg({ ok: false, text: is409 ? "Already running." : errMsg(e) });
        } finally { setBusy(false); }
    };

    return (
        <section className="rounded-xl border bg-card p-4" data-testid="admin-system-tools">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Database & Sync Tools
            </p>
            <div className="flex flex-wrap gap-3">
                <button onClick={handleMigrate} disabled={busy} className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">
                    <Database className="w-4 h-4" /> Seed JSON → DB
                </button>
                <button onClick={handleFetchAll} disabled={busy} className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Fetch All
                </button>
            </div>
            {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-green-500" : "text-red-500"}`}>{msg.text}</p>}
        </section>
    );
};

// ═══════════════════════════════════════════════════════════════
//  5. User Role Action
// ═══════════════════════════════════════════════════════════════
const UserRoleAction = ({ user, onAction }) => {
    const [busy, setBusy] = useState(false);

    const toggleRole = async () => {
        if (!user.email) return alert("Cannot promote phone-only user.");
        const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
        if (!window.confirm(`Change ${user.email} to ${newRole}?`)) return;

        setBusy(true);
        try {
            await api.post("/auth/admin/promote", { email: user.email, role: newRole });
            onAction();
        } catch (e) {
            alert(errMsg(e));
        } finally {
            setBusy(false);
        }
    };

    if (!user.email) return <span className="text-xs text-muted-foreground">—</span>;

    return (
        <button onClick={toggleRole} disabled={busy}
                className={`text-xs px-2 py-1 rounded border transition-colors ${user.role === 'ADMIN' ? 'border-red-500/50 text-red-500 hover:bg-red-500/10' : 'border-primary/50 text-primary hover:bg-primary/10'} disabled:opacity-50`}>
            {busy ? "..." : user.role === 'ADMIN' ? "Remove Admin" : "Make Admin"}
        </button>
    );
};

// ═══════════════════════════════════════════════════════════════
//  Main Admin Page
// ═══════════════════════════════════════════════════════════════
export default function AdminPage() {
    const { user } = useAuth();

    const { data: d, isLoading, error: queryError } = useQuery({
        queryKey: ["admin-overview"],
        queryFn: async () => (await api.get("/admin/overview")).data,
        enabled: !!user && user !== false,
        staleTime: 2 * 60 * 1000,
        refetchOnWindowFocus: true,
        placeholderData: (prev) => prev,
    });

    const queryClient = useQueryClient();
    const loadOverview = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    };

    const error = queryError ? errMsg(queryError) : null;

    if (user === false) return <Navigate to="/login" state={{ from: "/admin" }} replace />;
    if (user && !user.isAdmin && user.role !== "ADMIN") return <Navigate to="/" replace />;

    if (error) return (
        <div className="p-10 text-center">
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-primary text-white rounded-md text-sm">Retry</button>
        </div>
    );
    if (isLoading && !d) return <div className="p-10 text-muted-foreground text-sm text-center">Loading…</div>;
    if (!d) return <div className="p-10 text-muted-foreground text-sm text-center">No data available</div>;

    return (
        <main className="relative z-10 max-w-7xl mx-auto px-6 py-10 space-y-6" data-testid="admin-page">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                    <h1 className="font-heading text-3xl font-bold tracking-tight">Admin Control Center</h1>
                    <p className="text-xs text-muted-foreground mt-1">Manage problems, sync data, and control user permissions.</p>
                </div>
            </div>

            {/* ★ Action Panels — 4 columns: Add, Delete, CompanyImport, SystemTools */}
            <div className="grid lg:grid-cols-2 xl:grid-cols-4 gap-4">
                <AddProblemsPanel onAdded={loadOverview} />
                <DeleteProblemsPanel onDeleted={loadOverview} />
                <CompanyImportPanel />
                <SystemToolsPanel onMigrated={loadOverview} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat icon={Users}    label="Total users"       value={d.totalUsers}       id="users"  />
                <Stat icon={Activity} label="Active (7 days)"   value={d.activeUsers7d}    id="active" />
                <Stat icon={LogIn}    label="Logins (24h)"      value={d.logins24h}        id="logins" />
                <Stat icon={Eye}      label="Page views (24h)"  value={d.pageViews24h}     id="views"  />
                <Stat icon={Send}     label="Submissions (24h)" value={d.submissions24h}   id="subs"   />
            </div>

            {/* Users Table */}
            <div className="rounded-xl border bg-card overflow-x-auto">
                <table className="w-full text-sm" data-testid="admin-users-table">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
                    <tr>
                        {["User", "Contact", "Role / Action", "Logins", "Last active", "Solved", "Subs", "Last IP"].map((h) => (
                            <th key={h} className="text-left font-semibold px-4 py-3">{h}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody className="divide-y">
                    {d.users.map((u) => (
                        <tr key={u.user_id} className="hover:bg-accent/40">
                            <td className="px-4 py-3">
                                <div className="font-medium">{u.name}</div>
                                <div className="text-xs text-muted-foreground">{u.user_id}</div>
                            </td>
                            <td className="px-4 py-3 text-xs">
                                <div>{u.email || "—"}</div>
                                <div className="text-muted-foreground">{u.phone || ""}</div>
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${u.role === 'ADMIN' || u.isAdmin ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                                        {u.role || (u.isAdmin ? "ADMIN" : "USER")}
                                    </span>
                                    <UserRoleAction user={u} onAction={loadOverview} />
                                </div>
                            </td>
                            <td className="px-4 py-3">{u.login_count || 0}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                {u.last_active_at ? timeAgo(u.last_active_at) : "—"}
                            </td>
                            <td className="px-4 py-3">{u.solved}</td>
                            <td className="px-4 py-3">{u.submissions}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{u.last_ip || "—"}</td>
                        </tr>
                    ))}
                    {d.users.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-6 text-center text-xs text-muted-foreground">No users yet.</td></tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* Notifications + Events */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Welcome messages</p>
                    <div className="divide-y text-xs">
                        {d.notifications.map((n, i) => (
                            <div key={i} className="py-2 flex justify-between gap-3">
                                <span><span className="font-semibold">{n.kind}</span> · {n.channel} → {n.to}</span>
                                <span className={n.status === "sent" ? "text-green-500" : "text-red-500"}>{n.status} · {timeAgo(n.created_at)}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Recent events</p>
                    <div className="divide-y text-xs max-h-96 overflow-auto">
                        {d.events.map((e, i) => (
                            <div key={i} className="py-2 flex justify-between gap-3">
                                <span><span className="font-semibold">{e.type}</span> {e.path || ""}</span>
                                <span className="text-muted-foreground">{timeAgo(e.created_at)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </main>
    );
}