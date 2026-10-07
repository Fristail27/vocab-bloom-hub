import type { GraphNodeT, WordGraphT } from '@/core/wordGraph';

export type ViewT = { scale: number; x: number; y: number };
export type PaletteT = {
  bg: string;
  dark: boolean;
  fg: string;
  muted: string;
  border: string;
  accent: string;
  surface: string;
  synonym: string;
  synonymBg: string;
  antonym: string;
  antonymBg: string;
  shared: string;
};
export const nodeWidth = (node: GraphNodeT): number => (node.kind === 'meaning' ? 204 : 158);
export const nodeHeight = (node: GraphNodeT): number => (node.kind === 'meaning' ? 46 : 36);

// Cool hues distinguish meanings without borrowing the green/red relation accents.
const meaningColors = (tone: number, dark: boolean) => {
  const hue = 195 + ((tone * 49.654) % 130);
  return {
    ink: `hsl(${hue} 65% ${dark ? 78 : 35}%)`,
    line: `hsl(${hue} 65% ${dark ? 68 : 48}%)`,
    fill: `hsl(${hue} ${dark ? 35 : 80}% ${dark ? 21 : 94}%)`,
  };
};

const shortened = (context: CanvasRenderingContext2D, text: string, width: number): string => {
  if (context.measureText(text).width <= width) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (context.measureText(`${text.slice(0, middle)}…`).width <= width) low = middle;
    else high = middle - 1;
  }
  return `${text.slice(0, low)}…`;
};

export const drawGraph = (
  context: CanvasRenderingContext2D,
  graph: WordGraphT,
  view: ViewT,
  selected: string,
  palette: PaletteT,
  width: number,
  height: number,
) => {
  context.clearRect(0, 0, width, height);
  context.fillStyle = palette.bg;
  context.fillRect(0, 0, width, height);
  context.fillStyle = palette.border;
  for (let x = 16; x < width; x += 24) {
    for (let y = 16; y < height; y += 24) {
      context.beginPath();
      context.arc(x, y, 0.7, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.save();
  context.translate(view.x, view.y);
  context.scale(view.scale, view.scale);
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const wordTones = new Map<string, Set<number>>();
  const connected = new Set([selected]);
  for (const edge of graph.edges) {
    if (edge.kind !== 'meaning') {
      const tones = wordTones.get(edge.to) ?? new Set<number>();
      tones.add(byId.get(edge.from)?.tone ?? 0);
      wordTones.set(edge.to, tones);
    }
    if (edge.from === selected) connected.add(edge.to);
    if (edge.to === selected) connected.add(edge.from);
  }
  for (const edge of graph.edges) {
    const from = byId.get(edge.from)!;
    const to = byId.get(edge.to)!;
    const focused = !selected || edge.from === selected || edge.to === selected;
    context.globalAlpha = focused ? 0.85 : 0.12;
    const meaning = edge.kind === 'meaning' ? to : from;
    context.strokeStyle = meaningColors(meaning.tone ?? 0, palette.dark).line;
    context.lineWidth = focused && selected ? 3 : edge.kind === 'meaning' ? 1.5 : 2;
    context.setLineDash(edge.kind === 'antonym' ? [6, 5] : []);
    const reverse = to.y <= from.y;
    const startY = from.y + nodeHeight(from) / 2;
    const endY = to.y - nodeHeight(to) / 2;
    context.beginPath();
    context.moveTo(from.x, startY);
    if (reverse) {
      const side = Math.max(from.x + nodeWidth(from) / 2, to.x + nodeWidth(to) / 2) + 65;
      context.bezierCurveTo(side, startY + 55, side, endY - 55, to.x, endY);
    } else {
      const gap = (endY - startY) * 0.55;
      context.bezierCurveTo(from.x, startY + gap, to.x, endY - gap, to.x, endY);
    }
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = context.strokeStyle;
    context.beginPath();
    context.arc(to.x, endY, 2.5, 0, Math.PI * 2);
    context.fill();
  }
  for (const node of graph.nodes) {
    const w = nodeWidth(node);
    const h = nodeHeight(node);
    const root = node.kind === 'word' && node.depth === 0;
    const active = node.id === selected;
    context.globalAlpha = !selected || connected.has(node.id) ? 1 : 0.35;
    if (node.shared || active) {
      context.strokeStyle = active ? palette.accent : palette.shared;
      context.lineWidth = active ? 2 : 1.5;
      context.beginPath();
      context.roundRect(node.x - w / 2 - 5, node.y - h / 2 - 5, w + 10, h + 10, 14);
      context.stroke();
    }
    const meaning = node.kind === 'meaning' ? meaningColors(node.tone ?? 0, palette.dark) : undefined;
    const related = node.kind !== 'meaning' && !root;
    const bands = (colors: string[]) => {
      if (colors.length === 1) return colors[0];
      const gradient = context.createLinearGradient(node.x - w / 2, node.y, node.x + w / 2, node.y);
      colors.forEach((color, index) => {
        gradient.addColorStop(index / colors.length, color);
        gradient.addColorStop((index + 1) / colors.length, color);
      });
      return gradient;
    };
    const tones = [...(wordTones.get(node.id) ?? [])].sort((a, b) => a - b);
    const inheritedFills = tones.map((tone) => meaningColors(tone, palette.dark).fill);
    const inheritedAccents = tones.flatMap((tone) => {
      const kinds = new Set(
        graph.edges
          .filter((edge) => edge.to === node.id && byId.get(edge.from)?.tone === tone)
          .map((edge) => edge.kind),
      );
      return [...kinds].sort().map((kind) => {
        if (kind === 'translation') return meaningColors(tone, palette.dark).ink;
        const accent = kind === 'antonym' ? palette.antonym : palette.synonym;
        // Keep the relation recognizable while tinting its text and outline by meaning.
        return `color-mix(in srgb, ${accent} 65%, ${meaningColors(tone, palette.dark).ink})`;
      });
    });
    context.fillStyle = root
      ? palette.accent
      : related && inheritedFills.length
        ? bands(inheritedFills)
        : (meaning?.fill ?? palette.surface);
    context.strokeStyle = root
      ? palette.accent
      : related && inheritedAccents.length
        ? bands(inheritedAccents)
        : (meaning?.line ?? palette.border);
    context.lineWidth = related || meaning ? 1.8 : 1;
    context.beginPath();
    context.roundRect(node.x - w / 2, node.y - h / 2, w, h, node.kind === 'meaning' ? 9 : 18);
    context.fill();
    context.stroke();
    context.fillStyle = root
      ? palette.bg
      : related && inheritedAccents.length
        ? bands(inheritedAccents)
        : (meaning?.ink ?? palette.fg);
    context.font = `${node.kind !== 'meaning' ? '600' : '400'} ${Math.max(13, 11 / view.scale)}px system-ui, sans-serif`;
    context.direction = node.language === 'ar' ? 'rtl' : 'ltr';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(shortened(context, node.label, w - 24), node.x, node.y);
    if (node.shared) {
      context.fillStyle = palette.shared;
      context.beginPath();
      context.arc(node.x + w / 2 - 2, node.y - h / 2 + 2, 4, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
};

export const hitNode = (graph: WordGraphT, view: ViewT, x: number, y: number): GraphNodeT | undefined => {
  const gx = (x - view.x) / view.scale;
  const gy = (y - view.y) / view.scale;
  return graph.nodes.find(
    (node) => Math.abs(gx - node.x) <= nodeWidth(node) / 2 && Math.abs(gy - node.y) <= nodeHeight(node) / 2,
  );
};
