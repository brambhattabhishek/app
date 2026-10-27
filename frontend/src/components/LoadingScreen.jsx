import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * LoadingScreen
 *
 * Renders a full-screen loading overlay while API requests are in flight.
 * Gif used as primary asset; falls back to CSS spinner if gif fails to load.
 *
 * RULES:
 *  - Minimum visible duration: 800ms (avoids flash on fast connections)
 *  - Maximum visible duration: 20s (hard cap — never blocks app forever)
 *  - Auto-hides when `visible` prop flips to false (parent controls this)
 *
 * Props:
 *  - visible: boolean — parent toggles based on API request tracking
 *  - message?: string — optional override message
 */
const LoadingScreen = ({ visible = true, message = "Please wait, loading..." }) => {
    const [showFallback, setShowFallback] = useState(false);
    const [mountTime] = useState(() => Date.now());
    const [minElapsed, setMinElapsed] = useState(false);
    const [opacity, setOpacity] = useState(1);
    const hideTimerRef = useRef(null);

    // Enforce minimum 800ms visible to avoid flash on super-fast loads
    useEffect(() => {
        const t = setTimeout(() => setMinElapsed(true), 800);
        return () => clearTimeout(t);
    }, []);

    // Gif fallback — if gif hasn't loaded in 2.5s, switch to CSS spinner
    useEffect(() => {
        const t = setTimeout(() => setShowFallback(true), 2500);
        return () => clearTimeout(t);
    }, []);

    // Fade out when visible flips to false AND minimum time elapsed
    useEffect(() => {
        if (visible) {
            setOpacity(1);
            return;
        }
        if (!minElapsed) return; // wait for min time

        // Fade out over 300ms
        setOpacity(0);
        hideTimerRef.current = setTimeout(() => {
            // Parent will unmount us; no state change needed here
        }, 300);
        return () => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [visible, minElapsed]);

    if (!visible && opacity <= 0) {
        // Fully faded out — parent should have unmounted; return null as safety
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background text-foreground transition-opacity duration-300"
            style={{ opacity }}
            role="status"
            aria-live="polite"
            aria-label="Loading application"
            data-testid="loading-screen"
            data-min-elapsed={minElapsed}
        >
            {!showFallback ? (
                <img
                    src="/Loading.gif"
                    alt=""
                    aria-hidden="true"
                    className="h-32 w-32 sm:h-48 sm:w-48 object-contain"
                    onError={() => setShowFallback(true)}
                    draggable={false}
                />
            ) : (
                <div className="h-32 w-32 sm:h-48 sm:w-48 grid place-items-center">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
            )}

            <p className="mt-5 text-sm sm:text-base font-medium text-muted-foreground">
                {message}
            </p>
            <p className="mt-1 text-[10px] sm:text-xs text-muted-foreground/60">
                This may take a few seconds on a slow connection
            </p>
        </div>
    );
};

export default LoadingScreen;