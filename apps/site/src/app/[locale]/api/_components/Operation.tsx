import React from 'react';

import { Link } from '@/i18n/navigation';

import {
  buildCurlExample,
  EndpointT,
  jsonSchemaOf,
  OpenApiSpecT,
  refName,
  schemaAnchor,
} from '@/content/openapi';

import styles from '../api.module.scss';
import { PropertiesTable, TableLabelsT } from './PropertiesTable';
import { TypeLabel } from './TypeLabel';

export type OperationLabelsT = TableLabelsT & {
  in: string;
  parameters: string;
  no_parameters: string;
  request_body: string;
  responses: string;
  example: string;
  try_it: string;
};

type OperationP = { endpoint: EndpointT; spec: OpenApiSpecT; baseUrl: string; labels: OperationLabelsT };

/** One endpoint of the reference: the route, its parameters, body, responses and a curl example */
export const Operation = ({ endpoint, spec, baseUrl, labels }: OperationP) => {
  const { operation, method, path, slug } = endpoint;
  const parameters = operation.parameters ?? [];
  const bodySchema = jsonSchemaOf(operation.requestBody?.content);
  const body = bodySchema?.$ref ? spec.components.schemas[refName(bodySchema.$ref)] : bodySchema;
  const tryable = !path.endsWith('/openapi.json');

  return (
    <section id={slug} className={styles.operation}>
      <h3>
        <span className={`${styles.method} ${styles[method.toLowerCase()] ?? ''}`}>{method}</span>
        <span>{path}</span>
      </h3>
      {operation.summary && <p className={styles.summary}>{operation.summary}</p>}
      {operation.description && <p className={styles.description}>{operation.description}</p>}

      {parameters.length === 0 && !body && (
        <>
          <h4>{labels.parameters}</h4>
          <p className={styles.description}>{labels.no_parameters}</p>
        </>
      )}
      {parameters.length > 0 && (
        <>
          <h4>{labels.parameters}</h4>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{labels.name}</th>
                  <th>{labels.in}</th>
                  <th>{labels.type}</th>
                  <th>{labels.required}</th>
                  <th>{labels.description}</th>
                </tr>
              </thead>
              <tbody>
                {parameters.map((param) => (
                  <tr key={`${param.in}-${param.name}`}>
                    <td>
                      <code>{param.name}</code>
                    </td>
                    <td>{param.in}</td>
                    <td>
                      <TypeLabel schema={param.schema} enumTitle={labels.enumTitle} />
                    </td>
                    <td>
                      {param.required ? <span className={styles.required}>{labels.yes}</span> : labels.no}
                    </td>
                    <td>
                      {param.description}
                      {param.schema.default !== undefined && (
                        <div>
                          {labels.default}: {JSON.stringify(param.schema.default)}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {body && (
        <>
          <h4>
            {labels.request_body}
            {bodySchema?.$ref && (
              <>
                {' · '}
                <a href={`#${schemaAnchor(refName(bodySchema.$ref))}`}>
                  <code>{refName(bodySchema.$ref)}</code>
                </a>
              </>
            )}
          </h4>
          <PropertiesTable schema={body} labels={labels} />
        </>
      )}

      <h4>{labels.responses}</h4>
      <ul className={styles.responses}>
        {Object.entries(operation.responses).map(([status, response]) => (
          <li key={status}>
            <span className={styles.status}>{status}</span>
            <span>
              {response.description}
              {jsonSchemaOf(response.content) && (
                <>
                  {' — '}
                  <TypeLabel schema={jsonSchemaOf(response.content)} enumTitle={labels.enumTitle} />
                </>
              )}
            </span>
          </li>
        ))}
      </ul>

      <h4>{labels.example}</h4>
      <pre className={styles.pre}>{buildCurlExample(endpoint, baseUrl, spec)}</pre>
      {tryable && (
        <p className={styles.tryIt}>
          <Link href={`/playground?endpoint=${slug}`}>{labels.try_it} →</Link>
        </p>
      )}
    </section>
  );
};
