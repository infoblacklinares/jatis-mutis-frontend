import { useMemo, useState } from "react";
import { ProductTable } from "../components/ProductTable";
import { readProducts, saveProducts, logActivity } from "../services/localStore";
import type { Product } from "../types/product";

type Editing = { productId: string; variantId: string } | null;

export function Products() {
  const [products, setProducts] = useState<Product[]>(readProducts);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState({ title: "", sku: "", price: 0, weight: 0, weightUnit: "g" });
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
  const openEdit = (product: Product) => {
    const variant = product.variants[0]; if (!variant) return;
    setEditing({ productId: product.id, variantId: variant.id });
    setDraft({ title: product.title, sku: variant.sku, price: variant.price, weight: variant.weight, weightUnit: variant.weightUnit || "g" });
  };
  const saveEdit = () => {
    if (!editing) return;
    const product = products.find((item) => item.id === editing.productId); if (!product) return;
    const next = products.map((item) => item.id !== editing.productId ? item : { ...item, title: draft.title.trim() || item.title, variants: item.variants.map((variant) => variant.id !== editing.variantId ? variant : { ...variant, sku: draft.sku.trim(), price: Math.max(0, Number(draft.price) || 0), weight: Math.max(0, Number(draft.weight) || 0), weightUnit: draft.weightUnit }) });
    updateProducts(next); logActivity("Producto editado", `${draft.title || product.title} · ${draft.sku || "sin SKU"}`); setEditing(null);
  };
  const filteredProducts = useMemo(() => products.filter((product) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || product.title.toLowerCase().includes(term) || product.variants.some((variant) => variant.sku.toLowerCase().includes(term));
    const quantity = product.variants.reduce((total, variant) => total + variant.quantity, 0);
    const matchesStatus = status === "todos" || (status === "disponible" && quantity > 5) || (status === "bajo" && quantity > 0 && quantity <= 5) || (status === "agotado" && quantity === 0);
    return matchesSearch && matchesStatus;
  }), [products, search, status]);
  return <section className="panel full-panel"><div className="panel-header"><div><p className="eyebrow">Shopify</p><h2>Productos</h2></div><span className="muted">{filteredProducts.length} de {products.length}</span></div><div className="toolbar"><input aria-label="Buscar productos" placeholder="Buscar por producto o SKU..." value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Filtrar por stock" value={status} onChange={(e) => setStatus(e.target.value)}><option value="todos">Todos</option><option value="disponible">Stock normal</option><option value="bajo">Stock bajo</option><option value="agotado">Agotados</option></select></div><ProductTable products={filteredProducts} showWeight actions={{ onEdit: openEdit, onToggle: toggleProduct, onDelete: deleteProduct }} />
    {editing && <div className="modal-backdrop"><div className="modal-card"><p className="eyebrow">Edición</p><h2>Editar producto</h2><label>Nombre<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label><label>SKU<input value={draft.sku} placeholder="SKU de variante" onChange={(e) => setDraft({ ...draft, sku: e.target.value })} /></label><label>Precio<input type="number" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></label><label>Peso<input type="number" min="0" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })} /></label><label>Unidad<select value={draft.weightUnit} onChange={(e) => setDraft({ ...draft, weightUnit: e.target.value })}><option value="g">g</option><option value="kg">kg</option><option value="KILOGRAMS">KILOGRAMS</option></select></label><p className="muted">El stock se gestiona desde Inventario.</p><div className="modal-actions"><button className="action-button" onClick={() => setEditing(null)}>Cancelar</button><button className="primary-button" onClick={saveEdit}>Guardar cambios</button></div></div></div>}
  </section>;
}
