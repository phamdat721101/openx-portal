export interface XrplSettlementConfig {
  enabled: boolean;
  rpcUrl: string | null;
  currency: string | null;
  issuer: string | null;
  destination: string | null;
}

export interface SettlementVerification {
  verified: boolean;
  reason?: string;
  transaction_hash?: string;
}

export interface QuotePayment {
  quote_id: string;
  amount: string;
  nonce: string;
  destination: string;
  issuer: string;
  expires_at?: string;
}

const normalizeAmount = (value: string): string => value.replace(/^0+(?=\d)/, '').replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
const xrplCurrencyMatches = (actual: string | undefined, expected: string): boolean => {
  if (actual === expected) return true;
  // XRPL represents non-standard (more than three-character) codes as a
  // 20-byte, zero-padded uppercase hexadecimal currency value.
  const encoded = Buffer.alloc(20);
  encoded.write(expected.toUpperCase(), 'ascii');
  return actual?.toUpperCase() === encoded.toString('hex').toUpperCase();
};
const amountMatches = (amount: unknown, expectedAmount: string, currency: string, issuer: string): boolean => {
  if (!amount || typeof amount !== 'object') return false;
  const issued = amount as { value?: string; currency?: string; issuer?: string };
  return typeof issued.value === 'string'
    && normalizeAmount(issued.value) === normalizeAmount(expectedAmount)
    && xrplCurrencyMatches(issued.currency, currency)
    && issued.issuer === issuer;
};
const memoMatches = (memos: unknown, nonce: string): boolean => Array.isArray(memos) && memos.some((entry) => {
  const memo = (entry as { Memo?: { MemoData?: string } }).Memo;
  return memo?.MemoData && Buffer.from(memo.MemoData, 'hex').toString('utf8') === nonce;
});

export class XrplTestnetSettlement {
  public config(): XrplSettlementConfig {
    return {
      enabled: process.env.OPENX_XRPL_SETTLEMENT_ENABLED === 'true',
      rpcUrl: process.env.XRPL_TESTNET_RPC_URL || null,
      currency: process.env.OPENX_RLUSD_CURRENCY || null,
      issuer: process.env.OPENX_RLUSD_ISSUER || null,
      destination: process.env.OPENX_XRPL_DESTINATION || null,
    };
  }

  public isConfigured(): boolean {
    const config = this.config();
    return config.enabled && Boolean(config.rpcUrl && config.currency && config.issuer && config.destination);
  }

  public async verifyServicePayment(transactionHash: string, expectedAmount: string): Promise<SettlementVerification> {
    const config = this.config();
    if (!this.isConfigured() || !config.rpcUrl || !config.currency || !config.issuer || !config.destination) {
      return { verified: false, reason: 'xrpl_testnet_settlement_not_configured' };
    }
    try {
      const response = await fetch(config.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'tx', params: [{ transaction: transactionHash, binary: false }] }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return { verified: false, reason: 'xrpl_rpc_unavailable' };
      const body = await response.json() as { result?: Record<string, unknown> };
      const tx = body.result || {};
      const txJson = (tx.tx_json && typeof tx.tx_json === 'object' ? tx.tx_json : tx) as Record<string, unknown>;
      if (tx.validated !== true || (tx.meta as { TransactionResult?: string } | undefined)?.TransactionResult !== 'tesSUCCESS') return { verified: false, reason: 'transaction_not_validated' };
      if (txJson.TransactionType !== 'Payment') return { verified: false, reason: 'transaction_not_payment' };
      if (txJson.Destination !== config.destination) return { verified: false, reason: 'unexpected_destination' };
      const delivered = (tx.meta as { delivered_amount?: unknown } | undefined)?.delivered_amount || txJson.Amount;
      if (!amountMatches(delivered, expectedAmount, config.currency, config.issuer)) return { verified: false, reason: 'unexpected_issued_amount' };
      return { verified: true, transaction_hash: transactionHash };
    } catch {
      return { verified: false, reason: 'xrpl_rpc_unavailable' };
    }
  }

  public async verifyQuotePayment(transactionHash: string, quote: QuotePayment): Promise<SettlementVerification> {
    const config = this.config();
    if (!this.isConfigured() || quote.destination !== config.destination || quote.issuer !== config.issuer) return { verified: false, reason: 'quote_terms_not_configured' };
    if (quote.expires_at && Date.parse(quote.expires_at) <= Date.now()) return { verified: false, reason: 'quote_expired' };
    const base = await this.verifyServicePayment(transactionHash, quote.amount);
    if (!base.verified || !config.rpcUrl) return base;
    try {
      const response = await fetch(config.rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'tx', params: [{ transaction: transactionHash, binary: false }] }), signal: AbortSignal.timeout(5000) });
      const body = await response.json() as { result?: Record<string, unknown> };
      const tx = body.result || {}; const txJson = (tx.tx_json && typeof tx.tx_json === 'object' ? tx.tx_json : tx) as Record<string, unknown>;
      if (!memoMatches(txJson.Memos, quote.nonce)) return { verified: false, reason: 'quote_nonce_mismatch' };
      return { verified: true, transaction_hash: transactionHash };
    } catch { return { verified: false, reason: 'xrpl_rpc_unavailable' }; }
  }
}

export const xrplTestnetSettlement = new XrplTestnetSettlement();
