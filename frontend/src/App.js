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
import { getActiveApiRequests, subscribeToApiLoading } from "@/lib/api";
import { initAnalytics, track } from "@/lib/analytics";

// ═══════════════════════════════════════════════════════════════
//  QueryClient — module-level so re-renders don't recreate
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
//  PageTracker — GA init + page_view tracking
// ═══════════════════════════════════════════════════════════════
function PageTracker() {
  const { pathname } = useLocation();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    try {
      initAnalytics();
    } catch (e) {
      console.warn("[analytics] init failed:", e?.message);
    }
    setInitialized(true);
  }, [initialized]);

  useEffect(() => {
    try {
      track("page_view", { page_path: pathname });
    } catch {
      /* never break the app for analytics */
    }
  }, [pathname]);

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  GlobalLoadingOverlay — shows only on cold start with active reqs
// ═══════════════════════════════════════════════════════════════
function GlobalLoadingOverlay() {
  const [visible, setVisible] = useState(() => getActiveApiRequests() > 0);

  useEffect(() => {
    let finished = false;
    let idleTimer;
    let maxTimer;

    const hide = () => {
      if (finished) return;
      finished = true;
      setVisible(false);
      clearTimeout(idleTimer);
      clearTimeout(maxTimer);
    };

    const hideWhenIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (getActiveApiRequests() === 0) hide();
      }, 700);
    };

    const unsubscribe = subscribeToApiLoading((count) => {
      if (finished) return;
      if (count > 0) {
        clearTimeout(idleTimer);
        setVisible(true);
      } else {
        hideWhenIdle();
      }
    });

    if (getActiveApiRequests() === 0) hideWhenIdle();

    maxTimer = setTimeout(hide, 15000);

    return () => {
      clearTimeout(idleTimer);
      clearTimeout(maxTimer);
      unsubscribe();
    };
  }, []);

  return visible ? <LoadingScreen /> : null;
}

// ═══════════════════════════════════════════════════════════════
//  AppRouter — routes + hash-based OAuth interception
// ═══════════════════════════════════════════════════════════════
function AppRouter() {
  const location = useLocation();

  // Google OAuth return — session_id comes in hash
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

          {/* Fallback — unknown route → home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  App
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
            </BrowserRouter>
            <Toaster position="top-center" richColors />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
  );
}