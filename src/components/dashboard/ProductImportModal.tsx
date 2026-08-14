"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { parseFile } from "@/services/fileParser";
import { suggestColumnMapping, FIELD_LABELS, type MappableField } from "@/lib/importMapping";
import type { ParsedRow } from "@/types";

interface ProductImportModalProps {
  onClose: () => void;
}

type Step = "upload" | "mapping" | "result";

interface ImportResult {
  insertedSales: number;
  skippedRows: number;
  createdProducts: string[];
  products: { id: string; name: string; insertedSales: number }[];
}

export default function ProductImportModal({ onClose }: ProductImportModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, MappableField | null>>({});
  const [confidence, setConfidence] = useState<Record<string, number>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const { rows: parsedRows } = await parseFile(file);
      if (parsedRows.length === 0) {
        setError("Файл пустой");
        return;
      }
      const cols = Object.keys(parsedRows[0]);
      const suggestions = suggestColumnMapping(cols);
      const nextMapping: Record<string, MappableField | null> = {};
      const nextConfidence: Record<string, number> = {};
      for (const s of suggestions) {
        nextMapping[s.column] = s.field;
        nextConfidence[s.column] = s.confidence;
      }
      setRows(parsedRows);
      setColumns(cols);
      setMapping(nextMapping);
      setConfidence(nextConfidence);
      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось прочитать файл");
    } finally {
      e.target.value = "";
    }
  };

  const handleFieldChange = (column: string, field: MappableField | "none") => {
    setMapping((prev) => {
      const next = { ...prev };
      if (field === "none") {
        next[column] = null;
        return next;
      }
      // Поле может быть назначено только одной колонке — сбрасываем прежнюю.
      for (const c of Object.keys(next)) {
        if (next[c] === field) next[c] = null;
      }
      next[column] = field;
      return next;
    });
  };

  const mappedFields = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);
  const canImport = mappedFields.has("product") && mappedFields.has("quantity") && mappedFields.has("date");

  const previewRows = rows.slice(0, 5);

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/import/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mapping }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось импортировать");
      setResult(data as ImportResult);
      setStep("result");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-card my-8 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Импорт продаж из Excel/CSV</h2>
            <p className="text-sm text-ink/50 mt-1">
              Товары и остатки будут рассчитаны из реальной истории продаж — ничего не придумывается.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full h-8 w-8 flex items-center justify-center text-ink/40 hover:bg-mist">
            ✕
          </button>
        </div>

        {error && <p className="text-danger text-sm badge-danger rounded-lg px-4 py-3">{error}</p>}

        {step === "upload" && (
          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
            <p className="text-sm text-ink/60 mb-4">Загрузите файл с продажами (.xlsx, .xls, .csv)</p>
            <label className="btn-primary cursor-pointer inline-flex">
              Выбрать файл
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
            </label>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink/50">
                    <th className="px-3 py-2 font-medium">Колонка файла</th>
                    <th className="px-3 py-2 font-medium">Распознано как</th>
                    <th className="px-3 py-2 font-medium">Confidence</th>
                    <th className="px-3 py-2 font-medium">Пример</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col) => (
                    <tr key={col} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium">{col}</td>
                      <td className="px-3 py-2">
                        <select
                          className="input py-1.5"
                          value={mapping[col] ?? "none"}
                          onChange={(e) => handleFieldChange(col, e.target.value as MappableField | "none")}
                        >
                          <option value="none">— не использовать —</option>
                          {(Object.keys(FIELD_LABELS) as MappableField[]).map((f) => (
                            <option key={f} value={f}>
                              {FIELD_LABELS[f]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-ink/60">
                        {mapping[col] ? `${Math.round((confidence[col] ?? 0) * 100)}%` : "—"}
                      </td>
                      <td className="px-3 py-2 text-ink/50 max-w-[160px] truncate">
                        {previewRows.map((r) => String(r[col] ?? "")).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!canImport && (
              <p className="text-xs text-danger">
                Нужно указать колонки для «Название товара», «Продажи» и «Дата» (цена — опционально).
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setStep("upload")} className="btn-secondary">
                Назад
              </button>
              <button type="button" onClick={handleImport} disabled={!canImport || importing} className="btn-primary">
                {importing ? "Импортируем..." : `Импортировать ${rows.length} строк`}
              </button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-mist p-4">
                <p className="text-xs text-ink/50">Продаж импортировано</p>
                <p className="text-2xl font-bold mt-1">{result.insertedSales}</p>
              </div>
              <div className="rounded-xl bg-mist p-4">
                <p className="text-xs text-ink/50">Новых товаров</p>
                <p className="text-2xl font-bold mt-1">{result.createdProducts.length}</p>
              </div>
              <div className="rounded-xl bg-mist p-4">
                <p className="text-xs text-ink/50">Пропущено строк</p>
                <p className="text-2xl font-bold mt-1">{result.skippedRows}</p>
              </div>
            </div>
            {result.createdProducts.length > 0 && (
              <p className="text-sm text-ink/60">
                Созданы товары: {result.createdProducts.join(", ")}. Не забудьте указать их текущий остаток на
                странице «Остатки» — импорт продаж не может знать, сколько у вас на складе сейчас.
              </p>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="btn-primary">
                Готово
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
