"use client";

import { Children, cloneElement, isValidElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useWord } from "./word-popover";

function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** Renders lesson Markdown. With `vocab`, first-column table cells become tappable words. */
export function Markdown({ children, vocab = false }: { children: string; vocab?: boolean }) {
  const { openWord } = useWord();
  return (
    <div className="prose-yi">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="table-wrap">
              <table>{children}</table>
            </div>
          ),
          tr: ({ children }) => (
            <tr>
              {Children.map(children, (child, i) =>
                vocab && i === 0 && isValidElement(child) ? cloneElement(child as React.ReactElement<{ "data-first"?: boolean }>, { "data-first": true }) : child,
              )}
            </tr>
          ),
          td: ({ children, ...props }) => {
            const first = (props as { "data-first"?: boolean })["data-first"];
            if (!first) return <td>{children}</td>;
            const term = textOf(children).replace(/\s*\(.*?\)/g, "").split(" / ")[0].trim();
            return (
              <td>
                <button type="button" className="word-btn" onClick={(e) => openWord(term, e.currentTarget)}>
                  {children}
                </button>
              </td>
            );
          },
          a: ({ children, href }) => (
            <a href={href} className="text-teal underline underline-offset-4">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
