const API_BASE = '';
let data = null;
let adminHotkey = false;
let urlParamsApplied = false;
let adminPage = 1;
const ADMIN_PAGE_SIZE = 50;
let adminFilteredIndices = [];
let publicFilteredProducts = [];
let publicRenderedCount = 0;
let publicIsRendering = false;
const PUBLIC_BATCH_SIZE = 24;

const FAVORITES_KEY = 'og_product_favorites';
let favoritesOnly = false;

function getFavorites(){
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  } catch(e) {
    return [];
  }
}

function saveFavorites(favs){
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}

function isFavorite(id){
  return getFavorites().includes(id);
}

function toggleFavorite(id){
  if (!id) return;

  let favs = getFavorites();

  if (favs.includes(id)) {
    favs = favs.filter(x => x !== id);
  } else {
    favs.push(id);
  }

  saveFavorites(favs);
}

// Debounced render so typing doesn't rebuild the whole page every keystroke
let __renderTimer = null;
function renderPublicDebounced(ms = 180, force = false) {
  // ✅ Don’t rebuild 1200 public cards while editing admin...
  // ✅ BUT allow it when we explicitly force it (search/filter)
  if (isAdmin() && !force) return;

  clearTimeout(__renderTimer);
  __renderTimer = setTimeout(() => {
    try { renderProductsGridOnly(); } catch (e) {}
  }, ms);
}

function renderProductsGridOnly(){
  const idxMap = getProductIndexMap();
  const itemsAll = getProductsArray().filter(p => p && p.enabled !== false);

  const q = (document.getElementById('q').value || '').toLowerCase().trim();
  const cat = (document.getElementById('cat').value || '').trim();

  renderCategoryLinksPublic(cat);

  let items = itemsAll.slice();

  const tip = document.getElementById('filterTip');
  if (tip) {
    tip.classList.toggle('hidden', !(q && cat));
  }

  if (cat) items = items.filter(p => normStr(p.category) === cat);

  if (q) {
    items = items.filter(p => {
      const hay = [
        normStr(p.label),
        normStr(p.seller),
        normStr(p.category),
        normStr(p.price)
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  if (favoritesOnly) {
    const favs = getFavorites();
    items = items.filter(p => favs.includes(p.id));
  }

  publicFilteredProducts = items;
  publicRenderedCount = 0;

  document.getElementById('count').textContent = String(items.length);

  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '';

  if (items.length === 0) {
    document.getElementById('emptyState').classList.remove('hidden');
  } else {
    document.getElementById('emptyState').classList.add('hidden');
    renderNextProductBatch(idxMap);
  }
}

function renderNextProductBatch(idxMap){
  if (publicIsRendering) return;
  publicIsRendering = true;

  if (!idxMap) idxMap = getProductIndexMap();

  const grid = document.getElementById('productsGrid');

  const nextItems = publicFilteredProducts.slice(
    publicRenderedCount,
    publicRenderedCount + PUBLIC_BATCH_SIZE
  );

  nextItems.forEach(p => {
    grid.appendChild(productCardEl(p, idxMap.get(p.id)));
  });

  publicRenderedCount += nextItems.length;
  publicIsRendering = false;
}

const $ = (s) => document.querySelector(s);
const el = (t,c)=>{ const e=document.createElement(t); if(c) e.className=c; return e; };
function isAdmin(){ return new URLSearchParams(location.search).get('admin') === '1' || localStorage.getItem('isAdmin') === 'true' || adminHotkey; }

function getUrlCat(){
  const sp = new URLSearchParams(location.search);
  const cat = (sp.get('cat') || '').trim();
  return cat;
}

function pad3(n){
  const x = Number(n) || 0;
  if (x < 10) return '00' + x;
  if (x < 100) return '0' + x;
  return String(x);
}

// ✅ QC helper: extract spuNo from product URL (usually ?id=123...)
function extractSpuNoFromProductUrl(url){
  const s = (url || '').toString().trim();
  if (!s) return '';

  const tryFromString = (str) => {
    if (!str) return '';

    const patterns = [
      /(?:[?&](?:id|spuNo|spu|itemId|item_id|itemID|goodsId|goods_id|productId|product_id|offerId|offer_id)=)(\d{6,})/i,
      /\/(?:product|item|goods|offer|weidian|taobao|1688)\/(\d{6,})(?:\b|\/|\.|$)/i,
      /\/(\d{6,})(?:\b|\/|\.|$)/
    ];

    for (const rx of patterns) {
      const m = str.match(rx);
      if (m) return m[1];
    }

    return '';
  };

  try {
    const u = new URL(s, location.origin);

    const keys = [
      'id', 'spuNo', 'spu',
      'itemId', 'item_id', 'itemID',
      'goodsId', 'goods_id',
      'productId', 'product_id',
      'offerId', 'offer_id'
    ];

    for (const k of keys) {
      const v = u.searchParams.get(k);
      if (v && /^\d{6,}$/.test(v)) return v;
    }

    const nestedKeys = ['url', 'target', 'redirect', 'redirectUrl', 'link'];
    for (const k of nestedKeys) {
      const inner = u.searchParams.get(k);
      if (inner) {
        const found = tryFromString(decodeURIComponent(inner));
        if (found) return found;
      }
    }

    const pathFound = tryFromString(u.pathname);
    if (pathFound) return pathFound;

    return tryFromString(s);
  } catch (e) {
    return tryFromString(s);
  }
}

// ✅ NEW: stable index map (editor order)
function getProductIndexMap(){
  const m = new Map();
  const arr = getProductsArray();
  arr.forEach((p, i) => {
    if (p && p.id) m.set(p.id, i + 1); // 1-based
  });
  return m;
}

function faIconFor(url, label=''){
  const u = (url||'').toLowerCase();
  const L = (label||'').toLowerCase();
  const has = (s) => u.includes(s) || L.includes(s);
  if (has('instagram')) return 'fa-brands fa-instagram';
  if (has('tiktok')) return 'fa-brands fa-tiktok';
  if (has('youtube') || has('youtu.be')) return 'fa-brands fa-youtube';
  if (has('facebook')) return 'fa-brands fa-facebook-f';
  if (has('x.com') || has('twitter')) return 'fa-brands fa-x-twitter';
  if (has('telegram')) return 'fa-brands fa-telegram';
  if (has('linkedin')) return 'fa-brands fa-linkedin-in';
  if (has('discord')) return 'fa-brands fa-discord';
  if (has('whatsapp')) return 'fa-brands fa-whatsapp';
  if (has('github')) return 'fa-brands fa-github';
  if (has('threads.net') || has('threads')) return 'fa-brands fa-threads';
  if (has('snapchat')) return 'fa-brands fa-snapchat-ghost';
  if (has('pinterest')) return 'fa-brands fa-pinterest-p';
  if (has('linktree')) return 'fa-brands fa-linktree';
  if (has('google')) return 'fa-solid fa-table';
  return 'fa-solid fa-link';
}

async function loadConfig(){
  try {
    const res = await fetch(`${API_BASE}/api/config`);
    if (res.ok) {
      data = await res.json();
      return;
    }
  } catch (e) {
    console.warn('API /api/config failed, falling back to config.json', e);
  }

  // Local static configuration file fallback
  const res = await fetch('config.json');
  if(!res.ok) throw new Error('Failed to load config');
  data = await res.json();
}

async function saveConfig(){
  const res = await fetch(`${API_BASE}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if(!res.ok){
    const err = await res.json().catch(()=>({error:'Unknown error'}));
    alert('Save failed: ' + (err.error || res.statusText));
    return false;
  }
  return true;
}

function applyTheme(){
  const t = data.theme || {};
  document.documentElement.style.setProperty('--bg', t.bg || '#fafafa');
  document.documentElement.style.setProperty('--text', t.text || '#0a0a0a');
  document.documentElement.style.setProperty('--primary', t.primary || '#2563eb');
  document.documentElement.style.setProperty('--border', t.border || '#e4e4e7');

  const link = document.getElementById('googleFontLink');
  const fam = (t.font || 'Inter').replace(/ /g, '+');
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam)}:wght@400;500;600;700;800&display=swap`;
  document.body.style.fontFamily = `${t.font||'Inter'}, ui-sans-serif, system-ui`;

  const cols = Number(
    data.page?.productsColsDesktop ||
    t.gridColsDesktop ||
    4
  );
  document.getElementById('productsGrid')?.style.setProperty('--cols-desktop', String(Math.min(Math.max(cols, 2), 8)));
  document.getElementById('categoryLinksGrid')?.style.setProperty('--cols-desktop', String(Math.min(Math.max(cols, 2), 8)));

  const title = document.getElementById('pageTitle');
  if (title) {
    title.classList.remove('title-style-a','title-style-b','title-glow');
    const style = (t.titleStyle || 'a').toLowerCase();
    title.classList.add(style === 'b' ? 'title-style-b' : 'title-style-a');
    if (t.titleGlow === true) title.classList.add('title-glow');
  }
}

function renderBanner() {
  const bar = document.getElementById('topBanner');
  const span = document.getElementById('topBannerText');
  if (!bar || !span) return;
  const b = data && data.banner ? data.banner : {};
  if (b.enabled === false || !b.text) {
    bar.classList.add('hidden');
    span.innerHTML = '';
    bar.style.backgroundColor = '';
    bar.style.color = '';
    bar.style.borderBottom = '';
    bar.classList.remove('font-semibold');
    return;
  }
  span.innerHTML = b.text;
  bar.style.backgroundColor = b.bg || '#fee2e2';
  bar.style.color = b.textColor || '#b91c1c';
  bar.style.borderBottom = '1px solid ' + (b.borderColor || '#fecaca');
  if (b.bold === false) bar.classList.remove('font-semibold');
  else bar.classList.add('font-semibold');
  bar.classList.remove('hidden');
}

function ctaClass(variant){
  const base='btn inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold border';
  if (variant === 'filled') return base + ' theme-cta';
  if (variant === 'outline') return base + ' theme-cta-outline';
  switch(variant){
    case 'black': return base + ' border-black bg-black text-white hover:bg-black/90';
    case 'red': return base + ' border-red-600 bg-red-600 text-white hover:bg-red-700';
    case 'blue': return base + ' border-blue-600 bg-blue-600 text-white hover:bg-blue-700';
    default: return base + ' theme-cta-outline';
  }
}

window.trackClick = window.trackClick || function(id){
  try {
    if (!id) return;
    const payload = JSON.stringify({ id });
    const url = `${API_BASE}/api/products/click`;
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    } else {
      fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:payload });
    }
  } catch (e) {}
};

function normStr(x){ return (x||'').toString().trim(); }

function getProductsArray(){
  if (!Array.isArray(data.products)) data.products = [];
  return data.products;
}

function getCategoryLinksArray(){
  if (!Array.isArray(data.categoryLinks)) data.categoryLinks = [];
  return data.categoryLinks;
}

function getAllCategories(){
  const preferred = [
    'Shoes',
    'Hoodies',
    'Tees',
    'Pants',
    'Shorts',
    'Tracksuits',
    'Accessories',
    'Electronics',
    'Women',
    'Kids'
  ];

  const found = new Set();

  getProductsArray().forEach(p=>{
    const c = normStr(p?.category);
    if (c) found.add(c);
  });

  if (typeof getCategoryLinksArray === 'function') {
    getCategoryLinksArray().forEach(l=>{
      const c = normStr(l?.category);
      if (c) found.add(c);
    });
  }

  const ordered = [];

  preferred.forEach(cat=>{
    if (found.has(cat)) ordered.push(cat);
  });

  [...found].forEach(cat=>{
    if (!ordered.includes(cat)) ordered.push(cat);
  });

  return ordered;
}

function buildCategoryOptions(){
  const sel = document.getElementById('cat');
  const current = sel.value;

  sel.innerHTML = '<option value="">All categories</option>';
  getAllCategories().forEach(c=>{
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    sel.appendChild(o);
  });

  if ([...sel.options].some(o=>o.value===current)) sel.value=current;

  const adminSel = document.getElementById('iCatLinksFilter');
  if (adminSel) {
    const cur2 = adminSel.value;
    adminSel.innerHTML = '<option value="">All categories</option>';
    getAllCategories().forEach(c=>{
      const o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      adminSel.appendChild(o);
    });
    if ([...adminSel.options].some(o=>o.value===cur2)) adminSel.value=cur2;
  }

  buildCategoryPills();
}

function buildCategoryPills(){
  const wrap = document.getElementById('catPills');
  const sel = document.getElementById('cat');
  if (!wrap || !sel) return;

  const current = sel.value || '';
  wrap.innerHTML = '';

  const cats = ['', ...getAllCategories()];

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.type = 'button';

    const active = cat === current;

    btn.className =
      'rounded-full border px-3 py-1.5 text-sm font-semibold transition ' +
      (active
        ? 'theme-cta'
        : 'theme-cta-outline hover:bg-zinc-50');

    btn.textContent = cat || 'All';

    btn.addEventListener('click', () => {
      sel.value = cat;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      buildCategoryPills();
    });

    wrap.appendChild(btn);
  });
}

