import { useMemo, useState } from "react";
import { ProductTable } from "../components/ProductTable";
import { products } from "../data/mocks";

export function Inventory() {
  const [filter, setFilter] = useState("todos");
  const allVariants = products.flatMap((product) => product.variants);
  const totalUnits = allVariants.reduce((total, variant) => total + variant.quantity, 0);
  const lowStock = allVariants.filter((variant) => variant.quantity > 0 && variant.quantity <= 5).length;
  const outOfStock = allVariants.filter((variant) => variant.quantity === 0).length;

  const filteredProducts = useMemo(() => products.map((product) => ({
    ...product,
    variants: product.variants.filter((variant) => filter === "todos" || (filter === "bajo" && variant.quantity > 0 && variant.quantity <= 5) || (filter === "agotado" && variant.quantity === 0) || (filter === "normal" && variant.quantity > 5)),
  })).filter((product) => product.variants.length > 0), [filter]);

  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Control de existencias</p><h2>Inventario</h2></div><span className="status warning">{lowStock} con stock bajo</span></div>
    <div className="stats-grid compact-stats">
      <div className="stat-card"><span>Unidades</span><strong>{totalUnits}</strong><small>Stock total</small></div>
      <div className="stat-card"><span>Stock bajo</span><strong>{lowStock}</strong><small>Requieren atención</small></div>
      <div className="stat-card"><span>Agotados</span><strong>{outOfStock}</strong><small>Sin existencias</small></div>
    </div>
    <div className="toolbar">
      <select aria-label="Filtrar inventario" value={filter} onChange={(event) => setFilter(event.target.value)}>
        <option value="todos">Todo el inventario</option>
        <option value="normal">Stock normal</option>
        <option value="bajo">Stock bajo</option>
        <option value="agotado">Agotados</option>
      </select>
    </div>
    <ProductTable products={filteredProducts} showWeight />
  </section>;
}
