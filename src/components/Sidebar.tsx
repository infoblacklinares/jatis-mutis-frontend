import type { Role, Permission } from "../services/permissions";
import { canAccess } from "../services/permissions";

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  role: Role;
}

const groups: { label: string; items: [Permission, string][] }[] = [
  { label: "Operación", items: [["dashboard", "Dashboard"], ["products", "Productos"], ["inventory", "Inventario"], ["orders", "Pedidos"], ["customers", "Clientes"], ["dispatches", "Despachos"]] },
  { label: "Sistema", items: [["users", "Usuarios"], ["activity", "Actividad"], ["settings", "Configuración"]] },
];

export function Sidebar({ currentView, onNavigate, role }: SidebarProps) {
  return <aside className="sidebar"><div className="brand"><div className="brand-mark">JM</div><div><strong>Jatis Mutis</strong><span>Panel interno</span></div></div><nav className="nav">
    {groups.map((group) => <div className="nav-group" key={group.label}><span className="nav-group-label">{group.label}</span>{group.items.filter(([id]) => canAccess(role, id)).map(([id, label]) => <button key={id} className={`nav-item ${currentView === id ? "active" : ""}`} onClick={() => onNavigate(id)}>{label}</button>)}</div>)}
  </nav><div className="sidebar-footer"><span className="connection-dot pending" /> {role}</div></aside>;
}
