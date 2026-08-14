// Определение соответствия колонок файла нужным полям по списку известных
// синонимов. Никогда не импортируется без подтверждения пользователем — это
// только ПРЕДЛОЖЕНИЕ маппинга с confidence, которое пользователь видит и
// может поправить перед импортом (см. ProductImportModal.tsx).
//
// unit_price и revenue — намеренно РАЗНЫЕ поля (не один "price"): цена за
// единицу товара и готовая сумма продажи — это разные вещи, и раньше их
// смешение в одном списке алиасов приводило к тому, что колонка с уже
// посчитанной выручкой могла быть по ошибке домножена на количество ещё раз.

export type MappableField = "product" | "quantity" | "unit_price" | "revenue" | "date" | "customers" | "stock" | "supplier_name";

export const FIELD_LABELS: Record<MappableField, string> = {
  product: "Название товара",
  quantity: "Количество (продажи)",
  unit_price: "Цена за единицу",
  revenue: "Выручка (готовая сумма)",
  date: "Дата",
  customers: "Количество клиентов",
  stock: "Остаток на складе",
  supplier_name: "Поставщик",
};

const ALIASES: Record<MappableField, string[]> = {
  product: ["товар", "название", "продукт", "наименование", "item", "product", "product_name", "sku_name", "name", "услуга", "блюдо"],
  quantity: ["количество", "кол-во", "qty", "quantity", "продажи", "sold", "sold_qty", "units", "штук", "продано"],
  unit_price: ["цена", "price", "цена за единицу", "unit_price", "unit price", "стоимость единицы"],
  revenue: ["выручка", "revenue", "сумма", "amount", "total", "итог", "total_amount", "стоимость"],
  date: ["дата", "date", "created_at", "sold_at", "день", "day", "дата продажи"],
  customers: ["клиенты", "customers", "clients", "посетители", "visitors"],
  stock: ["остаток", "stock", "склад", "остаток на складе", "quantity_in_stock"],
  supplier_name: ["поставщик", "supplier", "supplier_name", "vendor"],
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
  const fields: MappableField[] = [
    "product",
    "quantity",
    "unit_price",
    "revenue",
    "date",
    "customers",
    "stock",
    "supplier_name",
  ];

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
