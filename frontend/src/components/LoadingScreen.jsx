import React from "react";

const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background text-foreground transition-colors duration-300">
            <img
                src="/Loading.gif"
                alt="Loading..."
                className="h-48 w-48 object-contain"
            />

            <p className="mt-5 text-base font-medium text-muted-foreground">
                Please wait, loading...
            </p>
        </div>
    );
};

export default LoadingScreen;