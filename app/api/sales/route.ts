import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

const ipRequests = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequests.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipRequests.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count++;
  return false;
}

interface SaleItem {
  productId: number;
  quantity: number;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
  }

  let body: { items?: SaleItem[]; buyerName?: string; paymentMethod?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { items, buyerName, paymentMethod } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
  }

  if (!buyerName || !String(buyerName).trim()) {
    return NextResponse.json({ error: "buyerName is required" }, { status: 400 });
  }

  if (!["bar", "paypal", "iban"].includes(String(paymentMethod))) {
    return NextResponse.json(
      { error: "paymentMethod must be bar, paypal, or iban" },
      { status: 400 }
    );
  }

  try {
    const saleIds = await prisma.$transaction(async (tx) => {
      const ids: number[] = [];

      for (const item of items) {
        const productId = Number(item.productId);
        const quantity = Number(item.quantity);

        if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) {
          throw Object.assign(new Error("invalid_item"), { status: 400, clientError: "invalid item data" });
        }

        const product = await tx.product.findUnique({ where: { id: productId } });

        if (!product) {
          throw Object.assign(new Error("not_found"), {
            status: 400,
            clientError: `product not found: ${productId}`,
          });
        }

        if (product.stock - quantity < 0) {
          throw Object.assign(new Error("insufficient_stock"), {
            status: 400,
            clientError: "insufficient_stock",
            productName: product.name,
          });
        }

        const sale = await tx.sale.create({
          data: {
            productId,
            quantity,
            priceAtSale: product.priceCents,
            paymentMethod: String(paymentMethod),
            buyerName: String(buyerName).trim(),
          },
        });

        await tx.product.update({
          where: { id: productId },
          data: { stock: { decrement: quantity } },
        });

        ids.push(sale.id);
      }

      return ids;
    });

    return NextResponse.json({ success: true, saleIds });
  } catch (err) {
    const e = err as { status?: number; clientError?: string; productName?: string };

    if (e.status === 400 && e.clientError === "insufficient_stock") {
      return NextResponse.json(
        { success: false, error: "insufficient_stock", product: e.productName },
        { status: 400 }
      );
    }

    if (e.status === 400) {
      return NextResponse.json({ success: false, error: e.clientError }, { status: 400 });
    }

    console.error(err);
    return NextResponse.json({ success: false, error: "internal_error" }, { status: 500 });
  }
}
