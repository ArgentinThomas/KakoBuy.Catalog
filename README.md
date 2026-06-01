# NOIR — Catalogo Prodotti (Dark Mode)

Catalogo prodotti a griglia in dark mode con **barra di ricerca**, **filtri per categoria** e
**ordinamento**, che legge i dati da un file JSON locale (`products.json`).
Solo HTML/CSS/JS: nessun build step, nessuna dipendenza da installare.

## Struttura

```
catalog/
├── index.html      → pagina
├── styles.css      → stile (dark mode)
├── app.js          → ricerca, filtri, ordinamento, render
├── products.json   → i tuoi prodotti (modifica qui)
└── README.md
```

## Anteprima in locale

Il file `products.json` viene caricato con `fetch()`, che **non funziona aprendo
index.html con doppio clic** (protocollo `file://`). Serve un piccolo server:

```bash
# con Python (già installato su Mac/Linux)
cd catalog
python3 -m http.server 8000
# poi apri http://localhost:8000
```

In alternativa, l'estensione "Live Server" di VS Code.

## Aggiungere/modificare prodotti

Apri `products.json`. Ogni prodotto:

```json
{
  "id": 13,
  "name": "Nome prodotto",
  "category": "Electronics",     // i filtri si generano da soli dalle categorie
  "price": 99.0,
  "currency": "EUR",
  "tag": "New",                  // "New" | "Hot" | "Sale" | "" (opzionale)
  "color": "#1f6feb",            // colore del placeholder se manca l'immagine
  "image": "",                   // URL immagine: se vuoto usa il placeholder
  "inStock": true
}
```

Le categorie dei filtri (es. Electronics, Sneakers) sono ricavate
automaticamente dal campo `category`: non devi toccare il codice.

## Deploy: GitHub → Vercel o Netlify

### 1. Carica su GitHub

```bash
cd catalog
git init
git add .
git commit -m "Catalogo prodotti"
git branch -M main
git remote add origin https://github.com/TUO-USERNAME/NOME-REPO.git
git push -u origin main
```

### 2a. Vercel
1. Vai su https://vercel.com → **Add New → Project**
2. Importa la repo GitHub
3. Framework Preset: **Other** — lascia tutto vuoto (Build Command e Output: niente)
4. **Deploy**. Online in pochi secondi.

### 2b. Netlify
1. Vai su https://app.netlify.com → **Add new site → Import an existing project**
2. Collega GitHub e scegli la repo
3. Build command: *(vuoto)* — Publish directory: `.` (la root)
4. **Deploy site**.

Essendo un sito statico, su entrambe le piattaforme non serve alcuna
configurazione di build.

## Personalizzazione rapida

- **Colore accento**: in `styles.css`, variabile `--accent` (default `#c6ff00`).
- **Font**: cambia il `<link>` Google Fonts in `index.html` e le variabili
  `--font-display` / `--font-body` in `styles.css`.
- **Nome brand**: nell'`<header>` di `index.html`.
