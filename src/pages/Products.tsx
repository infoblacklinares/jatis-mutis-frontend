import { useMemo, useState } from "react";
import { ProductTable } from "../components/ProductTable";
import { products } from "../data/mocks";

export function Products() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");

  const filteredProducts = useMemo(() => products.filter((product) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || product.title.toLowerCase().includes(term) || product.variants.some((variant) => variant.sku.toLowerCase().includes(term));
    const quantity = product.variants.reduce((total, variant) => total + variant.quantity, 0);
    const matchesStatus = status === "todos" || (status === "disponible" && quantity > 5) || (status === "bajo" && quantity > 0 && quantity <= 5) || (status === "agotado" && quantity === 0);
    return matchesSearch && matchesStatus;
  }), [search, status]);

  return (
    <section className="panel full-panel">
      <div className="panel-header">
        <div><p className="eyebrow">Shopify</p><h2>Productos</h2></div>
        <span className="muted">{filteredProducts.length} de {products.length}</span>
      </div>
      <div className="toolbar">
        <input aria-label="Buscar productos" placeholder="Buscar por producto o SKU..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Filtrar por stock" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="todos">Todos</option>
          <option value="disponible">Stock normal</option>
          <option value="bajo">Stock bajo</option>
          <option value="agotado">Agotados</option>
        </select>
      </div>
      <ProductTable products={filteredProducts} showWeight />
    </section>
  );
}
