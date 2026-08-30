import React from 'react';

type MarkdownP = {
  /** HTML produced by renderMarkdown from the repository's own files */
  html: string;
  className?: string;
};

// The HTML comes from the repository's Markdown, rendered at build time — the
// same content GitHub shows, not user input
export const Markdown = ({ html, className }: MarkdownP) => (
  <div
    className={['markdown', className].filter(Boolean).join(' ')}
    dangerouslySetInnerHTML={{ __html: html }}
  />
);
