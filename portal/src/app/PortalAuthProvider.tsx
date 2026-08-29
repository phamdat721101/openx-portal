'use client';

import React, { createContext, useContext } from 'react';
import { usePrivy } from '@privy-io/react-auth';

type PortalAuth = {
  enabled: boolean;
  ready: boolean;
  authenticated: boolean;
  walletAddress: string | null;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
};

const unavailableAuth: PortalAuth = {
  enabled: false, ready: true, authenticated: false, walletAddress: null,
  login: () => undefined, logout: () => undefined, getAccessToken: async () => null,
};

const PortalAuthContext = createContext<PortalAuth>(unavailableAuth);

function PrivyPortalAuthProvider({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const wallet = user?.linkedAccounts.find((account) => account.type === 'wallet' && account.chainType === 'ethereum');
  const walletAddress = wallet && 'address' in wallet ? wallet.address : null;
  return <PortalAuthContext.Provider value={{ enabled: true, ready, authenticated, walletAddress, login, logout, getAccessToken }}>{children}</PortalAuthContext.Provider>;
}

export function PortalAuthProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  if (!enabled) return <PortalAuthContext.Provider value={unavailableAuth}>{children}</PortalAuthContext.Provider>;
  return <PrivyPortalAuthProvider>{children}</PrivyPortalAuthProvider>;
}

export function usePortalAuth(): PortalAuth {
  return useContext(PortalAuthContext);
}
