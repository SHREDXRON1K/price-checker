export type Product = {
  id: number;
  barcode: string;
  name: string;
  priceCents: number;
  stock: number;
  updatedAt: string;
};

export type LookupResult =
  | { found: false }
  | { found: true; name: string; priceEUR: string; updatedAt: string };
