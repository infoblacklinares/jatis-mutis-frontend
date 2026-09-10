import type { Product } from "../types/product";

const money = (value: number) => value.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export function ProductTable({ products }: { products: Product[] }) {
  return <div className="table-wrap"><table><thead><tr><th>Producto</th><th>SKU</th><th>Stock</th><th>Precio</th><th>Estado</th></tr></thead><tbody>
    {products.map((product) => { const variant = product.variants[0]; const low = variant.quantity <= 5; return <tr key={product.id}>
      <td>{product.title}</td><td className="muted">{variant.sku || "—"}</td><td><strong>{variant.quantity}</strong></td><td>{money(variant.price)}</td>
      <td><span className={`status ${low ? "warning" : "ok"}`}>{low ? "Stock bajo" : "Disponible"}</span></td>
    </tr>; })}
  </tbody></table></div>;
}
