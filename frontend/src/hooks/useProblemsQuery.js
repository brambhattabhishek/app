import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export function useProblemsQuery() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["problems", user?.user_id],
        queryFn: async () => {
            const { data } = await api.get("/problems");
            return data;
        },
        enabled: user !== null && user !== false,
        placeholderData: (prev) => prev,   // ★ Purana data dikhao jab tak naya aaye
    });
}

export function useCompaniesQuery() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["companies", user?.user_id],
        queryFn: async () => {
            const { data } = await api.get("/companies");
            return data;
        },
        enabled: user !== null && user !== false,
        placeholderData: (prev) => prev,
    });
}

export function useProfileQuery() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["profile", user?.user_id],
        queryFn: async () => {
            const { data } = await api.get("/profile");
            return data;
        },
        enabled: !!user && user !== false,
        placeholderData: (prev) => prev,
    });
}

export function useCompanyQuery(name) {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["company", name, user?.user_id],
        queryFn: async () => {
            const { data } = await api.get(`/companies/${encodeURIComponent(name)}`);
            return data;
        },
        enabled: !!name && user !== null && user !== false,
        placeholderData: (prev) => prev,
    });
}

export function useDailyChallengeQuery() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["daily", user?.user_id || "guest"],
        queryFn: async () => {
            const { data } = await api.get("/daily");
            return data;
        },
        enabled: user !== null && user !== false,
        placeholderData: (prev) => prev,
        staleTime: 10 * 60 * 1000,        // 10 min — daily same rehta hai
        refetchOnMount: false,
    });
}

export function useRecommendationsQuery() {
    const { user } = useAuth();

    return useQuery({
        queryKey: ["recommendations", user?.user_id || "guest"],
        queryFn: async () => {
            const { data } = await api.get("/recommendations");
            return data;
        },
        enabled: !!user && user !== false,      // only logged-in
        placeholderData: (prev) => prev,
        staleTime: 5 * 60 * 1000,               // 5 min
    });
}