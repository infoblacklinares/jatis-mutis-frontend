import { useMemo, useState } from "react";
import { OrderTable } from "../components/OrderTable";
import { readOrders, saveOrders, logActivity } from "../services/localStore";
import type { Order, OrderStatus } from "../types/order";

const statuses: OrderStatus[] = ["Pagado", "Pendiente", "Preparando", "Enviado", "Entregado", "Cancelado"];
const money = (value: number) => value.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export function Orders() {
  const [orders, setOrders] = useState<Order[]>(readOrders);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [selected, setSelected] = useState<Order | null>(null);
  const filteredOrders = useMemo(() => orders.filter((order) => `${order.id} ${order.customer} ${order.email ?? ""}`.toLowerCase().includes(query.toLowerCase()) && (status === "Todos" || order.status === status)), [orders, query, status]);
  const changeStatus = (nextStatus: OrderStatus) => {
    if (!selected || selected.status === nextStatus) return;
    const next = orders.map((order) => order.id === selected.id ? { ...order, status: nextStatus } : order);
    setOrders(next); saveOrders(next); logActivity("Estado de pedido actualizado", `${selected.id}: ${selected.status} → ${nextStatus}`); setSelected({ ...selected, status: nextStatus });
  };
  return <section className="panel full-panel"><div className="panel-header"><div><p className="eyebrow">Operación Shopify</p><h2>Pedidos</h2></div><span className="muted">{filteredOrders.length} pedidos</span></div><div className="toolbar"><input aria-label="Buscar pedidos" placeholder="Buscar por pedido o cliente..." value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value)}><option>Todos</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></div><OrderTable orders={filteredOrders} onSelect={setSelected} />
    {selected && <div className="modal-backdrop"><div className="modal-card"><p className="eyebrow">Detalle del pedido</p><h2>{selected.id}</h2><div className="info-grid"><div><span>Cliente</span><strong>{selected.customer}</strong></div><div><span>Fecha</span><strong>{selected.date}</strong></div><div><span>Total</span><strong>{money(selected.total)}</strong></div><div><span>Pago</span><strong>{selected.paymentStatus ?? "No informado"}</strong></div></div><h3 className="modal-section-title">Estado</h3><select className="modal-status-select" value={selected.status} onChange={(e) => changeStatus(e.target.value as OrderStatus)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select><h3 className="modal-section-title">Despacho</h3><p className="muted">{selected.fulfillmentStatus ?? "Pendiente de información de despacho"}</p>{selected.items?.length ? <div className="table-stack">{selected.items.map((item) => <div className="detail-row" key={`${item.productId}-${item.sku}`}><span>{item.title} · {item.sku || "sin SKU"}</span><strong>{item.quantity} × {money(item.price)}</strong></div>)}</div> : <div className="empty-state"><strong>Sin detalle de productos</strong><span>La API incorporará los ítems reales del pedido.</span></div>}<div className="modal-actions"><button className="action-button" onClick={() => setSelected(null)}>Cerrar</button></div></div></div>}
  </section>;
}
