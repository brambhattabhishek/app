import { Link } from "react-router-dom";
import {
  CalendarCheck2,
  Flame,
  Coins,
  CheckCircle2,
  ArrowRight,
  Award,
  LogIn,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { diffCls } from "@/pages/ProblemsPage";
import { useDailyChallengeQuery } from "@/hooks/useProblemsQuery";

export default function DailyChallenge() {
  const { user } = useAuth();
  const { data: d, isLoading, isError, error } = useDailyChallengeQuery();

  const authLoading = user === null;
  const isGuest = user === false;

  // ═══════════════════════════════════════════════════════
  // Loading skeleton — only first time (no cache)
  // ═══════════════════════════════════════════════════════
  if ((isLoading && !d) || authLoading) {
    return (
        <section
            className="rise relative overflow-hidden rounded-2xl border border-primary/40 bg-card p-6 mb-8 animate-pulse"
            data-testid="daily-loading"
        >
          <div className="h-4 w-40 bg-secondary rounded mb-3" />
          <div className="h-6 w-72 max-w-full bg-secondary rounded mb-2" />
          <div className="h-3 w-48 bg-secondary rounded" />
        </section>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Error state — quiet fallback (do not break layout)
  // ═══════════════════════════════════════════════════════
  if (isError || !d || !d.problem) {
    if (isError) {
      console.warn("[DailyChallenge] failed to load:", error?.message);
    }
    return null;
  }

  const p = d.problem;
  const difficulty = p.difficulty || "Medium";

  return (
      <section
          className="rise relative overflow-hidden rounded-2xl border border-primary/40 bg-card p-4 sm:p-6 mb-6 sm:mb-8"
          data-testid="daily-challenge"
      >
        {/* Glow blob */}
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-4 sm:gap-6 sm:justify-between">
          {/* Left: title + reason */}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">
              <CalendarCheck2 className="w-4 h-4 shrink-0" />
              <span className="truncate">
                            Daily challenge{d.date ? ` · ${d.date}` : ""}
                        </span>
            </p>

            <Link
                to={`/problems/${p.slug}`}
                className="font-heading text-xl sm:text-2xl font-bold tracking-tight hover:text-primary transition-colors block truncate"
                data-testid="daily-problem-link"
            >
              {p.id}. {p.title}
            </Link>

            <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">
                        <span className={`font-semibold ${diffCls[difficulty] || ""}`}>
                            {difficulty}
                        </span>
              {d.reason && (
                  <>
                    <span className="mx-1.5">·</span>
                    <span>{d.reason}</span>
                  </>
              )}
            </p>
          </div>

          {/* Right: stats + CTA */}
          <div className="flex items-center gap-4 sm:gap-5 flex-wrap">
            {/* Streak / coins — only for logged-in users */}
            {user && (
                <>
                  <div className="text-center" data-testid="daily-streak">
                    <Flame
                        className={`w-5 h-5 mx-auto ${
                            d.streak ? "text-primary" : "text-muted-foreground"
                        }`}
                    />
                    <div className="font-heading text-lg sm:text-xl font-bold">
                      {d.streak ?? 0}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-muted-foreground">
                      day streak
                    </div>
                  </div>
                  <div className="text-center" data-testid="daily-coins">
                    <Coins className="w-5 h-5 mx-auto text-medium" />
                    <div className="font-heading text-lg sm:text-xl font-bold">
                      {d.coins ?? 0}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-muted-foreground">
                      coins
                    </div>
                  </div>
                </>
            )}

            {/* CTA — done state or Solve now */}
            {user && d.completed ? (
                <span
                    className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-easy px-3 sm:px-4 py-2 rounded-full bg-easy/10 whitespace-nowrap"
                    data-testid="daily-completed"
                >
                            <CheckCircle2 className="w-4 h-4" />
                            Done for today
                        </span>
            ) : (
                <Link
                    to={`/problems/${p.slug}`}
                    className="flex items-center gap-2 text-xs sm:text-sm font-semibold px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity whitespace-nowrap"
                    data-testid="daily-solve-button"
                >
                  {isGuest ? "Try it" : "Solve now"}
                  <ArrowRight className="w-4 h-4" />
                </Link>
            )}
          </div>
        </div>

        {/* Badges — logged in only */}
        {user && !!d.badges?.length && (
            <div
                className="relative flex flex-wrap gap-2 mt-3 sm:mt-4"
                data-testid="daily-badges"
            >
              {d.badges.map((b) => (
                  <span
                      key={b}
                      className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-1 rounded-full bg-primary/15 text-primary"
                  >
                            <Award className="w-3 h-3" />
                    {b}
                        </span>
              ))}
            </div>
        )}

        {/* Guest hint — sign in to build streak */}
        {isGuest && (
            <p className="relative flex items-start gap-1.5 text-[11px] sm:text-xs text-muted-foreground mt-3 sm:mt-4">
              <LogIn className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span>
                        <Link to="/login" className="text-primary font-semibold hover:underline">
                            Sign in
                        </Link>{" "}
                to get a daily problem picked from your favourite categories and build a streak.
                    </span>
            </p>
        )}
      </section>
  );
}