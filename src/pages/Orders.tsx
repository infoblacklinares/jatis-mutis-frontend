import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { OrderTable } from "../components/OrderTable";
import { readOrders, saveOrders, logActivity } from "../services/localStore";
import { getOrders, updateOrder } from "../services/api";
import { canPerform, getUserRole } from "../services/permissions";
import type { Order } from "../types/order";

const statuses = ["Todos", "Pagado", "Pendiente", "Preparando", "Enviado", "Entregado", "Cancelado"];
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
  const [actionLoading, setActionLoading] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(false);

  const refreshOrders = async () => {
    const data = await getOrders();
    setOrders(data.nodes);
    saveOrders(data.nodes);
    if (selected?.shopifyId) {
      setSelected(data.nodes.find((order) => order.shopifyId === selected.shopifyId) || null);
    }
  };

  useEffect(() => { let active = true; getOrders().then((data) => { if (!active) return; setOrders(data.nodes); saveOrders(data.nodes); setSyncError(""); }).catch((error) => { if (active) setSyncError(error instanceof Error ? error.message : "No fue posible sincronizar los pedidos de Shopify."); }); return () => { active = false; }; }, []);

  const filteredOrders = useMemo(() => orders.filter((order) => `${order.id} ${order.customer} ${order.email ?? ""}`.toLowerCase().includes(query.toLowerCase()) && (status === "Todos" || order.status === status)), [orders, query, status]);

  const openOrder = (order: Order) => {
    setSelected(order);
    setCarrier(order.carrier || "");
    setTracking(order.tracking || "");
    setTrackingUrl(order.trackingUrl || "");
    setNotifyCustomer(false);
    setSyncError("");
  };

  const executeAction = async (action: "fulfill" | "cancel") => {
    if (!canUpdate || !selected?.shopifyId || actionLoading) return;
    if (action === "cancel" && !window.confirm(`¿Cancelar el pedido ${selected.id} en Shopify? El stock será repuesto.`)) return;
    setActionLoading(action);
    setSyncError("");
    try {
      await updateOrder({
        orderId: selected.shopifyId,
        action,
        tracking: action === "fulfill" ? { company: carrier, number: tracking, url: trackingUrl } : undefined,
        notifyCustomer,
        restock: true,
        staffNote: `Gestionado desde Jatis Mutis por ${user?.firstName || "usuario"}`,
      });
      logActivity(action === "fulfill" ? "Pedido enviado" : "Pedido cancelado", `${selected.id} actualizado en Shopify`);
      await refreshOrders();
      setSyncError(action === "fulfill" ? "Pedido marcado como enviado en Shopify." : "Pedido cancelado en Shopify.");
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No fue posible actualizar el pedido en Shopify.");
    } finally {
      setActionLoading("");
    }
  };

  return <section className="panel full-panel"><div className="panel-header"><div><p className="eyebrow">Operación Shopify</p><h2>Pedidos</h2></div><span className="muted">{filteredOrders.length} pedidos · Shopify</span></div>{syncError && <div className="inventory-error"><strong>Información de pedidos</strong><span>{syncError}</span></div>}<div className="toolbar"><input aria-label="Buscar pedidos" placeholder="Buscar por pedido o cliente..." value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></div><OrderTable orders={filteredOrders} onSelect={openOrder} />
    {selected && <div className="modal-backdrop"><div className="modal-card"><p className="eyebrow">Detalle del pedido</p><h2>{selected.id}</h2><div className="info-grid"><div><span>Cliente</span><strong>{selected.customer}</strong></div><div><span>Fecha</span><strong>{selected.date}</strong></div><div><span>Total</span><strong>{money(selected.total)}</strong></div><div><span>Pago</span><strong>{selected.paymentStatus ?? "No informado"}</strong></div></div><h3 className="modal-section-title">Estado Shopify</h3><div className="status-summary"><strong>{selected.status}</strong><span>{selected.fulfillmentStatus ?? "Sin información de fulfillment"}</span></div>{canUpdate && selected.status !== "Cancelado" && selected.status !== "Enviado" && selected.status !== "Entregado" && <div className="fulfillment-form"><h3 className="modal-section-title">Preparar despacho</h3><div className="form-grid"><label>Transportista<input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Ej. Blue Express" /></label><label>Número de seguimiento<input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Opcional" /></label><label className="form-grid-wide">URL de seguimiento<input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://..." /></label></div><label className="checkbox-row"><input type="checkbox" checked={notifyCustomer} onChange={(e) => setNotifyCustomer(e.target.checked)} /> Notificar al cliente por correo</label><button className="primary-button" disabled={Boolean(actionLoading)} onClick={() => executeAction("fulfill")}>{actionLoading === "fulfill" ? "Enviando…" : "Marcar como enviado en Shopify"}</button></div>}{canUpdate && selected.status !== "Cancelado" && <div className="modal-actions"><button className="danger-button" disabled={Boolean(actionLoading)} onClick={() => executeAction("cancel")}>{actionLoading === "cancel" ? "Cancelando…" : "Cancelar pedido"}</button></div>}{!canUpdate && <small className="muted">Tu rol puede consultar pedidos, pero no modificarlos.</small>}{selected.fulfillmentStatus && <div className="dispatch-summary"><span>Fulfillment</span><strong>{selected.fulfillmentStatusDetail || selected.fulfillmentStatus}</strong>{selected.carrier && <span>Transportista: {selected.carrier}</span>}{selected.tracking && <span>Seguimiento: {selected.tracking}</span>}{selected.trackingUrl && <a href={selected.trackingUrl} target="_blank" rel="noreferrer">Ver seguimiento</a>}</div>}<h3 className="modal-section-title">Productos</h3>{selected.items?.length ? <div className="table-stack">{selected.items.map((item) => <div className="detail-row" key={`${item.productId}-${item.sku}-${item.title}`}><span>{item.title} · {item.sku || "sin SKU"}</span><strong>{item.quantity} × {money(item.price)}</strong></div>)}</div> : <div className="empty-state"><strong>Sin productos en el pedido</strong><span>Shopify no devolvió líneas para este pedido.</span></div>}<div className="modal-actions"><button className="action-button" onClick={() => setSelected(null)}>Cerrar</button></div></div></div>}
  </section>;
}
