import { products as initialProducts, orders as initialOrders, customers as initialCustomers } from "../data/mocks";
import type { Product } from "../types/product";
import type { Order } from "../types/order";
import type { Customer } from "../types/customer";

const keys = { products: "jm_products", orders: "jm_orders", customers: "jm_customers", activity: "jm_activity", settings: "jm_settings" } as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch { return fallback; }
}

function write<T>(key: string, value: T) { localStorage.setItem(key, JSON.stringify(value)); }

export interface ActivityEvent { id: string; action: string; detail: string; date: string; user: string; }
export interface SettingsData { stockThreshold: number; autoSync: boolean; }

export const readProducts = () => read<Product[]>(keys.products, initialProducts);
export const saveProducts = (value: Product[]) => write(keys.products, value);
export const readOrders = () => read<Order[]>(keys.orders, initialOrders);
export const saveOrders = (value: Order[]) => write(keys.orders, value);
export const readCustomers = () => read<Customer[]>(keys.customers, initialCustomers);
export const saveCustomers = (value: Customer[]) => write(keys.customers, value);
export const readActivity = () => read<ActivityEvent[]>(keys.activity, []);
export const logActivity = (action: string, detail: string) => {
  const events = readActivity();
  events.unshift({ id: crypto.randomUUID(), action, detail, date: new Date().toISOString(), user: "Usuario actual" });
  write(keys.activity, events.slice(0, 100));
};
export const readSettings = () => read<SettingsData>(keys.settings, { stockThreshold: 5, autoSync: false });
export const saveSettings = (value: SettingsData) => write(keys.settings, value);
