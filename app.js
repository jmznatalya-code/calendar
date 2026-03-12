/* Lightweight Calendar PWA — no dependencies */
'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── State ──────────────────────────────────────────────────────────────────
const now = new Date();
const state = {
  view: 'month',
  year: now.getFullYear(),
  month: now.getMonth(),   // 0-based
  day: now.getDate(),
  events: loadEvents(),
};

// ── Helpers ────────────────────────────────────────────────────────────────
function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstDow(y, m) { return new Date(y, m, 1).getDay(); }
function pad(n) { return String(n).padStart(2, '0'); }
function isToday(y, m, d) {
  return y === now.getFullYear() && m === now.getMonth() && d === now.getDate();
}
function dateKey(y, m, d) { return `${y}-${pad(m+1)}-${pad(d)}`; }
function getWeekStart(y, m, d) {
  const dt = new Date(y, m, d);
  dt.setDate(dt.getDate() - dt.getDay());
  return dt;
}

// ── Event persistence ──────────────────────────────────────────────────────
function loadEvents() {
  try { return JSON.parse(localStorage.getItem('cal_events') || '{}'); } catch { return {}; }
}
function saveEvents() { localStorage.setItem('cal_events', JSON.stringify(state.events)); }
function getEvents(y, m, d) { return state.events[dateKey(y, m, d)] || []; }

// ── Render helpers ─────────────────────────────────────────────────────────
const container = document.getElementById('view-container');
const titleEl = document.getElementById('header-title');

function setTitle(text) { titleEl.textContent = text; }

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// ── Month View ─────────────────────────────────────────────────────────────
function renderMonth() {
  const { year: y, month: m } = state;
  setTitle(`${MONTHS[m]} ${y}`);

  const frag = document.createDocumentFragment();
  const wrap = el('div', 'month-view');

  const dowRow = el('div', 'month-dow-row');
  DAYS.forEach(d => { dowRow.appendChild(el('span', '', d)); });
  wrap.appendChild(dowRow);

  const grid = el('div', 'month-grid');
  const start = firstDow(y, m);
  const total = daysInMonth(y, m);

  // Prev month tail
  const prevTotal = daysInMonth(y, m - 1 < 0 ? 11 : m - 1);
  for (let i = 0; i < start; i++) {
    const d = prevTotal - start + 1 + i;
    const pm = m - 1 < 0 ? 11 : m - 1;
    const py = m - 1 < 0 ? y - 1 : y;
    grid.appendChild(makeMonthCell(py, pm, d, true));
  }

  for (let d = 1; d <= total; d++) {
    grid.appendChild(makeMonthCell(y, m, d, false));
  }

  // Next month head
  const remaining = 42 - start - total;
  for (let d = 1; d <= remaining; d++) {
    const nm = m + 1 > 11 ? 0 : m + 1;
    const ny = m + 1 > 11 ? y + 1 : y;
    grid.appendChild(makeMonthCell(ny, nm, d, true));
  }

  wrap.appendChild(grid);
  frag.appendChild(wrap);
  container.innerHTML = '';
  container.appendChild(frag);
}

function makeMonthCell(y, m, d, other) {
  const dow = new Date(y, m, d).getDay();
  const weekend = dow === 0 || dow === 6;
  const today = isToday(y, m, d);
  const evs = getEvents(y, m, d);

  let cls = 'month-cell';
  if (other) cls += ' other-month';
  if (weekend && !other) cls += ' weekend';
  if (today) cls += ' today';

  const cell = el('div', cls);
  const num = el('div', 'day-num', String(d));
  cell.appendChild(num);

  if (evs.length) {
    const dot = el('div', 'event-dot');
    evs.slice(0, 3).forEach(() => dot.appendChild(el('span')));
    cell.appendChild(dot);
    evs.slice(0, 2).forEach(ev => {
      const chip = el('div', 'ev-chip', escHtml(ev.title));
      cell.appendChild(chip);
    });
  }

  cell.addEventListener('click', () => showDayModal(y, m, d));
  return cell;
}

