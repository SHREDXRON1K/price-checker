import type { Product } from "@/lib/types";

type Props = { products: Product[] };

export default function StatsRow({ products }: Props) {
  const inStock = products.filter((p) => p.stock > 5).length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const outOfStock = products.filter((p) => p.stock === 0).length;

  return (
    <div className="stats-row">
      <div className="stat-card">
        <div className="stat-label">Total Products</div>
        <div className="stat-value">{products.length}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">In Stock</div>
        <div className="stat-value stat-green">{inStock}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Low Stock</div>
        <div className="stat-value stat-amber">{lowStock}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Out of Stock</div>
        <div className="stat-value stat-red">{outOfStock}</div>
      </div>
    </div>
  );
}
