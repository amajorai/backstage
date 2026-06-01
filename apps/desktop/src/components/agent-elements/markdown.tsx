"use client";

import { createCodePlugin } from "@streamdown/code";
import { type Components, Streamdown } from "streamdown";
import { cn } from "./utils/cn";

function fixNumberedListBreaks(text: string): string {
  return text.replace(/^(\d+)\.\s*\n+\s*\n*/gm, "$1. ");
}

const CODE_FENCE_LANGS = new Set([
  "bash",
  "diff",
  "html",
  "js",
  "json",
  "jsx",
  "md",
  "markdown",
  "sh",
  "shell",
  "text",
  "ts",
  "tsx",
  "yml",
  "yaml",
]);

function normalizeCodeFenceLanguages(text: string): string {
  return text.replace(/```([^\n]*)/g, (_match, langRaw) => {
    const lang = String(langRaw || "")
      .trim()
      .toLowerCase();
    if (!lang) return "```";
    const normalized = lang.split(/\s+/)[0];
    return CODE_FENCE_LANGS.has(normalized) ? `\`\`\`${normalized}` : "```text";
  });
}

export type MarkdownProps = {
  content: string;
  className?: string;
  textContrast?: "normal" | "high";
};

const code = createCodePlugin({
  themes: ["github-light", "github-dark"],
});

export function Markdown({ content, className }: MarkdownProps) {
  const safeContent = normalizeCodeFenceLanguages(
    fixNumberedListBreaks(content)
  );
  const components: Components = {
    h1: ({ children, ...props }) => (
      <h1 className="an-md-h1 mt-3 mb-1.5 font-semibold text-base" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="an-md-h2 mt-3 mb-1.5 font-semibold text-base" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="an-md-h3 mt-2 mb-1 font-semibold text-sm" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4 className="an-md-h4 mt-2 mb-1 font-medium text-sm" {...props}>
        {children}
      </h4>
    ),
    p: ({ children, ...props }) => (
      <p
        className="an-md-p text-an-foreground/80 text-sm leading-relaxed"
        {...props}
      >
        {children}
      </p>
    ),
    ul: ({ children, ...props }) => (
      <ul
        className="an-md-ul mb-2 list-outside list-disc space-y-0.5 pl-4 text-an-foreground/80 text-sm"
        {...props}
      >
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol
        className="an-md-ol mb-2 list-outside list-decimal space-y-0.5 pl-5 text-an-foreground/80 text-sm"
        {...props}
      >
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="an-md-li pl-0.5 text-an-foreground/80 text-sm" {...props}>
        {children}
      </li>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-medium text-an-foreground" {...props}>
        {children}
      </strong>
    ),
    a: ({ href, children, ...props }) => {
      if (!href) return <span>{children}</span>;
      const isExternal = href.startsWith("http") || href.startsWith("mailto:");
      return (
        <a
          {...props}
          className="an-md-link text-an-primary-color underline-offset-2 hover:underline"
          href={href}
          rel={isExternal ? "noopener noreferrer" : undefined}
          target={isExternal ? "_blank" : undefined}
        >
          {children}
        </a>
      );
    },
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="an-md-blockquote mb-2 border-an-border-color border-l-2 pl-3 text-an-foreground/70 text-sm italic"
        {...props}
      >
        {children}
      </blockquote>
    ),
    hr: ({ ...props }) => (
      <hr className="an-md-hr my-4 border-an-border-color" {...props} />
    ),
    table: ({ children, ...props }) => (
      <div className="my-3 overflow-x-auto rounded-an-tool-border-radius border border-an-border-color">
        <table
          className="an-md-table w-full text-sm [&>thead>tr>th]:bg-an-tool-background [&>thead]:bg-an-tool-background"
          {...props}
        >
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th
        className="bg-an-background-secondary px-3 py-2 text-left font-medium"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td
        className="border-an-border-color border-t px-3 py-2 text-an-foreground/80"
        {...props}
      >
        {children}
      </td>
    ),
  };

  return (
    <div
      className={cn(
        "an-markdown",
        "wrap-break-word overflow-hidden",
        "[&_li>p]:mb-0 [&_li>p]:inline",
        className
      )}
    >
      <Streamdown components={components} plugins={{ code }}>
        {safeContent}
      </Streamdown>
    </div>
  );
}
