"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { formatEUR } from "@/lib/format";
import { useDebounce } from "@/lib/hooks";

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} style={{ background: "var(--accent-dim)", borderRadius: 2, padding: "0 1px" }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

function stockClass(stock: number) {
  if (stock === 0) return "stock-out";
  if (stock <= 5) return "stock-low";
  return "stock-in";
}

function stockLabel(stock: number) {
  if (stock === 0) return "Out of stock";
  if (stock <= 5) return `${stock} left`;
  return "In stock";
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedInput = useDebounce(inputValue, 180);

  useEffect(() => {
    fetch("/api/search?q=&limit=100", { cache: "no-store" })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAllProducts(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const q = debouncedInput.trim();
    if (q.length < 1) { setSuggestions([]); setSuggestionsOpen(false); return; }
    fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`, { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) { setSuggestions(data); setSuggestionsOpen(true); setActiveIndex(-1); }
        else { setSuggestions([]); setSuggestionsOpen(false); }
      })
      .catch(() => setSuggestions([]));
  }, [debouncedInput]);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setSuggestionsOpen(false);
    setLoading(true);
    setSearched(true);
    setError("");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Search failed."); setResults([]); return; }
      setResults(Array.isArray(data) ? data : []);
      setQuery(trimmed);
    } catch {
      setError("Network error.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen) { if (e.key === "Enter") runSearch(inputValue); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, -1)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        const chosen = suggestions[activeIndex].name;
        setInputValue(chosen);
        setQuery(chosen);
        runSearch(chosen);
      } else runSearch(inputValue);
    } else if (e.key === "Escape") {
      setSuggestionsOpen(false);
      setActiveIndex(-1);
    }
  };

  const pickSuggestion = (product: Product) => {
    setInputValue(product.name);
    setQuery(product.name);
    setSuggestionsOpen(false);
    runSearch(product.name);
    inputRef.current?.focus();
  };

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

  const clearSearch = () => {
    setInputValue(""); setQuery(""); setResults([]); setSuggestions([]);
    setSuggestionsOpen(false); setSearched(false); setError("");
    inputRef.current?.focus();
  };

  // Grid shows results when a search has completed, otherwise all products.
  // During loading we keep allProducts visible so the grid never flashes empty.
  const gridProducts = searched && !loading ? results : allProducts;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)", display: "flex", flexDirection: "column", fontFamily: "var(--font-body)" }}>

      {/* Header */}
      <header style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/logomasjid.png" alt="Masjid Indonesia Frankfurt" width={40} height={40} />
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
            Warung Masjid Indonesia Frankfurt
          </span>
        </div>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", flexShrink: 0, marginLeft: 16 }}>price checker</span>
      </header>

      {/* Search bar */}
      <div style={{ padding: "28px 16px 16px", maxWidth: 960, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <div style={{ position: "relative", maxWidth: 480 }}>
          <input
            ref={inputRef}
            type="text"
            className="search-bar"
            style={{ maxWidth: "100%", paddingRight: "2rem" }}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
            placeholder="Search by name or barcode…"
            autoComplete="off"
            spellCheck={false}
          />

          {loading && (
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: "0.72rem", color: "var(--text-muted)" }}>
              …
            </span>
          )}
          {inputValue && !loading && (
            <button
              onClick={clearSearch}
              aria-label="Clear search"
              style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.1rem", lineHeight: 1, padding: 0 }}
            >×</button>
          )}

          {/* Suggestion dropdown */}
          {suggestionsOpen && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30,
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderTop: "none",
                borderRadius: "0 0 var(--radius-md) var(--radius-md)",
              }}
            >
              {suggestions.map((p, i) => (
                <div
                  key={p.id}
                  onMouseDown={e => { e.preventDefault(); pickSuggestion(p); }}
                  onMouseEnter={() => setActiveIndex(i)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 12px", cursor: "pointer",
                    background: i === activeIndex ? "var(--bg-base)" : "transparent",
                    borderBottom: i < suggestions.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <span style={{ fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Highlight text={p.name} query={debouncedInput} />
                  </span>
                  <span style={{ fontSize: "0.875rem", marginLeft: 12, flexShrink: 0, color: "var(--accent)", fontWeight: 600 }}>
                    €{formatEUR(p.priceCents)}
                  </span>
                </div>
              ))}
              <div style={{ padding: "5px 12px", fontSize: "0.65rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
                ↑↓ navigate · Enter to select · Esc to close
              </div>
            </div>
          )}
        </div>

        {error && (
          <p style={{ marginTop: 8, fontSize: "0.82rem", color: "var(--stock-out)" }}>{error}</p>
        )}
        {searched && !loading && query && (
          <p style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {results.length === 0 ? "No products matched." : `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`}
          </p>
        )}
      </div>

      {/* Product grid — always visible */}
      <div style={{ padding: "0 16px 48px", flex: 1, maxWidth: 960, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <div className="product-grid">
          {gridProducts.map(p => (
            <div key={p.id} className="product-card">
              <div className="name">{p.name}</div>
              <div className="price">€{formatEUR(p.priceCents)}</div>
              <span className={`stock-badge ${stockClass(p.stock)}`}>
                {stockLabel(p.stock)}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
