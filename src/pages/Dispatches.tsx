import { useMemo, useState } from "react";
import { readOrders, logActivity } from "../services/localStore";
import type { Order } from "../types/order";

type Dispatch = { id: string; customer: string; carrier: string; tracking: string; status: "Pendiente" | "Preparando" | "Enviado" | "Entregado" };
const initial: Dispatch[] = [
  { id: "#1045", customer: "María González", carrier: "Blue Express", tracking: "BX-DEMO-1045", status: "Pendiente" },
  { id: "#1044", customer: "Pedro Martínez", carrier: "Blue Express", tracking: "BX-DEMO-1044", status: "Enviado" },
  { id: "#1043", customer: "Carolina Soto", carrier: "Blue Express", tracking: "", status: "Pendiente" },
];
const statuses: Dispatch["status"][] = ["Pendiente", "Preparando", "Enviado", "Entregado"];

const loadDispatches = (): Dispatch[] => {
  try {
    const stored = JSON.parse(localStorage.getItem("jm_dispatches") || "null");
    const current = Array.isArray(stored) ? stored as Dispatch[] : initial;
    const orders = readOrders();
    const existing = new Set(current.map((item) => item.id));
    const generated = orders.filter((order) => (order.status === "Preparando" || order.status === "Enviado" || order.status === "Entregado") && !existing.has(order.id)).map((order) => ({ id: order.id, customer: order.customer, carrier: "Blue Express", tracking: "", status: order.status === "Preparando" ? "Preparando" as const : order.status === "Enviado" ? "Enviado" as const : "Entregado" as const }));
    if (generated.length) localStorage.setItem("jm_dispatches", JSON.stringify([...generated, ...current]));
    return [...generated, ...current];
  } catch { return initial; }
};

export function Dispatches() {
  const [dispatches, setDispatches] = useState<Dispatch[]>(loadDispatches);
  const [status, setStatus] = useState("Todos");
  const [selected, setSelected] = useState<Dispatch | null>(null);
  const preparedOrders = useMemo(() => readOrders().filter((order) => ["Preparando", "Enviado", "Entregado"].includes(order.status)), [dispatches]);
  const save = (next: Dispatch[]) => { setDispatches(next); localStorage.setItem("jm_dispatches", JSON.stringify(next)); };
  const update = (patch: Partial<Dispatch>) => { if (!selected) return; const next = dispatches.map((item) => item.id === selected.id ? { ...item, ...patch } : item); save(next); logActivity("Despacho actualizado", `${selected.id} · ${patch.status ?? patch.tracking ?? "datos modificados"}`); setSelected({ ...selected, ...patch }); };
  const filtered = dispatches.filter((item) => status === "Todos" || item.status === status);
  return <section className="panel full-panel"><div className="panel-header"><div><p className="eyebrow">Logística</p><h2>Despachos</h2></div><span className="muted">{preparedOrders.length} pedidos preparados · Blue Express</span></div><div className="toolbar"><select aria-label="Filtrar despachos" value={status} onChange={(e) => setStatus(e.target.value)}><option>Todos</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div><div className="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Transportista</th><th>Seguimiento</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.id}</strong></td><td>{item.customer}</td><td>{item.carrier}</td><td className="muted">{item.tracking || "Sin tracking"}</td><td><span className={`status ${item.status === "Enviado" || item.status === "Entregado" ? "ok" : "warning"}`}>{item.status}</span></td><td><button className="action-button" onClick={() => setSelected(item)}>Gestionar</button></td></tr>)}</tbody></table></div>{selected && <div className="modal-backdrop"><div className="modal-card"><p className="eyebrow">Gestión de despacho</p><h2>{selected.id}</h2><p className="muted">{selected.customer} · {selected.carrier}</p><label>Estado<select value={selected.status} onChange={(e) => update({ status: e.target.value as Dispatch["status"] })}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></label><label>Número de seguimiento<input value={selected.tracking} placeholder="Ej: 123456789" onChange={(e) => setSelected({ ...selected, tracking: e.target.value })} onBlur={(e) => update({ tracking: e.target.value })} /></label><div className="modal-actions"><button className="action-button" onClick={() => setSelected(null)}>Cerrar</button><button className="primary-button" onClick={() => { logActivity("Etiqueta solicitada", `${selected.id} · Blue Express`); alert("Flujo de etiqueta preparado para la integración con Blue Express."); }}>Preparar etiqueta</button></div></div></div>}</section>;
}
