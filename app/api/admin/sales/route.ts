import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, Number(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "20")));
  const skip = (page - 1) * limit;

  const where = buildWhere(searchParams);

  try {
    const [sales, total, allForRevenue] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        select: { priceAtSale: true, quantity: true },
      }),
    ]);

    const revenueTotal = allForRevenue.reduce(
      (sum, s) => sum + s.priceAtSale * s.quantity,
      0
    );

    return NextResponse.json({
      sales: sales.map((s) => ({
        id: s.id,
        productName: s.product.name,
        quantity: s.quantity,
        priceAtSale: s.priceAtSale,
        paymentMethod: s.paymentMethod,
        buyerName: s.buyerName,
        createdAt: s.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      revenueTotal,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to load sales" }, { status: 500 });
  }
}
