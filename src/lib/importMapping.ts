// Определение соответствия колонок файла нужным полям (товар/количество/
// цена/дата) по списку известных синонимов. Никогда не импортируется без
// подтверждения пользователем — это только ПРЕДЛОЖЕНИЕ маппинга с confidence,
// которое пользователь видит и может поправить перед импортом (см.
// ProductImportModal.tsx).

export type MappableField = "product" | "quantity" | "price" | "date";

export const FIELD_LABELS: Record<MappableField, string> = {
  product: "Название товара",
  quantity: "Продажи (количество)",
  price: "Цена",
  date: "Дата",
};

const ALIASES: Record<MappableField, string[]> = {
  product: ["товар", "название", "продукт", "наименование", "item", "product", "product_name", "sku_name", "name"],
  quantity: ["количество", "кол-во", "qty", "quantity", "продажи", "sold", "sold_qty", "units"],
  price: ["цена", "price", "сумма", "revenue", "amount", "total", "стоимость"],
  date: ["дата", "date", "created_at", "sold_at", "день", "day"],
};

export interface ColumnMappingSuggestion {
  column: string;
  field: MappableField | null;
  confidence: number; // 0..1
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[_\s-]+/g, "_");
}

function matchScore(column: string, field: MappableField): number {
  const normalizedColumn = normalize(column);
  const aliases = ALIASES[field];

  for (let i = 0; i < aliases.length; i++) {
    if (normalize(aliases[i]) === normalizedColumn) {
      // Более ранние алиасы в списке — "канонические", чуть выше уверенность.
      return 0.99 - i * 0.01;
    }
  }
  for (const alias of aliases) {
    const normalizedAlias = normalize(alias);
    if (normalizedColumn.includes(normalizedAlias) || normalizedAlias.includes(normalizedColumn)) {
      return 0.65;
    }
  }
  return 0;
}

/**
 * Возвращает по одному предложению на каждую колонку файла. Разрешение
 * конфликтов (несколько колонок похожи на одно поле) — жадное по убыванию
 * confidence, каждое поле назначается не более чем одной колонке.
 */
export function suggestColumnMapping(columns: string[]): ColumnMappingSuggestion[] {
  const fields: MappableField[] = ["product", "quantity", "price", "date"];

  const candidates: { column: string; field: MappableField; score: number }[] = [];
  for (const column of columns) {
    for (const field of fields) {
      const score = matchScore(column, field);
      if (score > 0) candidates.push({ column, field, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const assignedField = new Set<MappableField>();
  const assignedColumn = new Map<string, MappableField>();
  for (const c of candidates) {
    if (assignedField.has(c.field) || assignedColumn.has(c.column)) continue;
    assignedField.add(c.field);
    assignedColumn.set(c.column, c.field);
  }

  return columns.map((column) => ({
    column,
    field: assignedColumn.get(column) ?? null,
    confidence: assignedColumn.has(column) ? candidates.find((c) => c.column === column && c.field === assignedColumn.get(column))!.score : 0,
  }));
}
