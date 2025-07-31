"use client";

import React, { createContext, useState, useMemo } from "react";

type Config = {
  tokenAddresses: string[];
  setTokenAddresses: (addresses: string[] | string) => void;
  interval: number;
  setInterval: (interval: number) => void;
  emailReceiver: string;
  setEmailReceiver: (email: string) => void;
  emailTemplate: string;
  setEmailTemplate: (template: string) => void;
  apis: Record<string, boolean>;
  setApiStatus: (api: string, status: boolean) => void;
};

const ConfigContext = createContext<Config | undefined>(undefined);

export function useConfig() {
  const context = React.useContext(ConfigContext);
  if (!context) throw new Error("useConfig must be used within a ConfigProvider");
  return context;
}

export default function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [tokenAddresses, setTokenAddressesState] = useState<string[]>([]);
  const setTokenAddresses = (addresses: string[] | string) => {
    if (typeof addresses === "string") {
      setTokenAddressesState([addresses]);
    } else {
      setTokenAddressesState(addresses);
    }
  };

  const [interval, setInterval] = useState<number>(60);
  const [emailReceiver, setEmailReceiver] = useState<string>("");
  const [emailTemplate, setEmailTemplate] = useState<string>("Hello, your notification!");
  const [apis, setApis] = useState<Record<string, boolean>>({
    coingecko: true,
    binance: false,
    customApi: false,
  });

  const setApiStatus = (api: string, status: boolean) => {
    setApis((prev) => ({ ...prev, [api]: status }));
  };

  const value = useMemo(
    () => ({
      tokenAddresses,
      setTokenAddresses,
      interval,
      setInterval,
      emailReceiver,
      setEmailReceiver,
      emailTemplate,
      setEmailTemplate,
      apis,
      setApiStatus,
    }),
    [tokenAddresses, interval, emailReceiver, emailTemplate, apis]
  );

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}