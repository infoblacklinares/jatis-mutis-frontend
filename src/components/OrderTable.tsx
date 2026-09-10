import type { Order } from "../types/order";

const money = (value: number) => value.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export function OrderTable({ orders }: { orders: Order[] }) {
  return <div className="orders-list">{orders.map((order) => <article className="order-row" key={order.id}>
    <div><strong>{order.id}</strong><span>{order.date}</span></div>
    <div><span>{order.customer}</span><strong>{money(order.total)}</strong></div>
    <span className="status ok">{order.status}</span>
  </article>)}</div>;
}
