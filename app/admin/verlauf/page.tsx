"use client";

import { useCallback, useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { formatEUR } from "@/lib/format";
import "../admin.css";

type SaleRow = {
  id: number;
  productName: string;
  quantity: number;
  priceAtSale: number;
  paymentMethod: string;
  buyerName: string;
  createdAt: string;
};

type SalesData = {
  sales: SaleRow[];
  total: number;
  page: number;
  totalPages: number;
  revenueTotal: number;
};

export default function VerlaufPage() {
  // ── Form inputs ───────────────────────────────────────
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [paymentInput, setPaymentInput] = useState("");
  const [buyerInput, setBuyerInput] = useState("");

  // ── Applied filter state (drives fetch) ───────────────
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [appliedPayment, setAppliedPayment] = useState("");
  const [appliedBuyer, setAppliedBuyer] = useState("");
  const [page, setPage] = useState(1);

  // ── Results ───────────────────────────────────────────
  const [data, setData] = useState<SalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const doFetch = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (appliedFrom) params.set("from", appliedFrom);
    if (appliedTo) params.set("to", appliedTo);
    if (appliedPayment) params.set("paymentMethod", appliedPayment);
    if (appliedBuyer.trim()) params.set("buyerName", appliedBuyer.trim());
    try {
      const r = await fetch(`/api/admin/sales?${params}`, { credentials: "include" });
      const json: SalesData = await r.json();
      setData(json);
    } catch {
      setError("Failed to load sales.");
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo, appliedPayment, appliedBuyer, page]);

  useEffect(() => { doFetch(); }, [doFetch]);

  const handleApply = () => {
    setPage(1);
    setAppliedFrom(fromInput);
    setAppliedTo(toInput);
    setAppliedPayment(paymentInput);
    setAppliedBuyer(buyerInput);
  };

  const handleClear = () => {
    setFromInput(""); setToInput(""); setPaymentInput(""); setBuyerInput("");
    setPage(1);
    setAppliedFrom(""); setAppliedTo(""); setAppliedPayment(""); setAppliedBuyer("");
  };

  const exportParams = new URLSearchParams();
  if (appliedFrom) exportParams.set("from", appliedFrom);
  if (appliedTo) exportParams.set("to", appliedTo);
  if (appliedPayment) exportParams.set("paymentMethod", appliedPayment);
  if (appliedBuyer.trim()) exportParams.set("buyerName", appliedBuyer.trim());
  const exportUrl = `/api/admin/sales/export?${exportParams}`;

  return (
    <div className="layout">
      <AdminSidebar />
      <main className="main">
        <div className="page-header">
          <div className="page-title">Verlauf / Riwayat</div>
          <div className="page-sub">Sales transaction history</div>
        </div>

        {/* ── Filter card ────────────────────────────────── */}
        <div className="card">
          <div className="card-title">🔍 Filter</div>
          <div className="form-grid-4">
            <div className="form-group">
              <label className="form-label">From</label>
              <input
                type="date"
                className="form-input"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">To</label>
              <input
                type="date"
                className="form-input"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Pembayaran</label>
              <select
                className="form-input"
                value={paymentInput}
                onChange={(e) => setPaymentInput(e.target.value)}
              >
                <option value="">All</option>
                <option value="bar">Bar</option>
                <option value="paypal">PayPal</option>
                <option value="iban">IBAN</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Buyer Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Search name…"
                value={buyerInput}
                onChange={(e) => setBuyerInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApply()}
              />
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleApply} disabled={loading}>
              {loading ? "Loading…" : "Apply"}
            </button>
            <button className="btn btn-secondary" onClick={handleClear} disabled={loading}>
              Clear
            </button>
            <a className="btn-link" href={exportUrl} download>
              ⬇ Export CSV
            </a>
          </div>
        </div>

        {error && (
          <p style={{ color: "var(--stock-out)", marginBottom: 16, fontSize: "0.85rem" }}>{error}</p>
        )}

        {/* ── Summary cards ──────────────────────────────── */}
        {data && (
          <div className="stats-row" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-label">Transactions</div>
              <div className="stat-value">{data.total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Revenue (filtered)</div>
              <div className="stat-value stat-green">€{formatEUR(data.revenueTotal)}</div>
            </div>
          </div>
        )}

        {/* ── Sales table ────────────────────────────────── */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nama</th>
                  <th>Barang</th>
                  <th>Qty</th>
                  <th>Harga</th>
                  <th>Pembayaran</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i}>
                      {[1, 2, 3, 4, 5, 6].map((j) => (
                        <td key={j}>
                          <div className="skeleton" style={{ width: j === 3 ? "80%" : "60%" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !data || data.sales.length === 0 ? (
                  <tr className="empty-row">
                    <td colSpan={6}>No sales found for this filter.</td>
                  </tr>
                ) : (
                  data.sales.map((s) => (
                    <tr key={s.id}>
                      <td className="td-mono">
                        {new Date(s.createdAt).toLocaleDateString("de-DE")}
                      </td>
                      <td>{s.buyerName}</td>
                      <td style={{ fontWeight: 500 }}>{s.productName}</td>
                      <td className="td-mono">{s.quantity}</td>
                      <td className="td-price">€{formatEUR(s.priceAtSale * s.quantity)}</td>
                      <td style={{ textTransform: "capitalize" }}>{s.paymentMethod}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {data && data.sales.length > 0 && (
                <tfoot>
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        paddingTop: 12,
                        fontSize: "0.7rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "var(--text-muted)",
                        fontWeight: 600,
                        borderTop: "1.5px solid var(--border)",
                      }}
                    >
                      Revenue Total
                    </td>
                    <td
                      className="td-price"
                      style={{ paddingTop: 12, borderTop: "1.5px solid var(--border)" }}
                    >
                      €{formatEUR(data.revenueTotal)}
                    </td>
                    <td style={{ borderTop: "1.5px solid var(--border)" }} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* ── Pagination ─────────────────────────────── */}
          {data && data.totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 16,
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                Page {data.page} of {data.totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= data.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
