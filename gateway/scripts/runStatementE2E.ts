import { JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from 'ethers';
import { statementExecution } from '../src/services/statementExecution.js';

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const main = async (): Promise<void> => {
  const wallet = new Wallet(requireEnv('OPENX_DEPLOYER_KEY'));
  const reportId = process.env.OPENX_E2E_REPORT_ID || `statement-e2e-${Date.now()}`;
  const reportHash = keccak256(toUtf8Bytes(`openx testnet e2e statement:${reportId}`));
  const prepared = statementExecution.prepare('testnet-e2e', reportId, reportHash, wallet.address);
  const transaction = await wallet.connect(new JsonRpcProvider(requireEnv('OPENX_ARBITRUM_SEPOLIA_RPC_URL'))).sendTransaction(prepared.transaction);
  await transaction.wait();
  let execution = await statementExecution.verifyAndAnchor(prepared.execution.id, transaction.hash);
  if (execution.attestation_status === 'pending_creditcoin_attestation') execution = await statementExecution.retryAttestation(execution.id);
  console.log(JSON.stringify({
    id: execution.id, status: execution.status, attestation_status: execution.attestation_status,
    arbitrum_tx_hash: execution.arbitrum_tx_hash, ethereum_anchor_tx_hash: execution.ethereum_anchor_tx_hash,
    reason: execution.reason ?? null,
  }, null, 2));
};

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });
