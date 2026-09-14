import "../dashboard.css";
import { useEffect, useMemo, useState } from "react";
import { OrderTable } from "../components/OrderTable";
import { ProductTable } from "../components/ProductTable";
import { StatCard } from "../components/StatCard";
import { getCustomers, getOrders, getProducts, apiConfigured } from "../services/api";
import { readActivity, readCustomers, readOrders, readProducts, readSettings, saveCustomers, saveOrders, saveProducts } from "../services/localStore";
import type { Product } from "../types/product";
import type { Order } from "../types/order";
import type { Customer } from "../types/customer";

const money = (value: number) => value.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const orderTime = (order: Order) => order.createdAt ? Date.parse(order.createdAt) : Date.parse(order.date);

export function Dashboard() {
  const [period, setPeriod] = useState("30");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>(readProducts());
  const [orders, setOrders] = useState<Order[]>(readOrders());
  const [customers, setCustomers] = useState<Customer[]>(readCustomers());
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState("");
  const activity = readActivity();
  const settings = readSettings();

  useEffect(() => {
    Promise.all([getProducts(), getOrders(), getCustomers()]).then(([productData, orderData, customerData]) => {
      setProducts(productData.nodes); setOrders(orderData.nodes); setCustomers(customerData.nodes);
      saveProducts(productData.nodes); saveOrders(orderData.nodes); saveCustomers(customerData.nodes); setSyncError("");
    }).catch((error) => setSyncError(error instanceof Error ? error.message : "No fue posible actualizar los datos.")).finally(() => setLoading(false));
  }, []);

  const allVariants = products.flatMap((product) => product.variants);
  const totalUnits = allVariants.reduce((sum, variant) => sum + variant.quantity, 0);
  const lowStock = allVariants.filter((variant) => variant.quantity > 0 && variant.quantity <= settings.stockThreshold).length;
  const outOfStock = allVariants.filter((variant) => variant.quantity === 0).length;
  const cutoff = Date.now() - Number(period) * 24 * 60 * 60 * 1000;
  const periodOrders = orders.filter((order) => { const time = orderTime(order); return !Number.isNaN(time) && time >= cutoff; });
  const sales = periodOrders.reduce((sum, order) => sum + order.total, 0);
  const pendingOrders = orders.filter((order) => ["Pendiente", "Preparando"].includes(order.status)).length;
  const shippedOrders = orders.filter((order) => ["Enviado", "Entregado"].includes(order.status)).length;
  const normalizedSearch = search.trim().toLowerCase();
  const matchingProducts = useMemo(() => normalizedSearch ? products.filter((product) => product.title.toLowerCase().includes(normalizedSearch) || product.variants.some((variant) => variant.sku.toLowerCase().includes(normalizedSearch))) : [], [products, normalizedSearch]);
  const matchingOrders = useMemo(() => normalizedSearch ? orders.filter((order) => order.id.toLowerCase().includes(normalizedSearch) || order.customer.toLowerCase().includes(normalizedSearch) || order.email?.toLowerCase().includes(normalizedSearch)) : [], [orders, normalizedSearch]);
  const matchingCustomers = useMemo(() => normalizedSearch ? customers.filter((customer) => customer.name.toLowerCase().includes(normalizedSearch) || customer.email.toLowerCase().includes(normalizedSearch) || customer.phone.toLowerCase().includes(normalizedSearch)) : [], [customers, normalizedSearch]);
  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);
  const salesByDay = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (6 - index)); const next = new Date(day); next.setDate(day.getDate() + 1);
    const value = orders.filter((order) => { const time = orderTime(order); return !Number.isNaN(time) && time >= day.getTime() && time < next.getTime(); }).reduce((sum, order) => sum + order.total, 0);
    return { label: day.toLocaleDateString("es-CL", { weekday: "short" }).replace(".", ""), value };
  });
  const maxSale = Math.max(...salesByDay.map((item) => item.value), 1);

  return <>
    <div className="dashboard-search"><span aria-hidden="true">⌕</span><input aria-label="Buscar en el panel" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto, pedido o cliente..." /><kbd>Ctrl + K</kbd></div>
    {normalizedSearch && <section className="panel dashboard-search-results"><div className="panel-header"><div><p className="eyebrow">Búsqueda</p><h2>Resultados para “{search.trim()}”</h2></div><button type="button" className="dashboard-clear-search" onClick={() => setSearch("")}>Limpiar</button></div><div className="search-result-grid"><div><span>Productos</span><strong>{matchingProducts.length}</strong></div><div><span>Pedidos</span><strong>{matchingOrders.length}</strong></div><div><span>Clientes</span><strong>{matchingCustomers.length}</strong></div></div>{(matchingProducts.length + matchingOrders.length + matchingCustomers.length) === 0 && <p className="muted dashboard-empty-search">No encontramos coincidencias en los datos sincronizados.</p>}</section>}
    {syncError && <div className="notice warning">No se pudieron actualizar todos los datos desde Shopify: {syncError}</div>}
    <section className="stats-grid"><StatCard label="Productos" value={loading ? "…" : String(products.length)} detail={`${allVariants.length} variantes`} /><StatCard label="Stock bajo" value={loading ? "…" : String(lowStock)} detail={`${outOfStock} agotados`} /><StatCard label="Pedidos" value={loading ? "…" : String(periodOrders.length)} detail={`Últimos ${period} días`} /><StatCard label="Ventas" value={loading ? "…" : money(sales)} detail={`Últimos ${period} días`} /></section>
    <div className="content-grid"><section className="panel chart-panel"><div className="panel-header"><div><p className="eyebrow">Rendimiento</p><h2>Ventas</h2></div><select className="period-select" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option></select></div><div className="chart"><div className="chart-scale"><span>{money(maxSale)}</span><span>{money(maxSale * .75)}</span><span>{money(maxSale * .5)}</span><span>{money(maxSale * .25)}</span><span>$0</span></div><div className="chart-area"><div className="chart-grid-lines"><i/><i/><i/><i/><i/></div><div className="bars">{salesByDay.map((item, index) => <div className="bar-column" key={`${item.label}-${index}`}><div className="bar" style={{ height: `${Math.max(4, (item.value / maxSale) * 100)}%` }} title={`${item.label}: ${money(item.value)}`} /><span>{item.label}</span></div>)}</div></div></div></section><section className="panel"><div className="panel-header"><div><p className="eyebrow">Actividad reciente</p><h2>Últimos pedidos</h2></div><span className="muted">{orders.length} registrados</span></div><OrderTable orders={recentOrders} /></section></div>
    <section className="panel full-panel"><div className="panel-header"><div><p className="eyebrow">Control de existencias</p><h2>Inventario</h2></div><span className="muted">{totalUnits.toLocaleString("es-CL")} unidades</span></div><ProductTable products={products} /></section>
    <section className="panel activity-panel"><div className="panel-header"><div><p className="eyebrow">Información</p><h2>Resumen operativo</h2></div></div><div className="info-grid"><div><span>Conexión</span><strong>{apiConfigured && !syncError ? "Shopify conectado" : "Revisar conexión"}</strong></div><div><span>Clientes</span><strong>{customers.length.toLocaleString("es-CL")} registrados</strong></div><div><span>Pedidos pendientes</span><strong>{pendingOrders} por gestionar</strong></div><div><span>Pedidos enviados</span><strong>{shippedOrders} completados o enviados</strong></div><div><span>Productos con stock bajo</span><strong>{lowStock} variantes</strong></div><div><span>Actividad registrada</span><strong>{activity.length} eventos</strong></div></div></section>
  </>;
}
