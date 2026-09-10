interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

const items = [
  ["dashboard", "Dashboard"],
  ["products", "Productos"],
  ["inventory", "Inventario"],
  ["orders", "Pedidos"],
  ["customers", "Clientes"],
];

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">JM</div>
        <div><strong>Jatis Mutis</strong><span>Panel interno</span></div>
      </div>
      <nav className="nav">
        {items.map(([id, label]) => (
          <button key={id} className={`nav-item ${currentView === id ? "active" : ""}`} onClick={() => onNavigate(id)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer"><span className="connection-dot" /> Shopify conectado</div>
    </aside>
  );
}
