// 編輯模式與相片渲染（長按刪單張、背景色修正、About全可編輯）
let photos = [];
let editMode = false;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  bindEditToggle();
  loadPhotos();
  restoreEditableTexts();
  bindLocalUpload();
  bindBackgroundTools();
  bindStoryTimelineTools();
  enableAboutEditable(false);
});

async function loadPhotos() {
  try {
    const res = await fetch('photos.json', { cache: 'no-store' });
    photos = await res.json();
  } catch {
    photos = [];
  }
  const local = getLocalPhotos();
  renderGallery([...local, ...photos]);
  setupFilters([...local, ...photos]);
}

function renderGallery(list) {
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = (list||[]).map((p, idx) => {
    const src = p.dataUrl || p.src;
    const alt = p.title || '相片';
    return `
    <figure class="photo" data-idx="${idx}">
      <img src="${src}" alt="${alt}" loading="lazy" onerror="this.onerror=null;this.src='images/cover.svg'">
      <figcaption class="meta">
        <div>${alt} · <time datetime="${p.date||''}">${p.date||''}</time></div>
        <div class="tags">${(p.tags||[]).map(t => `<span class="tag">${t}</span>`).join('')}</div>
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
    if (!editMode) saveEditableTexts();
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

function bindBackgroundTools() {
  const picker = document.getElementById('bgColorPicker');
  const saved = localStorage.getItem('bgColor');
  if (saved) document.documentElement.style.setProperty('--bg', saved);
  if (picker) {
    picker.addEventListener('input', e => {
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
      document.getElementById('heroImage').src = dataUrl;
      localStorage.setItem('heroImage', dataUrl);
    });
    const savedHero = localStorage.getItem('heroImage');
    if (savedHero) document.getElementById('heroImage').src = savedHero;
  }
}

function bindLocalUpload() {
  const input = document.getElementById('localUpload');
  if (!input) return;
  input.addEventListener('change', async e => {
    const files = Array.from(e.target.files||[]);
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

function enableLongPressDelete() {
  const grid = document.getElementById('galleryGrid');
  const local = getLocalPhotos();
  grid.querySelectorAll('.photo').forEach((fig, i) => {
    let timer;
    const start = () => {
      timer = setTimeout(() => {
        if (!confirm('刪除呢張相？')) return;
        const img = fig.querySelector('img');
        const src = img.getAttribute('src');
        const remained = local.filter(p => (p.dataUrl||p.src) !== src);
        localStorage.setItem('catLocalPhotos', JSON.stringify(remained));
        renderGallery([...remained, ...photos]);
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
