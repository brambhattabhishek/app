import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// ═══════════════════════════════════════════════════════════════
//  Auth-state helpers
//
//  user === null  → auth check still running (DO NOT fire)
//  user === false → guest (fire, backend allows)
//  user === {...} → logged in (fire)
// ═══════════════════════════════════════════════════════════════

/** Auth check finished — safe to fire guest + logged-in queries. */
const ready = (user) => user !== null;

/** Logged-in user object (never fires for guest). */
const loggedIn = (user) => !!user && user !== false;

/** Stable query-key suffix: "guest" for guests, user_id otherwise. */
const who = (user) => (user && user !== false ? user.user_id : "guest");

// ═══════════════════════════════════════════════════════════════
//  PROBLEMS LIST — guests + logged-in
// ═══════════════════════════════════════════════════════════════
export function useProblemsQuery() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["problems", who(user)],
        queryFn: async () => {
            const { data } = await api.get("/problems");
            return Array.isArray(data) ? data : [];
        },
        enabled: ready(user),
        placeholderData: (prev) => prev,
        staleTime: 2 * 60 * 1000,      // 2 min — problem list changes rarely
    });
}

// ═══════════════════════════════════════════════════════════════
//  COMPANIES — guests + logged-in
// ═══════════════════════════════════════════════════════════════
export function useCompaniesQuery() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["companies", who(user)],
        queryFn: async () => {
            const { data } = await api.get("/companies");
            return Array.isArray(data) ? data : [];
        },
        enabled: ready(user),
        placeholderData: (prev) => prev,
        staleTime: 5 * 60 * 1000,
    });
}

// ═══════════════════════════════════════════════════════════════
//  COMPANY DETAIL — guests + logged-in
// ═══════════════════════════════════════════════════════════════
export function useCompanyQuery(name) {
    const { user } = useAuth();
    const slug = name ? String(name).trim() : "";

    return useQuery({
        queryKey: ["company", slug, who(user)],
        queryFn: async () => {
            const { data } = await api.get(`/companies/${encodeURIComponent(slug)}`);
            return data;
        },
        enabled: !!slug && ready(user),
        placeholderData: (prev) => prev,
        staleTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
            // Don't retry 404s — company truly doesn't exist
            if (error?.response?.status === 404) return false;
            return failureCount < 1;
        },
    });
}

// ═══════════════════════════════════════════════════════════════
//  PROFILE — login-only
// ═══════════════════════════════════════════════════════════════
export function useProfileQuery() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["profile", user?.user_id],
        queryFn: async () => {
            const { data } = await api.get("/profile");
            return data;
        },
        enabled: loggedIn(user),
        placeholderData: (prev) => prev,
        staleTime: 30 * 1000,           // 30s — analytics updates after submit
    });
}

// ═══════════════════════════════════════════════════════════════
//  DAILY CHALLENGE — guests get global pick, users get personalised
// ═══════════════════════════════════════════════════════════════
export function useDailyChallengeQuery() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["daily", who(user)],
        queryFn: async () => {
            const { data } = await api.get("/daily");
            return data;
        },
        enabled: ready(user),
        placeholderData: (prev) => prev,
        staleTime: 10 * 60 * 1000,      // 10 min — daily same rehta hai
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });
}

// ═══════════════════════════════════════════════════════════════
//  RECOMMENDATIONS — login-only
// ═══════════════════════════════════════════════════════════════
export function useRecommendationsQuery() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["recommendations", user?.user_id],
        queryFn: async () => {
            const { data } = await api.get("/recommendations");
            return data;
        },
        enabled: loggedIn(user),
        placeholderData: (prev) => prev,
        staleTime: 5 * 60 * 1000,
    });
}

// ═══════════════════════════════════════════════════════════════
//  SUBMISSIONS for a problem — login-only (used by LeftPanel)
// ═══════════════════════════════════════════════════════════════
export function useSubmissionsQuery(slug) {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["submissions", slug, user?.user_id],
        queryFn: async () => {
            const { data } = await api.get("/submissions", { params: { slug } });
            return Array.isArray(data) ? data : [];
        },
        enabled: !!slug && loggedIn(user),
        placeholderData: (prev) => prev,
        staleTime: 30 * 1000,
    });
}

// ═══════════════════════════════════════════════════════════════
//  PROBLEM DETAIL — read-only, guests allowed
//  (Optional helper — Workspace already uses inline useQuery, but
//   this centralises the caching strategy if you want to adopt it.)
// ═══════════════════════════════════════════════════════════════
export function useProblemQuery(slug) {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["problem", slug, who(user)],
        queryFn: async () => {
            const { data } = await api.get(`/problems/${encodeURIComponent(slug)}`);
            return data;
        },
        enabled: !!slug && ready(user),
        placeholderData: (prev) => prev,
        staleTime: 5 * 60 * 1000,
        retry: (failureCount, error) => {
            if (error?.response?.status === 404) return false;
            return failureCount < 1;
        },
    });
}