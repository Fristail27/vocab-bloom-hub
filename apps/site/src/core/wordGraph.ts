import type { PublicWordV1T } from 'server/types';

export type GraphEntryT = Pick<PublicWordV1T, 'id' | 'part_of_speech'> & {
  meanings: Pick<
    PublicWordV1T['meanings'][number],
    'id' | 'title' | 'definition' | 'synonyms' | 'antonyms' | 'translations'
  >[];
};

// Only the fields the graph uses cross the server/client boundary.
export const graphEntries = (entries: readonly PublicWordV1T[]): GraphEntryT[] =>
  entries.map(({ id, part_of_speech, meanings }) => ({
    id,
    part_of_speech,
    meanings: meanings.map(({ id, title, definition, synonyms, antonyms, translations }) => ({
      id,
      title,
      definition,
      synonyms,
      antonyms,
      translations,
    })),
  }));

export const entriesForPart = (entries: readonly GraphEntryT[], partOfSpeech: string): GraphEntryT[] =>
  entries.filter((entry) => entry.part_of_speech === partOfSpeech);

export type RelationT = 'meaning' | 'synonym' | 'antonym' | 'translation';
export type GraphNodeT = {
  id: string;
  label: string;
  detail: string;
  kind: 'word' | 'meaning' | 'translation';
  language?: string;
  depth: number;
  lane: number;
  tone?: number;
  shared: boolean;
  x: number;
  y: number;
};
export type GraphEdgeT = { from: string; to: string; kind: RelationT };
export type WordGraphT = {
  nodes: GraphNodeT[];
  edges: GraphEdgeT[];
  direct: string[];
  truncated: boolean;
  width: number;
  height: number;
};

// Bound both the drawing and the set of words a reader can expand. The full
// dictionary entry remains below the graph. Exact case is part of a word's identity.
const MAX_NODES = 150;
const MAX_DIRECT = 24;
const MAX_MEANINGS = 12;
export const wordNodeId = (word: string): string => `word:${word}`;

