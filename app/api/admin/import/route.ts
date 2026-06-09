import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseCSV(text: string) {
  const lines = text
    .trim()
    .split("\n")
    .map((line) => line.replace(/\r/g, ""))
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    throw new Error(`CSV must have at least 2 lines. Got ${lines.length}: ${JSON.stringify(lines)}`);
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const required = ["barcode", "name", "price", "stock"];
  for (const col of required) {
    if (!headers.includes(col)) {
      throw new Error(`Missing column: ${col}`);
    }
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = values[j] ?? ""; });

    const name = row.name;
    const barcode = row.barcode;
    const price = parseFloat(row.price);
    const stock = parseInt(row.stock, 10);

    if (!name) continue;
    if (isNaN(price) || price < 0) continue;
    if (isNaN(stock) || stock < 0) continue;

    rows.push({
      barcode: barcode ?? "",
      name,
      priceCents: Math.round(price * 100),
      stock,
    });
  }

  if (rows.length === 0) {
    throw new Error("No valid rows found in CSV.");
  }

  return rows;
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

      // Split into parts
      const parts = raw.split("--" + boundary);

      for (const part of parts) {
        // Find the file part — has Content-Disposition with filename
        if (!part.includes("Content-Disposition")) continue;

        // Split on double newline to separate headers from body
        // Support both \r\n\r\n and \n\n
        const splitOn = part.includes("\r\n\r\n") ? "\r\n\r\n" : "\n\n";
        const idx = part.indexOf(splitOn);
        if (idx === -1) continue;

        let content = part.slice(idx + splitOn.length);

        // Remove trailing boundary marker
        if (content.endsWith("\r\n")) content = content.slice(0, -2);
        if (content.endsWith("--")) content = content.slice(0, -2);

        csvText = content.trim();
        if (csvText) break;
      }

      if (!csvText) {
        // Debug: return what we actually received
        return NextResponse.json({
          error: "Could not extract CSV from upload",
          debug: {
            contentType,
            rawLength: raw.length,
            rawPreview: raw.slice(0, 500),
          }
        }, { status: 400 });
      }

    } else {
      // Plain text body
      csvText = raw.trim();
    }

    if (!csvText) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    const rows = parseCSV(csvText);

    for (const row of rows) {
      if (row.barcode) {
        await prisma.product.upsert({
          where: { barcode: row.barcode },
          update: { name: row.name, priceCents: row.priceCents, stock: row.stock },
          create: { barcode: row.barcode, name: row.name, priceCents: row.priceCents, stock: row.stock },
        });
      } else {
        await prisma.product.create({
          data: { barcode: "", name: row.name, priceCents: row.priceCents, stock: row.stock },
        });
      }
    }

    return NextResponse.json({ success: true, imported: rows.length });

  } catch (error) {
    console.error("[/api/admin/import]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 400 }
    );
  }
}