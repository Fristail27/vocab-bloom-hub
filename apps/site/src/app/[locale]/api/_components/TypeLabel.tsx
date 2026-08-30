import React from 'react';

import { describeType, SchemaT, schemaAnchor } from '@/content/openapi';

import styles from '../api.module.scss';

type TypeLabelP = { schema: SchemaT | undefined; enumTitle: string };

/** `EnWordT[]` with a link to the schema, the allowed values of an enum underneath */
export const TypeLabel = ({ schema, enumTitle }: TypeLabelP) => {
  const label = describeType(schema);

  return (
    <>
      <code>{label.ref ? <a href={`#${schemaAnchor(label.ref)}`}>{label.text}</a> : label.text}</code>
      {label.enumValues && (
        <div className={styles.enum} title={enumTitle}>
          {label.enumValues.map((value) => (
            <code key={value}>{value}</code>
          ))}
        </div>
      )}
    </>
  );
};
