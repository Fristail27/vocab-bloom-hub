'use client';

import React, { useEffect, useState } from 'react';
import { Button, Checkbox, Typography } from 'antd';
import { Input } from '@/core/ui/Input';
import { Select } from '@/core/ui/Select';
import { PhrasalObjectPatternsOfVerb, TransitivityOptions } from './constants';
import { VerbSettingsT } from './types';
import { WordDoesntExistBlock } from '../WordDoesntExistBlock';
import { CheckCircleOutlined } from '@ant-design/icons';
import { StatusOfWordPresenceE } from '../../types';
import styles from './styles.module.scss';

const { Text } = Typography;

type VerbSettingsP = {
  setSettings: (verbSettings: boolean | string, field: keyof VerbSettingsT) => void;
} & VerbSettingsT;

export const VerbSettings: React.FC<VerbSettingsP> = ({
  setSettings,
  verb___transitivity,
  verb___is_phrasal,
  verb___is_irregular,
  base_phrasal,
  verb___phrasal_object_pattern,
}) => {
  const [statusOfPresence, setStatusOfPresence] = useState<StatusOfWordPresenceE>(
    StatusOfWordPresenceE.notChecked,
  );

  const checkPhrasalBase = async () => {
    // const { hasWord } = await EnWordsApi.checkWord(base_phrasal, EnPartOfSpeechE.verb, FormOfVerbE.base_form);
    // setStatusOfPresence(hasWord ? StatusOfWordPresenceE.present : StatusOfWordPresenceE.absent);
    setStatusOfPresence(StatusOfWordPresenceE.present);
  };

  useEffect(() => {
    if (!verb___is_phrasal) setSettings('', 'base_phrasal');
  }, [verb___is_phrasal]);

  return (
    <div className={styles.verbSettings}>
      <div className={styles.radios}>
        <Checkbox
          checked={verb___is_irregular}
          onChange={(e) => setSettings(e.target.checked, 'verb___is_irregular')}
        >
          Regular / Irregular
        </Checkbox>
        <Select
          label="Transitivity"
          onChange={(v) => setSettings(v as string, 'verb___transitivity')}
          value={verb___transitivity}
          options={TransitivityOptions}
        />
        <Checkbox
          checked={verb___is_phrasal}
          onChange={(e) => setSettings(e.target.checked, 'verb___is_phrasal')}
        >
          <Text strong>Фразовый глагол</Text>
        </Checkbox>
        {verb___is_phrasal && (
          <div className={styles.checkPhrasalBase}>
            <Input
              label="Base phrase form (для go up - go)"
              onChange={(e) => setSettings(e.target.value, 'base_phrasal')}
              value={base_phrasal}
            />
            <Button onClick={checkPhrasalBase} size="middle" type="primary">
              <CheckCircleOutlined />
            </Button>
          </div>
        )}
        {verb___is_phrasal && (
          <Select
            label="Phrasal Object Pattern"
            onChange={(v) => setSettings(v as string, 'verb___phrasal_object_pattern')}
            value={verb___phrasal_object_pattern}
            options={PhrasalObjectPatternsOfVerb}
          />
        )}
      </div>
      {statusOfPresence === StatusOfWordPresenceE.absent && verb___is_phrasal && (
        <WordDoesntExistBlock word={base_phrasal} />
      )}
    </div>
  );
};
