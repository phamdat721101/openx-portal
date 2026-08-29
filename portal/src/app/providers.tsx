'use client';

import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { PortalAuthProvider } from './PortalAuthProvider';

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function Providers({ children }: { children: React.ReactNode }) {
  if (!appId) return <PortalAuthProvider enabled={false}>{children}</PortalAuthProvider>;
  return (
    <PrivyProvider appId={appId} config={{ appearance: { theme: 'dark', accentColor: '#00f0ff' }, loginMethods: ['email', 'wallet'], embeddedWallets: { createOnLogin: 'users-without-wallets' } }}>
      <PortalAuthProvider enabled>{children}</PortalAuthProvider>
    </PrivyProvider>
  );
}
