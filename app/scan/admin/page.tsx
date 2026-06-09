"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";
import type { LookupResult } from "@/lib/types";

type CameraOption = { deviceId: string; label: string };

export default function ScanDebugPage() {
  const scannerRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const lastScanRef = useRef<number>(0);
  const detectedHandlerRef = useRef<((data: any) => void) | null>(null);

  const [status, setStatus] = useState<"idle" | "scanning" | "error">("idle");
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [message, setMessage] = useState("");
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [debugInfo, setDebugInfo] = useState("");

  async function lookup(code: string) {
    setMessage("Looking up...");
    setResult(null);
    try {
      const res = await fetch(`/api/price?barcode=${encodeURIComponent(code)}`);
      const data = (await res.json()) as LookupResult;
      setResult(data);
      setMessage("");
    } catch (error) {
      console.error(error);
      setMessage("Network error.");
    }
  }

  function cleanupScanner() {
    try {
      if (detectedHandlerRef.current) {
        Quagga.offDetected(detectedHandlerRef.current);
        detectedHandlerRef.current = null;
      }
      Quagga.stop();
    } catch {}
    initializedRef.current = false;
  }

  async function loadCameras() {
    try {
      setMessage("Requesting camera permission...");
      setDebugInfo("");
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tempStream.getTracks().forEach((track) => track.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mapped: CameraOption[] = devices
        .filter((d) => d.kind === "videoinput")
        .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Camera ${index + 1}` }));
      setCameras(mapped);
      setDebugInfo(
        mapped.length > 0
          ? `Detected ${mapped.length} camera(s):\n${mapped.map((c, i) => `${i + 1}. ${c.label} (${c.deviceId.slice(0, 8)}...)`).join("\n")}`
          : "No videoinput devices returned by browser."
      );
      const saved = localStorage.getItem("preferred_camera_id");
      const savedExists = mapped.some((c) => c.deviceId === saved);
      setSelectedCameraId(saved && savedExists ? saved : mapped[0]?.deviceId ?? "");
      setMessage(mapped.length > 0 ? "Cameras loaded." : "No camera found.");
    } catch (error) {
      console.error(error);
      setMessage("Camera permission failed or browser blocked device list.");
      setDebugInfo(String(error));
    }
  }

  async function startScanning(cameraId?: string) {
    if (!scannerRef.current || initializedRef.current) return;
    const deviceId = cameraId || selectedCameraId;
    if (!deviceId) { setMessage("Please load cameras and choose one first."); return; }

    setMessage("Starting camera...");
    setResult(null);

    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: scannerRef.current,
          constraints: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
          area: { top: "28%", right: "12%", left: "12%", bottom: "28%" },
        },
        locator: { patchSize: "medium", halfSample: true },
        numOfWorkers: typeof navigator !== "undefined" ? Math.max(1, Math.floor((navigator.hardwareConcurrency || 2) / 2)) : 1,
        frequency: 10,
        decoder: { readers: ["ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader", "code_128_reader"] },
        locate: true,
      },
      (err) => {
        if (err) {
          console.error(err);
          setStatus("error");
          setMessage("Failed to start selected camera.");
          setDebugInfo(String(err));
          return;
        }
        initializedRef.current = true;
        setStatus("scanning");
        setMessage("Scanning...");
        Quagga.start();
        const handler = (data: any) => {
          const now = Date.now();
          const code = data?.codeResult?.code;
          if (!code || now - lastScanRef.current < 1500) return;
          lastScanRef.current = now;
          setBarcode(code);
          navigator.vibrate?.(80);
          lookup(code);
        };
        detectedHandlerRef.current = handler;
        Quagga.onDetected(handler);
      }
    );
  }

  function stopScanning() {
    cleanupScanner();
    setStatus("idle");
    setMessage("Stopped.");
  }

  async function handleCameraChange(newCameraId: string) {
    setSelectedCameraId(newCameraId);
    localStorage.setItem("preferred_camera_id", newCameraId);
    if (status === "scanning") {
      cleanupScanner();
      setStatus("idle");
      setTimeout(() => startScanning(newCameraId), 200);
    }
  }

  useEffect(() => {
    loadCameras();
    return () => { cleanupScanner(); };
  }, []);

  const selectedCameraLabel = useMemo(
    () => cameras.find((c) => c.deviceId === selectedCameraId)?.label || "",
    [cameras, selectedCameraId]
  );

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto", color: "#000" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Price Checker</h1>
      <p style={{ marginTop: 8 }}>Scan a barcode to see the price.</p>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={loadCameras} style={btn}>Load Cameras</button>
        {status !== "scanning" ? (
          <button onClick={() => startScanning()} style={btn} disabled={!selectedCameraId}>Start</button>
        ) : (
          <button onClick={stopScanning} style={btn}>Stop</button>
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Choose Camera</label>
        <select value={selectedCameraId} onChange={(e) => handleCameraChange(e.target.value)} style={selectStyle}>
          <option value="">Select a camera</option>
          {cameras.map((camera) => (
            <option key={camera.deviceId} value={camera.deviceId}>{camera.label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>Camera count: {cameras.length}</div>
      {selectedCameraLabel && (
        <p style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>Current camera: {selectedCameraLabel}</p>
      )}

      <div style={{ marginTop: 12, padding: 10, border: "1px solid #ccc", borderRadius: 8, background: "#f7f7f7", whiteSpace: "pre-wrap", fontSize: 12 }}>
        {debugInfo || "No debug info yet."}
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 260, height: 180, borderRadius: 12, overflow: "hidden", background: "#111" }}>
          <div ref={scannerRef} style={{ width: "100%", height: "100%" }} />
          <div style={{ position: "absolute", top: "35%", left: "10%", width: "80%", height: "25%", border: "3px solid #00ff88", borderRadius: 6, pointerEvents: "none" }} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label style={labelStyle}>Manual barcode</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="e.g. 4001234567890" style={inputStyle} />
          <button onClick={() => barcode.trim() && lookup(barcode.trim())} style={btn}>Check</button>
        </div>
      </div>

      <p style={{ marginTop: 12 }}>{message || "Try switching camera if the view looks too wide."}</p>

      {result && (
        <div style={resultBox}>
          {result.found ? (
            <>
              <div style={{ fontWeight: 700 }}>{result.name}</div>
              <div style={{ fontSize: 26 }}>€{result.priceEUR}</div>
              <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
                Last updated: {new Date(result.updatedAt).toLocaleString()}
              </div>
            </>
          ) : (
            <div>Not found. Please ask staff.</div>
          )}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", marginBottom: 6, fontWeight: 600 };
const selectStyle: React.CSSProperties = { width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 6, background: "#fff", color: "#000" };
const inputStyle: React.CSSProperties = { flex: 1, padding: 10, border: "1px solid #ccc", borderRadius: 6, color: "#000", background: "#fff" };
const btn: React.CSSProperties = { padding: "10px 14px", background: "#000", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
const resultBox: React.CSSProperties = { marginTop: 16, padding: 14, border: "1px solid #ccc", borderRadius: 12, background: "#fff", color: "#000" };
