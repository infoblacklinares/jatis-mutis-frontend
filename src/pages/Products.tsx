import { ProductTable } from "../components/ProductTable";
import { products } from "../data/mocks";

export function Products() {
  return <section className="panel full-panel"><div className="panel-header"><div><p className="eyebrow">Shopify</p><h2>Productos</h2></div><span className="muted">{products.length} cargados en demo</span></div><ProductTable products={products} /></section>;
}
