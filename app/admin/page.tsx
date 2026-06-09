"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type Product = {
  id: number;
  barcode: string;
  name: string;
  priceCents: number;
  stock: number;
  updatedAt: string;
};

type FormState = {
  id: number | null;
  barcode: string;
  name: string;
  price: string;
  stock: string;
};

const emptyForm: FormState = { id: null, barcode: "", name: "", price: "", stock: "" };

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <span className="badge badge-red">Out of stock</span>;
  if (stock <= 5) return <span className="badge badge-amber">Low · {stock}</span>;
  return <span className="badge badge-green">In stock · {stock}</span>;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  const isError = message.toLowerCase().includes("fail") || message.toLowerCase().includes("error") || message.toLowerCase().includes("invalid");
  return (
    <div className={`toast ${isError ? "toast-error" : ""}`}>
      <span>{message}</span>
      <button onClick={onClose} className="toast-close">✕</button>
    </div>
  );
}

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tableLoading, setTableLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(searchInput, 150);

  const loadProducts = useCallback(async () => {
    setTableLoading(true);
    try {
      const res = await fetch("/api/admin/products", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (Array.isArray(data)) {
        setProducts(data);
        setFilteredProducts(data);
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

  // Live search + suggestions from local data
  useEffect(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) {
      setFilteredProducts(products);
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    const filtered = products.filter((p) => {
      const name = p.name.toLowerCase();
      const barcode = p.barcode.toLowerCase();
      return tokens.every((t) => name.includes(t) || barcode.includes(t));
    });
    setFilteredProducts(filtered);
    if (filtered.length > 0) {
      setSuggestions(filtered.slice(0, 6));
      setSuggestionsOpen(true);
      setActiveIndex(-1);
    } else {
      setSuggestions([]);
      setSuggestionsOpen(false);
    }
  }, [debouncedSearch, products]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setSuggestionsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pickSuggestion = (p: Product) => {
    setSearchInput(p.name);
    setSuggestionsOpen(false);
    setFilteredProducts([p]);
  };

  const handleSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter" && activeIndex >= 0) { e.preventDefault(); pickSuggestion(suggestions[activeIndex]); }
    else if (e.key === "Escape") { setSuggestionsOpen(false); setActiveIndex(-1); }
  };

  const clearSearch = () => {
    setSearchInput("");
    setFilteredProducts(products);
    setSuggestions([]);
    setSuggestionsOpen(false);
    inputRef.current?.focus();
  };

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (!form.name.trim()) { setMessage("Product name is required."); return; }
    if (price < 0 || stock < 0) { setMessage("Price and stock cannot be negative."); return; }
    const payload = { id: form.id, barcode: form.barcode.trim(), name: form.name.trim(), price, stock };
    try {
      setLoading(true);
      const res = await fetch("/api/admin/products", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Save failed"); return; }
      setForm(emptyForm);
      setMessage(form.id ? "✓ Product updated." : "✓ Product added.");
      await loadProducts();
    } catch { setMessage("Save failed"); }
    finally { setLoading(false); }
  }

  async function deleteProduct(id: number) {
    try {
      const res = await fetch(`/api/admin/products?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { setMessage(data.error || "Delete failed"); return; }
      setMessage("✓ Product deleted.");
      if (form.id === id) setForm(emptyForm);
      await loadProducts();
    } catch { setMessage("Delete failed"); }
    finally { setDeleteConfirm(null); }
  }

  // ── CSV upload — read file on client, POST as plain text ─────
  async function uploadCSV(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (!selectedFile) {
      setMessage("Please choose a CSV file first.");
      return;
    }

    try {
      setUploading(true);

      // Read the file as text on the client side
      const csvText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(selectedFile, "utf-8");
      });

      // Send as plain text — no multipart, no file API issues
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        credentials: "include",
        body: csvText,
      });

      let data: any = {};
      try { data = await res.json(); } catch { /* ignore parse error */ }

      if (!res.ok) {
        setMessage(data.error || "Upload failed");
        return;
      }

      setMessage(`✓ Imported ${data.imported ?? "?"} products successfully.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadProducts();

    } catch (err) {
      console.error(err);
      setMessage("Upload failed — could not read file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f4f3f0; color: #1a1a18; }
        .layout { display: flex; min-height: 100vh; }

        .sidebar {
          width: 240px; background: #1a1a18; color: #fff;
          display: flex; flex-direction: column;
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 10;
        }
        .sidebar-logo {
          padding: 24px 20px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex; align-items: center; gap: 12px;
        }
        .logo-text { font-size: 0.9rem; font-weight: 700; line-height: 1.3; color: #fff; }
        .logo-sub { font-size: 0.68rem; color: rgba(255,255,255,0.4); margin-top: 2px; }
        .sidebar-nav { padding: 16px 12px; flex: 1; }
        .nav-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); padding: 0 8px; margin-bottom: 6px; margin-top: 16px; }
        .nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 10px; border-radius: 7px; font-size: 0.85rem;
          color: rgba(255,255,255,0.6); cursor: pointer; transition: all 0.15s;
          text-decoration: none; margin-bottom: 2px;
        }
        .nav-item:hover, .nav-item.active { background: rgba(255,255,255,0.08); color: #fff; }
        .nav-icon { font-size: 14px; width: 18px; text-align: center; }
        .sidebar-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 0.72rem; color: rgba(255,255,255,0.3); }

        .main { margin-left: 240px; flex: 1; padding: 32px; max-width: calc(100vw - 240px); }
        .page-header { margin-bottom: 28px; }
        .page-title { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.03em; }
        .page-sub { font-size: 0.85rem; color: #888; margin-top: 3px; }

        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
        .stat-card { background: #fff; border: 1px solid #e5e3de; border-radius: 10px; padding: 14px 16px; }
        .stat-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em; color: #999; margin-bottom: 4px; }
        .stat-value { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; }
        .stat-green { color: #2a7a4b; }
        .stat-amber { color: #b45309; }
        .stat-red { color: #c0392b; }

        .card { background: #fff; border: 1px solid #e5e3de; border-radius: 12px; padding: 20px 22px; margin-bottom: 20px; }
        .card-title { font-size: 0.95rem; font-weight: 700; margin-bottom: 16px; letter-spacing: -0.01em; display: flex; align-items: center; gap: 8px; }

        .form-grid-4 { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; }
        .form-group { display: flex; flex-direction: column; gap: 4px; }
        .form-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em; color: #888; font-weight: 600; }
        .form-input {
          padding: 9px 12px; border: 1.5px solid #e5e3de; border-radius: 8px;
          font-size: 0.9rem; color: #1a1a18; background: #fff; outline: none;
          transition: border-color 0.15s; width: 100%;
        }
        .form-input:focus { border-color: #1a1a18; }
        .form-actions { display: flex; gap: 8px; margin-top: 14px; }

        .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; font-family: inherit; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary { background: #1a1a18; color: #fff; }
        .btn-primary:hover:not(:disabled) { background: #333; }
        .btn-secondary { background: #fff; color: #1a1a18; border: 1.5px solid #e5e3de; }
        .btn-secondary:hover { background: #f4f3f0; }
        .btn-danger { background: #fff; color: #c0392b; border: 1.5px solid #fcc; }
        .btn-danger:hover { background: #fdf0ed; }
        .btn-sm { padding: 5px 10px; font-size: 0.78rem; border-radius: 6px; }
        .btn-link { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; background: #fff; color: #1a1a18; border: 1.5px solid #e5e3de; text-decoration: none; transition: all 0.15s; }
        .btn-link:hover { background: #f4f3f0; }

        /* File upload area */
        .file-drop-area {
          border: 2px dashed #e5e3de; border-radius: 10px;
          padding: 20px 24px; cursor: pointer;
          transition: all 0.15s; display: flex; align-items: center; gap: 16px;
          background: #fafaf8;
        }
        .file-drop-area:hover { border-color: #1a1a18; background: #f4f3f0; }
        .file-drop-area.has-file { border-color: #2a7a4b; background: #edf7f2; border-style: solid; }
        .file-icon { font-size: 28px; flex-shrink: 0; }
        .file-info { flex: 1; min-width: 0; }
        .file-info-name { font-size: 0.9rem; font-weight: 600; color: #1a1a18; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-info-sub { font-size: 0.75rem; color: #888; margin-top: 2px; }
        .file-clear { background: none; border: none; cursor: pointer; color: #bbb; font-size: 18px; padding: 4px; border-radius: 4px; flex-shrink: 0; }
        .file-clear:hover { color: #c0392b; background: #fdf0ed; }
        .file-hidden { display: none; }

        .csv-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; align-items: center; }
        .csv-hint { font-size: 0.75rem; color: #bbb; margin-top: 10px; font-family: monospace; }

        .search-wrap { position: relative; }
        .search-box {
          display: flex; align-items: center; gap: 8px;
          border: 1.5px solid #e5e3de; border-radius: 10px;
          background: #fff; padding: 0 12px; transition: border-color 0.15s;
        }
        .search-box:focus-within { border-color: #1a1a18; }
        .search-box.open { border-radius: 10px 10px 0 0; border-color: #1a1a18; }
        .search-icon { color: #bbb; flex-shrink: 0; }
        .search-input { flex: 1; border: none; outline: none; font-size: 0.9rem; padding: 10px 0; background: transparent; color: #1a1a18; }
        .search-input::placeholder { color: #bbb; }
        .clear-btn { background: #f4f3f0; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 11px; color: #888; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .clear-btn:hover { background: #e5e3de; }
        .dropdown {
          position: absolute; top: 100%; left: 0; right: 0;
          background: #fff; border: 1.5px solid #1a1a18; border-top: none;
          border-radius: 0 0 10px 10px; z-index: 50; overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }
        .dropdown-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 14px; cursor: pointer; font-size: 0.85rem; gap: 8px; transition: background 0.1s;
        }
        .dropdown-item:hover, .dropdown-item.active { background: #f4f3f0; }
        .dropdown-item-name { color: #1a1a18; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dropdown-item-price { color: #888; font-size: 0.8rem; font-family: monospace; flex-shrink: 0; }
        .dropdown-hint { padding: 7px 14px; font-size: 0.72rem; color: #bbb; border-top: 1px solid #f4f3f0; }

        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th { text-align: left; padding: 10px 12px; border-bottom: 1.5px solid #e5e3de; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em; color: #999; font-weight: 600; white-space: nowrap; }
        td { padding: 11px 12px; border-bottom: 1px solid #f4f3f0; color: #1a1a18; vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #fafaf8; }
        .td-mono { font-family: monospace; font-size: 0.8rem; color: #888; }
        .td-price { font-family: monospace; font-weight: 700; }
        .td-actions { display: flex; gap: 6px; }
        .empty-row td { text-align: center; padding: 48px; color: #bbb; }

        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; }
        .badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .badge-green { background: #edf7f2; color: #2a7a4b; }
        .badge-green::before { background: #2a7a4b; }
        .badge-amber { background: #fff8e6; color: #b45309; }
        .badge-amber::before { background: #f59e0b; }
        .badge-red { background: #fdf0ed; color: #c0392b; }
        .badge-red::before { background: #c0392b; }

        .delete-confirm { display: flex; align-items: center; gap: 6px; }

        .toast {
          position: fixed; bottom: 24px; right: 24px;
          background: #1a1a18; color: #fff;
          padding: 12px 16px; border-radius: 10px; font-size: 0.85rem;
          display: flex; align-items: center; gap: 12px;
          z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.2);
          animation: slideIn 0.2s ease; max-width: 360px;
        }
        .toast-error { background: #c0392b; }
        .toast-close { background: none; border: none; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 14px; padding: 0; flex-shrink: 0; }
        .toast-close:hover { color: #fff; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .skeleton { background: linear-gradient(90deg, #f4f3f0 25%, #eae8e4 50%, #f4f3f0 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite; border-radius: 4px; height: 14px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        @media (max-width: 768px) {
          .sidebar { display: none; }
          .main { margin-left: 0; max-width: 100vw; padding: 16px; }
          .stats-row { grid-template-columns: 1fr 1fr; }
          .form-grid-4 { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="layout">
        <aside className="sidebar">
          <div className="sidebar-logo">
            {/* Replace emoji with your logo: <img src="/logomasjid.png" alt="Logo" style={{width:40,height:40,borderRadius:8,objectFit:'contain'}} /> */}
            <img src="/logomasjid.png" alt="Shop Logo" style={{width:40,height:40,borderRadius:8,objectFit:'contain'}} />
            <div>
              <div className="logo-text">Masjid Indonesia Frankfurt</div>
              <div className="logo-sub">Admin Panel</div>
            </div>
          </div>
          <nav className="sidebar-nav">
            <div className="nav-label">Inventory</div>
            <a className="nav-item active" href="/admin">
              <span className="nav-icon">📦</span> Products
            </a>
            <a className="nav-item" href="/api/admin/export">
              <span className="nav-icon">⬇</span> Export CSV
            </a>
            <div className="nav-label">Store</div>
            <a className="nav-item" href="/search" target="_blank">
              <span className="nav-icon">🔍</span> Price Checker
            </a>
          </nav>
          <div className="sidebar-footer">Price Checker v1.0</div>
        </aside>

        <main className="main">
          <div className="page-header">
            <div className="page-title">Products</div>
            <div className="page-sub">Manage your shop inventory and pricing</div>
          </div>

          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-label">Total Products</div>
              <div className="stat-value">{products.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">In Stock</div>
              <div className="stat-value stat-green">{products.filter(p => p.stock > 5).length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Low Stock</div>
              <div className="stat-value stat-amber">{products.filter(p => p.stock > 0 && p.stock <= 5).length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Out of Stock</div>
              <div className="stat-value stat-red">{products.filter(p => p.stock === 0).length}</div>
            </div>
          </div>

          {/* Add / Edit Form */}
          <div className="card">
            <div className="card-title">{form.id ? "✏️ Edit Product" : "➕ Add Product"}</div>
            <form onSubmit={saveProduct}>
              <div className="form-grid-4">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input className="form-input" placeholder="e.g. Coca Cola 500ml" value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Barcode</label>
                  <input className="form-input" placeholder="e.g. 4012345678901" value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Price (€)</label>
                  <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Stock</label>
                  <input className="form-input" type="number" min="0" step="1" placeholder="0" value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Saving…" : form.id ? "Update Product" : "Add Product"}
                </button>
                {form.id && (
                  <button type="button" className="btn btn-secondary" onClick={() => setForm(emptyForm)}>Cancel</button>
                )}
              </div>
            </form>
          </div>

          {/* CSV Import / Export */}
          <div className="card">
            <div className="card-title">📂 Import / Export CSV</div>
            <form onSubmit={uploadCSV}>
              {/* File drop area — shows selected file name */}
              <div
                className={`file-drop-area ${selectedFile ? "has-file" : ""}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="file-icon">{selectedFile ? "📄" : "📂"}</span>
                <div className="file-info">
                  {selectedFile ? (
                    <>
                      <div className="file-info-name">{selectedFile.name}</div>
                      <div className="file-info-sub">
                        {(selectedFile.size / 1024).toFixed(1)} KB · Click to change
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="file-info-name" style={{ color: "#888", fontWeight: 400 }}>Click to choose a CSV file</div>
                      <div className="file-info-sub">barcode, name, price, stock</div>
                    </>
                  )}
                </div>
                {selectedFile && (
                  <button
                    type="button"
                    className="file-clear"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    title="Remove file"
                  >✕</button>
                )}
              </div>

              {/* Hidden actual file input */}
              <input
                ref={fileInputRef}
                type="file"
                name="file"
                accept=".csv,text/csv,text/plain"
                className="file-hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setSelectedFile(file);
                }}
              />

              <div className="csv-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={uploading || !selectedFile}
                >
                  {uploading ? "Importing…" : "⬆ Import CSV"}
                </button>
                <a href="/api/admin/export" className="btn-link">⬇ Export CSV</a>
              </div>
              <div className="csv-hint">Format: barcode,name,price,stock — first row must be headers</div>
            </form>
          </div>

          {/* Product Table */}
          <div className="card">
            <div className="card-title">📋 All Products ({filteredProducts.length})</div>
            <div style={{ marginBottom: 16 }}>
              <div className="search-wrap">
                <div className={`search-box ${suggestionsOpen ? "open" : ""}`}>
                  <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    ref={inputRef}
                    className="search-input"
                    placeholder="Search by name or barcode…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={handleSearchKey}
                    onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
                    autoComplete="off"
                  />
                  {searchInput && (
                    <button className="clear-btn" onClick={clearSearch} type="button">✕</button>
                  )}
                </div>
                {suggestionsOpen && suggestions.length > 0 && (
                  <div className="dropdown" ref={dropdownRef}>
                    {suggestions.map((p, i) => (
                      <div
                        key={p.id}
                        className={`dropdown-item ${i === activeIndex ? "active" : ""}`}
                        onMouseDown={(e) => { e.preventDefault(); pickSuggestion(p); }}
                        onMouseEnter={() => setActiveIndex(i)}
                      >
                        <span className="dropdown-item-name">{p.name}</span>
                        <span className="dropdown-item-price">€{(p.priceCents / 100).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="dropdown-hint">↑↓ navigate · Enter to select · Esc to close</div>
                  </div>
                )}
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Barcode</th>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableLoading ? (
                    [1,2,3,4,5].map(i => (
                      <tr key={i}>
                        {[1,2,3,4,5,6].map(j => (
                          <td key={j}><div className="skeleton" style={{ width: j === 2 ? "80%" : "60%" }} /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredProducts.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan={6}>
                        {searchInput ? "No products match your search." : "No products yet. Add one above."}
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <tr key={p.id}>
                        <td className="td-mono">{p.barcode || "—"}</td>
                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                        <td className="td-price">€{(p.priceCents / 100).toFixed(2)}</td>
                        <td><StockBadge stock={p.stock} /></td>
                        <td className="td-mono">{new Date(p.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td>
                          {deleteConfirm === p.id ? (
                            <div className="delete-confirm">
                              <span style={{ fontSize: "0.78rem", color: "#c0392b" }}>Sure?</span>
                              <button className="btn btn-sm btn-danger" onClick={() => deleteProduct(p.id)}>Yes</button>
                              <button className="btn btn-sm btn-secondary" onClick={() => setDeleteConfirm(null)}>No</button>
                            </div>
                          ) : (
                            <div className="td-actions">
                              <button className="btn btn-sm btn-secondary" onClick={() => {
                                setForm({ id: p.id, barcode: p.barcode, name: p.name, price: (p.priceCents / 100).toFixed(2), stock: String(p.stock) });
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}>Edit</button>
                              <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(p.id)}>Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      <Toast message={message} onClose={() => setMessage("")} />
    </>
  );
}
