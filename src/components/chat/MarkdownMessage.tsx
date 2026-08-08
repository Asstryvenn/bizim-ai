"use client";

import { Fragment, useMemo } from "react";
import CodeBlock from "./CodeBlock";
import { renderMarkdownBlocks } from "./markdown";

const FENCE_RE = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)(?:```|$)/g;

interface Segment {
  type: "text" | "code";
  content: string;
  language?: string;
}

function splitFences(raw: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(FENCE_RE);

  while ((match = re.exec(raw))) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: raw.slice(lastIndex, match.index) });
    }
    segments.push({ type: "code", content: match[2].replace(/\n$/, ""), language: match[1] || undefined });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < raw.length) {
    segments.push({ type: "text", content: raw.slice(lastIndex) });
  }
  return segments;
}

/** Рендерит полный текст сообщения ассистента: markdown + блоки кода. */
export default function MarkdownMessage({ content }: { content: string }) {
  const segments = useMemo(() => splitFences(content), [content]);

  return (
    <div className="space-y-1">
      {segments.map((seg, idx) =>
        seg.type === "code" ? (
          <CodeBlock key={`seg-${idx}`} code={seg.content} language={seg.language} />
        ) : (
          <Fragment key={`seg-${idx}`}>{renderMarkdownBlocks(seg.content)}</Fragment>
        )
      )}
    </div>
  );
}
