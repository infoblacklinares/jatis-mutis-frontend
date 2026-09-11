import { useMemo, useState } from "react";
import { customers } from "../data/mocks";

const money = (value: number) => value.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export function Customers() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");

  const filtered = useMemo(() => customers.filter((customer) => {
    const term = search.toLowerCase().trim();
    const matchesSearch = !term || customer.name.toLowerCase().includes(term) || customer.email.toLowerCase().includes(term) || customer.phone.includes(term);
    const matchesStatus = status === "Todos" || customer.status === status;
    return matchesSearch && matchesStatus;
  }), [search, status]);

  return (
    <section className="panel full-panel">
      <div className="panel-header">
        <div><p className="eyebrow">Shopify</p><h2>Clientes</h2></div>
        <span className="muted">{filtered.length} clientes</span>
      </div>
      <div className="toolbar">
        <input className="search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, correo o teléfono..." />
        <select className="filter-select" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option>Todos</option><option>Activo</option><option>Inactivo</option>
        </select>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Contacto</th><th>Pedidos</th><th>Total comprado</th><th>Última compra</th><th>Estado</th></tr></thead>
        <tbody>{filtered.map((customer) => <tr key={customer.id}>
          <td><strong>{customer.name}</strong></td>
          <td><div className="table-stack"><span>{customer.email}</span><span className="muted">{customer.phone}</span></div></td>
          <td>{customer.ordersCount}</td><td>{money(customer.totalSpent)}</td><td>{customer.lastPurchase}</td>
          <td><span className={`status ${customer.status === "Activo" ? "ok" : "warning"}`}>{customer.status}</span></td>
        </tr>)}</tbody>
      </table></div>
    </section>
  );
}
