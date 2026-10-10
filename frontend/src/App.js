import "@/App.css";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
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
import { initAnalytics, track } from "@/lib/analytics";

function PageTracker() {
  const { pathname } = useLocation();
  useEffect(() => { initAnalytics(); }, []);
  useEffect(() => { track("page_view", { page_path: pathname }); }, [pathname]);
  return null;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
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

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </ThemeProvider>
  );
}
