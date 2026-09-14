import { useEffect, useMemo, useState } from "react";
import { getCustomers, getOrders } from "../services/api";
import { readCustomers, readOrders, saveCustomers, saveOrders } from "../services/localStore";
import type { Customer } from "../types/customer";
import type { Order } from "../types/order";

const money = (value: number) => value.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const formatDate = (value: string) => value && value !== "Sin compras" ? new Date(value).toLocaleDateString("es-CL") : "Sin compras";

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>(readCustomers);
  const [orders, setOrders] = useState<Order[]>(readOrders);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Todos");
  const [selected, setSelected] = useState<Customer | null>(null);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getCustomers(), getOrders()]).then(([customerData, orderData]) => {
      if (!active) return;
      setCustomers(customerData.nodes); saveCustomers(customerData.nodes);
      setOrders(orderData.nodes); saveOrders(orderData.nodes);
      setSyncError("");
    }).catch((error) => {
      if (active) setSyncError(error instanceof Error ? error.message : "No fue posible sincronizar Shopify.");
    });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => customers.filter((customer) => {
    const term = search.toLowerCase().trim();
    return (!term || `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(term)) && (status === "Todos" || customer.status === status);
  }), [customers, search, status]);

  const history = selected ? orders.filter((order) => order.customer === selected.name || order.email === selected.email).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const totalOrders = customers.reduce((sum, customer) => sum + customer.ordersCount, 0);

  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Shopify</p><h2>Clientes</h2></div><span className="muted">{filtered.length} clientes · {totalOrders} pedidos</span></div>
    {syncError && <div className="inventory-error"><strong>No se pudo sincronizar Shopify</strong><span>{syncError}</span></div>}
    <div className="toolbar"><input className="search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, correo o teléfono..." /><select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}><option>Todos</option><option>Activo</option><option>Inactivo</option></select></div>
    <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Contacto</th><th>Pedidos</th><th>Total comprado</th><th>Última compra</th><th>Estado</th></tr></thead><tbody>{filtered.map((customer) => <tr key={customer.id} className="clickable" onClick={() => setSelected(customer)}><td><strong>{customer.name}</strong></td><td><div className="table-stack"><span>{customer.email}</span><span className="muted">{customer.phone}</span></div></td><td>{customer.ordersCount}</td><td>{money(customer.totalSpent)}</td><td>{formatDate(customer.lastPurchase)}</td><td><span className={`status ${customer.status === "Activo" ? "ok" : "warning"}`}>{customer.status}</span></td></tr>)}</tbody></table></div>
    {!filtered.length && <div className="empty-state"><strong>No hay clientes</strong><span>No encontramos clientes con los filtros actuales.</span></div>}
    {selected && <div className="modal-backdrop"><div className="modal-card"><p className="eyebrow">Ficha del cliente</p><h2>{selected.name}</h2><div className="info-grid"><div><span>Correo</span><strong>{selected.email}</strong></div><div><span>Teléfono</span><strong>{selected.phone}</strong></div><div><span>Pedidos</span><strong>{selected.ordersCount}</strong></div><div><span>Total comprado</span><strong>{money(selected.totalSpent)}</strong></div></div><h3 className="modal-section-title">Historial de pedidos</h3>{history.length ? <div className="table-stack">{history.map((order) => <div className="detail-row" key={order.id}><span>{order.id} · {formatDate(order.date)}</span><strong>{money(order.total)}</strong></div>)}</div> : <div className="empty-state"><strong>Sin pedidos asociados</strong><span>El cliente no tiene pedidos que coincidan con su correo o nombre en la sincronización actual.</span></div>}<div className="modal-actions"><button className="action-button" onClick={() => setSelected(null)}>Cerrar</button></div></div></div>}
  </section>;
}
