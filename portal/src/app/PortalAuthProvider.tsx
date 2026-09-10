'use client';

import React, { createContext, useContext } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

type PortalAuth = {
  enabled: boolean;
  ready: boolean;
  authenticated: boolean;
  walletAddress: string | null;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
  sendArbitrumTransaction: (transaction: { to: string; data: string; value?: string }) => Promise<string | null>;
};

const unavailableAuth: PortalAuth = {
  enabled: false, ready: true, authenticated: false, walletAddress: null,
  login: () => undefined, logout: () => undefined, getAccessToken: async () => null,
  sendArbitrumTransaction: async () => null,
};

const PortalAuthContext = createContext<PortalAuth>(unavailableAuth);

function PrivyPortalAuthProvider({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const wallet = user?.linkedAccounts.find((account) => account.type === 'wallet' && account.chainType === 'ethereum');
  const walletAddress = wallet && 'address' in wallet ? wallet.address : null;
  const sendArbitrumTransaction = async (transaction: { to: string; data: string; value?: string }): Promise<string | null> => {
    const connected = wallets.find((item) => item.address.toLowerCase() === walletAddress?.toLowerCase());
    if (!connected) return null;
    const provider = await connected.getEthereumProvider();
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x66eee' }] });
    return await provider.request({ method: 'eth_sendTransaction', params: [{ from: walletAddress, to: transaction.to, data: transaction.data, value: transaction.value || '0x0' }] }) as string;
  };
  return <PortalAuthContext.Provider value={{ enabled: true, ready, authenticated, walletAddress, login, logout, getAccessToken, sendArbitrumTransaction }}>{children}</PortalAuthContext.Provider>;
}

export function PortalAuthProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  if (!enabled) return <PortalAuthContext.Provider value={unavailableAuth}>{children}</PortalAuthContext.Provider>;
  return <PrivyPortalAuthProvider>{children}</PrivyPortalAuthProvider>;
}

export function usePortalAuth(): PortalAuth {
  return useContext(PortalAuthContext);
}
