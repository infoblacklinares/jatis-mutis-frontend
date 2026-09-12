import { useState } from "react";
import type { ReactNode } from "react";
import { Show, SignIn, UserButton, useUser } from "@clerk/react";
import "./App.css";
import { Sidebar } from "./components/Sidebar";
import { Activity } from "./pages/Activity";
import { Customers } from "./pages/Customers";
import { Dashboard } from "./pages/Dashboard";
import { Dispatches } from "./pages/Dispatches";
import { Inventory } from "./pages/Inventory";
import { Orders } from "./pages/Orders";
import { Products } from "./pages/Products";
import { Settings } from "./pages/Settings";
import { Users } from "./pages/Users";
import { canAccess, getUserRole, type Permission } from "./services/permissions";

const views: Record<Permission, { title: string; eyebrow: string; component: ReactNode }> = {
  dashboard: { title: "Dashboard", eyebrow: "Control interno", component: <Dashboard /> },
  products: { title: "Productos", eyebrow: "Catálogo Shopify", component: <Products /> },
  inventory: { title: "Inventario", eyebrow: "Control de existencias", component: <Inventory /> },
  orders: { title: "Pedidos", eyebrow: "Actividad de ventas", component: <Orders /> },
  customers: { title: "Clientes", eyebrow: "Información comercial", component: <Customers /> },
  dispatches: { title: "Despachos", eyebrow: "Logística", component: <Dispatches /> },
  users: { title: "Usuarios", eyebrow: "Seguridad y permisos", component: <Users /> },
  activity: { title: "Actividad", eyebrow: "Auditoría", component: <Activity /> },
  settings: { title: "Configuración", eyebrow: "Operación", component: <Settings /> },
};

function LoginScreen() {
  return <div className="auth-screen"><div className="auth-brand"><div className="brand-mark">JM</div><div><strong>Jatis Mutis</strong><span>Panel interno</span></div></div><div className="auth-card"><div className="auth-copy"><p className="eyebrow">Acceso seguro</p><h1>Bienvenido</h1><p>Ingresa para administrar la operación de Jatis Mutis.</p></div><SignIn routing="hash" /></div></div>;
}

function AccessDenied({ role }: { role: string }) {
  return <section className="panel full-panel"><div className="empty-state"><strong>Acceso restringido</strong><span>Tu rol actual es “{role}” y no tiene permisos para esta sección.</span><small>Si necesitas acceso, solicita al administrador que actualice tu rol en Clerk.</small></div></section>;
}

function ProtectedDashboard() {
  const { user } = useUser();
  const role = getUserRole(user);
  const [currentView, setCurrentView] = useState<Permission>("dashboard");
  const view = views[currentView] ?? views.dashboard;
  const allowed = canAccess(role, currentView);

  const navigate = (next: string) => {
    const permission = next as Permission;
    if (permission in views && canAccess(role, permission)) setCurrentView(permission);
  };

  return <div className="dashboard"><Sidebar currentView={currentView} onNavigate={navigate} role={role} /><main className="main-content"><header className="topbar"><div><p className="eyebrow">{view.eyebrow}</p><h1>{view.title}</h1></div><UserButton /></header>{allowed ? view.component : <AccessDenied role={role} />}</main></div>;
}

function App() {
  return <><Show when="signed-out"><LoginScreen /></Show><Show when="signed-in"><ProtectedDashboard /></Show></>;
}

export default App;
