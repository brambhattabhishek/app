import "@/App.css";
import { useEffect, useRef, useState } from "react";
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
//  Query client — module scope so HMR / re-mounts don't reset it
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
//  PageTracker — GA init + page_view per route
// ═══════════════════════════════════════════════════════════════
function PageTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (/^\/(auth\/|login)/.test(pathname)) return;
    track("page_view", { page_path: pathname });
  }, [pathname]);

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  GlobalLoadingOverlay — controlled by API request count
//
//  Rules:
//   • Show whenever ANY API request is in flight
//   • Stay visible until requests drop to 0 AND ~600ms idle
//   • Hard timeout of 25 seconds (never blocks forever)
//   • Doesn't re-show during route changes (SPA navigations are fast)
// ═══════════════════════════════════════════════════════════════
function GlobalLoadingOverlay() {
  const [visible, setVisible] = useState(true);
  const finishedRef = useRef(false);
  const idleTimerRef = useRef(null);
  const maxTimerRef = useRef(null);

  useEffect(() => {
    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setVisible(false);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };

    const hideWhenIdle = (delay = 600) => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (getActiveApiRequests() === 0) finish();
      }, delay);
    };

    const unsubscribe = subscribeToApiLoading((count) => {
      if (finishedRef.current) return;
      if (count > 0) {
        // New request came in — cancel hide
        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current);
          idleTimerRef.current = null;
        }
      } else {
        hideWhenIdle();
      }
    });

    // If already idle at mount, hide after short delay
    if (getActiveApiRequests() === 0) {
      hideWhenIdle(400);
    }

    // Hard cap — never block the user for more than 25s
    maxTimerRef.current = setTimeout(finish, 25_000);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      unsubscribe();
    };
  }, []);

  // Once `visible` flips false, LoadingScreen fades out and unmounts on next render
  return <LoadingScreen visible={visible} />;
}

// ═══════════════════════════════════════════════════════════════
//  Router
// ═══════════════════════════════════════════════════════════════
function AppRouter() {
  const location = useLocation();

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
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
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