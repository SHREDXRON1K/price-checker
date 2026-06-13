import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  { barcode: "4001234567890", name: "Coca Cola 500ml", priceCents: 199, stock: 24, createdAt: new Date(1772792335687) },
  { barcode: "4012345678901", name: "Chips Paprika",   priceCents: 249, stock: 15, createdAt: new Date(1772792335697) },
  { barcode: "4012345678902", name: "Tic Tac",         priceCents: 150, stock: 10, createdAt: new Date(1775835841957) },
  { barcode: "0000000000000", name: "Tolak Angin",     priceCents: 99,  stock: 20, createdAt: new Date(1776287219143) },
];

async function main() {
  console.log("Seeding products into PostgreSQL...");

  const { count } = await prisma.product.createMany({
    data: products,
    skipDuplicates: true,
  });

  console.log(`Done — inserted ${count} of ${products.length} products (duplicates skipped).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
