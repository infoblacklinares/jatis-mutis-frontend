import { useMemo, useState } from "react";
import { useUser } from "@clerk/react";
import { ProductTable } from "../components/ProductTable";
import { readProducts, saveProducts, logActivity } from "../services/localStore";
import { canPerform, getUserRole } from "../services/permissions";
import type { Product } from "../types/product";

export function Inventory() {
  const { user } = useUser();
  const role = getUserRole(user);
  const canAdjust = canPerform(role, "inventory.adjust");
  const [products, setProducts] = useState<Product[]>(readProducts);
  const [filter, setFilter] = useState("todos");
  const [editing, setEditing] = useState<{ productId: string; variantId: string } | null>(null);
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("Reposición");
  const allVariants = products.flatMap((product) => product.variants);
  const totalUnits = allVariants.reduce((total, variant) => total + variant.quantity, 0);
  const lowStock = allVariants.filter((variant) => variant.quantity > 0 && variant.quantity <= 5).length;
  const outOfStock = allVariants.filter((variant) => variant.quantity === 0).length;
  const selectedProduct = editing ? products.find((p) => p.id === editing.productId) : undefined;
  const selected = selectedProduct?.variants.find((v) => v.id === editing?.variantId);
  const filteredProducts = useMemo(() => products.map((product) => ({ ...product, variants: product.variants.filter((variant) => filter === "todos" || (filter === "bajo" && variant.quantity > 0 && variant.quantity <= 5) || (filter === "agotado" && variant.quantity === 0) || (filter === "normal" && variant.quantity > 5)) })).filter((product) => product.variants.length > 0), [filter, products]);
  const openAdjustment = (productId: string, variantId: string) => { if (!canAdjust) return; setEditing({ productId, variantId }); setAmount(1); setReason("Reposición"); };
  const adjust = (delta: number) => {
    if (!canAdjust || !editing || !selected) return;
    const next = products.map((product) => product.id !== editing.productId ? product : { ...product, variants: product.variants.map((variant) => variant.id !== editing.variantId ? variant : { ...variant, quantity: Math.max(0, variant.quantity + delta) }) });
    setProducts(next); saveProducts(next); logActivity(delta > 0 ? "Entrada de inventario" : "Salida de inventario", `${selected.sku || selected.title}: ${Math.abs(delta)} unidad(es) · ${reason}`); setEditing(null); setAmount(1);
  };
  const actions = canAdjust ? { onToggle: (id: string) => { const p = products.find((x) => x.id === id); if (p?.variants.length) openAdjustment(p.id, p.variants[0].id); }, onEdit: (product: Product) => { if (product.variants.length) openAdjustment(product.id, product.variants[0].id); } } : undefined;
  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Control de existencias</p><h2>Inventario</h2></div><span className="status warning">{lowStock} con stock bajo</span></div>
    <div className="stats-grid compact-stats"><div className="stat-card"><span>Unidades</span><strong>{totalUnits}</strong><small>Stock total</small></div><div className="stat-card"><span>Stock bajo</span><strong>{lowStock}</strong><small>Requieren atención</small></div><div className="stat-card"><span>Agotados</span><strong>{outOfStock}</strong><small>Sin existencias</small></div></div>
    <div className="toolbar"><select aria-label="Filtrar inventario" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="todos">Todo el inventario</option><option value="normal">Stock normal</option><option value="bajo">Stock bajo</option><option value="agotado">Agotados</option></select></div>
    <ProductTable products={filteredProducts} showWeight actions={actions} />
    {editing && selectedProduct && selected && <div className="modal-backdrop"><div className="modal-card"><p className="eyebrow">Movimiento de inventario</p><h2>{selectedProduct.title}</h2><label>Variante<select aria-label="Seleccionar variante" value={selected.id} onChange={(e) => setEditing({ productId: selectedProduct.id, variantId: e.target.value })}>{selectedProduct.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.title} · {variant.sku || "Sin SKU"} · {variant.quantity} un.</option>)}</select></label><p className="muted">SKU: {selected.sku || "—"} · Stock actual: <strong>{selected.quantity}</strong></p><label>Motivo<select value={reason} onChange={(e) => setReason(e.target.value)}><option>Reposición</option><option>Ajuste de inventario</option><option>Merma</option><option>Devolución</option><option>Venta manual</option></select></label><label>Cantidad<input type="number" min="1" value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} /></label><div className="modal-actions"><button className="action-button" onClick={() => setEditing(null)}>Cancelar</button><button className="action-button" onClick={() => adjust(amount)}>+ {amount} entrada</button><button className="primary-button" onClick={() => adjust(-amount)}>- {amount} salida</button></div></div></div>}
  </section>;
}
