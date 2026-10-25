import { Link } from "react-router-dom";
import { CalendarCheck2, Flame, Coins, CheckCircle2, ArrowRight, Award } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { diffCls } from "@/pages/ProblemsPage";
import { useDailyChallengeQuery } from "@/hooks/useProblemsQuery";

export default function DailyChallenge() {
  const { user } = useAuth();
  const { data: d, isLoading } = useDailyChallengeQuery();

  // Loading skeleton — sirf pehli baar (cache na ho)
  if (isLoading && !d) {
    return (
        <section
            className="rise relative overflow-hidden rounded-2xl border border-primary/40 bg-card p-6 mb-8 animate-pulse"
            data-testid="daily-loading"
        >
          <div className="h-4 w-40 bg-secondary rounded mb-3" />
          <div className="h-6 w-72 bg-secondary rounded mb-2" />
          <div className="h-3 w-48 bg-secondary rounded" />
        </section>
    );
  }

  if (!d || !d.problem) return null;
  const p = d.problem;

  return (
      <section
          className="rise relative overflow-hidden rounded-2xl border border-primary/40 bg-card p-6 mb-8"
          data-testid="daily-challenge"
      >
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-wrap items-center gap-6 justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">
              <CalendarCheck2 className="w-4 h-4" />
              Daily challenge · {d.date}
            </p>
            <Link
                to={`/problems/${p.slug}`}
                className="font-heading text-2xl font-bold tracking-tight hover:text-primary transition-colors"
                data-testid="daily-problem-link"
            >
              {p.id}. {p.title}
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              <span className={`font-semibold ${diffCls[p.difficulty]}`}>{p.difficulty}</span>
              {" · "}
              {d.reason}
            </p>
          </div>
          <div className="flex items-center gap-5">
            {user && (
                <>
                  <div className="text-center" data-testid="daily-streak">
                    <Flame
                        className={`w-5 h-5 mx-auto ${
                            d.streak ? "text-primary" : "text-muted-foreground"
                        }`}
                    />
                    <div className="font-heading text-xl font-bold">{d.streak}</div>
                    <div className="text-[11px] text-muted-foreground">day streak</div>
                  </div>
                  <div className="text-center" data-testid="daily-coins">
                    <Coins className="w-5 h-5 mx-auto text-medium" />
                    <div className="font-heading text-xl font-bold">{d.coins}</div>
                    <div className="text-[11px] text-muted-foreground">coins</div>
                  </div>
                </>
            )}
            {d.completed ? (
                <span
                    className="flex items-center gap-2 text-sm font-semibold text-easy px-4 py-2 rounded-full bg-easy/10"
                    data-testid="daily-completed"
                >
              <CheckCircle2 className="w-4 h-4" />
              Done for today
            </span>
            ) : (
                <Link
                    to={`/problems/${p.slug}`}
                    className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    data-testid="daily-solve-button"
                >
                  Solve now <ArrowRight className="w-4 h-4" />
                </Link>
            )}
          </div>
        </div>
        {user && !!d.badges?.length && (
            <div className="relative flex flex-wrap gap-2 mt-4" data-testid="daily-badges">
              {d.badges.map((b) => (
                  <span
                      key={b}
                      className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary/15 text-primary"
                  >
              <Award className="w-3 h-3" />
                    {b}
            </span>
              ))}
            </div>
        )}
        {!user && (
            <p className="relative text-xs text-muted-foreground mt-4">
              Sign in to get a daily problem picked from your favourite categories and build a streak.
            </p>
        )}
      </section>
  );
}