function escapeHtml(s){
  return (s||'').toString()
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}

function renderHeader(){
  applyTheme();

  document.getElementById('name').textContent = data.profile?.name || '';
  document.getElementById('bio').textContent = data.profile?.bio || '';
  document.getElementById('avatar').src = data.profile?.avatar || '';

  const sWrap = document.getElementById('socials');
  sWrap.innerHTML = '';
  (data.profile?.socials || []).forEach(s=>{
    if(!s.url) return;
    const a=el('a','icon-btn border theme-border bg-white hover:bg-zinc-50 transition');
    a.href=s.url; a.target='_blank'; a.rel='noopener'; a.title=s.label||'';
    const i=document.createElement('i'); i.className=faIconFor(s.url, s.label);
    a.appendChild(i);
    sWrap.appendChild(a);
  });

  if (!document.getElementById('darkModeBtn')) {
    const d = document.createElement('button');
    d.id = 'darkModeBtn';
    d.type = 'button';
    d.title = 'Toggle night mode';
    d.innerHTML = document.body.classList.contains('dark-mode')
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
    sWrap.appendChild(d);
  }

  // Admin Lock Toggle Button
  if (!document.getElementById('adminLoginBtn')) {
    const ab = document.createElement('button');
    ab.id = 'adminLoginBtn';
    ab.type = 'button';
    ab.title = isAdmin() ? 'Log out of admin' : 'Log in as admin';
    ab.className = 'icon-btn border theme-border bg-white hover:bg-zinc-50 transition ml-2 dark:bg-zinc-800 dark:hover:bg-zinc-700';
    ab.innerHTML = isAdmin() 
      ? '<i class="fa-solid fa-lock-open text-blue-600 dark:text-blue-400"></i>' 
      : '<i class="fa-solid fa-lock"></i>';
    sWrap.appendChild(ab);
  }

  if (typeof updateDarkButton === 'function') updateDarkButton();

  renderBanner();

  const cta = document.getElementById('ctaSection');
  cta.innerHTML = '';
  (data.ctas || []).forEach(c=>{
    if(!c.label || !c.url) return;
    const a=el('a', ctaClass(c.variant));
    a.href=c.url; a.target='_blank'; a.rel='noopener';
    if (c.image) {
      const img = document.createElement('img');
      img.src = c.image;
      img.alt = c.label || '';
      img.className = 'h-4 w-4 object-contain';
      a.appendChild(img);
    }
    const span = document.createElement('span'); span.textContent = c.label;
    a.appendChild(span);
    cta.appendChild(a);
  });

  const footerEl = document.getElementById('footer');
  if (footerEl && typeof data.footer === 'string' && data.footer.trim().length > 0) {
    footerEl.textContent = data.footer;
  }

  const pt = data.page?.productsTitle;
  const ps = data.page?.productsSubtitle;
  if (typeof pt === 'string' && pt.trim()) document.getElementById('pageTitle').textContent = pt.trim();
  if (typeof ps === 'string' && ps.trim()) document.getElementById('pageSubtitle').textContent = ps.trim();
}

