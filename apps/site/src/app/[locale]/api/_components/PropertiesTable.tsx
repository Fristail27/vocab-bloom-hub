import React from 'react';

import { SchemaT } from '@/content/openapi';

import styles from '../api.module.scss';
import { TypeLabel } from './TypeLabel';

export type TableLabelsT = {
  name: string;
  type: string;
  required: string;
  description: string;
  yes: string;
  no: string;
  default: string;
  enumTitle: string;
  range: string;
};

type PropertiesTableP = { schema: SchemaT; labels: TableLabelsT };

const constraints = (schema: SchemaT, labels: TableLabelsT): string[] => {
  const notes: string[] = [];
  if (schema.default !== undefined) notes.push(`${labels.default}: ${JSON.stringify(schema.default)}`);
  if (schema.minimum !== undefined || schema.maximum !== undefined) {
    notes.push(`${labels.range}: ${schema.minimum ?? '…'} – ${schema.maximum ?? '…'}`);
  }

  return notes;
};

/** The properties of an object schema: name, type, required, description and constraints */
export const PropertiesTable = ({ schema, labels }: PropertiesTableP) => {
  const required = new Set(schema.required ?? []);

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{labels.name}</th>
            <th>{labels.type}</th>
            <th>{labels.required}</th>
            <th>{labels.description}</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(schema.properties ?? {}).map(([name, property]) => (
            <tr key={name}>
              <td>
                <code>{name}</code>
              </td>
              <td>
                <TypeLabel schema={property} enumTitle={labels.enumTitle} />
              </td>
              <td>{required.has(name) ? <span className={styles.required}>{labels.yes}</span> : labels.no}</td>
              <td>
                {property.description}
                {constraints(property, labels).map((note) => (
                  <div key={note}>{note}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
