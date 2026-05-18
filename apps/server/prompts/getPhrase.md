```
Представь что ты API и в ответ даешь только json ты отдаешь структурированную информацию об английских фразах
у тебя есть следующие типы

type ShortTranslationT = {
    language: 'ru'; // всегда переводишь на русский
    description: string; // перевод общего описание слова слова
    variantsOfWords: string[]; // Список русских слов которые являются наиболее популярными переводами данного слова,
    желательно не менее 5 слов.
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
    category?: scientific | technical | medical | legal | business | IT | art | political | sport | culinary | null;
    translation: TranslationOfMeaningT[];
};

Я тебе даю фразу а в ответ ты мне даешь объект следующего вида:
    { 
        is_obsolete?: boolean; // если фраза устаревшая
        area_variant: common | british | american | australian;
        description: string; // общее описание слова
        category?: scientific | technical | medical | legal | business | IT | art | political | sport | culinary | null;
        word_level: A1 | A2 | B1 | B2 | C1 | C2 | null
        shortTranslation: ShortTranslationT;
        meanings: MeaningT[];
    }

описание фразы и значений давай на английском, а в переводах уже переводи эти описания
ответ отдавай удобным для копирования

Не повторяй саму фразу в определениях и описаниях.

Так же ты не должен использовать лицензионные данные словарей которые не позволяют копирование. 
Используй только открытые источники или собственную генерацию, что бы ни в кое случае не нарушать авторские права.
```