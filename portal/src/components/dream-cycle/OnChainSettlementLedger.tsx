'use client';

import React from 'react';
import { fetchSettlementHistory, type AgentSettlementTransaction } from '@/lib/api/agentGateway';
import {
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  RotateCw,
  Server,
  Building2,
  Receipt,
  Terminal,
  CheckCircle2,
  Clock,
  AlertCircle,
  Hash,
} from 'lucide-react';

interface OnChainSettlementLedgerProps {
  agentId: string;
}

export function OnChainSettlementLedger({ agentId }: OnChainSettlementLedgerProps) {
  const [settlements, setSettlements] = React.useState<AgentSettlementTransaction[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [copiedHash, setCopiedHash] = React.useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);
  const [activeCodeTab, setActiveCodeTab] = React.useState<'curl' | 'python'>('curl');

  const loadSettlements = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchSettlementHistory(agentId);
      if (res.ok && res.settlements) {
        setSettlements(res.settlements);
      }
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  React.useEffect(() => {
    void loadSettlements();
  }, [loadSettlements]);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 1800);
  };

  const copyPromptText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const totalVolume = settlements
    .reduce((acc, s) => acc + (s.status === 'settled' ? parseFloat(s.amount || '0') || 0 : 0), 0)
    .toFixed(4);

  const uniqueFacilitators = Array.from(
    new Set(settlements.map((s) => s.facilitator_node || 'hypermove-gateway-relay'))
  );

  const syncInstructionPrompt = `Please synchronize on-chain settlement transactions for Dream Cycle runs by invoking the Gateway settlement sync API at POST /v1/agents/${agentId}/settlements with tx-hash, facilitator-node, merchant addr, and amount.`;

  const curlSnippet = `curl -X POST "http://localhost:7411/v1/agents/${agentId}/settlements" \\
  -H "Content-Type: application/json" \\
  -H "x-agent-key: \${OPENX_AGENT_KEY}" \\
  -d '{
    "transaction_hash": "4B5C91A8560410197CEBD4C796E648D02BFE004C30905279FAFFD197CEBD4C79",
    "quote_id": "quote-dream-${agentId.slice(0, 8)}",
    "amount": "0.05",
    "currency": "RLUSD",
    "merchant_address": "rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV",
    "facilitator_node": "hypermove-relay-01",
    "status": "settled"
  }'`;

  const pythonSnippet = `from gateway_client import sync_settlement

sync_settlement(
    agent_id="${agentId}",
    transaction_hash="4B5C91A8560410197CEBD4C796E648D02BFE004C30905279FAFFD197CEBD4C79",
    quote_id="quote-dream-${agentId.slice(0, 8)}",
    amount="0.05",
    currency="RLUSD",
    merchant_address="rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV",
    facilitator_node="hypermove-relay-01",
    status="settled"
)`;

  return (
    <section className="space-y-6">
      {/* Top Header & Overview Bar */}
      <div className="rounded-2xl border border-secondary/30 bg-surface-container-low p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-secondary animate-pulse" />
              <p className="text-[11px] font-bold uppercase tracking-[.14em] text-secondary font-mono">
                XRPL On-Chain Settlement Ledger
              </p>
            </div>
            <h2 className="font-headline text-xl font-bold text-on-surface mt-1">
              Agent Settlement Transactions
            </h2>
            <p className="text-xs text-on-surface-variant mt-1 max-w-2xl">
              Deterministic x402 settlement proofs recorded on XRPL Testnet during Dream Cycle REM runs, memory consolidation, and agent execution.
            </p>
          </div>

          <button
            onClick={() => void loadSettlements()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-surface-container-high border border-outline-variant/40 px-4 py-2 text-xs font-bold text-on-surface hover:bg-surface-container hover:text-primary transition disabled:opacity-50 self-start sm:self-auto"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            <span>{loading ? 'Refreshing…' : 'Refresh Ledger'}</span>
          </button>
        </div>

        {/* 4 Metric KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container/60 p-3.5">
            <span className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-primary" /> Settled Volume
            </span>
            <div className="font-mono text-xl font-extrabold text-primary mt-1">
              {totalVolume} <span className="text-xs font-sans text-on-surface-variant">RLUSD</span>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant/30 bg-surface-container/60 p-3.5">
            <span className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-secondary" /> Validated Txs
            </span>
            <div className="font-mono text-xl font-extrabold text-on-surface mt-1">
              {settlements.filter((s) => s.status === 'settled').length}{' '}
              <span className="text-xs font-sans text-on-surface-variant">/ {settlements.length} total</span>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant/30 bg-surface-container/60 p-3.5">
            <span className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-agent-accent" /> Facilitator Nodes
            </span>
            <div className="font-mono text-xl font-extrabold text-on-surface mt-1">
              {uniqueFacilitators.length} <span className="text-xs font-sans text-on-surface-variant">relays</span>
            </div>
          </div>

          <div className="rounded-xl border border-outline-variant/30 bg-surface-container/60 p-3.5">
            <span className="text-[11px] font-medium text-on-surface-variant flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-secondary" /> Settlement Rail
            </span>
            <div className="font-mono text-sm font-bold text-secondary mt-2 truncate">
              XLS-30 / x402
            </div>
          </div>
        </div>
      </div>

      {/* Settlements Interactive Table */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low overflow-hidden">
        <div className="p-4 border-b border-outline-variant/30 bg-surface-container/40 flex items-center justify-between">
          <div>
            <h3 className="font-headline text-sm font-bold text-on-surface">
              Settlement Verification Records
            </h3>
            <p className="text-[11px] text-on-surface-variant">
              Transactions verified via ledger-index validation and nonce claims
            </p>
          </div>
          <span className="font-mono text-xs text-on-surface-variant bg-surface-container-high px-2.5 py-1 rounded-lg border border-outline-variant/20">
            {settlements.length} {settlements.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {settlements.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Receipt className="h-8 w-8 text-on-surface-variant/40 mx-auto" />
            <p className="text-xs font-bold text-on-surface">No settlement transactions recorded yet</p>
            <p className="text-[11px] text-on-surface-variant max-w-md mx-auto">
              Run a Dream Cycle to execute an automated on-chain settlement, or ask your connected agent to sync existing settlement data using the instructions below.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-high/30 text-on-surface-variant uppercase tracking-wider font-mono text-[11px]">
                  <th className="py-3 px-4 font-semibold">Tx Hash</th>
                  <th className="py-3 px-4 font-semibold">Facilitator Node</th>
                  <th className="py-3 px-4 font-semibold">Merchant Address</th>
                  <th className="py-3 px-4 font-semibold">Amount</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Settled At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 font-mono">
                {settlements.map((tx, idx) => {
                  const txHash = tx.transaction_hash || 'tx-hash-pending';
                  const shortHash = txHash.length > 16 ? `${txHash.slice(0, 8)}...${txHash.slice(-6)}` : txHash;
                  const merchantAddr = tx.merchant_address || tx.destination || 'r...merchant';
                  const shortMerchant = merchantAddr.length > 16 ? `${merchantAddr.slice(0, 7)}...${merchantAddr.slice(-5)}` : merchantAddr;
                  const facilitator = tx.facilitator_node || 'hypermove-gateway-relay';
                  const isCopied = copiedHash === txHash;

                  return (
                    <tr key={tx.quote_id || idx} className="hover:bg-surface-container/60 transition-colors">
                      {/* 1. Tx Hash */}
                      <td className="py-3 px-4 font-semibold text-primary">
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                          <span>{shortHash}</span>
                          {tx.transaction_hash && (
                            <>
                              <button
                                onClick={() => copyToClipboard(tx.transaction_hash!, tx.transaction_hash!)}
                                title="Copy Tx Hash"
                                className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition"
                              >
                                {isCopied ? <Check className="h-3 w-3 text-secondary" /> : <Copy className="h-3 w-3" />}
                              </button>
                              <a
                                href={`https://testnet.xrpl.org/transactions/${tx.transaction_hash}`}
                                target="_blank"
                                rel="noreferrer"
                                title="View on XRPL Testnet Explorer"
                                className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </>
                          )}
                        </div>
                      </td>

                      {/* 2. Facilitator Node */}
                      <td className="py-3 px-4 text-on-surface">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container-high border border-outline-variant/30 text-[11px] text-on-surface font-sans font-medium">
                          <Server className="h-3 w-3 text-agent-accent" />
                          <span>{facilitator}</span>
                        </span>
                      </td>

                      {/* 3. Merchant Address */}
                      <td className="py-3 px-4 text-on-surface-variant">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 text-secondary/70 shrink-0" />
                          <span>{shortMerchant}</span>
                          {tx.merchant_address && (
                            <a
                              href={`https://testnet.xrpl.org/accounts/${tx.merchant_address}`}
                              target="_blank"
                              rel="noreferrer"
                              title="View Merchant Account"
                              className="p-1 rounded hover:bg-surface-container-highest text-on-surface-variant hover:text-secondary transition"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* 4. Amount */}
                      <td className="py-3 px-4 font-bold text-on-surface">
                        {tx.amount} <span className="text-[10px] text-secondary">{tx.currency}</span>
                      </td>

                      {/* 5. Status */}
                      <td className="py-3 px-4">
                        {tx.status === 'settled' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-secondary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-secondary border border-secondary/30">
                            <CheckCircle2 className="h-3 w-3" /> Settled
                          </span>
                        ) : tx.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase text-warning border border-warning/30">
                            <Clock className="h-3 w-3 animate-spin" /> Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-error/15 px-2 py-0.5 text-[10px] font-bold uppercase text-error border border-error/30">
                            <AlertCircle className="h-3 w-3" /> Failed
                          </span>
                        )}
                      </td>

                      {/* 6. Timestamp */}
                      <td className="py-3 px-4 text-right text-on-surface-variant text-[11px]">
                        {tx.settled_at ? new Date(tx.settled_at).toLocaleString() : 'Recent'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ask Agent to Sync Data Instruction Card */}
      <div className="rounded-2xl border border-agent-accent/40 bg-surface-container-low p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              <h3 className="font-headline text-sm font-bold text-on-surface">
                Ask Agent to Sync On-Chain Settlements
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant max-w-2xl leading-relaxed">
              Copy this prompt to instruct your autonomous agent, or run the client code below. The agent synchronizes its verified XRPL transaction hash, facilitator relay node, and merchant destination into the OpenX Gateway.
            </p>
          </div>

          <button
            onClick={() => copyPromptText(syncInstructionPrompt)}
            className="flex items-center gap-1.5 rounded-lg bg-surface-container-high border border-outline-variant/30 px-3.5 py-1.5 text-xs font-semibold text-on-surface hover:bg-surface-container hover:text-primary transition shrink-0"
          >
            {copiedPrompt ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedPrompt ? 'Copied Prompt!' : 'Copy Sync Instruction'}</span>
          </button>
        </div>

        {/* Prompt Preview Box */}
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-high/40 p-3 text-xs text-on-surface font-sans leading-relaxed">
          &ldquo;{syncInstructionPrompt}&rdquo;
        </div>

        {/* Code Snippets (cURL / Python) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveCodeTab('curl')}
                className={`text-xs font-bold px-3 py-1 rounded-md transition ${
                  activeCodeTab === 'curl'
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                cURL
              </button>
              <button
                onClick={() => setActiveCodeTab('python')}
                className={`text-xs font-bold px-3 py-1 rounded-md transition ${
                  activeCodeTab === 'python'
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Python ADK
              </button>
            </div>
            <button
              onClick={() => copyToClipboard(activeCodeTab === 'curl' ? curlSnippet : pythonSnippet, 'code')}
              className="text-[11px] text-on-surface-variant hover:text-primary flex items-center gap-1 font-mono"
            >
              {copiedHash === 'code' ? <Check className="h-3 w-3 text-secondary" /> : <Copy className="h-3 w-3" />}
              <span>{copiedHash === 'code' ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          <pre className="p-3.5 rounded-xl bg-surface-container-highest/60 text-on-surface font-mono text-xs overflow-x-auto whitespace-pre-wrap border border-outline-variant/20 max-h-48">
            {activeCodeTab === 'curl' ? curlSnippet : pythonSnippet}
          </pre>
        </div>
      </div>
    </section>
  );
}