function updateAdminClicksUI(productId, clicks){
  if (!productId) return;
  const row = document.querySelector(`#productsEditor [data-pid="${CSS.escape(productId)}"]`);
  if (!row) return;
  const elClicks = row.querySelector('.p-clicks');
  if (elClicks) elClicks.textContent = String(clicks || 0);
}

// ✅ UPDATED: now accepts num (editor index) for badge
function productCardEl(p, num){
  const a = el('a','theme-card border theme-border block');
  a.href = p.url || '#';
  a.dataset.noWrap = '1'; // ✅ bypass /go.html wrapper
  a.target = '_blank';
  a.rel = 'noopener';

  if (p.borderColor) a.style.borderColor = p.borderColor;
  if (p.textColor) a.style.color = p.textColor;

  // ✅ NEW: admin badge on card
  if (isAdmin() && num) {
    const badge = el('div','admin-num-badge');
    badge.innerHTML = `<i class="fa-solid fa-hashtag opacity-70"></i><span>#${pad3(num)}</span>`;
    a.appendChild(badge);
  }

  const img = document.createElement('img');
  img.src = p.image || '';
  img.alt = p.label || '';
  img.loading = 'lazy';
  img.className = 'aspect-[4/3] w-full object-contain p-4 prod-img';

  const body = el('div','p-4');
  const top = el('div','prod-top');

  const title = el('div','prod-title');
  const safeTitle = escapeHtml(p.label || 'Untitled').replace(/\n/g, '<br>');
  title.innerHTML = safeTitle;

  const price = el('div','prod-price');
  price.textContent = p.price || '';
  if (p.priceColor) price.style.color = p.priceColor;

  top.appendChild(title);
  top.appendChild(price);

  const meta = el('div','mt-3 flex flex-wrap gap-2');
  const cat = normStr(p.category);
  const seller = normStr(p.seller);
  const updated = normStr(p.updated);

  if (cat) {
    const pill = el('span','pill');
    pill.innerHTML = `<i class="fa-solid fa-tags"></i><span>${escapeHtml(cat)}</span>`;
    meta.appendChild(pill);
  }
  if (seller) {
    const pill = el('span','pill');
    pill.innerHTML = `<i class="fa-solid fa-store"></i><span>${escapeHtml(seller)}</span>`;
    meta.appendChild(pill);
  }
  if (updated) {
    const pill = el('span','pill');
    pill.innerHTML = `<i class="fa-regular fa-clock"></i><span>${escapeHtml(updated)}</span>`;
    meta.appendChild(pill);
  }

  body.appendChild(top);
  body.appendChild(meta);
  a.appendChild(img);
  a.appendChild(body);

  // ✅ QC button (opens /qc-central/qc.html in a new tab)
  const spuNo = extractSpuNoFromProductUrl(p.url);
  if (spuNo) {
    const qcBtn = document.createElement('button');
    qcBtn.type = 'button';
    qcBtn.className = 'qc-btn';
    qcBtn.innerHTML = `<i class="fa-solid fa-camera"></i><span>QC</span>`;
    qcBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const qs = new URLSearchParams();
      qs.set('spuNo', spuNo);
      if (p.label) qs.set('label', p.label);
      if (p.url) qs.set('u', p.url);              // ✅ add this
      // carry current category so QC can go back correctly
      const curCat = (document.getElementById('cat')?.value || '').trim();
      if (curCat) qs.set('cat', curCat);

      // open in same tab
      window.open('/qc-central/qc.html?' + qs.toString(), '_self');
    });
    a.appendChild(qcBtn);
  }

  a.addEventListener('click', ()=>{
    try{
      const items = getProductsArray();
      const idx = items.findIndex(x => x.id === p.id);
      if (idx >= 0) {
        items[idx].clicks = (items[idx].clicks || 0) + 1;
        updateAdminClicksUI(items[idx].id, items[idx].clicks);
      }
      window.trackClick(p.id);
    }catch(_){}
  });

  // ✅ Favorite button
  const favBtn = document.createElement('button');
  favBtn.type = 'button';
  favBtn.className = 'fav-btn' + (isFavorite(p.id) ? ' active' : '');
  favBtn.innerHTML = `<i class="fa-solid fa-heart"></i>`;

  favBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    toggleFavorite(p.id);

    if (favoritesOnly) {
      renderProductsGridOnly();
    } else {
      favBtn.classList.toggle('active', isFavorite(p.id));
    }
  });

  a.appendChild(favBtn);

  // ✅ Share button
  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'share-btn';
  shareBtn.innerHTML = `<i class="fa-solid fa-share-nodes"></i>`;

  shareBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (navigator.share) {
        await navigator.share({
          title: p.label || 'Product',
          text: p.label || 'Check this out',
          url: p.url || window.location.href
        });
      } else {
        await navigator.clipboard.writeText(p.url || '');

        const oldHtml = shareBtn.innerHTML;
        shareBtn.innerHTML = `<i class="fa-solid fa-check"></i>`;

        setTimeout(() => {
          shareBtn.innerHTML = oldHtml;
        }, 1200);
      }
    } catch(err) {}
  });

  a.appendChild(shareBtn);

  return a;
}

function categoryLinkCardEl(l){
  const variant = (l.variant || 'card').toLowerCase();

  if (variant === 'outline' || variant === 'filled') {
    const a = el('a', ctaClass(variant === 'filled' ? 'filled' : 'outline') + ' w-full justify-center');
    a.href = l.url || '#';
    a.target = '_blank';
    a.rel = 'noopener';
    if (l.image) {
      const img = document.createElement('img');
      img.src = l.image;
      img.alt = l.label || '';
      img.className = 'h-5 w-5 object-contain';
      a.appendChild(img);
    } else {
      const i = document.createElement('i');
      i.className = faIconFor(l.url, l.label);
      a.appendChild(i);
    }
    const span = document.createElement('span');
    span.innerHTML = escapeHtml(l.label || 'Link').replace(/\n/g, '<br>');
    span.style.textAlign = 'center';
    a.appendChild(span);

    const wrap = el('div','theme-card border theme-border p-4 flex items-center justify-center');
    if (l.borderColor) wrap.style.borderColor = l.borderColor;
    if (l.textColor) wrap.style.color = l.textColor;

    wrap.appendChild(a);
    return wrap;
  }

  const a = el('a','theme-card border theme-border block');
  a.href = l.url || '#';
  a.target = '_blank';
  a.rel = 'noopener';

  if (l.borderColor) a.style.borderColor = l.borderColor;
  if (l.textColor) a.style.color = l.textColor;

  const img = document.createElement('img');
  img.src = l.image || '';
  img.alt = l.label || '';
  img.loading = 'lazy';
  img.className = 'aspect-[4/3] w-full object-contain p-6 prod-img';

  const body = el('div','p-4');
  const title = el('div','prod-title');
  title.innerHTML = escapeHtml(l.label || 'Link').replace(/\n/g, '<br>');

  const meta = el('div','mt-3 flex flex-wrap gap-2');
  const cat = normStr(l.category);
  if (cat) {
    const pill = el('span','pill');
    pill.innerHTML = `<i class="fa-solid fa-tags"></i><span>${escapeHtml(cat)}</span>`;
    meta.appendChild(pill);
  }
  const pill2 = el('span','pill');
  pill2.innerHTML = `<i class="fa-solid fa-link"></i><span>Quick link</span>`;
  if (l.priceColor) pill2.style.color = l.priceColor;
  meta.appendChild(pill2);

  body.appendChild(title);
  body.appendChild(meta);

  if (l.image) a.appendChild(img);
  else {
    const top = el('div','prod-img flex items-center justify-center aspect-[4/3]');
    const i = document.createElement('i');
    i.className = faIconFor(l.url, l.label) + ' text-3xl opacity-80';
    top.appendChild(i);
    a.appendChild(top);
  }
  a.appendChild(body);
  return a;
}

