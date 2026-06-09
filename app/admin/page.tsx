"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import AdminSidebar from "@/components/admin/AdminSidebar";
import StatsRow from "@/components/admin/StatsRow";
import ProductForm from "@/components/admin/ProductForm";
import CsvImportExport from "@/components/admin/CsvImportExport";
import ProductTable from "@/components/admin/ProductTable";
import Toast from "@/components/admin/Toast";
import "./admin.css";

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState("");

  const loadProducts = useCallback(async () => {
    setTableLoading(true);
    try {
      const res = await fetch("/api/admin/products", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setMessage(data.error || "Failed to load products");
      }
    } catch {
      setMessage("Failed to load products");
    } finally {
      setTableLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  function handleEdit(product: Product) {
    setEditingProduct(product);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <div className="layout">
        <AdminSidebar />
        <main className="main">
          <div className="page-header">
            <div className="page-title">Products</div>
            <div className="page-sub">Manage your shop inventory and pricing</div>
          </div>
          <StatsRow products={products} />
          <ProductForm
            editing={editingProduct}
            onSaved={() => { loadProducts(); setEditingProduct(null); }}
            onCancel={() => setEditingProduct(null)}
            onMessage={setMessage}
          />
          <CsvImportExport onImported={loadProducts} onMessage={setMessage} />
          <ProductTable
            products={products}
            loading={tableLoading}
            onEdit={handleEdit}
            onDeleted={() => { loadProducts(); setMessage("✓ Product deleted."); }}
            onMessage={setMessage}
          />
        </main>
      </div>
      <Toast message={message} onClose={() => setMessage("")} />
    </>
  );
}
