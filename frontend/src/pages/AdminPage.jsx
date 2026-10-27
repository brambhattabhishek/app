import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Users,
    Activity,
    LogIn,
    Eye,
    Send,
    Plus,
    Loader2,
    Database,
    RefreshCw,
    Building2,
    Trash2,
    AlertCircle,
    Shield,
} from "lucide-react";
import { api, errMsg, timeAgo } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// ═══════════════════════════════════════════════════════════════
//  Reusable sub-components
// ═══════════════════════════════════════════════════════════════

const Stat = ({ icon: Icon, label, value, id }) => (
    <div
        className="rounded-xl border bg-card p-3 sm:p-4 min-w-0"
        data-testid={`admin-stat-${id}`}
    >
        <Icon className="w-4 h-4 text-primary mb-1.5 sm:mb-2" />
        <div className="font-heading text-xl sm:text-2xl font-bold truncate">
            {value ?? 0}
        </div>
        <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
            {label}
        </div>
    </div>
);

const PanelHeader = ({ icon: Icon, title, accent }) => (
    <div
        className={`flex items-center gap-2 mb-3 ${
            accent || "text-muted-foreground"
        }`}
    >
        <Icon className="w-4 h-4 shrink-0" />
        <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider leading-tight">
            {title}
        </p>
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
        if (!trimmed || busy) return;
        setBusy(true);
        setResult(null);
        try {
            const { data } = await api.post("/admin/leetcode/add", {
                numbers: trimmed,
            });
            const added = Array.isArray(data?.added) ? data.added : [];
            setResult({ ok: true, added });
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

    const addedCount = result?.ok ? result.added.length : 0;

    return (
        <section
            className="rounded-xl border border-primary/20 bg-card p-3 sm:p-4 shadow-sm flex flex-col h-full"
            data-testid="admin-add-problems"
        >
            <PanelHeader icon={Plus} title="Add Problems" accent="text-primary" />

            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    value={numbers}
                    onChange={(e) => setNumbers(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
                    placeholder="1 3 5 or 1,3,5"
                    className="flex-1 min-w-0 h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    disabled={busy}
                    aria-label="Problem numbers to add"
                />
                <button
                    onClick={submit}
                    disabled={busy || !numbers.trim()}
                    className="h-10 shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
                >
                    {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Plus className="w-4 h-4" />
                    )}
                    <span>{busy ? "Adding…" : "Add"}</span>
                </button>
            </div>

            <div className="mt-2 text-xs min-h-[20px] break-words">
                {busy && (
                    <p className="text-muted-foreground">
                        8-15 sec per problem…
                    </p>
                )}
                {result?.ok && (
                    <p className="text-green-500">
                        Added {addedCount}
                        {addedCount > 0 && addedCount <= 5 && (
                            <>: {result.added.join(", ")}</>
                        )}
                        {addedCount > 5 && (
                            <>
                                : {result.added.slice(0, 5).join(", ")} +
                                {addedCount - 5} more
                            </>
                        )}
                    </p>
                )}
                {result && !result.ok && (
                    <p className="text-red-500">{result.error}</p>
                )}
            </div>
        </section>
    );
};

// ═══════════════════════════════════════════════════════════════
//  2. Delete Problems Panel
// ═══════════════════════════════════════════════════════════════
const DeleteProblemsPanel = ({ onDeleted }) => {
    const queryClient = useQueryClient();
    const [items, setItems] = useState("");
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [confirm, setConfirm] = useState(false);

    // Reset confirm when input changes (safety)
    const onChange = (e) => {
        setItems(e.target.value);
        if (confirm) setConfirm(false);
    };

    const submit = async () => {
        const trimmed = items.trim();
        if (!trimmed || busy) return;

        if (!confirm) {
            setConfirm(true);
            return;
        }

        setBusy(true);
        setResult(null);
        setConfirm(false);
        try {
            const { data } = await api.post("/admin/leetcode/delete", {
                numbers: trimmed,
            });
            setResult({
                ok: true,
                deleted: Array.isArray(data?.deleted) ? data.deleted : [],
                notFound: Array.isArray(data?.notFound) ? data.notFound : [],
                errors: Array.isArray(data?.errors) ? data.errors : [],
            });
            setItems("");
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
        <section
            className="rounded-xl border border-red-500/30 bg-card p-3 sm:p-4 shadow-sm flex flex-col h-full"
            data-testid="admin-delete-problems"
        >
            <PanelHeader
                icon={Trash2}
                title="Delete Problems"
                accent="text-red-500"
            />

            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    value={items}
                    onChange={onChange}
                    onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
                    placeholder="1 3 two-sum"
                    className="flex-1 min-w-0 h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-red-500/40"
                    disabled={busy}
                    aria-label="Problem numbers or slugs to delete"
                />
                <button
                    onClick={submit}
                    disabled={busy || !items.trim()}
                    className={`h-10 shrink-0 inline-flex items-center justify-center gap-1.5 rounded-md px-4 text-sm font-medium text-white disabled:opacity-50 transition-colors ${
                        confirm
                            ? "bg-red-600 hover:bg-red-700 animate-pulse"
                            : "bg-red-500 hover:bg-red-600"
                    }`}
                >
                    {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Trash2 className="w-4 h-4" />
                    )}
                    <span>
                        {busy ? "Deleting…" : confirm ? "Confirm" : "Delete"}
                    </span>
                </button>
            </div>

            <div className="mt-2 text-xs min-h-[20px] break-words">
                {confirm && (
                    <p className="text-red-400 font-semibold">
                        ⚠️ Click "Confirm" again to delete
                    </p>
                )}
                {!confirm && busy && (
                    <p className="text-muted-foreground">Deleting…</p>
                )}
                {!confirm && !busy && result?.ok && (
                    <>
                        {result.deleted.length > 0 && (
                            <p className="text-green-500">
                                Deleted {result.deleted.length}
                                {result.deleted.length <= 5 && (
                                    <>: {result.deleted.join(", ")}</>
                                )}
                                {result.deleted.length > 5 && (
                                    <>
                                        : {result.deleted.slice(0, 5).join(", ")} +
                                        {result.deleted.length - 5} more
                                    </>
                                )}
                            </p>
                        )}
                        {result.notFound.length > 0 && (
                            <p className="text-yellow-500">
                                Not found:{" "}
                                {result.notFound.slice(0, 5).join(", ")}
                                {result.notFound.length > 5 &&
                                    ` +${result.notFound.length - 5} more`}
                            </p>
                        )}
                        {result.errors.length > 0 && (
                            <p className="text-red-500">
                                Errors: {result.errors.length}
                            </p>
                        )}
                        {result.deleted.length === 0 &&
                            result.notFound.length === 0 &&
                            result.errors.length === 0 && (
                                <p className="text-muted-foreground">
                                    Nothing deleted.
                                </p>
                            )}
                    </>
                )}
                {!confirm && !busy && result && !result.ok && (
                    <p className="text-red-500">{result.error}</p>
                )}
            </div>
        </section>
    );
};

// ═══════════════════════════════════════════════════════════════
//  3. Company Import Panel
// ═══════════════════════════════════════════════════════════════
const CompanyImportPanel = () => {
    const queryClient = useQueryClient();
    const [companies, setCompanies] = useState(
        "Accenture, Amazon, Google, Microsoft, Meta"
    );
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    const submit = async () => {
        const list = companies
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        if (!list.length || busy) return;
        setBusy(true);
        setResult(null);
        try {
            const { data } = await api.post(
                "/admin/leetcode/import-companies",
                { companies: list }
            );
            setResult({ ok: true, summary: data?.result?._summary });
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
        <section
            className="rounded-xl border bg-card p-3 sm:p-4 shadow-sm flex flex-col h-full"
            data-testid="admin-company-import"
        >
            <PanelHeader icon={Building2} title="Import Companies" />

            <textarea
                value={companies}
                onChange={(e) => setCompanies(e.target.value)}
                placeholder="Accenture, Amazon, Google…"
                className="w-full h-16 sm:h-10 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 mb-2 resize-none"
                disabled={busy}
                aria-label="Companies to import"
            />

            <button
                onClick={submit}
                disabled={busy || !companies.trim()}
                className="h-10 w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
                {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Building2 className="w-4 h-4" />
                )}
                <span>{busy ? "Importing…" : "Import Companies"}</span>
            </button>

            <div className="mt-2 text-xs min-h-[20px] break-words">
                {busy && (
                    <p className="text-muted-foreground">
                        ~5 sec per company…
                    </p>
                )}
                {result?.ok && result.summary && (
                    <p className="text-green-500">
                        {result.summary.totalCompanies} companies ·{" "}
                        {result.summary.totalProblemsUpdated} problems
                    </p>
                )}
                {result && !result.ok && (
                    <p className="text-red-500">{result.error}</p>
                )}
            </div>
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
        if (busy) return;
        if (!window.confirm("Copy all local JSON problems into MongoDB?"))
            return;
        setBusy(true);
        setMsg(null);
        try {
            const { data } = await api.post("/admin/leetcode/migrate-json");
            setMsg({
                ok: true,
                text: `Migrated ${data?.migrated ?? 0} problems.`,
            });
            queryClient.invalidateQueries({ queryKey: ["problems"] });
            queryClient.invalidateQueries({ queryKey: ["companies"] });
            queryClient.invalidateQueries({ queryKey: ["recommendations"] });
            onMigrated?.();
        } catch (e) {
            setMsg({ ok: false, text: errMsg(e) });
        } finally {
            setBusy(false);
        }
    };

    const handleFetchAll = async () => {
        if (busy) return;
        if (!window.confirm("Fetch ALL problems? 30-60 min.")) return;
        setBusy(true);
        setMsg(null);
        try {
            await api.post("/admin/leetcode/fetch-all", {});
            setMsg({ ok: true, text: "Background sync started." });
            queryClient.invalidateQueries({ queryKey: ["problems"] });
            queryClient.invalidateQueries({ queryKey: ["companies"] });
            queryClient.invalidateQueries({ queryKey: ["recommendations"] });
        } catch (e) {
            const is409 = e?.response?.status === 409;
            setMsg({
                ok: false,
                text: is409 ? "Already running." : errMsg(e),
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <section
            className="rounded-xl border bg-card p-3 sm:p-4 shadow-sm flex flex-col h-full"
            data-testid="admin-system-tools"
        >
            <PanelHeader icon={Database} title="Sync Tools" />

            <div className="flex flex-col gap-2">
                <button
                    onClick={handleMigrate}
                    disabled={busy}
                    className="h-10 w-full inline-flex items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
                >
                    <Database className="w-4 h-4 shrink-0" />
                    <span className="truncate">Seed JSON → DB</span>
                </button>
                <button
                    onClick={handleFetchAll}
                    disabled={busy}
                    className="h-10 w-full inline-flex items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
                >
                    <RefreshCw
                        className={`w-4 h-4 shrink-0 ${
                            busy ? "animate-spin" : ""
                        }`}
                    />
                    <span className="truncate">Fetch All</span>
                </button>
            </div>

            <div className="mt-2 text-xs min-h-[20px] break-words">
                {msg && (
                    <p className={msg.ok ? "text-green-500" : "text-red-500"}>
                        {msg.text}
                    </p>
                )}
            </div>
        </section>
    );
};

// ═══════════════════════════════════════════════════════════════
//  5. User Role Action
// ═══════════════════════════════════════════════════════════════
const UserRoleAction = ({ user, onAction, isSelf }) => {
    const [busy, setBusy] = useState(false);

    const toggleRole = async () => {
        if (busy) return;
        if (!user.email) {
            alert("Cannot promote phone-only user (no email on file).");
            return;
        }
        if (isSelf) {
            alert("You cannot change your own role. Ask another admin.");
            return;
        }
        const newRole = user.role === "ADMIN" ? "USER" : "ADMIN";
        if (!window.confirm(`Change ${user.email} to ${newRole}?`)) return;

        setBusy(true);
        try {
            await api.post("/auth/admin/promote", {
                email: user.email,
                role: newRole,
            });
            onAction?.();
        } catch (e) {
            alert(errMsg(e));
        } finally {
            setBusy(false);
        }
    };

    if (!user.email)
        return (
            <span
                className="text-xs text-muted-foreground"
                title="Phone-only user — cannot promote"
            >
                —
            </span>
        );

    if (isSelf)
        return (
            <span
                className="text-[10px] sm:text-xs text-muted-foreground italic"
                title="You cannot change your own role"
            >
                (you)
            </span>
        );

    return (
        <button
            onClick={toggleRole}
            disabled={busy}
            className={`text-[10px] sm:text-xs px-2 py-1 rounded border transition-colors whitespace-nowrap ${
                user.role === "ADMIN"
                    ? "border-red-500/50 text-red-500 hover:bg-red-500/10"
                    : "border-primary/50 text-primary hover:bg-primary/10"
            } disabled:opacity-50`}
        >
            {busy ? "..." : user.role === "ADMIN" ? "Remove Admin" : "Make Admin"}
        </button>
    );
};

// ═══════════════════════════════════════════════════════════════
//  Main Admin Page
// ═══════════════════════════════════════════════════════════════
export default function AdminPage() {
    const { user } = useAuth();

    // Auth-first guards — run before any query
    if (user === null) {
        return (
            <div className="p-6 sm:p-10 text-muted-foreground text-sm text-center">
                Checking your permissions…
            </div>
        );
    }
    if (user === false) {
        return <Navigate to="/login" state={{ from: "/admin" }} replace />;
    }
    const isAdmin = user.is_admin || user.isAdmin || user.role === "ADMIN";
    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    return <AdminContent currentUser={user} />;
}

// ═══════════════════════════════════════════════════════════════
//  Admin content — rendered only when we know the user is admin
// ═══════════════════════════════════════════════════════════════
function AdminContent({ currentUser }) {
    const queryClient = useQueryClient();

    const { data: d, isLoading, isError, error: queryError, refetch } = useQuery({
        queryKey: ["admin-overview"],
        queryFn: async () => (await api.get("/admin/overview")).data,
        staleTime: 2 * 60 * 1000,
        refetchOnWindowFocus: true,
        placeholderData: (prev) => prev,
    });

    const loadOverview = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    };

    const error = queryError ? errMsg(queryError) : null;

    if (error || isError) {
        return (
            <div className="p-6 sm:p-10 text-center">
                <AlertCircle className="w-8 h-8 text-hard mx-auto mb-3" />
                <p className="text-red-500 text-sm mb-4">
                    {error || "Could not load admin data."}
                </p>
                <button
                    onClick={() => refetch()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (isLoading && !d) {
        return (
            <div className="p-6 sm:p-10 text-muted-foreground text-sm text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                Loading admin overview…
            </div>
        );
    }

    if (!d) {
        return (
            <div className="p-6 sm:p-10 text-muted-foreground text-sm text-center">
                No data available.
            </div>
        );
    }

    // Normalize possibly-null arrays
    const users = Array.isArray(d.users) ? d.users : [];
    const notifications = Array.isArray(d.notifications) ? d.notifications : [];
    const events = Array.isArray(d.events) ? d.events : [];

    return (
        <main
            className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-6 sm:py-8 md:py-10 space-y-5 sm:space-y-6"
            data-testid="admin-page"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Shield className="w-6 h-6 text-primary" />
                        Admin Control Center
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        Manage problems, sync data, and control user
                        permissions.
                    </p>
                </div>
                <button
                    onClick={loadOverview}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border hover:bg-accent transition-colors"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                </button>
            </div>

            {/* Action Panels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <AddProblemsPanel onAdded={loadOverview} />
                <DeleteProblemsPanel onDeleted={loadOverview} />
                <CompanyImportPanel />
                <SystemToolsPanel onMigrated={loadOverview} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                <Stat
                    icon={Users}
                    label="Total users"
                    value={d.totalUsers}
                    id="users"
                />
                <Stat
                    icon={Activity}
                    label="Active (7 days)"
                    value={d.activeUsers7d}
                    id="active"
                />
                <Stat
                    icon={LogIn}
                    label="Logins (24h)"
                    value={d.logins24h}
                    id="logins"
                />
                <Stat
                    icon={Eye}
                    label="Page views (24h)"
                    value={d.pageViews24h}
                    id="views"
                />
                <Stat
                    icon={Send}
                    label="Submissions (24h)"
                    value={d.submissions24h}
                    id="subs"
                />
            </div>

            {/* Users Table */}
            <div className="rounded-xl border bg-card overflow-x-auto">
                <table
                    className="w-full text-sm min-w-[700px]"
                    data-testid="admin-users-table"
                >
                    <thead className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground border-b bg-secondary/30">
                    <tr>
                        {[
                            "User",
                            "Contact",
                            "Role / Action",
                            "Logins",
                            "Last active",
                            "Solved",
                            "Subs",
                            "Last IP",
                        ].map((h) => (
                            <th
                                key={h}
                                className="text-left font-semibold px-3 sm:px-4 py-2.5 sm:py-3 whitespace-nowrap"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody className="divide-y">
                    {users.map((u) => {
                        const isSelf = u.user_id === currentUser.user_id;
                        return (
                            <tr
                                key={u.user_id}
                                className="hover:bg-accent/40"
                            >
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                                    <div className="font-medium text-xs sm:text-sm">
                                        {u.name || "—"}
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[260px]">
                                        {u.user_id}
                                    </div>
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs">
                                    <div className="truncate max-w-[200px] sm:max-w-[260px]">
                                        {u.email || "—"}
                                    </div>
                                    <div className="text-muted-foreground">
                                        {u.phone || ""}
                                    </div>
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                            <span
                                                className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                    u.role === "ADMIN" || u.isAdmin
                                                        ? "bg-primary/20 text-primary"
                                                        : "bg-secondary text-muted-foreground"
                                                }`}
                                            >
                                                {u.role ||
                                                    (u.isAdmin
                                                        ? "ADMIN"
                                                        : "USER")}
                                            </span>
                                        <UserRoleAction
                                            user={u}
                                            onAction={loadOverview}
                                            isSelf={isSelf}
                                        />
                                    </div>
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                                    {u.login_count || 0}
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                                    {u.last_active_at
                                        ? timeAgo(u.last_active_at)
                                        : "—"}
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                                    {u.solved ?? 0}
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3">
                                    {u.submissions ?? 0}
                                </td>
                                <td className="px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-xs text-muted-foreground">
                                    {u.last_ip || "—"}
                                </td>
                            </tr>
                        );
                    })}
                    {users.length === 0 && (
                        <tr>
                            <td
                                colSpan={8}
                                className="px-4 py-6 text-center text-xs text-muted-foreground"
                            >
                                No users yet.
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* Notifications + Events */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="rounded-xl border bg-card p-3 sm:p-4">
                    <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 sm:mb-3">
                        Welcome messages
                    </p>
                    <div className="divide-y text-[11px] sm:text-xs">
                        {notifications.map((n, i) => (
                            <div
                                key={i}
                                className="py-2 flex justify-between gap-2 sm:gap-3"
                            >
                                <span className="truncate min-w-0">
                                    <span className="font-semibold">
                                        {n.kind}
                                    </span>{" "}
                                    · {n.channel} →{" "}
                                    <span className="truncate">{n.to}</span>
                                </span>
                                <span
                                    className={`shrink-0 text-right ${
                                        n.status === "sent"
                                            ? "text-green-500"
                                            : "text-red-500"
                                    }`}
                                >
                                    {n.status} · {timeAgo(n.created_at)}
                                </span>
                            </div>
                        ))}
                        {notifications.length === 0 && (
                            <p className="text-muted-foreground py-2">
                                None yet.
                            </p>
                        )}
                    </div>
                </div>
                <div className="rounded-xl border bg-card p-3 sm:p-4">
                    <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 sm:mb-3">
                        Recent events
                    </p>
                    <div className="divide-y text-[11px] sm:text-xs max-h-80 sm:max-h-96 overflow-auto">
                        {events.map((e, i) => (
                            <div
                                key={i}
                                className="py-2 flex justify-between gap-2 sm:gap-3"
                            >
                                <span className="truncate min-w-0">
                                    <span className="font-semibold">
                                        {e.type}
                                    </span>{" "}
                                    <span className="text-muted-foreground">
                                        {e.path || ""}
                                    </span>
                                </span>
                                <span className="text-muted-foreground whitespace-nowrap shrink-0">
                                    {timeAgo(e.created_at)}
                                </span>
                            </div>
                        ))}
                        {events.length === 0 && (
                            <p className="text-muted-foreground py-2">
                                None yet.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}