function renderCategoryLinksPublic(selectedCat){
  const wrap = document.getElementById('categoryLinksWrap');
  const grid = document.getElementById('categoryLinksGrid');
  if (!wrap || !grid) return;

  const cat = normStr(selectedCat);

  // ✅ If cat is selected: show cards matching that category
  // ✅ If cat is empty (All Products): show cards that have NO category set
  const links = getCategoryLinksArray()
    .filter(x => x && x.enabled !== false)
    .filter(x => cat ? (normStr(x.category) === cat) : !normStr(x.category));

  const show = links.length > 0;
  wrap.classList.toggle('hidden', !show);

  grid.innerHTML = '';
  if (!show) return;
  links.forEach(l => grid.appendChild(categoryLinkCardEl(l)));
}

function applyUrlCategoryIfPresent(){
  if (urlParamsApplied) return;
  urlParamsApplied = true;

  const urlCat = getUrlCat();
  if (!urlCat) return;

  const sel = document.getElementById('cat');
  if (sel) {
    sel.value = urlCat;
    buildCategoryPills();
    const pill = document.getElementById('urlCatPill');
    const pillText = document.getElementById('urlCatPillText');
    if (pill && pillText) {
      pillText.textContent = urlCat;
      pill.classList.remove('hidden');
    }
  }
}

function renderProductsPublic(){
  renderHeader();
  buildCategoryOptions();
  applyUrlCategoryIfPresent();
  renderProductsGridOnly();
}

function renderAdmin(){
  document.getElementById('adminPanel').classList.remove('hidden');

  document.getElementById('iName').value = data.profile?.name || '';
  document.getElementById('iBio').value = data.profile?.bio || '';
  document.getElementById('iAvatar').value = data.profile?.avatar || '';
  document.getElementById('iAdminPassword').value = data.adminPassword || '';

  if (!data.theme) data.theme = {};
  document.getElementById('iFont').value = data.theme.font || 'Inter';
  document.getElementById('iPrimary').value = data.theme.primary || '#2563eb';
  document.getElementById('iBg').value = data.theme.bg || '#fafafa';
  document.getElementById('iText').value = data.theme.text || '#0a0a0a';
  document.getElementById('iBorder').value = data.theme.border || '#e4e4e7';

  if (!data.page) data.page = {};
  document.getElementById('iColsDesktop').value = String(data.page.productsColsDesktop || 4);

  document.getElementById('iTitleStyle').value = (data.theme.titleStyle || 'a');
  document.getElementById('iTitleGlow').checked = (data.theme.titleGlow === true);

  if (!data.banner) data.banner = { enabled:false, text:'', bg:'#fee2e2', textColor:'#b91c1c', borderColor:'#fecaca', bold:true };
  if (data.banner.bold === undefined) data.banner.bold = true;

  document.getElementById('iBannerEnabled').checked = data.banner.enabled !== false;
  document.getElementById('iBannerText').value = data.banner.text || '';
  document.getElementById('iBannerBg').value = data.banner.bg || '#fee2e2';
  document.getElementById('iBannerTextColor').value = data.banner.textColor || '#b91c1c';
  document.getElementById('iBannerBorderColor').value = data.banner.borderColor || '#fecaca';
  document.getElementById('iBannerBold').checked = data.banner.bold !== false;

  document.getElementById('iProductsTitle').value = data.page.productsTitle || 'Kakobuy Products — Verified Picks';
  document.getElementById('iProductsSubtitle').value = data.page.productsSubtitle || 'Curated items with images, sellers, and categories — maintained by OGKako.com.';

  buildCategoryOptions();
  renderCategoryLinksEditor();
  renderProductsEditor();
}

function renderCategoryLinksEditor(){
  const list = document.getElementById('catLinksEditor');
  if (!list) return;

  list.innerHTML = '';
  const links = getCategoryLinksArray();

  const filterCat = (document.getElementById('iCatLinksFilter')?.value || '').trim();

  links.forEach((l, idx) => {
    if (!l) return;
    if (filterCat && normStr(l.category) !== filterCat) return;

    const row = document.getElementById('catLinkRowTpl').content.firstElementChild.cloneNode(true);
    row.dataset.lid = l.id || '';

    const enabledEl = row.querySelector('.cl-enabled');
    const labelEl = row.querySelector('.cl-label');
    const urlEl = row.querySelector('.cl-url');
    const imgEl = row.querySelector('.cl-image');

    const catSel = row.querySelector('.cl-category-select');
    const catNewWrap = row.querySelector('.cl-category-new-wrap');
    const catNew = row.querySelector('.cl-category-new');

    const varEl = row.querySelector('.cl-variant');
    const borderEl = row.querySelector('.cl-border');
    const textEl = row.querySelector('.cl-text');
    const priceColorEl = row.querySelector('.cl-pricecolor');
    const delBtn = row.querySelector('.del-link');

    enabledEl.checked = l.enabled !== false;
    labelEl.value = l.label || '';
    urlEl.value = l.url || '';
    imgEl.value = l.image || '';
    varEl.value = (l.variant || 'card');

    borderEl.value = l.borderColor || (data.theme?.border || '#e4e4e7');
    textEl.value = l.textColor || (data.theme?.text || '#0a0a0a');
    priceColorEl.value = l.priceColor || '#dc2626';

    function fillClCategorySelect() {
      const cur = normStr(l.category);
      const cats = getAllCategories();

      catSel.innerHTML = '';

      const optNone = document.createElement('option');
      optNone.value = '';
      optNone.textContent = '(none)';
      catSel.appendChild(optNone);

      cats.forEach(c => {
        const o = document.createElement('option');
        o.value = c;
        o.textContent = c;
        catSel.appendChild(o);
      });

      const optNew = document.createElement('option');
      optNew.value = '__new__';
      optNew.textContent = '+ Add new category…';
      catSel.appendChild(optNew);

      if (cur && cats.includes(cur)) {
        catSel.value = cur;
        catNewWrap.classList.add('hidden');
        catNew.value = '';
      } else if (cur) {
        catSel.value = '__new__';
        catNewWrap.classList.remove('hidden');
        catNew.value = cur;
      } else {
        catSel.value = '';
        catNewWrap.classList.add('hidden');
        catNew.value = '';
      }
    }

    fillClCategorySelect();

    enabledEl.addEventListener('change', ()=>{ l.enabled = enabledEl.checked; renderProductsPublic(); });
    labelEl.addEventListener('input', ()=>{ l.label = labelEl.value; renderProductsPublic(); });
    urlEl.addEventListener('input', ()=>{ l.url = urlEl.value; renderProductsPublic(); });
    imgEl.addEventListener('input', ()=>{ l.image = imgEl.value; renderProductsPublic(); });

    catSel.addEventListener('change', ()=>{
      const v = catSel.value;
      if (v === '__new__') {
        catNewWrap.classList.remove('hidden');
        catNew.focus();
        return;
      }
      catNewWrap.classList.add('hidden');
      catNew.value = '';
      l.category = v;
      buildCategoryOptions();
      renderProductsPublic();
      renderCategoryLinksEditor();
    });

    catNew.addEventListener('input', ()=>{
      l.category = catNew.value;
      if (catSel.value !== '__new__') catSel.value = '__new__';
      buildCategoryOptions();
      renderProductsPublic();
    });

    catNew.addEventListener('keydown', (e)=>{
      if (e.key === 'Enter') {
        e.preventDefault();
        l.category = normStr(catNew.value);
        buildCategoryOptions();
        fillClCategorySelect();
        renderProductsPublic();
        renderCategoryLinksEditor();
      }
    });

    varEl.addEventListener('change', ()=>{ l.variant = varEl.value; renderProductsPublic(); });

    borderEl.addEventListener('input', ()=>{ l.borderColor = borderEl.value; renderProductsPublic(); });
    textEl.addEventListener('input', ()=>{ l.textColor = textEl.value; renderProductsPublic(); });
    priceColorEl.addEventListener('input', ()=>{ l.priceColor = priceColorEl.value; renderProductsPublic(); });

    delBtn.addEventListener('click', ()=>{
      getCategoryLinksArray().splice(idx, 1);
      buildCategoryOptions();
      renderCategoryLinksEditor();
      renderProductsPublic();
    });

    row.addEventListener('dragstart', (e)=>{
      row.classList.add('opacity-60');
      e.dataTransfer.setData('text/plain', String(idx));
    });
    row.addEventListener('dragend', ()=> row.classList.remove('opacity-60'));
    row.addEventListener('dragover', (e)=> e.preventDefault());
    row.addEventListener('drop', (e)=>{
      e.preventDefault();
      const from = Number(e.dataTransfer.getData('text/plain'));
      const to = idx;
      if (Number.isNaN(from) || from === to) return;
      const arr = getCategoryLinksArray();
      const moved = arr.splice(from, 1)[0];
      arr.splice(to, 0, moved);
      renderCategoryLinksEditor();
      renderProductsPublic();
    });

    list.appendChild(row);
  });
}

