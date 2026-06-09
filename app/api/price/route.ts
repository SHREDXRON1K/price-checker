import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get("barcode")?.trim();

  if (!barcode) {
    return NextResponse.json({ error: "Missing barcode" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { barcode },
    select: { name: true, priceCents: true, updatedAt: true },
  });

  if (!product) return NextResponse.json({ found: false });

  return NextResponse.json({
    found: true,
    barcode,
    name: product.name,
    priceEUR: (product.priceCents / 100).toFixed(2),
    updatedAt: product.updatedAt,
  });
}
