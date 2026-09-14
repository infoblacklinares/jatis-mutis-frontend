import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
type Claims = { iss?: string; dest?: string; aud?: string; exp?: number; nbf?: number };
type TokenResponse = { access_token?: string; error?: string; error_description?: string };

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
async function graphql(shop: string, token: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }, body: JSON.stringify({ query, variables }) });
  const payload = await response.json() as { data?: any; errors?: Array<{ message?: string }> };
  const errors = payload.errors?.map((error) => error.message || "Error GraphQL").join("; "); if (!response.ok || errors) throw new Error(`GRAPHQL_${response.status}:${errors || "sin detalle"}`); return payload.data;
}

const productMutation = `mutation ProductUpdate($input: ProductInput!) { productUpdate(input: $input) { product { id title status } userErrors { field message } } }`;
const variantMutation = `mutation ProductVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { productVariants { id price compareAtPrice } userErrors { field message } } }`;
const inventoryMutation = `mutation InventoryItemUpdate($id: ID!, $input: InventoryItemInput!) { inventoryItemUpdate(id: $id, input: $input) { inventoryItem { id sku measurement { weight { value unit } } } userErrors { field message } } }`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "PATCH") return json(res, 405, { error: "Método no permitido." });
    const clientId = process.env.SHOPIFY_CLIENT_ID || ""; const secret = process.env.SHOPIFY_CLIENT_SECRET || "";
    const idToken = String(req.headers["x-shopify-id-token"] || ""); if (!clientId || !secret) return json(res, 503, { error: "Shopify no está configurado en el servidor." }); if (!idToken) return json(res, 401, { error: "Falta la sesión de Shopify." });
    const shop = verify(idToken, clientId, secret); const token = await exchange(shop, clientId, secret, idToken);
    const body = req.body as { productId?: string; variantId?: string; title?: string; sku?: string; price?: number; weight?: number; weightUnit?: string; available?: boolean };
    if (!body.productId || !body.variantId) return json(res, 400, { error: "Faltan identificadores del producto o variante." });
    const weightUnit = body.weightUnit === "kg" ? "KILOGRAMS" : body.weightUnit === "g" ? "GRAMS" : body.weightUnit || "GRAMS";
    const productData = await graphql(shop, token, productMutation, { input: { id: body.productId, title: body.title?.trim() || undefined, status: body.available === false ? "DRAFT" : "ACTIVE" } });
    const productErrors = productData.productUpdate.userErrors || []; if (productErrors.length) return json(res, 400, { error: productErrors.map((e: any) => e.message).join("; ") });
    const variantData = await graphql(shop, token, variantMutation, { productId: body.productId, variants: [{ id: body.variantId, price: String(Math.max(0, Number(body.price) || 0)) }] });
    const variantErrors = variantData.productVariantsBulkUpdate.userErrors || []; if (variantErrors.length) return json(res, 400, { error: variantErrors.map((e: any) => e.message).join("; ") });
    const productDataAfter = await graphql(shop, token, `query ProductInventoryItem($id: ID!) { product(id: $id) { variants(first: 100) { nodes { id inventoryItem { id } } } } }`, { id: body.productId });
    const variant = productDataAfter.product?.variants?.nodes?.find((item: any) => item.id === body.variantId); const inventoryItemId = variant?.inventoryItem?.id;
    if (!inventoryItemId) return json(res, 400, { error: "No se encontró el inventario de la variante." });
    const inventoryData = await graphql(shop, token, inventoryMutation, { id: inventoryItemId, input: { sku: body.sku?.trim() || "", measurement: { weight: { value: Math.max(0, Number(body.weight) || 0), unit: weightUnit } } } });
    const inventoryErrors = inventoryData.inventoryItemUpdate.userErrors || []; if (inventoryErrors.length) return json(res, 400, { error: inventoryErrors.map((e: any) => e.message).join("; ") });
    return json(res, 200, { success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno"; if (message.startsWith("SHOPIFY_ID_TOKEN_")) return json(res, 401, { error: "Sesión de Shopify inválida o expirada.", detail: message, "X-Shopify-Retry-Invalid-Session-Request": "1" }); console.error(error); return json(res, 502, { error: "No fue posible actualizar el producto en Shopify.", detail: message });
  }
}
