import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ParsedRow } from "@/types";
import i18n from "@/lib/i18n";

export type SupportedFileType = "csv" | "xlsx" | "json";

export function detectFileType(fileName: string): SupportedFileType | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "csv";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "json") return "json";
  return null;
}

/**
 * Реально парсит файл на клиенте. Никаких случайных/сгенерированных строк —
 * если файл пустой или битый, возвращается пустой массив и вызывающий код
 * обязан показать "Недостаточно данных", а не рисовать графики.
 */
export async function parseFile(file: File): Promise<{
  type: SupportedFileType;
  rows: ParsedRow[];
}> {
  const type = detectFileType(file.name);
  if (!type) {
    throw new Error(i18n.t("fileParser.unsupportedFormat"));
  }

  if (type === "csv") {
    const text = await file.text();
    const result = Papa.parse<ParsedRow>(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });
    if (result.errors.length > 0) {
      throw new Error(
        i18n.t("fileParser.csvParseError", {
          message: result.errors[0].message,
          row: result.errors[0].row,
        })
      );
    }
    return { type, rows: result.data };
  }

  if (type === "xlsx") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { type, rows: [] };
    }
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: null });
    return { type, rows };
  }

  // json
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(i18n.t("fileParser.invalidJson"));
  }
  const rows = Array.isArray(parsed) ? (parsed as ParsedRow[]) : [parsed as ParsedRow];
  return { type, rows };
}
