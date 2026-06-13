import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CHUNK_SIZE = 10;
const CHUNK_DELAY_MS = 200;

type ProductRow = {
  barcode: string | null;
  name: string;
  priceCents: number;
  stock: number;
};

function parseRows(csvText: string): ProductRow[] {
  const lines = csvText
    .trim()
    .split("\n")
    .map((l) => l.replace(/\r/g, "").trim())
    .filter(Boolean);

  if (lines.length < 2) throw new Error(`CSV must have at least 2 lines. Got ${lines.length}.`);

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  for (const col of ["barcode", "name", "price", "stock"]) {
    if (!headers.includes(col)) throw new Error(`Missing column: ${col}`);
  }

  const rows: ProductRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const get = (col: string) => values[headers.indexOf(col)] ?? "";

    const name = get("name");
    if (!name) continue;

    const priceCents = parseInt(String(Math.round(parseFloat(get("price")) * 100)), 10);
    const stock = parseInt(get("stock"), 10);
    if (isNaN(priceCents) || priceCents < 0) continue;
    if (isNaN(stock) || stock < 0) continue;

    const rawBarcode = get("barcode");
    rows.push({ barcode: rawBarcode || null, name, priceCents, stock });
  }

  if (rows.length === 0) throw new Error("No valid rows found in CSV.");
  return rows;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    const body = await req.arrayBuffer();
    const raw = Buffer.from(body).toString("utf-8");

    let csvText = "";

    if (contentType.includes("multipart/form-data")) {
      const boundary = contentType.split("boundary=")[1]?.trim();
      if (!boundary) {
        return NextResponse.json({ error: "Invalid multipart request" }, { status: 400 });
      }
      const parts = raw.split("--" + boundary);
      for (const part of parts) {
        if (!part.includes("Content-Disposition")) continue;
        const splitOn = part.includes("\r\n\r\n") ? "\r\n\r\n" : "\n\n";
        const idx = part.indexOf(splitOn);
        if (idx === -1) continue;
        let content = part.slice(idx + splitOn.length);
        if (content.endsWith("\r\n")) content = content.slice(0, -2);
        if (content.endsWith("--")) content = content.slice(0, -2);
        csvText = content.trim();
        if (csvText) break;
      }
      if (!csvText) {
        return NextResponse.json({
          error: "Could not extract CSV from upload",
          debug: { contentType, rawLength: raw.length, rawPreview: raw.slice(0, 500) },
        }, { status: 400 });
      }
    } else {
      csvText = raw.trim();
    }

    if (!csvText) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    const rows = parseRows(csvText);
    const chunks = chunk(rows, CHUNK_SIZE);
    let totalCreated = 0;
    const errors: { chunk: number; error: string }[] = [];

    for (let i = 0; i < chunks.length; i++) {
      try {
        const result = await prisma.product.createMany({
          data: chunks[i],
          skipDuplicates: true,
        });
        console.log(`[import] chunk ${i + 1}/${chunks.length}: ${result.count} created`);
        totalCreated += result.count;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[import] chunk ${i + 1}/${chunks.length}: FAIL`, msg);
        errors.push({ chunk: i + 1, error: msg });
      }

      if (i < chunks.length - 1) {
        await new Promise<void>((r) => setTimeout(r, CHUNK_DELAY_MS));
      }
    }

    return NextResponse.json({
      imported: totalCreated,
      skipped: rows.length - totalCreated,
      errors,
    });
  } catch (error) {
    console.error("[/api/admin/import]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 400 }
    );
  }
}
