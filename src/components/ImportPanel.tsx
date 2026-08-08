"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { parseFile } from "@/services/fileParser";
import GrowthTools from "@/components/GrowthTools";
import type { ImportedFile } from "@/types";

interface Props {
  businessId: string;
  initialFiles: ImportedFile[];
}

// Локальное расширение файла — результат анализа хранится ВМЕСТЕ с файлом,
// а не в отдельном "летучем" state, который не переживает повторные рендеры.
type FileWithAnalysis = ImportedFile & {
  last_analysis_report?: string;
  last_analysis_id?: string;
  last_analysis_at?: string;
};

export default function ImportPanel({ businessId, initialFiles }: Props) {
  const router = useRouter();
  const { t } = useTranslation();

  const [files, setFiles] = useState<FileWithAnalysis[]>(initialFiles);
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Флаг "компонент ещё смонтирован" — защита от setState после ухода со страницы
  // (например если пользователь успел уйти со страницы, пока OpenAI отвечал ~30с).
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // КЛЮЧЕВОЙ ФИКС: initialFiles — это проп. useState(initialFiles) использует
  // его только один раз, при монтировании. Когда router.refresh() приносит
  // от Server Component свежий список файлов (новый проп initialFiles),
  // React NE обновляет уже созданный state автоматически — проп меняется,
  // а files остаётся старым. Раньше это означало, что весь смысл
  // router.refresh() для этого компонента терялся молча, без единой ошибки.
  // Синхронизируем явно, когда приходят новые данные с сервера.
  useEffect(() => {
    setFiles((prev) => {
      // сохраняем уже отрисованные локально результаты анализа, если сервер
      // ещё не успел их вернуть (например last_analysis обновляется отдельным
      // update-запросом в /api/analyze, который может прийти чуть позже).
      const prevById = new Map(prev.map((f) => [f.id, f]));
      return initialFiles.map((f) => {
        const existing = prevById.get(f.id);
        return existing?.last_analysis_report
          ? {
              ...f,
              last_analysis_report: existing.last_analysis_report,
              last_analysis_id: existing.last_analysis_id,
              last_analysis_at: existing.last_analysis_at,
            }
          : f;
      });
    });
  }, [initialFiles]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    try {
      const { type, rows } = await parseFile(file);

      if (rows.length === 0) {
        throw new Error(t("importPanel.errors.emptyFile"));
      }

      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          fileName: file.name,
          fileType: type,
          rows,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t("importPanel.errors.saveFailed"));
      }

      if (!isMountedRef.current) return;
      setFiles((prev) => [data.file, ...prev]);

      // Фоновая синхронизация с сервером. UI уже обновлён локально выше и
      // ни от чего не зависит — если refresh не удастся, пользователь всё
      // равно увидит загруженный файл.
      try {
        router.refresh();
      } catch {
        /* не критично — локальный state уже актуален */
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : t("importPanel.errors.uploadError"));
    } finally {
      if (isMountedRef.current) setUploading(false);
      e.target.value = "";
    }
  };

  const runAnalysis = async (fileId: string) => {
    setError(null);
    setAnalyzingId(fileId);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, fileId }),
      });

      // res.json() может упасть, если сервер вернул не-JSON (например HTML
      // страницу редиректа) — ловим это явно вместо того, чтобы уйти в общий catch
      // с непонятным сообщением.
      let data: { analysis?: { id?: string; report?: string }; error?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error(t("importPanel.errors.nonJsonResponse", { status: res.status }));
      }

      if (!res.ok) {
        throw new Error(data.error || t("importPanel.errors.analysisFailed", { status: res.status }));
      }

      const report = data.analysis?.report;
      const analysisId = data.analysis?.id;
      if (!report || !analysisId) {
        throw new Error(t("importPanel.errors.emptyAnalysisResponse"));
      }

      if (!isMountedRef.current) return;

      // ГЛАВНЫЙ ФИКС: результат анализа пишется сразу в persistent state
      // files, привязанный к конкретному fileId — а не в отдельный
      // "analysisResult", который ничем не защищён от исчезновения при
      // следующем ре-рендере. Теперь результату физически некуда потеряться:
      // он живёт там же, где и сам файл, и переживает любые последующие рендеры.
      const now = new Date().toISOString();
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, last_analysis_report: report, last_analysis_id: analysisId, last_analysis_at: now }
            : f
        )
      );

      // router.refresh() теперь используется ТОЛЬКО как фоновая синхронизация
      // (обновить дату "последнего анализа" в BusinessCard и т.п.), а не как
      // единственный источник правды для отображения результата.
      try {
        router.refresh();
      } catch {
        /* не критично — результат уже показан из локального state */
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : t("importPanel.errors.analysisError"));
    } finally {
      if (isMountedRef.current) setAnalyzingId(null);
    }
  };

  return (
    <div className="card space-y-6">
      <div>
        <h3 className="font-semibold">{t("importPanel.title")}</h3>
        <p className="text-sm text-ink/50 mt-1">{t("importPanel.subtitle")}</p>
        <label className="btn-primary mt-4 cursor-pointer inline-flex">
          {uploading ? t("importPanel.uploading") : t("importPanel.chooseFile")}
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      </div>

      {error && (
        <p className="text-danger text-sm badge-danger rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {files.length === 0 && (
          <p className="text-sm text-ink/40">{t("importPanel.noFiles")}</p>
        )}
        {files.map((file) => (
          <div key={file.id} className="border border-border rounded-xl px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{file.file_name}</p>
                <p className="text-xs text-ink/40">
                  {t("importPanel.rowsCount", { count: file.row_count })} · {file.file_type.toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => runAnalysis(file.id)}
                disabled={analyzingId === file.id}
                className="btn-secondary text-sm py-2 px-4 shrink-0"
              >
                {analyzingId === file.id ? t("importPanel.analyzing") : t("importPanel.runAnalysis")}
              </button>
            </div>

            {/* Результат анализа привязан к конкретному файлу и хранится
                в том же state, что и сам файл — не может "потеряться"
                при последующих ре-рендерах или router.refresh(). */}
            {file.last_analysis_report && (
              <div className="border-t border-border pt-3">
                <h4 className="font-semibold text-sm mb-2">{t("importPanel.reportTitle")}</h4>
                <p className="text-sm text-ink/70 whitespace-pre-wrap leading-relaxed">
                  {file.last_analysis_report}
                </p>
              </div>
            )}

            {/* Раздел добавляется только после того, как есть готовый
                AI-анализ (last_analysis_id) — инструменты строятся именно
                на его основе, а не на случайных советах. */}
            {file.last_analysis_report && file.last_analysis_id && (
              <GrowthTools businessId={businessId} analysisId={file.last_analysis_id} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
