import type { Product, ProductsResponse } from "../types/product";
import type { Order } from "../types/order";
import type { Customer } from "../types/customer";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
const PRODUCTS_PATH = "/api/v1/products";
const ORDERS_PATH = "/api/v1/orders";
const CUSTOMERS_PATH = "/api/v1/customers";

export const apiConfigured = true;

type ApiErrorBody = { error?: string; detail?: string };

declare global {
  interface Window {
    shopify?: {
      idToken?: () => Promise<string>;
      scopes?: {
        query: () => Promise<{ granted: string[]; optional?: string[]; required?: string[] }>;
        request: (scopes: string[]) => Promise<{ result?: string; detail?: { granted?: string[] } }>;
      };
    };
    Clerk?: { session?: { getToken?: () => Promise<string | null> } };
  }
}

async function ensureShopifyScopes() {
  const scopesApi = window.shopify?.scopes;
  if (!scopesApi) return;
  const current = await scopesApi.query();
  const requiredScopes = ["read_products", "read_inventory", "read_locations", "read_orders", "read_customers"];
  const missing = requiredScopes.filter((scope) => !current.granted.includes(scope));
  if (missing.length) await scopesApi.request(missing);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  if (!window.shopify && window.Clerk?.session?.getToken) {
    const clerkToken = await window.Clerk.session.getToken();
    if (clerkToken) headers.set("Authorization", `Bearer ${clerkToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json() as ApiErrorBody;
      detail = body.detail || body.error || "";
    } catch {}
    throw new Error(detail || `API ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

const numberOrZero = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function normalizeProduct(product: Product): Product {
  return {
    ...product,
    price: numberOrZero(product.price),
    compareAtPrice: product.compareAtPrice == null ? null : numberOrZero(product.compareAtPrice),
    variants: product.variants.map((variant) => ({
      ...variant,
      price: numberOrZero(variant.price),
      quantity: numberOrZero(variant.quantity),
      weight: numberOrZero(variant.weight),
      packageLengthCm: numberOrZero(variant.packageLengthCm),
      packageWidthCm: numberOrZero(variant.packageWidthCm),
      packageHeightCm: numberOrZero(variant.packageHeightCm),
    })),
  };
}

export async function getProducts(): Promise<ProductsResponse> {
  const data = await request<ProductsResponse>(PRODUCTS_PATH);
  return { ...data, nodes: data.nodes.map(normalizeProduct) };
}

export async function getOrders(): Promise<{ nodes: Order[]; count: number; source: string }> {
  return request<{ nodes: Order[]; count: number; source: string }>(ORDERS_PATH);
}

export async function getCustomers(): Promise<{ nodes: Customer[]; count: number; source: string }> {
  return request<{ nodes: Customer[]; count: number; source: string }>(CUSTOMERS_PATH);
}

export async function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>("/health");
}

export async function adjustInventory(input: { inventoryItemId: string; locationId: string; delta: number; currentQuantity: number; reason: string }, clerkToken: string) {
  const shopifyToken = window.shopify?.idToken ? await window.shopify.idToken() : "";
  if (!shopifyToken) throw new Error("Los ajustes de inventario desde fuera de Shopify todavía no están habilitados. Puedes consultar el inventario desde la app web.");
  return request<{ success: boolean; adjustment: unknown }>("/api/shopify/inventory", { method: "POST", headers: { "X-Shopify-ID-Token": shopifyToken, "X-Clerk-Token": clerkToken }, body: JSON.stringify(input) });
}

export async function getLocations() {
  await ensureShopifyScopes();
  if (!window.shopify) return request<{ locations: Array<{ id: string; name: string; isActive: boolean }> }>("/api/shopify/standalone?resource=locations");
  const shopifyToken = window.shopify?.idToken ? await window.shopify.idToken() : "";
  if (!shopifyToken) throw new Error("Falta la sesión de Shopify.");
  return request<{ locations: Array<{ id: string; name: string; isActive: boolean }> }>("/api/shopify/locations", { headers: { "X-Shopify-ID-Token": shopifyToken } });
}

export async function updateProduct(input: { productId: string; variantId: string; title: string; sku: string; price: number; weight: number; weightUnit: string; packageLengthCm: number; packageWidthCm: number; packageHeightCm: number; available: boolean }) {
  const shopifyToken = window.shopify?.idToken ? await window.shopify.idToken() : "";
  if (!shopifyToken) throw new Error("La edición de productos desde fuera de Shopify todavía no está habilitada. Puedes consultar el catálogo desde la app web.");
  return request<{ success: boolean }>("/api/shopify/product-update", { method: "PATCH", headers: { "X-Shopify-ID-Token": shopifyToken }, body: JSON.stringify(input) });
}

export async function updateOrder(input: { orderId: string; action: "fulfill" | "cancel"; tracking?: { company?: string; number?: string; url?: string }; notifyCustomer?: boolean; restock?: boolean; staffNote?: string }) {
  const shopifyToken = window.shopify?.idToken ? await window.shopify.idToken() : "";
  if (!shopifyToken) throw new Error("Las acciones de pedidos desde fuera de Shopify todavía no están habilitadas. Puedes consultar los pedidos desde la app web.");
  return request<{ success: boolean; action: string; fulfillment?: unknown; job?: unknown }>("/api/shopify/order-actions", { method: "POST", headers: { "X-Shopify-ID-Token": shopifyToken }, body: JSON.stringify(input) });
}
