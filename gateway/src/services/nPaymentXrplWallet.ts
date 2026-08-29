import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

export interface NPaymentReceipt {
  transaction_hash: string;
  validated: boolean;
}

type RpcResponse = {
  result?: { content?: Array<{ text?: string }>; isError?: boolean };
  error?: { message?: string };
};

/**
 * Local-only bridge to n-payment's MCP stdio server. The XRPL seed remains in
 * the device environment used by n-payment and is never copied into Gateway
 * state, requests, responses, or logs.
 */
export class NPaymentXrplWallet {
  private signerSeed(): string | undefined {
    const fromEnv = process.env.XRPL_SEED?.trim() || process.env.NIM_XRPL_TEST_SEED?.trim();
    if (fromEnv) return fromEnv;
    const seedFile = resolve(homedir(), '.n-payment/xrpl-seed.txt');
    if (existsSync(seedFile)) {
      try {
        return readFileSync(seedFile, 'utf8').trim();
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  public isConfigured(): boolean {
    return process.env.OPENX_XRPL_SETTLEMENT_ENABLED === 'true'
      && Boolean(process.env.OPENX_NPAYMENT_BIN?.trim())
      && Boolean(this.signerSeed());
  }

  public async payRlusd(destination: string, amount: string, nonce: string): Promise<NPaymentReceipt> {
    if (!this.isConfigured()) throw new Error('n_payment_xrpl_wallet_not_configured');
    const binary = process.env.OPENX_NPAYMENT_BIN!.trim();
    const response = await this.call(binary, 'tools/call', {
      name: 'xrpl_pay',
      arguments: { destination, amount, chain: 'xrpl-testnet', memo: nonce },
    });
    if (response.error || response.result?.isError) throw new Error(response.error?.message || 'n_payment_xrpl_payment_failed');
    const text = response.result?.content?.[0]?.text;
    const payload = text ? JSON.parse(text) as { ok?: boolean; data?: { hash?: string; validated?: boolean } } : undefined;
    const hash = payload?.data?.hash;
    if (!payload?.ok || !hash || !/^[A-Fa-f0-9]{64}$/.test(hash)) throw new Error('n_payment_invalid_payment_receipt');
    return { transaction_hash: hash, validated: payload.data?.validated === true };
  }

  private async call(binary: string, method: string, params: Record<string, unknown>): Promise<RpcResponse> {
    return new Promise((resolve, reject) => {
      const child = spawn(binary, ['mcp', '--stdio'], {
        stdio: ['pipe', 'pipe', 'ignore'],
        env: { ...process.env, XRPL_SEED: this.signerSeed() },
      });
      let buffer = '';
      const timer = setTimeout(() => { child.kill(); reject(new Error('n_payment_timeout')); }, 20_000);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const newline = buffer.indexOf('\n');
        if (newline < 0) return;
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        try { clearTimeout(timer); child.kill(); resolve(JSON.parse(line) as RpcResponse); } catch { clearTimeout(timer); child.kill(); reject(new Error('n_payment_invalid_rpc_response')); }
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })}\n`);
    });
  }
}

export const nPaymentXrplWallet = new NPaymentXrplWallet();
