import { Interface, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from 'ethers';
import { randomUUID } from 'node:crypto';
import { blockProver, chainInfo, proofProvider } from '@gluwa/usc-sdk';
import { gatewayDatabase } from '../db/database.js';

const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
const commitmentInterface = new Interface(['function commit(bytes32 reportHash, bytes32 actionId)', 'event StatementCommitted(bytes32 indexed reportHash, bytes32 indexed actionId, address indexed committer)']);
const anchorInterface = new Interface(['function anchor(bytes32 receiptHash)', 'event ReceiptAnchored(bytes32 indexed receiptHash, address indexed relayer)']);

export type ExecutionStatus = 'prepared' | 'submitted' | 'verified' | 'anchor_pending' | 'anchored' | 'failed';
export type AttestationStatus = 'pending_anchor' | 'pending_creditcoin_attestation' | 'verified' | 'unavailable' | 'failed';
export interface StatementExecution {
  id: string; agent_id: string; report_id: string; report_hash: string; wallet_address: string;
  action_id: string; status: ExecutionStatus; arbitrum_tx_hash?: string; arbitrum_block?: string;
  receipt_hash?: string; ethereum_anchor_tx_hash?: string; ethereum_anchor_block?: string;
  creditcoin_chain_id?: string; creditcoin_block?: string; creditcoin_verified_at?: string; creditcoin_explorer_url?: string;
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
      creditcoin_chain_id TEXT, creditcoin_block TEXT, creditcoin_verified_at TEXT, attestation_status TEXT NOT NULL,
      reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(agent_id, report_id, action_id));
      CREATE INDEX IF NOT EXISTS statement_executions_agent_updated ON statement_executions(agent_id, updated_at DESC);`);
    const columns = new Set((gatewayDatabase.raw().prepare('PRAGMA table_info(statement_executions)').all() as { name: string }[]).map((column) => column.name));
    for (const [name, definition] of Object.entries({ ethereum_anchor_block: 'TEXT', creditcoin_chain_id: 'TEXT', creditcoin_block: 'TEXT', creditcoin_verified_at: 'TEXT' })) {
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
      ...(value.creditcoin_block ? { creditcoin_block: String(value.creditcoin_block) } : {}),
      ...(value.creditcoin_verified_at ? { creditcoin_verified_at: String(value.creditcoin_verified_at) } : {}),
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
    else if (process.env.OPENX_ATTESTCOIN_ENABLED === 'true' && execution.attestation_status !== 'verified') await this.verifyCreditcoin(id);
    return this.get(id)!;
  }
  private update(id: string, values: Omit<Partial<StatementExecution>, 'reason'> & { reason?: string | null }): void {
    const allowed = ['status', 'arbitrum_tx_hash', 'arbitrum_block', 'receipt_hash', 'ethereum_anchor_tx_hash', 'ethereum_anchor_block', 'creditcoin_chain_id', 'creditcoin_block', 'creditcoin_verified_at', 'attestation_status', 'reason'] as const;
    const entries = allowed.filter((key) => key in values).map((key) => [key, values[key]] as const);
    if (!entries.length) return;
    gatewayDatabase.raw().prepare(`UPDATE statement_executions SET ${entries.map(([key]) => `${key}=?`).join(', ')}, updated_at=? WHERE id=?`).run(...entries.map(([, value]) => value ?? null), timestamp(), id);
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
      const builder = new proofProvider.service.ProofBuilder(ethereum.chainKey, proverUrl, 10_000);
      // A short bounded wait makes submission non-blocking; a later submit/retry can continue pending records.
      await builder.waitUntilHeightAttested(ethereum.chainKey, transaction.blockNumber, 2_000, 10_000);
      const proof = await builder.getProof(execution.ethereum_anchor_tx_hash);
      if (!proof.success || !proof.data) return;
      const verified = await new blockProver.PrecompileBlockProver(creditcoin as never).verifySingle(proof.data.chainKey, proof.data.headerNumber, proof.data.txBytes, proof.data.merkleProof, proof.data.continuityProof);
      if (verified) {
        const network = await creditcoin.getNetwork();
        this.update(id, { attestation_status: 'verified', creditcoin_chain_id: String(network.chainId), creditcoin_block: String(proof.data.headerNumber), creditcoin_verified_at: timestamp(), reason: null });
      }
    } catch (error) {
      // Attestation is asynchronous. Preserve pending state for a safe later retry unless configuration is invalid.
      const message = error instanceof Error ? error.message : 'creditcoin_proof_pending';
      this.update(id, { attestation_status: 'pending_creditcoin_attestation', reason: message.slice(0, 500) });
    }
  }
}

export const statementExecution = new StatementExecutionService();
