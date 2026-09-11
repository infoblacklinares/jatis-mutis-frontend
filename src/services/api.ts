import type { Product, ProductsResponse } from "../types/product";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

export const apiConfigured = Boolean(API_URL);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error("VITE_API_URL no está configurada.");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error(`API ${response.status}: ${response.statusText}`);
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
    variants: product.variants.map((variant) => ({ ...variant, price: numberOrZero(variant.price), quantity: numberOrZero(variant.quantity), weight: numberOrZero(variant.weight) })),
  };
}

export async function getProducts(): Promise<ProductsResponse> {
  const data = await request<ProductsResponse>("/api/products");
  return { ...data, nodes: data.nodes.map(normalizeProduct) };
}

export async function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>("/health");
}
