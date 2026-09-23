import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import go from 'highlight.js/lib/languages/go';
import javascript from 'highlight.js/lib/languages/javascript';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';

// The languages the API reference colours its snippets in (the Markdown
// pages go through rehype-highlight, which brings the common set by itself).
// A snippet language (content/snippets) names one of these in `highlight`;
// a new one is registered here
const LANGUAGES = { bash, go, javascript, php, python, typescript };

for (const [name, language] of Object.entries(LANGUAGES)) {
  if (!hljs.getLanguage(name)) hljs.registerLanguage(name, language);
}

export const highlightLanguages = (): string[] => Object.keys(LANGUAGES);

/** The code as HTML with highlight.js token classes (the theme is in globals.scss); escaped, safe to inject */
export const highlightCode = (code: string, language: string): string =>
  hljs.getLanguage(language)
    ? hljs.highlight(code, { language }).value
    : hljs.highlight(code, { language: 'plaintext' }).value;
