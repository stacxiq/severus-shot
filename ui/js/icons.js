// Interface icons: simple 24×24 line drawings, coloured by the surrounding text colour.
const P = {
  new: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M12 12v6 M9 15h6',
  open: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  save: 'M5 3h11l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M8 3v5h7V3 M7 21v-7h10v7',
  undo: 'M9 14 4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
  text: 'M5 6V4h14v2 M12 4v16 M9 20h6',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M11 5h2',
  image: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M3 16l5-5 4 4 3-3 6 6 M15 9h.01',
  shape: 'M3 9a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M13 13h8v8h-8z',
  export: 'M12 15V3 M7 8l5-5 5 5 M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  agents: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z',
  plus: 'M12 5v14 M5 12h14',
  copy: 'M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z M5 15V5a2 2 0 0 1 2-2h8',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 11h18',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  sticker: 'M12 3a9 9 0 1 0 9 9c0-.3 0-.6-.05-.9L13 21 M21 11.100A9 9 0 0 0 12.900 3 M9 10h.01 M15 10h.01 M8.500 14.500c1 1.300 2.200 2 3.500 2s2.500-.700 3.500-2',
  play: 'M7 4.500v15l12-7.500z',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14 M20 20l-4-4',
  star: 'M12 3l2.700 5.600 6.100.900-4.400 4.300 1 6.100L12 17l-5.400 2.900 1-6.100L3.200 9.500l6.100-.900z',
  type: 'M4 7V5h16v2 M9 19h6 M12 5v14',
  keyboard: 'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z M6 10h.01 M10 10h.01 M14 10h.01 M18 10h.01 M7 14h10',
  check: 'M5 12.500l4.500 4.500L19 7.500',
  download: 'M12 4v11 M7 11l5 5 5-5 M5 20h14',
  pause: 'M8 5v14 M16 5v14',
  volume: 'M4 10v4h3l5 4V6L7 10z M16 9a4 4 0 0 1 0 6 M18.500 6.500a8 8 0 0 1 0 11',
  music: 'M9 18V6l10-2v12 M9 18a2.500 2.500 0 1 1-5 0a2.500 2.500 0 0 1 5 0 M19 16a2.500 2.500 0 1 1-5 0a2.500 2.500 0 0 1 5 0',
  globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18 M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
};

export function icon(name) {
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[name] || ''}"/></svg>`;
}

// Fills every element that has data-icon="name" with its drawing, keeping any label after it.
export function applyIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    if (!el.querySelector('svg.ic')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  }
}
