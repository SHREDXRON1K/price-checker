import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function validateProduct(data: {
  barcode?: string;
  name?: string;
  price?: number;
  stock?: number;
}) {
  if (!data.barcode || !/^\d{8,14}$/.test(data.barcode)) {
    return "Barcode must be 8 to 14 digits.";
  }

  if (!data.name || !data.name.trim()) {
    return "Product name is required.";
  }

  if (typeof data.price !== "number" || Number.isNaN(data.price) || data.price < 0) {
    return "Price must be a valid positive number.";
  }

  if (!Number.isInteger(data.stock) || data.stock < 0) {
    return "Stock must be a valid non-negative integer.";
  }

  return null;
}

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const barcode = String(body.barcode ?? "").trim();
    const name = String(body.name ?? "").trim();
    const price = Number(body.price);
    const stock = Number(body.stock);

    const error = validateProduct({ barcode, name, price, stock });
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const existing = await prisma.product.findUnique({
      where: { barcode },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A product with this barcode already exists." },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        barcode,
        name,
        priceCents: Math.round(price * 100),
        stock,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create product." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    const id = Number(body.id);
    const barcode = String(body.barcode ?? "").trim();
    const name = String(body.name ?? "").trim();
    const price = Number(body.price);
    const stock = Number(body.stock);

    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });
    }

    const error = validateProduct({ barcode, name, price, stock });
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const existingWithBarcode = await prisma.product.findFirst({
      where: {
        barcode,
        NOT: { id },
      },
    });

    if (existingWithBarcode) {
      return NextResponse.json(
        { error: "Another product already uses this barcode." },
        { status: 400 }
      );
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        barcode,
        name,
        priceCents: Math.round(price * 100),
        stock,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update product." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid product ID." }, { status: 400 });
    }

    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete product." }, { status: 500 });
  }
}
