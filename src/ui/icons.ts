const paths: Record<string, string> = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  settings: '<path d="M12 8v8M8 12h8"/><path d="m9.8 3.5.6-1h3.2l.6 1 1.1 2 2.2.1 1.2-.1 1.6 2.8-.6 1.1-1.1 1.9.9 2 .6 1.1-1.6 2.8-1.2.1-2.2.1-1.1 2-.6 1h-3.2l-.6-1-1.1-2-2.2-.1-1.2-.1-1.6-2.8.6-1.1.9-2-1.1-1.9-.6-1.1 1.6-2.8 1.2.1 2.2-.1 1.1-2Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16.5v.1"/>',
  view: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  opacity: '<path d="M12 2s7 8.2 7 13a7 7 0 0 1-14 0c0-4.8 7-13 7-13Z"/><path d="M12 7v14M12 15h6"/>',
  center: '<path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5"/><path d="M8 12h8M12 8v8"/>',
  isolate: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/><path d="m12 7 4 2v6l-4 2-4-2V9l4-2Z"/>',
  multi: '<rect x="7" y="7" width="14" height="14" rx="2"/><path d="M3 15V5a2 2 0 0 1 2-2h10M10.5 14l2.5 2.5 5-5"/>',
  hide: '<path d="m3 3 18 18M9.5 5.3A12.5 12.5 0 0 1 12 5c6.5 0 10 7 10 7a17.1 17.1 0 0 1-3 4M6 6.5A19.5 19.5 0 0 0 2 12s3.5 7 10 7a12.5 12.5 0 0 0 5-1M10 10a3 3 0 0 0 4 4"/>',
  undo: '<path d="M8 4 3 9l5 5M3 9h10a7 7 0 0 1 0 14" transform="translate(0 -2)"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2.5 8M3 4v6h6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  arrow: '<path d="m8 4 8 8-8 8"/>',
  rotate: '<path d="M5 7a8 8 0 1 1-1 9M5 2v5h5"/>',
  touch: '<path d="M9 11V5a2 2 0 0 1 4 0v6M13 8a2 2 0 0 1 4 0v4M17 10a2 2 0 0 1 4 0v6a6 6 0 0 1-6 6h-2c-3 0-4-2-5-4l-4-5a2 2 0 0 1 3-2l2 2"/>',
  zoom: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6M10 7v6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  warning: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 17v.1"/>',
  book: '<path d="M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2v16"/>',
  focus: '<circle cx="12" cy="12" r="6"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  organs: '<path d="M12 7C9 1 2 4 3 10c1 4 5 7 9 11 4-4 8-7 9-11 1-6-6-9-9-3Z"/><path d="m6 11 3 0 2-3 2 7 2-4h3"/>',
  skin: '<circle cx="12" cy="4" r="2.2"/><path d="M8 8h8l3 6-2 1-2-4v10h-2v-6h-2v6H9V11l-2 4-2-1 3-6Z"/>',
  bone: '<path d="M7 5a3 3 0 0 0-5 2 3 3 0 0 0 2 5l8 8a3 3 0 0 0 5 2 3 3 0 0 0 5-5l-8-8a3 3 0 0 0-2-5 3 3 0 0 0-5 1Z"/>',
  muscle: '<path d="m6 4 2 2c1 1 3 0 4 1l5 5c1 1 0 3 1 4l2 2M4 6l2 2c1 1 0 3 1 4l5 5c1 1 3 0 4 1l2 2M9 8l7 7M8 10l6 6M3 3l3 1-2 2-1-3ZM21 21l-3-1 2-2 1 3Z"/>',
  nerve: '<path d="M12 2v20M12 6 6 3M12 10l7-5M12 13l-8 3M12 18l6 3M6 3l-2 3M6 3 8 2M19 5l2 3M19 5l1-3M4 16l-1-3M4 16l2 4M18 21l3-1"/>',
  connective: '<path d="m4 5 15 14M5 4l14 15M3 6l15 15M6 3l15 15M10 5 5 10M15 10l-5 5M20 15l-5 5"/>',
};

export function icon(name: string, className = ''): string {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.view}</svg>`;
}