function fillCategorySelect(selectEl, categories){
  const current = selectEl.value;

  selectEl.innerHTML = '';
  const optNone = document.createElement('option');
  optNone.value = '';
  optNone.textContent = '(none)';
  selectEl.appendChild(optNone);

  categories.forEach(c=>{
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    selectEl.appendChild(o);
  });

  const optNew = document.createElement('option');
  optNew.value = '__new__';
  optNew.textContent = '+ Add new category…';
  selectEl.appendChild(optNew);

  if ([...selectEl.options].some(o=>o.value===current)) selectEl.value = current;
}

function refreshAdminRowNumbers(){
  const rows = document.querySelectorAll('#productsEditor > li');
  rows.forEach((row, idx) => {
    row.dataset.idx = String(idx + 1);

    const numEl = row.querySelector('.p-num');
    if (numEl) numEl.textContent = '#' + pad3(idx + 1);

    const moveInput = row.querySelector('.p-move');
    if (moveInput) moveInput.value = '';
  });
}

function renderProductsEditor(){
  const list = document.getElementById('productsEditor');
  list.innerHTML = '';
  const adminPageNumEl = document.getElementById('adminPageNum');
  if (adminPageNumEl) adminPageNumEl.textContent = String(adminPage);
  
  const allItems = getProductsArray();

  // pagination slice
  const start = (adminPage - 1) * ADMIN_PAGE_SIZE;
  const end = start + ADMIN_PAGE_SIZE;

  const items = allItems.slice(start, end);

  items.forEach((p, i) => {
    const realIndex = start + i;
    const row = document.getElementById('productRowTpl').content.firstElementChild.cloneNode(true);
    row.dataset.pid = p.id || '';
    row.dataset.idx = String(start + i + 1); // ✅ NEW: for Find feature

    const labelEl = row.querySelector('.p-label');
    const urlEl   = row.querySelector('.p-url');
    const imgEl   = row.querySelector('.p-image');
    const priceEl = row.querySelector('.p-price');
    const sellerEl= row.querySelector('.p-seller');

    const catSel  = row.querySelector('.p-category-select');
    const catNewWrap = row.querySelector('.p-category-new-wrap');
    const catNew  = row.querySelector('.p-category-new');

    const updEl   = row.querySelector('.p-updated');
    const borderEl= row.querySelector('.p-border');
    const textEl  = row.querySelector('.p-text');
    const priceColorEl = row.querySelector('.p-pricecolor');
    const enabledEl = row.querySelector('.p-enabled');
    const clicksEl  = row.querySelector('.p-clicks');
    const delBtn    = row.querySelector('.del-product');
    const numEl     = row.querySelector('.p-num');
    const moveInput = row.querySelector('.p-move');
    const moveBtn   = row.querySelector('.move-product');
    moveInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        moveBtn.click();
      }
    });

    // ✅ NEW: set number text
    if (numEl) numEl.textContent = '#' + pad3(start + i + 1);

    labelEl.value = p.label || '';
    urlEl.value   = p.url || '';
    imgEl.value   = p.image || '';
    priceEl.value = p.price || '';
    sellerEl.value= p.seller || '';
    updEl.value   = p.updated || '';

    borderEl.value = p.borderColor || (data.theme?.border || '#e4e4e7');
    textEl.value   = p.textColor || (data.theme?.text || '#0a0a0a');
    priceColorEl.value = p.priceColor || '#dc2626';

    enabledEl.checked = p.enabled !== false;
    clicksEl.textContent = String(p.clicks || 0);

    const cats = getAllCategories();
    fillCategorySelect(catSel, cats);

    const currentCat = normStr(p.category);

    if (currentCat && cats.includes(currentCat)) {
      catSel.value = currentCat;
      catNewWrap.classList.add('hidden');
      catNew.value = '';
    } else if (currentCat) {
      catSel.value = '__new__';
      catNewWrap.classList.remove('hidden');
      catNew.value = currentCat;
    } else {
      catSel.value = '';
      catNewWrap.classList.add('hidden');
      catNew.value = '';
    }

    // ✅ FIX: Debounce public rendering while typing
    labelEl.addEventListener('input', ()=>{ p.label = labelEl.value; renderPublicDebounced(); });
    urlEl.addEventListener('input',   ()=>{ p.url = urlEl.value; /* no render needed */ });
    imgEl.addEventListener('input',   ()=>{ p.image = imgEl.value; renderPublicDebounced(); });
    priceEl.addEventListener('input', ()=>{ p.price = priceEl.value; renderPublicDebounced(); });
    sellerEl.addEventListener('input',()=>{ p.seller = sellerEl.value; renderPublicDebounced(); });
    updEl.addEventListener('input',   ()=>{ p.updated = updEl.value; renderPublicDebounced(); });

    catSel.addEventListener('change', ()=>{
      const v = catSel.value;
      if (v === '__new__') {
        catNewWrap.classList.remove('hidden');
        catNew.focus();
      } else {
        catNewWrap.classList.add('hidden');
        catNew.value = '';
        p.category = v;
        buildCategoryOptions();
        renderPublicDebounced(0); // ✅ immediate refresh for filter/category UI
      }
    });

    catNew.addEventListener('input', ()=>{
      p.category = catNew.value;
      if (catSel.value !== '__new__') catSel.value = '__new__';
      buildCategoryOptions();
      renderPublicDebounced();
    });

    borderEl.addEventListener('input',   ()=>{ p.borderColor = borderEl.value; renderPublicDebounced(); });
    textEl.addEventListener('input',     ()=>{ p.textColor = textEl.value; renderPublicDebounced(); });
    priceColorEl.addEventListener('input', ()=>{ p.priceColor = priceColorEl.value; renderPublicDebounced(); });

    enabledEl.addEventListener('change', ()=>{ p.enabled = enabledEl.checked; renderPublicDebounced(0); });

    moveBtn.addEventListener('click', () => {
      const to = Number(moveInput.value);
      if (!to || to < 1) return;

      const arr = getProductsArray();
      const from = start + i;
      const target = Math.min(Math.max(to - 1, 0), arr.length - 1);

      if (from === target) return;

      const moved = arr.splice(from, 1)[0];
      arr.splice(target, 0, moved);

      adminPage = Math.floor(target / ADMIN_PAGE_SIZE) + 1;
      renderProductsEditor();
    });

    delBtn.addEventListener('click', ()=>{
      data.products.splice(realIndex, 1);
      buildCategoryOptions();
      renderProductsEditor();
      renderPublicDebounced(0);
    });

    row.addEventListener('dragstart', (e)=>{
      row.classList.add('opacity-60');
      e.dataTransfer.setData('text/plain', String(realIndex));    });
    row.addEventListener('dragend', ()=>{
      row.classList.remove('opacity-60');
    });
    row.addEventListener('dragover', (e)=>{ e.preventDefault(); });
    row.addEventListener('drop', (e)=>{
      e.preventDefault();
      const from = Number(e.dataTransfer.getData('text/plain'));
      const to = realIndex;
      if (Number.isNaN(from) || from === to) return;
      const arr = getProductsArray();
      const moved = arr.splice(from, 1)[0];
      arr.splice(to, 0, moved);
      renderProductsEditor();
      renderPublicDebounced(0);
    });

    list.appendChild(row);
  });
}

