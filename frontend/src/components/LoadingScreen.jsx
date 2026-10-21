import React from "react";

const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
            <img
                src="/loading.gif"
                alt="Loading..."
                className="h-32 w-32 object-contain"
            />

            <p className="mt-4 text-sm font-medium text-gray-600">
                <img herf={} />
            </p>
        </div>
    );
};

export default LoadingScreen;