import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
type Claims = { iss?: string; dest?: string; aud?: string; exp?: number; nbf?: number };

function json(res: VercelResponse, status: number, body: unknown) { return res.status(status).json(body); }
function decode(value: string) { const normalized = value.replace(/-/g, "+").replace(/_/g, "/"); return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64"); }

function verify(token: string, clientId: string, secret: string) {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) throw new Error("SHOPIFY_ID_TOKEN_INVALID");
  const header = JSON.parse(decode(h).toString()) as { alg?: string };
  const claims = JSON.parse(decode(p).toString()) as Claims;
  if (header.alg !== "HS256") throw new Error("SHOPIFY_ID_TOKEN_ALGORITHM_INVALID");
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  const received = decode(s);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("SHOPIFY_ID_TOKEN_SIGNATURE_INVALID");
  const now = Math.floor(Date.now() / 1000);
  if (!claims.exp || claims.exp <= now) throw new Error("SHOPIFY_ID_TOKEN_EXPIRED");
  if (claims.nbf && claims.nbf > now) throw new Error("SHOPIFY_ID_TOKEN_NOT_ACTIVE");
  if (claims.aud !== clientId) throw new Error("SHOPIFY_ID_TOKEN_AUDIENCE_INVALID");
  if (!claims.iss || !claims.dest) throw new Error("SHOPIFY_ID_TOKEN_DESTINATION_MISSING");
  const issuer = new URL(claims.iss);
  const destination = new URL(claims.dest);
  if (issuer.hostname !== destination.hostname || issuer.pathname !== "/admin" || !destination.hostname.endsWith(".myshopify.com")) throw new Error("SHOPIFY_ID_TOKEN_SHOP_INVALID");
  return destination.hostname;
}

async function exchange(shop: string, clientId: string, secret: string, idToken: string) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      requested_token_type: "urn:shopify:params:oauth:token-type:online-access-token",
      client_id: clientId,
      client_secret: secret,
    }).toString(),
  });
  const payload = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !payload.access_token) throw new Error(`TOKEN_EXCHANGE_HTTP_${response.status}:${payload.error_description || "sin detalle"}`);
  return payload.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") return json(res, 405, { error: "Método no permitido." });
    const clientId = process.env.SHOPIFY_CLIENT_ID || "";
    const secret = process.env.SHOPIFY_CLIENT_SECRET || "";
    const auth = String(req.headers.authorization || "");
    const idToken = String(req.headers["x-shopify-id-token"] || "") || (auth.startsWith("Bearer ") ? auth.slice(7) : "");
    if (!clientId || !secret) return json(res, 503, { error: "Shopify no está configurado en el servidor." });
    if (!idToken) return json(res, 401, { error: "Falta la sesión de Shopify." });

    const shop = verify(idToken, clientId, secret);
    const token = await exchange(shop, clientId, secret, idToken);
    // Solo necesitamos el ID para los ajustes de inventario. Evitamos `name`, que requiere read_locations.
    const query = `query Locations { locations(first: 50, includeInactive: false) { nodes { id isActive } } }`;
    const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query }),
    });
    const payload = await response.json() as { data?: { locations?: { nodes: Array<{ id: string; isActive: boolean }> } }; errors?: Array<{ message?: string }> };
    if (!response.ok || payload.errors?.length) throw new Error(payload.errors?.map((e) => e.message || "Error GraphQL").join("; ") || `HTTP_${response.status}`);
    return json(res, 200, { locations: payload.data?.locations?.nodes || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message.startsWith("SHOPIFY_ID_TOKEN_")) return json(res, 401, { error: "Sesión de Shopify inválida o expirada.", detail: message });
    console.error(error);
    return json(res, 502, { error: "No fue posible consultar las ubicaciones de Shopify.", detail: message });
  }
}
