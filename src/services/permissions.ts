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

export type Action =
  | "products.manage"
  | "inventory.adjust"
  | "orders.update"
  | "dispatches.manage"
  | "users.manage"
  | "settings.manage";

const permissions: Record<Role, Permission[]> = {
  "Administrador": ["dashboard", "products", "inventory", "orders", "customers", "dispatches", "users", "activity", "settings"],
  "Vendedor": ["dashboard", "products", "inventory", "orders", "customers", "dispatches", "activity"],
  "Solo lectura": ["dashboard", "products", "inventory", "orders", "customers", "dispatches", "activity"],
};

const actions: Record<Role, Action[]> = {
  "Administrador": ["products.manage", "inventory.adjust", "orders.update", "dispatches.manage", "users.manage", "settings.manage"],
  "Vendedor": ["orders.update", "dispatches.manage"],
  "Solo lectura": [],
};

export function getUserRole(user: { publicMetadata?: Record<string, unknown> } | null | undefined): Role {
  const role = user?.publicMetadata?.role;
  return role === "Administrador" || role === "Vendedor" || role === "Solo lectura" ? role : "Solo lectura";
}

export function canAccess(role: Role, permission: Permission) {
  return permissions[role].includes(permission);
}

export function canPerform(role: Role, action: Action) {
  return actions[role].includes(action);
}

export function isAdmin(role: Role) {
  return role === "Administrador";
}
