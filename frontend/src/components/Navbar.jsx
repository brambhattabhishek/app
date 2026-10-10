import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Moon, Sun, Code2, LogOut, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Avatar({ user, size = 32 }) {
  if (user?.picture) return <img src={user.picture} alt={user.name} style={{ width: size, height: size }} className="rounded-full object-cover" />;
  return (
    <div style={{ width: size, height: size }} className="rounded-full bg-primary text-primary-foreground grid place-items-center font-heading font-bold" >
      {(user?.name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

const linkCls = ({ isActive }) =>
  `text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${isActive ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground"}`;

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 h-12 border-b bg-background/80 backdrop-blur-xl">
      <div className="h-full px-4 flex items-center gap-4">
        <Link to="/" className="flex items-center gap-2 mr-2" data-testid="nav-logo">
          <span className="w-7 h-7 rounded-md bg-primary grid place-items-center"><Code2 className="w-4 h-4 text-primary-foreground" /></span>
          <span className="font-heading font-bold tracking-tight text-lg">algo<span className="text-primary">forge</span></span>
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkCls} data-testid="nav-problems-link">Problems</NavLink>
          {user && <NavLink to="/profile" className={linkCls} data-testid="nav-profile-link">Profile</NavLink>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-8 h-8 grid place-items-center rounded-md hover:bg-secondary transition-colors"
            data-testid="theme-toggle-button" aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {user === false && (
            <button onClick={() => navigate("/login")} data-testid="nav-login-button"
              className="text-sm font-semibold px-4 py-1.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
              Sign in
            </button>
          )}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger data-testid="user-avatar-dropdown" className="rounded-full ring-offset-2 ring-offset-background focus:ring-2 ring-primary outline-none">
                <Avatar user={user} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-xs text-muted-foreground font-normal truncate">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")} data-testid="menu-profile"><User className="w-4 h-4 mr-2" />Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { logout(); navigate("/"); }} data-testid="menu-logout"><LogOut className="w-4 h-4 mr-2" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
