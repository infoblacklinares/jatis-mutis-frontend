import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { ProductTable } from "../components/ProductTable";
import { readProducts, saveProducts, logActivity } from "../services/localStore";
import { adjustInventory, getLocations, getProducts } from "../services/api";
import { canPerform, getUserRole } from "../services/permissions";
import type { Product } from "../types/product";

export function Inventory() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const role = getUserRole(user);
  const canAdjust = canPerform(role, "inventory.adjust");
  const [products, setProducts] = useState<Product[]>(readProducts);
  const [filter, setFilter] = useState("todos");
  const [editing, setEditing] = useState<{ productId: string; variantId: string } | null>(null);
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("Reposición");
  const [movement, setMovement] = useState<"add" | "remove">("add");
  const [locationId, setLocationId] = useState("");
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getProducts(), getLocations()]).then(([productData, locationData]) => {
      if (!active) return;
      setProducts(productData.nodes);
      saveProducts(productData.nodes);
      setLocationId(locationData.locations.find((location) => location.isActive)?.id || locationData.locations[0]?.id || "");
      setSyncError("");
    }).catch((error) => {
      if (active) setSyncError(error instanceof Error ? error.message : "No fue posible sincronizar Shopify.");
    });
    return () => { active = false; };
  }, []);

  const allVariants = products.flatMap((product) => product.variants);
  const totalUnits = allVariants.reduce((total, variant) => total + variant.quantity, 0);
  const lowStock = allVariants.filter((variant) => variant.quantity > 0 && variant.quantity <= 5).length;
  const outOfStock = allVariants.filter((variant) => variant.quantity === 0).length;
  const selectedProduct = editing ? products.find((p) => p.id === editing.productId) : undefined;
  const selected = selectedProduct?.variants.find((v) => v.id === editing?.variantId);
  const filteredProducts = useMemo(() => products.map((product) => ({ ...product, variants: product.variants.filter((variant) => filter === "todos" || (filter === "bajo" && variant.quantity > 0 && variant.quantity <= 5) || (filter === "agotado" && variant.quantity === 0) || (filter === "normal" && variant.quantity > 5)) })).filter((product) => product.variants.length > 0), [filter, products]);
  const openAdjustment = (productId: string, variantId: string) => { if (!canAdjust) return; setEditing({ productId, variantId }); setAmount(1); setReason("Reposición"); setMovement("add"); setSyncError(""); };

  const adjust = async () => {
    if (!canAdjust || !editing || !selected || !selected.inventoryItemId || !locationId) return;
    const delta = movement === "add" ? amount : -amount;
    try {
      const clerkToken = await getToken();
      if (!clerkToken) throw new Error("Sesión de usuario no disponible.");
      await adjustInventory({ inventoryItemId: selected.inventoryItemId, locationId, delta, currentQuantity: selected.quantity, reason: reason === "Reposición" ? "received" : reason === "Merma" ? "damaged" : reason === "Devolución" ? "returned" : reason === "Venta manual" ? "sale" : "correction" }, clerkToken);
      const refreshed = await getProducts();
      setProducts(refreshed.nodes); saveProducts(refreshed.nodes);
      logActivity(delta > 0 ? "Entrada de inventario" : "Salida de inventario", `${selected.sku || selected.title}: ${Math.abs(delta)} unidad(es) · ${reason}`);
      setEditing(null); setAmount(1); setSyncError("");
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "No fue posible ajustar el inventario en Shopify.");
    }
  };

  const actions = canAdjust ? { onToggle: (id: string) => { const p = products.find((x) => x.id === id); if (p?.variants.length) openAdjustment(p.id, p.variants[0].id); }, onEdit: (product: Product) => { if (product.variants.length) openAdjustment(product.id, product.variants[0].id); } } : undefined;
  const nextStock = selected ? selected.quantity + (movement === "add" ? amount : -amount) : 0;
  const canSubmit = Boolean(selected?.inventoryItemId && locationId && amount > 0 && (movement === "add" || amount <= (selected?.quantity ?? 0)));

  return <section className="panel full-panel">
    <div className="panel-header"><div><p className="eyebrow">Control de existencias</p><h2>Inventario</h2></div><span className="status warning">{lowStock} con stock bajo</span></div>
    {syncError && <div className="inventory-error"><strong>No se pudo completar la operación</strong><span>{syncError}</span></div>}
    <div className="stats-grid compact-stats"><div className="stat-card"><span>Unidades</span><strong>{totalUnits}</strong><small>Stock total · Shopify</small></div><div className="stat-card"><span>Stock bajo</span><strong>{lowStock}</strong><small>Requieren atención</small></div><div className="stat-card"><span>Agotados</span><strong>{outOfStock}</strong><small>Sin existencias</small></div></div>
    <div className="toolbar"><select aria-label="Filtrar inventario" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="todos">Todo el inventario</option><option value="normal">Stock normal</option><option value="bajo">Stock bajo</option><option value="agotado">Agotados</option></select></div>
    <ProductTable products={filteredProducts} showWeight actions={actions} />
    {editing && selectedProduct && selected && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="inventory-modal-title"><div className="modal-card inventory-modal">
      <div className="inventory-modal-head"><div><p className="eyebrow">Control de existencias</p><h2 id="inventory-modal-title">Ajustar stock</h2><p className="inventory-product-name">{selectedProduct.title}</p></div><button className="modal-close" onClick={() => setEditing(null)} aria-label="Cerrar">×</button></div>
      <div className="inventory-current"><span>Stock actual</span><strong>{selected.quantity}</strong><small>unidades disponibles en Shopify</small></div>
      <div className="inventory-form-grid">
        <label>Variante<select aria-label="Seleccionar variante" value={selected.id} onChange={(e) => setEditing({ productId: selectedProduct.id, variantId: e.target.value })}>{selectedProduct.variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.title} · {variant.sku || "Sin SKU"}</option>)}</select></label>
        <label>Motivo<select value={reason} onChange={(e) => setReason(e.target.value)}><option>Reposición</option><option>Ajuste de inventario</option><option>Merma</option><option>Devolución</option><option>Venta manual</option></select></label>
      </div>
      <div className="movement-choice"><span className="movement-label">¿Qué quieres hacer?</span><div className="movement-options"><button type="button" className={`movement-option add ${movement === "add" ? "selected" : ""}`} onClick={() => setMovement("add")}><strong>Agregar stock</strong><span>Sumar unidades al inventario</span></button><button type="button" className={`movement-option remove ${movement === "remove" ? "selected" : ""}`} onClick={() => setMovement("remove")}><strong>Reducir stock</strong><span>Restar unidades del inventario</span></button></div></div>
      <div className="inventory-quantity"><div><span>Cantidad de unidades</span><small>¿Cuántas unidades quieres {movement === "add" ? "agregar" : "retirar"}?</small></div><input aria-label="Cantidad" type="number" min="1" max={movement === "remove" ? selected.quantity : undefined} value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} /></div>
      <div className={`inventory-result ${movement}`}><div><span>Stock actual</span><strong>{selected.quantity}</strong></div><b>→</b><div><span>Nuevo stock</span><strong>{nextStock}</strong></div></div>
      <div className="modal-actions"><button className="action-button" onClick={() => setEditing(null)}>Cancelar</button><button className={`inventory-confirm-button ${movement}`} disabled={!canSubmit} onClick={adjust}>{movement === "add" ? "Agregar " : "Retirar "}{amount} {amount === 1 ? "unidad" : "unidades"}</button></div>
    </div></div>}
  </section>;
}
