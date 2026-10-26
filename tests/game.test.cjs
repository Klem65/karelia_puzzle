// Dependency-free interaction tests. This DOM double does not replace browser visual QA.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const data = JSON.parse(fs.readFileSync('public/assets/regions.json', 'utf8'));
const source = fs.readFileSync('public/assets/game.js', 'utf8');

async function game(saved = null) {
  class Element {
    constructor(tag = 'div') {
      this.tag = tag; this.children = []; this.attrs = {}; this.style = {}; this.dataset = {};
      this.events = {}; this.textContent = ''; this.disabled = false; this.open = false;
      this.classes = new Set();
      this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c), toggle: (c, on) => on ? this.classes.add(c) : this.classes.delete(c), contains: c => this.classes.has(c) };
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    append(...els) { els.forEach(el => { el.parent = this; this.children.push(el); }); }
    replaceChildren(...els) { this.children = []; this.append(...els); }
    addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
    fire(type, event = {}) { if (!this.disabled) for (const fn of this.events[type] || []) fn({ preventDefault() {}, ...event }); }
    getBBox() { return { x: 0, y: 0, width: 100, height: 100 }; }
    getScreenCTM() { return { a: 1 }; }
    setPointerCapture() {}
    remove() { this.parent.children = this.parent.children.filter(el => el !== this); }
    showModal() { this.open = true; }
    close() { this.open = false; }
  }
  const elements = new Map();
  const el = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  ['help-dialog', 'win-dialog', 'restart-dialog'].forEach(el);
  const document = new Element();
  document.body = new Element(); document.hidden = false;
  document.getElementById = el;
  document.createElement = tag => new Element(tag);
  document.createElementNS = (_, tag) => new Element(tag);
  document.querySelectorAll = q => q === 'dialog[open]' ? [...elements.values()].filter(e => e.open) : [];
  document.querySelector = q => q === 'dialog[open]' ? document.querySelectorAll(q)[0] : el(q);
  document.elementFromPoint = () => document.hit;
  const window = new Element();
  let storage = saved, now = 0, interval;
  const context = { document, window, console, localStorage: { getItem: () => storage, setItem: (_, s) => { storage = s; } },
    Date: { now: () => now }, setInterval: fn => { interval = fn; },
    fetch: async () => ({ ok: true, json: async () => structuredClone(data) }),
    DOMPoint: class { constructor(x, y) { this.x = x; this.y = y; } matrixTransform() { return this; } }
  };
  vm.runInNewContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { el, document, window, saved: () => storage,
    state: () => JSON.parse(storage), advance: seconds => { now += seconds * 1000; interval(); },
    card: id => el('pieces').children.find(c => c.dataset.region === id),
    target: id => el('targets').children.find(c => c.attrs['data-region'] === String(id)) };
}

test('all 18 supplied regions are unique and have geometry and Russian names', () => {
  assert.equal(data.length, 18); assert.equal(new Set(data.map(r => r.id)).size, 18);
  for (const r of data) { assert.match(r.name, /[А-Яа-я]/); assert.match(r.d, /^m /); assert.match(r.color, /^#[a-f0-9]{6}$/); }
});
test('wrong target leaves a piece available; correct target locks it and updates progress', async () => {
  const g = await game();
  g.card(2).fire('click', { detail: 0 }); g.target(3).fire('click');
  assert.equal(g.card(2).disabled, false); assert.equal(g.el('count').textContent, 0);
  g.target(2).fire('keydown', { key: 'Enter' });
  assert.equal(g.card(2).disabled, true); assert.equal(g.el('count').textContent, 1);
  assert.deepEqual(g.state().placed, [2]);
  g.target(2).fire('click'); assert.equal(g.el('count').textContent, 1);
});
test('drag into correct path succeeds; invalid and cancelled drags do not place pieces', async () => {
  const g = await game();
  const down = { button: 0, pointerId: 1, clientX: 10, clientY: 10 };
  g.card(2).fire('pointerdown', down);
  g.document.fire('pointermove', { pointerId: 1, clientX: 200, clientY: 200 });
  g.document.hit = g.target(2);
  g.document.fire('pointerup', { pointerId: 1, clientX: 200, clientY: 200 });
  assert.deepEqual(g.state().placed, [2]); assert.equal(g.document.body.children.length, 0);
  g.card(3).fire('pointerdown', down);
  g.document.fire('pointermove', { pointerId: 1, clientX: 300, clientY: 300 });
  g.document.hit = null; g.document.fire('pointerup', { pointerId: 1, clientX: 300, clientY: 300 });
  assert.equal(g.card(3).disabled, false);
  g.card(4).fire('pointerdown', down);
  g.document.fire('pointermove', { pointerId: 1, clientX: 300, clientY: 300 });
  g.document.fire('pointercancel');
  assert.equal(g.document.body.children.length, 0); assert.deepEqual(g.state().placed, [2]);
});
test('hint, timer, hidden tab pause, saved progress, and reset work together', async () => {
  const g = await game(); g.advance(5); assert.equal(g.el('timer').textContent, '00:00');
  g.el('hint').fire('click'); assert.equal(g.state().hints, 1); assert.equal(g.target(2).classList.contains('hinted'), true);
  g.advance(7); assert.equal(g.el('timer').textContent, '00:07');
  g.document.hidden = true; g.advance(20); assert.equal(g.el('timer').textContent, '00:07');
  g.document.hidden = false; g.document.fire('visibilitychange');
  g.target(2).fire('click');
  const restored = await game(g.saved());
  assert.equal(restored.card(2).disabled, true); assert.equal(restored.el('timer').textContent, '00:07');
  restored.el('restart').fire('click'); assert.equal(restored.el('restart-dialog').open, true);
  restored.el('cancel-restart').fire('click'); assert.deepEqual(restored.state().placed, [2]);
  restored.el('confirm-restart').fire('click');
  assert.equal(restored.el('count').textContent, 0); assert.equal(restored.el('timer').textContent, '00:00');
  assert.equal(restored.card(2).disabled, false);
});
test('all 18 placements trigger completion and freeze time; replay starts cleanly', async () => {
  const g = await game();
  for (const r of data) { g.card(r.id).fire('click', { detail: 0 }); g.target(r.id).fire('click'); }
  assert.equal(g.el('win-dialog').open, true); assert.equal(g.el('count').textContent, 18);
  assert.equal(g.el('hint').disabled, true); g.advance(20); assert.equal(g.el('timer').textContent, '00:00');
  g.el('play-again').fire('click'); assert.equal(g.el('win-dialog').open, false); assert.equal(g.el('count').textContent, 0);
});
test('damaged saves are ignored and unknown or duplicated region IDs are filtered', async () => {
  const corrupt = await game('{invalid'); assert.equal(corrupt.el('count').textContent, 0);
  const g = await game(JSON.stringify({ placed: [2, 2, 1234], elapsed: -10, hints: 'oops' }));
  assert.equal(g.el('count').textContent, 1); assert.equal(g.el('timer').textContent, '00:00');
});
