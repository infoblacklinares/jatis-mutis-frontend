import { useState } from "react";
import type { ReactNode } from "react";
import { Show, SignIn, UserButton } from "@clerk/react";
import "./App.css";
import { Sidebar } from "./components/Sidebar";
import { Customers } from "./pages/Customers";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { Orders } from "./pages/Orders";
import { Products } from "./pages/Products";

const views: Record<string, { title: string; eyebrow: string; component: ReactNode }> = {
  dashboard: { title: "Dashboard", eyebrow: "Control interno", component: <Dashboard /> },
  products: { title: "Productos", eyebrow: "Catálogo Shopify", component: <Products /> },
  inventory: { title: "Inventario", eyebrow: "Control de existencias", component: <Inventory /> },
  orders: { title: "Pedidos", eyebrow: "Actividad de ventas", component: <Orders /> },
  customers: { title: "Clientes", eyebrow: "Información comercial", component: <Customers /> },
};

function LoginScreen() {
  return (
    <div className="auth-screen">
      <div className="auth-brand">
        <div className="brand-mark">JM</div>
        <div>
          <strong>Jatis Mutis</strong>
          <span>Panel interno</span>
        </div>
      </div>
      <div className="auth-card">
        <div className="auth-copy">
          <p className="eyebrow">Acceso seguro</p>
          <h1>Bienvenido</h1>
          <p>Ingresa para administrar la operación de Jatis Mutis.</p>
        </div>
        <SignIn routing="hash" />
      </div>
    </div>
  );
}

function ProtectedDashboard() {
  const [currentView, setCurrentView] = useState("dashboard");
  const view = views[currentView] ?? views.dashboard;

  return (
    <div className="dashboard">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">{view.eyebrow}</p>
            <h1>{view.title}</h1>
          </div>
          <UserButton />
        </header>
        {view.component}
      </main>
    </div>
  );
}

function App() {
  return (
    <>
      <Show when="signed-out">
        <LoginScreen />
      </Show>
      <Show when="signed-in">
        <ProtectedDashboard />
      </Show>
    </>
  );
}

export default App;