function ensureDefaults(){
  if (!data.adminPassword) data.adminPassword = 'admin123';
  if (!data.profile) data.profile = { name:'', bio:'', avatar:'', socials:[] };
  if (!Array.isArray(data.profile.socials)) data.profile.socials = [];
  if (!data.page) data.page = {};
  if (!data.theme) data.theme = {};
  if (!('gridColsDesktop' in data.theme)) data.theme.gridColsDesktop = 4;
  if (!('productsColsDesktop' in data.page)) data.page.productsColsDesktop = 4;
  if (!('titleStyle' in data.theme)) data.theme.titleStyle = 'a';
  if (!('titleGlow' in data.theme)) data.theme.titleGlow = false;
  if (!data.banner) data.banner = {};
  if (!Array.isArray(data.ctas)) data.ctas = [];

  if (!Array.isArray(data.products)) data.products = [];
  data.products.forEach((p, idx)=>{
    if (!p.id) p.id = 'p' + String(Date.now()) + '-' + idx;
    if (p.enabled === undefined) p.enabled = true;
    if (p.clicks === undefined) p.clicks = 0;
    if (!p.priceColor) p.priceColor = '#dc2626';
  });

  if (!Array.isArray(data.categoryLinks)) data.categoryLinks = [];
  data.categoryLinks.forEach((l, idx)=>{
    if (!l.id) l.id = 'cl' + String(Date.now()) + '-' + idx;
    if (l.enabled === undefined) l.enabled = true;
    if (!l.variant) l.variant = 'card';

    if (!l.borderColor) l.borderColor = data.theme?.border || '#e4e4e7';
    if (!l.textColor) l.textColor = data.theme?.text || '#0a0a0a';
    if (!l.priceColor) l.priceColor = '#dc2626';
  });
}

document.addEventListener('input', (e)=>{
  const t = e.target;

  if (t.id === 'iName') { data.profile.name = t.value; renderPublicDebounced(); }
  else if (t.id === 'iBio') { data.profile.bio = t.value; renderPublicDebounced(); }
  else if (t.id === 'iAvatar') { data.profile.avatar = t.value; renderPublicDebounced(); }
  else if (t.id === 'iAdminPassword') { data.adminPassword = t.value; }

  else if (t.id === 'iPrimary') { data.theme.primary = t.value; applyTheme(); }
  else if (t.id === 'iBg') { data.theme.bg = t.value; applyTheme(); }
  else if (t.id === 'iText') { data.theme.text = t.value; applyTheme(); }
  else if (t.id === 'iBorder') { data.theme.border = t.value; applyTheme(); }

  else if (t.id === 'iColsDesktop') { data.page.productsColsDesktop = Number(t.value); applyTheme(); }

  else if (t.id === 'iBannerText') { if (!data.banner) data.banner = {}; data.banner.text = t.value; renderBanner(); }
  else if (t.id === 'iBannerBg') { if (!data.banner) data.banner = {}; data.banner.bg = t.value; renderBanner(); }
  else if (t.id === 'iBannerTextColor') { if (!data.banner) data.banner = {}; data.banner.textColor = t.value; renderBanner(); }
  else if (t.id === 'iBannerBorderColor') { if (!data.banner) data.banner = {}; data.banner.borderColor = t.value; renderBanner(); }

  else if (t.id === 'iProductsTitle') { data.page.productsTitle = t.value; renderPublicDebounced(); }
  else if (t.id === 'iProductsSubtitle') { data.page.productsSubtitle = t.value; renderPublicDebounced(); }
});

document.addEventListener('change', (e)=>{
  const t = e.target;

  if (t.id === 'iFont') { data.theme.font = t.value; applyTheme(); }
  else if (t.id === 'iTitleStyle') { data.theme.titleStyle = t.value; applyTheme(); }
  else if (t.id === 'iTitleGlow') { data.theme.titleGlow = t.checked; applyTheme(); }

  else if (t.id === 'iBannerEnabled') { if (!data.banner) data.banner = {}; data.banner.enabled = t.checked; renderBanner(); }
  else if (t.id === 'iBannerBold') { if (!data.banner) data.banner = {}; data.banner.bold = t.checked; renderBanner(); }

  else if (t.id === 'iCatLinksFilter') { renderCategoryLinksEditor(); }
});

document.getElementById('q')?.addEventListener('input', () => renderPublicDebounced(180, true));

document.getElementById('q')?.addEventListener('search', (e) => {
  e.target.blur();
  renderPublicDebounced(0, true);
});

document.getElementById('q')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.target.blur();
    renderPublicDebounced(0, true);
  }
});

document.getElementById('cat')?.addEventListener('change', ()=>{
  const sel = document.getElementById('cat');
  const cur = (sel?.value || '').trim();

  // ✅ write category into URL
  const u = new URL(location.href);
  if (cur) u.searchParams.set('cat', cur);
  else u.searchParams.delete('cat');
  history.replaceState(null, '', u.toString());

  // pill logic
  const pill = document.getElementById('urlCatPill');
  const pillText = document.getElementById('urlCatPillText');
  if (pill && pillText) {
    if (cur) {
      pillText.textContent = cur;
      pill.classList.remove('hidden');
    } else {
      pill.classList.add('hidden');
    }
  }

  renderPublicDebounced(0, true);
});

document.getElementById('searchGoBtn')?.addEventListener('click', () => {
  const q = document.getElementById('q');
  if (!q) return;

  q.blur();
  renderPublicDebounced(0, true);
});

