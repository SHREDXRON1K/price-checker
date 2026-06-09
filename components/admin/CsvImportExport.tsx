"use client";

import { useRef, useState } from "react";

type Props = {
  onImported: () => void;
  onMessage: (msg: string) => void;
};

export default function CsvImportExport({ onImported, onMessage }: Props) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onMessage("");
    if (!selectedFile) { onMessage("Please choose a CSV file first."); return; }

    try {
      setUploading(true);
      const csvText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsText(selectedFile, "utf-8");
      });

      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        credentials: "include",
        body: csvText,
      });

      let data: { error?: string; imported?: number } = {};
      try { data = await res.json(); } catch { /* ignore */ }

      if (!res.ok) { onMessage(data.error || "Upload failed"); return; }
      onMessage(`✓ Imported ${data.imported ?? "?"} products successfully.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onImported();
    } catch (err) {
      console.error(err);
      onMessage("Upload failed — could not read file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">📂 Import / Export CSV</div>
      <form onSubmit={handleUpload}>
        <div
          className={`file-drop-area ${selectedFile ? "has-file" : ""}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="file-icon">{selectedFile ? "📄" : "📂"}</span>
          <div className="file-info">
            {selectedFile ? (
              <>
                <div className="file-info-name">{selectedFile.name}</div>
                <div className="file-info-sub">{(selectedFile.size / 1024).toFixed(1)} KB · Click to change</div>
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
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              title="Remove file"
            >✕</button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="file-hidden"
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
        />

        <div className="csv-actions">
          <button type="submit" className="btn btn-primary" disabled={uploading || !selectedFile}>
            {uploading ? "Importing…" : "⬆ Import CSV"}
          </button>
          <a href="/api/admin/export" className="btn-link">⬇ Export CSV</a>
        </div>
        <div className="csv-hint">Format: barcode,name,price,stock — first row must be headers</div>
      </form>
    </div>
  );
}
