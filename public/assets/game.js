'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const STORAGE = 'karelia-puzzle-v1';
  let regions = [], selected = null, drag = null, hinted = null;
  let state = { placed: [], elapsed: 0, hints: 0, started: false, outlines: true };
  let lastTick = Date.now();
  const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const done = () => state.placed.length === regions.length;
  const say = text => { $('message').textContent = text; };
  const svgElement = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  };
  function save() { try { localStorage.setItem(STORAGE, JSON.stringify(state)); } catch (_) { /* Private browsing may disable storage. */ } }
  function restore() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE));
      if (!data || !Array.isArray(data.placed)) return;
      state.placed = [...new Set(data.placed.filter(id => regions.some(r => r.id === id)))];
      state.elapsed = Number.isSafeInteger(data.elapsed) && data.elapsed >= 0 ? data.elapsed : 0;
      state.hints = Number.isSafeInteger(data.hints) && data.hints >= 0 ? data.hints : 0;
      state.started = data.started === true || state.placed.length > 0;
      state.outlines = data.outlines !== false;
    } catch (_) { /* A damaged save should not stop a new game. */ }
  }
  function begin() { if (!state.started) { state.started = true; lastTick = Date.now(); save(); } }
  function tick() {
    const now = Date.now();
    if (state.started && !done() && !document.hidden && !document.querySelector('dialog[open]')) {
      const seconds = Math.floor((now - lastTick) / 1000);
      if (seconds > 0) { state.elapsed += seconds; lastTick += seconds * 1000; $('timer').textContent = formatTime(state.elapsed); save(); }
    } else lastTick = now;
  }
  function update() {
    $('count').textContent = state.placed.length;
    $('remaining').textContent = regions.length - state.placed.length;
    $('timer').textContent = formatTime(state.elapsed);
    $('progress').style.width = `${state.placed.length / regions.length * 100}%`;
    document.querySelector('.progress-track').setAttribute('aria-valuenow', state.placed.length);
    $('hint').disabled = done();
    $('outlines').checked = state.outlines;
    $('map').classList.toggle('no-outlines', !state.outlines);
    for (const region of regions) {
      const placed = state.placed.includes(region.id);
      region.target.classList.toggle('placed', placed);
      region.target.style.fill = placed ? region.color : '';
      region.target.setAttribute('aria-label', placed ? `${region.name}, на месте` : 'Место для детали');
      region.target.setAttribute('tabindex', placed ? '-1' : '0');
      region.card.classList.toggle('selected', selected === region.id);
      region.card.classList.toggle('placed', placed);
      region.card.disabled = placed;
      region.card.setAttribute('aria-pressed', selected === region.id ? 'true' : 'false');
      region.card.setAttribute('aria-label', placed ? `${region.name}, на месте` : region.name);
    }
    $('selection-note').textContent = selected ? `Выбрано: ${regions.find(r => r.id === selected).name}. Теперь укажите место на карте.` : done() ? 'Все 18 деталей дома. Карелия собрана!' : 'Можно и без перетаскивания: выберите деталь, затем её место.';
  }
  function clearHint() { if (hinted) hinted.classList.remove('hinted'); hinted = null; }
  function select(id) {
    if (state.placed.includes(id)) return;
    begin(); clearHint(); selected = id; update();
    say('Перетащите деталь или нажмите на её место на карте.');
  }
  function place(id) {
    if (state.placed.includes(id)) return;
    tick(); state.placed.push(id); selected = null; clearHint(); update(); save();
    say(`${regions.find(r => r.id === id).name} — на своём месте!`);
    if (done()) {
      $('win-summary').textContent = `18 деталей вместе. Ваше время — ${formatTime(state.elapsed)}. Подсказок: ${state.hints}.`;
      say('Карелия собрана. Спасибо за путешествие!');
      $('win-dialog').showModal();
    }
  }
  function attempt(targetId) {
    if (selected === null) { say('Сначала выберите деталь в списке.'); return; }
    if (targetId === selected) place(selected);
    else say('Пока не совпало. Попробуйте другое место — или возьмите подсказку.');
  }
  function hint() {
    if (done()) return;
    if (selected === null) select(regions.find(r => !state.placed.includes(r.id)).id);
    clearHint(); hinted = regions.find(r => r.id === selected).target;
    hinted.classList.add('hinted'); state.hints++; save();
    say('Нужное место подсвечено золотым. Перенесите туда выбранную деталь.');
  }
  function cancelDrag() {
    if (!drag) return;
    drag.ghost?.remove(); drag = null; document.body.classList.remove('dragging');
  }
  function startDrag(event, region) {
    if (event.button !== 0 || state.placed.includes(region.id) || drag) return;
    select(region.id);
    drag = { id: region.id, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, ghost: null };
    region.card.setPointerCapture(event.pointerId);
  }
  function moveDrag(event) {
    if (!drag || drag.pointer !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return;
    drag.moved = true;
    if (!drag.ghost) {
      const region = regions.find(r => r.id === drag.id), b = region.box;
      const scale = $('map').getScreenCTM().a;
      const ghost = svgElement('svg', { viewBox: `${b.x} ${b.y} ${b.width} ${b.height}`, class: 'drag-ghost', 'aria-hidden': 'true' });
      ghost.style.width = `${b.width * scale}px`; ghost.style.height = `${b.height * scale}px`;
      ghost.append(svgElement('path', { d: region.d, fill: region.color, stroke: '#527059', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
      document.body.append(ghost); drag.ghost = ghost;
      document.body.classList.add('dragging');
    }
    drag.ghost.style.left = `${event.clientX - parseFloat(drag.ghost.style.width) / 2}px`;
    drag.ghost.style.top = `${event.clientY - parseFloat(drag.ghost.style.height) / 2}px`;
  }
  function endDrag(event) {
    if (!drag || drag.pointer !== event.pointerId) return;
    if (drag.moved) {
      const r = regions.find(r => r.id === drag.id), b = r.box;
      const center = new DOMPoint(b.x + b.width / 2, b.y + b.height / 2).matrixTransform($('map').getScreenCTM());
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const tolerance = Math.max(16, Math.min(32, b.width * $('map').getScreenCTM().a * .25));
      if (target === r.target || Math.hypot(event.clientX - center.x, event.clientY - center.y) <= tolerance) place(r.id);
      else say('Пока не совпало. Деталь осталась в списке — попробуйте ещё раз.');
    }
    cancelDrag();
  }
  function shufflePieces() {
    const cards = regions.map(region => region.card);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    $('pieces').replaceChildren(...cards);
  }
  function reset() {
    cancelDrag(); clearHint(); selected = null;
    state = { placed: [], elapsed: 0, hints: 0, started: false, outlines: state.outlines };
    lastTick = Date.now();
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    shufflePieces(); update(); save(); $('pieces').scrollTop = 0; $('pieces').scrollLeft = 0;
    say('Новое путешествие. Начните с любой детали.');
  }
  function render() {
    $('pieces').replaceChildren();
    for (const r of regions) {
      r.target = svgElement('path', { d: r.d, class: 'target', 'data-region': r.id, role: 'button', tabindex: 0 });
      r.target.addEventListener('click', () => attempt(r.id));
      r.target.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); attempt(r.id); } });
      $('targets').append(r.target);
      const b = r.target.getBBox(); r.box = { x: b.x, y: b.y, width: b.width, height: b.height };
      const preview = svgElement('svg', { viewBox: `${b.x - 4} ${b.y - 4} ${b.width + 8} ${b.height + 8}`, 'aria-hidden': 'true' });
      preview.append(svgElement('path', { d: r.d, fill: r.color, stroke: '#657f6066', 'stroke-width': .7, 'vector-effect': 'non-scaling-stroke' }));
      const card = document.createElement('button'); card.className = 'piece'; card.dataset.region = r.id;
      const label = document.createElement('span'); label.className = 'piece-name'; label.textContent = r.name;
      card.append(preview, label); r.card = card;
      card.addEventListener('pointerdown', e => startDrag(e, r));
      // Pointer selection happens on pointerdown; click handles keyboard/assistive activation only.
      card.addEventListener('click', e => { if (e.detail === 0) select(r.id); });
      $('pieces').append(card);
    }
    shufflePieces();
    const b = $('targets').getBBox();
    $('map').setAttribute('viewBox', `${b.x - 25} ${b.y - 25} ${b.width + 50} ${b.height + 50}`);
    update();
    if (done()) say('Ваша собранная Карелия. Можно рассмотреть карту или начать заново.');
    else if (state.started) say('С возвращением! Ваше путешествие продолжается.');
  }
  async function init() {
    try {
      const response = await fetch('/assets/regions.json');
      if (!response.ok) throw new Error('Map unavailable');
      regions = await response.json();
      if (!Array.isArray(regions) || regions.length !== 18) throw new Error('Invalid map');
      restore(); render();
      document.addEventListener('pointermove', moveDrag);
      document.addEventListener('pointerup', endDrag);
      document.addEventListener('pointercancel', cancelDrag);
      window.addEventListener('blur', cancelDrag);
      window.addEventListener('resize', cancelDrag);
      document.addEventListener('keydown', e => { if (e.key === 'Escape') { cancelDrag(); selected = null; clearHint(); update(); } });
      $('hint').addEventListener('click', hint);
      $('outlines').addEventListener('change', e => { state.outlines = e.target.checked; update(); save(); });
      $('help').addEventListener('click', () => $('help-dialog').showModal());
      $('restart').addEventListener('click', () => $('restart-dialog').showModal());
      $('cancel-restart').addEventListener('click', () => $('restart-dialog').close());
      $('confirm-restart').addEventListener('click', reset);
      $('play-again').addEventListener('click', reset);
      document.querySelectorAll('.dialog-close, .dialog-close-action').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
      document.addEventListener('visibilitychange', () => { lastTick = Date.now(); cancelDrag(); save(); });
      window.addEventListener('pagehide', save);
      setInterval(tick, 1000);
    } catch (error) {
      $('pieces').textContent = 'Не удалось загрузить карту. Обновите страницу, чтобы попробовать снова.';
      $('hint').disabled = true;
      say('Карта недоступна. Проверьте, что игра запущена через локальный сервер.');
      console.error(error);
    }
  }
  init();
})();