document.getElementById('clearBtn')?.addEventListener('click', ()=>{
  document.getElementById('q').value = '';
  document.getElementById('cat').value = '';
  const pill = document.getElementById('urlCatPill');
  if (pill) pill.classList.add('hidden');

  const u = new URL(location.href);
  u.searchParams.delete('cat');
  history.replaceState(null, '', u.toString());

  renderPublicDebounced(0, true);
});

document.getElementById('saveBtn')?.addEventListener('click', async ()=>{
  const ok = await saveConfig();
  alert(ok ? 'Saved to server!' : 'Save failed');
});

document.getElementById('saveBtnBottom')?.addEventListener('click', async ()=>{
  const ok = await saveConfig();
  alert(ok ? 'Saved to server!' : 'Save failed');
});

document.getElementById('adminPrevPage')?.addEventListener('click', () => {
  if (adminPage > 1) {
    adminPage--;
    renderProductsEditor();
  }
});

document.getElementById('adminNextPage')?.addEventListener('click', () => {
  const totalPages = Math.max(1, Math.ceil(getProductsArray().length / ADMIN_PAGE_SIZE));
  if (adminPage < totalPages) {
    adminPage++;
    renderProductsEditor();
  }
});

document.getElementById('loadBtn')?.addEventListener('click', async ()=>{
  await init();
  alert('Reloaded from server');
});

function addProduct() {
  const arr = getProductsArray();
  const id = 'p' + String(Date.now());

  arr.push({
    id,
    label: 'New Product',
    url: '#',
    image: '',
    price: '',
    seller: '',
    category: '',
    updated: '',
    enabled: true,
    clicks: 0,
    borderColor: data.theme?.border || '#e4e4e7',
    textColor: data.theme?.text || '#0a0a0a',
    priceColor: '#dc2626'
  });

  buildCategoryOptions();

  adminPage = Math.ceil(arr.length / ADMIN_PAGE_SIZE);
  renderProductsEditor();
  renderPublicDebounced(0);

  setTimeout(() => {
    const rows = document.querySelectorAll('#productsEditor > li');
    const newRow = rows[rows.length - 1];
    if (newRow) {
      newRow.scrollIntoView({ behavior: 'auto', block: 'center' });
      newRow.classList.add('ring-2', 'ring-pink-400');
      setTimeout(() => newRow.classList.remove('ring-2', 'ring-pink-400'), 1200);
    }
  }, 0);
}

document.getElementById('addProductBtn')?.addEventListener('click', addProduct);
document.getElementById('addProductBtnBottom')?.addEventListener('click', addProduct);

document.getElementById('addCatLinkBtn')?.addEventListener('click', ()=>{
  const arr = getCategoryLinksArray();
  const id = 'cl' + String(Date.now());
  const curCat = (document.getElementById('cat')?.value || '').trim();
  arr.push({
    id,
    label: 'New Link Card',
    url: '#',
    image: '',
    category: curCat || '',
    variant: 'card',
    enabled: true,
    borderColor: data.theme?.border || '#e4e4e7',
    textColor: data.theme?.text || '#0a0a0a',
    priceColor: '#dc2626'
  });
  buildCategoryOptions();
  renderCategoryLinksEditor();
  renderProductsPublic();
});

(function wireResetProductClicks(){
  const btn = document.getElementById('resetProductClicksBtn');
  if (!btn) return;
  btn.addEventListener('click', async ()=>{
    if (!confirm('Reset ALL product click counters to 0?')) return;
    getProductsArray().forEach(p => p.clicks = 0);
    renderProductsEditor();
    renderProductsPublic();
    const ok = await saveConfig();
    alert(ok ? 'Product clicks reset + saved.' : 'Reset locally, but save failed.');
  });
})();

// ✅ NEW: Find feature (jump to row by # or match text)
function adminFind(){
  const q = normStr(document.getElementById('adminFind')?.value || '');
  if (!q) return;

  const list = document.getElementById('productsEditor');
  if (!list) return;

  // number search
  const asNum = Number(q.replace(/^#/, '').trim());
  if (!Number.isNaN(asNum) && asNum > 0) {
    const total = getProductsArray().length;
    if (asNum > total) {
      alert('That product number does not exist.');
      return;
    }

    adminPage = Math.floor((asNum - 1) / ADMIN_PAGE_SIZE) + 1;
    renderProductsEditor();

    const row = document.querySelector(`#productsEditor li[data-idx="${asNum}"]`);
    if (row) {
      row.scrollIntoView({ behavior:'smooth', block:'center' });
      row.classList.add('ring-2','ring-blue-500');
      setTimeout(()=>row.classList.remove('ring-2','ring-blue-500'), 1200);
    }
    return;
  }

  // text search (label/seller/category/url)
  const items = getProductsArray();
  const needle = q.toLowerCase();
  const hitIdx = items.findIndex(p => {
    const hay = [
      normStr(p?.label),
      normStr(p?.seller),
      normStr(p?.category),
      normStr(p?.url),
      normStr(p?.price)
    ].join(' ').toLowerCase();
    return hay.includes(needle);
  });

  if (hitIdx >= 0) {
    const row = list.querySelector(`li[data-idx="${hitIdx + 1}"]`);
    if (row) {
      row.scrollIntoView({ behavior:'smooth', block:'center' });
      row.classList.add('ring-2','ring-blue-500');
      setTimeout(()=>row.classList.remove('ring-2','ring-blue-500'), 1200);
    }
  } else {
    alert('No match found in products.');
  }
}

document.getElementById('adminFindBtn')?.addEventListener('click', adminFind);
document.getElementById('adminFind')?.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter') { e.preventDefault(); adminFind(); }
});

async function init(){
  await loadConfig();
  ensureDefaults();

  renderHeader();
  buildCategoryOptions();
  applyUrlCategoryIfPresent();

  setTimeout(() => {
    renderProductsGridOnly();
  }, 100);

  if (isAdmin()) renderAdmin();
}

window.addEventListener('scroll', () => {
  if (publicRenderedCount >= publicFilteredProducts.length) return;

  const nearBottom =
    window.innerHeight + window.scrollY >= document.body.offsetHeight - 900;

  if (nearBottom) {
    renderNextProductBatch();
  }
});

// ✅ Favorites filter listener
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#favFilterBtn');
  if (!btn) return;

  e.preventDefault();

  favoritesOnly = !favoritesOnly;

  if (favoritesOnly) {
    const q = document.getElementById('q');
    const cat = document.getElementById('cat');
    const pill = document.getElementById('urlCatPill');

    if (q) q.value = '';
    if (cat) cat.value = '';
    if (pill) pill.classList.add('hidden');

    const u = new URL(location.href);
    u.searchParams.delete('cat');
    history.replaceState(null, '', u.toString());
  }

  btn.classList.toggle('fav-filter-active', favoritesOnly);
  btn.innerHTML = favoritesOnly ? '❤️ Favorites ✓' : '❤️ Favorites';

  const floating = document.getElementById('floatingFavBtn');
  if (floating) {
    floating.classList.toggle('active', favoritesOnly);
    floating.innerHTML = favoritesOnly ? '❤️ Favorites ✓' : '❤️ Favorites';
  }

  buildCategoryPills();
  renderProductsGridOnly();
});

// ✅ Floating favorites button listener
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#floatingFavBtn');
  if (!btn) return;

  e.preventDefault();

  const mainBtn = document.getElementById('favFilterBtn');

  if (mainBtn) {
    mainBtn.click();
    return;
  }

  favoritesOnly = !favoritesOnly;

  btn.classList.toggle('active', favoritesOnly);
  btn.innerHTML = favoritesOnly ? '❤️ Favorites ✓' : '❤️ Favorites';

  renderProductsGridOnly();
});

