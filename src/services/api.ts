import type { Product, ProductsResponse } from "../types/product";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
const PRODUCTS_PATH = API_URL ? "/api/products" : "/api/shopify/products";

export const apiConfigured = true;

type ApiErrorBody = { error?: string; detail?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json() as ApiErrorBody;
      detail = body.detail || body.error || "";
    } catch {
      // La respuesta no era JSON.
    }
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
    })),
  };
}

export async function getProducts(): Promise<ProductsResponse> {
  const data = await request<ProductsResponse>(PRODUCTS_PATH);
  return { ...data, nodes: data.nodes.map(normalizeProduct) };
}

export async function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>(API_URL ? "/health" : "/api/shopify/products");
}
