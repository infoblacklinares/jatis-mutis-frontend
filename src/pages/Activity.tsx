const events = [
  { date: "08/09/2026 18:42", user: "Gustavo", action: "Inicio de sesión", target: "Panel interno" },
  { date: "08/09/2026 17:31", user: "Sistema", action: "Sincronización pendiente", target: "Shopify / API" },
  { date: "08/09/2026 16:20", user: "Gustavo", action: "Consulta de inventario", target: "Productos" },
  { date: "07/09/2026 15:08", user: "Vendedor", action: "Consulta de pedido", target: "#1044" },
];

export function Activity() {
  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Auditoría</p><h2>Actividad</h2></div><span className="muted">Últimos eventos · Demo</span></div>
    <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Referencia</th></tr></thead><tbody>{events.map((event, index) => <tr key={`${event.date}-${index}`}><td>{event.date}</td><td><strong>{event.user}</strong></td><td>{event.action}</td><td className="muted">{event.target}</td></tr>)}</tbody></table></div>
    <div className="empty-state"><strong>Auditoría lista para la API</strong><span>Las acciones de creación, edición, eliminación, ajustes de stock y cambios de estado deberán registrarse aquí con usuario y fecha.</span></div>
  </section>;
}
