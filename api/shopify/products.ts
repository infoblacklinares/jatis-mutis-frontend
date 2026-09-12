import { createClerkClient } from "@clerk/backend";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY || process.env.VITE_CLERK_PUBLISHABLE_KEY,
});

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";

type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  featuredImage: { url: string } | null;
  vendor: string;
  productType: string;
  tags: string[];
  variants: {
    nodes: Array<{
      id: string;
      sku: string | null;
      title: string;
      inventoryQuantity: number;
      price: string;
      compareAtPrice: string | null;
      weight: number;
      weightUnit: string;
      availableForSale: boolean;
    }>;
  };
};

type ShopifyResponse = {
  data?: {
    products?: {
      nodes: ShopifyProduct[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
  errors?: Array<{ message: string }>;
};

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body);
}

function authorizedParties() {
  return (process.env.CLERK_AUTHORIZED_PARTIES || process.env.APP_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function requestUrl(req: VercelRequest) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers.host || "localhost").split(",")[0].trim();
  return `${forwardedProto}://${host}${req.url || "/api/shopify/products"}`;
}

async function requireAuthenticated(req: VercelRequest) {
  const request = new Request(requestUrl(req), {
    method: req.method || "GET",
    headers: new Headers(req.headers as Record<string, string>),
  });
  const state = await clerk.authenticateRequest(request, {
    authorizedParties: authorizedParties(),
  });
  if (!state.isAuthenticated) throw new Error("UNAUTHORIZED");
}

const query = `
  query Products($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: TITLE) {
      nodes {
        id
        title
        handle
        descriptionHtml
        featuredImage { url }
        vendor
        productType
        tags
        variants(first: 100) {
          nodes {
            id
            sku
            title
            inventoryQuantity
            price
            compareAtPrice
            weight
            weightUnit
            availableForSale
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

async function shopifyGraphql<T>(storeDomain: string, accessToken: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) throw new Error(`SHOPIFY_HTTP_${response.status}`);
  const payload = await response.json() as ShopifyResponse;
  if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join("; "));
  return payload.data as T;
}

function normalize(product: ShopifyProduct) {
  const variants = product.variants.nodes.map((variant) => ({
    id: variant.id,
    sku: variant.sku || "",
    title: variant.title,
    quantity: Number(variant.inventoryQuantity || 0),
    price: Number(variant.price || 0),
    weight: Number(variant.weight || 0),
    weightUnit: variant.weightUnit,
    available: variant.availableForSale,
  }));

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    description: product.descriptionHtml,
    image: product.featuredImage?.url || "",
    price: variants[0]?.price || 0,
    compareAtPrice: Number(product.variants.nodes[0]?.compareAtPrice || 0) || null,
    currency: "CLP",
    available: variants.some((variant) => variant.available),
    vendor: product.vendor,
    productType: product.productType,
    tags: product.tags,
    variants,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "GET") return json(res, 405, { error: "Método no permitido." });
    await requireAuthenticated(req);

    const storeDomain = (process.env.SHOPIFY_STORE_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || "";
    if (!storeDomain || !accessToken) {
      return json(res, 503, { error: "Shopify no está configurado en el servidor." });
    }

    const nodes: ShopifyProduct[] = [];
    let after: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const data = await shopifyGraphql<{ products: ShopifyResponse["data"]["products"] }>(storeDomain, accessToken, {
        first: 100,
        after,
      });
      const products = data.products;
      if (!products) throw new Error("SHOPIFY_PRODUCTS_EMPTY");
      nodes.push(...products.nodes);
      hasNextPage = products.pageInfo.hasNextPage;
      after = products.pageInfo.endCursor;
    }

    return json(res, 200, {
      nodes: nodes.map(normalize),
      count: nodes.length,
      pageInfo: { hasNextPage: false, endCursor: null },
      source: "shopify",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message === "UNAUTHORIZED") return json(res, 401, { error: "No autenticado." });
    console.error(error);
    return json(res, 502, { error: "No fue posible consultar Shopify.", detail: message });
  }
}
