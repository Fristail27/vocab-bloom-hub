import { InterfaceLanguageEnum } from '@/types/common';

import { readRepoFile } from './repo';
import { extractSection } from './sections';

/** The README's roadmap section, in the locale's README (single source, no copy on the site) */
export const readRoadmap = (locale: InterfaceLanguageEnum): { markdown: string; file: string } => {
  const file = locale === InterfaceLanguageEnum.ru ? 'docs/README.ru.md' : 'README.md';
  const markdown = extractSection(readRepoFile(file), /Roadmap/i) ?? '';

  return { markdown, file };
};

export const INSTALL_SNIPPET = `mkdir vocab-bloom-hub && cd vocab-bloom-hub
curl -fsSLO https://raw.githubusercontent.com/Fristail27/vocab-bloom-hub/main/docker-compose.yml
curl -fsSL  https://raw.githubusercontent.com/Fristail27/vocab-bloom-hub/main/.env.example -o .env
# edit .env: ADMIN_PASSWORD, POSTGRES_PASSWORD
docker compose up -d
curl -s localhost:3010/api/ready   # {"status":"ok"} once the dictionary is in`;

export const NODE_SNIPPET = `import { VocabBloomClient } from '@vocab-bloom-hub/client';

const client = new VocabBloomClient({ baseUrl: 'https://your-instance.example/api' });

const { data } = await client.search({ search: 'runing', limit: 5 }); // typo tolerant
const run = await client.word('run'); // every part of speech, forms, meanings, translations

for await (const word of client.iterateWords({ part_of_speech: ['verb'], word_level: ['b1'] })) {
  console.log(word.word);
}`;

export const PYTHON_SNIPPET = `from vocab_bloom_hub import VocabBloomClient

client = VocabBloomClient("https://your-instance.example/api")

hits = client.search("runing", limit=5)          # typo tolerant
run = client.word("run")                          # forms, meanings, translations

for word in client.iter_words(part_of_speech=["verb"], word_level=["b1"]):
    print(word.word)

df = client.words_dataframe(part_of_speech=["noun"])   # pip install "vocab-bloom-hub[pandas]"`;
