import type { Order } from "../types/order";
const money = (value: number) => value.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
export function OrderTable({ orders, onSelect }: { orders: Order[]; onSelect?: (order: Order) => void }) {
  return <div className="orders-list">{orders.map((order) => <article className={`order-row ${onSelect ? "clickable" : ""}`} key={order.id} onClick={() => onSelect?.(order)}><div><strong>{order.id}</strong><span>{order.date}</span></div><div><span>{order.customer}</span><strong>{money(order.total)}</strong></div><span className={`status ${order.status === "Cancelado" ? "danger" : order.status === "Entregado" ? "ok" : "warning"}`}>{order.status}</span></article>)}</div>;
}
