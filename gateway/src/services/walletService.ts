export interface WalletToken { address: string; symbol: string; decimals: number; balance: string; }
export interface WalletActivity { hash: string; timestamp: string | null; from: string; to: string | null; value: string; }
export interface WalletSnapshot {
  address: string | null;
  chain_id: number;
  network: string;
  native_balance_wei: string | null;
  tokens: WalletToken[];
  activity: WalletActivity[];
  fetched_at: string;
  source_errors: string[];
}

interface TokenConfig { address: string; symbol: string; decimals: number; }

const defaultEvmRpc = () => process.env.OPENX_WALLET_RPC_URL || process.env.ETHEREUM_RPC_URL || '';
const defaultEvmChainId = () => Number(process.env.OPENX_WALLET_CHAIN_ID || 1);
const defaultEvmNetwork = () => process.env.OPENX_WALLET_NETWORK_NAME || 'Ethereum Mainnet';
const defaultXrplRpc = () => process.env.XRPL_RPC_URL || 'https://s.altnet.rippletest.net:51234';

const hexToDecimal = (value: string) => BigInt(value || '0x0').toString();

const evmRpc = async (rpcUrl: string, method: string, params: unknown[]): Promise<any> => {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(3_000),
  });
  const body = await response.json() as { result?: unknown; error?: { message?: string } };
  if (!response.ok || body.error) throw new Error(body.error?.message || `EVM RPC ${response.status}`);
  return body.result;
};

const xrplRpc = async (rpcUrl: string, method: string, params: Record<string, unknown>[]): Promise<any> => {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, params }),
    signal: AbortSignal.timeout(3_000),
  });
  const body = await response.json() as { result?: Record<string, unknown>; error?: string };
  if (!response.ok || body.error) throw new Error(body.error || `XRPL RPC ${response.status}`);
  return body.result;
};

const configuredTokens = (): TokenConfig[] => {
  try {
    const parsed = JSON.parse(process.env.OPENX_WALLET_TOKENS || process.env.OPENX_STATUS_NETWORK_TOKENS || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is TokenConfig => typeof item?.address === 'string' && typeof item?.symbol === 'string' && Number.isInteger(item?.decimals)) : [];
  } catch { return []; }
};

export class AgentWalletService {
  public async snapshot(address: string | null): Promise<WalletSnapshot> {
    const defaultChainId = defaultEvmChainId();
    const defaultNetwork = defaultEvmNetwork();
    const result: WalletSnapshot = {
      address,
      chain_id: defaultChainId,
      network: defaultNetwork,
      native_balance_wei: null,
      tokens: [],
      activity: [],
      fetched_at: new Date().toISOString(),
      source_errors: [],
    };

    if (!address) {
      result.source_errors.push('wallet_not_linked');
      return result;
    }

    // 1. XRPL Classic Address Check (starts with 'r' and valid length)
    if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)) {
      result.chain_id = 0;
      result.network = process.env.XRPL_NETWORK_NAME || 'XRPL Testnet';
      const xrplEndpoint = defaultXrplRpc();
      try {
        const info = await xrplRpc(xrplEndpoint, 'account_info', [{ account: address, ledger_index: 'validated' }]);
        if (info?.account_data?.Balance) {
          result.native_balance_wei = String(info.account_data.Balance);
        }
      } catch (error) {
        result.source_errors.push(`xrpl_balance_unavailable:${error instanceof Error ? error.message : 'unknown'}`);
      }

      try {
        const lines = await xrplRpc(xrplEndpoint, 'account_lines', [{ account: address, ledger_index: 'validated' }]);
        if (Array.isArray(lines?.lines)) {
          for (const line of lines.lines) {
            result.tokens.push({
              address: String(line.account || ''),
              symbol: String(line.currency || 'TOKEN'),
              decimals: 6,
              balance: String(line.balance || '0'),
            });
          }
        }
      } catch {
        // Non-critical token line fetch
      }
      return result;
    }

    // 2. EVM Address Check (0x...)
    if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
      result.chain_id = defaultChainId;
      result.network = defaultNetwork;
      const rpcUrl = defaultEvmRpc();
      if (!rpcUrl) {
        result.source_errors.push('rpc_not_configured');
        return result;
      }

      try {
        result.native_balance_wei = hexToDecimal(await evmRpc(rpcUrl, 'eth_getBalance', [address, 'latest']) as string);
      } catch (error) {
        result.source_errors.push(`rpc_balance_unavailable:${error instanceof Error ? error.message : 'unknown'}`);
      }

      for (const token of configuredTokens()) {
        try {
          const balance = await evmRpc(rpcUrl, 'eth_call', [{ to: token.address, data: `0x70a08231000000000000000000000000${address.slice(2).toLowerCase()}` }, 'latest']) as string;
          result.tokens.push({ ...token, balance: hexToDecimal(balance) });
        } catch {
          result.source_errors.push(`token_unavailable:${token.symbol}`);
        }
      }

      const explorer = process.env.OPENX_EXPLORER_API_URL || process.env.OPENX_STATUS_EXPLORER_API_URL;
      if (explorer) {
        try {
          const url = new URL(explorer);
          url.searchParams.set('module', 'account');
          url.searchParams.set('action', 'txlist');
          url.searchParams.set('address', address);
          url.searchParams.set('sort', 'desc');
          url.searchParams.set('page', '1');
          url.searchParams.set('offset', '10');
          const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
          const body = await response.json() as { result?: any[] };
          result.activity = Array.isArray(body.result) ? body.result.map((item) => ({
            hash: String(item.hash),
            timestamp: item.timeStamp ? new Date(Number(item.timeStamp) * 1000).toISOString() : null,
            from: String(item.from || ''),
            to: item.to ? String(item.to) : null,
            value: String(item.value || '0'),
          })) : [];
        } catch {
          result.source_errors.push('explorer_activity_unavailable');
        }
      }
      return result;
    }

    // 3. Fallback for custom formatted wallet addresses
    result.source_errors.push('unsupported_wallet_format');
    return result;
  }
}

export const agentWalletService = new AgentWalletService();
export const walletService = agentWalletService;
export const statusWalletService = agentWalletService;

