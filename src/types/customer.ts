export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  ordersCount: number;
  totalSpent: number;
  lastPurchase: string;
  status: "Activo" | "Inactivo";
}
