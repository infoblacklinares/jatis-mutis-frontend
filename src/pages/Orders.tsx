import { OrderTable } from "../components/OrderTable";
import { orders } from "../data/mocks";

export function Orders() {
  return <section className="panel full-panel"><div className="panel-header"><div><p className="eyebrow">Shopify</p><h2>Pedidos</h2></div><span className="muted">Datos de demostración</span></div><OrderTable orders={orders} /></section>;
}
