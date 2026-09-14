export type OrderStatus = "Pagado" | "Pendiente" | "Preparando" | "Enviado" | "Entregado" | "Cancelado";

export interface ShippingAddress {
  name?: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province?: string;
  provinceCode?: string;
  zip?: string;
  country?: string;
  countryCode?: string;
  phone?: string;
}

export interface OrderItem {
  productId: string;
  title: string;
  sku: string;
  quantity: number;
  price: number;
  weight?: { value: number; unit: string };
}

export interface Order {
  id: string;
  shopifyId?: string;
  date: string;
  customer: string;
  email?: string;
  total: number;
  status: OrderStatus;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  fulfillmentId?: string;
  fulfillmentStatusDetail?: string;
  carrier?: string;
  tracking?: string;
  trackingUrl?: string;
  shippingAddress?: ShippingAddress;
  totalWeightGrams?: number;
  items?: OrderItem[];
}
