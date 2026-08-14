// Определение соответствия колонок файла нужным полям по списку известных
// синонимов. Никогда не импортируется без подтверждения пользователем — это
// только ПРЕДЛОЖЕНИЕ маппинга с confidence, которое пользователь видит и
// может поправить перед импортом (см. ProductImportModal.tsx).
//
// unit_price и revenue — намеренно РАЗНЫЕ поля (не один "price"): цена за
// единицу товара и готовая сумма продажи — это разные вещи, и раньше их
// смешение в одном списке алиасов приводило к тому, что колонка с уже
// посчитанной выручкой могла быть по ошибке домножена на количество ещё раз.
// По той же причине purchase_price/selling_price отделены от unit_price
// продажи — закупочная цена, цена продажи и фактическая цена в конкретной
// строке продажи могут отличаться, и путать их нельзя.

export type MappableField =
  | "product"
  | "quantity"
  | "unit_price"
  | "revenue"
  | "date"
  | "customers"
  | "stock"
  | "stock_in"
  | "stock_out"
  | "supplier_name"
  | "sku"
  | "category"
  | "min_stock"
  | "purchase_price"
  | "selling_price"
  | "supplier_phone"
  | "supplier_website"
  | "supplier_address"
  | "unit";

export const FIELD_LABELS: Record<MappableField, string> = {
  product: "Название товара",
  quantity: "Количество (продажи)",
  unit_price: "Цена за единицу",
  revenue: "Выручка (готовая сумма)",
  date: "Дата",
  customers: "Количество клиентов",
  stock: "Текущий остаток",
  stock_in: "Приход (складское движение)",
  stock_out: "Расход (складское движение)",
  supplier_name: "Поставщик",
  sku: "SKU / артикул",
  category: "Категория",
  min_stock: "Минимальный остаток",
  purchase_price: "Закупочная цена",
  selling_price: "Цена продажи",
  supplier_phone: "Телефон поставщика",
  supplier_website: "Сайт поставщика",
  supplier_address: "Адрес поставщика",
  unit: "Единица измерения",
};

const ALIASES: Record<MappableField, string[]> = {
  product: ["товар", "название", "продукт", "наименование", "item", "product", "product_name", "sku_name", "name", "услуга", "блюдо", "номенклатура"],
  quantity: ["количество", "кол-во", "qty", "quantity", "продажи", "sold", "sold_qty", "units", "штук", "продано"],
  unit_price: ["цена", "price", "цена за единицу", "unit_price", "unit price", "стоимость единицы"],
  revenue: ["выручка", "revenue", "сумма", "amount", "total", "итог", "total_amount", "стоимость"],
  date: ["дата", "date", "created_at", "sold_at", "день", "day", "дата продажи"],
  customers: ["клиенты", "customers", "clients", "посетители", "visitors"],
  stock: ["остаток", "stock", "склад", "остаток на складе", "quantity_in_stock", "current_stock"],
  stock_in: ["приход", "поступление", "stock_in", "incoming", "receipt"],
  stock_out: ["расход", "списание", "stock_out", "outgoing", "issue"],
  supplier_name: ["поставщик", "supplier", "supplier_name", "vendor"],
  sku: ["sku", "артикул", "код товара", "product_code"],
  category: ["категория", "category", "группа", "group"],
  min_stock: ["минимальный остаток", "мин. остаток", "min_stock", "minimum_stock", "точка заказа", "reorder_point"],
  purchase_price: ["закупочная цена", "закуп", "цена закупки", "purchase_price", "cost_price", "cost"],
  selling_price: ["цена продажи", "продажная цена", "розничная цена", "selling_price", "retail_price"],
  supplier_phone: ["телефон", "phone", "телефон поставщика", "supplier_phone"],
  supplier_website: ["сайт", "website", "сайт поставщика", "supplier_website", "url"],
  supplier_address: ["адрес", "address", "адрес поставщика", "supplier_address"],
  unit: ["единица", "ед. изм.", "unit", "uom", "измерение"],
};

// Порядок важен: более специфичные поля (purchase_price/selling_price)
// должны получать шанс на точное совпадение раньше общих (unit_price),
// иначе жадный алгоритм ниже всё равно разрешит это по score, но порядок
// перечисления влияет только на порядок кандидатов при равном score.
const ALL_FIELDS: MappableField[] = [
  "product",
  "sku",
  "category",
  "quantity",
  "unit_price",
  "purchase_price",
  "selling_price",
  "revenue",
  "date",
  "customers",
  "stock",
  "stock_in",
  "stock_out",
  "min_stock",
  "supplier_name",
  "supplier_phone",
  "supplier_website",
  "supplier_address",
  "unit",
];

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
  const candidates: { column: string; field: MappableField; score: number }[] = [];
  for (const column of columns) {
    for (const field of ALL_FIELDS) {
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
