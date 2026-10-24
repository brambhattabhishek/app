import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Users, Activity, LogIn, Eye, Send, Plus, Loader2 } from "lucide-react";
import { api, errMsg, timeAgo } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const Stat = ({ icon: Icon, label, value, id }) => (
    <div className="rounded-xl border bg-card p-4" data-testid={`admin-stat-${id}`}>
        <Icon className="w-4 h-4 text-primary mb-2" />
        <div className="font-heading text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
    </div>
);

const AddProblemsPanel = ({ onAdded }) => {
    const [numbers, setNumbers] = useState("");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null); // { ok, added?, error? }

    const submit = async () => {
        const trimmed = numbers.trim();
        if (!trimmed) return;
        setBusy(true);
        setResult(null);
        try {
            const { data } = await api.post("/admin/leetcode/add", { numbers: trimmed });
            setResult({ ok: true, added: data?.added ?? [] });
            setNumbers("");
            onAdded?.();
        } catch (e) {
            setResult({ ok: false, error: errMsg(e) });
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="rounded-xl border bg-card p-4" data-testid="admin-add-problems">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Add LeetCode Problems
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    value={numbers}
                    onChange={(e) => setNumbers(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
                    placeholder="e.g. 1 3 5  or  1,3,5  (problem numbers)"
                    className="flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    data-testid="add-problems-input"
                    disabled={busy}
                />
                <button
                    onClick={submit}
                    disabled={busy || !numbers.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                    data-testid="add-problems-btn"
                >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {busy ? "Adding…" : "Add"}
                </button>
            </div>

            {result?.ok && (
                <p className="mt-2 text-xs text-easy" data-testid="add-problems-success">
                    Added {result.added.length} problem(s)
                    {result.added.length > 0 && `: ${result.added.join(", ")}`}
                </p>
            )}
            {result && !result.ok && (
                <p className="mt-2 text-xs text-hard" data-testid="add-problems-error">
                    {result.error}
                </p>
            )}
        </section>
    );
};

export default function AdminPage() {
    const { user } = useAuth();
    const [d, setD] = useState(null);
    const [error, setError] = useState(null);

    const loadOverview = () => {
        setError(null);
        api
            .get("/admin/overview")
            .then(({ data }) => setD(data))
            .catch((e) => setError(errMsg(e)));
    };

    useEffect(() => {
        if (!user) return;
        let alive = true;
        api
            .get("/admin/overview")
            .then(({ data }) => alive && setD(data))
            .catch((e) => alive && setError(errMsg(e)));
        return () => {
            alive = false;
        };
    }, [user]);

    // Auth / role gates
    if (user === false)
        return <Navigate to="/login" state={{ from: "/admin" }} replace />;
    if (user && !user.isAdmin)
        return <Navigate to="/" replace />;

    if (error)
        return (
            <div className="p-10 text-hard text-sm" data-testid="admin-error">
                {error}
            </div>
        );
    if (!d)
        return (
            <div className="p-10 text-muted-foreground text-sm" data-testid="admin-loading">
                Loading…
            </div>
        );

    return (
        <main
            className="relative z-10 max-w-7xl mx-auto px-6 py-10 space-y-6"
            data-testid="admin-page"
        >
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                    <h1 className="font-heading text-3xl font-bold tracking-tight">
                        Users &amp; activity
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Admin-only control panel. Add problems and monitor platform activity.
                    </p>
                </div>
            </div>

            {/* ── Problem adder ──────────────────────────────────────── */}
            <AddProblemsPanel onAdded={loadOverview} />

            {/* ── Stats row ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Stat icon={Users}    label="Total users"       value={d.totalUsers}       id="users"  />
                <Stat icon={Activity} label="Active (7 days)"   value={d.activeUsers7d}    id="active" />
                <Stat icon={LogIn}    label="Logins (24h)"      value={d.logins24h}        id="logins" />
                <Stat icon={Eye}      label="Page views (24h)"  value={d.pageViews24h}     id="views"  />
                <Stat icon={Send}     label="Submissions (24h)" value={d.submissions24h}   id="subs"   />
            </div>

            {/* ── Users table ───────────────────────────────────────── */}
            <div className="rounded-xl border bg-card overflow-x-auto">
                <table className="w-full text-sm" data-testid="admin-users-table">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b">
                    <tr>
                        {["User", "Contact", "Login methods", "Logins", "Last active", "Solved", "Subs", "Last IP"].map(
                            (h) => (
                                <th key={h} className="text-left font-semibold px-4 py-3">
                                    {h}
                                </th>
                            )
                        )}
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
                            <td className="px-4 py-3 text-xs">
                                {(u.providers || [u.provider]).join(", ")}
                            </td>
                            <td className="px-4 py-3">{u.login_count || 0}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                {u.last_active_at ? timeAgo(u.last_active_at) : "—"}
                            </td>
                            <td className="px-4 py-3">{u.solved}</td>
                            <td className="px-4 py-3">{u.submissions}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                {u.last_ip || "—"}
                            </td>
                        </tr>
                    ))}
                    {d.users.length === 0 && (
                        <tr>
                            <td colSpan={8} className="px-4 py-6 text-center text-xs text-muted-foreground">
                                No users yet.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* ── Notifications + Events ────────────────────────────── */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="rounded-xl border bg-card p-4" data-testid="admin-notifications">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Welcome messages (email / SMS)
                    </p>
                    <div className="divide-y text-xs">
                        {d.notifications.map((n, i) => (
                            <div key={i} className="py-2 flex justify-between gap-3">
                <span>
                  <span className="font-semibold">{n.kind}</span> · {n.channel} → {n.to}
                </span>
                                <span
                                    className={
                                        n.status === "sent"
                                            ? "text-easy"
                                            : n.status === "mocked"
                                                ? "text-medium"
                                                : "text-hard"
                                    }
                                    title={n.error || ""}
                                >
                  {n.status} · {timeAgo(n.created_at)}
                </span>
                            </div>
                        ))}
                        {!d.notifications.length && (
                            <p className="text-muted-foreground py-2">None yet.</p>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border bg-card p-4" data-testid="admin-events">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Recent tracking events
                    </p>
                    <div className="divide-y text-xs max-h-96 overflow-auto">
                        {d.events.map((e, i) => (
                            <div key={i} className="py-2 flex justify-between gap-3">
                <span>
                  <span className="font-semibold">{e.type}</span>{" "}
                    {e.path || e.method || ""}{" "}
                    <span className="text-muted-foreground">{e.user_id || "guest"}</span>
                </span>
                                <span className="text-muted-foreground whitespace-nowrap">
                  {timeAgo(e.created_at)}
                </span>
                            </div>
                        ))}
                        {!d.events.length && (
                            <p className="text-muted-foreground py-2">None yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}