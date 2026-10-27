import { useEffect, useState } from "react";

const LoadingScreen = () => {
    const [showFallback, setShowFallback] = useState(false);

    // If the gif fails to load (missing asset, network), show a text spinner
    useEffect(() => {
        const t = setTimeout(() => setShowFallback(true), 3000);
        return () => clearTimeout(t);
    }, []);

    return (
        <div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background text-foreground transition-colors duration-300"
            role="status"
            aria-live="polite"
            aria-label="Loading application"
            data-testid="loading-screen"
        >
            {!showFallback ? (
                <img
                    src="/Loading.gif"
                    alt=""
                    aria-hidden="true"
                    className="h-48 w-48 object-contain"
                    onError={() => setShowFallback(true)}
                />
            ) : (
                <div className="h-48 w-48 grid place-items-center">
                    <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
            )}

            <p className="mt-5 text-base font-medium text-muted-foreground">
                Please wait, loading...
            </p>
        </div>
    );
};

export default LoadingScreen;