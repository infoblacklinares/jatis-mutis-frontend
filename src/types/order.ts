export type OrderStatus = "Pagado" | "Pendiente" | "Preparando" | "Enviado" | "Entregado" | "Cancelado";

export interface OrderItem {
  productId: string;
  title: string;
  sku: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
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
  items?: OrderItem[];
}
