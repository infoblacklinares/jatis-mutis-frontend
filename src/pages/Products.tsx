import { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { ProductTable } from "../components/ProductTable";
import { apiConfigured, getProducts, updateProduct } from "../services/api";
import { readProducts, saveProducts, logActivity } from "../services/localStore";
import { canPerform, getUserRole } from "../services/permissions";
import type { Product } from "../types/product";

type Editing = { productId: string; variantId: string } | null;

export function Products() {
  const { user } = useUser();
  const role = getUserRole(user);
  const canManage = canPerform(role, "products.manage");
  const [products, setProducts] = useState<Product[]>(readProducts);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState({ title: "", sku: "", price: 0, weight: 0, weightUnit: "g" });
  const [loading, setLoading] = useState(apiConfigured);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");

  const refresh = async () => {
    const response = await getProducts();
    setProducts(response.nodes);
    saveProducts(response.nodes);
  };

  useEffect(() => {
    if (!apiConfigured) return;
    let active = true;
    getProducts().then((response) => {
      if (!active) return;
      setProducts(response.nodes); saveProducts(response.nodes); setApiError("");
    }).catch((error) => {
      if (active) setApiError(error instanceof Error ? error.message : "No fue posible cargar Shopify.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const toggleProduct = async (id: string) => {
    if (!canManage || saving) return;
    const product = products.find((item) => item.id === id); const variant = product?.variants[0]; if (!product || !variant) return;
    setSaving(true); setApiError("");
    try {
      await updateProduct({ productId: product.id, variantId: variant.id, title: product.title, sku: variant.sku, price: variant.price, weight: variant.weight, weightUnit: variant.weightUnit || "g", available: !product.available });
      await refresh();
      logActivity(!product.available ? "Producto activado" : "Producto desactivado", product.title);
    } catch (error) { setApiError(error instanceof Error ? error.message : "No fue posible actualizar el producto."); }
    finally { setSaving(false); }
  };

  const openEdit = (product: Product) => {
    if (!canManage) return;
    const variant = product.variants[0]; if (!variant) return;
    setEditing({ productId: product.id, variantId: variant.id });
    setDraft({ title: product.title, sku: variant.sku, price: variant.price, weight: variant.weight, weightUnit: variant.weightUnit || "g" });
  };

  const saveEdit = async () => {
    if (!canManage || !editing || saving) return;
    const product = products.find((item) => item.id === editing.productId); if (!product) return;
    setSaving(true); setApiError("");
    try {
      await updateProduct({ productId: editing.productId, variantId: editing.variantId, title: draft.title.trim() || product.title, sku: draft.sku.trim(), price: Math.max(0, Number(draft.price) || 0), weight: Math.max(0, Number(draft.weight) || 0), weightUnit: draft.weightUnit, available: product.available });
      await refresh();
      logActivity("Producto editado", `${draft.title || product.title} · ${draft.sku || "sin SKU"}`);
      setEditing(null);
    } catch (error) { setApiError(error instanceof Error ? error.message : "No fue posible guardar el producto en Shopify."); }
    finally { setSaving(false); }
  };

  const filteredProducts = useMemo(() => products.filter((product) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || product.title.toLowerCase().includes(term) || product.variants.some((variant) => variant.sku.toLowerCase().includes(term));
    const quantity = product.variants.reduce((total, variant) => total + variant.quantity, 0);
    const matchesStatus = status === "todos" || (status === "disponible" && quantity > 5) || (status === "bajo" && quantity > 0 && quantity <= 5) || (status === "agotado" && quantity === 0);
    return matchesSearch && matchesStatus;
  }), [products, search, status]);

  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Shopify</p><h2>Productos</h2></div><span className="muted">{filteredProducts.length} de {products.length}</span></div>
    {loading && <p className="muted">Conectando con Shopify…</p>}
    {apiError && <div className="inventory-error"><strong>No se pudo actualizar Shopify</strong><span>{apiError}</span></div>}
    <div className="toolbar"><input aria-label="Buscar productos" placeholder="Buscar por producto o SKU..." value={search} onChange={(e) => setSearch(e.target.value)} /><select aria-label="Filtrar por stock" value={status} onChange={(e) => setStatus(e.target.value)}><option value="todos">Todos</option><option value="disponible">Stock normal</option><option value="bajo">Stock bajo</option><option value="agotado">Agotados</option></select></div>
    <ProductTable products={filteredProducts} showWeight actions={canManage ? { onEdit: openEdit, onToggle: toggleProduct } : undefined} />
    {editing && canManage && <div className="modal-backdrop"><div className="modal-card"><p className="eyebrow">Edición Shopify</p><h2>Editar producto</h2><label>Nombre<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label><label>SKU<input value={draft.sku} placeholder="SKU de variante" onChange={(e) => setDraft({ ...draft, sku: e.target.value })} /></label><label>Precio<input type="number" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} /></label><label>Peso<input type="number" min="0" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })} /></label><label>Unidad<select value={draft.weightUnit} onChange={(e) => setDraft({ ...draft, weightUnit: e.target.value })}><option value="g">Gramos</option><option value="kg">Kilogramos</option></select></label><p className="muted">Los cambios se guardarán directamente en Shopify. El stock se gestiona desde Inventario.</p><div className="modal-actions"><button className="action-button" disabled={saving} onClick={() => setEditing(null)}>Cancelar</button><button className="primary-button" disabled={saving} onClick={saveEdit}>{saving ? "Guardando…" : "Guardar cambios"}</button></div></div></div>}
  </section>;
}
