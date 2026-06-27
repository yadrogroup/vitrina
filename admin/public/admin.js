'use strict';

const STEPS = ['Основное', 'Категории', 'Фото', 'Характеристики', 'Варианты'];
const AVAIL_LABEL = {
  in_stock: 'В наличии', out_of_stock: 'Нет в наличии',
  on_order: 'Под заказ', unknown: 'Уточняйте',
};

const $ = (sel, root = document) => root.querySelector(sel);
const el = (id) => document.getElementById(id);

let state = { id: null, step: 0, categories: [], images: [], attributes: [], variants: [] };

// ---------- API ----------
async function api(path, options = {}) {
  const res = await fetch(`api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) { showLogin(); throw new Error('unauthorized'); }
  return res.json();
}

// ---------- auth ----------
function showLogin() { el('login').classList.remove('hidden'); el('app').classList.add('hidden'); }
function showApp() { el('login').classList.add('hidden'); el('app').classList.remove('hidden'); }

async function login() {
  el('login-err').textContent = '';
  const data = await fetch('api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: el('login-pass').value }),
  }).then((r) => r.json());
  if (data.ok) { showApp(); init(); }
  else el('login-err').textContent = data.error || 'Не удалось войти';
}

// ---------- list ----------
async function loadList() {
  const data = await api('/products');
  if (!data.ok) return;
  el('list-count').textContent = data.count === 0 ? '' : `${data.count} шт`;
  const body = el('list-body');

  if (data.products.length === 0) {
    body.innerHTML = `<div class="empty"><h2>Пока нет товаров</h2>
      <p class="muted">Добавьте первый — он появится на сайте после публикации.</p></div>`;
    return;
  }

  const rows = data.products.map((p) => {
    const img = p.images[0]
      ? `<img class="thumb" src="${esc(p.images[0])}" alt="" />`
      : `<div class="thumb thumb--empty">нет</div>`;
    const av = `<span class="badge badge--${p.availability}">${AVAIL_LABEL[p.availability] || p.availability}</span>`;
    return `<tr>
      <td>${img}</td>
      <td><b>${esc(p.title)}</b><div class="muted" style="font-size:12px">${esc(p.id)}</div></td>
      <td class="tnum">${fmtPrice(p.price)}</td>
      <td>${(p.categories || []).map(esc).join(', ') || '—'}</td>
      <td>${av}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn--sm" data-edit="${esc(p.id)}">Изменить</button>
        <button class="btn btn--sm btn--danger" data-del="${esc(p.id)}">Удалить</button>
      </td></tr>`;
  }).join('');

  body.innerHTML = `<table class="table"><thead><tr>
    <th></th><th>Товар</th><th>Цена</th><th>Категории</th><th>Наличие</th><th></th>
    </tr></thead><tbody>${rows}</tbody></table>`;

  body.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => editProduct(b.dataset.edit)));
  body.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => removeProduct(b.dataset.del)));
}

async function removeProduct(id) {
  if (!confirm('Удалить товар? Он исчезнет с сайта после публикации.')) return;
  await api(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
  await loadList();
  toast('Товар удалён');
}

// ---------- editor ----------
function buildSteps() {
  el('steps').innerHTML = STEPS.map((label, i) =>
    `<button class="step-tab" data-step="${i}"><span class="n">${i + 1}</span>${label}</button>`).join('');
  el('steps').querySelectorAll('.step-tab').forEach((b) =>
    b.addEventListener('click', () => goStep(Number(b.dataset.step))));
}

function goStep(i) {
  state.step = Math.max(0, Math.min(STEPS.length - 1, i));
  document.querySelectorAll('.panel').forEach((p) =>
    p.classList.toggle('active', Number(p.dataset.panel) === state.step));
  document.querySelectorAll('.step-tab').forEach((b) =>
    b.setAttribute('aria-current', Number(b.dataset.step) === state.step ? 'true' : 'false'));
  el('prev-btn').disabled = state.step === 0;
  el('next-btn').classList.toggle('hidden', state.step === STEPS.length - 1);
  if (state.step === 4) renderVariants();
}

function openEditor() {
  el('list-view').classList.add('hidden');
  el('editor-view').classList.remove('hidden');
  el('save-msg').textContent = '';
  goStep(0);
}

function newProduct() {
  state = { id: null, step: 0, categories: [], images: [], attributes: [{ key: '', value: '' }], variants: [] };
  el('editor-title').textContent = 'Новый товар';
  ['f-title', 'f-price', 'f-oldprice', 'f-stock', 'f-description']
    .forEach((id) => { el(id).value = ''; });
  el('f-availability').value = 'auto';
  el('f-bestseller').checked = false;
  el('f-featured').checked = false;
  renderCats(); renderImages(); renderAttrs(); renderVariants();
  openEditor();
}

async function editProduct(id) {
  const data = await api(`/products/${encodeURIComponent(id)}`);
  if (!data.ok) return;
  const p = data.product;
  state = {
    id: p.id, step: 0,
    categories: [...(p.categories || [])],
    images: [...(p.images || [])],
    attributes: Object.entries(p.attributes || {}).map(([key, value]) => ({ key, value: String(value) })),
    variants: (p.variants || []).map((v) => ({
      id: v.id || '',
      color: v.attributes?.color || '',
      width: v.attributes?.width_cm || '',
      material: v.attributes?.material || '',
      style: v.attributes?.style || '',
      image: v.image || '',
      price: v.price || '',
    })),
  };
  if (state.attributes.length === 0) state.attributes.push({ key: '', value: '' });
  el('editor-title').textContent = p.title;
  el('f-title').value = p.title;
  el('f-price').value = p.price || '';
  el('f-oldprice').value = p.oldPrice || '';
  el('f-stock').value = p.stock ?? '';
  el('f-availability').value = p.availability || 'auto';
  el('f-bestseller').checked = !!p.bestseller;
  el('f-featured').checked = !!p.featured;
  el('f-description').value = p.description || '';
  renderCats(); renderImages(); renderAttrs(); renderVariants();
  openEditor();
}

// categories
function renderCats() {
  el('cat-chips').innerHTML = state.categories.map((c, i) =>
    `<span class="chip">${esc(c)}<button data-i="${i}" aria-label="Убрать">×</button></span>`).join('');
  el('cat-chips').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => { state.categories.splice(Number(b.dataset.i), 1); renderCats(); }));
}
function addCat() {
  const v = el('cat-input').value.trim();
  if (v && !state.categories.includes(v)) state.categories.push(v);
  el('cat-input').value = '';
  renderCats();
}

// images
function renderImages() {
  el('img-grid').innerHTML = state.images.map((url, i) => `
    <div class="img-cell">
      ${i === 0 ? '<span class="main-tag">Главное</span>' : ''}
      <img src="${esc(url)}" alt="" />
      <button class="x" data-rm="${i}" aria-label="Удалить">×</button>
      <div class="order">
        ${i > 0 ? `<button data-left="${i}" aria-label="Левее">←</button>` : ''}
        ${i < state.images.length - 1 ? `<button data-right="${i}" aria-label="Правее">→</button>` : ''}
      </div>
    </div>`).join('');
  const grid = el('img-grid');
  grid.querySelectorAll('[data-rm]').forEach((b) =>
    b.addEventListener('click', () => { state.images.splice(Number(b.dataset.rm), 1); renderImages(); }));
  grid.querySelectorAll('[data-left]').forEach((b) =>
    b.addEventListener('click', () => moveImg(Number(b.dataset.left), -1)));
  grid.querySelectorAll('[data-right]').forEach((b) =>
    b.addEventListener('click', () => moveImg(Number(b.dataset.right), 1)));
}
function moveImg(i, dir) {
  const j = i + dir;
  [state.images[i], state.images[j]] = [state.images[j], state.images[i]];
  renderImages();
}
async function uploadFiles(files) {
  const list = [...files].filter((f) => f.type.startsWith('image/'));
  if (list.length === 0) return;
  el('img-status').textContent = `Загрузка (${list.length})…`;
  for (const file of list) {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('api/upload', { method: 'POST', body: fd }).then((r) => r.json());
    if (res.ok) state.images.push(res.url);
    else el('img-status').textContent = res.error || 'Ошибка загрузки';
  }
  el('img-status').textContent = '';
  renderImages();
  if (state.step === 4) renderVariants();
}

// attributes
function renderAttrs() {
  el('attr-list').innerHTML = state.attributes.map((a, i) => `
    <div class="kv">
      <input data-k="${i}" list="attr-name-list" placeholder="Например: Материал" value="${esc(a.key)}" />
      <input data-v="${i}" placeholder="Например: Экокожа" value="${esc(a.value)}" />
      <button class="btn btn--sm btn--danger del" data-rm="${i}">×</button>
    </div>`).join('');
  const root = el('attr-list');
  root.querySelectorAll('[data-k]').forEach((inp) =>
    inp.addEventListener('input', () => { state.attributes[Number(inp.dataset.k)].key = inp.value; }));
  root.querySelectorAll('[data-v]').forEach((inp) =>
    inp.addEventListener('input', () => { state.attributes[Number(inp.dataset.v)].value = inp.value; }));
  root.querySelectorAll('[data-rm]').forEach((b) =>
    b.addEventListener('click', () => { state.attributes.splice(Number(b.dataset.rm), 1); renderAttrs(); }));
}

function emptyVariantRow() {
  return { id: '', color: '', width: '', material: '', style: '', image: '', price: '' };
}

function variantThumbs(index, selected) {
  const noneActive = !selected ? ' is-active' : '';
  let html = `<button type="button" class="variant-thumb variant-thumb--none${noneActive}" data-vthumb="${index}" data-url="" aria-label="Без фото">Без фото</button>`;
  state.images.forEach((url, j) => {
    const active = url === selected ? ' is-active' : '';
    html += `<button type="button" class="variant-thumb${active}" data-vthumb="${index}" data-url="${esc(url)}" aria-label="Фото ${j + 1}">
      <img src="${esc(url)}" alt="" />
    </button>`;
  });
  return html;
}

function renderVariants() {
  const root = el('variant-list');
  if (!root) return;

  if (state.variants.length === 0) {
    root.innerHTML = '<p class="muted variant-empty">Если товар бывает в нескольких цветах — добавьте каждый цвет здесь. Покупатель сможет переключать их на странице товара.</p>';
    return;
  }

  root.innerHTML = state.variants.map((v, i) => `
    <div class="variant-card">
      <div class="variant-card__head">
        <strong>Вариант ${i + 1}</strong>
        <button type="button" class="btn btn--sm btn--danger" data-vrm="${i}">Удалить</button>
      </div>
      <div class="variant-field variant-field--main">
        <label for="vcolor-${i}">Цвет</label>
        <input id="vcolor-${i}" data-vcolor="${i}" list="color-list" placeholder="Например: серый" value="${esc(v.color)}" />
        <p class="variant-field__hint">Главное: по нему на сайте показывается кружок-образец</p>
      </div>
      <div class="variant-field">
        <span class="variant-field__label">Фото этого цвета</span>
        <div class="variant-thumbs">${variantThumbs(i, v.image)}</div>
        <p class="variant-field__hint">Нажмите на фото, которое показывать для этого цвета${state.images.length === 0 ? ' (сначала загрузите фото на шаге «Фото»)' : ''}</p>
      </div>
      <fieldset class="variant-extra">
        <legend>Дополнительно (необязательно)</legend>
        <p class="variant-field__hint">Заполняйте, только если у вариантов разные размеры или материалы</p>
        <div class="variant-extra__grid">
          <div class="variant-field">
            <label for="vwidth-${i}">Ширина, см</label>
            <input id="vwidth-${i}" data-vwidth="${i}" type="number" min="0" inputmode="numeric" placeholder="240" value="${esc(v.width)}" />
          </div>
          <div class="variant-field">
            <label for="vmaterial-${i}">Материал</label>
            <input id="vmaterial-${i}" data-vmaterial="${i}" placeholder="Экокожа" value="${esc(v.material)}" />
          </div>
          <div class="variant-field">
            <label for="vstyle-${i}">Стиль</label>
            <input id="vstyle-${i}" data-vstyle="${i}" placeholder="Лофт" value="${esc(v.style)}" />
          </div>
        </div>
      </fieldset>
      <div class="variant-field">
        <label for="vprice-${i}">Цена, ₽</label>
        <input id="vprice-${i}" data-vprice="${i}" type="number" min="0" inputmode="numeric" placeholder="Оставьте пустым, если как у товара" value="${esc(v.price)}" />
      </div>
    </div>`).join('');

  root.querySelectorAll('[data-vcolor]').forEach((inp) =>
    inp.addEventListener('input', () => { state.variants[Number(inp.dataset.vcolor)].color = inp.value; }));
  root.querySelectorAll('[data-vwidth]').forEach((inp) =>
    inp.addEventListener('input', () => { state.variants[Number(inp.dataset.vwidth)].width = inp.value; }));
  root.querySelectorAll('[data-vmaterial]').forEach((inp) =>
    inp.addEventListener('input', () => { state.variants[Number(inp.dataset.vmaterial)].material = inp.value; }));
  root.querySelectorAll('[data-vstyle]').forEach((inp) =>
    inp.addEventListener('input', () => { state.variants[Number(inp.dataset.vstyle)].style = inp.value; }));
  root.querySelectorAll('[data-vprice]').forEach((inp) =>
    inp.addEventListener('input', () => { state.variants[Number(inp.dataset.vprice)].price = inp.value; }));
  root.querySelectorAll('[data-vthumb]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.vthumb);
      state.variants[idx].image = btn.dataset.url || '';
      renderVariants();
    }));
  root.querySelectorAll('[data-vrm]').forEach((b) =>
    b.addEventListener('click', () => { state.variants.splice(Number(b.dataset.vrm), 1); renderVariants(); }));
}

function buildVariantsPayload() {
  return state.variants
    .filter((v) => v.color || v.width || v.material || v.style)
    .map((v, i) => {
      const attributes = {};
      if (v.color) attributes.color = String(v.color).trim().toLowerCase();
      if (v.width) attributes.width_cm = String(v.width).trim();
      if (v.material) attributes.material = String(v.material).trim();
      if (v.style) attributes.style = String(v.style).trim();
      const label = Object.values(attributes).join(', ');
      const out = { id: v.id || `${state.id || 'v'}-${i + 1}`, label, attributes };
      if (v.image) out.image = v.image;
      const priceNum = Math.round(Number(v.price));
      if (priceNum > 0) out.price = priceNum;
      return out;
    });
}

// save
async function save() {
  const attributes = {};
  for (const { key, value } of state.attributes) {
    const k = key.trim();
    if (k && String(value).trim()) attributes[k] = String(value).trim();
  }
  const payload = {
    id: state.id || undefined,
    title: el('f-title').value,
    price: el('f-price').value,
    oldPrice: el('f-oldprice').value,
    stock: el('f-stock').value,
    availability: el('f-availability').value,
    description: el('f-description').value,
    bestseller: el('f-bestseller').checked,
    featured: el('f-featured').checked,
    categories: state.categories,
    images: state.images,
    attributes,
    variants: buildVariantsPayload(),
  };
  const msg = el('save-msg');
  const data = await api('/products', { method: 'POST', body: JSON.stringify(payload) });
  if (data.ok) {
    state.id = data.product.id;
    msg.dataset.tone = 'ok'; msg.textContent = 'Сохранено';
    el('editor-title').textContent = data.product.title;
    toast('Товар сохранён');
    await loadList();
  } else {
    msg.dataset.tone = 'err'; msg.textContent = data.error || 'Ошибка';
  }
}

// ---------- publish ----------
let pollTimer = null;
async function publish() {
  await api('/publish', { method: 'POST', body: JSON.stringify({}) });
  el('publish-btn').disabled = true;
  pollStatus();
}
async function pollStatus() {
  const data = await api('/publish/status');
  const s = data.status;
  const box = el('pub-status');
  if (s.running) {
    box.dataset.tone = ''; box.textContent = `Публикация: ${stepLabel(s.step)}…`;
    el('publish-btn').disabled = true;
    pollTimer = setTimeout(pollStatus, 1500);
  } else {
    clearTimeout(pollTimer);
    el('publish-btn').disabled = false;
    if (s.ok === true) { box.dataset.tone = 'ok'; box.textContent = 'Опубликовано'; toast('Опубликовано'); }
    else if (s.ok === false) { box.dataset.tone = 'err'; box.textContent = `Не удалось: ${stepLabel(s.step)}`; }
  }
}
function stepLabel(step) {
  const map = { sync: 'выгрузка каталога', embed: 'индексация фото', build: 'сборка сайта', done: 'готово' };
  if (step && step.startsWith('failed:')) return `ошибка (${step.slice(7)})`;
  return map[step] || step || '';
}

// ---------- helpers ----------
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtPrice(n) { return `${Number(n).toLocaleString('ru-RU')} ₽`; }
let toastTimer = null;
function toast(text) {
  const t = el('toast'); t.textContent = text; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- wire ----------
function bind() {
  el('login-btn').addEventListener('click', login);
  el('login-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
  el('logout-btn').addEventListener('click', async () => { await fetch('api/logout', { method: 'POST' }); showLogin(); });
  el('add-btn').addEventListener('click', newProduct);
  el('back-btn').addEventListener('click', () => { el('editor-view').classList.add('hidden'); el('list-view').classList.remove('hidden'); });
  el('prev-btn').addEventListener('click', () => goStep(state.step - 1));
  el('next-btn').addEventListener('click', () => goStep(state.step + 1));
  el('save-btn').addEventListener('click', save);
  el('publish-btn').addEventListener('click', publish);
  el('cat-add').addEventListener('click', addCat);
  el('cat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCat(); } });
  el('attr-add').addEventListener('click', () => { state.attributes.push({ key: '', value: '' }); renderAttrs(); });
  el('variant-add').addEventListener('click', () => { state.variants.push(emptyVariantRow()); renderVariants(); });

  const dz = el('dropzone'); const input = el('img-input');
  dz.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { uploadFiles(input.files); input.value = ''; });
  ['dragover', 'dragenter'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, () => dz.classList.remove('over')));
  dz.addEventListener('drop', (e) => { e.preventDefault(); uploadFiles(e.dataTransfer.files); });
}

async function init() {
  buildSteps();
  await loadList();
  const cats = await api('/categories').catch(() => ({ categories: [] }));
  el('cat-list').innerHTML = (cats.categories || []).map((c) => `<option value="${esc(c)}">`).join('');
  pollStatus();
}

bind();
// проверка сессии: если уже залогинены — пропускаем экран входа
api('/products').then((d) => { if (d && d.ok) { showApp(); init(); } else showLogin(); }).catch(showLogin);
