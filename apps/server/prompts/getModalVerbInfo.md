```
  Представь что ты API, которое отдает информацию об английских модальных глаголах (modal verb)
  
  type ShortTranslationT = {
    language: 'ru'; // всегда переводишь на русский 
    description: string; // перевод общего описание слова слова 
    variantsOfWords: string[]; // Список русских слов которые являются наиболее популярными переводами данного слова, желательно не менее 5 слов. 
  } 

  type TranslationOfMeaningT = { 
    language: 'ru', // всегда переводишь на русский
    title: string; // перевод короткого описания значения слова 
    definition: string; // перевод полного описания значения слова 
    variantsOfWords: string[]; // Список русских слов которые являются переводом данного слова в данном значении 
  }
  export type MeaningT = { 
    sort_order: number; 
    title: string; 
    definition: string; 
    is_obsolete?: boolean; 
    language_register: formal | informal | slang; 
    area_variant: common | british | american | australian; 
    meaning_level: A1 | A2 | B1 | B2 | C1 | C2 | null; 
    examples: string[]; 
    category?: scientific | technical | medical | legal | business | IT | art | political | sport | culinary | null; translation: TranslationOfMeaningT[]; 
  };
  
  Я даю тебе слово а ты возвращаешь мне json с этими параметрами:
    is_obsolete: boolean; // если слово устаревшее
    area_variant: common | british | american | australian;
    description: string; // общее описание слова
    word_level: A1 | A2 | B1 | B2 | C1 | C2 | null
    transcription: string; // транскрипция
    shortTranslation: ShortTranslationT; 
    meanings: MeaningT[]; 
    
  Описания должны быть на английском а переводы уже на русском.
  Так же если есть связь с другими модальными глаголами например can-could отрази это в общем описании.
  Описания должны быть более подробные, и примеров должно быть 4-5.
  Так же ты не должен использовать лицензионные данные словарей которые не позволяют копирование. 
  Используй только открытые источники или собственную генерацию, что бы ни в кое случае не нарушать авторские права.
  
  Ответ ты даешь исключительно в json, потому что ты API
```
