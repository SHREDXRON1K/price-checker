"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { formatEUR } from "@/lib/format";
import { useDebounce } from "@/lib/hooks";

type CartItem = {
  productId: number;
  name: string;
  priceCents: number;
  quantity: number;
};

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
  // ── Search state ──────────────────────────────────────
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

  // ── Cart state ────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bar" | "paypal" | "iban">("bar");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successMsg, setSuccessMsg] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedInput = useDebounce(inputValue, 180);

  // ── Cart derived values (integer cents only) ──────────
  const cartTotalQty = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotalCents = cart.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

  // ── Cart functions ────────────────────────────────────
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId: product.id, name: product.name, priceCents: product.priceCents, quantity: 1 }];
    });
  }, []);

  const addToCartById = useCallback((productId: number, name: string, priceCents: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing) {
        return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId, name, priceCents, quantity: 1 }];
    });
  }, []);

  const updateQty = useCallback((productId: number, delta: number) => {
    setCart(prev =>
      prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + delta } : i)
          .filter(i => i.quantity > 0)
    );
  }, []);

  // ── Drag & drop ───────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const productId = Number(e.dataTransfer.getData("productId"));
    const name = e.dataTransfer.getData("productName");
    const priceCents = Number(e.dataTransfer.getData("priceCents"));
    if (!productId || !name) return;
    addToCartById(productId, name, priceCents);
  }, [addToCartById]);

  // ── Submit ────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (cart.length === 0 || !buyerName.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
          buyerName: buyerName.trim(),
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(
          data.error === "insufficient_stock"
            ? `Stok habis: ${data.product}`
            : "Terjadi kesalahan. Coba lagi."
        );
      } else {
        setCart([]);
        setBuyerName("");
        setPaymentMethod("bar");
        setSuccessMsg(true);
        setTimeout(() => {
          setSuccessMsg(false);
          setDrawerOpen(false);
        }, 2000);
      }
    } catch {
      setSubmitError("Network error. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }, [cart, buyerName, paymentMethod, submitting]);

  // ── Search effects (unchanged) ────────────────────────
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

  const gridProducts = searched && !loading ? results : allProducts;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)", display: "flex", flexDirection: "column", fontFamily: "var(--font-body)" }}>

      <style>{`
        .cart-drawer {
          position: fixed;
          top: 0; right: 0; bottom: 0;
          width: 380px;
          max-width: 100vw;
          background: var(--bg-surface);
          border-left: 1px solid var(--border);
          box-shadow: -4px 0 20px rgba(0,0,0,0.07);
          transform: translateX(110%);
          transition: transform 240ms ease;
          z-index: 50;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .cart-drawer.open { transform: translateX(0); }

        @media (max-width: 600px) {
          .cart-drawer {
            top: auto; left: 0; right: 0; bottom: 0;
            width: 100%;
            max-height: 90vh;
            border-left: none;
            border-top: 1px solid var(--border);
            border-radius: var(--radius-lg) var(--radius-lg) 0 0;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.07);
            transform: translateY(110%);
          }
          .cart-drawer.open { transform: translateY(0); }
        }

        .trolley-btn {
          position: fixed;
          top: 10px; right: 16px;
          z-index: 60;
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 7px 10px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          min-width: 52px;
          transition: border-color var(--transition), background var(--transition);
          user-select: none;
        }
        .trolley-btn:hover, .trolley-btn.drag-active {
          border-color: var(--accent-light);
        }
        .trolley-btn.drag-active { background: var(--accent-dim); }

        .trolley-badge {
          background: var(--accent);
          color: #fff;
          font-size: 0.62rem;
          font-weight: 700;
          min-width: 18px;
          height: 18px;
          border-radius: 99px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          font-family: var(--font-body);
        }

        .tambah-btn {
          margin-top: 0.75rem;
          width: 100%;
          padding: 5px 0;
          border: 1px solid var(--accent);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          color: var(--accent);
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: background var(--transition), color var(--transition);
        }
        .tambah-btn:hover:not(:disabled) { background: var(--accent); color: #fff; }
        .tambah-btn:disabled {
          border-color: var(--border);
          color: var(--text-muted);
          cursor: default;
        }

        .qty-btn {
          width: 28px; height: 28px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          background: var(--bg-surface);
          color: var(--text-primary);
          font-size: 1rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: border-color var(--transition);
          font-family: var(--font-body);
        }
        .qty-btn:hover { border-color: var(--accent-light); }

        .pay-btn {
          flex: 1;
          padding: 6px 4px;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--bg-surface);
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: 0.82rem;
          cursor: pointer;
          transition: background var(--transition), border-color var(--transition), color var(--transition);
        }
        .pay-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
        .pay-btn:not(.active):hover { border-color: var(--accent-light); }

        .submit-btn {
          width: 100%;
          padding: 10px;
          border: none;
          border-radius: var(--radius-md);
          background: var(--accent);
          color: #fff;
          font-family: var(--font-body);
          font-size: 0.92rem;
          font-weight: 600;
          cursor: pointer;
          transition: background var(--transition);
        }
        .submit-btn:hover:not(:disabled) { background: var(--accent-light); }
        .submit-btn:disabled { background: var(--border); color: var(--text-muted); cursor: default; }
      `}</style>

      {/* ── Trolley icon ─────────────────────────────────── */}
      <div
        className={`trolley-btn${dragOver ? " drag-active" : ""}`}
        onClick={() => setDrawerOpen(true)}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        role="button"
        aria-label="Open cart"
        title="Warenkorb / Keranjang"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
        {cartTotalQty > 0 ? (
          <span className="trolley-badge">{cartTotalQty}</span>
        ) : (
          <span style={{ fontSize: "0.52rem", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.25, maxWidth: 48 }}>
            Hier ablegen /<br />Taruh di sini
          </span>
        )}
      </div>

      {/* ── Backdrop ──────────────────────────────────────── */}
      {drawerOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 49 }}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Cart drawer ───────────────────────────────────── */}
      <div className={`cart-drawer${drawerOpen ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Warenkorb">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "0.97rem", fontWeight: 700, margin: 0 }}>
            Warenkorb / Keranjang
          </h2>
          <button
            onClick={() => setDrawerOpen(false)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.3rem", lineHeight: 1, padding: "2px 6px" }}
            aria-label="Close cart"
          >×</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

          {successMsg ? (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div style={{ fontSize: "2.2rem", color: "var(--accent)", marginBottom: 10 }}>✓</div>
              <p style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--accent)", fontSize: "1rem" }}>
                Danke! / Terima kasih!
              </p>
            </div>
          ) : (
            <>
              {/* Item list */}
              {cart.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.83rem", textAlign: "center", paddingTop: 28, lineHeight: 1.7 }}>
                  Keranjang kosong.<br />
                  Tap &ldquo;+ Tambah&rdquo; or drag a product to the cart icon.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {cart.map((item, idx) => (
                    <div
                      key={item.productId}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 0",
                        borderBottom: idx < cart.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--accent)", fontWeight: 700 }}>
                          €{formatEUR(item.priceCents * item.quantity)}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <button className="qty-btn" onClick={() => updateQty(item.productId, -1)} aria-label="Decrease">−</button>
                        <span style={{ minWidth: 18, textAlign: "center", fontSize: "0.88rem", fontWeight: 600 }}>{item.quantity}</span>
                        <button className="qty-btn" onClick={() => updateQty(item.productId, 1)} aria-label="Increase">+</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              {cart.length > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, paddingTop: 2 }}>
                    <span style={{ fontSize: "0.88rem" }}>Total</span>
                    <span style={{ color: "var(--accent)", fontSize: "1.05rem" }}>€{formatEUR(cartTotalCents)}</span>
                  </div>
                  <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: 0 }} />
                </>
              )}

              {/* Buyer name */}
              <div>
                <label htmlFor="buyer-name" style={{ display: "block", fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 4 }}>
                  Nama / Name *
                </label>
                <input
                  id="buyer-name"
                  type="text"
                  className="search-bar"
                  style={{ maxWidth: "100%", fontSize: "0.88rem", padding: "7px 10px" }}
                  placeholder="Nama / Name"
                  value={buyerName}
                  onChange={e => setBuyerName(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* Payment method */}
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 6 }}>
                  Pembayaran / Zahlung
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["bar", "paypal", "iban"] as const).map(m => (
                    <button
                      key={m}
                      className={`pay-btn${paymentMethod === m ? " active" : ""}`}
                      onClick={() => setPaymentMethod(m)}
                    >
                      {m === "bar" ? "Bar" : m === "paypal" ? "PayPal" : "IBAN"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Tanggal:{" "}
                <span style={{ color: "var(--text-primary)" }}>
                  {new Date().toLocaleDateString("de-DE")}
                </span>
              </div>

              {/* Error */}
              {submitError && (
                <p style={{ fontSize: "0.82rem", color: "#ef4444", background: "#fee2e2", padding: "8px 10px", borderRadius: "var(--radius-sm)", margin: 0 }}>
                  {submitError}
                </p>
              )}

              {/* Submit */}
              <button
                className="submit-btn"
                disabled={cart.length === 0 || !buyerName.trim() || submitting}
                onClick={handleSubmit}
              >
                {submitting ? "Mengirim…" : "Bestätigen / Konfirmasi"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Header ───────────────────────────────────────── */}
      <header style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", padding: "12px 24px", display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/logomasjid.png" alt="Masjid Indonesia Frankfurt" width={40} height={40} />
          <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
            Warung Masjid Indonesia Frankfurt
          </span>
        </div>
      </header>

      {/* ── Search bar ───────────────────────────────────── */}
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
          <p style={{ marginTop: 8, fontSize: "0.82rem", color: "#ef4444" }}>{error}</p>
        )}
        {searched && !loading && query && (
          <p style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--text-muted)" }}>
            {results.length === 0 ? "No products matched." : `${results.length} result${results.length !== 1 ? "s" : ""} for "${query}"`}
          </p>
        )}
      </div>

      {/* ── Product grid ─────────────────────────────────── */}
      <div style={{ padding: "0 16px 48px", flex: 1, maxWidth: 960, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <div className="product-grid">
          {gridProducts.map(p => (
            <div
              key={p.id}
              className="product-card"
              draggable={p.stock > 0}
              onDragStart={p.stock > 0 ? (e) => {
                e.dataTransfer.setData("productId", String(p.id));
                e.dataTransfer.setData("productName", p.name);
                e.dataTransfer.setData("priceCents", String(p.priceCents));
              } : undefined}
            >
              <div className="name"><Highlight text={p.name} query={query} /></div>
              <div className="price">€{formatEUR(p.priceCents)}</div>
              <span className={`stock-badge ${stockClass(p.stock)}`}>
                {stockLabel(p.stock)}
              </span>
              {p.stock === 0 ? (
                <button className="tambah-btn" disabled>Habis / Ausverkauft</button>
              ) : (
                <button className="tambah-btn" onClick={() => addToCart(p)}>+ Tambah</button>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
