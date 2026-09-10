import "./App.css";

const stats = [
  { label: "Productos", value: "28", detail: "En Shopify" },
  { label: "Stock bajo", value: "4", detail: "Requieren atención" },
  { label: "Pedidos", value: "37", detail: "Últimos 30 días" },
  { label: "Ventas", value: "$486.990", detail: "Últimos 30 días" },
];

const products = [
  { name: "Pasta de Ají Gourmet", sku: "JM-PA-001", stock: 15, price: "$4.500", status: "Disponible" },
  { name: "Merkén Premium", sku: "JM-MK-001", stock: 8, price: "$4.500", status: "Disponible" },
  { name: "Mermelada de Ají", sku: "JM-MA-001", stock: 3, price: "$5.000", status: "Stock bajo" },
  { name: "Molinillo Merkén 180g", sku: "JM-MM-001", stock: 37, price: "$7.000", status: "Disponible" },
  { name: "Molinillo Pimienta Negra 180g", sku: "JM-MP-001", stock: 50, price: "$7.000", status: "Disponible" },
];

const orders = [
  { id: "#1045", date: "08/09/2026", customer: "Cliente Shopify", total: "$12.000", status: "Pagado" },
  { id: "#1044", date: "07/09/2026", customer: "Cliente Shopify", total: "$17.990", status: "Pagado" },
  { id: "#1043", date: "06/09/2026", customer: "Cliente Shopify", total: "$4.500", status: "Pagado" },
];

function App() {
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">JM</div>
          <div>
            <strong>Jatis Mutis</strong>
            <span>Panel interno</span>
          </div>
        </div>

        <nav className="nav">
          <a className="nav-item active" href="#dashboard">Dashboard</a>
          <a className="nav-item" href="#products">Productos</a>
          <a className="nav-item" href="#inventory">Inventario</a>
          <a className="nav-item" href="#orders">Pedidos</a>
          <a className="nav-item" href="#customers">Clientes</a>
        </nav>

        <div className="sidebar-footer">
          <span className="connection-dot" /> Shopify conectado
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Control interno</p>
            <h1>Dashboard</h1>
          </div>
          <div className="user-badge">JM</div>
        </header>

        <section className="stats-grid">
          {stats.map((stat) => (
            <article className="stat-card" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </article>
          ))}
        </section>

        <div className="content-grid">
          <section className="panel" id="inventory">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Control de existencias</p>
                <h2>Inventario</h2>
              </div>
              <a href="#products">Ver todos</a>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Producto</th><th>SKU</th><th>Stock</th><th>Precio</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.sku}>
                      <td>{product.name}</td>
                      <td className="muted">{product.sku}</td>
                      <td><strong>{product.stock}</strong></td>
                      <td>{product.price}</td>
                      <td><span className={`status ${product.status === "Stock bajo" ? "warning" : "ok"}`}>{product.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" id="orders">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Actividad reciente</p>
                <h2>Últimos pedidos</h2>
              </div>
              <a href="#orders">Ver todos</a>
            </div>
            <div className="orders-list">
              {orders.map((order) => (
                <article className="order-row" key={order.id}>
                  <div><strong>{order.id}</strong><span>{order.date}</span></div>
                  <div><span>{order.customer}</span><strong>{order.total}</strong></div>
                  <span className="status ok">{order.status}</span>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="panel activity-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Información</p>
              <h2>Resumen operativo</h2>
            </div>
          </div>
          <div className="info-grid">
            <div><span>Última sincronización</span><strong>Pendiente de API</strong></div>
            <div><span>Última compra</span><strong>Se mostrará desde Shopify</strong></div>
            <div><span>Productos con stock bajo</span><strong>4 productos</strong></div>
            <div><span>Estado de conexión</span><strong className="connected">● Preparado para API</strong></div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
