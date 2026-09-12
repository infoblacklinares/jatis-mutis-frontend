import { useState } from "react";
import { useUser } from "@clerk/react";
import { logActivity } from "../services/localStore";
import type { Role } from "../services/permissions";
import { getUserRole } from "../services/permissions";

type User = { id: string; name: string; email: string; role: Role; active: boolean };
const initialUsers: User[] = [
  { id: "u1", name: "Gustavo", email: "Administrador de tienda", role: "Administrador", active: true },
  { id: "u2", name: "Vendedor", email: "Usuario operativo", role: "Vendedor", active: true },
  { id: "u3", name: "Consulta", email: "Solo lectura", role: "Solo lectura", active: false },
];
const permissions: Record<Role, string[]> = { "Administrador": ["Todo el panel", "Productos", "Inventario", "Pedidos", "Clientes", "Despachos", "Usuarios", "Actividad", "Configuración"], "Vendedor": ["Dashboard", "Productos", "Inventario", "Pedidos", "Clientes", "Despachos", "Actividad"], "Solo lectura": ["Dashboard", "Productos", "Inventario", "Pedidos", "Clientes", "Despachos", "Actividad"] };

export function Users() {
  const { user: clerkUser } = useUser();
  const currentRole = getUserRole(clerkUser);
  const [users, setUsers] = useState<User[]>(() => { try { return JSON.parse(localStorage.getItem("jm_users") || "null") || initialUsers; } catch { return initialUsers; } });
  const [selected, setSelected] = useState<User | null>(null);
  const [role, setRole] = useState<Role>("Vendedor");
  const save = (next: User[]) => { setUsers(next); localStorage.setItem("jm_users", JSON.stringify(next)); };
  const toggle = (user: User) => { const next = users.map((item) => item.id === user.id ? { ...item, active: !item.active } : item); save(next); logActivity(user.active ? "Usuario desactivado" : "Usuario activado", user.name); };
  const changeRole = (user: User) => { const next = users.map((item) => item.id === user.id ? { ...item, role } : item); save(next); logActivity("Rol actualizado", `${user.name}: ${user.role} → ${role}`); setSelected({ ...user, role }); };
  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Seguridad</p><h2>Usuarios y roles</h2></div><span className="muted">{users.length} usuarios · Rol actual: {currentRole}</span></div>
    <div className="settings-grid">
      <div className="setting-card"><span>Cuenta autenticada</span><strong>{clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress || "Usuario actual"}</strong><small>Clerk determina el acceso mediante <code>publicMetadata.role</code>.</small><div className="status ok">{currentRole}</div></div>
      <div className="setting-card"><span>Administración</span><strong>Roles del panel</strong><small>Los cambios de roles de cuentas reales se realizarán mediante Clerk/API. No se guarda información sensible en este frontend.</small><div className="status warning">Gestión de cuentas pendiente de API</div></div>
    </div>
    <div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Descripción</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td>{user.role}</td><td><span className={`status ${user.active ? "ok" : "warning"}`}>{user.active ? "Activo" : "Inactivo"}</span></td><td><button className="action-button" onClick={() => toggle(user)}>{user.active ? "Desactivar" : "Activar"}</button> <button className="action-button" onClick={() => { setRole(user.role); setSelected(user); }}>Editar rol</button></td></tr>)}</tbody></table></div>
    {selected && <div className="modal-backdrop"><div className="modal-card"><p className="eyebrow">Permisos del usuario</p><h2>{selected.name}</h2><label>Rol<select value={role} onChange={(e) => setRole(e.target.value as Role)}>{Object.keys(permissions).map((r) => <option key={r}>{r}</option>)}</select></label><div className="empty-state"><strong>Permisos incluidos</strong><span>{permissions[role].join(" · ")}</span></div><small className="muted">Este cambio actualiza el usuario demo local. Para una cuenta Clerk real, el rol debe persistirse en <code>publicMetadata.role</code> desde un backend seguro.</small><div className="modal-actions"><button className="action-button" onClick={() => setSelected(null)}>Cancelar</button><button className="primary-button" onClick={() => changeRole(selected)}>Guardar rol</button></div></div></div>}
  </section>;
}
