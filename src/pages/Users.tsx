import { useState } from "react";

const initialUsers = [
  { id: "u1", name: "Gustavo", email: "Administrador de tienda", role: "Administrador", active: true },
  { id: "u2", name: "Vendedor", email: "Usuario operativo", role: "Vendedor", active: true },
  { id: "u3", name: "Consulta", email: "Solo lectura", role: "Solo lectura", active: false },
];

export function Users() {
  const [users, setUsers] = useState(initialUsers);
  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Seguridad</p><h2>Usuarios y roles</h2></div><span className="muted">{users.length} usuarios demo</span></div>
    <div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Descripción</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td>{user.role}</td><td><span className={`status ${user.active ? "ok" : "warning"}`}>{user.active ? "Activo" : "Inactivo"}</span></td><td><button className="action-button" onClick={() => setUsers((current) => current.map((item) => item.id === user.id ? { ...item, active: !item.active } : item))}>{user.active ? "Desactivar" : "Activar"}</button></td></tr>)}</tbody></table></div>
    <div className="empty-state"><strong>Permisos centralizados</strong><span>Los roles reales se validarán en la API. El frontend no almacenará contraseñas ni secretos.</span></div>
  </section>;
}
