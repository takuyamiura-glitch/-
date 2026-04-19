export const SMAREGI_HEADERS = [
  "商品ID",
  "部門ID",
  "商品コード",
  "商品名",
  "商品単価",
  "原価",
  "税区分",
  "税設定",
  "部門の税設定を使用",
] as const;

export type SmaregiRow = {
  商品ID: string;
  部門ID: string;
  商品コード: string;
  商品名: string;
  商品単価: string;
  原価: string;
  税区分: string;
  税設定: string;
  部門の税設定を使用: string;
};

export type ParsedProduct = {
  name: string;
  price: number;
};

function detectDelimiter(line: string): string {
  if (line.includes("\t")) return "\t";
  if (line.includes(",")) return ",";
  return " ";
}

function extractNameAndPrice(parts: string[]): ParsedProduct | null {
  if (parts.length < 2) return null;

  // Try to find a numeric price among the parts
  for (let i = parts.length - 1; i >= 0; i--) {
    const cleaned = parts[i].replace(/[¥,￥\s円]/g, "").trim();
    const price = Number(cleaned);
    if (!isNaN(price) && price >= 0) {
      const nameParts = parts.slice(0, i).concat(parts.slice(i + 1));
      const name = nameParts.join(" ").trim();
      if (name) return { name, price };
    }
  }

  // Fallback: last part as price, rest as name
  const lastPart = parts[parts.length - 1].replace(/[¥,￥\s円]/g, "").trim();
  const price = Number(lastPart);
  if (!isNaN(price)) {
    const name = parts.slice(0, -1).join(" ").trim();
    return name ? { name, price } : null;
  }

  return null;
}

export function parseProductText(text: string): ParsedProduct[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const products: ParsedProduct[] = [];

  for (const line of lines) {
    const delimiter = detectDelimiter(line);
    const parts = line
      .split(delimiter)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const product = extractNameAndPrice(parts);
    if (product) {
      products.push(product);
    }
  }

  return products;
}

export function toSmaregiRows(
  products: ParsedProduct[],
  departmentId = "10"
): SmaregiRow[] {
  // Use a base timestamp so codes within one conversion are sequential
  const baseMs = Date.now();

  return products.map((p, i) => ({
    商品ID: "",
    部門ID: departmentId,
    商品コード: `S_${baseMs + i}`,
    商品名: p.name,
    商品単価: String(p.price),
    原価: "0",
    税区分: "1",
    税設定: "1",
    部門の税設定を使用: "1",
  }));
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsvString(rows: SmaregiRow[]): string {
  const header = SMAREGI_HEADERS.join(",");
  const dataRows = rows.map((row) =>
    SMAREGI_HEADERS.map((h) => escapeCsvField(row[h])).join(",")
  );
  return [header, ...dataRows].join("\r\n");
}

export function convertTextToCsv(
  text: string,
  departmentId = "10"
): { csv: string; rows: SmaregiRow[]; products: ParsedProduct[] } {
  const products = parseProductText(text);
  const rows = toSmaregiRows(products, departmentId);
  const csv = buildCsvString(rows);
  return { csv, rows, products };
}
