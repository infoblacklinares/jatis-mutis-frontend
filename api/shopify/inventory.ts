import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY, publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY });
type Claims = { iss?: string; dest?: string; aud?: string; exp?: number; nbf?: number };
type TokenPayload = { access_token?: string; error?: string; error_description?: string };
function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body); }
function decode(value: string) { const normalized = value.replace(/-/g, "+").replace(/_/g, "/"); return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64"); }
function verify(token: string, clientId: string, secret: string) {
  const parts = token.split("."); if (parts.length !== 3) throw new Error("SHOPIFY_ID_TOKEN_INVALID"); const [h, p, s] = parts;
  const header = JSON.parse(decode(h).toString()) as { alg?: string }; const claims = JSON.parse(decode(p).toString()) as Claims; if (header.alg !== "HS256") throw new Error("SHOPIFY_ID_TOKEN_ALGORITHM_INVALID");
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest(); const received = decode(s); if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("SHOPIFY_ID_TOKEN_SIGNATURE_INVALID");
  const now = Math.floor(Date.now() / 1000); if (!claims.exp || claims.exp <= now) throw new Error("SHOPIFY_ID_TOKEN_EXPIRED"); if (claims.nbf && claims.nbf > now) throw new Error("SHOPIFY_ID_TOKEN_NOT_ACTIVE"); if (claims.aud !== clientId) throw new Error("SHOPIFY_ID_TOKEN_AUDIENCE_INVALID");
  if (!claims.iss || !claims.dest) throw new Error("SHOPIFY_ID_TOKEN_DESTINATION_MISSING"); const issuer = new URL(claims.iss); const destination = new URL(claims.dest); if (issuer.hostname !== destination.hostname || issuer.pathname !== "/admin" || !destination.hostname.endsWith(".myshopify.com")) throw new Error("SHOPIFY_ID_TOKEN_SHOP_INVALID"); return destination.hostname;
}
function requestUrl(req: VercelRequest) { const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim(); const host = String(req.headers.host || "localhost").split(",")[0].trim(); return `${proto}://${host}${req.url || "/api/shopify/inventory"}`; }
async function requireAdmin(req: VercelRequest) {
  const clerkToken = String(req.headers["x-clerk-token"] || ""); if (!clerkToken) throw new Error("UNAUTHORIZED");
  const headers = new Headers(req.headers as Record<string, string>); headers.set("authorization", `Bearer ${clerkToken}`); headers.delete("x-clerk-token");
  const request = new Request(requestUrl(req), { method: req.method || "GET", headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}) });
  const state = await clerk.authenticateRequest(request, { authorizedParties: (process.env.CLERK_AUTHORIZED_PARTIES || process.env.APP_URL || "").split(",").map((v) => v.trim()).filter(Boolean) }); if (!state.isAuthenticated) throw new Error("UNAUTHORIZED");
  const auth = state.toAuth(); if (!auth.userId) throw new Error("UNAUTHORIZED"); const user = await clerk.users.getUser(auth.userId); if (user.publicMetadata?.role !== "Administrador") throw new Error("FORBIDDEN");
}
async function exchange(shop: string, clientId: string, secret: string, idToken: string) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: idToken, subject_token_type: "urn:ietf:params:oauth:token-type:id_token", requested_token_type: "urn:shopify:params:oauth:token-type:online-access-token", client_id: clientId, client_secret: secret }).toString() });
  const payload = await response.json() as TokenPayload; if (!response.ok || !payload.access_token) throw new Error(`TOKEN_EXCHANGE_HTTP_${response.status}:${payload.error_description || payload.error || "sin detalle"}`); return payload.access_token;
}
async function graphql(shop: string, token: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query, variables }) }); const payload = await response.json() as { data?: any; errors?: Array<{ message?: string }> }; const details = payload.errors?.map((e) => e.message || "Error GraphQL").join("; ") || "sin detalle"; if (!response.ok || payload.errors?.length) throw new Error(`GRAPHQL_${response.status}:${details}`); return payload.data;
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return json(res, 405, { error: "Método no permitido." }); await requireAdmin(req);
    const clientId = process.env.SHOPIFY_CLIENT_ID || ""; const secret = process.env.SHOPIFY_CLIENT_SECRET || ""; const auth = String(req.headers.authorization || ""); const idToken = String(req.headers["x-shopify-id-token"] || "") || (auth.startsWith("Bearer ") ? auth.slice(7) : "");
    if (!clientId || !secret) return json(res, 503, { error: "Shopify no está configurado en el servidor." }); if (!idToken) return json(res, 401, { error: "Falta la sesión de Shopify." });
    const shop = verify(idToken, clientId, secret); const token = await exchange(shop, clientId, secret, idToken); const { inventoryItemId, locationId, delta, reason = "correction", referenceDocumentUri } = req.body || {};
    if (typeof inventoryItemId !== "string" || typeof locationId !== "string" || !Number.isInteger(delta) || delta === 0) return json(res, 400, { error: "inventoryItemId, locationId y delta son obligatorios." });
    const mutation = `mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!, $idempotencyKey: String!) { inventoryAdjustQuantities(input: $input) @idempotent(key: $idempotencyKey) { userErrors { field message } inventoryAdjustmentGroup { createdAt changes { name delta } } } }`;
    const data = await graphql(shop, token, mutation, { input: { reason: String(reason), name: "available", referenceDocumentUri: typeof referenceDocumentUri === "string" ? referenceDocumentUri : `jatis-mutis://inventory/${Date.now()}`, changes: [{ delta, inventoryItemId, locationId }] }, idempotencyKey: randomUUID() });
    const errors = data.inventoryAdjustQuantities?.userErrors || []; if (errors.length) return json(res, 422, { error: "Shopify rechazó el ajuste.", errors }); return json(res, 200, { success: true, adjustment: data.inventoryAdjustQuantities?.inventoryAdjustmentGroup || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno"; if (message === "UNAUTHORIZED") return json(res, 401, { error: "No autenticado." }); if (message === "FORBIDDEN") return json(res, 403, { error: "Se requiere rol Administrador." }); if (message.startsWith("SHOPIFY_ID_TOKEN_")) return json(res, 401, { error: "Sesión de Shopify inválida o expirada.", detail: message }); console.error(error); return json(res, 502, { error: "No fue posible ajustar el inventario en Shopify.", detail: message });
  }
}
