import { ProductTable } from "../components/ProductTable";
import { products } from "../data/mocks";

export function Inventory() {
  const lowStock = products.filter((product) => product.variants[0]?.quantity <= 5);
  return <section className="panel full-panel"><div className="panel-header"><div><p className="eyebrow">Control de existencias</p><h2>Inventario</h2></div><span className="status warning">{lowStock.length} con stock bajo</span></div><ProductTable products={products} /></section>;
}