// ── Week View ──────────────────────────────────────────────────────────────
function renderWeek() {
  const ws = getWeekStart(state.year, state.month, state.day);
  const we = new Date(ws); we.setDate(we.getDate() + 6);
  setTitle(
    ws.getMonth() === we.getMonth()
      ? `${MONTHS_SHORT[ws.getMonth()]} ${ws.getFullYear()}`
      : `${MONTHS_SHORT[ws.getMonth()]} – ${MONTHS_SHORT[we.getMonth()]} ${ws.getFullYear()}`
  );

  const frag = document.createDocumentFragment();
  const wrap = el('div', 'week-view');

  // Header row
  const header = el('div', 'week-header');
  header.appendChild(el('div')); // gutter

  for (let i = 0; i < 7; i++) {
    const dt = new Date(ws); dt.setDate(dt.getDate() + i);
    const todayCls = isToday(dt.getFullYear(), dt.getMonth(), dt.getDate()) ? ' today' : '';
    const hc = el('div', 'week-header-cell' + todayCls);
    hc.innerHTML = `<div class="dow">${DAYS[dt.getDay()]}</div><div class="wdate">${dt.getDate()}</div>`;
    hc.addEventListener('click', () => {
      state.year = dt.getFullYear(); state.month = dt.getMonth(); state.day = dt.getDate();
      switchView('day');
    });
    header.appendChild(hc);
  }
  wrap.appendChild(header);

  // Scrollable time grid
  const scroll = el('div', 'week-scroll');
  const grid = el('div', 'week-grid');

  const timeCol = el('div', 'week-time-col');
  for (let h = 0; h < 24; h++) {
    timeCol.appendChild(el('div', 'week-time-label', h === 0 ? '' : `${h}:00`));
  }
  grid.appendChild(timeCol);

  for (let i = 0; i < 7; i++) {
    const dt = new Date(ws); dt.setDate(dt.getDate() + i);
    const dayCol = el('div', 'week-day-col');

    // Now line
    if (isToday(dt.getFullYear(), dt.getMonth(), dt.getDate())) {
      const pct = (now.getHours() * 60 + now.getMinutes()) / 1440;
      const line = el('div', 'week-now-line');
      line.style.top = `${pct * 100}%`;
      dayCol.appendChild(line);
    }

    // Events as blocks
    const evs = getEvents(dt.getFullYear(), dt.getMonth(), dt.getDate());
    evs.forEach(ev => {
      if (!ev.time) return;
      const [h, min] = ev.time.split(':').map(Number);
      const top = ((h * 60 + min) / 1440) * 100;
      const blk = el('div', 'ev-block', escHtml(ev.title));
      blk.style.top = `${top}%`;
      blk.style.height = '32px';
      dayCol.appendChild(blk);
    });

    for (let h = 0; h < 24; h++) {
      dayCol.appendChild(el('div', 'week-hour-cell'));
    }
    grid.appendChild(dayCol);
  }

  scroll.appendChild(grid);
  wrap.appendChild(scroll);
  frag.appendChild(wrap);
  container.innerHTML = '';
  container.appendChild(frag);
  scrollToCurrentHour(scroll);
}

// ── Day View ───────────────────────────────────────────────────────────────
function renderDay() {
  const { year: y, month: m, day: d } = state;
  const dt = new Date(y, m, d);
  setTitle(`${DAYS[dt.getDay()]}, ${MONTHS_SHORT[m]} ${d}, ${y}`);

  const evs = getEvents(y, m, d);
  const allDay = evs.filter(ev => !ev.time);
  const timed = evs.filter(ev => ev.time);

  const frag = document.createDocumentFragment();
  const wrap = el('div', 'day-view');

  if (allDay.length) {
    const ad = el('div', 'day-allday');
    allDay.forEach(ev => {
      ad.appendChild(el('div', 'ev-chip', `&#9679; ${escHtml(ev.title)}`));
    });
    wrap.appendChild(ad);
  }

  const scroll = el('div', 'day-scroll');
  const grid = el('div', 'day-grid');

  for (let h = 0; h < 24; h++) {
    grid.appendChild(el('div', 'day-time-label', h === 0 ? '' : `${h}:00`));
    const hcell = el('div', 'day-hour-cell');

    // Now line
    if (isToday(y, m, d) && now.getHours() === h) {
      const line = el('div', 'day-now-line');
      line.style.top = `${(now.getMinutes() / 60) * 100}%`;
      hcell.appendChild(line);
    }

    // Timed events
    timed.filter(ev => parseInt(ev.time) === h).forEach(ev => {
      const blk = el('div', 'ev-block', `<b>${ev.time}</b> ${escHtml(ev.title)}`);
      blk.style.top = `${((parseInt(ev.time.split(':')[1] || 0)) / 60) * 100}%`;
      blk.style.height = '44px';
      hcell.appendChild(blk);
    });

    grid.appendChild(hcell);
  }

  scroll.appendChild(grid);
  wrap.appendChild(scroll);
  frag.appendChild(wrap);
  container.innerHTML = '';
  container.appendChild(frag);
  scrollToCurrentHour(scroll);
}

