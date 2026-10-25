import "@/App.css";
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import ProblemsPage from "@/pages/ProblemsPage";
import Workspace from "@/pages/Workspace";
import AuthPage from "@/pages/AuthPage";
import ProfilePage from "@/pages/ProfilePage";
import AuthCallback from "@/pages/AuthCallback";
import OAuthCallback from "@/pages/OAuthCallback";
import AdminPage from "@/pages/AdminPage";
import CompaniesPage from "@/pages/CompaniesPage";
import CompanyPage from "@/pages/CompanyPage";
import LoadingScreen from "@/components/LoadingScreen";
import {
  getActiveApiRequests,
  subscribeToApiLoading,
} from "@/lib/api";
import { initAnalytics, track } from "@/lib/analytics";

// ═══════════════════════════════════════════════════════════════
//  TanStack Query client
// ═══════════════════════════════════════════════════════════════
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

// ═══════════════════════════════════════════════════════════════
//  Page tracker — page view events
// ═══════════════════════════════════════════════════════════════
function PageTracker() {
  const { pathname } = useLocation();

  // ★ Init analytics ONCE
  useEffect(() => {
    initAnalytics();
  }, []);

  // ★ Track page view on route change
  useEffect(() => {
    track("page_view", { page_path: pathname });
  }, [pathname]);

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  Global loading overlay — hides when API is idle
// ═══════════════════════════════════════════════════════════════
function GlobalLoadingOverlay() {
  // ★ Start hidden by default — only show if there's an active request
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check current state — if requests already in flight, show immediately
    if (getActiveApiRequests() > 0) {
      setVisible(true);
    }

    let finished = false;
    let idleTimer;
    let maxTimer;

    const hideWhenIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!finished && getActiveApiRequests() === 0) {
          finished = true;
          setVisible(false);
          clearTimeout(maxTimer);
        }
      }, 700);
    };

    const unsubscribe = subscribeToApiLoading((count) => {
      if (finished) return;

      if (count > 0) {
        // ★ Show overlay when requests start
        setVisible(true);
        clearTimeout(idleTimer);
      } else {
        hideWhenIdle();
      }
    });

    // If no requests on mount, don't show
    if (getActiveApiRequests() === 0) {
      finished = true;
      setVisible(false);
    }

    // ★ Safety: force-hide after 15s
    maxTimer = setTimeout(() => {
      if (!finished) {
        finished = true;
        setVisible(false);
      }
    }, 15000);

    return () => {
      clearTimeout(idleTimer);
      clearTimeout(maxTimer);
      unsubscribe();
    };
  }, []);

  return visible ? <LoadingScreen /> : null;
}

// ═══════════════════════════════════════════════════════════════
//  App Router
// ═══════════════════════════════════════════════════════════════
function AppRouter() {
  const location = useLocation();

  // ★ Google OAuth callback — dedicated page
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
      <div className="min-h-screen grain">
        <PageTracker />
        <Navbar />

        <Routes>
          <Route path="/" element={<ProblemsPage />} />
          <Route path="/problems" element={<Navigate to="/" replace />} />
          <Route path="/problems/:slug" element={<Workspace />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/auth/oauth/:provider" element={<OAuthCallback />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/companies/:name" element={<CompanyPage />} />
        </Routes>
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Root App
// ═══════════════════════════════════════════════════════════════
export default function App() {
  return (
      <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
      >
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <AppRouter />
              <GlobalLoadingOverlay />
              <Toaster position="top-center" richColors />
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
  );
}