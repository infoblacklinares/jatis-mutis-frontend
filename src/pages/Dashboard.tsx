import { OrderTable } from "../components/OrderTable";
import { ProductTable } from "../components/ProductTable";
import { StatCard } from "../components/StatCard";
import { orders, products } from "../data/mocks";

const stats = [
  { label: "Productos", value: "28", detail: "En Shopify" },
  { label: "Stock bajo", value: "4", detail: "Requieren atención" },
  { label: "Pedidos", value: "37", detail: "Últimos 30 días" },
  { label: "Ventas", value: "$486.990", detail: "Últimos 30 días" },
];

const sales = [
  { label: "Lun", value: 42 }, { label: "Mar", value: 68 }, { label: "Mié", value: 51 },
  { label: "Jue", value: 78 }, { label: "Vie", value: 61 }, { label: "Sáb", value: 88 }, { label: "Dom", value: 56 },
];

export function Dashboard() {
  return <>
    <div className="dashboard-search"><span>⌕</span><input aria-label="Buscar" placeholder="Buscar producto, pedido o cliente..." /><kbd>Ctrl K</kbd></div>
    <section className="stats-grid">{stats.map((stat) => <StatCard key={stat.label} {...stat} />)}</section>
    <div className="content-grid">
      <section className="panel chart-panel">
        <div className="panel-header"><div><p className="eyebrow">Rendimiento</p><h2>Ventas</h2></div><select className="period-select" defaultValue="30"><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option></select></div>
        <div className="chart"><div className="chart-scale"><span>$100K</span><span>$75K</span><span>$50K</span><span>$25K</span><span>$0</span></div><div className="chart-area"><div className="chart-grid-lines"><i/><i/><i/><i/><i/></div><div className="bars">{sales.map((item) => <div className="bar-column" key={item.label}><div className="bar" style={{ height: `${item.value}%` }} title={`${item.label}: ${item.value}%`} /><span>{item.label}</span></div>)}</div></div></div>
      </section>
      <section className="panel"><div className="panel-header"><div><p className="eyebrow">Actividad reciente</p><h2>Últimos pedidos</h2></div><span className="muted">Vista rápida</span></div><OrderTable orders={orders} /></section>
    </div>
    <section className="panel full-panel"><div className="panel-header"><div><p className="eyebrow">Control de existencias</p><h2>Inventario</h2></div><span className="muted">Vista rápida</span></div><ProductTable products={products} /></section>
    <section className="panel activity-panel"><div className="panel-header"><div><p className="eyebrow">Información</p><h2>Resumen operativo</h2></div></div><div className="info-grid"><div><span>Última sincronización</span><strong>Pendiente de API</strong></div><div><span>Última compra</span><strong>Se mostrará desde Shopify</strong></div><div><span>Productos con stock bajo</span><strong>4 productos</strong></div><div><span>Estado de conexión</span><strong className="connected">● Preparado para API</strong></div></div></section>
  </>;
}
