# Columbia Association Pool Assistant

![GitHub Pages](https://img.shields.io/badge/hosted%20on-GitHub%20Pages-121013?logo=github&logoColor=white&style=flat-square)
![PWA Ready](https://img.shields.io/badge/PWA-ready-0abf53?logo=googlechrome&logoColor=white&style=flat-square)
[![Nightly Browser Verification](https://github.com/simonua/cnsl/actions/workflows/nightly-browser-verification.yml/badge.svg?branch=main)](https://github.com/simonua/cnsl/actions/workflows/nightly-browser-verification.yml)
[![CodeQL](https://github.com/simonua/cnsl/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/simonua/cnsl/actions/workflows/github-code-scanning/codeql)
![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)

A lightweight, mobile-first web app that helps Columbia Neighborhood Swim League (CNSL) swimmers, families, and fans quickly find information about pool openings, team practices, meets, and league resources.

---

## Development

Run the PowerShell developer menu for the usual setup, build, server, lint, test, PWA, and performance workflows:

```powershell
.\start.ps1
```

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

The non-seasonal swim lesson provider directory is maintained in `src/assets/data/lessons.json`. It contains factual provider and contact details but intentionally excludes pricing and schedules.

See [Annual Season Assets](docs/annual-season-assets.md) for the exact PDF, JSON, and schema layout and the checklist for preparing a new season such as 2027.

Automated seasonal-source monitoring has been retired and does not run from GitHub Actions. Structured JSON updates remain reviewed transcriptions of official material. Run `pnpm run validate:data` after annual-data changes to validate active schemas, references, URLs, and retained official source documents. See [Retired Seasonal Data Source Monitor](.github/automation/season-data-monitor/README.md) for retained coverage notes and local investigation guidance.

### Verification

```bash
pnpm run lint
pnpm test
pnpm run test:coverage # Delivered JS coverage; excludes maintenance implementations in scripts/
pnpm run validate:data
pnpm run build
pnpm run verify:pwa
```

Playwright browser verification is deferred to the `Nightly Browser Verification` GitHub Actions workflow. Each day during May, June, and July, its scheduled check runs Chromium workflow and automated WCAG A/AA checks only when a push to `main` was recorded during the preceding 24 hours. It can also be run on demand through workflow dispatch. Browser results are reported separately and do not delay or block a GitHub Pages build. Use the [Release Verification Checklist](docs/release-checklist.md) for the secure-origin installed-PWA and manual assistive-technology checks that automation cannot establish.

Design and maintenance decisions are recorded in the [Visual Style Guide](docs/style-guide.md), [Runtime And Stylesheet Ownership](docs/runtime-architecture.md), and [Security And Privacy Decision](docs/security-privacy.md).

### GitHub Actions Workflow

This project uses GitHub Actions to automatically build and deploy the website to GitHub Pages when changes are pushed to the main branch. The workflow:

1. Checks out the repository
2. Sets up Node.js
3. Installs dependencies
4. Runs lint and unit-test checks
5. Validates active annual data against its schemas and retained-source inventory
6. Builds the project using PostHTML
7. Verifies the generated PWA cache, offline, and publication metadata contract
8. Uploads the built files as an artifact
9. Deploys the artifact to GitHub Pages

Separately, the May-to-July daily browser-verification workflow runs Playwright after a push to `main` in the preceding 24 hours, or when manually dispatched.

Workflow configurations are located in `.github/workflows/build-deploy.yml` and `.github/workflows/nightly-browser-verification.yml`.

### Repository Configuration

Repository automation and Copilot configuration is kept in `.github/`:

- `.github/agents/` contains discoverable GitHub Copilot custom agent profiles.
- `.github/automation/` contains retained notes and reviewed state for retired automations.
- `.github/instructions/`, `.github/skills/`, and `.github/copilot-instructions.md` contain repository-specific Copilot guidance.
- `.github/workflows/` contains GitHub Actions definitions; `.github/dependabot.yml` configures dependency update checks.

Retired automation references:

- [Refactoring Audit](.github/automation/refactoring-audit/README.md) retains design notes for the retired assessment driven by the `refactoring-auditor` custom agent.
- [Seasonal Data Source Monitor](.github/automation/season-data-monitor/README.md) retains source-monitoring notes and its reviewed fingerprint baseline; no Actions workflow invokes it.

The separation of `automation/` from `agents/` keeps retained automation support files from being discovered as custom agent profiles.

---

## Features

- Mobile-friendly design with large, tappable buttons
- Team profiles with coaches and practice schedules
- Meet calendar with pool closures
- FAQs and league documents from official CNSL sources
- Installable Progressive Web App (PWA) with offline application-shell and seasonal directory caching
- Keyboard-friendly navigation, status announcements, and reduced-motion support
- Purpose-limited Google Analytics usage reporting on the deployed site, with advertising personalization disabled
- Hosted via GitHub Pages with custom domain and HTTPS

---

## Repo Structure

```text
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
```

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

Maintained by [Simon Kurtz](https://pools.longreachmarlins.org/contact.html)

> Community-driven. Not affiliated with Columbia Association or CNSL.
