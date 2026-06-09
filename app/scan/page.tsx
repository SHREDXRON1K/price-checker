"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

type LookupResult =
  | { found: false }
  | { found: true; name: string; priceEUR: string; updatedAt: string };

export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const [status, setStatus] = useState<"idle" | "scanning" | "error">("idle");
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [message, setMessage] = useState<string>("");

  // Prevent API spam + repeated scans
  const lastScanRef = useRef<number>(0);
  const [loading, setLoading] = useState(false);

  async function lookup(code: string) {
    if (loading) return;

    setLoading(true);
    setMessage("Looking up...");
    setResult(null);

    try {
      const res = await fetch(`/api/price?barcode=${encodeURIComponent(code)}`);
      const data = (await res.json()) as LookupResult;
      setResult(data);
      setMessage("");
    } catch (e) {
      console.error(e);
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function startScanning() {
    setMessage("Starting camera...");
    setResult(null);

    try {
      setStatus("scanning");

      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      if (!videoRef.current) return;

      // Prefer rear camera on phones
      const constraints: MediaStreamConstraints = {
        video: { facingMode: "environment" },
        audio: false,
      };

      await reader.decodeFromConstraints(constraints, videoRef.current, (res, err) => {
        const now = Date.now();

        if (res) {
          const code = res.getText();

          // Cooldown: avoid reading the same barcode repeatedly
          if (now - lastScanRef.current < 1200) return;
          lastScanRef.current = now;

          // Feedback: vibrate + beep (beep needs /public/beep.mp3)
          navigator.vibrate?.(100);
          const beep = new Audio("/beep.mp3");
          beep.play().catch(() => {});

          setBarcode(code);
          lookup(code);
        }
      });

      setMessage("");
    } catch (e) {
      console.error(e);
      setStatus("error");
      setMessage("Camera error. Check permissions and try again.");
    }
  }

  function stopScanning() {
    readerRef.current?.reset();
    readerRef.current = null;
    setStatus("idle");
    setMessage("Stopped.");
  }

  useEffect(() => {
    return () => {
      readerRef.current?.reset();
    };
  }, []);

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Price Checker</h1>
      <p style={{ marginTop: 8 }}>Scan a barcode to see the price.</p>

      <div style={{ marginTop: 16 }}>
        <video
          ref={videoRef}
          style={{ width: "100%", borderRadius: 12, background: "#111" }}
          muted
          playsInline
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {status !== "scanning" ? (
          <button onClick={startScanning} style={{ padding: "10px 14px" }}>
            Start scanning
          </button>
        ) : (
          <button onClick={stopScanning} style={{ padding: "10px 14px" }}>
            Stop
          </button>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Manual barcode</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="e.g. 4001234567890"
            style={{ flex: 1, padding: 10 }}
          />
          <button
            onClick={() => barcode.trim() && lookup(barcode.trim())}
            style={{ padding: "10px 14px" }}
            disabled={loading}
          >
            {loading ? "..." : "Check"}
          </button>
        </div>
      </div>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}

      {result && (
        <div
          style={{
            marginTop: 16,
            padding: 20,
            border: "1px solid #ccc",
            borderRadius: 12,
            background: "#fafafa",
            color: "#000"
          }}
        >
          {"found" in result && result.found ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{result.name}</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>
                €{result.priceEUR}
              </div>
              <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
                Last updated: {new Date(result.updatedAt).toLocaleString()}
              </div>
            </>
          ) : (
            <div style={{ fontWeight: 700 }}>
              Product not found
              <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>
                Barcode: {barcode}
              </div>
              <div style={{ marginTop: 6, fontSize: 14, opacity: 0.7 }}>
                Please ask staff.
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
        Tip: Add a beep sound at <code>/public/beep.mp3</code> for audio feedback.
      </div>
    </div>
  );
}
