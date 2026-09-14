import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
type Claims = { iss?: string; dest?: string; aud?: string; exp?: number; nbf?: number };
type TokenResponse = { access_token?: string; error?: string; error_description?: string };
type ShopifyOrder = {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  customer: { displayName: string; email: string | null } | null;
  lineItems: { nodes: Array<{ quantity: number; name: string; sku: string | null; originalUnitPriceSet: { shopMoney: { amount: string } }; variant: { id: string; sku: string | null; product: { id: string; title: string } | null } | null }> };
};

function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body); }
function decode(value: string) { const normalized = value.replace(/-/g, "+").replace(/_/g, "/"); return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64"); }
function verify(token: string, clientId: string, secret: string) {
  const parts = token.split("."); if (parts.length !== 3) throw new Error("SHOPIFY_ID_TOKEN_INVALID");
  const [h, p, s] = parts; const header = JSON.parse(decode(h).toString("utf8")) as { alg?: string }; const claims = JSON.parse(decode(p).toString("utf8")) as Claims;
  if (header.alg !== "HS256") throw new Error("SHOPIFY_ID_TOKEN_ALGORITHM_INVALID");
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest(); const received = decode(s);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("SHOPIFY_ID_TOKEN_SIGNATURE_INVALID");
  const now = Math.floor(Date.now() / 1000); if (!claims.exp || claims.exp <= now) throw new Error("SHOPIFY_ID_TOKEN_EXPIRED"); if (claims.nbf && claims.nbf > now) throw new Error("SHOPIFY_ID_TOKEN_NOT_ACTIVE"); if (claims.aud !== clientId) throw new Error("SHOPIFY_ID_TOKEN_AUDIENCE_INVALID");
  if (!claims.iss || !claims.dest) throw new Error("SHOPIFY_ID_TOKEN_DESTINATION_MISSING"); const issuer = new URL(claims.iss); const destination = new URL(claims.dest);
  if (issuer.hostname !== destination.hostname || issuer.pathname !== "/admin" || !destination.hostname.endsWith(".myshopify.com")) throw new Error("SHOPIFY_ID_TOKEN_SHOP_INVALID"); return destination.hostname;
}
async function exchange(shop: string, clientId: string, secret: string, idToken: string) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: idToken, subject_token_type: "urn:ietf:params:oauth:token-type:id_token", requested_token_type: "urn:shopify:params:oauth:token-type:online-access-token", client_id: clientId, client_secret: secret }).toString() });
  const payload = await response.json() as TokenResponse; if (!response.ok || !payload.access_token) throw new Error(`TOKEN_EXCHANGE_HTTP_${response.status}:${payload.error_description || payload.error || "sin detalle"}`); return payload.access_token;
}
const query = `query Orders($first: Int!, $after: String) { orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) { nodes { id name createdAt displayFinancialStatus displayFulfillmentStatus totalPriceSet { shopMoney { amount currencyCode } } customer { displayName email } lineItems(first: 100) { nodes { quantity name sku originalUnitPriceSet { shopMoney { amount } } variant { id sku product { id title } } } } } pageInfo { hasNextPage endCursor } } }`;
async function graphql(shop: string, token: string, variables: Record<string, unknown>) {
  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query, variables }) });
  const payload = await response.json() as { data?: { orders?: { nodes: ShopifyOrder[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } }; errors?: Array<{ message?: string }> };
  const details = payload.errors?.map((e) => e.message || "Error GraphQL").join("; ") || "sin detalle";
  if (!response.ok || payload.errors?.length) throw new Error(`GRAPHQL_${response.status}:${details}`);
  if (!payload.data?.orders) throw new Error("GRAPHQL_ORDERS_EMPTY"); return payload.data.orders;
}
function status(financial: string | null, fulfillment: string | null) {
  if (financial === "REFUNDED" || financial === "VOIDED") return "Cancelado";
  if (fulfillment === "DELIVERED") return "Entregado";
  if (fulfillment === "FULFILLED") return "Enviado";
  if (fulfillment === "IN_PROGRESS" || fulfillment === "ON_HOLD" || fulfillment === "SCHEDULED") return "Preparando";
  if (financial === "PAID" || financial === "PARTIALLY_PAID") return "Pagado";
  return "Pendiente";
}
function normalize(order: ShopifyOrder) {
  return { id: order.name || order.id, date: new Date(order.createdAt).toLocaleString("es-CL"), customer: order.customer?.displayName || "Cliente sin nombre", email: order.customer?.email || undefined, total: Number(order.totalPriceSet.shopMoney.amount || 0), status: status(order.displayFinancialStatus, order.displayFulfillmentStatus), paymentStatus: order.displayFinancialStatus || undefined, fulfillmentStatus: order.displayFulfillmentStatus || undefined, items: order.lineItems.nodes.map((item) => ({ productId: item.variant?.product?.id || item.variant?.id || item.name, title: item.variant?.product?.title || item.name, sku: item.sku || item.variant?.sku || "", quantity: item.quantity, price: Number(item.originalUnitPriceSet.shopMoney.amount || 0) })) };
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") return json(res, 405, { error: "Método no permitido." });
    const clientId = process.env.SHOPIFY_CLIENT_ID || ""; const secret = process.env.SHOPIFY_CLIENT_SECRET || ""; const auth = String(req.headers.authorization || ""); const idToken = String(req.headers["x-shopify-id-token"] || "") || (auth.startsWith("Bearer ") ? auth.slice(7) : "");
    if (!clientId || !secret) return json(res, 503, { error: "Shopify no está configurado en el servidor." }); if (!idToken) return json(res, 401, { error: "Falta la sesión de Shopify.", "X-Shopify-Retry-Invalid-Session-Request": "1" });
    const shop = verify(idToken, clientId, secret); const token = await exchange(shop, clientId, secret, idToken); const nodes: ShopifyOrder[] = []; let after: string | null = null; let hasNextPage = true;
    while (hasNextPage) { const orders = await graphql(shop, token, { first: 100, after }); nodes.push(...orders.nodes); hasNextPage = orders.pageInfo.hasNextPage; after = orders.pageInfo.endCursor; }
    return json(res, 200, { nodes: nodes.map(normalize), count: nodes.length, source: "shopify" });
  } catch (error) { const message = error instanceof Error ? error.message : "Error interno"; if (message.startsWith("SHOPIFY_ID_TOKEN_")) return json(res, 401, { error: "Sesión de Shopify inválida o expirada.", detail: message, "X-Shopify-Retry-Invalid-Session-Request": "1" }); console.error(error); return json(res, 502, { error: "No fue posible consultar los pedidos de Shopify.", detail: message }); }
}
