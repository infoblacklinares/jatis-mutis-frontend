export type Role = "Administrador" | "Vendedor" | "Solo lectura";

export type Permission =
  | "dashboard"
  | "products"
  | "inventory"
  | "orders"
  | "customers"
  | "dispatches"
  | "users"
  | "activity"
  | "settings";

const permissions: Record<Role, Permission[]> = {
  "Administrador": ["dashboard", "products", "inventory", "orders", "customers", "dispatches", "users", "activity", "settings"],
  "Vendedor": ["dashboard", "products", "inventory", "orders", "customers", "dispatches", "activity"],
  "Solo lectura": ["dashboard", "products", "inventory", "orders", "customers", "dispatches", "activity"],
};

export function getUserRole(user: { publicMetadata?: Record<string, unknown> } | null | undefined): Role {
  const role = user?.publicMetadata?.role;
  return role === "Administrador" || role === "Vendedor" || role === "Solo lectura" ? role : "Administrador";
}

export function canAccess(role: Role, permission: Permission) {
  return permissions[role].includes(permission);
}
