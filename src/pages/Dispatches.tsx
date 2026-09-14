import { useEffect, useMemo, useState } from "react";
import { getOrders, updateOrder } from "../services/api";
import type { Order } from "../types/order";
import { readOrders, saveOrders, logActivity } from "../services/localStore";
import { canPerform, getUserRole } from "../services/permissions";

type DispatchStatus = "Pendiente" | "Preparando" | "Enviado" | "Entregado";
const statuses: DispatchStatus[] = ["Pendiente", "Preparando", "Enviado", "Entregado"];

function dispatchStatus(order: Order): DispatchStatus | null {
  if (order.status === "Cancelado") return null;
  if (order.status === "Entregado") return "Entregado";
  if (order.status === "Enviado") return "Enviado";
  if (order.status === "Preparando") return "Preparando";
  return "Pendiente";
}

function formatWeight(grams?: number) {
  if (!grams) return "No informado";
  return grams >= 1000 ? `${(grams / 1000).toLocaleString("es-CL", { maximumFractionDigits: 2 })} kg` : `${Math.round(grams)} g`;
}

export function Dispatches() {
  const { user } = useUser();
  const canManage = canPerform(getUserRole(user), "dispatches.manage");
  const [orders, setOrders] = useState<Order[]>(readOrders());
  const [status, setStatus] = useState("Todos");
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  const refresh = async () => {
    const data = await getOrders();
    setOrders(data.nodes);
    saveOrders(data.nodes);
    if (selected?.shopifyId) setSelected(data.nodes.find((order) => order.shopifyId === selected.shopifyId) || null);
  };

  useEffect(() => {
    getOrders().then((data) => { setOrders(data.nodes); saveOrders(data.nodes); setError(""); }).catch((err) => setError(err instanceof Error ? err.message : "No fue posible cargar los despachos.")).finally(() => setLoading(false));
  }, []);

  const dispatches = useMemo(() => orders.map((order) => ({ order, status: dispatchStatus(order) })).filter((item): item is { order: Order; status: DispatchStatus } => item.status !== null), [orders]);
  const filtered = dispatches.filter((item) => status === "Todos" || item.status === status);
  const pending = dispatches.filter((item) => item.status === "Pendiente" || item.status === "Preparando").length;
  const shipped = dispatches.filter((item) => item.status === "Enviado" || item.status === "Entregado").length;

  const openDispatch = (order: Order) => {
    setSelected(order); setCarrier(order.carrier || ""); setTracking(order.tracking || ""); setTrackingUrl(order.trackingUrl || ""); setError("");
  };

  const markShipped = async () => {
    if (!canManage || !selected?.shopifyId || saving) return;
    setSaving(true); setError("");
    try {
      await updateOrder({ orderId: selected.shopifyId, action: "fulfill", tracking: { company: carrier, number: tracking, url: trackingUrl }, notifyCustomer: false });
      logActivity("Despacho creado", `${selected.id} enviado desde Despachos`);
      await refresh();
      setError("Despacho actualizado en Shopify.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible crear el despacho en Shopify.");
    } finally { setSaving(false); }
  };

  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Logística</p><h2>Despachos</h2></div><span className="muted">{pending} pendientes · {shipped} enviados/entregados · Shopify</span></div>
    {error && <div className="notice warning">{error}</div>}
    <div className="toolbar"><select aria-label="Filtrar despachos" value={status} onChange={(e) => setStatus(e.target.value)}><option>Todos</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
    <div className="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Destino</th><th>Peso</th><th>Transportista</th><th>Seguimiento</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={8} className="muted">Cargando despachos desde Shopify...</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="muted">No hay despachos para este filtro.</td></tr> : filtered.map(({ order, status: itemStatus }) => <tr key={order.id}>
        <td><strong>{order.id}</strong></td><td>{order.customer}</td><td>{order.shippingAddress?.city || "Sin destino"}</td><td>{formatWeight(order.totalWeightGrams)}</td><td>{order.carrier || "Sin transportista"}</td><td className="muted">{order.tracking ? (order.trackingUrl ? <a href={order.trackingUrl} target="_blank" rel="noreferrer">{order.tracking}</a> : order.tracking) : "Sin tracking"}</td><td><span className={`status ${itemStatus === "Enviado" || itemStatus === "Entregado" ? "ok" : "warning"}`}>{itemStatus}</span></td><td><button className="action-button" onClick={() => openDispatch(order)}>Gestionar</button></td>
      </tr>)}
    </tbody></table></div>
    {selected && <div className="modal-backdrop"><div className="modal-card"><p className="eyebrow">Detalle de despacho</p><h2>{selected.id}</h2><p className="muted">{selected.customer}{selected.email ? ` · ${selected.email}` : ""}</p>
      <div className="detail-grid"><div><small className="muted">Estado</small><strong>{dispatchStatus(selected) || "Pendiente"}</strong></div><div><small className="muted">Fulfillment Shopify</small><strong>{selected.fulfillmentStatusDetail || selected.fulfillmentStatus || "Pendiente"}</strong></div><div><small className="muted">Peso total</small><strong>{formatWeight(selected.totalWeightGrams)}</strong></div><div><small className="muted">Destino</small><strong>{selected.shippingAddress?.city || "Sin dirección"}</strong></div></div>
      {selected.shippingAddress && <div className="dispatch-summary"><span>Dirección de entrega</span><strong>{selected.shippingAddress.name || selected.customer}</strong><span>{selected.shippingAddress.address1}{selected.shippingAddress.address2 ? `, ${selected.shippingAddress.address2}` : ""}</span><span>{selected.shippingAddress.city}{selected.shippingAddress.province ? `, ${selected.shippingAddress.province}` : ""}{selected.shippingAddress.zip ? ` · ${selected.shippingAddress.zip}` : ""}</span>{selected.shippingAddress.phone && <span>Teléfono: {selected.shippingAddress.phone}</span>}</div>}
      {!selected.totalWeightGrams && <div className="notice warning">Este pedido no tiene peso registrado. Para Blue Express debemos completar el peso de los productos antes de generar el despacho.</div>}
      {canManage && selected.status !== "Enviado" && selected.status !== "Entregado" && <div className="fulfillment-form"><h3 className="modal-section-title">Crear despacho en Shopify</h3><div className="form-grid"><label>Transportista<input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Ej. Blue Express" /></label><label>Número de seguimiento<input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Opcional" /></label><label className="form-grid-wide">URL de seguimiento<input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://..." /></label></div><button className="primary-button" disabled={saving} onClick={markShipped}>{saving ? "Creando despacho…" : "Marcar enviado en Shopify"}</button></div>}
      {selected.trackingUrl && <a className="primary-button" href={selected.trackingUrl} target="_blank" rel="noreferrer">Ver seguimiento</a>}<div className="modal-actions"><button className="action-button" onClick={() => setSelected(null)}>Cerrar</button></div></div></div>}
  </section>;
}
