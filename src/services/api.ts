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
    Clerk?: { session?: { getToken?: () => Promise<string | null> } };
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  if (window.Clerk?.session?.getToken) {
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

// Mutations remain temporarily isolated until their API v1 contracts are available.
export async function adjustInventory(input: { inventoryItemId: string; locationId: string; delta: number; currentQuantity: number; reason: string }, clerkToken: string) {
  throw new Error("El ajuste de inventario se habilitará cuando la API v1 de inventario esté disponible.");
}

export async function getLocations() {
  throw new Error("Las ubicaciones se habilitarán cuando la API v1 de inventario esté disponible.");
}

export async function updateProduct(input: { productId: string; variantId: string; title: string; sku: string; price: number; weight: number; weightUnit: string; packageLengthCm: number; packageWidthCm: number; packageHeightCm: number; available: boolean }) {
  throw new Error("La edición de productos se habilitará cuando exista el contrato API v1 correspondiente.");
}

export async function updateOrder(input: { orderId: string; action: "fulfill" | "cancel"; tracking?: { company?: string; number?: string; url?: string }; notifyCustomer?: boolean; restock?: boolean; staffNote?: string }) {
  throw new Error("Las acciones de pedidos se habilitarán cuando exista el contrato API v1 correspondiente.");
}
