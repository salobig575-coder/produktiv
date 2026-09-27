const Charts = {
  line(points, opts = {}) {
    const width = opts.width || 320;
    const height = opts.height || 140;
    const padX = 10, padY = 14;
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;

    const coords = points.map((p, i) => {
      const x = padX + i * stepX;
      const y = padY + (1 - (p.value - min) / range) * (height - padY * 2);
      return { x, y, value: p.value, label: p.label };
    });

    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L${coords.at(-1).x.toFixed(1)},${height - padY} L${coords[0].x.toFixed(1)},${height - padY} Z`;
    const gid = 'lg' + Math.random().toString(36).slice(2, 8);

    const dots = coords.map((c, i) => {
      const isLast = i === coords.length - 1;
      return `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${isLast ? 5 : 3}" fill="${isLast ? `url(#${gid})` : 'var(--surface)'}" stroke="var(--accent)" stroke-width="2"/>`;
    }).join('');

    const wrap = App.el('div', { class: 'chart-wrap' });
    wrap.innerHTML = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:${height}px;overflow:visible">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color:var(--accent)"/>
          <stop offset="1" style="stop-color:var(--accent-2)"/>
        </linearGradient>
        <linearGradient id="${gid}area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style="stop-color:var(--accent);stop-opacity:.35"/>
          <stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#${gid}area)" class="chart-area"/>
      <path d="${linePath}" fill="none" stroke="url(#${gid})" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="chart-line"/>
      ${dots}
    </svg>`;

    if (opts.labels !== false && points.length > 1) {
      const labelRow = App.el('div', { class: 'row', style: 'justify-content:space-between;margin-top:2px' }, [
        App.el('span', { class: 'tag' }, points[0].label),
        App.el('span', { class: 'tag' }, points.at(-1).label),
      ]);
      wrap.appendChild(labelRow);
    }

    requestAnimationFrame(() => {
      const path = wrap.querySelector('.chart-line');
      if (!path) return;
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      path.getBoundingClientRect();
      path.style.transition = 'stroke-dashoffset 1s var(--ease)';
      path.style.strokeDashoffset = '0';
      const area = wrap.querySelector('.chart-area');
      if (area) { area.style.opacity = 0; area.style.transition = 'opacity 1s var(--ease) .2s'; requestAnimationFrame(() => { area.style.opacity = 1; }); }
    });

    return wrap;
  },

  bar(points, opts = {}) {
    const height = opts.height || 140;
    const max = Math.max(...points.map((p) => p.value), 1);
    const wrap = App.el('div', { class: 'bar-chart', style: `height:${height}px` });
    points.forEach((p, i) => {
      const pct = Math.max(2, (p.value / max) * 100);
      const col = App.el('div', { class: 'bar-col' }, [
        App.el('div', { class: 'bar-value' }, opts.formatValue ? opts.formatValue(p.value) : String(Math.round(p.value))),
        App.el('div', { class: 'bar-track' }, [
          App.el('div', { class: 'bar-fill', style: `height:0%`, 'data-target': pct + '%' }),
        ]),
        App.el('div', { class: 'bar-label' }, p.label),
      ]);
      wrap.appendChild(col);
    });
    requestAnimationFrame(() => {
      wrap.querySelectorAll('.bar-fill').forEach((el, i) => {
        setTimeout(() => { el.style.height = el.dataset.target; }, i * 40);
      });
    });
    return wrap;
  },
};
