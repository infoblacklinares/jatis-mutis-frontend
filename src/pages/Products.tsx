import { useEffect, useMemo, useState } from "react";
import { ProductTable } from "../components/ProductTable";
import { apiConfigured, getProducts } from "../services/api";
import type { Product } from "../types/product";

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [loading, setLoading] = useState(apiConfigured);
  const [apiError, setApiError] = useState("");

  useEffect(() => {
    if (!apiConfigured) return;
    let active = true;

    getProducts()
      .then((response) => {
        if (!active) return;
        setProducts(response.nodes);
        setApiError("");
      })
      .catch((error) => {
        if (active) {
          setApiError(error instanceof Error ? error.message : "No fue posible cargar los productos desde la API.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || product.title.toLowerCase().includes(term) || product.variants.some((variant) => (variant.sku ?? "").toLowerCase().includes(term));
    const quantity = product.variants.reduce((total, variant) => total + variant.quantity, 0);
    const matchesStatus = status === "todos"
      || (status === "disponible" && quantity > 5)
      || (status === "bajo" && quantity > 0 && quantity <= 5)
      || (status === "agotado" && quantity === 0);
    return matchesSearch && matchesStatus;
  }), [products, search, status]);

  return <section className="panel full-panel">
    <div className="panel-header">
      <div><p className="eyebrow">API propia</p><h2>Productos</h2></div>
      <span className="muted">{filteredProducts.length} de {products.length}</span>
    </div>

    {loading && <p className="muted">Conectando con la API…</p>}
    {apiError && <div className="inventory-error"><strong>No se pudieron cargar los productos</strong><span>{apiError}</span></div>}

    {!loading && !apiError && products.length === 0 && <p className="muted">No hay productos disponibles.</p>}

    <div className="toolbar">
      <input
        aria-label="Buscar productos"
        placeholder="Buscar por producto o SKU..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select aria-label="Filtrar por stock" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="todos">Todos</option>
        <option value="disponible">Stock normal</option>
        <option value="bajo">Stock bajo</option>
        <option value="agotado">Agotados</option>
      </select>
    </div>

    {!loading && !apiError && products.length > 0 && <ProductTable products={filteredProducts} showWeight />}
  </section>;
}
