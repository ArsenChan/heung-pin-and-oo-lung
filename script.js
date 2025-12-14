// 自動同步預留接口、描述與兩個標籤上載、標籤搜尋、背景顏色/封面工具恢復、長按刪單張
let photos = [];
let editMode = false;

// 後端 API（GitHub App/雲端函式）。設定後將在變更時自動同步。
const SYNC_ENDPOINT = ""; // 例如 https://your-app.example.com/sync

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  bindEditToggle();
  loadPhotos();
  restoreEditableTexts();
  bindLocalUpload();
  bindBackgroundTools();
  bindStoryTimelineTools();
  enableAboutEditable(false);
  autoSyncIfConfigured(); // 首次載入可視需要同步
});

async function loadPhotos() {
  try {
    const res = await fetch('photos.json', { cache: 'no-store' });
    photos = await res.json();
  } catch {
    photos = [];
  }
  const local = getLocalPhotos();
  const all = cleanupInvalid([...local, ...photos]);
  renderGallery(all);
  setupFilters(all);
}

function cleanupInvalid(list) {
  return (list || []).filter(p => {
    const src = p?.dataUrl || p?.src;
    return !!src && typeof src === 'string' && src.trim() !== '';
  });
}

function renderGallery(list) {
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = (list||[]).map((p, idx) => {
    const src = p.dataUrl || p.src;
    const alt = p.title || '相片';
    const desc = p.desc || '';
    const tags = Array.isArray(p.tags) ? p.tags : [];
    return `
    <figure class="photo" data-idx="${idx}">
      <img src="${src}" alt="${alt}" loading="lazy" onerror="this.onerror=null;this.remove();">
      <figcaption class="meta">
        <div>${alt}${desc ? ' · ' + escapeHTML(desc) : ''} · <time datetime="${p.date||''}">${p.date||''}</time></div>
        <div class="tags">${tags.map(t => `<span class="tag">${escapeHTML(t)}</span>`).join('')}</div>
      </figcaption>
    </figure>`;
  }).join('');
  enableLongPressDelete();
}

function setupFilters(base) {
  const search = document.getElementById('search');
  const tagFilter = document.getElementById('tagFilter');
  const apply = () => {
    const q = (search.value||'').trim().toLowerCase();
    const tag = tagFilter.value;
    const filtered = base.filter(p => {
      const text = `${p.title||''} ${(p.desc||'')} ${(p.tags||[]).join(' ')}`.toLowerCase();
      const inText = !q || text.includes(q);
      const inTag = !tag || (p.tags||[]).includes(tag);
      return inText && inTag;
    });
    renderGallery(filtered);
  };
  search.addEventListener('input', apply);
  tagFilter.addEventListener('change', apply);
}

function bindEditToggle() {
  const btn = document.getElementById('editToggle');
  btn.addEventListener('click', () => {
    editMode = !editMode;
    btn.setAttribute('aria-pressed', String(editMode));
    btn.textContent = editMode ? '退出編輯模式' : '進入編輯模式';
    toggleEditableTexts(editMode);
    document.getElementById('photoEditor').hidden = !editMode;
    document.getElementById('timelineTools').hidden = !editMode;
    document.getElementById('storyTools').hidden = !editMode;
    enableAboutEditable(editMode);
    if (!editMode) {
      saveEditableTexts();
      autoSyncIfConfigured(); // 編輯完成後自動同步
    }
  });
}

function toggleEditableTexts(enabled) {
  const selectors = [
    '#siteTitle','#navBar','#navGallery','#navTimeline','#navStories','#navAbout',
    '#heroTitle','#heroDesc','#galleryTitle','#timelineTitle','#storiesTitle','#aboutTitle','#footerText',
    '#timelineList time','#timelineList span','#storiesList .card h3','#storiesList .card p'
  ];
  selectors.forEach(sel => document.querySelectorAll(sel).forEach(el => {
    el.setAttribute('contenteditable', String(enabled));
    el.style.outline = enabled ? '1px dashed #f59fb0' : 'none';
  }));
}

function enableAboutEditable(enabled) {
  document.querySelectorAll('#about .card h3, #about .card li').forEach(el => {
    el.setAttribute('contenteditable', String(enabled));
    el.style.outline = enabled ? '1px dashed #f59fb0' : 'none';
  });
}

function saveEditableTexts() {
  const data = {};
  document.querySelectorAll('[contenteditable="true"]').forEach(el => {
    const key = el.id || el.tagName + ':' + (el.textContent.slice(0,10));
    data[key] = el.innerHTML;
  });
  data.timelineHTML = document.getElementById('timelineList').innerHTML;
  data.storiesHTML = document.getElementById('storiesList').innerHTML;
  data.aboutHTML = document.getElementById('about').innerHTML;
  localStorage.setItem('catSiteTexts', JSON.stringify(data));
}

function restoreEditableTexts() {
  const raw = localStorage.getItem('catSiteTexts');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data.timelineHTML) document.getElementById('timelineList').innerHTML = data.timelineHTML;
    if (data.storiesHTML) document.getElementById('storiesList').innerHTML = data.storiesHTML;
    if (data.aboutHTML) document.getElementById('about').innerHTML = data.aboutHTML;
    Object.entries(data).forEach(([key, html]) => {
      const el = document.getElementById(key);
      if (el) el.innerHTML = html;
    });
  } catch {}
}

