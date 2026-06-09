import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function escapeCSV(value: string | number) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: "asc" },
    });

    const header = ["barcode", "name", "price", "stock"];
    const rows = products.map((product) => [
      escapeCSV(product.barcode),
      escapeCSV(product.name),
      escapeCSV((product.priceCents / 100).toFixed(2)),
      escapeCSV(product.stock),
    ]);

    const csv = [
      header.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="products.csv"',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to export products." },
      { status: 500 }
    );
  }
}
