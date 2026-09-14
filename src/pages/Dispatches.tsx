import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { getOrders, updateOrder } from "../services/api";
import type { Order } from "../types/order";
import { readOrders, saveOrders, logActivity } from "../services/localStore";
import { canPerform, getUserRole } from "../services/permissions";
import "../dispatches.css";

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
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [length, setLength] = useState(0);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

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
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return dispatches.filter((item) => {
      const matchesStatus = status === "Todos" || item.status === status;
      if (!term) return matchesStatus;
      const haystack = [item.order.id, item.order.customer, item.order.email, item.order.shippingAddress?.city, item.order.carrier, item.order.tracking].filter(Boolean).join(" ").toLowerCase();
      return matchesStatus && haystack.includes(term);
    });
  }, [dispatches, search, status]);
  const pending = dispatches.filter((item) => item.status === "Pendiente" || item.status === "Preparando").length;
  const shipped = dispatches.filter((item) => item.status === "Enviado" || item.status === "Entregado").length;
  const withoutWeight = dispatches.filter(({ order }) => !order.totalWeightGrams).length;
  const volumetricWeightGrams = length > 0 && width > 0 && height > 0 ? (length * width * height / 4000) * 1000 : 0;
  const realWeightGrams = selected?.totalWeightGrams || 0;
  const chargeableWeightGrams = Math.max(realWeightGrams, volumetricWeightGrams);

  const openDispatch = (order: Order) => {
    const firstItem = order.items?.[0];
    const allItemsShareDimensions = Boolean(order.items?.length) && order.items!.every((item) => {
      const dims = item.packageDimensionsCm;
      return dims && dims.length > 0 && dims.width > 0 && dims.height > 0 && dims.length === firstItem?.packageDimensionsCm?.length && dims.width === firstItem?.packageDimensionsCm?.width && dims.height === firstItem?.packageDimensionsCm?.height;
    });
    const dimensions = allItemsShareDimensions ? firstItem?.packageDimensionsCm : undefined;
    setSelected(order); setCarrier(order.carrier || ""); setTracking(order.tracking || ""); setTrackingUrl(order.trackingUrl || "");
    setLength(dimensions?.length || 0); setWidth(dimensions?.width || 0); setHeight(dimensions?.height || 0); setError("");
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
    {error && <div className={`notice ${error.includes("actualizado") ? "success" : "warning"}`}>{error}</div>}
    <div className="dispatch-metrics"><div><span>Pendientes</span><strong>{pending}</strong><small>Por preparar o gestionar</small></div><div><span>Enviados</span><strong>{shipped}</strong><small>Con fulfillment completado</small></div><div><span>Sin peso</span><strong>{withoutWeight}</strong><small>Requieren completar datos</small></div></div>
    <div className="dispatch-toolbar"><div className="dispatch-search"><span aria-hidden="true">⌕</span><input aria-label="Buscar despachos" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar pedido, cliente, ciudad o tracking..." /></div><select aria-label="Filtrar despachos" value={status} onChange={(e) => setStatus(e.target.value)}><option>Todos</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
    <div className="dispatch-results"><span>{filtered.length} despacho{filtered.length === 1 ? "" : "s"}</span>{search && <button type="button" onClick={() => setSearch("")}>Limpiar búsqueda</button>}</div>
    <div className="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Destino</th><th>Peso</th><th>Transportista</th><th>Seguimiento</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={8} className="muted">Cargando despachos desde Shopify...</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} className="muted">No hay despachos para este filtro.</td></tr> : filtered.map(({ order, status: itemStatus }) => <tr key={order.id}>
        <td><strong>{order.id}</strong></td><td>{order.customer}</td><td>{order.shippingAddress?.city || "Sin destino"}</td><td>{formatWeight(order.totalWeightGrams)}</td><td>{order.carrier || "Sin transportista"}</td><td className="muted dispatch-table-tracking">{order.tracking ? (order.trackingUrl ? <a href={order.trackingUrl} target="_blank" rel="noreferrer">{order.tracking}</a> : order.tracking) : "Sin tracking"}</td><td><span className={`status ${itemStatus === "Enviado" || itemStatus === "Entregado" ? "ok" : "warning"}`}>{itemStatus}</span></td><td><button className="action-button" onClick={() => openDispatch(order)}>Gestionar</button></td>
      </tr>)}
    </tbody></table></div>
    {selected && <div className="modal-backdrop"><div className="modal-card dispatch-modal"><p className="eyebrow">Detalle de despacho</p><h2>{selected.id}</h2><p className="muted">{selected.customer}{selected.email ? ` · ${selected.email}` : ""}</p>
      <div className="detail-grid"><div><small className="muted">Estado</small><strong>{dispatchStatus(selected) || "Pendiente"}</strong></div><div><small className="muted">Fulfillment Shopify</small><strong>{selected.fulfillmentStatusDetail || selected.fulfillmentStatus || "Pendiente"}</strong></div><div><small className="muted">Peso total</small><strong>{formatWeight(selected.totalWeightGrams)}</strong></div><div><small className="muted">Destino</small><strong>{selected.shippingAddress?.city || "Sin dirección"}</strong></div></div>
      {selected.shippingAddress && <div className="dispatch-summary"><span>Dirección de entrega</span><strong>{selected.shippingAddress.name || selected.customer}</strong><span>{selected.shippingAddress.address1}{selected.shippingAddress.address2 ? `, ${selected.shippingAddress.address2}` : ""}</span><span>{selected.shippingAddress.city}{selected.shippingAddress.province ? `, ${selected.shippingAddress.province}` : ""}{selected.shippingAddress.zip ? ` · ${selected.shippingAddress.zip}` : ""}</span>{selected.shippingAddress.phone && <span>Teléfono: {selected.shippingAddress.phone}</span>}</div>}
      {!selected.totalWeightGrams && <div className="notice warning dispatch-notice">Este pedido no tiene peso registrado. Para Blue Express debemos completar el peso de los productos antes de generar el despacho.</div>}
      {canManage && selected.status !== "Enviado" && selected.status !== "Entregado" && <div className="fulfillment-form"><h3 className="modal-section-title">Preparar paquete</h3><p className="muted">Las medidas se cargan automáticamente cuando todos los productos del pedido tienen las mismas dimensiones guardadas en Shopify. Si el pedido combina productos distintos, ingrésalas manualmente según el embalaje real.</p><div className="form-grid"><label>Transportista<input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Ej. Blue Express" /></label><label>Número de seguimiento<input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Se completa al generar el envío" /></label><label>Largo (cm)<input type="number" min="0" step="0.1" value={length || ""} onChange={(e) => setLength(Number(e.target.value) || 0)} /></label><label>Ancho (cm)<input type="number" min="0" step="0.1" value={width || ""} onChange={(e) => setWidth(Number(e.target.value) || 0)} /></label><label>Alto (cm)<input type="number" min="0" step="0.1" value={height || ""} onChange={(e) => setHeight(Number(e.target.value) || 0)} /></label><label className="form-grid-wide">URL de seguimiento<input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="Se completará al generar el envío" /></label></div><div className="dispatch-summary"><span>Peso real: <strong>{formatWeight(realWeightGrams)}</strong></span><span>Peso volumétrico: <strong>{formatWeight(volumetricWeightGrams)}</strong></span><span>Peso cobrable estimado: <strong>{formatWeight(chargeableWeightGrams)}</strong></span></div><button className="primary-button" disabled={saving} onClick={markShipped}>{saving ? "Creando despacho…" : "Marcar enviado en Shopify"}</button></div>}
      {selected.trackingUrl && <a className="primary-button dispatch-link" href={selected.trackingUrl} target="_blank" rel="noreferrer">Ver seguimiento</a>}<div className="modal-actions"><button className="action-button" onClick={() => setSelected(null)}>Cerrar</button></div></div></div>}
  </section>;
}
