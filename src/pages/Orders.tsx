import { useMemo, useState } from "react";
import { OrderTable } from "../components/OrderTable";
import { orders } from "../data/mocks";

export function Orders() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const matchesQuery = `${order.id} ${order.customer}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = status === "Todos" || order.status === status;
    return matchesQuery && matchesStatus;
  }), [query, status]);

  return (
    <section className="panel full-panel">
      <div className="panel-header">
        <div><p className="eyebrow">Operación Shopify</p><h2>Pedidos</h2></div>
        <span className="muted">{filteredOrders.length} pedidos</span>
      </div>
      <div className="toolbar">
        <input aria-label="Buscar pedidos" placeholder="Buscar por pedido o cliente..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Filtrar por estado" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option>Todos</option><option>Pagado</option><option>Pendiente</option><option>Preparando</option><option>Enviado</option><option>Entregado</option><option>Cancelado</option>
        </select>
      </div>
      <OrderTable orders={filteredOrders} />
    </section>
  );
}
