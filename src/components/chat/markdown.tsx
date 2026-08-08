"use client";

/**
 * Мини-рендерер markdown для сообщений AI-чата.
 *
 * В проекте нет react-markdown / remark (нет доступа к npm-реестру из этой
 * песочницы), поэтому здесь — небольшой самодостаточный парсер на regex,
 * который строит React-дерево напрямую (никакого dangerouslySetInnerHTML,
 * так что от XSS ответа модели ничего не зависит). Поддерживает то, что
 * реально нужно для ответов бизнес-ассистента: заголовки, списки,
 * нумерованные списки, цитаты, таблицы, разделители, жирный/курсив,
 * инлайн-код и ссылки. Блоки кода (```lang ... ```) намеренно вырезаются
 * ДО этого парсера в MarkdownMessage.tsx и рендерятся отдельным
 * компонентом CodeBlock — с подсветкой синтаксиса и кнопкой "Скопировать".
 */

import type { ReactNode } from "react";

let keySeed = 0;
function nextKey(prefix: string) {
  keySeed += 1;
  return `${prefix}-${keySeed}`;
}

const INLINE_REGEX =
  /\*\*(?<bold>[^*\n]+)\*\*|`(?<code>[^`\n]+)`|\[(?<linktext>[^\]\n]+)\]\((?<linkurl>[^)\s]+)\)|\*(?<italic>[^*\n]+)\*|_(?<italic2>[^_\n]+)_|(?<url>https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g;

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(INLINE_REGEX);
  while ((match = re.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const g = match.groups!;
    if (g.bold !== undefined) {
      nodes.push(
        <strong key={nextKey("b")} className="font-semibold">
          {g.bold}
        </strong>
      );
    } else if (g.code !== undefined) {
      nodes.push(
        <code
          key={nextKey("c")}
          className="rounded-md bg-ink/[0.08] dark:bg-white/10 px-1.5 py-0.5 text-[0.85em] font-mono"
        >
          {g.code}
        </code>
      );
    } else if (g.linktext !== undefined) {
      nodes.push(
        <a
          key={nextKey("l")}
          href={g.linkurl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:opacity-80"
        >
          {g.linktext}
        </a>
      );
    } else if (g.italic !== undefined || g.italic2 !== undefined) {
      nodes.push(<em key={nextKey("i")}>{g.italic ?? g.italic2}</em>);
    } else if (g.url !== undefined) {
      nodes.push(
        <a
          key={nextKey("u")}
          href={g.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:opacity-80 break-all"
        >
          {g.url}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

const HEADER_RE = /^(#{1,6})\s+(.*)$/;
const UL_RE = /^\s*[-*•]\s+(.*)$/;
const OL_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const QUOTE_RE = /^\s*>\s?(.*)$/;
const HR_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const TABLE_ROW_RE = /^\s*\|(.+)\|\s*$/;
const TABLE_SEP_RE = /^\s*\|?[\s:|-]+\|?\s*$/;

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

const HEADER_SIZES: Record<number, string> = {
  1: "text-xl font-bold mt-1 mb-2",
  2: "text-lg font-bold mt-1 mb-2",
  3: "text-base font-bold mt-1 mb-1.5",
  4: "text-sm font-bold mt-1 mb-1",
  5: "text-sm font-semibold mt-1 mb-1",
  6: "text-sm font-semibold mt-1 mb-1",
};

/** Рендерит markdown-текст БЕЗ блоков кода (те вырезаны заранее). */
export function renderMarkdownBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Таблица
    if (TABLE_ROW_RE.test(line) && lines[i + 1] && TABLE_SEP_RE.test(lines[i + 1])) {
      const header = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && TABLE_ROW_RE.test(lines[i])) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div key={nextKey("tbl")} className="my-2 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-mist">
                {header.map((cell, ci) => (
                  <th
                    key={nextKey("th")}
                    className="border-b border-border px-3 py-2 text-left font-semibold text-ink/80"
                  >
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={nextKey("tr")} className="odd:bg-transparent even:bg-mist/50">
                  {row.map((cell) => (
                    <td key={nextKey("td")} className="border-b border-border/60 px-3 py-2 align-top">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Заголовок
    const headerMatch = line.match(HEADER_RE);
    if (headerMatch) {
      const level = headerMatch[1].length;
      blocks.push(
        <p key={nextKey("h")} className={HEADER_SIZES[level]}>
          {renderInline(headerMatch[2])}
        </p>
      );
      i += 1;
      continue;
    }

    // Разделитель
    if (HR_RE.test(line)) {
      blocks.push(<hr key={nextKey("hr")} className="my-3 border-border" />);
      i += 1;
      continue;
    }

    // Цитата
    if (QUOTE_RE.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && (QUOTE_RE.test(lines[i]) || lines[i].trim() === "")) {
        if (lines[i].trim() === "") break;
        quoteLines.push(lines[i].match(QUOTE_RE)![1]);
        i += 1;
      }
      blocks.push(
        <blockquote
          key={nextKey("q")}
          className="my-2 border-l-2 border-accent/50 pl-3 italic text-ink/70"
        >
          {quoteLines.map((ql) => (
            <p key={nextKey("qp")}>{renderInline(ql)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Ненумерованный список
    if (UL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UL_RE.test(lines[i])) {
        items.push(lines[i].match(UL_RE)![1]);
        i += 1;
      }
      blocks.push(
        <ul key={nextKey("ul")} className="my-1.5 list-disc space-y-1 pl-5 marker:text-accent">
          {items.map((it) => (
            <li key={nextKey("li")}>{renderInline(it)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Нумерованный список
    if (OL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length && OL_RE.test(lines[i])) {
        items.push(lines[i].match(OL_RE)![2]);
        i += 1;
      }
      blocks.push(
        <ol key={nextKey("ol")} className="my-1.5 list-decimal space-y-1 pl-5 marker:text-accent marker:font-medium">
          {items.map((it) => (
            <li key={nextKey("li")}>{renderInline(it)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Обычный параграф — склеиваем соседние "простые" строки вместе
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !HEADER_RE.test(lines[i]) &&
      !UL_RE.test(lines[i]) &&
      !OL_RE.test(lines[i]) &&
      !QUOTE_RE.test(lines[i]) &&
      !HR_RE.test(lines[i]) &&
      !(TABLE_ROW_RE.test(lines[i]) && lines[i + 1] && TABLE_SEP_RE.test(lines[i + 1]))
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={nextKey("p")} className="leading-relaxed">
        {paraLines.map((pl, idx) => (
          <span key={nextKey("pl")}>
            {renderInline(pl)}
            {idx < paraLines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  }

  return blocks;
}
