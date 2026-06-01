// ---- Stato ----
let PRODUCTS = [];
let activeCategory = "All";
let searchTerm = "";
let sortMode = "default";

// ---- Elementi DOM ----
const grid = document.getElementById("grid");
const filtersEl = document.getElementById("filters");
const searchEl = document.getElementById("search");
const sortEl = document.getElementById("sort");
const emptyEl = document.getElementById("empty");
const countPill = document.getElementById("count-pill");

// ---- Caricamento dati dal JSON locale ----
async function loadProducts() {
  try {
    const res = await fetch("products.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    PRODUCTS = await res.json();
    buildFilters();
    render();
  } catch (err) {
    console.error("Errore nel caricamento di products.json:", err);
    grid.innerHTML =
      '<p style="color:var(--text-dim)">Impossibile caricare i prodotti. ' +
      "Apri la pagina tramite un server (vedi README), non con doppio clic sul file.</p>";
  }
}

// ---- Costruzione dinamica dei filtri categoria ----
function buildFilters() {
  const categories = ["All", ...new Set(PRODUCTS.map((p) => p.category))];
  filtersEl.innerHTML = "";
  categories.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "chip" + (cat === activeCategory ? " active" : "");
    btn.textContent = cat === "All" ? "Tutti" : cat;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      document
        .querySelectorAll(".chip")
        .forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      render();
    });
    filtersEl.appendChild(btn);
  });
}

// ---- Logica di filtro + ordinamento ----
function getVisibleProducts() {
  let list = PRODUCTS.filter((p) => {
    const matchCat = activeCategory === "All" || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  switch (sortMode) {
    case "price-asc":
      list.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      list.sort((a, b) => b.price - a.price);
      break;
    case "name-asc":
      list.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return list;
}

// ---- Formattazione prezzo ----
function formatPrice(value, currency) {
  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: currency || "EUR",
    }).format(value);
  } catch {
    return value + " " + (currency || "EUR");
  }
}

// ---- Render della griglia ----
function render() {
  const list = getVisibleProducts();
  countPill.textContent = list.length + " prodott" + (list.length === 1 ? "o" : "i");

  if (list.length === 0) {
    grid.innerHTML = "";
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  grid.innerHTML = list
    .map((p, i) => {
      const initials = p.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();

      const media = p.image
        ? `<img src="${p.image}" alt="${p.name}" loading="lazy" />`
        : `<span class="placeholder">${initials}</span>`;

      const tagHtml = p.tag
        ? `<span class="card-tag${p.tag === "Sale" ? " " : ""}">${p.tag}</span>`
        : !p.inStock
        ? `<span class="card-tag muted">Esaurito</span>`
        : "";

      return `
      <article class="card" style="animation-delay:${Math.min(i * 40, 400)}ms">
        <div class="card-media" style="background:linear-gradient(135deg, ${p.color}, #0a0a0b)">
          ${media}
          ${tagHtml}
        </div>
        <div class="card-body">
          <span class="card-cat">${p.category}</span>
          <h3 class="card-name">${p.name}</h3>
          <div class="card-footer">
            <span class="card-price">${formatPrice(p.price, p.currency)}</span>
            <span class="card-stock${p.inStock ? "" : " out"}">
              ${p.inStock ? "Disponibile" : "Esaurito"}
            </span>
          </div>
        </div>
      </article>`;
    })
    .join("");
}

// ---- Eventi ----
searchEl.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  render();
});

sortEl.addEventListener("change", (e) => {
  sortMode = e.target.value;
  render();
});

// ---- Avvio ----
loadProducts();
