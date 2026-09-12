import { useMemo, useState } from "react";
import { ProductTable } from "../components/ProductTable";
import { readProducts, saveProducts, logActivity } from "../services/localStore";
import type { Product } from "../types/product";

export function Products() {
  const [products, setProducts] = useState<Product[]>(readProducts);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const updateProducts = (next: Product[]) => { setProducts(next); saveProducts(next); };
  const toggleProduct = (id: string) => {
    const product = products.find((item) => item.id === id); if (!product) return;
    const active = !product.available;
    updateProducts(products.map((item) => item.id === id ? { ...item, available: active, variants: item.variants.map((v) => ({ ...v, available: active })) } : item));
    logActivity(active ? "Producto activado" : "Producto desactivado", product.title);
  };
  const deleteProduct = (id: string) => {
    const product = products.find((item) => item.id === id);
    if (!product || !window.confirm(`¿Eliminar “${product.title}”?`)) return;
    updateProducts(products.filter((item) => item.id !== id)); logActivity("Producto eliminado", product.title);
  };
  const filteredProducts = useMemo(() => products.filter((product) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || product.title.toLowerCase().includes(term) || product.variants.some((variant) => variant.sku.toLowerCase().includes(term));
    const quantity = product.variants.reduce((total, variant) => total + variant.quantity, 0);
    const matchesStatus = status === "todos" || (status === "disponible" && quantity > 5) || (status === "bajo" && quantity > 0 && quantity <= 5) || (status === "agotado" && quantity === 0);
    return matchesSearch && matchesStatus;
  }), [products, search, status]);
  return <section className="panel full-panel"><div className="panel-header"><div><p className="eyebrow">Shopify</p><h2>Productos</h2></div><span className="muted">{filteredProducts.length} de {products.length}</span></div><div className="toolbar"><input aria-label="Buscar productos" placeholder="Buscar por producto o SKU..." value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Filtrar por stock" value={status} onChange={(e) => setStatus(e.target.value)}><option value="todos">Todos</option><option value="disponible">Stock normal</option><option value="bajo">Stock bajo</option><option value="agotado">Agotados</option></select></div><ProductTable products={filteredProducts} showWeight actions={{ onToggle: toggleProduct, onDelete: deleteProduct }} /></section>;
}
