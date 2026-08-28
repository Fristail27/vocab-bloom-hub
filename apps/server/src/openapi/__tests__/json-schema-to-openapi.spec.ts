import { describe, expect, it } from '@jest/globals';
import { toOpenApiSchemas } from '../json-schema-to-openapi';

// What ts-json-schema-generator emits for the v1 contract, reduced to the
// constructs the conversion has to handle (issue #305)
const generated = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  definitions: {
    ItemResT: { $ref: '#/definitions/PublicItemResT%3CWordT%3E' },
    'PublicItemResT<WordT>': {
      type: 'object',
      properties: { data: { $ref: '#/definitions/WordT' } },
      required: ['data'],
      additionalProperties: false,
    },
    WordT: {
      type: 'object',
      additionalProperties: false,
      properties: {
        word: { type: 'string', description: 'The headword' },
        transcription: { type: ['string', 'null'] },
        level: { anyOf: [{ $ref: '#/definitions/LevelE' }, { type: 'null' }] },
        register: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        language: { type: 'string', const: 'ru' },
        forms: { type: 'array', items: { $ref: '#/definitions/FormT' } },
        either: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] },
      },
      required: ['word'],
    },
    FormT: { type: 'object', properties: { id: { type: 'number' } }, additionalProperties: false },
    LevelE: { type: 'string', enum: ['A1', 'A2'] },
    // `type PublicWordT = WordT`: a bare alias, resolved to its target
    PublicWordT: { $ref: '#/definitions/WordT' },
    WordResT: { type: 'object', properties: { data: { $ref: '#/definitions/PublicWordT' } } },
  },
};

describe('JSON Schema → OpenAPI 3.0 component schemas (issue #305)', () => {
  const schemas = toOpenApiSchemas(generated);

  it('inlines instantiated generics into their aliases and keeps plain names only', () => {
    expect(Object.keys(schemas).sort()).toEqual(['FormT', 'ItemResT', 'LevelE', 'WordResT', 'WordT']);
    expect(schemas.ItemResT).toEqual({
      type: 'object',
      properties: { data: { $ref: '#/components/schemas/WordT' } },
      required: ['data'],
    });
  });

  it('moves $ref targets to #/components/schemas and drops additionalProperties: false', () => {
    const forms = (schemas.WordT.properties as Record<string, unknown>).forms;
    expect(forms).toEqual({ type: 'array', items: { $ref: '#/components/schemas/FormT' } });
    expect(schemas.FormT).not.toHaveProperty('additionalProperties');
  });

  it('expresses null unions as nullable, keeping a bare $ref valid through allOf', () => {
    const props = schemas.WordT.properties as Record<string, unknown>;
    expect(props.transcription).toEqual({ type: 'string', nullable: true });
    expect(props.level).toEqual({ allOf: [{ $ref: '#/components/schemas/LevelE' }], nullable: true });
    expect(props.register).toEqual({ type: 'string', nullable: true });
    expect(props.either).toEqual({ anyOf: [{ type: 'string' }, { type: 'number' }], nullable: true });
  });

  it('turns const into a one-value enum and keeps descriptions', () => {
    const props = schemas.WordT.properties as Record<string, unknown>;
    expect(props.language).toEqual({ type: 'string', enum: ['ru'] });
    expect(props.word).toEqual({ type: 'string', description: 'The headword' });
  });

  it('resolves a bare alias to its target and drops the alias schema', () => {
    expect(schemas).not.toHaveProperty('PublicWordT');
    expect(schemas.WordResT).toEqual({
      type: 'object',
      properties: { data: { $ref: '#/components/schemas/WordT' } },
    });
  });

  it('fails on a reference to a generic that was not generated', () => {
    expect(() => toOpenApiSchemas({ definitions: { A: { $ref: '#/definitions/Missing%3CX%3E' } } })).toThrow(
      'Schema "Missing<X>" is referenced but not generated',
    );
  });
});
