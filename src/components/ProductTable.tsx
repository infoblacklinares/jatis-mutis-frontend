import type { Product } from "../types/product";

const money = (value: number) => value.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export function ProductTable({ products, showWeight = false }: { products: Product[]; showWeight?: boolean }) {
  return <div className="table-wrap"><table><thead><tr><th>Producto</th><th>SKU</th><th>Variante</th><th>Stock</th><th>Precio</th>{showWeight && <th>Peso</th>}<th>Estado</th></tr></thead><tbody>
    {products.flatMap((product) => product.variants.length ? product.variants.map((variant) => {
      const low = variant.quantity > 0 && variant.quantity <= 5;
      const out = variant.quantity === 0;
      return <tr key={variant.id}>
        <td><strong>{product.title}</strong></td>
        <td className="muted">{variant.sku || "—"}</td>
        <td>{variant.title}</td>
        <td><strong>{variant.quantity}</strong></td>
        <td>{money(variant.price)}</td>
        {showWeight && <td>{variant.weight > 0 ? `${variant.weight} ${variant.weightUnit}` : "—"}</td>}
        <td><span className={`status ${out || low ? "warning" : "ok"}`}>{out ? "Agotado" : low ? "Stock bajo" : "Disponible"}</span></td>
      </tr>;
    }) : [] )}
  </tbody></table></div>;
}
