import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";

type CustomerNode = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  defaultEmailAddress: { emailAddress: string } | null;
  defaultPhoneNumber: { phoneNumber: string } | null;
  numberOfOrders: string;
  amountSpent: { amount: string; currencyCode: string };
  state: "ENABLED" | "INVITED" | "DISABLED" | "DECLINED";
  createdAt: string;
  updatedAt: string;
  lastOrder: { id: string; createdAt: string; name: string } | null;
};

type CustomersConnection = {
  nodes: CustomerNode[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};
type ShopifyResponse = {
  data?: { customers?: CustomersConnection };
  errors?: Array<{ message?: string }>;
};
type TokenResponse = { access_token?: string; error?: string; error_description?: string };
type Claims = { iss?: string; dest?: string; aud?: string; exp?: number; nbf?: number };

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body);
}

function decode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64");
}

function verify(token: string, clientId: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("SHOPIFY_ID_TOKEN_INVALID");
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = JSON.parse(decode(headerPart).toString("utf8")) as { alg?: string };
  const claims = JSON.parse(decode(payloadPart).toString("utf8")) as Claims;
  if (header.alg !== "HS256") throw new Error("SHOPIFY_ID_TOKEN_ALGORITHM_INVALID");
  const expected = createHmac("sha256", secret).update(`${headerPart}.${payloadPart}`).digest();
  const received = decode(signaturePart);
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
  const payload = await response.json() as TokenResponse;
  if (!response.ok || !payload.access_token) throw new Error(`TOKEN_EXCHANGE_HTTP_${response.status}:${payload.error_description || payload.error || "sin detalle"}`);
  return payload.access_token;
}

const query = `query Customers($first: Int!, $after: String) {
  customers(first: $first, after: $after, sortKey: NAME) {
    nodes {
      id displayName firstName lastName
      defaultEmailAddress { emailAddress }
      defaultPhoneNumber { phoneNumber }
      numberOfOrders
      amountSpent { amount currencyCode }
      state createdAt updatedAt
      lastOrder { id createdAt name }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

async function graphql(shop: string, token: string, variables: Record<string, unknown>) {
  const response = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json() as ShopifyResponse;
  const details = payload.errors?.map((error) => error.message || "Error GraphQL").join("; ") || "sin detalle";
  if (!response.ok || payload.errors?.length) throw new Error(`GRAPHQL_${response.status}:${details}`);
  if (!payload.data?.customers) throw new Error("GRAPHQL_CUSTOMERS_EMPTY");
  return payload.data.customers;
}

function normalize(customer: CustomerNode) {
  const email = customer.defaultEmailAddress?.emailAddress || "Sin correo";
  const phone = customer.defaultPhoneNumber?.phoneNumber || "Sin teléfono";
  return {
    id: customer.id,
    name: customer.displayName || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Cliente sin nombre",
    email,
    phone,
    ordersCount: Number(customer.numberOfOrders || 0),
    totalSpent: Number(customer.amountSpent?.amount || 0),
    currency: customer.amountSpent?.currencyCode || "CLP",
    lastPurchase: customer.lastOrder?.createdAt || "Sin compras",
    lastOrderId: customer.lastOrder?.id || null,
    lastOrderName: customer.lastOrder?.name || null,
    status: customer.state === "ENABLED" ? "Activo" : "Inactivo",
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") return json(res, 405, { error: "Método no permitido." });
    const clientId = process.env.SHOPIFY_CLIENT_ID || "";
    const secret = process.env.SHOPIFY_CLIENT_SECRET || "";
    const authorization = String(req.headers.authorization || "");
    const customIdToken = String(req.headers["x-shopify-id-token"] || "");
    const idToken = customIdToken || (authorization.startsWith("Bearer ") ? authorization.slice(7) : "");
    if (!clientId || !secret) return json(res, 503, { error: "Shopify no está configurado en el servidor." });
    if (!idToken) return json(res, 401, { error: "Falta la sesión de Shopify.", "X-Shopify-Retry-Invalid-Session-Request": "1" });
    const shop = verify(idToken, clientId, secret);
    const token = await exchange(shop, clientId, secret, idToken);
    const nodes: CustomerNode[] = [];
    let after: string | null = null;
    let hasNextPage = true;
    while (hasNextPage) {
      const page = await graphql(shop, token, { first: 100, after });
      nodes.push(...page.nodes);
      hasNextPage = page.pageInfo.hasNextPage;
      after = page.pageInfo.endCursor;
    }
    return json(res, 200, { nodes: nodes.map(normalize), count: nodes.length, pageInfo: { hasNextPage: false, endCursor: null }, source: "shopify" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message.startsWith("SHOPIFY_ID_TOKEN_")) return json(res, 401, { error: "Sesión de Shopify inválida o expirada.", detail: message, "X-Shopify-Retry-Invalid-Session-Request": "1" });
    console.error(error);
    return json(res, 502, { error: "No fue posible consultar los clientes en Shopify.", detail: message });
  }
}
