import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SearchRow = {
  id: number;
  barcode: string;
  name: string;
  priceCents: number;
  stock: number;
  updatedAt: Date;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const limitParam = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    if (!q) return NextResponse.json([]);

    const tokens = q
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);

    if (tokens.length === 0) return NextResponse.json([]);

    const allAND = tokens
      .map((t) => Prisma.sql`name LIKE ${`%${t}%`} COLLATE NOCASE`)
      .reduce((acc, cur) => Prisma.sql`${acc} AND ${cur}`);

    const anyOR = tokens
      .map((t) => Prisma.sql`name LIKE ${`%${t}%`} COLLATE NOCASE`)
      .reduce((acc, cur) => Prisma.sql`${acc} OR ${cur}`);

    const startsOR = tokens
      .map((t) => Prisma.sql`name LIKE ${`${t}%`} COLLATE NOCASE`)
      .reduce((acc, cur) => Prisma.sql`${acc} OR ${cur}`);

    const products = await prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      SELECT
        id,
        barcode,
        name,
        priceCents,
        stock,
        updatedAt
      FROM Product
      WHERE
        barcode LIKE ${`%${q}%`} COLLATE NOCASE
        OR (${allAND})
        OR (${anyOR})
      ORDER BY
        CASE
          WHEN barcode = ${q} COLLATE NOCASE             THEN 0
          WHEN name    = ${q} COLLATE NOCASE             THEN 1
          WHEN name LIKE ${`${q}%`} COLLATE NOCASE       THEN 2
          WHEN (${startsOR})                             THEN 3
          WHEN (${allAND})                               THEN 4
          WHEN barcode LIKE ${`%${q}%`} COLLATE NOCASE   THEN 5
          ELSE                                               6
        END,
        LENGTH(name) ASC,
        updatedAt DESC
      LIMIT ${Prisma.raw(String(limitParam))}
    `);

    return NextResponse.json(products);
  } catch (error) {
    console.error("[/api/search] error:", error);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
