import { createHmac, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
type Claims = { iss?: string; dest?: string; aud?: string; exp?: number; nbf?: number };
type TokenResponse = { access_token?: string; error?: string; error_description?: string };

type Tracking = { company?: string; number?: string; url?: string };
type FulfillmentOrderLine = { id: string; remainingQuantity: number };
type FulfillmentOrder = { id: string; status: string; lineItems: { nodes: FulfillmentOrderLine[] } };

type GraphqlPayload = { data?: Record<string, any>; errors?: Array<{ message?: string }> };

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

async function graphql(shop: string, token: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json() as GraphqlPayload;
  const details = payload.errors?.map((error) => error.message || "Error GraphQL").join("; ") || "sin detalle";
  if (!response.ok || payload.errors?.length) throw new Error(`GRAPHQL_${response.status}:${details}`);
  return payload.data || {};
}

const fulfillmentOrdersQuery = `query FulfillmentOrders($id: ID!) {
  order(id: $id) {
    id
    displayFulfillmentStatus
    fulfillmentOrders(first: 50) {
      nodes {
        id
        status
        assignedLocation { location { id name } }
        lineItems(first: 250) {
          nodes { id remainingQuantity lineItem { name sku } }
        }
      }
    }
  }
}`;

const fulfillMutation = `mutation Fulfill($fulfillment: FulfillmentInput!) {
  fulfillmentCreate(fulfillment: $fulfillment) {
    fulfillment { id status displayStatus trackingInfo { company number url } }
    userErrors { field message }
  }
}`;

const cancelMutation = `mutation Cancel($id: ID!, $notifyCustomer: Boolean, $refundMethod: OrderCancelRefundMethodInput!, $restock: Boolean!, $reason: OrderCancelReason!, $staffNote: String) {
  orderCancel(orderId: $id, notifyCustomer: $notifyCustomer, refundMethod: $refundMethod, restock: $restock, reason: $reason, staffNote: $staffNote) {
    job { id done }
    orderCancelUserErrors { field message code }
    userErrors { field message }
  }
}`;

async function fulfillOrder(shop: string, token: string, orderId: string, tracking?: Tracking, notifyCustomer = false) {
  const data = await graphql(shop, token, fulfillmentOrdersQuery, { id: orderId }) as {
    order?: { fulfillmentOrders?: { nodes: FulfillmentOrder[] } };
  };
  const nodes = data.order?.fulfillmentOrders?.nodes || [];
  const open = nodes.filter((node) => ["OPEN", "SCHEDULED", "IN_PROGRESS"].includes(node.status));
  if (!open.length) throw new Error("El pedido no tiene líneas disponibles para enviar desde Shopify.");

  const lineItemsByFulfillmentOrder = open
    .map((node) => ({
      fulfillmentOrderId: node.id,
      fulfillmentOrderLineItems: node.lineItems.nodes
        .filter((item) => item.remainingQuantity > 0)
        .map((item) => ({ id: item.id, quantity: item.remainingQuantity })),
    }))
    .filter((item) => item.fulfillmentOrderLineItems.length > 0);

  if (!lineItemsByFulfillmentOrder.length) throw new Error("El pedido ya está completamente preparado o enviado en Shopify.");

  const fulfillment: Record<string, unknown> = {
    lineItemsByFulfillmentOrder,
    notifyCustomer,
  };
  const cleanTracking = Object.fromEntries(Object.entries(tracking || {}).filter(([, value]) => value));
  if (Object.keys(cleanTracking).length) fulfillment.trackingInfo = cleanTracking;

  const result = await graphql(shop, token, fulfillMutation, { fulfillment }) as {
    fulfillmentCreate?: {
      fulfillment?: {
        id: string;
        status: string;
        displayStatus: string | null;
        trackingInfo: Array<{ company: string | null; number: string | null; url: string | null }>;
      };
      userErrors?: Array<{ field?: string[]; message: string }>;
    };

  const errors = result.fulfillmentCreate?.userErrors || [];
  if (errors.length) throw new Error(errors.map((error) => error.message).join("; "));
  if (!result.fulfillmentCreate?.fulfillment) throw new Error("Shopify no creó el fulfillment.");
  return result.fulfillmentCreate.fulfillment;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return json(res, 405, { error: "Método no permitido." });

    const clientId = process.env.SHOPIFY_CLIENT_ID || "";
    const secret = process.env.SHOPIFY_CLIENT_SECRET || "";
    const idToken = String(req.headers["x-shopify-id-token"] || "");
    if (!clientId || !secret) return json(res, 503, { error: "Shopify no está configurado en el servidor." });
    if (!idToken) return json(res, 401, { error: "Falta la sesión de Shopify.", "X-Shopify-Retry-Invalid-Session-Request": "1" });

    const shop = verify(idToken, clientId, secret);
    const token = await exchange(shop, clientId, secret, idToken);
    const body = (req.body || {}) as {
      orderId?: string;
      action?: string;
      tracking?: Tracking;
      notifyCustomer?: boolean;
      restock?: boolean;
      staffNote?: string;
    };

    if (!body.orderId) return json(res, 400, { error: "Falta el ID del pedido." });

    if (body.action === "fulfill") {
      const fulfillment = await fulfillOrder(shop, token, body.orderId, body.tracking, Boolean(body.notifyCustomer));
      return json(res, 200, { success: true, action: "fulfill", fulfillment });
    }

    if (body.action === "cancel") {
      const result = await graphql(shop, token, cancelMutation, {
        id: body.orderId,
        notifyCustomer: Boolean(body.notifyCustomer),
        refundMethod: { originalPaymentMethodsRefund: true },
        restock: body.restock !== false,
        reason: "OTHER",
        staffNote: body.staffNote || "Cancelado desde Jatis Mutis",
      }) as {
        orderCancel?: {
          job?: { id: string; done: boolean };
          orderCancelUserErrors?: Array<{ field?: string[]; message: string; code?: string }>;
          userErrors?: Array<{ field?: string[]; message: string }>;
        };
      };

      const errors = [
        ...(result.orderCancel?.orderCancelUserErrors || []),
        ...(result.orderCancel?.userErrors || []),
      ];
      if (errors.length) throw new Error(errors.map((error) => error.message).join("; "));
      return json(res, 200, { success: true, action: "cancel", job: result.orderCancel?.job });
    }

    return json(res, 400, { error: "Acción no soportada. Usa fulfill o cancel." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message.startsWith("SHOPIFY_ID_TOKEN_")) {
      return json(res, 401, {
        error: "Sesión de Shopify inválida o expirada.",
        detail: message,
        "X-Shopify-Retry-Invalid-Session-Request": "1",
      });
    }
    console.error(error);
    return json(res, 502, { error: "No fue posible actualizar el pedido en Shopify.", detail: message });
  }
}
