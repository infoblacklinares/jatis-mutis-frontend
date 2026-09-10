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

export function Dashboard() {
  return <>
    <section className="stats-grid">{stats.map((stat) => <StatCard key={stat.label} {...stat} />)}</section>
    <div className="content-grid">
      <section className="panel"><div className="panel-header"><div><p className="eyebrow">Control de existencias</p><h2>Inventario</h2></div><span className="muted">Vista rápida</span></div><ProductTable products={products} /></section>
      <section className="panel"><div className="panel-header"><div><p className="eyebrow">Actividad reciente</p><h2>Últimos pedidos</h2></div><span className="muted">Vista rápida</span></div><OrderTable orders={orders} /></section>
    </div>
    <section className="panel activity-panel"><div className="panel-header"><div><p className="eyebrow">Información</p><h2>Resumen operativo</h2></div></div>
      <div className="info-grid"><div><span>Última sincronización</span><strong>Pendiente de API</strong></div><div><span>Última compra</span><strong>Se mostrará desde Shopify</strong></div><div><span>Productos con stock bajo</span><strong>4 productos</strong></div><div><span>Estado de conexión</span><strong className="connected">● Preparado para API</strong></div></div>
    </section>
  </>;
}
