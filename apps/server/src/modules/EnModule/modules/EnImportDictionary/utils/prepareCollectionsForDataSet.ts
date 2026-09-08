import {
  DataSetMeaningT,
  DataSetMeaningTranslationT,
  DataSetShortTranslationT,
  DataSetWordKeyT,
} from '../../../../../../types/dictionaries/en/EnDataSetTypes';
import { EnWord } from '../../../entities/en_word.entity';
import { mapMeaningsForDS, mapShortTranslationForDS } from './prepareWordForDataSet';
import { sortShortTranslationsForDS } from './sortForDataSet';

/**
 * The lines of the collection files (issue #442): every meaning, meaning
 * translation and short translation of an entry as a line of its own next to
 * the key of its parent, in the order the nested collections used to have
 * inside the entry line (sortForDataSet.ts). The entry itself is loaded with
 * the one collection the file needs, so no stage assembles the whole tree.
 */

/** The key the collection files name their entry by */
export const wordKeyForDataSet = (word: EnWord): DataSetWordKeyT => ({
  word: word.word.word,
  part_of_speech: word.part_of_speech,
});

export const prepareMeaningsForDataSet = (word: EnWord): DataSetMeaningT[] => {
  const key = wordKeyForDataSet(word);
  return mapMeaningsForDS(word.meanings ?? [], word.part_of_speech).map(({ translations: _t, ...meaning }) => ({
    ...key,
    ...meaning,
  }));
};

export const prepareMeaningTranslationsForDataSet = (word: EnWord): DataSetMeaningTranslationT[] => {
  const key = wordKeyForDataSet(word);
  return mapMeaningsForDS(word.meanings ?? [], word.part_of_speech).flatMap((meaning) =>
    meaning.translations.map((translation) => ({
      ...key,
      meaning_sort_order: meaning.sort_order,
      meaning_title: meaning.title,
      ...translation,
    })),
  );
};

export const prepareShortTranslationsForDataSet = (word: EnWord): DataSetShortTranslationT[] => {
  const key = wordKeyForDataSet(word);
  return sortShortTranslationsForDS((word.short_translations ?? []).map(mapShortTranslationForDS)).map(
    (translation) => ({ ...key, ...translation }),
  );
};