// ── Year View ──────────────────────────────────────────────────────────────
function renderYear() {
  const { year: y } = state;
  setTitle(String(y));

  const frag = document.createDocumentFragment();
  const wrap = el('div', 'year-view');

  for (let m = 0; m < 12; m++) {
    const mini = el('div', 'mini-month');
    mini.appendChild(el('div', 'mini-month-title', MONTHS_SHORT[m]));

    const mgrid = el('div', 'mini-month-grid');
    // DOW headers
    DAYS.forEach(d => { mgrid.appendChild(el('div', 'mini-day head', d[0])); });

    const fd = firstDow(y, m);
    const tot = daysInMonth(y, m);
    for (let i = 0; i < fd; i++) mgrid.appendChild(el('div', 'mini-day other'));
    for (let d = 1; d <= tot; d++) {
      const today = isToday(y, m, d);
      mgrid.appendChild(el('div', today ? 'mini-day today' : 'mini-day', String(d)));
    }

    mini.appendChild(mgrid);
    mini.addEventListener('click', () => {
      state.month = m;
      switchView('month');
    });
    wrap.appendChild(mini);
  }

  frag.appendChild(wrap);
  container.innerHTML = '';
  container.appendChild(frag);
}

// ── Scroll to current hour ─────────────────────────────────────────────────
function scrollToCurrentHour(scrollEl) {
  const h = now.getHours();
  const target = Math.max(0, h - 2) * 48;
  requestAnimationFrame(() => { scrollEl.scrollTop = target; });
}

// ── Navigation ─────────────────────────────────────────────────────────────
function navigate(dir) {
  switch (state.view) {
    case 'month':
      state.month += dir;
      if (state.month > 11) { state.month = 0; state.year++; }
      if (state.month < 0) { state.month = 11; state.year--; }
      break;
    case 'week': {
      const ws = getWeekStart(state.year, state.month, state.day);
      ws.setDate(ws.getDate() + dir * 7);
      state.year = ws.getFullYear(); state.month = ws.getMonth(); state.day = ws.getDate();
      break;
    }
    case 'day': {
      const dt = new Date(state.year, state.month, state.day + dir);
      state.year = dt.getFullYear(); state.month = dt.getMonth(); state.day = dt.getDate();
      break;
    }
    case 'year':
      state.year += dir;
      break;
  }
  render();
}

function goToday() {
  state.year = now.getFullYear(); state.month = now.getMonth(); state.day = now.getDate();
  render();
}

// ── View switching ─────────────────────────────────────────────────────────
function switchView(v) {
  state.view = v;
  document.querySelectorAll('#view-nav button').forEach(btn => {
    btn.setAttribute('aria-selected', btn.dataset.view === v ? 'true' : 'false');
  });
  render();
}

function render() {
  switch (state.view) {
    case 'month': renderMonth(); break;
    case 'week':  renderWeek();  break;
    case 'day':   renderDay();   break;
    case 'year':  renderYear();  break;
  }
}

