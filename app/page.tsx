"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { formatEUR } from "@/lib/format";
import { useDebounce } from "@/lib/hooks";

const mono = { fontFamily: "var(--font-dm-mono), monospace" } as const;
const body = { fontFamily: "var(--font-inter), system-ui, sans-serif" } as const;

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} style={{ background: "rgba(26,26,24,0.12)", borderRadius: 2, padding: "0 1px" }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

function StockPip({ stock }: { stock: number }) {
  if (stock === 0) return <span style={{ color: "#c0392b" }}>out of stock</span>;
  if (stock <= 5) return <span style={{ color: "#b45309" }}>{stock} left</span>;
  return <span style={{ color: "#2a7a4b" }}>in stock · {stock}</span>;
}

export default function Page() {
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
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
        runSearch(chosen);
      } else runSearch(inputValue);
    } else if (e.key === "Escape") {
      setSuggestionsOpen(false);
      setActiveIndex(-1);
    }
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

  const clear = () => {
    setInputValue(""); setResults([]); setSuggestions([]);
    setSearched(false); setError(""); setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div style={{ ...body, minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Image src="/logomasjid.png" alt="Masjid Indonesia Frankfurt" width={40} height={40} />
        <span style={{ ...mono, fontSize: "0.68rem", color: "var(--text-muted)" }}>price checker</span>
      </header>

      <main style={{ flex: 1, maxWidth: 640, width: "100%", margin: "0 auto", padding: "56px 24px 80px" }}>

        {/* Search input */}
        <div style={{ position: "relative", marginBottom: results.length > 0 || searched ? 40 : 0 }}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
            placeholder="barcode or product name"
            autoComplete="off"
            spellCheck={false}
            style={{
              ...mono,
              width: "100%",
              fontSize: "clamp(1.25rem, 4vw, 1.75rem)",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${suggestionsOpen ? "var(--text-primary)" : "var(--border)"}`,
              outline: "none",
              padding: "10px 36px 10px 0",
              color: "var(--text-primary)",
              transition: "border-color 0.15s",
            }}
          />

          {/* Inline status */}
          {loading && (
            <span style={{ ...mono, position: "absolute", right: 0, bottom: 14, fontSize: "0.72rem", color: "var(--text-muted)" }}>
              searching…
            </span>
          )}
          {inputValue && !loading && (
            <button
              onClick={clear}
              aria-label="Clear"
              style={{ position: "absolute", right: 0, bottom: 12, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.1rem", lineHeight: 1, padding: 0 }}
            >×</button>
          )}

          {/* Suggestions */}
          {suggestionsOpen && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30,
                background: "var(--bg-base)",
                border: "1px solid var(--text-primary)",
                borderTop: "none",
              }}
            >
              {suggestions.map((p, i) => (
                <div
                  key={p.id}
                  onMouseDown={e => { e.preventDefault(); setInputValue(p.name); runSearch(p.name); setSuggestionsOpen(false); }}
                  onMouseEnter={() => setActiveIndex(i)}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", cursor: "pointer",
                    background: i === activeIndex ? "var(--border)" : "transparent",
                    borderBottom: i < suggestions.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <span style={{ ...body, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Highlight text={p.name} query={debouncedInput} />
                  </span>
                  <span style={{ ...mono, fontSize: "0.875rem", marginLeft: 16, flexShrink: 0, color: "var(--text-primary)" }}>
                    €{formatEUR(p.priceCents)}
                  </span>
                </div>
              ))}
              <div style={{ ...mono, padding: "6px 14px", fontSize: "0.65rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
                ↑↓ navigate · Enter to select · Esc to close
              </div>
            </div>
          )}
        </div>

        {/* No results */}
        {searched && !loading && !error && results.length === 0 && (
          <p style={{ ...mono, fontSize: "0.8rem", color: "var(--text-muted)" }}>no products matched</p>
        )}
        {error && <p style={{ ...mono, fontSize: "0.8rem", color: "#c0392b" }}>{error}</p>}

        {/* Single result — signature element */}
        {results.length === 1 && (
          <div>
            <p style={{ ...mono, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-muted)", marginBottom: 6 }}>
              {results[0].barcode || "no barcode"}
            </p>
            <p style={{ ...body, fontSize: "1rem", fontWeight: 500, marginBottom: 20, color: "var(--text-primary)" }}>
              {results[0].name}
            </p>
            <div style={{
              ...mono,
              fontSize: "clamp(4rem, 16vw, 7rem)",
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: "var(--text-primary)",
            }}>
              €{formatEUR(results[0].priceCents)}
            </div>
            <div style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
            }}>
              <span style={{ ...mono, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                <StockPip stock={results[0].stock} />
              </span>
              <span style={{ ...mono, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {new Date(results[0].updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        )}

        {/* Multiple results — compact list */}
        {results.length > 1 && (
          <div>
            <p style={{ ...mono, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 16 }}>
              {results.length} results
            </p>
            {results.map((p, idx) => (
              <div
                key={p.id}
                style={{
                  display: "flex", alignItems: "baseline", justifyContent: "space-between",
                  padding: "13px 0",
                  borderBottom: idx < results.length - 1 ? "1px solid var(--border)" : "none",
                  gap: 16,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ ...body, fontSize: "0.9rem", fontWeight: 500 }}>
                    <Highlight text={p.name} query={query} />
                  </span>
                  {p.barcode && (
                    <span style={{ ...mono, fontSize: "0.68rem", color: "var(--text-muted)", marginLeft: 10 }}>
                      {p.barcode}
                    </span>
                  )}
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ ...mono, fontSize: "1.2rem", fontWeight: 500 }}>€{formatEUR(p.priceCents)}</div>
                  {p.stock === 0 && (
                    <div style={{ ...mono, fontSize: "0.62rem", color: "#c0392b", marginTop: 1 }}>out of stock</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* All products grid — shown by default, replaced by search results */}
      {!searched && allProducts.length > 0 && (
        <div className="product-grid">
          {allProducts.map(p => (
            <div key={p.id} className="product-card">
              <div className="name">{p.name}</div>
              <div className="price">€{formatEUR(p.priceCents)}</div>
              <span className={`stock ${p.stock === 0 ? "stock-out" : p.stock <= 5 ? "stock-low" : "stock-in"}`}>
                {p.stock === 0 ? "Out of stock" : p.stock <= 5 ? `${p.stock} left` : "In stock"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