export const buildWordGraph = (
  word: string,
  entries: readonly GraphEntryT[],
  partOfSpeech: string,
  neighbors: ReadonlyMap<string, readonly GraphEntryT[]> = new Map(),
  translationLanguage?: string,
): WordGraphT => {
  const nodes = new Map<string, GraphNodeT>();
  const edges: GraphEdgeT[] = [];
  const seenEdges = new Set<string>();
  const direct = new Set<string>();
  let truncated = false;
  const addNode = (
    id: string,
    label: string,
    detail: string,
    kind: GraphNodeT['kind'],
    depth: number,
    tone?: number,
  ) => {
    if (nodes.has(id)) return true;
    if (nodes.size >= MAX_NODES) {
      truncated = true;
      return false;
    }
    nodes.set(id, { id, label, detail, kind, depth, tone, lane: 0, shared: false, x: 0, y: 0 });
    return true;
  };
  const addEdge = (from: string, to: string, kind: RelationT) => {
    const key = JSON.stringify([from, to, kind]);
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    edges.push({ from, to, kind });
  };
  addNode(wordNodeId(word), word, word, 'word', 0);
  const addMeanings = (owner: string, source: readonly GraphEntryT[], depth: number) => {
    const meanings = source.flatMap((entry) => entry.meanings.map((meaning) => ({ entry, meaning })));
    if (meanings.length > MAX_MEANINGS) truncated = true;
    for (const [index, { entry, meaning }] of meanings.slice(0, MAX_MEANINGS).entries()) {
      const id = JSON.stringify(['meaning', owner, entry.id, meaning.id]);
      const title = meaning.title || meaning.definition || entry.part_of_speech;
      // Fixed slots keep existing meaning colors stable when another neighbor is opened.
      const tone = (depth === 0 ? 0 : [...direct].indexOf(owner) + 1) * MAX_MEANINGS + index;
      if (
        !addNode(id, title, `${entry.part_of_speech} · ${meaning.definition || title}`, 'meaning', depth, tone)
      )
        break;
      addEdge(wordNodeId(owner), id, 'meaning');
      if (translationLanguage !== undefined) {
        for (const translation of meaning.translations ?? []) {
          if (translation.language !== translationLanguage) continue;
          const variants = [
            ...new Set(translation.variants_of_words.map((value) => value.trim()).filter(Boolean)),
          ];
          const labels = variants.length ? variants : [translation.title.trim()].filter(Boolean);
          for (const label of labels) {
            const target = JSON.stringify(['translation', translation.language, label]);
            const detail = translation.definition || translation.title || label;
            if (!addNode(target, label, detail, 'translation', 1)) continue;
            const translated = nodes.get(target)!;
            translated.language = translation.language;
            if (!translated.detail.split('\n').includes(detail)) translated.detail += `\n${detail}`;
            addEdge(id, target, 'translation');
          }
        }
        continue;
      }
      for (const kind of ['synonym', 'antonym'] as const) {
        for (const related of kind === 'synonym' ? meaning.synonyms : meaning.antonyms) {
          if (!related.trim()) continue;
          if (depth === 0 && related !== word && !direct.has(related) && direct.size >= MAX_DIRECT) {
            truncated = true;
            continue;
          }
          const target = wordNodeId(related);
          if (!addNode(target, related, related, 'word', depth + 1)) continue;
          addEdge(id, target, kind);
          if (depth === 0 && related !== word) direct.add(related);
        }
      }
    }
  };
  addMeanings(word, entriesForPart(entries, partOfSpeech), 0);
  // Only original direct neighbors are expanded; fetched relations never start a walk.
  for (const related of direct) {
    const loaded = neighbors.get(related);
    if (loaded) addMeanings(related, entriesForPart(loaded, partOfSpeech), 1);
  }
  for (const node of nodes.values()) {
    const incoming = edges.filter((edge) => edge.to === node.id && edge.kind !== 'meaning');
    node.shared = new Set(incoming.map((edge) => edge.from)).size > 1;
    const kinds = new Set(incoming.map((edge) => edge.kind));
    node.lane = kinds.size > 1 ? 1 : kinds.has('antonym') ? 2 : 0;
  }
  const levels = Array.from({ length: 5 }, () => [] as GraphNodeT[]);
  for (const node of nodes.values()) {
    levels[node.kind === 'meaning' ? node.depth * 2 + 1 : node.depth * 2].push(node);
  }
  // Keep each meaning's words in its column. Shared words sit between their
  // parents; vertical packing prevents overlaps without moving them out of place.
  const parentsOf = (node: GraphNodeT) =>
    [...new Set(edges.filter((edge) => edge.to === node.id).map((edge) => edge.from))]
      .map((id) => nodes.get(id)!)
      .filter((parent) =>
        node.kind === 'meaning'
          ? parent.kind === 'word' && parent.depth === node.depth
          : parent.kind === 'meaning' && parent.depth === node.depth - 1,
      );
  let nextY = 70;
  for (const level of levels) {
    if (!level.length) continue;
    for (const node of level) {
      const parents = parentsOf(node);
      node.x = parents.length ? parents.reduce((sum, parent) => sum + parent.x, 0) / parents.length : 0;
      if (node.kind === 'meaning') {
        const siblings = level.filter((other) => parentsOf(other)[0]?.id === parents[0]?.id);
        node.x += (siblings.indexOf(node) - (siblings.length - 1) / 2) * 380;
      }
    }
    level.sort((a, b) => a.x - b.x || a.lane - b.lane);
    if (level[0].kind === 'meaning') {
      // Expanded neighbors can have overlapping meaning groups.
      for (let index = 1; index < level.length; index++) {
        level[index].x = Math.max(level[index].x, level[index - 1].x + 380);
      }
    }
    const rows: GraphNodeT[][] = [];
    for (const node of level) {
      let row = rows.findIndex((placed) => placed.every((other) => Math.abs(other.x - node.x) >= 180));
      if (row < 0) {
        row = rows.length;
        rows.push([]);
      }
      rows[row].push(node);
      node.y = nextY + row * 76;
    }
    nextY += rows.length * 76 + 100;
  }
  const minX = Math.min(...[...nodes.values()].map((node) => node.x - 102));
  const maxX = Math.max(...[...nodes.values()].map((node) => node.x + 102));
  const width = Math.max(480, maxX - minX + 100);
  for (const node of nodes.values()) node.x += (width - (maxX - minX)) / 2 - minX;
  return {
    nodes: [...nodes.values()],
    edges,
    direct: [...direct],
    truncated,
    width,
    height: nextY - 70,
  };
};