// ✅ Clear button fallback: reset search, category, URL cat, and favorites
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#clearBtn');
  if (!btn) return;

  e.preventDefault();

  const q = document.getElementById('q');
  if (q) q.value = '';

  const cat = document.getElementById('cat');
  if (cat) cat.value = '';

  favoritesOnly = false;

  const favBtn = document.getElementById('favFilterBtn');
  if (favBtn) {
    favBtn.classList.remove('fav-filter-active');
    favBtn.innerHTML = '❤️ Favorites';
  }

  const floating = document.getElementById('floatingFavBtn');
  if (floating) {
    floating.classList.remove('active');
    floating.innerHTML = '❤️ Favorites';
  }

  const pill = document.getElementById('urlCatPill');
  if (pill) pill.classList.add('hidden');

  const u = new URL(location.href);
  u.searchParams.delete('cat');
  history.replaceState(null, '', u.toString());

  buildCategoryPills();
  renderProductsGridOnly();
});

// Link Wrapper IIFE helper script
(function () {
  const ORIGIN = location.origin;

  function isExternal(href) {
    if (!href) return false;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false;
    if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) return false;
    try {
      const u = new URL(href, ORIGIN);
      return u.origin !== ORIGIN;
    } catch { return false; }
  }

  function alreadyWrapped(href) {
    try {
      const u = new URL(href, ORIGIN);
      return u.pathname.endsWith('/go.html') && u.searchParams.has('u');
    } catch { return false; }
  }

  function wrapEl(a) {
    if (!a || a.dataset.noWrap === '1') return;
    const href = a.getAttribute('href');
    if (!href || alreadyWrapped(href) || !isExternal(href)) return;
    const resolved = new URL(href, ORIGIN).toString();
    const wrapped = '/go.html?u=' + encodeURIComponent(resolved);
    a.setAttribute('href', wrapped);
    if (!a.hasAttribute('target')) a.setAttribute('target', '_blank');
    const rel = (a.getAttribute('rel') || '').split(/\s+/);
    ['noopener','nofollow','sponsored'].forEach(x => { if (!rel.includes(x)) rel.push(x); });
    a.setAttribute('rel', rel.join(' ').trim());
    a.dataset.wrapped = '1';
  }

  function wrapAll(scope) {
    (scope.querySelectorAll ? scope : document).querySelectorAll('a[href]').forEach(wrapEl);
  }

  document.addEventListener('DOMContentLoaded', function () { wrapAll(document); });

  const mo = new MutationObserver(muts => {
    muts.forEach(m => {
      if (m.type === 'childList') {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (node.tagName === 'A') wrapEl(node);
            else wrapAll(node);
          }
        });
      } else if (m.type === 'attributes' && m.attributeName === 'href' && m.target.tagName === 'A') {
        wrapEl(m.target);
      }
    });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });

  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || a.dataset.noWrap === '1' || alreadyWrapped(href) || !isExternal(href)) return;
    e.preventDefault();
    const resolved = new URL(href, ORIGIN).toString();
    const wrapped = '/go.html?u=' + encodeURIComponent(resolved);
    const target = (a.getAttribute('target') || '_self');
    if (target === '_blank') window.open(wrapped);
    else location.href = wrapped;
  }, true);
})();

// Dark Mode Toggle & Top Button IIFE script
(function(){
  function updateDarkButton(){
    const btn = document.getElementById('darkModeBtn');
    if (!btn) return;

    btn.innerHTML =
      document.body.classList.contains('dark-mode')
        ? '<i class="fa-solid fa-sun"></i>'
        : '<i class="fa-solid fa-moon"></i>';
  }

  if (localStorage.getItem('og_dark_mode') === '1') {
    document.body.classList.add('dark-mode');
  }

  document.addEventListener('click', function(e){
    const btn = e.target.closest('#darkModeBtn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    document.body.classList.toggle('dark-mode');

    localStorage.setItem(
      'og_dark_mode',
      document.body.classList.contains('dark-mode') ? '1' : '0'
    );

    updateDarkButton();
  }, true);

  document.addEventListener('DOMContentLoaded', updateDarkButton);

  document.addEventListener('click', function(e){
    const topBtn = e.target.closest('#backTopBtn');
    if (!topBtn) return;

    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// Footer fetching logic script
document.addEventListener('DOMContentLoaded', function () {
  fetch("/footer.html")
    .then(res => {
      if (res.ok) return res.text();
      throw new Error('Footer not found');
    })
    .then(html => {
      const el = document.getElementById("footer-placeholder");
      if (el) el.innerHTML = html;
    })
    .catch(err => console.warn(err));
});

// Admin Login Modal & Tabs Wire Up
(function wireAdminDashboard() {
  // Modal toggle
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#adminLoginBtn');
    if (!btn) return;
    e.preventDefault();
    
    if (isAdmin()) {
      if (confirm('Do you want to log out of admin mode?')) {
        localStorage.removeItem('isAdmin');
        // If there's an admin parameter in the URL, remove it too
        const u = new URL(location.href);
        u.searchParams.delete('admin');
        location.href = u.pathname + u.search;
      }
    } else {
      const modal = document.getElementById('adminLoginModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
          modal.classList.remove('opacity-0');
          modal.querySelector('.transform').classList.remove('scale-95');
          modal.querySelector('.transform').classList.add('scale-100');
          modal.querySelector('input').focus();
        }, 10);
      }
    }
  });

  const closeModal = () => {
    const modal = document.getElementById('adminLoginModal');
    if (modal) {
      modal.classList.add('opacity-0');
      modal.querySelector('.transform').classList.remove('scale-100');
      modal.querySelector('.transform').classList.add('scale-95');
      setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.getElementById('loginErrorMsg').classList.add('hidden');
        document.getElementById('adminPasswordInput').value = '';
      }, 300);
    }
  };

  document.getElementById('closeLoginModal')?.addEventListener('click', closeModal);
  
  // Close on clicking backdrop
  document.getElementById('adminLoginModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'adminLoginModal') {
      closeModal();
    }
  });

  // Login form submit
  document.getElementById('adminLoginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('adminPasswordInput').value;
    const actualPass = data?.adminPassword || 'admin123';
    
    if (input === actualPass) {
      localStorage.setItem('isAdmin', 'true');
      closeModal();
      location.reload();
    } else {
      document.getElementById('loginErrorMsg').classList.remove('hidden');
      const inputEl = document.getElementById('adminPasswordInput');
      inputEl.focus();
      inputEl.select();
    }
  });

  // Tabs Switching
  const tabs = ['General', 'Links', 'Products'];
  tabs.forEach(tabName => {
    const btn = document.getElementById(`btnTab${tabName}`);
    btn?.addEventListener('click', () => {
      // Deactivate all
      tabs.forEach(tName => {
        const b = document.getElementById(`btnTab${tName}`);
        const content = document.getElementById(`adminTab-${tName.toLowerCase()}`);
        if (b) {
          b.classList.remove('active', 'border-b-2', 'border-blue-600', 'text-blue-600', 'dark:text-blue-400', 'dark:border-blue-400');
          b.classList.add('border-transparent', 'text-zinc-500', 'dark:text-zinc-400');
        }
        if (content) content.classList.add('hidden');
      });

      // Activate clicked
      btn.classList.add('active', 'border-b-2', 'border-blue-600', 'text-blue-600', 'dark:text-blue-400', 'dark:border-blue-400');
      btn.classList.remove('border-transparent', 'text-zinc-500', 'dark:text-zinc-400');
      
      const activeContent = document.getElementById(`adminTab-${tabName.toLowerCase()}`);
      if (activeContent) activeContent.classList.remove('hidden');
    });
  });
})();

init();
