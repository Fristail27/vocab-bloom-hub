import { EntityManager } from 'typeorm';
import { EnEntry } from '../entities/en_entry.entity';
import { EnWord } from '../entities/en_word.entity';

/**
 * Flags an entry as edited by the admin (issue #328): a dictionary update
 * keeps flagged entries instead of replacing them with the published
 * dataset. A missing entry (a delete removed it entirely) is a no-op.
 */
export const markEntryUserModified = async (em: EntityManager, headword: string): Promise<void> => {
  await em.getRepository(EnEntry).update({ word: headword }, { user_modified: true });
};

/**
 * Flags the entry an edit to the given word row protects. A form row flags
 * its base word's entry: a dataset update replaces a base word together
 * with its forms, so the base entry is the unit the flag must cover.
 */
export const markEntryUserModifiedByRow = async (em: EntityManager, wordRowId: number): Promise<void> => {
  const row = await em.getRepository(EnWord).findOne({
    where: { id: wordRowId },
    relations: { word: true, base_form: { word: true } },
  });
  if (!row) return;
  await markEntryUserModified(em, row.base_form?.word.word ?? row.word.word);
};
