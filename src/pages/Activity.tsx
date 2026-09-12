import { useMemo, useState } from "react";
import { readActivity } from "../services/localStore";

export function Activity() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("Todos");
  const events = readActivity();
  const actions = Array.from(new Set(events.map((event) => event.action)));
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesSearch = !term || `${event.action} ${event.detail} ${event.user}`.toLowerCase().includes(term);
      return matchesSearch && (action === "Todos" || event.action === action);
    });
  }, [events, search, action]);
  const formatDate = (value: string) => new Date(value).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });

  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Auditoría</p><h2>Actividad</h2></div><span className="muted">{events.length} eventos registrados</span></div>
    <div className="toolbar"><input aria-label="Buscar actividad" placeholder="Buscar acción, referencia o usuario..." value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Filtrar actividad" value={action} onChange={(e) => setAction(e.target.value)}><option>Todos</option>{actions.map((item) => <option key={item}>{item}</option>)}</select></div>
    {filtered.length ? <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>{filtered.map((event) => <tr key={event.id}><td>{formatDate(event.date)}</td><td><strong>{event.user}</strong></td><td>{event.action}</td><td className="muted">{event.detail}</td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>Sin actividad registrada</strong><span>Las acciones realizadas desde el panel aparecerán aquí automáticamente.</span></div>}
  </section>;
}
