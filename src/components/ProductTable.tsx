import type { Product } from "../types/product";

const money = (value: number) => value.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
type Actions = { onToggle?: (id: string) => void; onDelete?: (id: string) => void };

export function ProductTable({ products, showWeight = false, actions }: { products: Product[]; showWeight?: boolean; actions?: Actions }) {
  return <div className="table-wrap"><table><thead><tr><th>Producto</th><th>SKU</th><th>Variante</th><th>Stock</th><th>Precio</th>{showWeight && <th>Peso</th>}<th>Estado</th>{actions && <th>Acciones</th>}</tr></thead><tbody>
    {products.flatMap((product) => product.variants.map((variant) => {
      const low = variant.quantity > 0 && variant.quantity <= 5; const out = variant.quantity === 0;
      return <tr key={variant.id}><td><strong>{product.title}</strong></td><td className="muted">{variant.sku || "—"}</td><td>{variant.title}</td><td><strong>{variant.quantity}</strong></td><td>{money(variant.price)}</td>{showWeight && <td>{variant.weight > 0 ? `${variant.weight} ${variant.weightUnit}` : "—"}</td>}<td><span className={`status ${out || low ? "warning" : "ok"}`}>{out ? "Agotado" : low ? "Stock bajo" : "Disponible"}</span></td>{actions && <td><div className="row-actions"><button className="action-button" onClick={() => actions.onToggle?.(product.id)}>{product.available ? "Desactivar" : "Activar"}</button><button className="action-button danger" onClick={() => actions.onDelete?.(product.id)}>Eliminar</button></div></td>}</tr>;
    }))}
  </tbody></table></div>;
}
