import { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './MarkdownRenderer.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onLinkClick?: (url: string) => void;
}

export function MarkdownRenderer({ content, className = '', onLinkClick }: MarkdownRendererProps) {
  return (
    <div className={`markdown-renderer ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={onLinkClick ? {
          a: ({ href, children }) => (
            <a href={href} onClick={(e) => { e.preventDefault(); if (href) onLinkClick(href); }}>
              {children}
            </a>
          )
        } : undefined}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}