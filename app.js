const CONFIG = {
  xiaohongshuUrl: "",
  initialBatch: 28,
  batchSize: 24,
};

const state = { images: [], filtered: [], orientation: "全部", category: "全部", query: "", visible: CONFIG.initialBatch };
const $ = (selector) => document.querySelector(selector);
const grid = $("#galleryGrid");

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function cardTemplate(image) {
  const quality = image.width >= 3000 ? '<span class="quality-badge">4K</span>' : "";
  return `<article class="art-card" data-id="${image.id}" tabindex="0" aria-label="预览 ${image.title}">
    <img src="${image.preview}" alt="${image.category}：${image.title}" loading="lazy" width="${image.width}" height="${image.height}">
    ${quality}<div class="art-overlay"><strong>${image.category}</strong><span>${image.orientation} · ${image.width} × ${image.height}</span></div>
  </article>`;
}

function render() {
  const q = state.query.toLowerCase();
  state.filtered = state.images.filter((image) => {
    const matchesOrientation = state.orientation === "全部" || image.orientation === state.orientation;
    const matchesCategory = state.category === "全部" || image.category === state.category;
    const haystack = `${image.title} ${image.category} ${image.keywords}`.toLowerCase();
    return matchesOrientation && matchesCategory && (!q || haystack.includes(q));
  });
  grid.innerHTML = state.filtered.slice(0, state.visible).map(cardTemplate).join("");
  $("#resultCount").textContent = `${state.filtered.length} 件作品`;
  $("#emptyState").hidden = state.filtered.length > 0;
  $("#loadMore").hidden = state.visible >= state.filtered.length;
}

function renderCategories() {
  const categories = ["全部", ...new Set(state.images.map((image) => image.category))];
  $("#categoryList").innerHTML = categories.map((category) => `<button type="button" class="${category === "全部" ? "active" : ""}" data-category="${category}">${category}</button>`).join("");
}

function openArtwork(id) {
  const image = state.images.find((item) => item.id === id);
  if (!image) return;
  $("#dialogImage").src = image.preview;
  $("#dialogImage").alt = `${image.category}：${image.title}`;
  $("#dialogCategory").textContent = image.category;
  $("#dialogTitle").textContent = image.title;
  $("#dialogKeywords").textContent = image.keywords || "一幅来自无界像集的原创视觉作品。";
  $("#dialogOrientation").textContent = image.orientation;
  $("#dialogSize").textContent = `${image.width} × ${image.height} · ${formatBytes(image.size)}`;
  $("#dialogDate").textContent = image.date;
  $("#downloadPreview").href = image.preview;
  $("#downloadPreview").download = `${image.title}-预览.jpg`;
  $("#artDialog").showModal();
}

function openContact() {
  $("#artDialog").close();
  $("#contactDialog").showModal();
}

async function init() {
  const response = await fetch("data/gallery.json");
  state.images = await response.json();
  renderCategories();
  render();
  const hero = state.images.find((image) => image.orientation === "横屏" && image.featured) || state.images[0];
  $("#heroImage").src = hero.preview;
  $("#heroCategory").textContent = hero.category;
  $("#artCount").textContent = `${state.images.length} 件作品入藏`;
}

$("#categoryList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  state.visible = CONFIG.initialBatch;
  document.querySelectorAll("[data-category]").forEach((item) => item.classList.toggle("active", item === button));
  render();
});

document.querySelector(".segmented").addEventListener("click", (event) => {
  const button = event.target.closest("[data-orientation]");
  if (!button) return;
  state.orientation = button.dataset.orientation;
  state.visible = CONFIG.initialBatch;
  document.querySelectorAll("[data-orientation]").forEach((item) => item.classList.toggle("active", item === button));
  render();
});

$("#searchInput").addEventListener("input", (event) => { state.query = event.target.value.trim(); state.visible = CONFIG.initialBatch; render(); });
$("#loadMore").addEventListener("click", () => { state.visible += CONFIG.batchSize; render(); });
grid.addEventListener("click", (event) => { const card = event.target.closest(".art-card"); if (card) openArtwork(card.dataset.id); });
grid.addEventListener("keydown", (event) => { if ((event.key === "Enter" || event.key === " ") && event.target.matches(".art-card")) openArtwork(event.target.dataset.id); });
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => $("#artDialog").close()));
document.querySelectorAll("[data-open-contact]").forEach((button) => button.addEventListener("click", openContact));
document.querySelectorAll("[data-close-contact]").forEach((button) => button.addEventListener("click", () => $("#contactDialog").close()));
$("#copyTemplate").addEventListener("click", async () => { await navigator.clipboard.writeText($("#templateText").textContent); $("#copyTemplate").textContent = "已复制"; });
$("#xiaohongshuButton").addEventListener("click", () => { if (CONFIG.xiaohongshuUrl) window.open(CONFIG.xiaohongshuUrl, "_blank", "noopener"); else alert("请先在 app.js 的 CONFIG 中填写你的小红书主页链接。"); });
$("#themeToggle").addEventListener("click", () => { document.body.classList.toggle("dark"); localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light"); });
if (localStorage.getItem("theme") === "dark") document.body.classList.add("dark");
init().catch(() => { $("#resultCount").textContent = "图库加载失败，请通过本地服务器打开"; });
