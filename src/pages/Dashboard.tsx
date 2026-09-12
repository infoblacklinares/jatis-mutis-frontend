import { useMemo, useState } from "react";
import { OrderTable } from "../components/OrderTable";
import { ProductTable } from "../components/ProductTable";
import { StatCard } from "../components/StatCard";
import { apiConfigured } from "../services/api";
import { readActivity, readCustomers, readOrders, readProducts, readSettings } from "../services/localStore";

const money = (value: number) => value.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export function Dashboard() {
  const [period, setPeriod] = useState("30");
  const products = readProducts();
  const orders = readOrders();
  const customers = readCustomers();
  const activity = readActivity();
  const settings = readSettings();
  const allVariants = products.flatMap((product) => product.variants);
  const totalUnits = allVariants.reduce((sum, variant) => sum + variant.quantity, 0);
  const lowStock = allVariants.filter((variant) => variant.quantity > 0 && variant.quantity <= settings.stockThreshold).length;
  const outOfStock = allVariants.filter((variant) => variant.quantity === 0).length;
  const cutoff = Date.now() - Number(period) * 24 * 60 * 60 * 1000;
  const periodOrders = orders.filter((order) => {
    const time = Date.parse(order.date);
    return !Number.isNaN(time) ? time >= cutoff : true;
  });
  const sales = periodOrders.reduce((sum, order) => sum + order.total, 0);
  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);
  const salesByDay = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (6 - index));
    const next = new Date(day); next.setDate(day.getDate() + 1);
    const value = orders.filter((order) => { const time = Date.parse(order.date); return !Number.isNaN(time) && time >= day.getTime() && time < next.getTime(); }).reduce((sum, order) => sum + order.total, 0);
    return { label: day.toLocaleDateString("es-CL", { weekday: "short" }).replace(".", ""), value };
  });
  const maxSale = Math.max(...salesByDay.map((item) => item.value), 1);

  return <>
    <div className="dashboard-search"><span>⌕</span><input aria-label="Buscar" placeholder="Buscar producto, pedido o cliente..." /><kbd>Ctrl K</kbd></div>
    <section className="stats-grid">
      <StatCard label="Productos" value={String(products.length)} detail={`${allVariants.length} variantes`} />
      <StatCard label="Stock bajo" value={String(lowStock)} detail={`${outOfStock} agotados`} />
      <StatCard label="Pedidos" value={String(periodOrders.length)} detail={`Últimos ${period} días`} />
      <StatCard label="Ventas" value={money(sales)} detail={`Últimos ${period} días`} />
    </section>
    <div className="content-grid">
      <section className="panel chart-panel">
        <div className="panel-header"><div><p className="eyebrow">Rendimiento</p><h2>Ventas</h2></div><select className="period-select" value={period} onChange={(e) => setPeriod(e.target.value)}><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option></select></div>
        <div className="chart"><div className="chart-scale"><span>{money(maxSale)}</span><span>{money(maxSale * .75)}</span><span>{money(maxSale * .5)}</span><span>{money(maxSale * .25)}</span><span>$0</span></div><div className="chart-area"><div className="chart-grid-lines"><i/><i/><i/><i/><i/></div><div className="bars">{salesByDay.map((item) => <div className="bar-column" key={item.label}><div className="bar" style={{ height: `${Math.max(4, (item.value / maxSale) * 100)}%` }} title={`${item.label}: ${money(item.value)}`} /><span>{item.label}</span></div>)}</div></div></div>
      </section>
      <section className="panel"><div className="panel-header"><div><p className="eyebrow">Actividad reciente</p><h2>Últimos pedidos</h2></div><span className="muted">{orders.length} registrados</span></div><OrderTable orders={recentOrders} /></section>
    </div>
    <section className="panel full-panel"><div className="panel-header"><div><p className="eyebrow">Control de existencias</p><h2>Inventario</h2></div><span className="muted">{totalUnits} unidades</span></div><ProductTable products={products} /></section>
    <section className="panel activity-panel"><div className="panel-header"><div><p className="eyebrow">Información</p><h2>Resumen operativo</h2></div></div><div className="info-grid"><div><span>Última sincronización</span><strong>{apiConfigured ? "Conectado a API" : "Pendiente de API"}</strong></div><div><span>Clientes</span><strong>{customers.length} registrados</strong></div><div><span>Productos con stock bajo</span><strong>{lowStock} variantes</strong></div><div><span>Actividad registrada</span><strong>{activity.length} eventos</strong></div></div></section>
  </>;
}
