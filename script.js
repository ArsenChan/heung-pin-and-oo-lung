// 編輯模式與相片渲染（含本機上載）
let photos = [];
let editMode = false;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  bindEditToggle();
  loadPhotos();
  restoreEditableTexts();
  bindPhotoEditor();
  bindBackgroundTools();
  bindStoryTimelineTools();
});

// 載入相片 JSON
async function loadPhotos() {
  try {
    const res = await fetch('photos.json', { cache: 'no-store' });
    photos = await res.json();
  } catch (e) {
    photos = [];
  }
  // 合併本機相片
  const local = getLocalPhotos();
  const all = [...local, ...photos];
  renderGallery(all);
  setupFilters(all);
}

function renderGallery(list) {
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = (list || []).map(p => {
    const src = p.dataUrl || p.src;
    const alt = p.title || '相片';
    return `
    <figure class="photo">
      <img src="${src}" alt="${alt}" loading="lazy" onerror="this.onerror=null;this.src='images/cover.svg'">
      <figcaption class="meta">
        <div>${alt} · <time datetime="${p.date||''}">${p.date||''}</time></div>
        <div class="tags">${(p.tags||[]).map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </figcaption>
    </figure>`;
  }).join('');
}

function setupFilters(base) {
  const search = document.getElementById('search');
  const tagFilter = document.getElementById('tagFilter');
  const apply = () => {
    const q = (search.value || '').trim().toLowerCase();
    const tag = tagFilter.value;
    const filtered = base.filter(p => {
      const text = `${p.title||''} ${(p.tags||[]).join(' ')}`.toLowerCase();
      const inText = !q || text.includes(q);
      const inTag = !tag || (p.tags||[]).includes(tag);
      return inText && inTag;
    });
    renderGallery(filtered);
  };
  search.addEventListener('input', apply);
  tagFilter.addEventListener('change', apply);
}

// 編輯模式開關
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
    if (!editMode) saveEditableTexts();
  });
}

// 可編輯元素：幾乎全頁文字
function getEditableElements() {
  return Array.from(document.querySelectorAll('[contenteditable]')); 
}

function toggleEditableTexts(enabled) {
  const ids = [
    '#siteTitle', '#navBar', '#navGallery', '#navTimeline', '#navStories', '#navAbout',
    '#heroTitle', '#heroDesc', '#galleryTitle', '#timelineTitle', '#storiesTitle', '#aboutTitle', '#footerText',
    '#timelineList time', '#timelineList span', '#storiesList .card h3', '#storiesList .card p'
  ];
  ids.forEach(sel => document.querySelectorAll(sel).forEach(el => {
    el.setAttribute('contenteditable', String(enabled));
    el.style.outline = enabled ? '1px dashed #f59fb0' : 'none';
  }));
}

function saveEditableTexts() {
  const data = {};
  document.querySelectorAll('[contenteditable="true"]').forEach(el => {
    const key = el.id || el.tagName + ':' + (el.textContent.slice(0,10));
    data[key] = el.innerHTML;
  });
  data.timelineHTML = document.getElementById('timelineList').innerHTML;
  data.storiesHTML = document.getElementById('storiesList').innerHTML;
  localStorage.setItem('catSiteTexts', JSON.stringify(data));
}

function restoreEditableTexts() {
  const raw = localStorage.getItem('catSiteTexts');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data.timelineHTML) document.getElementById('timelineList').innerHTML = data.timelineHTML;
    if (data.storiesHTML) document.getElementById('storiesList').innerHTML = data.storiesHTML;
    Object.entries(data).forEach(([key, html]) => {
      const el = document.getElementById(key);
      if (el) el.innerHTML = html;
    });
  } catch {}
}

// 故事與時光軸新增
function bindStoryTimelineTools() {
  const addStory = document.getElementById('addStory');
  addStory.addEventListener('click', () => {
    const wrap = document.getElementById('storiesList');
    const node = document.createElement('article');
    node.className = 'card';
    node.innerHTML = '<h3 contenteditable="true">新故事標題</h3><p contenteditable="true">請輸入內容…</p>';
    wrap.prepend(node);
  });
  const addTL = document.getElementById('addTimelineItem');
  addTL.addEventListener('click', () => {
    const ul = document.getElementById('timelineList');
    const li = document.createElement('li');
    li.innerHTML = '<time datetime="" contenteditable="true">YYYY-MM-DD</time> <span contenteditable="true">里程碑內容</span>';
    ul.prepend(li);
  });
}

// 背景與封面
function bindBackgroundTools() {
  const bgPicker = document.getElementById('bgColorPicker');
  if (bgPicker) {
    const saved = localStorage.getItem('bgColor');
    if (saved) document.documentElement.style.setProperty('--bg', saved);
    bgPicker.addEventListener('input', e => {
      const val = e.target.value;
      document.documentElement.style.setProperty('--bg', val);
      localStorage.setItem('bgColor', val);
    });
  }
  const heroUpload = document.getElementById('heroUpload');
  if (heroUpload) {
    heroUpload.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;
      const dataUrl = await fileToDataURL(file, 1600);
      const img = document.getElementById('heroImage');
      img.src = dataUrl;
      localStorage.setItem('heroImage', dataUrl);
    });
    const savedHero = localStorage.getItem('heroImage');
    if (savedHero) document.getElementById('heroImage').src = savedHero;
  }
}

// 本機上載（多檔）
function bindPhotoEditor() {
  const input = document.getElementById('localUpload');
  const clearBtn = document.getElementById('clearLocalPhotos');
  if (input) {
    input.addEventListener('change', async e => {
      const files = Array.from(e.target.files || []);
      const newRecords = [];
      for (const f of files) {
        const dataUrl = await fileToDataURL(f, 1600);
        newRecords.push({ dataUrl, title: f.name, date: new Date().toISOString().slice(0,10), tags: [] });
      }
      const existing = getLocalPhotos();
      const merged = [...newRecords, ...existing];
      localStorage.setItem('catLocalPhotos', JSON.stringify(merged));
      renderGallery([...merged, ...photos]);
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      localStorage.removeItem('catLocalPhotos');
      renderGallery(photos);
    });
  }

  // 以路徑新增（同步 JSON）
  const addBtn = document.getElementById('addPhoto');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const src = document.getElementById('newSrc').value.trim();
      const date = document.getElementById('newDate').value.trim();
      const title = document.getElementById('newTitle').value.trim();
      const tagsRaw = document.getElementById('newTags').value.trim();
      if (!src || !title) { alert('請填圖片路徑同標題'); return; }
      const tags = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
      const record = { src, date, title, tags };
      const existing = getLocalPhotos();
      const merged = [record, ...existing];
      localStorage.setItem('catLocalPhotos', JSON.stringify(merged));
      renderGallery([...merged, ...photos]);
      ['newSrc','newDate','newTitle','newTags'].forEach(id => document.getElementById(id).value = '');
    });
  }
}

function getLocalPhotos() {
  const raw = localStorage.getItem('catLocalPhotos');
  if (!raw) return [];
  try { return JSON.parse(raw) || []; } catch { return []; }
}

// 工具：檔案轉 DataURL 並壓縮寬度
function fileToDataURL(file, maxWidth = 1600) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
