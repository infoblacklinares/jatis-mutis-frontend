import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";

type ShopifyProduct = { id: string; title: string; handle: string; descriptionHtml: string; featuredImage: { url: string } | null; vendor: string; productType: string; tags: string[]; variants: { nodes: Array<{ id: string; sku: string | null; title: string; inventoryQuantity: number; price: string; compareAtPrice: string | null; weight: number; weightUnit: string; availableForSale: boolean }> } };
type ShopifyProducts = { nodes: ShopifyProduct[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
type ShopifyResponse = { data?: { products?: ShopifyProducts }; errors?: Array<{ message: string }> };
type TokenResponse = { access_token?: string; error?: string; error_description?: string };
type ShopifyIdTokenClaims = { iss?: string; dest?: string; aud?: string; exp?: number; nbf?: number };

function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body); }
function base64UrlDecode(value: string) { const normalized = value.replace(/-/g, "+").replace(/_/g, "/"); return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64"); }

function verifyShopifyIdToken(token: string, clientId: string, clientSecret: string) {
  const parts = token.split("."); if (parts.length !== 3) throw new Error("SHOPIFY_ID_TOKEN_INVALID");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = JSON.parse(base64UrlDecode(encodedHeader).toString("utf8")) as { alg?: string };
  const claims = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as ShopifyIdTokenClaims;
  if (header.alg !== "HS256") throw new Error("SHOPIFY_ID_TOKEN_ALGORITHM_INVALID");
  const expectedSignature = createHmac("sha256", clientSecret).update(`${encodedHeader}.${encodedPayload}`).digest();
  const receivedSignature = base64UrlDecode(encodedSignature);
  if (receivedSignature.length !== expectedSignature.length || !timingSafeEqual(receivedSignature, expectedSignature)) throw new Error("SHOPIFY_ID_TOKEN_SIGNATURE_INVALID");
  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp <= now) throw new Error("SHOPIFY_ID_TOKEN_EXPIRED");
  if (claims.nbf && claims.nbf > now) throw new Error("SHOPIFY_ID_TOKEN_NOT_ACTIVE");
  if (claims.aud !== clientId) throw new Error("SHOPIFY_ID_TOKEN_AUDIENCE_INVALID");
  if (!claims.iss || !claims.dest) throw new Error("SHOPIFY_ID_TOKEN_DESTINATION_MISSING");
  const issuer = new URL(claims.iss); const destination = new URL(claims.dest);
  if (issuer.hostname !== destination.hostname || issuer.pathname !== "/admin") throw new Error("SHOPIFY_ID_TOKEN_ISSUER_INVALID");
  if (!destination.hostname.endsWith(".myshopify.com")) throw new Error("SHOPIFY_ID_TOKEN_SHOP_INVALID");
  return destination.hostname;
}

const query = `query Products($first: Int!, $after: String) { products(first: $first, after: $after, sortKey: TITLE) { nodes { id title handle descriptionHtml featuredImage { url } vendor productType tags variants(first: 100) { nodes { id sku title inventoryQuantity price compareAtPrice weight weightUnit availableForSale } } } pageInfo { hasNextPage endCursor } } }`;

async function getShopifyAccessToken(shopDomain: string, clientId: string, clientSecret: string, idToken: string) {
  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: idToken, subject_token_type: "urn:ietf:params:oauth:token-type:id_token", requested_token_type: "urn:shopify:params:oauth:token-type:online-access-token", client_id: clientId, client_secret: clientSecret }).toString() });
  const payload = await response.json() as TokenResponse;
  if (!response.ok || !payload.access_token) throw new Error(`TOKEN_EXCHANGE_HTTP_${response.status}:${payload.error_description || payload.error || "sin detalle"}`);
  return payload.access_token;
}

async function shopifyGraphql(storeDomain: string, accessToken: string, variables: Record<string, unknown>) {
  const response = await fetch(`https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken }, body: JSON.stringify({ query, variables }) });
  const payload = await response.json() as ShopifyResponse;
  if (!response.ok) throw new Error(`GRAPHQL_HTTP_${response.status}`);
  if (payload.errors?.length) throw new Error(`GRAPHQL_ERROR:${payload.errors.map((error) => error.message).join("; ")}`);
  if (!payload.data?.products) throw new Error("GRAPHQL_PRODUCTS_EMPTY");
  return payload.data.products;
}

function normalize(product: ShopifyProduct) {
  const variants = product.variants.nodes.map((variant) => ({ id: variant.id, sku: variant.sku || "", title: variant.title, quantity: Number(variant.inventoryQuantity || 0), price: Number(variant.price || 0), weight: Number(variant.weight || 0), weightUnit: variant.weightUnit, available: variant.availableForSale }));
  return { id: product.id, title: product.title, handle: product.handle, description: product.descriptionHtml, image: product.featuredImage?.url || "", price: variants[0]?.price || 0, compareAtPrice: Number(product.variants.nodes[0]?.compareAtPrice || 0) || null, currency: "CLP", available: variants.some((variant) => variant.available), vendor: product.vendor, productType: product.productType, tags: product.tags, variants };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") return json(res, 405, { error: "Método no permitido." });
    const clientId = process.env.SHOPIFY_CLIENT_ID || "";
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || "";
    const authorization = String(req.headers.authorization || "");
    const customIdToken = String(req.headers["x-shopify-id-token"] || "");
    const idToken = customIdToken || (authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
    if (!clientId || !clientSecret) return json(res, 503, { error: "Shopify no está configurado en el servidor." });
    if (!idToken) return json(res, 401, { error: "Falta la sesión de Shopify. Abre Jatis Mutis desde Shopify Admin.", "X-Shopify-Retry-Invalid-Session-Request": "1" });
    const storeDomain = verifyShopifyIdToken(idToken, clientId, clientSecret);
    const accessToken = await getShopifyAccessToken(storeDomain, clientId, clientSecret, idToken);
    const nodes: ShopifyProduct[] = []; let after: string | null = null; let hasNextPage = true;
    while (hasNextPage) { const products = await shopifyGraphql(storeDomain, accessToken, { first: 100, after }); nodes.push(...products.nodes); hasNextPage = products.pageInfo.hasNextPage; after = products.pageInfo.endCursor; }
    return json(res, 200, { nodes: nodes.map(normalize), count: nodes.length, pageInfo: { hasNextPage: false, endCursor: null }, source: "shopify" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message.startsWith("SHOPIFY_ID_TOKEN_")) return json(res, 401, { error: "Sesión de Shopify inválida o expirada.", detail: message, "X-Shopify-Retry-Invalid-Session-Request": "1" });
    console.error(error); return json(res, 502, { error: "No fue posible consultar Shopify.", detail: message });
  }
}
