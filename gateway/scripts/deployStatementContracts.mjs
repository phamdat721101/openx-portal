import { readFile } from 'node:fs/promises';
import path from 'node:path';
import solc from 'solc';
import { ContractFactory, JsonRpcProvider, Wallet } from 'ethers';

const root = path.resolve(import.meta.dirname, '../..');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function compile(filename, contractName) {
  const source = await readFile(path.join(root, 'contracts', filename), 'utf8');
  const output = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity', sources: { [filename]: { content: source } },
    settings: { optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
  })));
  const errors = output.errors?.filter((item) => item.severity === 'error') ?? [];
  if (errors.length) throw new Error(errors.map((item) => item.formattedMessage).join('\n'));
  const artifact = output.contracts[filename]?.[contractName];
  if (!artifact?.evm?.bytecode?.object) throw new Error(`missing compiled artifact for ${contractName}`);
  return { abi: artifact.abi, bytecode: `0x${artifact.evm.bytecode.object}` };
}

async function deploy(providerUrl, artifact, signer, args = []) {
  const signerWithProvider = signer.connect(new JsonRpcProvider(providerUrl));
  const contract = await new ContractFactory(artifact.abi, artifact.bytecode, signerWithProvider).deploy(...args);
  const receipt = await contract.deploymentTransaction().wait();
  if (!receipt || receipt.status !== 1) throw new Error('deployment transaction did not succeed');
  return { address: await contract.getAddress(), transactionHash: receipt.hash, blockNumber: receipt.blockNumber };
}

const deployer = new Wallet(requireEnv('OPENX_DEPLOYER_KEY'));
const [registryArtifact, anchorArtifact] = await Promise.all([
  compile('StatementCommitmentRegistry.sol', 'StatementCommitmentRegistry'),
  compile('ReceiptAnchor.sol', 'ReceiptAnchor'),
]);
const [registry, anchor] = await Promise.all([
  deploy(requireEnv('OPENX_ARBITRUM_SEPOLIA_RPC_URL'), registryArtifact, deployer),
  deploy(requireEnv('OPENX_ETHEREUM_SEPOLIA_RPC_URL'), anchorArtifact, deployer, [deployer.address]),
]);
console.log(JSON.stringify({ deployer: deployer.address, arbitrumSepolia: { chainId: 421614, statementCommitmentRegistry: registry }, ethereumSepolia: { chainId: 11155111, receiptAnchor: anchor } }, null, 2));
