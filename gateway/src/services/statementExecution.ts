import { Interface, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from 'ethers';
import { randomUUID } from 'node:crypto';
import { blockProver, chainInfo, proofProvider } from '@gluwa/usc-sdk';
import { gatewayDatabase } from '../db/database.js';

const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
const CREDITCOIN_RETRY_DELAY_MS = 30_000;
const commitmentInterface = new Interface(['function commit(bytes32 reportHash, bytes32 actionId)', 'event StatementCommitted(bytes32 indexed reportHash, bytes32 indexed actionId, address indexed committer)']);
const anchorInterface = new Interface(['function anchor(bytes32 receiptHash)', 'event ReceiptAnchored(bytes32 indexed receiptHash, address indexed relayer)']);

export type ExecutionStatus = 'prepared' | 'submitted' | 'verified' | 'anchor_pending' | 'anchored' | 'failed';
export type AttestationStatus = 'pending_anchor' | 'pending_creditcoin_attestation' | 'verified' | 'unavailable' | 'failed';
export interface StatementExecution {
  id: string; agent_id: string; report_id: string; report_hash: string; wallet_address: string;
  action_id: string; status: ExecutionStatus; arbitrum_tx_hash?: string; arbitrum_block?: string;
  receipt_hash?: string; ethereum_anchor_tx_hash?: string; ethereum_anchor_block?: string;
  creditcoin_chain_id?: string; creditcoin_chain_key?: string; creditcoin_block?: string; creditcoin_verified_at?: string; creditcoin_attested_height?: string; creditcoin_retry_at?: string;
  creditcoin_proof_tx_hash?: string; creditcoin_proof_tx_index?: string; creditcoin_proof_payload_hash?: string; creditcoin_proof_generated_at?: string; creditcoin_proof_cached?: boolean; creditcoin_verification_method?: string; creditcoin_explorer_url?: string;
  attestation_status: AttestationStatus;
  reason?: string; created_at: string; updated_at: string;
}

const timestamp = () => new Date().toISOString();
const configured = () => Boolean(process.env.OPENX_STATEMENT_EXECUTION_ENABLED === 'true' && process.env.OPENX_ARBITRUM_SEPOLIA_RPC_URL && process.env.OPENX_STATEMENT_COMMITMENT_REGISTRY);
const normalizeAddress = (address: string) => address.toLowerCase();
const normalizeHash = (hash: string) => {
  const normalized = hash.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new Error('invalid_statement_report_hash');
  return normalized;
};

class StatementExecutionService {
  constructor() {
    gatewayDatabase.raw().exec(`CREATE TABLE IF NOT EXISTS statement_executions (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, report_id TEXT NOT NULL, report_hash TEXT NOT NULL,
      wallet_address TEXT NOT NULL, action_id TEXT NOT NULL, status TEXT NOT NULL, arbitrum_tx_hash TEXT,
      arbitrum_block TEXT, receipt_hash TEXT, ethereum_anchor_tx_hash TEXT, ethereum_anchor_block TEXT,
      creditcoin_chain_id TEXT, creditcoin_chain_key TEXT, creditcoin_block TEXT, creditcoin_verified_at TEXT, creditcoin_attested_height TEXT, creditcoin_retry_at TEXT,
      creditcoin_proof_tx_hash TEXT, creditcoin_proof_tx_index TEXT, creditcoin_proof_payload_hash TEXT, creditcoin_proof_generated_at TEXT, creditcoin_proof_cached INTEGER, creditcoin_verification_method TEXT, attestation_status TEXT NOT NULL,
      reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(agent_id, report_id, action_id));
      CREATE INDEX IF NOT EXISTS statement_executions_agent_updated ON statement_executions(agent_id, updated_at DESC);`);
    const columns = new Set((gatewayDatabase.raw().prepare('PRAGMA table_info(statement_executions)').all() as { name: string }[]).map((column) => column.name));
    for (const [name, definition] of Object.entries({ ethereum_anchor_block: 'TEXT', creditcoin_chain_id: 'TEXT', creditcoin_chain_key: 'TEXT', creditcoin_block: 'TEXT', creditcoin_verified_at: 'TEXT', creditcoin_attested_height: 'TEXT', creditcoin_retry_at: 'TEXT', creditcoin_proof_tx_hash: 'TEXT', creditcoin_proof_tx_index: 'TEXT', creditcoin_proof_payload_hash: 'TEXT', creditcoin_proof_generated_at: 'TEXT', creditcoin_proof_cached: 'INTEGER', creditcoin_verification_method: 'TEXT' })) {
      if (!columns.has(name)) gatewayDatabase.raw().exec(`ALTER TABLE statement_executions ADD COLUMN ${name} ${definition}`);
    }
  }

  public isConfigured(): boolean { return configured(); }
  public contractAddress(): string | undefined { return process.env.OPENX_STATEMENT_COMMITMENT_REGISTRY; }

  private row(value: Record<string, unknown>): StatementExecution {
    return {
      id: String(value.id), agent_id: String(value.agent_id), report_id: String(value.report_id), report_hash: String(value.report_hash),
      wallet_address: String(value.wallet_address), action_id: String(value.action_id), status: value.status as ExecutionStatus,
      ...(value.arbitrum_tx_hash ? { arbitrum_tx_hash: String(value.arbitrum_tx_hash) } : {}),
      ...(value.arbitrum_block ? { arbitrum_block: String(value.arbitrum_block) } : {}),
      ...(value.receipt_hash ? { receipt_hash: String(value.receipt_hash) } : {}),
      ...(value.ethereum_anchor_tx_hash ? { ethereum_anchor_tx_hash: String(value.ethereum_anchor_tx_hash) } : {}),
      ...(value.ethereum_anchor_block ? { ethereum_anchor_block: String(value.ethereum_anchor_block) } : {}),
      ...(value.creditcoin_chain_id ? { creditcoin_chain_id: String(value.creditcoin_chain_id) } : {}),
      ...(value.creditcoin_chain_key ? { creditcoin_chain_key: String(value.creditcoin_chain_key) } : {}),
      ...(value.creditcoin_block ? { creditcoin_block: String(value.creditcoin_block) } : {}),
      ...(value.creditcoin_verified_at ? { creditcoin_verified_at: String(value.creditcoin_verified_at) } : {}),
      ...(value.creditcoin_attested_height ? { creditcoin_attested_height: String(value.creditcoin_attested_height) } : {}),
      ...(value.creditcoin_retry_at ? { creditcoin_retry_at: String(value.creditcoin_retry_at) } : {}),
      ...(value.creditcoin_proof_tx_hash ? { creditcoin_proof_tx_hash: String(value.creditcoin_proof_tx_hash) } : {}),
      ...(value.creditcoin_proof_tx_index !== null && value.creditcoin_proof_tx_index !== undefined ? { creditcoin_proof_tx_index: String(value.creditcoin_proof_tx_index) } : {}),
      ...(value.creditcoin_proof_payload_hash ? { creditcoin_proof_payload_hash: String(value.creditcoin_proof_payload_hash) } : {}),
      ...(value.creditcoin_proof_generated_at ? { creditcoin_proof_generated_at: String(value.creditcoin_proof_generated_at) } : {}),
      ...(value.creditcoin_proof_cached !== null && value.creditcoin_proof_cached !== undefined ? { creditcoin_proof_cached: Boolean(value.creditcoin_proof_cached) } : {}),
      ...(value.creditcoin_verification_method ? { creditcoin_verification_method: String(value.creditcoin_verification_method) } : {}),
      ...(process.env.OPENX_CREDITCOIN_CC3_EXPLORER_URL ? { creditcoin_explorer_url: process.env.OPENX_CREDITCOIN_CC3_EXPLORER_URL.replace(/\/$/, '') } : {}),
      attestation_status: value.attestation_status as AttestationStatus,
      ...(value.reason ? { reason: String(value.reason) } : {}), created_at: String(value.created_at), updated_at: String(value.updated_at),
    };
  }
  public get(id: string): StatementExecution | undefined {
    const row = gatewayDatabase.raw().prepare('SELECT * FROM statement_executions WHERE id=?').get(id) as Record<string, unknown> | undefined;
    return row && this.row(row);
  }
  public prepare(agentId: string, reportId: string, reportHash: string, walletAddress: string): { execution: StatementExecution; transaction: { chainId: number; to: string; data: string; value: string } } {
    if (!configured()) throw new Error('statement_execution_not_configured');
    const contract = this.contractAddress()!; const normalizedHash = normalizeHash(reportHash);
    const existing = gatewayDatabase.raw().prepare('SELECT * FROM statement_executions WHERE agent_id=? AND report_id=? AND action_id=?').get(agentId, reportId, 'statement_commitment') as Record<string, unknown> | undefined;
    if (existing) return { execution: this.row(existing), transaction: { chainId: ARBITRUM_SEPOLIA_CHAIN_ID, to: contract, data: commitmentInterface.encodeFunctionData('commit', [`0x${normalizedHash}`, keccak256(toUtf8Bytes(`statement_commitment:${reportId}`))]), value: '0x0' } };
    const now = timestamp(); const id = randomUUID(); const actionId = 'statement_commitment';
    gatewayDatabase.raw().prepare('INSERT INTO statement_executions (id,agent_id,report_id,report_hash,wallet_address,action_id,status,attestation_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id, agentId, reportId, normalizedHash, normalizeAddress(walletAddress), actionId, 'prepared', 'pending_anchor', now, now);
    const execution = this.get(id)!;
    return { execution, transaction: { chainId: ARBITRUM_SEPOLIA_CHAIN_ID, to: contract, data: commitmentInterface.encodeFunctionData('commit', [`0x${normalizedHash}`, keccak256(toUtf8Bytes(`statement_commitment:${reportId}`))]), value: '0x0' } };
  }
  public async verifyAndAnchor(id: string, txHash: string): Promise<StatementExecution> {
    const execution = this.get(id); if (!execution) throw new Error('statement_execution_not_found');
    if (!configured()) throw new Error('statement_execution_not_configured');
    if (execution.status === 'anchored' || execution.status === 'verified') return execution;
    const provider = new JsonRpcProvider(process.env.OPENX_ARBITRUM_SEPOLIA_RPC_URL);
    const [network, receipt, transaction] = await Promise.all([provider.getNetwork(), provider.getTransactionReceipt(txHash), provider.getTransaction(txHash)]);
    if (Number(network.chainId) !== ARBITRUM_SEPOLIA_CHAIN_ID) throw new Error('unexpected_arbitrum_chain');
    if (!receipt || !transaction || receipt.status !== 1) throw new Error('statement_transaction_not_confirmed');
    if (normalizeAddress(transaction.from) !== execution.wallet_address) throw new Error('statement_wallet_mismatch');
    if (normalizeAddress(transaction.to || '') !== normalizeAddress(this.contractAddress()!)) throw new Error('statement_contract_mismatch');
    const parsed = commitmentInterface.parseTransaction({ data: transaction.data, value: transaction.value });
    if (!parsed || parsed.name !== 'commit' || String(parsed.args[0]).toLowerCase() !== `0x${execution.report_hash}`) throw new Error('statement_calldata_mismatch');
    const receiptHash = keccak256(toUtf8Bytes(JSON.stringify({ execution_id: id, report_hash: execution.report_hash, arbitrum_tx_hash: txHash.toLowerCase(), arbitrum_block: String(receipt.blockNumber) })));
    this.update(id, { status: 'verified', arbitrum_tx_hash: txHash.toLowerCase(), arbitrum_block: String(receipt.blockNumber), receipt_hash: receiptHash, attestation_status: 'pending_anchor', reason: null });
    await this.anchor(id);
    return this.get(id)!;
  }
  /** Resume an asynchronous Ethereum-anchor or Creditcoin-attestation step without resending the Arbitrum transaction. */
  public async retryAttestation(id: string): Promise<StatementExecution> {
    const execution = this.get(id); if (!execution) throw new Error('statement_execution_not_found');
    if (!configured()) throw new Error('statement_execution_not_configured');
    if (!execution.receipt_hash || !execution.arbitrum_tx_hash) throw new Error('statement_execution_not_submitted');
    if (!execution.ethereum_anchor_tx_hash) await this.anchor(id);
    else if (process.env.OPENX_ATTESTCOIN_ENABLED === 'true' && (execution.attestation_status !== 'verified' || !execution.creditcoin_proof_payload_hash)) await this.verifyCreditcoin(id);
    return this.get(id)!;
  }
  /** Retry due asynchronous proofs without requiring a browser click or another wallet action. */
  public async retryDueCreditcoinAttestations(): Promise<void> {
    if (process.env.OPENX_ATTESTCOIN_ENABLED !== 'true') return;
    const due = gatewayDatabase.raw().prepare(`SELECT id FROM statement_executions
      WHERE ethereum_anchor_tx_hash IS NOT NULL
        AND ((attestation_status = 'pending_creditcoin_attestation' AND (creditcoin_retry_at IS NULL OR creditcoin_retry_at <= ?))
          OR (attestation_status = 'verified' AND creditcoin_proof_payload_hash IS NULL))
      ORDER BY updated_at ASC LIMIT 20`).all(timestamp()) as Array<{ id: string }>;
    for (const execution of due) await this.verifyCreditcoin(execution.id);
  }
  private update(id: string, values: Omit<Partial<StatementExecution>, 'reason' | 'creditcoin_retry_at' | 'creditcoin_proof_cached'> & { reason?: string | null; creditcoin_retry_at?: string | null; creditcoin_proof_cached?: boolean | null }): void {
    const allowed = ['status', 'arbitrum_tx_hash', 'arbitrum_block', 'receipt_hash', 'ethereum_anchor_tx_hash', 'ethereum_anchor_block', 'creditcoin_chain_id', 'creditcoin_chain_key', 'creditcoin_block', 'creditcoin_verified_at', 'creditcoin_attested_height', 'creditcoin_retry_at', 'creditcoin_proof_tx_hash', 'creditcoin_proof_tx_index', 'creditcoin_proof_payload_hash', 'creditcoin_proof_generated_at', 'creditcoin_proof_cached', 'creditcoin_verification_method', 'attestation_status', 'reason'] as const;
    const entries = allowed.filter((key) => key in values).map((key) => [key, values[key]] as const);
    if (!entries.length) return;
    gatewayDatabase.raw().prepare(`UPDATE statement_executions SET ${entries.map(([key]) => `${key}=?`).join(', ')}, updated_at=? WHERE id=?`).run(...entries.map(([key, value]) => key === 'creditcoin_proof_cached' && value !== null && value !== undefined ? (value ? 1 : 0) : value ?? null), timestamp(), id);
  }
  private async anchor(id: string): Promise<void> {
    const execution = this.get(id)!; const rpc = process.env.OPENX_ETHEREUM_SEPOLIA_RPC_URL; const key = process.env.OPENX_RECEIPT_ANCHOR_RELAYER_PRIVATE_KEY; const anchor = process.env.OPENX_RECEIPT_ANCHOR_CONTRACT;
    if (!rpc || !key || !anchor || !execution.receipt_hash) { this.update(id, { status: 'anchor_pending', attestation_status: 'pending_anchor' }); return; }
    try {
      const signer = new Wallet(key, new JsonRpcProvider(rpc));
      const tx = await signer.sendTransaction({ to: anchor, data: anchorInterface.encodeFunctionData('anchor', [execution.receipt_hash]) });
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error('receipt_anchor_not_confirmed');
      this.update(id, { status: 'anchored', ethereum_anchor_tx_hash: tx.hash, ethereum_anchor_block: String(receipt.blockNumber), attestation_status: process.env.OPENX_ATTESTCOIN_ENABLED === 'true' ? 'pending_creditcoin_attestation' : 'unavailable' });
      if (process.env.OPENX_ATTESTCOIN_ENABLED === 'true') await this.verifyCreditcoin(id);
    } catch (error) { this.update(id, { status: 'anchor_pending', attestation_status: 'failed', reason: error instanceof Error ? error.message : 'receipt_anchor_failed' }); }
  }
  private async verifyCreditcoin(id: string): Promise<void> {
    const execution = this.get(id)!;
    const creditcoinRpc = process.env.OPENX_CREDITCOIN_CC3_TESTNET_RPC_URL;
    const proverUrl = process.env.OPENX_ATTESTCOIN_PROVER_URL;
    if (!creditcoinRpc || !proverUrl || !execution.ethereum_anchor_tx_hash) return;
    try {
      const source = new JsonRpcProvider(process.env.OPENX_ETHEREUM_SEPOLIA_RPC_URL);
      const transaction = await source.getTransaction(execution.ethereum_anchor_tx_hash);
      if (!transaction?.blockNumber) return;
      const creditcoin = new JsonRpcProvider(creditcoinRpc);
      // usc-sdk currently bundles a newer ethers type than the Gateway. Both expose the same JsonRpcApiProvider runtime contract.
      const chains = await new chainInfo.PrecompileChainInfoProvider(creditcoin as never).getSupportedChains();
      const ethereum = chains.find((chain) => chain.chainId === 11155111);
      if (!ethereum) { this.update(id, { attestation_status: 'failed', reason: 'creditcoin_ethereum_sepolia_not_supported' }); return; }
      const latest = await this.proofBuilderHeight(proverUrl, ethereum.chainKey);
      if (latest === undefined || latest < transaction.blockNumber) {
        const availability = latest === undefined ? 'status is temporarily unavailable' : `cache is at block ${latest}`;
        this.update(id, {
          attestation_status: 'pending_creditcoin_attestation',
          ...(latest === undefined ? {} : { creditcoin_attested_height: String(latest) }),
          creditcoin_retry_at: new Date(Date.now() + CREDITCOIN_RETRY_DELAY_MS).toISOString(),
          reason: `Waiting for Attestcoin proof builder: Ethereum Sepolia block ${transaction.blockNumber} is anchored; ${availability}. Gateway retries automatically.`,
        });
        return;
      }
      const builder = new proofProvider.service.ProofBuilder(ethereum.chainKey, proverUrl, 10_000);
      const proof = await builder.getProof(execution.ethereum_anchor_tx_hash);
      if (!proof.success || !proof.data) {
        this.update(id, { attestation_status: 'pending_creditcoin_attestation', creditcoin_attested_height: String(latest), creditcoin_retry_at: new Date(Date.now() + CREDITCOIN_RETRY_DELAY_MS).toISOString(), reason: 'Attestcoin proof is not available from the builder yet. Gateway retries automatically.' });
        return;
      }
      if (proof.data.txHash.toLowerCase() !== execution.ethereum_anchor_tx_hash.toLowerCase()) {
        this.update(id, { attestation_status: 'failed', reason: 'attestcoin_proof_transaction_mismatch' });
        return;
      }
      const verified = await new blockProver.PrecompileBlockProver(creditcoin as never).verifySingle(proof.data.chainKey, proof.data.headerNumber, proof.data.txBytes, proof.data.merkleProof, proof.data.continuityProof);
      if (verified) {
        const network = await creditcoin.getNetwork();
        const proofGeneratedAt = proof.data.generatedAt instanceof Date ? proof.data.generatedAt.toISOString() : new Date(String(proof.data.generatedAt)).toISOString();
        const proofPayloadHash = keccak256(toUtf8Bytes(JSON.stringify(proof.data)));
        this.update(id, {
          attestation_status: 'verified', creditcoin_chain_id: String(network.chainId), creditcoin_chain_key: String(proof.data.chainKey), creditcoin_block: String(proof.data.headerNumber),
          creditcoin_attested_height: String(latest), creditcoin_verified_at: timestamp(), creditcoin_retry_at: null,
          creditcoin_proof_tx_hash: proof.data.txHash.toLowerCase(), creditcoin_proof_tx_index: String(proof.data.txIndex), creditcoin_proof_payload_hash: proofPayloadHash,
          creditcoin_proof_generated_at: proofGeneratedAt, creditcoin_proof_cached: proof.data.cached, creditcoin_verification_method: 'creditcoin_usc_precompile_verify_single_v1', reason: null,
        });
      }
    } catch (error) {
      // Attestation is asynchronous. Preserve pending state for a safe later retry unless configuration is invalid.
      const message = error instanceof Error ? error.message : 'creditcoin_proof_pending';
      this.update(id, { attestation_status: 'pending_creditcoin_attestation', creditcoin_retry_at: new Date(Date.now() + CREDITCOIN_RETRY_DELAY_MS).toISOString(), reason: `Creditcoin proof check is pending: ${message.slice(0, 400)}` });
    }
  }
  private async proofBuilderHeight(proverUrl: string, chainKey: number): Promise<number | undefined> {
    const response = await fetch(`${proverUrl.replace(/\/$/, '')}/api/v1/attested-height/${chainKey}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`proof_builder_status_${response.status}`);
    const body = await response.json() as { attestedHeight?: unknown };
    return typeof body.attestedHeight === 'number' && Number.isSafeInteger(body.attestedHeight) && body.attestedHeight >= 0 ? body.attestedHeight : undefined;
  }
}

export const statementExecution = new StatementExecutionService();
