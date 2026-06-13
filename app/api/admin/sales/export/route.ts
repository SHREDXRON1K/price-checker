import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatEUR } from "@/lib/format";

function buildWhere(params: URLSearchParams) {
  const from = params.get("from");
  const to = params.get("to");
  const paymentMethod = params.get("paymentMethod");
  const buyerName = params.get("buyerName");

  const where: {
    createdAt?: { gte?: Date; lt?: Date };
    paymentMethod?: string;
    buyerName?: { contains: string; mode: "insensitive" };
  } = {};

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setUTCDate(end.getUTCDate() + 1);
      where.createdAt.lt = end;
    }
  }

  if (paymentMethod && ["bar", "paypal", "iban"].includes(paymentMethod)) {
    where.paymentMethod = paymentMethod;
  }

  if (buyerName?.trim()) {
    where.buyerName = { contains: buyerName.trim(), mode: "insensitive" };
  }

  return where;
}

function csvRow(cells: string[]): string {
  return cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(",");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const where = buildWhere(searchParams);

  try {
    const sales = await prisma.sale.findMany({
      where,
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    const lines = [
      csvRow(["Tanggal", "Nama", "Barang", "Qty", "Harga", "Pembayaran"]),
      ...sales.map((s) =>
        csvRow([
          new Date(s.createdAt).toLocaleDateString("de-DE"),
          s.buyerName,
          s.product.name,
          String(s.quantity),
          `€${formatEUR(s.priceAtSale * s.quantity)}`,
          s.paymentMethod,
        ])
      ),
    ];

    const filename = `sales-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to export" }, { status: 500 });
  }
}
