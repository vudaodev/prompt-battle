import type { VercelRequest } from '@vercel/node';

/**
 * True when the request comes from our own deployed site (same host) or an
 * explicitly allowed origin. Blocks anonymous curl/cross-site abuse of the
 * server-side API keys.
 *
 * The proxy routes are POST-only, so browsers always send an `Origin` header
 * (cross-origin and same-origin alike). A missing Origin therefore means a
 * non-browser client and is rejected. `ALLOWED_ORIGIN` is an optional escape
 * hatch for a separate custom domain.
 */
export function sameOriginOk(req: VercelRequest): boolean {
  const origin = req.headers.origin;
  if (!origin) return false; // non-browser client → reject
  const host = req.headers.host ?? '';
  const allowed = process.env.ALLOWED_ORIGIN;
  try {
    return new URL(origin).host === host || origin === allowed;
  } catch {
    return false;
  }
}
