"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";

type LoadingOverlayContextType = {
  show: (message?: string) => void;
  hide: () => void;
  isLoading: boolean;
  message?: string;
};

const LoadingOverlayContext = createContext<LoadingOverlayContextType | undefined>(undefined);

export function LoadingOverlayProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  const show = (msg?: string) => {
    setMessage(msg);
    setIsLoading(true);
  };
  const hide = () => {
    setIsLoading(false);
    setMessage(undefined);
  };

  return (
    <LoadingOverlayContext.Provider value={{ show, hide, isLoading, message }}>
      {children}
      <LoadingOverlay isLoading={isLoading} message={message} />
    </LoadingOverlayContext.Provider>
  );
}

export function useLoadingOverlay() {
  const ctx = useContext(LoadingOverlayContext);
  if (!ctx) throw new Error("useLoadingOverlay must be used within LoadingOverlayProvider");
  return ctx;
}

export function LoadingOverlay({ isLoading, message }: { isLoading: boolean; message?: string }) {
  if (!isLoading) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-xl shadow-xl">
        <svg className="animate-spin h-10 w-10 text-[#28ebcf]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span className="text-lg font-semibold text-[#101112]">{message || "Bitte warten..."}</span>
      </div>
    </div>
  );
}
