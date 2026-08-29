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
const RPC_URL = process.env.OPENX_STATUS_RPC_URL || 'https://rpc.testnet.status.network';
const CHAIN_ID = 49986;

const hexToDecimal = (value: string) => BigInt(value || '0x0').toString();
const rpc = async (method: string, params: unknown[]): Promise<any> => {
  const response = await fetch(RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(3_000) });
  const body = await response.json() as { result?: unknown; error?: { message?: string } };
  if (!response.ok || body.error) throw new Error(body.error?.message || `Status RPC ${response.status}`);
  return body.result;
};
const tokens = (): TokenConfig[] => {
  try {
    const parsed = JSON.parse(process.env.OPENX_STATUS_NETWORK_TOKENS || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is TokenConfig => typeof item?.address === 'string' && typeof item?.symbol === 'string' && Number.isInteger(item?.decimals)) : [];
  } catch { return []; }
};

export class StatusWalletService {
  public async snapshot(address: string | null): Promise<WalletSnapshot> {
    const result: WalletSnapshot = { address, chain_id: CHAIN_ID, network: 'Status Network Testnet', native_balance_wei: null, tokens: [], activity: [], fetched_at: new Date().toISOString(), source_errors: [] };
    if (!address) { result.source_errors.push('wallet_not_linked'); return result; }
    try { result.native_balance_wei = hexToDecimal(await rpc('eth_getBalance', [address, 'latest']) as string); }
    catch (error) { result.source_errors.push(`rpc_balance_unavailable:${error instanceof Error ? error.message : 'unknown'}`); }
    for (const token of tokens()) {
      try {
        const balance = await rpc('eth_call', [{ to: token.address, data: `0x70a08231000000000000000000000000${address.slice(2).toLowerCase()}` }, 'latest']) as string;
        result.tokens.push({ ...token, balance: hexToDecimal(balance) });
      } catch { result.source_errors.push(`token_unavailable:${token.symbol}`); }
    }
    const explorer = process.env.OPENX_STATUS_EXPLORER_API_URL;
    if (!explorer) { result.source_errors.push('explorer_not_configured'); return result; }
    try {
      const url = new URL(explorer); url.searchParams.set('module', 'account'); url.searchParams.set('action', 'txlist'); url.searchParams.set('address', address); url.searchParams.set('sort', 'desc'); url.searchParams.set('page', '1'); url.searchParams.set('offset', '10');
      const response = await fetch(url, { signal: AbortSignal.timeout(3_000) }); const body = await response.json() as { result?: any[] };
      result.activity = Array.isArray(body.result) ? body.result.map((item) => ({ hash: String(item.hash), timestamp: item.timeStamp ? new Date(Number(item.timeStamp) * 1000).toISOString() : null, from: String(item.from || ''), to: item.to ? String(item.to) : null, value: String(item.value || '0') })) : [];
    } catch { result.source_errors.push('explorer_activity_unavailable'); }
    return result;
  }
}

export const statusWalletService = new StatusWalletService();