function bindStoryTimelineTools() {
  const addStory = document.getElementById('addStory');
  if (addStory) {
    addStory.addEventListener('click', () => {
      const wrap = document.getElementById('storiesList');
      const node = document.createElement('article');
      node.className = 'card';
      node.innerHTML = '<h3 contenteditable="true">新故事標題</h3><p contenteditable="true">請輸入內容…</p>';
      wrap.prepend(node);
    });
  }
  const addTL = document.getElementById('addTimelineItem');
  if (addTL) {
    addTL.addEventListener('click', () => {
      const ul = document.getElementById('timelineList');
      const li = document.createElement('li');
      li.innerHTML = '<time datetime="" contenteditable="true">YYYY-MM-DD</time> <span contenteditable="true">里程碑內容</span>';
      ul.prepend(li);
    });
  }
}

function bindBackgroundTools() {
  const picker = document.getElementById('bgColorPicker');
  const saved = localStorage.getItem('bgColor');
  if (saved) document.documentElement.style.setProperty('--bg', saved);
  if (picker) {
    picker.addEventListener('input', e => {
      const val = e.target.value;
      document.documentElement.style.setProperty('--bg', val);
      localStorage.setItem('bgColor', val);
      autoSyncIfConfigured(); // 背景色變更後自動同步
    });
  }
  const heroUpload = document.getElementById('heroUpload');
  if (heroUpload) {
    heroUpload.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const dataUrl = await fileToDataURL(file, 1600);
      document.getElementById('heroImage').src = dataUrl;
      localStorage.setItem('heroImage', dataUrl);
      autoSyncIfConfigured(); // 封面圖變更後自動同步
    });
    const savedHero = localStorage.getItem('heroImage');
    if (savedHero) document.getElementById('heroImage').src = savedHero;
  }
}

function bindLocalUpload() {
  const input = document.getElementById('localUpload');
  const descInput = document.getElementById('uploadDesc');
  const tagsInput = document.getElementById('uploadTags');
  if (!input) return;
  input.addEventListener('change', async e => {
    const files = Array.from(e.target.files||[]);
    const newRecords = [];
    const desc = (descInput?.value || '').trim();
    const tagsRaw = (tagsInput?.value || '').trim();
    const tags = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean).slice(0,2) : [];
    for (const f of files) {
      const dataUrl = await fileToDataURL(f, 1600);
      newRecords.push({
        dataUrl,
        title: f.name,
        desc,
        date: new Date().toISOString().slice(0,10),
        tags
      });
    }
    const existing = getLocalPhotos();
    const merged = cleanupInvalid([...newRecords, ...existing]);
    localStorage.setItem('catLocalPhotos', JSON.stringify(merged));
    renderGallery([...merged, ...photos]);
    autoSyncIfConfigured(); // 上載相片後自動同步
  });
}

function enableLongPressDelete() {
  const grid = document.getElementById('galleryGrid');
  const local = getLocalPhotos();
  grid.querySelectorAll('.photo').forEach((fig) => {
    let timer;
    const start = () => {
      timer = setTimeout(() => {
        if (!confirm('刪除呢張相？')) return;
        const img = fig.querySelector('img');
        const src = img?.getAttribute('src') || '';
        const remained = local.filter(p => (p.dataUrl||p.src) !== src);
        localStorage.setItem('catLocalPhotos', JSON.stringify(remained));
        renderGallery([...remained, ...photos]);
        autoSyncIfConfigured(); // 刪除相片後自動同步
      }, 800);
    };
    const cancel = () => clearTimeout(timer);
    fig.addEventListener('touchstart', start);
    fig.addEventListener('touchend', cancel);
    fig.addEventListener('mousedown', start);
    fig.addEventListener('mouseup', cancel);
    fig.addEventListener('mouseleave', cancel);
  });
}

function getLocalPhotos() {
  const raw = localStorage.getItem('catLocalPhotos');
  if (!raw) return [];
  try { return JSON.parse(raw)||[]; } catch { return []; }
}

// 自動同步：如設定了 SYNC_ENDPOINT，將本機資料（文字/相片/主題/封面）POST 到後端
async function autoSyncIfConfigured() {
  if (!SYNC_ENDPOINT) return; // 未配置後端則不執行
  const payload = collectSyncPayload();
  try {
    const res = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
    // 後端成功寫入 repo 後，建議回傳最新照片資料；可視需要重新載入
    // await loadPhotos();
  } catch (e) {
    console.warn('自動同步失敗（稍後可再試）：', e.message);
  }
}

function collectSyncPayload() {
  const texts = {};
  document.querySelectorAll('[contenteditable="true"]').forEach(el => {
    if (el.id) texts[el.id] = el.innerHTML;
  });
  const photos = getLocalPhotos();
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const hero = localStorage.getItem('heroImage') || '';
  return { texts, photos, theme: { bg }, hero };
}

function fileToDataURL(file, maxWidth=1600) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth/img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width*scale);
        canvas.height = Math.round(img.height*scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
