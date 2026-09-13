import { Interface, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';
import { randomUUID } from 'node:crypto';
import { gatewayDatabase } from '../db/database.js';

const CHAIN_ID = 421614;
const allocationInterface = new Interface(['function allocateToMorpho((uint256 usdcCollateralAmount,bytes32 reportHash) request,(bool usePermit2,((address token,uint256 amount) permitted,uint256 nonce,uint256 deadline) permit,bytes signature) permitData)', 'event AllocatedToMorpho(address indexed user,bytes32 indexed reportHash,bytes32 indexed marketId,uint256 usdcCollateralSupplied)']);
const erc20Interface = new Interface(['function allowance(address owner,address spender) view returns (uint256)', 'function approve(address spender,uint256 amount) returns (bool)']);
const now = () => new Date().toISOString();
const address = (value: string) => value.toLowerCase();
const env = (name: string) => process.env[name]?.trim();

export interface AllocationExecution { id: string; agent_id: string; report_id: string; report_hash: string; wallet_address: string; usdc_collateral_amount: string; status: 'prepared' | 'submitted' | 'verified' | 'failed'; permit_mode: 'permit2' | 'approval'; transaction?: { chainId: number; to: string; data: string; value: string }; arbitrum_tx_hash?: string; arbitrum_block?: string; receipt_hash?: string; reason?: string; created_at: string; updated_at: string; }

const configured = () => Boolean(env('OPENX_ALLOCATION_ENABLED') === 'true' && env('OPENX_ARBITRUM_SEPOLIA_RPC_URL') && env('OPENX_ALLOCATION_ZAP') && env('OPENX_ALLOCATION_USDC_TOKEN'));
const uint = (value: string, key: string) => { if (!/^\d+$/.test(value) || BigInt(value) <= 0n) throw new Error(`invalid_${key}`); return value; };

class AllocationExecutionService {
  constructor() { gatewayDatabase.raw().exec(`CREATE TABLE IF NOT EXISTS allocation_executions (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, report_id TEXT NOT NULL, report_hash TEXT NOT NULL, wallet_address TEXT NOT NULL, source_amount TEXT NOT NULL, min_collateral_amount TEXT NOT NULL, permit_mode TEXT NOT NULL, status TEXT NOT NULL, transaction_json TEXT NOT NULL, arbitrum_tx_hash TEXT, arbitrum_block TEXT, receipt_hash TEXT, reason TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(agent_id, report_id, wallet_address, source_amount)); CREATE INDEX IF NOT EXISTS allocation_executions_agent_updated ON allocation_executions(agent_id, updated_at DESC);`); }
  public isConfigured() { return configured(); }
  private row(value: Record<string, unknown>): AllocationExecution { return { id: String(value.id), agent_id: String(value.agent_id), report_id: String(value.report_id), report_hash: String(value.report_hash), wallet_address: String(value.wallet_address), usdc_collateral_amount: String(value.source_amount), permit_mode: value.permit_mode as 'permit2' | 'approval', status: value.status as AllocationExecution['status'], transaction: JSON.parse(String(value.transaction_json)), ...(value.arbitrum_tx_hash ? { arbitrum_tx_hash: String(value.arbitrum_tx_hash) } : {}), ...(value.arbitrum_block ? { arbitrum_block: String(value.arbitrum_block) } : {}), ...(value.receipt_hash ? { receipt_hash: String(value.receipt_hash) } : {}), ...(value.reason ? { reason: String(value.reason) } : {}), created_at: String(value.created_at), updated_at: String(value.updated_at) }; }
  public get(id: string) { const row = gatewayDatabase.raw().prepare('SELECT * FROM allocation_executions WHERE id=?').get(id) as Record<string, unknown> | undefined; return row && this.row(row); }
  public latest(agentId: string, reportId: string) { const row = gatewayDatabase.raw().prepare('SELECT * FROM allocation_executions WHERE agent_id=? AND report_id=? ORDER BY updated_at DESC LIMIT 1').get(agentId, reportId) as Record<string, unknown> | undefined; return row && this.row(row); }
  public async prepare(agentId: string, reportId: string, reportHash: string, walletAddress: string, usdcCollateralAmount: string) {
    if (!configured()) throw new Error('allocation_execution_not_configured');
    uint(usdcCollateralAmount, 'usdc_collateral_amount');
    const zap = env('OPENX_ALLOCATION_ZAP')!; const usdc = env('OPENX_ALLOCATION_USDC_TOKEN')!;
    const provider = new JsonRpcProvider(env('OPENX_ARBITRUM_SEPOLIA_RPC_URL'));
    const allowance = await provider.call({ to: usdc, data: erc20Interface.encodeFunctionData('allowance', [walletAddress, zap]) });
    const hasAllowance = BigInt(erc20Interface.decodeFunctionResult('allowance', allowance)[0]) >= BigInt(usdcCollateralAmount);
    const reportHashBytes = `0x${reportHash.replace(/^0x/, '')}`;
    const transaction = { chainId: CHAIN_ID, to: zap, data: allocationInterface.encodeFunctionData('allocateToMorpho', [{ usdcCollateralAmount, reportHash: reportHashBytes }, { usePermit2: false, permit: { permitted: { token: usdc, amount: '0' }, nonce: 0, deadline: 0 }, signature: '0x' }]), value: '0x0' };
    const existing = gatewayDatabase.raw().prepare('SELECT * FROM allocation_executions WHERE agent_id=? AND report_id=? AND wallet_address=? AND source_amount=?').get(agentId, reportId, address(walletAddress), usdcCollateralAmount) as Record<string, unknown> | undefined;
    const approvalTransaction = !hasAllowance ? { chainId: CHAIN_ID, to: usdc, data: erc20Interface.encodeFunctionData('approve', [zap, usdcCollateralAmount]), value: '0x0' } : undefined;
    if (existing) return { execution: this.row(existing), approval_required: !hasAllowance, ...(approvalTransaction ? { approval_transaction: approvalTransaction } : {}) };
    const id = randomUUID(); gatewayDatabase.raw().prepare('INSERT INTO allocation_executions (id,agent_id,report_id,report_hash,wallet_address,source_amount,min_collateral_amount,permit_mode,status,transaction_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id, agentId, reportId, reportHash.replace(/^0x/, '').toLowerCase(), address(walletAddress), usdcCollateralAmount, usdcCollateralAmount, 'approval', 'prepared', JSON.stringify(transaction), now(), now());
    return { execution: this.get(id)!, approval_required: !hasAllowance, ...(approvalTransaction ? { approval_transaction: approvalTransaction } : {}) };
  }
  public async submit(id: string, transactionHash: string) {
    const execution = this.get(id); if (!execution) throw new Error('allocation_execution_not_found'); if (!configured()) throw new Error('allocation_execution_not_configured');
    const provider = new JsonRpcProvider(env('OPENX_ARBITRUM_SEPOLIA_RPC_URL')); const [network, receipt, transaction] = await Promise.all([provider.getNetwork(), provider.getTransactionReceipt(transactionHash), provider.getTransaction(transactionHash)]);
    if (Number(network.chainId) !== CHAIN_ID) throw new Error('unexpected_arbitrum_chain'); if (!receipt || !transaction || receipt.status !== 1) throw new Error('allocation_transaction_not_confirmed'); if (address(transaction.from) !== execution.wallet_address || address(transaction.to || '') !== address(env('OPENX_ALLOCATION_ZAP')!)) throw new Error('allocation_transaction_mismatch');
    const parsed = allocationInterface.parseTransaction({ data: transaction.data, value: transaction.value }); const request = parsed?.args.request as { reportHash?: string; usdcCollateralAmount?: bigint } | undefined; if (!parsed || parsed.name !== 'allocateToMorpho' || String(request?.reportHash).toLowerCase() !== `0x${execution.report_hash}` || String(request?.usdcCollateralAmount) !== execution.usdc_collateral_amount) throw new Error('allocation_calldata_mismatch');
    const receiptHash = keccak256(toUtf8Bytes(JSON.stringify({ execution_id: id, report_hash: execution.report_hash, arbitrum_tx_hash: transactionHash.toLowerCase(), arbitrum_block: String(receipt.blockNumber) }))); gatewayDatabase.raw().prepare('UPDATE allocation_executions SET status=?,arbitrum_tx_hash=?,arbitrum_block=?,receipt_hash=?,reason=NULL,updated_at=? WHERE id=?').run('verified', transactionHash.toLowerCase(), String(receipt.blockNumber), receiptHash, now(), id); console.info('SEAM:ZAP:ALLOCATION_RECEIPT_VERIFIED'); return this.get(id)!;
  }
}
export const allocationExecution = new AllocationExecutionService();
