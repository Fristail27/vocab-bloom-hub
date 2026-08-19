'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, InputNumber, Switch, Typography } from 'antd';
import { useTranslations } from 'next-intl';
import { SearchDetailedReqT, SearchReqT } from 'server/types';
import { AbstractBaseApi } from '@/core/api/AbstractBaseApi';
import { EnApi } from '@/core/api/EnApi';
import { Input } from '@/core/ui/Input';
import { Select } from '@/core/ui/Select';
import { ApiEndpointDocT, ApiEndpointKeyE, ApiParamDocT, ParamControlE } from '../../constants';
import { buildCurlSnippet, buildRequestBody, ParamValuesT } from '../../utils';
import { ResponseView } from '../ResponseView';
import styles from './styles.module.scss';

const { Text } = Typography;

// Requests go through the regular api clients, so the docs hit exactly the same
// endpoints the admin itself uses
const RUNNERS: Record<ApiEndpointKeyE, (body: ParamValuesT) => Promise<unknown>> = {
  [ApiEndpointKeyE.search]: (body) => EnApi.searchByFilters(body as unknown as SearchReqT),
  [ApiEndpointKeyE.search_detailed]: (body) => EnApi.searchDetailed(body as unknown as SearchDetailedReqT),
};

const getInitialValues = (params: ApiParamDocT[]): ParamValuesT =>
  params.reduce<ParamValuesT>((acc, param) => {
    if (param.control === ParamControlE.boolean) {
      acc[param.name] = param.defaultValue ?? false;
    } else if (param.defaultValue !== undefined) {
      acc[param.name] = param.defaultValue;
    } else if (param.control === ParamControlE.text) {
      acc[param.name] = '';
    }

    return acc;
  }, {});

type ApiPlaygroundP = {
  endpoint: ApiEndpointDocT;
};

export const ApiPlayground: React.FC<ApiPlaygroundP> = ({ endpoint }) => {
  const t = useTranslations('documentation');
  const [values, setValues] = useState<ParamValuesT>(() => getInitialValues(endpoint.params));
  const [response, setResponse] = useState<unknown>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [origin, setOrigin] = useState<string>('');

  // The base url may be relative, and the copyable example has to stay runnable
  useEffect(() => setOrigin(window.location.origin), []);

  const body = useMemo(() => buildRequestBody(endpoint.params, values), [endpoint.params, values]);
  const curl = useMemo(() => {
    const baseUrl = AbstractBaseApi.baseURL.startsWith('http')
      ? AbstractBaseApi.baseURL
      : `${origin}${AbstractBaseApi.baseURL}`;

    return buildCurlSnippet(endpoint, baseUrl, body);
  }, [endpoint, body, origin]);

  const hasEmptyRequired = endpoint.params.some((param) => param.required && !body[param.name]);

  const setValue = (name: string, value: unknown) => setValues((prev) => ({ ...prev, [name]: value }));

  const onSend = async () => {
    setIsLoading(true);
    const startedAt = performance.now();
    const res = await RUNNERS[endpoint.key](body);
    setElapsedMs(Math.round(performance.now() - startedAt));
    setResponse(res);
    setIsLoading(false);
  };

  const renderControl = (param: ApiParamDocT) => {
    const value = values[param.name];

    switch (param.control) {
      case ParamControlE.number:
        return (
          <div key={param.name} className={styles.field}>
            <Text strong>{param.name}</Text>
            <InputNumber
              aria-label={param.name}
              className={styles.numberInput}
              min={param.min}
              max={param.max}
              value={value as number | null}
              onChange={(next) => setValue(param.name, next)}
            />
          </div>
        );
      case ParamControlE.boolean:
        return (
          <div key={param.name} className={styles.switchField}>
            <Switch
              aria-label={param.name}
              checked={Boolean(value)}
              onChange={(checked) => setValue(param.name, checked)}
            />
            <Text strong>{param.name}</Text>
          </div>
        );
      case ParamControlE.enum:
      case ParamControlE.multi_enum:
        return (
          <Select<string | string[]>
            key={param.name}
            label={param.name}
            allowClear
            containerClassName={styles.field}
            mode={param.control === ParamControlE.multi_enum ? 'multiple' : undefined}
            value={value as string | string[] | undefined}
            onChange={(next) => setValue(param.name, next)}
            options={(param.options ?? []).map((option) => ({ label: option, value: option }))}
          />
        );
      default:
        return (
          <Input
            key={param.name}
            label={param.name}
            value={String(value ?? '')}
            onChange={(e) => setValue(param.name, e.target.value)}
          />
        );
    }
  };

  return (
    <div className={styles.playground}>
      {endpoint.params.length > 0 && <div className={styles.fields}>{endpoint.params.map(renderControl)}</div>}

      <Button type="primary" loading={isLoading} disabled={hasEmptyRequired} onClick={onSend}>
        {t('send_request')}
      </Button>

      <div className={styles.block}>
        <Text strong>{t('request_example')}</Text>
        <pre className={styles.snippet}>{curl}</pre>
      </div>

      <div className={styles.block}>
        <Text strong>{t('response')}</Text>
        <ResponseView response={response} elapsedMs={elapsedMs} />
      </div>
    </div>
  );
};
