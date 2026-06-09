import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCSV } from "@/lib/csv";

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
