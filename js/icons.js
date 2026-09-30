const Icons = {
  wrap(inner) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  },
  home() {
    return this.wrap('<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/><path d="M10 20v-6h4v6"/>');
  },
  tasks() {
    return this.wrap('<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.3 2.3 4.7-4.9"/>');
  },
  notes() {
    return this.wrap('<path d="M7 3.5h7.5L18 7v13a.9.9 0 0 1-.9.9H7A.9.9 0 0 1 6.1 20V4.4A.9.9 0 0 1 7 3.5Z"/><path d="M14 3.5V7h4"/><path d="M9 12h6M9 15.5h6M9 8.5h2"/>');
  },
  focus() {
    return this.wrap('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.8 1.6"/><path d="M9.5 3h5"/>');
  },
  habits() {
    return this.wrap('<path d="M12 3.5c1.2 2.4 3.6 3.8 3.6 7a4 4 0 0 1-3 3.87A2.6 2.6 0 0 0 12 12c-.9 1-1.3 1.9-1.3 2.9A4 4 0 0 1 7.6 11c0-1.6.7-2.6 1.4-3.6-.2 1 0 1.8.6 2.3.2-2.7 1-4.2 2.4-6.2Z"/>');
  },
  settings() {
    return this.wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.4-2-3.4-2.2.7a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.4a7.6 7.6 0 0 0-2.6 1.5l-2.2-.7-2 3.4L4.6 10.5a7.6 7.6 0 0 0 0 3L2.7 15l2 3.4 2.2-.7c.75.66 1.63 1.16 2.6 1.5l.5 2.4h4l.5-2.4a7.6 7.6 0 0 0 2.6-1.5l2.2.7 2-3.4Z"/>');
  },
  check() {
    return this.wrap('<path d="m5 12.5 4.5 4.5L19 7"/>');
  },
  trash() {
    return this.wrap('<path d="M4.5 7h15"/><path d="M9.5 7V4.8c0-.44.36-.8.8-.8h3.4c.44 0 .8.36.8.8V7"/><path d="M6.5 7 7.3 19a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5L17.5 7"/><path d="M10.3 11v6M13.7 11v6"/>');
  },
  plus() {
    return this.wrap('<path d="M12 5v14M5 12h14"/>');
  },
  close() {
    return this.wrap('<path d="m6 6 12 12M18 6 6 18"/>');
  },
  search() {
    return this.wrap('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.8-3.8"/>');
  },
  arrowRight() {
    return this.wrap('<path d="M4.5 12h15"/><path d="m13.5 6 6 6-6 6"/>');
  },
  bolt() {
    return this.wrap('<path d="M12.5 3 5 13.5h5.5L11 21l7.5-10.5H13z"/>');
  },
  download() {
    return this.wrap('<path d="M12 3.5v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 18.5h14"/>');
  },
  upload() {
    return this.wrap('<path d="M12 15.5v-11"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M5 18.5h14"/>');
  },
  sparkles() {
    return this.wrap('<path d="M12 3.5 13.4 8 18 9.4 13.4 10.8 12 15.3 10.6 10.8 6 9.4l4.6-1.4Z"/><path d="M18.5 15.5 19.2 17.6 21.2 18.3 19.2 19 18.5 21 17.8 19 15.8 18.3 17.8 17.6Z"/>');
  },
  planen() {
    return this.wrap('<rect x="4" y="5" width="16" height="15" rx="2.2"/><path d="M4 9.5h16"/><path d="M8.3 3.2v3.6M15.7 3.2v3.6"/><path d="M8 13h3M8 16.3h6"/>');
  },
  fitness() {
    return this.wrap('<path d="M6.5 9.5v5"/><path d="M17.5 9.5v5"/><path d="M3.5 11v2.5"/><path d="M20.5 11v2.5"/><path d="M6.5 12h11"/>');
  },
  weight() {
    return this.wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M8.5 12h7"/>');
  },
  flame() {
    return this.wrap('<path d="M12 3.5c1.2 2.4 3.6 3.8 3.6 7a4 4 0 0 1-3 3.87A2.6 2.6 0 0 0 12 12c-.9 1-1.3 1.9-1.3 2.9A4 4 0 0 1 7.6 11c0-1.6.7-2.6 1.4-3.6-.2 1 0 1.8.6 2.3.2-2.7 1-4.2 2.4-6.2Z"/>');
  },
  trophy() {
    return this.wrap('<path d="M7 4h10v4.2a5 5 0 0 1-10 0Z"/><path d="M7 5.5H4v1.3A3.5 3.5 0 0 0 7 10.2"/><path d="M17 5.5h3v1.3a3.5 3.5 0 0 1-3 3.4"/><path d="M12 13.5v3"/><path d="M8.5 20h7"/><path d="M9.5 16.5h5l.6 3.5h-6.2Z"/>');
  },
  chevronUp() {
    return this.wrap('<path d="m6 14.5 6-6 6 6"/>');
  },
  chevronDown() {
    return this.wrap('<path d="m6 9.5 6 6 6-6"/>');
  },
  copy() {
    return this.wrap('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6.8A1.8 1.8 0 0 0 13.2 5H6.8A1.8 1.8 0 0 0 5 6.8v6.4A1.8 1.8 0 0 0 6.8 15H9"/>');
  },
  grip() {
    return this.wrap('<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3"/>');
  },
  chevronLeft() {
    return this.wrap('<path d="m14.5 6-6 6 6 6"/>');
  },
};
