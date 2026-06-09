"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Product } from "@/lib/types";
import { formatEUR } from "@/lib/format";
import { useDebounce } from "@/lib/hooks";
import { StockBadge } from "@/components/StockBadge";

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-amber-100 text-amber-900 rounded-sm not-italic font-semibold px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
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

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debouncedInput = useDebounce(inputValue, 180);

  useEffect(() => {
    const q = debouncedInput.trim();
    if (q.length < 1) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSuggestions(data);
          setSuggestionsOpen(true);
          setActiveIndex(-1);
        } else {
          setSuggestions([]);
          setSuggestionsOpen(false);
        }
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
    } catch {
      setError("Network error. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen) {
      if (e.key === "Enter") runSearch(inputValue);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        const chosen = suggestions[activeIndex].name;
        setInputValue(chosen);
        setQuery(chosen);
        runSearch(chosen);
      } else {
        runSearch(inputValue);
      }
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
    setInputValue("");
    setQuery("");
    setResults([]);
    setSuggestions([]);
    setSuggestionsOpen(false);
    setSearched(false);
    setError("");
    inputRef.current?.focus();
  };

  const statusText = !searched
    ? "Type a product name, keyword, or barcode"
    : loading
    ? "Searching…"
    : error
    ? error
    : results.length === 0
    ? "No products matched your search"
    : `${results.length} product${results.length !== 1 ? "s" : ""} found`;

  return (
    <main className="min-h-screen bg-surface font-sans antialiased text-neutral-900">
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logomasjid.png" alt="Shop logo" className="h-8 w-auto object-contain" />
            <span className="font-bold text-sm tracking-tight text-neutral-800">Masjid Indonesia Frankfurt</span>
          </div>
          <span className="text-xs text-neutral-400 font-mono">v1.0</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 mb-1">
            Find any product <span className="text-neutral-400 font-light">instantly</span>
          </h1>
          <p className="text-sm text-neutral-500 mb-6">Search by name, keyword, or barcode number</p>

          <div className="relative">
            <div
              className={`flex items-center gap-2 bg-white border-2 transition-all duration-150 shadow-sm px-4 py-3
                ${suggestionsOpen
                  ? "border-neutral-800 rounded-t-2xl rounded-b-none shadow-lg"
                  : "border-neutral-200 rounded-2xl hover:border-neutral-300 focus-within:border-neutral-800 focus-within:shadow-md"
                }`}
            >
              <svg className="w-5 h-5 text-neutral-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>

              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
                placeholder="Try: cola, noodles, 4001234567890…"
                autoComplete="off"
                spellCheck={false}
                className="flex-1 bg-transparent text-base text-neutral-900 placeholder:text-neutral-400 outline-none min-w-0"
              />

              {loading && (
                <svg className="w-4 h-4 text-neutral-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              )}

              {inputValue && !loading && (
                <button
                  onClick={clearSearch}
                  className="shrink-0 w-6 h-6 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors"
                  aria-label="Clear search"
                >
                  <svg className="w-3 h-3 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}

              <button
                onClick={() => runSearch(inputValue)}
                className="shrink-0 bg-neutral-900 hover:bg-neutral-700 active:scale-95 text-white text-sm font-semibold px-4 py-1.5 rounded-xl transition-all"
              >
                Search
              </button>
            </div>

            {suggestionsOpen && suggestions.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute top-full left-0 right-0 bg-white border-2 border-t-0 border-neutral-800 rounded-b-2xl overflow-hidden shadow-xl z-30"
              >
                <ul role="listbox" className="py-1">
                  {suggestions.map((product, i) => (
                    <li
                      key={product.id}
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseDown={(e) => { e.preventDefault(); pickSuggestion(product); }}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer transition-colors
                        ${i === activeIndex ? "bg-neutral-50" : "hover:bg-neutral-50"}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <svg className="w-4 h-4 text-neutral-300 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                        </svg>
                        <span className="text-sm text-neutral-700 truncate">
                          <Highlight text={product.name} query={debouncedInput} />
                        </span>
                        {product.barcode && (
                          <span className="text-xs text-neutral-400 font-mono shrink-0">{product.barcode}</span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-neutral-900 shrink-0 font-mono">
                        €{formatEUR(product.priceCents)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-neutral-100 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs text-neutral-400">↑↓ navigate · Enter to select · Esc to close</span>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); runSearch(inputValue); }}
                    className="text-xs text-neutral-600 font-semibold hover:text-neutral-900 transition-colors"
                  >
                    See all results →
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className={`mt-3 text-sm transition-colors ${error ? "text-red-500" : "text-neutral-500"}`}>
            {statusText}
          </p>
        </div>

        <div className="space-y-3">
          {results.map((product, idx) => (
            <article
              key={product.id}
              className="group bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm hover:shadow-md hover:border-neutral-300 transition-all duration-150"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-neutral-900 leading-snug">
                    <Highlight text={product.name} query={query} />
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StockBadge stock={product.stock} />
                    <span className="text-xs text-neutral-400 font-mono">{product.barcode}</span>
                  </div>
                  {product.updatedAt && (
                    <p className="mt-2 text-xs text-neutral-400">
                      Updated {new Date(product.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] uppercase tracking-widest text-neutral-400 font-medium mb-0.5">Price</div>
                  <div className="text-3xl font-extrabold tracking-tight text-neutral-900 leading-none">
                    €{formatEUR(product.priceCents)}
                  </div>
                  {product.stock === 0 && (
                    <div className="text-xs text-red-400 mt-1">Unavailable</div>
                  )}
                </div>
              </div>
            </article>
          ))}

          {searched && !loading && !error && results.length === 0 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-neutral-600 font-medium">No products found</p>
              <p className="text-sm text-neutral-400 mt-1">Try a different name, keyword, or barcode</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
