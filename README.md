# Kakobuy Products 2026 – Direct Listings (OGKako)

A dynamic, high-performance product listings catalog with category filter pills, search functionality, a favorites list system, evolutionary link redirection, and an built-in admin editor dashboard.

Built entirely using static HTML, CSS, JavaScript, and Tailwind CSS (CDN). No build step required.

## Directory Structure

```
catalog/
├── index.html          → Main page skeleton and templates
├── styles.css          → Page layout styling and night mode definitions
├── app.js              → Catalog application, search/filter algorithms, and admin dashboard logic
├── config.json         → Global configuration file (profile, theme, banner, products, CTAs)
├── footer.html         → Static snippet containing the disclaimer and helpful links
└── README.md           → Documentation
```

## Running Locally

Because this page loads configurations and footer templates using AJAX requests (`fetch()`), it **cannot be run by double-clicking the `index.html` file** directly in the browser (due to CORS policies).

You must host the folder using a local web server:

```bash
# Using Python (standard on most systems)
python -m http.server 8000
```
Then open `http://localhost:8000` in your web browser.

## Customizing Configurations and Products

All layout, profile details, theme colors, and product listings are loaded from the static `config.json` configuration file:

- **Products**: Add, modify, or disable products in the `products` array. Each product supports click tracking, pricing, custom outline borders, and a direct forwarding URL.
- **Theme**: Customize fonts, brand accent colors, background colors, and title layout styles.
- **Banner**: Configure an optional top disclaimer warning banner.
- **CTAs & Links**: Customize quick link buttons and category card shortcuts.

## Admin Management Mode

To modify products and settings visually:
1. Open the page locally or in production.
2. Append `?admin=1` to the URL path (e.g. `http://localhost:8000/?admin=1`).
3. Scroll to the bottom to access the **Products Admin Panel**.
4. Use the interface to add products, adjust positions, drag and drop list order, modify details, and check quality control (QC) settings.

*Note: The admin panel's "Save to Server" action requires a server-side endpoint `/api/config`. When deployed on static hosting services (like GitHub Pages, Netlify, or running locally without a backend server), the page will correctly fallback to reading `config.json`, but saving edits directly through the dashboard is disabled.*

## Deploying to Vercel or Netlify

### 1. Upload to GitHub
```bash
git init
git add .
git commit -m "Initialize Kakobuy Products Catalog"
git branch -M main
git remote add origin https://github.com/ArgentinThomas/KakoBuy.Catalog.git
git push -u origin main
```

### 2. Connect to Hosting
- **Vercel**: Import the GitHub repository, select **Other** as the Framework Preset, leave build commands empty, and deploy.
- **Netlify**: Connect your repository, set the build command to empty, set the publish directory to `.` (root), and deploy.
