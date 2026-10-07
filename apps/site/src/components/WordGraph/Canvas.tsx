'use client';

import React, { useEffect, useRef, useState } from 'react';

import type { WordGraphT } from '@/core/wordGraph';

import { drawGraph, hitNode, ViewT } from './draw';
import styles from './styles.module.scss';

type CanvasP = {
  graph: WordGraphT;
  selected: string;
  onSelect: (id: string) => void;
  label: string;
  zoomIn: string;
  zoomOut: string;
  reset: string;
};

export const GraphCanvas = ({ graph, selected, onSelect, label, zoomIn, zoomOut, reset }: CanvasP) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<ViewT>({ scale: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const paint = () => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      const context = element.getContext('2d');
      if (!context) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.round(width * dpr);
      element.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fit = Math.min((width - 32) / graph.width, (height - 32) / graph.height);
      const scale = fit * zoom;
      const view = {
        scale,
        x: (width - graph.width * scale) / 2 + pan.x,
        y: (height - graph.height * scale) / 2 + pan.y,
      };
      viewRef.current = view;
      const css = getComputedStyle(element);
      const color = (name: string) => css.getPropertyValue(name).trim();
      drawGraph(
        context,
        graph,
        view,
        selected,
        {
          bg: color('--bg'),
          dark: window.matchMedia('(prefers-color-scheme: dark)').matches,
          fg: color('--fg'),
          muted: color('--muted'),
          border: color('--border'),
          accent: color('--accent'),
          surface: color('--surface'),
          synonym: color('--graph-synonym'),
          synonymBg: color('--graph-synonym-bg'),
          antonym: color('--graph-antonym'),
          antonymBg: color('--graph-antonym-bg'),
          shared: color('--graph-shared'),
        },
        width,
        height,
      );
    };
    const observer = new ResizeObserver(paint);
    observer.observe(element);
    const theme = window.matchMedia('(prefers-color-scheme: dark)');
    theme.addEventListener('change', paint);
    paint();
    return () => {
      observer.disconnect();
      theme.removeEventListener('change', paint);
    };
  }, [graph, selected, zoom, pan]);

  const changeZoom = (factor: number) => setZoom((value) => Math.max(0.5, Math.min(8, value * factor)));
  return (
    <div className={styles.viewport}>
      <div className={styles.controls}>
        <button type="button" aria-label={zoomIn} onClick={() => changeZoom(1.4)}>
          +
        </button>
        <button type="button" aria-label={zoomOut} onClick={() => changeZoom(1 / 1.4)}>
          −
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          {reset}
        </button>
      </div>
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        className={styles.canvas}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          drag.current = { x: event.clientX, y: event.clientY, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const previous = drag.current;
          if (!previous) return;
          const dx = event.clientX - previous.x;
          const dy = event.clientY - previous.y;
          if (!previous.moved && Math.hypot(dx, dy) < 4) return;
          drag.current = { x: event.clientX, y: event.clientY, moved: true };
          setPan((value) => ({ x: value.x + dx, y: value.y + dy }));
        }}
        onPointerUp={(event) => {
          const previous = drag.current;
          drag.current = null;
          if (!previous || previous.moved) return;
          const box = event.currentTarget.getBoundingClientRect();
          const hit = hitNode(graph, viewRef.current, event.clientX - box.left, event.clientY - box.top);
          onSelect(hit?.id ?? '');
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      />
    </div>
  );
};
