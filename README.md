# Columbia Association Pool Assistant

![GitHub Pages](https://img.shields.io/badge/hosted%20on-GitHub%20Pages-121013?logo=github&logoColor=white&style=flat-square)
![PWA Ready](https://img.shields.io/badge/PWA-ready-0abf53?logo=googlechrome&logoColor=white&style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)

A lightweight, mobile-first web app that helps Columbia Neighborhood Swim League (CNSL) swimmers, families, and fans quickly find information about pool openings, team practices, meets, and league resources.

---

## Development

### Setup

```bash
# Use Node.js 24 or newer from the checked-in baseline
nvm use

# Install dependencies
pnpm install
```

### Building HTML

This project uses PostHTML for component-based HTML development. The source files are in the `src/views` directory and compiled to the `/out` directory.

```bash
# Build HTML files once
pnpm run build

# Build and watch for changes
pnpm start
```

### Project Structure

- `src/views/*.html` - Source HTML files with PostHTML syntax
- `src/views/layouts/*.html` - Layout templates
- `src/views/components/*.html` - Reusable components
- `src/css/` - Stylesheets
- `src/js/` - JavaScript files
- `src/assets/` - Images, data files, and other static assets
- `/out/` - Build output directory (generated files for deployment)

### Annual Season Data

Pools, meets, and teams are stored beneath annual domain folders in `src/assets/data/<YEAR>/<domain>/`. The active published season is selected by `YEAR` in `src/js/config/app-config.js`.

See [Annual Season Assets](docs/annual-season-assets.md) for the exact PDF, JSON, and schema layout and the checklist for preparing a new season such as 2027.

While a season is active, a nightly source monitor checks the official pool, meet, and team references used by the active annual data. Changed evidence is submitted as a review pull request; structured JSON updates remain reviewed transcriptions of the official material. Run `pnpm run validate:data` after annual-data changes to validate active schemas, references, URLs, and retained official source documents. See [Seasonal Data Source Monitor](.github/data-agent/README.md) for coverage and operation.

### Verification

```bash
pnpm run lint
pnpm test
pnpm run validate:data
pnpm run build
pnpm run verify:pwa

# First browser-test setup on a workstation
pnpm exec playwright install chromium

# Focused local browser feedback while changing visitor-facing behavior
pnpm run test:browser:smoke

# Full local workflow checks, without the slower WCAG scan matrix
pnpm run test:browser

# Explicit local WCAG reproduction when diagnosing a CI failure
pnpm run test:browser:accessibility --grep "light theme accessibility.*pools has no WCAG A or AA automated violations"

# Complete browser gate run by GitHub Actions before deployment
pnpm run test:browser:ci
```

Browser verification runs against the built artifact in Chromium. Local browser commands cover keyboard and rendered workflow feedback without running the slow automated WCAG scan matrix. GitHub Actions runs `pnpm run test:browser:ci`, including the full automated WCAG A/AA inspection, before deployment; use `pnpm run test:browser:accessibility` locally only when reproducing a relevant failure. Use the [Release Verification Checklist](docs/release-checklist.md) for the secure-origin installed-PWA and manual assistive-technology checks that automated scans cannot establish.

Design and maintenance decisions are recorded in [Runtime And Stylesheet Ownership](docs/runtime-architecture.md) and [Security And Privacy Decision](docs/security-privacy.md).

### GitHub Actions Workflow

This project uses GitHub Actions to automatically build and deploy the website to GitHub Pages when changes are pushed to the main branch. The workflow:

1. Checks out the repository
2. Sets up Node.js
3. Installs dependencies
4. Runs lint and unit-test checks
5. Validates active annual data against its schemas and retained-source inventory
6. Builds the project using PostHTML
7. Verifies the generated PWA cache, offline, and publication metadata contract
8. Runs browser keyboard-workflow and automated accessibility checks
9. Uploads the built files as an artifact
10. Deploys the artifact to GitHub Pages

The workflow configuration is located in `.github/workflows/build-deploy.yml`.

A second workflow, `.github/workflows/season-data-monitor.yml`, checks official active-season data sources nightly and opens a review pull request when source evidence changes.

---

## Features

- Mobile-friendly design with large, tappable buttons
- Team profiles with coaches and practice schedules
- Meet calendar with pool closures
- FAQs and league documents from official CNSL sources
- Installable Progressive Web App (PWA) with offline application-shell and seasonal directory caching
- Keyboard-friendly navigation, status announcements, and reduced-motion support
- Anonymized aggregate usage analytics on the deployed site, without tracking individual visitors
- Hosted via GitHub Pages with custom domain and HTTPS

---

## Repo Structure

/CNSL
├── index.html                 # Season overview homepage (generated)
├── pools.html                 # Pool directory with filters (generated)
├── teams.html                 # Team cards and practice info (generated)
├── meets.html                 # Meet schedule with closures (generated)
├── faq.html                   # CNSL documents and policies (generated)
├── src/
│   ├── views/                 # Source HTML files
│   │   ├── components/        # Reusable HTML components
│   │   └── layouts/           # HTML layout templates
│   ├── css/
│   │   └── styles.css         # Site-wide responsive and accessible styles
│   └── js/
│       ├── pool-browser.js    # Pool browser functionality
│       ├── teams-browser.js   # Team browser functionality
│       └── meets-browser.js   # Meet schedule functionality
├── manifest.webmanifest       # PWA configuration
├── service-worker.js          # Offline asset caching
├── robots.txt / sitemap.xml   # Published crawler metadata
├── README.md                  # Project overview and data sources
└── assets/
    ├── images/                # Logos and icons
    └── data/                  # JSON for pools, teams, and meets

---

## 📚 Data Sources (Official CNSL)

All content is built on publicly available resources from the Columbia Neighborhood Swim League:

- [CNSL Homepage](https://www.gomotionapp.com/team/reccnsl/page/home)
- [CNSL Team Directory](https://www.gomotionapp.com/team/reccnsl/page/teams)
- [CNSL Documents & FAQs](https://www.gomotionapp.com/team/reccnsl/page/documentsfaq)
- [CNSL Registration Info](https://www.gomotionapp.com/team/reccnsl/page/registration)

---

## 📦 Deployment

This site is hosted via **GitHub Pages**:

- Repo: [github.com/simonua/cnsl](https://github.com/simonua/cnsl)
- Live site: [pools.longreachmarlins.org](https://pools.longreachmarlins.org)

Custom domain configured with GitHub DNS and secured with HTTPS.

---

## 👤 Maintainer

Maintained by [Simon Kurtz](mailto:simonkurtz@gmail.com?cnsl)

> Community-driven. Not affiliated with Columbia Association or CNSL.
