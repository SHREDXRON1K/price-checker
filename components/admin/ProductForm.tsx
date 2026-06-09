"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { formatEUR } from "@/lib/format";

type Fields = { barcode: string; name: string; price: string; stock: string };
const empty: Fields = { barcode: "", name: "", price: "", stock: "" };

type Props = {
  editing: Product | null;
  onSaved: () => void;
  onCancel: () => void;
  onMessage: (msg: string) => void;
};

export default function ProductForm({ editing, onSaved, onCancel, onMessage }: Props) {
  const [fields, setFields] = useState<Fields>(empty);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFields(
      editing
        ? { barcode: editing.barcode, name: editing.name, price: formatEUR(editing.priceCents), stock: String(editing.stock) }
        : empty
    );
  }, [editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onMessage("");
    const price = Number(fields.price);
    const stock = Number(fields.stock);
    if (!fields.name.trim()) { onMessage("Product name is required."); return; }
    if (price < 0 || stock < 0) { onMessage("Price and stock cannot be negative."); return; }

    const payload = {
      ...(editing ? { id: editing.id } : {}),
      barcode: fields.barcode.trim(),
      name: fields.name.trim(),
      price,
      stock,
    };

    try {
      setLoading(true);
      const res = await fetch("/api/admin/products", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { onMessage(data.error || "Save failed"); return; }
      setFields(empty);
      onMessage(editing ? "✓ Product updated." : "✓ Product added.");
      onSaved();
    } catch {
      onMessage("Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">{editing ? "✏️ Edit Product" : "➕ Add Product"}</div>
      <form onSubmit={handleSubmit}>
        <div className="form-grid-4">
          <div className="form-group">
            <label className="form-label">Product Name *</label>
            <input className="form-input" placeholder="e.g. Coca Cola 500ml" value={fields.name}
              onChange={(e) => setFields({ ...fields, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Barcode</label>
            <input className="form-input" placeholder="e.g. 4012345678901" value={fields.barcode}
              onChange={(e) => setFields({ ...fields, barcode: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Price (€)</label>
            <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={fields.price}
              onChange={(e) => setFields({ ...fields, price: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Stock</label>
            <input className="form-input" type="number" min="0" step="1" placeholder="0" value={fields.stock}
              onChange={(e) => setFields({ ...fields, stock: e.target.value })} required />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Saving…" : editing ? "Update Product" : "Add Product"}
          </button>
          {editing && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
