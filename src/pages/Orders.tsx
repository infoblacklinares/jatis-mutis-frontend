import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { OrderTable } from "../components/OrderTable";
import { readOrders, saveOrders, logActivity } from "../services/localStore";
import { getOrders } from "../services/api";
import { canPerform, getUserRole } from "../services/permissions";
import type { Order, OrderStatus } from "../types/order";

const statuses: OrderStatus[] = ["Pagado", "Pendiente", "Preparando", "Enviado", "Entregado", "Cancelado"];
const money = (value: number) => value.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export function Orders() {
  const { user } = useUser();
  const role = getUserRole(user);
  const canUpdate = canPerform(role, "orders.update");
  const [orders, setOrders] = useState<Order[]>(readOrders);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [selected, setSelected] = useState<Order | null>(null);
  const [syncError, setSyncError] = useState("");
  useEffect(() => { let active = true; getOrders().then((data) => { if (!active) return; setOrders(data.nodes); saveOrders(data.nodes); setSyncError(""); }).catch((error) => { if (active) setSyncError(error instanceof Error ? error.message : "No fue posible sincronizar los pedidos de Shopify."); }); return () => { active = false; }; }, []);
  const filteredOrders = useMemo(() => orders.filter((order) => `${order.id} ${order.customer} ${order.email ?? ""}`.toLowerCase().includes(query.toLowerCase()) && (status === "Todos" || order.status === status)), [orders, query, status]);
  const changeStatus = (nextStatus: OrderStatus) => { if (!canUpdate || !selected || selected.status === nextStatus) return; logActivity("Cambio de estado solicitado", `${selected.id}: ${selected.status} → ${nextStatus}`); setSyncError("El cambio de estado real de Shopify se implementará junto con Fulfillment. Por ahora los pedidos se muestran directamente desde Shopify."); };
  return <section className="panel full-panel"><div className="panel-header"><div><p className="eyebrow">Operación Shopify</p><h2>Pedidos</h2></div><span className="muted">{filteredOrders.length} pedidos · Shopify</span></div>{syncError && <div className="inventory-error"><strong>Información de pedidos</strong><span>{syncError}</span></div>}<div className="toolbar"><input aria-label="Buscar pedidos" placeholder="Buscar por pedido o cliente..." value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value)}><option>Todos</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></div><OrderTable orders={filteredOrders} onSelect={setSelected} />
    {selected && <div className="modal-backdrop"><div className="modal-card"><p className="eyebrow">Detalle del pedido</p><h2>{selected.id}</h2><div className="info-grid"><div><span>Cliente</span><strong>{selected.customer}</strong></div><div><span>Fecha</span><strong>{selected.date}</strong></div><div><span>Total</span><strong>{money(selected.total)}</strong></div><div><span>Pago</span><strong>{selected.paymentStatus ?? "No informado"}</strong></div></div><h3 className="modal-section-title">Estado</h3><select className="modal-status-select" disabled={!canUpdate} value={selected.status} onChange={(e) => changeStatus(e.target.value as OrderStatus)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select>{canUpdate && <small className="muted">La actualización de estados de Shopify se conectará al flujo de Fulfillment.</small>}{!canUpdate && <small className="muted">Tu rol puede consultar pedidos, pero no modificar su estado.</small>}<h3 className="modal-section-title">Despacho</h3><p className="muted">{selected.fulfillmentStatus ?? "Pendiente de información de despacho"}</p>{selected.items?.length ? <div className="table-stack">{selected.items.map((item) => <div className="detail-row" key={`${item.productId}-${item.sku}-${item.title}`}><span>{item.title} · {item.sku || "sin SKU"}</span><strong>{item.quantity} × {money(item.price)}</strong></div>)}</div> : <div className="empty-state"><strong>Sin productos en el pedido</strong><span>Shopify no devolvió líneas para este pedido.</span></div>}<div className="modal-actions"><button className="action-button" onClick={() => setSelected(null)}>Cerrar</button></div></div></div>}
  </section>;
}
