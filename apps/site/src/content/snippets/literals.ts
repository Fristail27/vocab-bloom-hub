// The sample body of a write as a literal of the target language: the
// snippets show `{ search: 'run' }` where the language would write it so,
// not a JSON string pasted into every language alike

const indent = (depth: number): string => '  '.repeat(depth);

/** A JavaScript object literal, single quotes, unquoted keys where the language allows */
export const jsLiteral = (value: unknown, depth = 0): string => {
  if (Array.isArray(value)) return `[${value.map((item) => jsLiteral(item, depth)).join(', ')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => {
      const name = /^[a-zA-Z_$][\w$]*$/.test(key) ? key : `'${key}'`;
      return `${indent(depth + 1)}${name}: ${jsLiteral(item, depth + 1)}`;
    });
    return `{\n${entries.join(',\n')}\n${indent(depth)}}`;
  }
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  return String(value);
};

/** A Python literal: dicts, lists, `True` / `False` / `None` */
export const pythonLiteral = (value: unknown, depth = 0): string => {
  if (value === null || value === undefined) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (Array.isArray(value)) return `[${value.map((item) => pythonLiteral(item, depth)).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value).map(
      ([key, item]) => `${indent(depth + 1)}"${key}": ${pythonLiteral(item, depth + 1)}`,
    );
    return `{\n${entries.join(',\n')}\n${indent(depth)}}`;
  }
  if (typeof value === 'string') return `"${value.replace(/"/g, '\\"')}"`;
  return String(value);
};

/** A PHP array literal, the `[...]` syntax with `=>` */
export const phpLiteral = (value: unknown, depth = 0): string => {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => phpLiteral(item, depth)).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value).map(
      ([key, item]) => `${indent(depth + 1)}'${key}' => ${phpLiteral(item, depth + 1)}`,
    );
    return `[\n${entries.join(',\n')}\n${indent(depth)}]`;
  }
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  return String(value);
};

/** The body as one line of JSON — for the languages that send it as a string */
export const jsonLine = (value: unknown): string => JSON.stringify(value);
