export interface ProductVariant {
  id: string;
  sku: string;
  title: string;
  quantity: number;
  price: number;
  weight: number;
  weightUnit: string;
  available: boolean;
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;
  image: string;
  price: number;
  compareAtPrice: number | null;
  currency: string;
  available: boolean;
  vendor: string;
  productType: string;
  tags: string[];
  variants: ProductVariant[];
}

export interface ProductsResponse {
  nodes: Product[];
  count: number;
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}
