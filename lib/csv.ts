type CsvRow = {
  barcode: string;
  name: string;
  priceCents: number;
  stock: number;
};

export function parseCSV(text: string): CsvRow[] {
  const lines = text
    .trim()
    .split("\n")
    .map((line) => line.replace(/\r/g, ""))
    .filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    throw new Error(`CSV must have at least 2 lines. Got ${lines.length}: ${JSON.stringify(lines)}`);
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const required = ["barcode", "name", "price", "stock"];
  for (const col of required) {
    if (!headers.includes(col)) throw new Error(`Missing column: ${col}`);
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = values[j] ?? ""; });

    const { name, barcode } = row;
    const price = parseFloat(row.price);
    const stock = parseInt(row.stock, 10);

    if (!name) continue;
    if (isNaN(price) || price < 0) continue;
    if (isNaN(stock) || stock < 0) continue;

    rows.push({ barcode: barcode ?? "", name, priceCents: Math.round(price * 100), stock });
  }

  if (rows.length === 0) throw new Error("No valid rows found in CSV.");
  return rows;
}
