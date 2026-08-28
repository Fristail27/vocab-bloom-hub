/**
 * Turns the JSON Schema (draft-07) that ts-json-schema-generator produces
 * for `types/public/v1` into OpenAPI 3.0 component schemas (issue #305).
 *
 * The differences that matter: `$ref` targets move from `#/definitions/` to
 * `#/components/schemas/`; a `type: [T, 'null']` or `anyOf: [X, null]` union
 * becomes `nullable: true`; `const` becomes a one-value `enum`; instantiated
 * generics (`PublicListResT<A,B>`, which the generator names with angle
 * brackets) are inlined into the aliases that use them so every remaining
 * schema has a plain identifier for a name; a plain alias (`type A = B`) is
 * resolved to its target. `additionalProperties: false` is dropped: a field
 * added to a response is not a breaking change for consumers.
 */
export type JsonSchemaT = Record<string, unknown>;
export type SchemaMapT = Record<string, JsonSchemaT>;

const DEFINITIONS_PREFIX = '#/definitions/';
export const COMPONENT_SCHEMAS_PREFIX = '#/components/schemas/';

const isGenericName = (name: string): boolean => name.includes('<');

const isNullType = (schema: unknown): boolean =>
  typeof schema === 'object' && schema !== null && (schema as JsonSchemaT).type === 'null';

const refName = (ref: string): string | null =>
  ref.startsWith(DEFINITIONS_PREFIX) ? decodeURIComponent(ref.slice(DEFINITIONS_PREFIX.length)) : null;

const convertNode = (node: unknown, definitions: SchemaMapT): unknown => {
  if (Array.isArray(node)) return node.map((item) => convertNode(item, definitions));
  if (!node || typeof node !== 'object') return node;

  const schema = { ...(node as JsonSchemaT) };

  if (typeof schema.$ref === 'string') {
    const name = refName(schema.$ref);
    if (name === null) return schema;
    if (isGenericName(name)) {
      const target = definitions[name];
      if (!target) throw new Error(`Schema "${name}" is referenced but not generated`);
      const { $ref: _ref, ...rest } = schema;
      return { ...(convertNode(target, definitions) as JsonSchemaT), ...rest };
    }
    return { ...schema, $ref: `${COMPONENT_SCHEMAS_PREFIX}${name}` };
  }

  // type: ['string', 'null']  →  type: 'string', nullable: true
  if (Array.isArray(schema.type)) {
    const types = schema.type.filter((t) => t !== 'null');
    if (types.length === 1 && types.length < schema.type.length) {
      schema.type = types[0];
      schema.nullable = true;
    }
  }

  // anyOf: [X, { type: 'null' }]  →  X + nullable (allOf keeps a bare $ref valid in 3.0)
  if (Array.isArray(schema.anyOf) && schema.anyOf.some(isNullType)) {
    const members = schema.anyOf.filter((m) => !isNullType(m)).map((m) => convertNode(m, definitions));
    delete schema.anyOf;
    if (members.length === 1) {
      const only = members[0] as JsonSchemaT;
      if (typeof only.$ref === 'string') return { ...schema, allOf: [only], nullable: true };
      return { ...schema, ...only, nullable: true };
    }
    return { ...schema, anyOf: members, nullable: true };
  }

  if ('const' in schema) {
    schema.enum = [schema.const];
    delete schema.const;
  }
  if (schema.additionalProperties === false) delete schema.additionalProperties;

  for (const key of ['properties', 'items', 'allOf', 'anyOf', 'oneOf', 'not', 'additionalProperties']) {
    if (key in schema) schema[key] = convertNode(schema[key], definitions);
  }
  if (schema.properties && typeof schema.properties === 'object') {
    schema.properties = Object.fromEntries(
      Object.entries(schema.properties as JsonSchemaT).map(([name, value]) => [
        name,
        convertNode(value, definitions),
      ]),
    );
  }
  return schema;
};

// A definition that is nothing but a reference (`type A = B`) adds a schema
// without a shape of its own; model generators turn it into a wrapper class
// (a pydantic RootModel, for instance). Every reference to it is pointed at
// the target instead and the alias is dropped.
const resolveAliases = (schemas: SchemaMapT): SchemaMapT => {
  const aliasOf = new Map<string, string>();
  for (const [name, schema] of Object.entries(schemas)) {
    const keys = Object.keys(schema);
    if (
      keys.length === 1 &&
      typeof schema.$ref === 'string' &&
      schema.$ref.startsWith(COMPONENT_SCHEMAS_PREFIX)
    ) {
      aliasOf.set(name, schema.$ref.slice(COMPONENT_SCHEMAS_PREFIX.length));
    }
  }
  const target = (name: string): string => {
    let current = name;
    while (aliasOf.has(current)) current = aliasOf.get(current) as string;
    return current;
  };
  const rewrite = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(rewrite);
    if (!node || typeof node !== 'object') return node;
    const schema = node as JsonSchemaT;
    if (typeof schema.$ref === 'string' && schema.$ref.startsWith(COMPONENT_SCHEMAS_PREFIX)) {
      return {
        ...schema,
        $ref: `${COMPONENT_SCHEMAS_PREFIX}${target(schema.$ref.slice(COMPONENT_SCHEMAS_PREFIX.length))}`,
      };
    }
    return Object.fromEntries(Object.entries(schema).map(([key, value]) => [key, rewrite(value)]));
  };
  return Object.fromEntries(
    Object.entries(schemas)
      .filter(([name]) => !aliasOf.has(name))
      .map(([name, schema]) => [name, rewrite(schema) as JsonSchemaT]),
  );
};

/** `{ definitions }` from the generator → OpenAPI component schemas, named by the exported types */
export const toOpenApiSchemas = (jsonSchema: { definitions?: SchemaMapT }): SchemaMapT => {
  const definitions = jsonSchema.definitions ?? {};
  return resolveAliases(
    Object.fromEntries(
      Object.entries(definitions)
        .filter(([name]) => !isGenericName(name))
        .map(([name, schema]) => [name, convertNode(schema, definitions) as JsonSchemaT]),
    ),
  );
};
