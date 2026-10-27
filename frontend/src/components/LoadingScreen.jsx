import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

const GIF_TIMEOUT_MS = 8000;  // Give gif plenty of time to load
const MIN_VISIBLE_MS = 800;   // Min visible duration to avoid flash

const LoadingScreen = ({ visible = true, message = "Please wait, loading..." }) => {
    const [gifLoaded, setGifLoaded] = useState(false);
    const [gifFailed, setGifFailed] = useState(false);
    const [minElapsed, setMinElapsed] = useState(false);
    const [opacity, setOpacity] = useState(1);
    const hideTimerRef = useRef(null);
    const gifTimerRef = useRef(null);

    // Enforce minimum visible duration to avoid flash on fast loads
    useEffect(() => {
        const t = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
        return () => clearTimeout(t);
    }, []);

    // Fallback to spinner only if gif hasn't loaded within 8s
    // (onLoad or onError below will clear this timer)
    useEffect(() => {
        gifTimerRef.current = setTimeout(() => {
            if (!gifLoaded && !gifFailed) {
                setGifFailed(true);
            }
        }, GIF_TIMEOUT_MS);

        return () => {
            if (gifTimerRef.current) clearTimeout(gifTimerRef.current);
        };
    }, [gifLoaded, gifFailed]);

    // Fade out when `visible` flips to false
    useEffect(() => {
        if (visible) {
            setOpacity(1);
            return;
        }
        if (!minElapsed) return;

        setOpacity(0);
        hideTimerRef.current = setTimeout(() => {
            /* parent will unmount */
        }, 300);
        return () => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [visible, minElapsed]);

    if (!visible && opacity <= 0) return null;

    // ── Decide what to render ──
    // 1. If gif failed → spinner
    // 2. If gif loaded successfully → show gif (always)
    // 3. If gif still loading (no onLoad yet) → show gif tag anyway (browser will show when ready)
    const showSpinner = gifFailed && !gifLoaded;

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background text-foreground transition-opacity duration-300"
            style={{ opacity }}
            role="status"
            aria-live="polite"
            aria-label="Loading application"
            data-testid="loading-screen"
            data-gif-loaded={gifLoaded}
            data-gif-failed={gifFailed}
        >
            {showSpinner ? (
                <div className="h-32 w-32 sm:h-48 sm:w-48 grid place-items-center">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
            ) : (
                <img
                    src="/Loading.gif"
                    alt=""
                    aria-hidden="true"
                    className="h-32 w-32 sm:h-48 sm:w-48 object-contain"
                    onLoad={() => {
                        setGifLoaded(true);
                        if (gifTimerRef.current) {
                            clearTimeout(gifTimerRef.current);
                            gifTimerRef.current = null;
                        }
                    }}
                    onError={() => {
                        setGifFailed(true);
                        if (gifTimerRef.current) {
                            clearTimeout(gifTimerRef.current);
                            gifTimerRef.current = null;
                        }
                    }}
                    draggable={false}
                />
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