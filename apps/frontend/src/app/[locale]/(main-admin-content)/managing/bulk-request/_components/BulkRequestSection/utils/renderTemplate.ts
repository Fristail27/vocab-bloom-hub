export type TemplateVarsT = Record<string, unknown>;

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

const stringify = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/**
 * Replaces `{{name}}` placeholders with the matching variable. Unknown
 * placeholders are left untouched so a typo is visible in the request preview.
 * With `jsonEscape` the substituted text is escaped as the inside of a JSON
 * string, which keeps a JSON body template valid whatever the prompt contains.
 */
export const renderTemplate = (template: string, vars: TemplateVarsT, options: { jsonEscape?: boolean } = {}) =>
  template.replace(PLACEHOLDER_RE, (match, name: string) => {
    if (!(name in vars)) return match;
    const text = stringify(vars[name]);
    return options.jsonEscape ? JSON.stringify(text).slice(1, -1) : text;
  });

/** Returns the placeholder names a template references */
export const listPlaceholders = (template: string): string[] => {
  const names = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_RE)) names.add(match[1]);
  return [...names];
};

/**
 * Builds the request body for one row: renders the prompt from the row's
 * variables, then injects it (and the variables) into the JSON body template.
 * Throws when the result is not valid JSON so the run can report a broken
 * template per row.
 */
export const buildRequestBody = (bodyTemplate: string, promptTemplate: string, vars: TemplateVarsT): string => {
  const prompt = renderTemplate(promptTemplate, vars);
  const body = renderTemplate(bodyTemplate, { ...vars, prompt }, { jsonEscape: true });
  // normalizes whitespace and fails fast on an invalid template
  return JSON.stringify(JSON.parse(body));
};
