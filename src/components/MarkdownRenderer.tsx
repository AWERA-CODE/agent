'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={`markdown-content text-sm leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-white mt-3 mb-1.5 pb-1 border-b border-[var(--border)]/60">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-white mt-2.5 mb-1 pb-0.5 border-b border-[var(--border)]/40">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-white mt-2 mb-1">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-1.5 leading-relaxed text-[var(--foreground)] last:mb-0 first:mt-0">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 my-2 text-[var(--foreground)] pl-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-2 text-[var(--foreground)] pl-1">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed marker:text-[var(--primary)] text-[var(--foreground)]">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-300">{children}</em>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[var(--primary)] pl-3 my-2 text-[var(--muted)] italic bg-[var(--card-hover)]/40 py-1 rounded-r">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isCodeBlock = Boolean(className && className.startsWith('language-')) ||
              (typeof children === 'string' && children.includes('\n'));
            if (!isCodeBlock) {
              return (
                <code
                  className="bg-black/40 text-blue-300 px-1.5 py-0.5 rounded font-mono text-xs border border-white/10"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`font-mono text-xs text-blue-200 block ${className || ''}`}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-black/60 border border-[var(--border)] rounded-lg p-3 my-2 overflow-x-auto text-xs font-mono">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 border border-[var(--border)] rounded-lg">
              <table className="min-w-full text-xs divide-y divide-[var(--border)]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[var(--card-hover)] text-white font-semibold">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-[var(--border)] bg-black/20">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-[var(--card-hover)]/50 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-white">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-[var(--foreground)] whitespace-nowrap">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] hover:underline inline-flex items-center gap-1 font-medium"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="border-[var(--border)] my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
