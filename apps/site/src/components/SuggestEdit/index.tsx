'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';

import { browserApiBase } from '@/core/apiBase';

import styles from './styles.module.scss';

export type SuggestEditFieldT = {
  // a field of the EDITABLE_FIELDS whitelist on the server
  name: string;
  // the current value the reader sees (the `before` of the diff)
  value: string;
  multiline?: boolean;
};

type StateT =
  | { kind: 'closed' }
  | { kind: 'open' }
  | { kind: 'sending' }
  | { kind: 'done' }
  | { kind: 'error'; reason: 'rate_limited' | 'queue_full' | 'nothing' | 'other' };

/**
 * The second feedback flow (issue #327): a pencil next to a piece of word
 * data opens the current values in editable inputs; the proposal is filed
 * as an edit suggestion the admin can apply in one click.
 */
export const SuggestEdit = ({
  headword,
  targetType,
  targetId,
  fields,
  label,
}: {
  headword: string;
  targetType: 'word' | 'meaning' | 'meaning_translation' | 'short_translation';
  targetId: number;
  fields: SuggestEditFieldT[];
  label: string;
}) => {
  const t = useTranslations('word');
  const [state, setState] = useState<StateT>({ kind: 'closed' });
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((field) => [field.name, field.value])),
  );

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    // only what actually changed goes into the proposal
    const changes: Record<string, string> = {};
    for (const field of fields) {
      const next = (values[field.name] ?? '').trim();
      if (next && next !== field.value.trim()) changes[field.name] = next;
    }
    if (Object.keys(changes).length === 0) {
      setState({ kind: 'error', reason: 'nothing' });
      return;
    }
    setState({ kind: 'sending' });
    try {
      const res = await fetch(`${browserApiBase()}/v1/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headword,
          kind: 'edit',
          target_type: targetType,
          target_id: targetId,
          changes,
        }),
      });
      if (res.status === 429) return setState({ kind: 'error', reason: 'rate_limited' });
      if (res.status === 503) return setState({ kind: 'error', reason: 'queue_full' });
      if (!res.ok) throw new Error(String(res.status));
      setState({ kind: 'done' });
    } catch {
      setState({ kind: 'error', reason: 'other' });
    }
  };

  if (state.kind === 'done') {
    return <span className={styles.done}>{t('suggest_edit_done')}</span>;
  }

  if (state.kind === 'closed') {
    return (
      <button
        type="button"
        className={styles.opener}
        title={t('suggest_edit')}
        aria-label={`${t('suggest_edit')}: ${label}`}
        onClick={() => setState({ kind: 'open' })}
      >
        ✎
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={send} aria-label={`${t('suggest_edit')}: ${label}`}>
      <p className={styles.hint}>{t('suggest_edit_hint')}</p>
      {fields.map((field) => (
        <label key={field.name} className={styles.field}>
          {t(`suggest_field_${field.name}`)}
          {field.multiline ? (
            <textarea
              value={values[field.name] ?? ''}
              rows={3}
              maxLength={2000}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
            />
          ) : (
            <input
              type="text"
              value={values[field.name] ?? ''}
              maxLength={2000}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
            />
          )}
        </label>
      ))}
      <div className={styles.actions}>
        <button type="submit" disabled={state.kind === 'sending'}>
          {state.kind === 'sending' ? t('report_sending') : t('suggest_edit_send')}
        </button>
        <button type="button" onClick={() => setState({ kind: 'closed' })}>
          {t('report_cancel')}
        </button>
      </div>
      {state.kind === 'error' && (
        <p className={styles.note}>
          {state.reason === 'rate_limited'
            ? t('report_rate_limited')
            : state.reason === 'queue_full'
              ? t('report_queue_full')
              : state.reason === 'nothing'
                ? t('suggest_edit_nothing')
                : t('report_error')}
        </p>
      )}
    </form>
  );
};
