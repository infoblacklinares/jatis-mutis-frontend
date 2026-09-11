import { useState } from "react";

const dispatches = [
  { id: "#1045", customer: "María González", carrier: "Blue Express", tracking: "BX-DEMO-1045", status: "Pendiente" },
  { id: "#1044", customer: "Pedro Martínez", carrier: "Blue Express", tracking: "BX-DEMO-1044", status: "Enviado" },
  { id: "#1043", customer: "Carolina Soto", carrier: "Blue Express", tracking: "—", status: "Pendiente" },
];

export function Dispatches() {
  const [status, setStatus] = useState("Todos");
  const filtered = dispatches.filter((item) => status === "Todos" || item.status === status);
  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Logística</p><h2>Despachos</h2></div><span className="muted">Blue Express · Demo</span></div>
    <div className="toolbar"><select aria-label="Filtrar despachos" value={status} onChange={(e) => setStatus(e.target.value)}><option>Todos</option><option>Pendiente</option><option>Enviado</option></select></div>
    <div className="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Transportista</th><th>Seguimiento</th><th>Estado</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.id}</strong></td><td>{item.customer}</td><td>{item.carrier}</td><td className="muted">{item.tracking}</td><td><span className={`status ${item.status === "Enviado" ? "ok" : "warning"}`}>{item.status}</span></td></tr>)}</tbody></table></div>
    <div className="empty-state"><strong>Integración preparada</strong><span>Cuando la API exponga los datos de Blue Express, aquí se podrán gestionar etiquetas, tracking y estados sin cambiar la interfaz.</span></div>
  </section>;
}
