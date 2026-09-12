import { createClerkClient } from "@clerk/backend";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
});

const roles = ["Administrador", "Vendedor", "Solo lectura"] as const;
type Role = (typeof roles)[number];

function json(res: VercelResponse, status: number, body: unknown) {
  return res.status(status).json(body);
}

function authorizedParties() {
  return (process.env.CLERK_AUTHORIZED_PARTIES || process.env.APP_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function requireAdmin(req: VercelRequest) {
  const request = new Request(`${process.env.APP_URL || "http://localhost"}${req.url || "/api/admin/users"}`, {
    method: req.method || "GET",
    headers: new Headers(req.headers as Record<string, string>),
    body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}),
  });
  const state = await clerk.authenticateRequest(request, {
    authorizedParties: authorizedParties(),
  });
  if (!state.isAuthenticated) throw new Error("UNAUTHORIZED");
  const auth = state.toAuth();
  if (!auth.userId) throw new Error("UNAUTHORIZED");
  const currentUser = await clerk.users.getUser(auth.userId);
  if (currentUser.publicMetadata?.role !== "Administrador") throw new Error("FORBIDDEN");
  return auth.userId;
}

function normalizeUser(user: any) {
  return {
    id: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Sin nombre",
    email: user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || "",
    role: roles.includes(user.publicMetadata?.role) ? user.publicMetadata.role : "Solo lectura",
    active: !user.banned,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAdmin(req);
    if (req.method === "GET") {
      const result = await clerk.users.getUserList({ limit: 100, orderBy: "-created_at" });
      return json(res, 200, { users: result.data.map(normalizeUser), totalCount: result.totalCount });
    }

    if (req.method === "POST") {
      const { email, role = "Vendedor", firstName = "" } = req.body || {};
      if (!email || typeof email !== "string") return json(res, 400, { error: "El correo es obligatorio." });
      if (!roles.includes(role as Role)) return json(res, 400, { error: "Rol inválido." });
      const invitation = await clerk.invitations.createInvitation({
        emailAddress: email.trim(),
        notify: true,
        redirectUrl: process.env.APP_URL || undefined,
        publicMetadata: { role, firstName },
      });
      return json(res, 201, { invitation: { id: invitation.id, email: invitation.emailAddress, status: invitation.status } });
    }

    const userId = String(req.body?.userId || "");
    if (!userId) return json(res, 400, { error: "userId es obligatorio." });

    if (req.method === "PATCH") {
      const role = req.body?.role;
      if (!roles.includes(role as Role)) return json(res, 400, { error: "Rol inválido." });
      await clerk.users.updateUserMetadata(userId, { publicMetadata: { role } });
      return json(res, 200, { success: true, userId, role });
    }

    if (req.method === "DELETE") {
      await clerk.users.updateUser(userId, { banned: true });
      return json(res, 200, { success: true, userId, active: false });
    }

    return json(res, 405, { error: "Método no permitido." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    if (message === "UNAUTHORIZED") return json(res, 401, { error: "No autenticado." });
    if (message === "FORBIDDEN") return json(res, 403, { error: "Se requiere rol Administrador." });
    console.error(error);
    return json(res, 500, { error: "No fue posible completar la operación." });
  }
}
