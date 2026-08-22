/**
 * server.ts — Phase 1 skeleton for the OpenX gateway sidecar.
 *
 * Implements PRD §6 Phase 1's environment-setup scope only. The real
 * Phase-2 route (`/v1/supplier/defi`, wrapping HyperMove MCP + n-payment's
 * XRPL x402 settlement + nim-skill's workrule verification per PRD §5) is
 * explicitly a 501 stub below — not faked as a working payment flow.
 *
 * TODO (Phase 2, PRD §6 Days 5-8):
 *   1. Import HyperMove MCP client + n-payment's x402 adapter + nim-skill's
 *      runHarnessed()/verifyOrHeal() — all real npm packages already used
 *      elsewhere in this workspace (see ../../../.kiro/steering/
 *      hypermove-mcp-xrpl.md for the MCP architecture reference).
 *   2. Wire the real 402 challenge (PRD §4.3 shape, echoed below as the
 *      documented target response) behind this route once n-payment's
 *      XRPL testnet settlement is actually called.
 */
import express from 'express';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 7411;

app.get('/health', (_req, res) => {
  res.json({ ok: true, phase: 1, service: 'openx-deep-research-analyst-gateway' });
});

/**
 * PRD §4.1 capability: analytics.fetch_premium_feed
 *
 * Phase 1: returns 501 with the exact PRD §4.3 challenge shape documented
 * in the response body as `intended_402_shape` — so a caller can see what
 * this route WILL return once Phase 2 wires the real x402 settlement,
 * without this stub ever claiming a payment flow that doesn't exist yet.
 */
app.get('/v1/supplier/defi', (req, res) => {
  res.status(501).json({
    ok: false,
    phase: 1,
    error: 'not_implemented',
    message:
      'Phase 2 (HyperMove MCP + n-payment XRPL x402 + nim-skill verification) is not yet wired. See PRD §6 Days 5-8.',
    requested_feed_id: req.query.feedId ?? null,
    intended_402_shape: {
      status: 402,
      headers: {
        'WWW-Authenticate':
          'x402 address="rLusdWalletAddressXYZ", amount="0.05", currency="RLUSD", network="xrpl-testnet"',
      },
    },
  });
});

app.listen(PORT, () => {
  console.log(`[openx-deep-research-analyst-gateway] Phase 1 skeleton listening on :${PORT}`);
});
