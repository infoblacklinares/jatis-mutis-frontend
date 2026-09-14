import { useEffect, useMemo, useState } from "react";
import { getOrders } from "../services/api";
import type { Order } from "../types/order";
import { readOrders, saveOrders } from "../services/localStore";

type DispatchStatus = "Pendiente" | "Preparando" | "Enviado" | "Entregado";
const statuses: DispatchStatus[] = ["Pendiente", "Preparando", "Enviado", "Entregado"];

function dispatchStatus(order: Order): DispatchStatus | null {
  if (order.status === "Cancelado") return null;
  if (order.status === "Entregado") return "Entregado";
  if (order.status === "Enviado") return "Enviado";
  if (order.status === "Preparando") return "Preparando";
  return "Pendiente";
}

export function Dispatches() {
  const [orders, setOrders] = useState<Order[]>(readOrders());
  const [status, setStatus] = useState("Todos");
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getOrders().then((data) => {
      setOrders(data.nodes);
      saveOrders(data.nodes);
      setError("");
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "No fue posible cargar los despachos.");
    }).finally(() => setLoading(false));
  }, []);

  const dispatches = useMemo(() => orders.map((order) => ({ order, status: dispatchStatus(order) })).filter((item): item is { order: Order; status: DispatchStatus } => item.status !== null), [orders]);
  const filtered = dispatches.filter((item) => status === "Todos" || item.status === status);
  const pending = dispatches.filter((item) => item.status === "Pendiente" || item.status === "Preparando").length;
  const shipped = dispatches.filter((item) => item.status === "Enviado" || item.status === "Entregado").length;

  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Logística</p><h2>Despachos</h2></div><span className="muted">{pending} pendientes · {shipped} enviados/entregados · Shopify</span></div>
    {error && <div className="notice warning">No se pudo actualizar desde Shopify: {error}</div>}
    <div className="toolbar"><select aria-label="Filtrar despachos" value={status} onChange={(e) => setStatus(e.target.value)}><option>Todos</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
    <div className="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Transportista</th><th>Seguimiento</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={6} className="muted">Cargando despachos desde Shopify...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="muted">No hay despachos para este filtro.</td></tr> : filtered.map(({ order, status: itemStatus }) => <tr key={order.id}>
        <td><strong>{order.id}</strong></td><td>{order.customer}</td><td>{order.carrier || "Sin transportista"}</td><td className="muted">{order.tracking ? (order.trackingUrl ? <a href={order.trackingUrl} target="_blank" rel="noreferrer">{order.tracking}</a> : order.tracking) : "Sin tracking"}</td><td><span className={`status ${itemStatus === "Enviado" || itemStatus === "Entregado" ? "ok" : "warning"}`}>{itemStatus}</span></td><td><button className="action-button" onClick={() => setSelected(order)}>Ver detalle</button></td>
      </tr>)}
    </tbody></table></div>
    {selected && <div className="modal-backdrop"><div className="modal-card"><p className="eyebrow">Detalle de despacho</p><h2>{selected.id}</h2><p className="muted">{selected.customer}{selected.email ? ` · ${selected.email}` : ""}</p><div className="detail-grid"><div><small className="muted">Estado</small><strong>{dispatchStatus(selected) || "Pendiente"}</strong></div><div><small className="muted">Transportista</small><strong>{selected.carrier || "Sin asignar"}</strong></div><div><small className="muted">Seguimiento</small><strong>{selected.tracking || "Sin tracking"}</strong></div><div><small className="muted">Fulfillment Shopify</small><strong>{selected.fulfillmentStatusDetail || selected.fulfillmentStatus || "Pendiente de fulfillment"}</strong></div></div>{selected.trackingUrl && <a className="primary-button" href={selected.trackingUrl} target="_blank" rel="noreferrer">Ver seguimiento</a>}<div className="modal-actions"><button className="action-button" onClick={() => setSelected(null)}>Cerrar</button></div></div></div>}
  </section>;
}
