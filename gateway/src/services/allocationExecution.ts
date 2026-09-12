import { Interface, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';
import { randomUUID } from 'node:crypto';
import { gatewayDatabase } from '../db/database.js';

const CHAIN_ID = 421614;
const allocationInterface = new Interface(['function allocateToMorpho((uint256 sourceAmount,uint256 minCollateralAmount,uint256 deadline,bytes32 reportHash,bytes routerCalldata) request,(bool usePermit2,((address token,uint256 amount),uint256 nonce,uint256 deadline) permit,bytes signature) permitData)', 'event AllocatedToMorpho(address indexed user,bytes32 indexed reportHash,bytes32 indexed marketId,uint256 sourceAmount,uint256 collateralSupplied)']);
const erc20Interface = new Interface(['function allowance(address owner,address spender) view returns (uint256)']);
const now = () => new Date().toISOString();
const address = (value: string) => value.toLowerCase();
const env = (name: string) => process.env[name]?.trim();

export interface AllocationExecution { id: string; agent_id: string; report_id: string; report_hash: string; wallet_address: string; source_amount: string; min_collateral_amount: string; status: 'prepared' | 'submitted' | 'verified' | 'failed'; permit_mode: 'permit2' | 'approval'; transaction?: { chainId: number; to: string; data: string; value: string }; arbitrum_tx_hash?: string; arbitrum_block?: string; receipt_hash?: string; reason?: string; created_at: string; updated_at: string; }
type Quote = { tx?: { to?: string; data?: string }; dstAmount?: string; toTokenAmount?: string; deadline?: number };

const configured = () => Boolean(env('OPENX_ALLOCATION_ENABLED') === 'true' && env('OPENX_ARBITRUM_SEPOLIA_RPC_URL') && env('OPENX_ALLOCATION_ZAP') && env('OPENX_ALLOCATION_SOURCE_TOKEN') && env('OPENX_ALLOCATION_COLLATERAL_TOKEN') && env('OPENX_ONEINCH_SWAP_URL') && env('OPENX_ONEINCH_API_KEY'));
const uint = (value: string, key: string) => { if (!/^\d+$/.test(value) || BigInt(value) <= 0n) throw new Error(`invalid_${key}`); return value; };

class AllocationExecutionService {
  constructor() { gatewayDatabase.raw().exec(`CREATE TABLE IF NOT EXISTS allocation_executions (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, report_id TEXT NOT NULL, report_hash TEXT NOT NULL, wallet_address TEXT NOT NULL, source_amount TEXT NOT NULL, min_collateral_amount TEXT NOT NULL, permit_mode TEXT NOT NULL, status TEXT NOT NULL, transaction_json TEXT NOT NULL, arbitrum_tx_hash TEXT, arbitrum_block TEXT, receipt_hash TEXT, reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(agent_id, report_id, wallet_address, source_amount)); CREATE INDEX IF NOT EXISTS allocation_executions_agent_updated ON allocation_executions(agent_id, updated_at DESC);`); }
  public isConfigured() { return configured(); }
  private row(value: Record<string, unknown>): AllocationExecution { return { id: String(value.id), agent_id: String(value.agent_id), report_id: String(value.report_id), report_hash: String(value.report_hash), wallet_address: String(value.wallet_address), source_amount: String(value.source_amount), min_collateral_amount: String(value.min_collateral_amount), permit_mode: value.permit_mode as 'permit2' | 'approval', status: value.status as AllocationExecution['status'], transaction: JSON.parse(String(value.transaction_json)), ...(value.arbitrum_tx_hash ? { arbitrum_tx_hash: String(value.arbitrum_tx_hash) } : {}), ...(value.arbitrum_block ? { arbitrum_block: String(value.arbitrum_block) } : {}), ...(value.receipt_hash ? { receipt_hash: String(value.receipt_hash) } : {}), ...(value.reason ? { reason: String(value.reason) } : {}), created_at: String(value.created_at), updated_at: String(value.updated_at) }; }
  public get(id: string) { const row = gatewayDatabase.raw().prepare('SELECT * FROM allocation_executions WHERE id=?').get(id) as Record<string, unknown> | undefined; return row && this.row(row); }
  public latest(agentId: string, reportId: string) { const row = gatewayDatabase.raw().prepare('SELECT * FROM allocation_executions WHERE agent_id=? AND report_id=? ORDER BY updated_at DESC LIMIT 1').get(agentId, reportId) as Record<string, unknown> | undefined; return row && this.row(row); }
  public async prepare(agentId: string, reportId: string, reportHash: string, walletAddress: string, sourceAmount: string, slippageBps: number) {
    if (!configured()) throw new Error('allocation_execution_not_configured');
    uint(sourceAmount, 'source_amount'); if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > 500) throw new Error('invalid_slippage_bps');
    const zap = env('OPENX_ALLOCATION_ZAP')!; const source = env('OPENX_ALLOCATION_SOURCE_TOKEN')!; const collateral = env('OPENX_ALLOCATION_COLLATERAL_TOKEN')!;
    const provider = new JsonRpcProvider(env('OPENX_ARBITRUM_SEPOLIA_RPC_URL'));
    const allowance = await provider.call({ to: source, data: erc20Interface.encodeFunctionData('allowance', [walletAddress, zap]) });
    const hasAllowance = BigInt(erc20Interface.decodeFunctionResult('allowance', allowance)[0]) >= BigInt(sourceAmount);
    const query = new URL(env('OPENX_ONEINCH_SWAP_URL')!); query.searchParams.set('src', source); query.searchParams.set('dst', collateral); query.searchParams.set('amount', sourceAmount); query.searchParams.set('from', zap); query.searchParams.set('receiver', zap); query.searchParams.set('disableEstimate', 'true');
    const response = await fetch(query, { headers: { Authorization: `Bearer ${env('OPENX_ONEINCH_API_KEY')!}` }, signal: AbortSignal.timeout(12_000) }); const quote = await response.json().catch(() => null) as Quote | null;
    if (!response.ok || !quote?.tx?.data || address(quote.tx.to || '') !== address(env('OPENX_ONEINCH_ROUTER') || '')) throw new Error('oneinch_quote_invalid');
    console.info('SEAM:1INCH:SWAP_QUOTE_RECEIVED');
    const output = uint(String(quote.dstAmount || quote.toTokenAmount || ''), 'quote_output'); const minimum = (BigInt(output) * BigInt(10_000 - slippageBps) / 10_000n).toString(); const deadline = Math.floor(Date.now() / 1000) + 120;
    const reportHashBytes = `0x${reportHash.replace(/^0x/, '')}`; const transaction = { chainId: CHAIN_ID, to: zap, data: allocationInterface.encodeFunctionData('allocateToMorpho', [{ sourceAmount, minCollateralAmount: minimum, deadline, reportHash: reportHashBytes, routerCalldata: quote.tx.data }, { usePermit2: false, permit: { permitted: { token: source, amount: '0' }, nonce: 0, deadline: 0 }, signature: '0x' }]), value: '0x0' };
    const existing = gatewayDatabase.raw().prepare('SELECT * FROM allocation_executions WHERE agent_id=? AND report_id=? AND wallet_address=? AND source_amount=?').get(agentId, reportId, address(walletAddress), sourceAmount) as Record<string, unknown> | undefined;
    if (existing) return { execution: this.row(existing), approval_required: !hasAllowance };
    const id = randomUUID(); gatewayDatabase.raw().prepare('INSERT INTO allocation_executions (id,agent_id,report_id,report_hash,wallet_address,source_amount,min_collateral_amount,permit_mode,status,transaction_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id, agentId, reportId, reportHash.replace(/^0x/, '').toLowerCase(), address(walletAddress), sourceAmount, minimum, 'approval', 'prepared', JSON.stringify(transaction), now(), now());
    return { execution: this.get(id)!, approval_required: !hasAllowance };
  }
  public async submit(id: string, transactionHash: string) {
    const execution = this.get(id); if (!execution) throw new Error('allocation_execution_not_found'); if (!configured()) throw new Error('allocation_execution_not_configured');
    const provider = new JsonRpcProvider(env('OPENX_ARBITRUM_SEPOLIA_RPC_URL')); const [network, receipt, transaction] = await Promise.all([provider.getNetwork(), provider.getTransactionReceipt(transactionHash), provider.getTransaction(transactionHash)]);
    if (Number(network.chainId) !== CHAIN_ID) throw new Error('unexpected_arbitrum_chain'); if (!receipt || !transaction || receipt.status !== 1) throw new Error('allocation_transaction_not_confirmed'); if (address(transaction.from) !== execution.wallet_address || address(transaction.to || '') !== address(env('OPENX_ALLOCATION_ZAP')!)) throw new Error('allocation_transaction_mismatch');
    const parsed = allocationInterface.parseTransaction({ data: transaction.data, value: transaction.value }); const request = parsed?.args.request as { reportHash?: string; sourceAmount?: bigint; minCollateralAmount?: bigint } | undefined; if (!parsed || parsed.name !== 'allocateToMorpho' || String(request?.reportHash).toLowerCase() !== `0x${execution.report_hash}` || String(request?.sourceAmount) !== execution.source_amount || String(request?.minCollateralAmount) !== execution.min_collateral_amount) throw new Error('allocation_calldata_mismatch');
    const receiptHash = keccak256(toUtf8Bytes(JSON.stringify({ execution_id: id, report_hash: execution.report_hash, arbitrum_tx_hash: transactionHash.toLowerCase(), arbitrum_block: String(receipt.blockNumber) }))); gatewayDatabase.raw().prepare('UPDATE allocation_executions SET status=?,arbitrum_tx_hash=?,arbitrum_block=?,receipt_hash=?,reason=NULL,updated_at=? WHERE id=?').run('verified', transactionHash.toLowerCase(), String(receipt.blockNumber), receiptHash, now(), id); console.info('SEAM:ZAP:ALLOCATION_RECEIPT_VERIFIED'); return this.get(id)!;
  }
}
export const allocationExecution = new AllocationExecutionService();
