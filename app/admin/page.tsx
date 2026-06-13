"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import AdminSidebar from "@/components/admin/AdminSidebar";
import StatsRow from "@/components/admin/StatsRow";
import ProductForm from "@/components/admin/ProductForm";
import CsvImportExport from "@/components/admin/CsvImportExport";
import ProductTable from "@/components/admin/ProductTable";
import Toast from "@/components/admin/Toast";
import { formatEUR } from "@/lib/format";
import "./admin.css";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function weekStartISO() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [tableLoading, setTableLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState("");
  const [todayCents, setTodayCents] = useState<number | null>(null);
  const [weekCents, setWeekCents] = useState<number | null>(null);

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

  useEffect(() => {
    const today = todayISO();
    const weekStart = weekStartISO();
    Promise.all([
      fetch(`/api/admin/sales?from=${today}&to=${today}&limit=1`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/admin/sales?from=${weekStart}&to=${today}&limit=1`, { credentials: "include" }).then((r) => r.json()),
    ]).then(([todayData, weekData]) => {
      setTodayCents(todayData.revenueTotal ?? 0);
      setWeekCents(weekData.revenueTotal ?? 0);
    }).catch(() => {});
  }, []);

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

          {/* Sales metric cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div className="stat-card">
              <div className="stat-label">Today&apos;s Sales</div>
              <div className="stat-value stat-green">
                {todayCents === null ? "—" : `€${formatEUR(todayCents)}`}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">This Week&apos;s Sales</div>
              <div className="stat-value stat-green">
                {weekCents === null ? "—" : `€${formatEUR(weekCents)}`}
              </div>
            </div>
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
