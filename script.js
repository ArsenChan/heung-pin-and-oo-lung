// 載入相片 JSON，渲染相簿與搜尋/過濾
async function loadPhotos() {
  try {
    const res = await fetch('photos.json');
    const photos = await res.json();
    renderGallery(photos);
    setupFilters(photos);
  } catch (e) {
    console.error('載入相片失敗：', e);
    document.getElementById('galleryGrid').innerHTML = '<p class="card">尚未加入相片，請把圖片放到 images/ 並更新 photos.json。</p>';
  }
}

function renderGallery(photos) {
  const grid = document.getElementById('galleryGrid');
  grid.innerHTML = photos.map(p => `
    <figure class="photo">
      <img src="${p.src}" alt="${p.title}" loading="lazy">
      <figcaption class="meta">
        <div>${p.title} · <time datetime="${p.date}">${p.date}</time></div>
        <div class="tags">${(p.tags||[]).map(t => `<span class="tag">${t}</span>`).join('')}</div>
      </figcaption>
    </figure>
  `).join('');
}

function setupFilters(all) {
  const search = document.getElementById('search');
  const tagFilter = document.getElementById('tagFilter');
  const apply = () => {
    const q = (search.value || '').trim();
    const tag = tagFilter.value;
    const filtered = all.filter(p => {
      const inText = !q || `${p.title} ${p.tags?.join(' ')}`.toLowerCase().includes(q.toLowerCase());
      const inTag = !tag || p.tags?.includes(tag);
      return inText && inTag;
    });
    renderGallery(filtered);
  };
  search.addEventListener('input', apply);
  tagFilter.addEventListener('change', apply);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  loadPhotos();
});
