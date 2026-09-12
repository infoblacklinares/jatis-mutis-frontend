import { useEffect, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { logActivity } from "../services/localStore";
import type { Role } from "../services/permissions";
import { getUserRole } from "../services/permissions";

type User = { id: string; name: string; email: string; role: Role; active: boolean };
const initialUsers: User[] = [
  { id: "u1", name: "Gustavo", email: "Administrador de tienda", role: "Administrador", active: true },
  { id: "u2", name: "Vendedor", email: "Usuario operativo", role: "Vendedor", active: true },
  { id: "u3", name: "Consulta", email: "Solo lectura", role: "Solo lectura", active: false },
];
const roles: Role[] = ["Administrador", "Vendedor", "Solo lectura"];
const permissions: Record<Role, string[]> = { "Administrador": ["Todo el panel", "Productos", "Inventario", "Pedidos", "Clientes", "Despachos", "Usuarios", "Actividad", "Configuración"], "Vendedor": ["Dashboard", "Productos", "Inventario", "Pedidos", "Clientes", "Despachos", "Actividad"], "Solo lectura": ["Dashboard", "Productos", "Inventario", "Pedidos", "Clientes", "Despachos", "Actividad"] };

async function api<T>(token: string, init?: RequestInit): Promise<T> {
  const response = await fetch("/api/admin/users", { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "No fue posible completar la operación.");
  return data;
}

export function Users() {
  const { user: clerkUser } = useUser();
  const { getToken } = useAuth();
  const currentRole = getUserRole(clerkUser);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [selected, setSelected] = useState<User | null>(null);
  const [role, setRole] = useState<Role>("Vendedor");
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("Vendedor");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadUsers = async () => {
    const token = await getToken();
    if (!token) return;
    try { const result = await api<{ users: User[] }>(token); setUsers(result.users); } catch { setMessage("API de usuarios aún no configurada; mostrando usuarios demo."); }
  };
  useEffect(() => { void loadUsers(); }, []);

  const invite = async () => {
    if (!email.trim()) return;
    const token = await getToken(); if (!token) return;
    setLoading(true); setMessage("");
    try { await api(token, { method: "POST", body: JSON.stringify({ email: email.trim(), role: inviteRole }) }); setEmail(""); setMessage(`Invitación enviada a ${email.trim()}.`); logActivity("Usuario invitado", `${email.trim()} · ${inviteRole}`); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible enviar la invitación."); } finally { setLoading(false); }
  };

  const changeRole = async (user: User) => {
    const token = await getToken(); if (!token) return;
    setLoading(true); setMessage("");
    try { await api(token, { method: "PATCH", body: JSON.stringify({ userId: user.id, role }) }); setUsers((items) => items.map((item) => item.id === user.id ? { ...item, role } : item)); logActivity("Rol actualizado", `${user.name}: ${user.role} → ${role}`); setSelected(null); setMessage("Rol actualizado correctamente."); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible actualizar el rol."); } finally { setLoading(false); }
  };

  const disable = async (user: User) => {
    if (!window.confirm(`¿Desactivar a ${user.name}?`)) return;
    const token = await getToken(); if (!token) return;
    setLoading(true); setMessage("");
    try { await api(token, { method: "DELETE", body: JSON.stringify({ userId: user.id }) }); setUsers((items) => items.map((item) => item.id === user.id ? { ...item, active: false } : item)); logActivity("Usuario desactivado", user.name); } catch (error) { setMessage(error instanceof Error ? error.message : "No fue posible desactivar el usuario."); } finally { setLoading(false); }
  };

  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Seguridad</p><h2>Usuarios y roles</h2></div><span className="muted">{users.length} usuarios · Rol actual: {currentRole}</span></div>
    <div className="settings-grid">
      <div className="setting-card"><span>Invitar usuario</span><strong>Enviar acceso por correo</strong><input type="email" placeholder="correo@ejemplo.cl" value={email} onChange={(e) => setEmail(e.target.value)} /><select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>{roles.map((item) => <option key={item}>{item}</option>)}</select><button className="primary-button" disabled={loading || !email.trim()} onClick={() => void invite()}>Enviar invitación</button></div>
      <div className="setting-card"><span>Cuenta autenticada</span><strong>{clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress || "Usuario actual"}</strong><small>El rol se obtiene desde <code>publicMetadata.role</code> de Clerk.</small><div className="status ok">{currentRole}</div></div>
    </div>
    {message && <div className="empty-state"><strong>{message}</strong></div>}
    <div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email || "—"}</td><td>{user.role}</td><td><span className={`status ${user.active ? "ok" : "warning"}`}>{user.active ? "Activo" : "Inactivo"}</span></td><td>{user.active && <><button className="action-button" disabled={loading} onClick={() => { setRole(user.role); setSelected(user); }}>Editar rol</button>{user.id !== clerkUser?.id && <button className="action-button danger" disabled={loading} onClick={() => void disable(user)}>Desactivar</button>}</>}</td></tr>)}</tbody></table></div>
    {selected && <div className="modal-backdrop"><div className="modal-card"><p className="eyebrow">Permisos del usuario</p><h2>{selected.name}</h2><label>Rol<select value={role} onChange={(e) => setRole(e.target.value as Role)}>{roles.map((item) => <option key={item}>{item}</option>)}</select></label><div className="empty-state"><strong>Permisos incluidos</strong><span>{permissions[role].join(" · ")}</span></div><div className="modal-actions"><button className="action-button" onClick={() => setSelected(null)}>Cancelar</button><button className="primary-button" disabled={loading} onClick={() => void changeRole(selected)}>Guardar rol</button></div></div></div>}
  </section>;
}
