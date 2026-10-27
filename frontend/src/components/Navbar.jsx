import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Moon, Sun, Code2, LogOut, User, Menu, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { BACKEND_URL } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ═══════════════════════════════════════════════════════════════
//  picUrl — resolve server-relative picture paths to absolute URLs
//
//  Uses the single source of truth (BACKEND_URL) exported from
//  lib/api.js — do NOT re-resolve env vars here, that led to two
//  places going out of sync when REACT_APP_BACKEND_URL was fixed.
//
//   • "/api/avatars/xyz"  → `${BACKEND_URL}/api/avatars/xyz`
//   • "https://..."        → unchanged
//   • null / undefined     → unchanged (Avatar falls back to initials)
// ═══════════════════════════════════════════════════════════════
export const picUrl = (pic) => {
  if (typeof pic !== "string" || !pic) return pic;
  if (pic.startsWith("/api/")) {
    // BACKEND_URL is already cleaned (no trailing slash)
    return `${BACKEND_URL || ""}${pic}`;
  }
  return pic;
};

// ═══════════════════════════════════════════════════════════════
//  Avatar — image or initials fallback
// ═══════════════════════════════════════════════════════════════
export function Avatar({ user, size = 32 }) {
  const [imgError, setImgError] = useState(false);

  // Reset error when the picture changes (e.g., user uploads a new avatar)
  // (React 18 patterns — use the picture value as a key trigger)
  const pic = user?.picture;
  const src = !imgError && pic ? picUrl(pic) : null;

  if (src) {
    return (
        <img
            src={src}
            alt={user?.name || "User"}
            style={{ width: size, height: size }}
            className="rounded-full object-cover"
            onError={() => setImgError(true)}
            draggable={false}
        />
    );
  }

  const initial = (user?.name || user?.email || "?")
      .slice(0, 1)
      .toUpperCase();

  return (
      <div
          style={{ width: size, height: size }}
          className="rounded-full bg-primary text-primary-foreground grid place-items-center font-heading font-bold select-none"
          aria-label={user?.name || "User"}
      >
        {initial}
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  NavLink class helper
// ═══════════════════════════════════════════════════════════════
const linkCls = ({ isActive }) =>
    `text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
        isActive
            ? "text-foreground bg-secondary"
            : "text-muted-foreground hover:text-foreground"
    }`;

// ═══════════════════════════════════════════════════════════════
//  Main Navbar
// ═══════════════════════════════════════════════════════════════
export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAuthed = !!user && user !== false;
  const isGuest = user === false; // ← NOT `user === null` (that's "checking")
  const isAdmin =
      isAuthed &&
      (user.is_admin || user.isAdmin || user.role === "ADMIN");

  const handleLogout = () => {
    logout();
    setMobileOpen(false);
    navigate("/");
  };

  const closeMobile = () => setMobileOpen(false);

  return (
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="h-12 px-4 flex items-center gap-4">
          {/* ═══ Logo ═══ */}
          <Link
              to="/"
              className="flex items-center gap-2 mr-2 shrink-0"
              data-testid="nav-logo"
              onClick={closeMobile}
          >
                    <span className="w-7 h-7 rounded-md bg-primary grid place-items-center">
                        <Code2 className="w-4 h-4 text-primary-foreground" />
                    </span>
            <span className="font-heading font-bold tracking-tight text-lg">
                        Cod<span className="text-primary">WP</span>
                    </span>
          </Link>

          {/* ═══ Desktop nav ═══ */}
          <nav className="hidden sm:flex items-center gap-1">
            <NavLink
                to="/"
                end
                className={linkCls}
                data-testid="nav-problems-link"
            >
              Problems
            </NavLink>
            <NavLink
                to="/companies"
                className={linkCls}
                data-testid="nav-companies-link"
            >
              Companies
            </NavLink>
            {isAuthed && (
                <NavLink
                    to="/profile"
                    className={linkCls}
                    data-testid="nav-profile-link"
                >
                  Profile
                </NavLink>
            )}
            {isAdmin && (
                <NavLink
                    to="/admin"
                    className={linkCls}
                    data-testid="nav-admin-link"
                >
                  Admin
                </NavLink>
            )}
          </nav>

          {/* ═══ Right actions ═══ */}
          <div className="ml-auto flex items-center gap-2">
            {/* Theme toggle */}
            <button
                onClick={() =>
                    setTheme(theme === "dark" ? "light" : "dark")
                }
                className="w-8 h-8 grid place-items-center rounded-md hover:bg-secondary transition-colors"
                data-testid="theme-toggle-button"
                aria-label="Toggle theme"
                type="button"
            >
              {theme === "dark" ? (
                  <Sun className="w-4 h-4" />
              ) : (
                  <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Guest → Sign in */}
            {isGuest && (
                <button
                    onClick={() => navigate("/login")}
                    data-testid="nav-login-button"
                    type="button"
                    className="text-sm font-semibold px-4 py-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Sign in
                </button>
            )}

            {/* Logged-in → avatar menu */}
            {isAuthed && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                      data-testid="user-avatar-dropdown"
                      className="rounded-full ring-offset-2 ring-offset-background focus:ring-2 ring-primary outline-none"
                      aria-label="Open user menu"
                  >
                    <Avatar user={user} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>
                      <div className="font-semibold truncate">
                        {user.name || "User"}
                      </div>
                      {user.email && (
                          <div className="text-xs text-muted-foreground font-normal truncate">
                            {user.email}
                          </div>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => navigate("/profile")}
                        data-testid="menu-profile"
                    >
                      <User className="w-4 h-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                    {isAdmin && (
                        <DropdownMenuItem
                            onClick={() => navigate("/admin")}
                            data-testid="menu-admin"
                        >
                          <Code2 className="w-4 h-4 mr-2" />
                          Admin
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={handleLogout}
                        data-testid="menu-logout"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            )}

            {/* Mobile menu toggle */}
            <button
                onClick={() => setMobileOpen((v) => !v)}
                className="sm:hidden w-8 h-8 grid place-items-center rounded-md hover:bg-secondary transition-colors"
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
                data-testid="nav-mobile-toggle"
                type="button"
            >
              {mobileOpen ? (
                  <X className="w-4 h-4" />
              ) : (
                  <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* ═══ Mobile nav drawer ═══ */}
        {mobileOpen && (
            <nav className="sm:hidden border-t bg-background px-4 py-2 flex flex-col gap-1">
              <NavLink
                  to="/"
                  end
                  className={linkCls}
                  onClick={closeMobile}
                  data-testid="nav-mobile-problems-link"
              >
                Problems
              </NavLink>
              <NavLink
                  to="/companies"
                  className={linkCls}
                  onClick={closeMobile}
                  data-testid="nav-mobile-companies-link"
              >
                Companies
              </NavLink>
              {isAuthed && (
                  <NavLink
                      to="/profile"
                      className={linkCls}
                      onClick={closeMobile}
                      data-testid="nav-mobile-profile-link"
                  >
                    Profile
                  </NavLink>
              )}
              {isAdmin && (
                  <NavLink
                      to="/admin"
                      className={linkCls}
                      onClick={closeMobile}
                      data-testid="nav-mobile-admin-link"
                  >
                    Admin
                  </NavLink>
              )}
            </nav>
        )}
      </header>
  );
}