import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeProductMetrics } from "@/lib/salesAnalytics";
import type { MappableField } from "@/lib/importMapping";
import type { InventoryItem, Sale, Supplier } from "@/types";

interface RequestBody {
  rows: Record<string, unknown>[];
  mapping: Record<string, MappableField | null>; // column -> field
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function parseDate(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function findColumn(mapping: Record<string, MappableField | null>, field: MappableField): string | undefined {
  return Object.entries(mapping).find(([, f]) => f === field)?.[0];
}

// Универсальный импорт: одна строка файла может одновременно нести данные
// о продаже (товар/количество/дата/цена), метаданные товара (SKU/категория/
// остаток/мин.остаток/закупочная и продажная цена) и поставщике
// (имя/телефон/сайт/адрес) — именно так выглядят реальные Excel малого
// бизнеса (см. Пример 3/4 в задании). Ничего не придумывается: то, чего нет
// в файле, остаётся null/"недостаточно данных", а не 0 или случайным
// значением.
//
// unit_price и revenue — разные поля: если в файле уже есть готовая сумма
// продажи (revenue), она используется как есть и НЕ умножается на
// количество ещё раз; если есть только цена за единицу — выручка
// считается как quantity × unit_price.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { data: business } = await supabase.from("businesses").select("id").eq("user_id", user.id).single();
  if (!business) {
    return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  }
  const businessId = business.id as string;

  const body = (await request.json()) as RequestBody;
  const { rows, mapping } = body;

  const productColumn = findColumn(mapping, "product");
  const quantityColumn = findColumn(mapping, "quantity");
  const dateColumn = findColumn(mapping, "date");
  const unitPriceColumn = findColumn(mapping, "unit_price");
  const revenueColumn = findColumn(mapping, "revenue");
  const stockColumn = findColumn(mapping, "stock");
  const stockInColumn = findColumn(mapping, "stock_in");
  const stockOutColumn = findColumn(mapping, "stock_out");
  const skuColumn = findColumn(mapping, "sku");
  const categoryColumn = findColumn(mapping, "category");
  const minStockColumn = findColumn(mapping, "min_stock");
  const purchasePriceColumn = findColumn(mapping, "purchase_price");
  const sellingPriceColumn = findColumn(mapping, "selling_price");
  const supplierNameColumn = findColumn(mapping, "supplier_name");
  const supplierPhoneColumn = findColumn(mapping, "supplier_phone");
  const supplierWebsiteColumn = findColumn(mapping, "supplier_website");
  const supplierAddressColumn = findColumn(mapping, "supplier_address");
  const unitColumn = findColumn(mapping, "unit");

  if (!productColumn || !quantityColumn || !dateColumn) {
    return NextResponse.json(
      { error: "Нужно указать колонки: товар, количество, дата" },
      { status: 422 }
    );
  }

  const [{ data: existingItems }, { data: existingSuppliers }] = await Promise.all([
    supabase.from("inventory_items").select("*").eq("business_id", businessId),
    supabase.from("suppliers").select("*").eq("business_id", businessId),
  ]);

  const itemsByName = new Map<string, InventoryItem>();
  for (const item of (existingItems as InventoryItem[]) ?? []) {
    itemsByName.set(item.name.trim().toLowerCase(), item);
  }
  const suppliersByName = new Map<string, Supplier>();
  for (const s of (existingSuppliers as Supplier[]) ?? []) {
    suppliersByName.set(s.name.trim().toLowerCase(), s);
  }

  const newSalesByProductId = new Map<
    string,
    { quantity: number; unit_price: number | null; total_amount: number | null; sold_at: string }[]
  >();
  // Абсолютный остаток (последнее встреченное значение в файле побеждает)
  // и суммарное движение (приход-расход), которое честно применяется
  // только если у товара уже был известен остаток ДО импорта — иначе это
  // была бы придуманная "абсолютная" цифра из одной лишь дельты.
  const absoluteStockByProductId = new Map<string, number>();
  const stockMovementByProductId = new Map<string, number>();
  const createdProductNames: string[] = [];
  const createdSupplierNames: string[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    const name = parseText(row[productColumn]);
    const quantity = parseNumber(row[quantityColumn]);
    const soldAt = parseDate(row[dateColumn]);

    if (!name || quantity === null || quantity <= 0 || !soldAt) {
      skippedRows++;
      continue;
    }

    const unitPriceRaw = unitPriceColumn ? parseNumber(row[unitPriceColumn]) : null;
    const revenueRaw = revenueColumn ? parseNumber(row[revenueColumn]) : null;
    const stockRaw = stockColumn ? parseNumber(row[stockColumn]) : null;
    const stockInRaw = stockInColumn ? parseNumber(row[stockInColumn]) : null;
    const stockOutRaw = stockOutColumn ? parseNumber(row[stockOutColumn]) : null;
    const sku = skuColumn ? parseText(row[skuColumn]) : null;
    const category = categoryColumn ? parseText(row[categoryColumn]) : null;
    const unit = unitColumn ? parseText(row[unitColumn]) : null;
    const minStockRaw = minStockColumn ? parseNumber(row[minStockColumn]) : null;
    const purchasePriceRaw = purchasePriceColumn ? parseNumber(row[purchasePriceColumn]) : null;
    const sellingPriceRaw = sellingPriceColumn ? parseNumber(row[sellingPriceColumn]) : null;
    const supplierName = supplierNameColumn ? parseText(row[supplierNameColumn]) : null;
    const supplierPhone = supplierPhoneColumn ? parseText(row[supplierPhoneColumn]) : null;
    const supplierWebsite = supplierWebsiteColumn ? parseText(row[supplierWebsiteColumn]) : null;
    const supplierAddress = supplierAddressColumn ? parseText(row[supplierAddressColumn]) : null;

    // Приоритет — готовая сумма (revenue), если она есть в файле. Цена за
    // единицу выводится делением, а не наоборот, чтобы никогда не умножить
    // уже готовую сумму на количество повторно.
    const totalAmount = revenueRaw !== null ? revenueRaw : unitPriceRaw !== null ? unitPriceRaw * quantity : null;
    const unitPrice = unitPriceRaw !== null ? unitPriceRaw : revenueRaw !== null && quantity > 0 ? revenueRaw / quantity : null;

    // Поставщик: создаём/находим по имени, обогащаем контактами, если они
    // встретились в файле и ещё не были сохранены. Никогда не создаём
    // поставщика без реального имени из файла.
    let supplierId: string | null = null;
    if (supplierName) {
      const supplierKey = supplierName.toLowerCase();
      let supplier = suppliersByName.get(supplierKey);
      if (!supplier) {
        const { data: createdSupplier, error: supplierError } = await supabase
          .from("suppliers")
          .insert({
            business_id: businessId,
            name: supplierName,
            category: "Поставщики",
            phone: supplierPhone,
            website: supplierWebsite,
            address: supplierAddress,
          })
          .select()
          .single();
        if (!supplierError && createdSupplier) {
          supplier = createdSupplier as Supplier;
          suppliersByName.set(supplierKey, supplier);
          createdSupplierNames.push(supplierName);
        }
      } else {
        // Дополняем контакты, если раньше их не было, а в этой строке они есть.
        const patch: Record<string, string> = {};
        if (!supplier.phone && supplierPhone) patch.phone = supplierPhone;
        if (!supplier.website && supplierWebsite) patch.website = supplierWebsite;
        if (!supplier.address && supplierAddress) patch.address = supplierAddress;
        if (Object.keys(patch).length > 0) {
          await supabase.from("suppliers").update(patch).eq("id", supplier.id);
          suppliersByName.set(supplierKey, { ...supplier, ...patch } as Supplier);
        }
      }
      supplierId = suppliersByName.get(supplierKey)?.id ?? null;
    }

    const key = name.toLowerCase();
    let item = itemsByName.get(key);
    if (!item) {
      const { data: created, error: createError } = await supabase
        .from("inventory_items")
        .insert({
          business_id: businessId,
          name,
          category: category ?? "Импорт",
          unit: unit ?? "шт",
          current_stock: stockRaw,
          min_stock: minStockRaw,
          desired_stock: 0,
          avg_daily_usage: 0,
          sku,
          purchase_price: purchasePriceRaw,
          selling_price: sellingPriceRaw,
          supplier_id: supplierId,
        })
        .select()
        .single();
      if (createError || !created) {
        skippedRows++;
        continue;
      }
      item = created as InventoryItem;
      itemsByName.set(key, item);
      createdProductNames.push(name);
    } else {
      // Товар уже существует — дополняем метаданные, только если поле ещё
      // не заполнено, а в файле есть значение. Не перезаписываем то, что
      // пользователь уже ввёл вручную, случайной строкой из другой партии.
      const patch: Record<string, unknown> = {};
      if (!item.sku && sku) patch.sku = sku;
      if (!item.purchase_price && purchasePriceRaw !== null) patch.purchase_price = purchasePriceRaw;
      if (!item.selling_price && sellingPriceRaw !== null) patch.selling_price = sellingPriceRaw;
      if (!item.supplier_id && supplierId) patch.supplier_id = supplierId;
      if (item.min_stock === null && minStockRaw !== null) patch.min_stock = minStockRaw;
      if (item.unit === "шт" && unit && unit !== "шт") patch.unit = unit;
      if (Object.keys(patch).length > 0) {
        await supabase.from("inventory_items").update(patch).eq("id", item.id);
        item = { ...item, ...patch } as InventoryItem;
        itemsByName.set(key, item);
      }
    }

    if (stockRaw !== null) {
      absoluteStockByProductId.set(item.id, stockRaw);
    }
    if (stockInRaw !== null || stockOutRaw !== null) {
      const delta = (stockInRaw ?? 0) - (stockOutRaw ?? 0);
      stockMovementByProductId.set(item.id, (stockMovementByProductId.get(item.id) ?? 0) + delta);
    }

    const list = newSalesByProductId.get(item.id) ?? [];
    list.push({ quantity, unit_price: unitPrice, total_amount: totalAmount, sold_at: soldAt });
    newSalesByProductId.set(item.id, list);
  }

  let insertedSales = 0;
  const productsSummary: { id: string; name: string; insertedSales: number }[] = [];

  for (const [productId, salesToInsert] of newSalesByProductId.entries()) {
    const payload = salesToInsert.map((s) => ({
      business_id: businessId,
      product_id: productId,
      quantity: s.quantity,
      unit_price: s.unit_price,
      total_amount: s.total_amount,
      sold_at: s.sold_at,
      source: "excel_import" as const,
    }));

    const { error: insertError } = await supabase.from("sales").insert(payload);
    if (insertError) continue;
    insertedSales += payload.length;

    // Пересчитываем метрики товара из ВСЕЙ его истории продаж (не только
    // только что импортированных строк), чтобы forecast_daily_usage и
    // days_of_stock отражали реальную полную картину.
    const { data: allSales } = await supabase
      .from("sales")
      .select("sold_at, quantity")
      .eq("product_id", productId);

    const item = Array.from(itemsByName.values()).find((i) => i.id === productId)!;

    // Приоритет остатка: 1) абсолютное значение из файла (самое надёжное),
    // 2) движения (приход-расход), ПРИМЕНЁННЫЕ ТОЛЬКО поверх уже известного
    // остатка — дельта без базы не является достоверным абсолютным числом,
    // 3) то, что уже было в базе.
    const absoluteStock = absoluteStockByProductId.get(productId);
    const movement = stockMovementByProductId.get(productId);
    let currentStock: number | null = item.current_stock;
    if (absoluteStock !== undefined) {
      currentStock = absoluteStock;
    } else if (movement !== undefined && item.current_stock !== null) {
      currentStock = item.current_stock + movement;
    }

    const metrics = computeProductMetrics((allSales as Pick<Sale, "sold_at" | "quantity">[]) ?? [], {
      currentStock,
      minStock: item.min_stock,
      desiredStock: item.desired_stock,
    });

    const updatePayload: Record<string, unknown> = {
      forecast_daily_usage: metrics.averageDailyUsage,
      days_of_stock: metrics.daysOfStock,
      last_purchase_at: metrics.lastSaleAt,
    };
    if (currentStock !== item.current_stock) updatePayload.current_stock = currentStock;

    await supabase.from("inventory_items").update(updatePayload).eq("id", productId);

    productsSummary.push({ id: productId, name: item.name, insertedSales: payload.length });
  }

  return NextResponse.json({
    insertedSales,
    skippedRows,
    createdProducts: createdProductNames,
    createdSuppliers: createdSupplierNames,
    products: productsSummary,
  });
}
