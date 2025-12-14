// 編輯模式與相片渲染
let photos = [];
let editMode = false;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  bindEditToggle();
  loadPhotos();
  restoreEditableTexts();
  bindPhotoEditor();
});

// 載入相片 JSON
async function loadPhotos() {
  try {
    const res = await fetch('photos.json', { cache: 'no-store' });
    photos = await res.json();
    renderGallery(photos);
    setupFilters();
  } catch (e) {
    console.error('載入相片失敗：', e);
    document.getElementById('galleryGrid').innerHTML =
      '<p class="card">尚未加入相片，請先把檔案上載到 images/，再喺上面「新增相片記錄」加入。</p>';
  }
}

// 渲染相簿
function renderGallery(list) {
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = (list || []).map(p => `
    <figure class="photo">
      <img src="${p.src}" alt="${p.title}" loading="lazy" onerror="this.onerror=null;this.src='images/cover.svg'">
      <figcaption class="meta">
        <div>${p.title} · <time datetime="${p.date}">${p.date}</time></div>
        <div class="tags">${(p.tags||[]).map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </figcaption>
    </figure>
  `).join('');
}

// 搜尋與標籤過濾
function setupFilters() {
  const search = document.getElementById('search');
  const tagFilter = document.getElementById('tagFilter');
  const apply = () => {
    const q = (search.value || '').trim().toLowerCase();
    const tag = tagFilter.value;
    const filtered = photos.filter(p => {
      const text = `${p.title} ${p.tags?.join(' ')}`.toLowerCase();
      const inText = !q || text.includes(q);
      const inTag = !tag || p.tags?.includes(tag);
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

    // 切換 contenteditable
    toggleEditableTexts(editMode);
    // 顯示／隱藏相片編輯工具
    document.getElementById('photoEditor').hidden = !editMode;

    // 儲存目前文字到 localStorage（退出時）
    if (!editMode) saveEditableTexts();
  });
}

// 可編輯元素清單
function getEditableElements() {
  return [
    'siteTitle', 'navGallery', 'navTimeline', 'navStories', 'navAbout',
    'heroTitle', 'heroDesc', 'footerText'
  ].map(id => document.getElementById(id));
}

function toggleEditableTexts(enabled) {
  getEditableElements().forEach(el => {
    if (!el) return;
    el.setAttribute('contenteditable', String(enabled));
    el.style.outline = enabled ? '1px dashed #f59fb0' : 'none';
  });
  // 亦可編輯故事與時間軸文字
  document.querySelectorAll('#timelineList span, #stories .card h3, #stories .card p').forEach(el => {
    el.setAttribute('contenteditable', String(enabled));
    el.style.outline = enabled ? '1px dashed #f59fb0' : 'none';
  });
}

// 儲存／還原文字（localStorage）
function saveEditableTexts() {
  const data = {};
  getEditableElements().forEach(el => {
    if (!el) return;
    data[el.id] = el.innerHTML;
  });
  // 故事與時間軸
  data.timelineHTML = document.getElementById('timelineList').innerHTML;
  data.storiesHTML = document.getElementById('stories').innerHTML;
  localStorage.setItem('catSiteTexts', JSON.stringify(data));
}

function restoreEditableTexts() {
  const raw = localStorage.getItem('catSiteTexts');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    getEditableElements().forEach(el => {
      if (el && data[el.id]) el.innerHTML = data[el.id];
    });
    if (data.timelineHTML) document.getElementById('timelineList').innerHTML = data.timelineHTML;
    if (data.storiesHTML) {
      const stories = document.getElementById('stories');
      const h2 = stories.querySelector('h2');
      const rest = stories.querySelectorAll('.card');
      if (h2 && rest.length) {
        stories.innerHTML = data.storiesHTML;
      }
    }
  } catch {}
}

// 相片編輯工具（新增記錄）
function bindPhotoEditor() {
  const addBtn = document.getElementById('addPhoto');
  addBtn.addEventListener('click', () => {
    const src = document.getElementById('newSrc').value.trim();
    const date = document.getElementById('newDate').value.trim();
    const title = document.getElementById('newTitle').value.trim();
    const tagsRaw = document.getElementById('newTags').value.trim();
    if (!src || !date || !title) {
      alert('請填：圖片路徑、日期、標題');
      return;
    }
    const tags = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    const record = { src, date, title, tags };
    photos.unshift(record);
    renderGallery(photos);

    const raw = localStorage.getItem('catPhotos');
    const saved = raw ? JSON.parse(raw) : [];
    saved.unshift(record);
    localStorage.setItem('catPhotos', JSON.stringify(saved));

    ['newSrc','newDate','newTitle','newTags'].forEach(id => document.getElementById(id).value = '');
  });

  const raw = localStorage.getItem('catPhotos');
  if (raw) {
    try {
      const extra = JSON.parse(raw);
      if (Array.isArray(extra) && extra.length) {
        photos = [...extra, ...photos];
        renderGallery(photos);
      }
    } catch {}
  }

  const uploadBtn = document.getElementById('uploadToRepo');
  uploadBtn.addEventListener('click', async () => {
    alert('為保障安全，示範按鈕係停用狀態。建議用「手動上載到 images/」或用 GitHub Actions／後端處理。');
  });
}