// ── Day Modal ──────────────────────────────────────────────────────────────
function showDayModal(y, m, d) {
  const evs = getEvents(y, m, d);
  const dt = new Date(y, m, d);

  const backdrop = el('div', 'modal-backdrop');
  const modal = el('div', 'modal');

  modal.innerHTML = `<div class="modal-handle"></div>
    <h2>${DAYS[dt.getDay()]}, ${MONTHS[m]} ${d}</h2>
    <div class="modal-date">${y}</div>`;

  const evList = el('div', 'modal-events');
  if (evs.length === 0) {
    evList.appendChild(el('div', 'modal-empty', 'No events'));
  } else {
    evs.forEach((ev, idx) => {
      const item = el('div', 'modal-ev');
      const info = el('div', 'modal-ev-info');
      info.innerHTML = `<div class="modal-ev-time">${ev.time || 'All day'}</div>
        <div class="modal-ev-title">${escHtml(ev.title)}</div>`;
      const actions = el('div', 'modal-ev-actions');
      const editBtn = el('button', 'modal-ev-btn', 'edit');
      editBtn.addEventListener('click', () => { backdrop.remove(); showEditEvent(y, m, d, idx); });
      const delBtn = el('button', 'modal-ev-btn del', 'del');
      delBtn.addEventListener('click', () => { deleteEvent(y, m, d, idx); backdrop.remove(); showDayModal(y, m, d); });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      item.appendChild(info);
      item.appendChild(actions);
      evList.appendChild(item);
    });
  }
  modal.appendChild(evList);

  const addBtn = el('button', 'modal-btn primary', '+ Add Event');
  addBtn.addEventListener('click', () => { backdrop.remove(); showAddEvent(y, m, d); });
  modal.appendChild(addBtn);

  const closeBtn = el('button', 'modal-btn', 'Close');
  closeBtn.addEventListener('click', () => backdrop.remove());
  modal.appendChild(closeBtn);

  backdrop.appendChild(modal);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

function showAddEvent(y, m, d) {
  const backdrop = el('div', 'modal-backdrop');
  const modal = el('div', 'modal');
  const dt = new Date(y, m, d);

  modal.innerHTML = `<div class="modal-handle"></div>
    <h2>New Event</h2>
    <div class="modal-date">${DAYS[dt.getDay()]}, ${MONTHS[m]} ${d}, ${y}</div>
    <div class="modal-form">
      <input id="ev-title" type="text" class="modal-input" placeholder="Event title">
      <input id="ev-time" type="time" class="modal-input">
    </div>`;

  const saveBtn = el('button', 'modal-btn primary', 'Save');
  saveBtn.addEventListener('click', () => {
    const title = modal.querySelector('#ev-title').value.trim();
    if (!title) return;
    const time = modal.querySelector('#ev-time').value;
    const key = dateKey(y, m, d);
    if (!state.events[key]) state.events[key] = [];
    state.events[key].push({ title, time });
    saveEvents();
    backdrop.remove();
    render();
  });
  modal.appendChild(saveBtn);

  const cancelBtn = el('button', 'modal-btn', 'Cancel');
  cancelBtn.addEventListener('click', () => backdrop.remove());
  modal.appendChild(cancelBtn);

  backdrop.appendChild(modal);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  setTimeout(() => modal.querySelector('#ev-title').focus(), 100);
}

function showEditEvent(y, m, d, idx) {
  const key = dateKey(y, m, d);
  const ev = (state.events[key] || [])[idx];
  if (!ev) return;

  const backdrop = el('div', 'modal-backdrop');
  const modal = el('div', 'modal');
  const dt = new Date(y, m, d);

  modal.innerHTML = `<div class="modal-handle"></div>
    <h2>Edit Event</h2>
    <div class="modal-date">${DAYS[dt.getDay()]}, ${MONTHS[m]} ${d}, ${y}</div>
    <div class="modal-form">
      <input id="ev-title" type="text" class="modal-input" placeholder="Event title" value="${escHtml(ev.title)}">
      <input id="ev-time" type="time" class="modal-input" value="${ev.time || ''}">
    </div>`;

  const saveBtn = el('button', 'modal-btn primary', 'Save');
  saveBtn.addEventListener('click', () => {
    const title = modal.querySelector('#ev-title').value.trim();
    if (!title) return;
    const time = modal.querySelector('#ev-time').value;
    state.events[key][idx] = { title, time };
    saveEvents();
    backdrop.remove();
    render();
  });
  modal.appendChild(saveBtn);

  const cancelBtn = el('button', 'modal-btn', 'Cancel');
  cancelBtn.addEventListener('click', () => { backdrop.remove(); showDayModal(y, m, d); });
  modal.appendChild(cancelBtn);

  backdrop.appendChild(modal);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  setTimeout(() => modal.querySelector('#ev-title').focus(), 100);
}

function deleteEvent(y, m, d, idx) {
  const key = dateKey(y, m, d);
  if (!state.events[key]) return;
  state.events[key].splice(idx, 1);
  if (state.events[key].length === 0) delete state.events[key];
  saveEvents();
  render();
}

// ── Security ───────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Touch swipe ────────────────────────────────────────────────────────────
let touchX = null;
container.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
container.addEventListener('touchend', e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50) navigate(dx < 0 ? 1 : -1);
}, { passive: true });

// ── Event bindings ─────────────────────────────────────────────────────────
document.getElementById('btn-prev').addEventListener('click', () => navigate(-1));
document.getElementById('btn-next').addEventListener('click', () => navigate(1));
document.getElementById('btn-today').addEventListener('click', goToday);
document.querySelectorAll('#view-nav button').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ── Service Worker ─────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker registration failed:', err));
}

// ── Init ───────────────────────────────────────────────────────────────────
render();
