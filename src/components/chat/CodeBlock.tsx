"use client";

import { useState, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const LANGUAGE_LABELS: Record<string, string> = {
  js: "JavaScript",
  jsx: "JavaScript (JSX)",
  ts: "TypeScript",
  tsx: "TypeScript (JSX)",
  javascript: "JavaScript",
  typescript: "TypeScript",
  py: "Python",
  python: "Python",
  sh: "Bash",
  bash: "Bash",
  shell: "Bash",
  sql: "SQL",
  json: "JSON",
  html: "HTML",
  css: "CSS",
  yml: "YAML",
  yaml: "YAML",
  md: "Markdown",
  txt: "chat.plainTextLabel",
};

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
  "switch", "case", "break", "continue", "import", "export", "default", "from",
  "class", "extends", "new", "this", "super", "try", "catch", "finally", "throw",
  "async", "await", "yield", "typeof", "instanceof", "in", "of", "null", "undefined",
  "true", "false", "void", "delete", "interface", "type", "implements", "public",
  "private", "protected", "static", "readonly", "enum", "namespace",
  "def", "elif", "except", "pass", "lambda", "with", "as", "None", "True", "False",
  "and", "or", "not", "is", "self", "print", "raise", "global", "nonlocal",
  "SELECT", "INSERT", "UPDATE", "DELETE", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT",
  "INNER", "GROUP", "ORDER", "BY", "INTO", "VALUES", "CREATE", "TABLE", "ALTER",
  "DROP", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "AND", "OR", "NOT", "NULL",
  "select", "insert", "update", "delete", "from", "where", "join", "group", "order",
  "by", "into", "values", "create", "table",
]);

const TOKEN_REGEX =
  /(\/\/[^\n]*)|(--[^\n]*)|(#[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)(?=\s*\()|(\b[A-Za-z_][A-Za-z0-9_]*\b)/g;

let tokenKeySeed = 0;

/**
 * Очень лёгкая эвристическая подсветка синтаксиса на регулярках — в песочнице
 * нет доступа к npm-реестру, поэтому shiki/prism недоступны. Красит
 * комментарии/строки/числа/ключевые слова/вызовы функций фиксированными
 * цветами (как в большинстве тёмных code-тем), не претендует на точный
 * лексер конкретного языка, но визуально выглядит как настоящая подсветка.
 */
function highlight(code: string) {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(TOKEN_REGEX);

  while ((match = re.exec(code))) {
    if (match.index > lastIndex) {
      nodes.push(code.slice(lastIndex, match.index));
    }
    const [full, lineComment, sqlComment, hashComment, str, num, funcCall, ident] = match;
    tokenKeySeed += 1;
    const key = `tok-${tokenKeySeed}`;

    if (lineComment || sqlComment || hashComment) {
      nodes.push(
        <span key={key} style={{ color: "#7f848e" }} className="italic">
          {full}
        </span>
      );
    } else if (str) {
      nodes.push(
        <span key={key} style={{ color: "#98c379" }}>
          {full}
        </span>
      );
    } else if (num) {
      nodes.push(
        <span key={key} style={{ color: "#d19a66" }}>
          {full}
        </span>
      );
    } else if (funcCall) {
      nodes.push(
        <span key={key} style={{ color: "#61afef" }}>
          {full}
        </span>
      );
    } else if (ident && KEYWORDS.has(ident)) {
      nodes.push(
        <span key={key} style={{ color: "#c678dd" }} className="font-medium">
          {full}
        </span>
      );
    } else {
      nodes.push(full);
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < code.length) nodes.push(code.slice(lastIndex));
  return nodes;
}

export default function CodeBlock({ code, language }: { code: string; language?: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const rawLabel = LANGUAGE_LABELS[(language || "").toLowerCase()];
  const label =
    rawLabel === "chat.plainTextLabel"
      ? t("chat.plainTextLabel")
      : rawLabel || (language ? language : t("chat.codeFallbackLabel"));
  const highlighted = useMemo(() => highlight(code), [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t("chat.codeCopied"));
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t("chat.codeCopyError"));
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-black/10 shadow-sm">
      <div className="flex items-center justify-between bg-[#282c34] px-3.5 py-2">
        <span className="text-xs font-medium tracking-wide text-white/50">{label}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-white/70 transition hover:bg-white/10 hover:text-white active:scale-95"
        >
          {copied ? (
            <>
              <CheckIcon /> {t("chat.codeCopiedLabel")}
            </>
          ) : (
            <>
              <CopyIcon /> {t("chat.codeCopyLabel")}
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[#21252b] px-4 py-3 text-[13px] leading-relaxed">
        <code className="font-mono text-[#abb2bf]">{highlighted}</code>
      </pre>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
