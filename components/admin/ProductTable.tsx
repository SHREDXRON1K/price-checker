"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { formatEUR } from "@/lib/format";
import { useDebounce } from "@/lib/hooks";
import { StockBadge } from "@/components/StockBadge";

type Props = {
  products: Product[];
  loading: boolean;
  onEdit: (product: Product) => void;
  onDeleted: () => void;
  onMessage: (msg: string) => void;
};

export default function ProductTable({ products, loading, onEdit, onDeleted, onMessage }: Props) {
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>(products);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchInput, 150);

  useEffect(() => { setFilteredProducts(products); }, [products]);

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

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/admin/products?id=${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (!res.ok) { onMessage(data.error || "Delete failed"); return; }
      onDeleted();
    } catch {
      onMessage("Delete failed");
    } finally {
      setDeleteConfirm(null);
    }
  }

  return (
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
                  <span className="dropdown-item-price">€{formatEUR(p.priceCents)}</span>
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
              <th>Barcode</th><th>Name</th><th>Price</th><th>Stock</th><th>Updated</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1,2,3,4,5].map((i) => (
                <tr key={i}>
                  {[1,2,3,4,5,6].map((j) => (
                    <td key={j}><div className="skeleton" style={{ width: j === 2 ? "80%" : "60%" }} /></td>
                  ))}
                </tr>
              ))
            ) : filteredProducts.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={6}>{searchInput ? "No products match your search." : "No products yet. Add one above."}</td>
              </tr>
            ) : (
              filteredProducts.map((p) => (
                <tr key={p.id}>
                  <td className="td-mono">{p.barcode || "—"}</td>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td className="td-price">€{formatEUR(p.priceCents)}</td>
                  <td><StockBadge stock={p.stock} /></td>
                  <td className="td-mono">
                    {new Date(p.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td>
                    {deleteConfirm === p.id ? (
                      <div className="delete-confirm">
                        <span style={{ fontSize: "0.78rem", color: "#c0392b" }}>Sure?</span>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id)}>Yes</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setDeleteConfirm(null)}>No</button>
                      </div>
                    ) : (
                      <div className="td-actions">
                        <button className="btn btn-sm btn-secondary" onClick={() => onEdit(p)}>Edit</button>
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
  );
}
