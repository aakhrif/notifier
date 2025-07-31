import React from "react";

export default function ApiStatusProvider({children}:{children: React.ReactNode}) {
    return (
        <div className="config-provider">
            {/* Configuration context logic goes here */}
            {children}
        </div>
    );
}