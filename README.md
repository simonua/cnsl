# Columbia Association Pool Assistant

![GitHub Pages](https://img.shields.io/badge/hosted%20on-GitHub%20Pages-121013?logo=github&logoColor=white&style=flat-square)
![PWA Ready](https://img.shields.io/badge/PWA-ready-0abf53?logo=googlechrome&logoColor=white&style=flat-square)
[![Weekly Browser Verification](https://github.com/simonua/cnsl/actions/workflows/nightly-browser-verification.yml/badge.svg?branch=main)](https://github.com/simonua/cnsl/actions/workflows/nightly-browser-verification.yml)
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

The scheduled seasonal-source GitHub Actions workflow has been retired, but deliberate source reviews remain required. Begin each review with `pnpm run check:data-updates`, reconcile its collected URLs with every official source defined by the active annual JSON and annual README, and directly request any uncovered source. Record every successfully completed review in the source check log, update the matching source-review timestamps, and refresh the accepted baseline with `node scripts/season-data-agent.js --initialize`. Structured JSON updates remain reviewed transcriptions of official material. Run `pnpm run validate:data` after annual-data changes as a separate integrity check; it does not prove that current online sources were reviewed. See [Seasonal Data Source Review](.github/automation/season-data-monitor/README.md) for the complete coverage and evidence requirements.

### Verification

Run tests by naming only the files or browser IDs affected by your changes. Complete unit and browser suites run in CI; local broad-suite commands are for explicitly requested investigations only.

```bash
pnpm run lint
node --test tests/<area>/<affected-module>.test.js
node scripts/run-playwright.js test <affected-spec> --grep "<stable IDs>"
pnpm run validate:data
pnpm run build
pnpm run verify:pwa
```

Playwright browser verification is deferred to the `Weekly Browser Verification` GitHub Actions workflow. Each Sunday during May, June, and July, its scheduled check runs Chromium workflow and automated WCAG A/AA checks only when a push to `main` was recorded during the preceding seven days. It can also be run on demand through workflow dispatch. Browser results are reported separately and do not delay or block a GitHub Pages build. Use the [Release Verification Checklist](docs/release-checklist.md) for the secure-origin installed-PWA and manual assistive-technology checks that automation cannot establish.

Design and maintenance decisions are recorded in the [Visual Style Guide](docs/style-guide.md), [Runtime And Stylesheet Ownership](docs/runtime-architecture.md), [Security And Privacy Decision](docs/security-privacy.md), and retained [Voice Assistant Question Scope](docs/voice-assistant-scope.md).

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

Separately, the May-to-July weekly browser-verification workflow runs Playwright after a push to `main` in the preceding seven days, or when manually dispatched.

Workflow configurations are located in `.github/workflows/build-deploy.yml` and `.github/workflows/nightly-browser-verification.yml`.

### Repository Configuration

Repository automation and Copilot configuration is kept in `.github/`:

- `.github/agents/` contains discoverable GitHub Copilot custom agent profiles.
- `.github/automation/` contains retained automation notes and reviewed state for deliberate local workflows whose scheduled GitHub Actions definitions have been retired.
- `.github/instructions/`, `.github/skills/`, and `.github/copilot-instructions.md` contain repository-specific Copilot guidance.
- `.github/workflows/` contains GitHub Actions definitions; `.github/dependabot.yml` configures dependency update checks.

Automation references:

- [Refactoring Audit](.github/automation/refactoring-audit/README.md) retains design notes for the retired assessment driven by the `refactoring-auditor` custom agent.
- [Seasonal Data Source Review](.github/automation/season-data-monitor/README.md) documents the required deliberate local review and retains its reviewed fingerprint baseline; no Actions workflow invokes it.

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
├── src/
│   ├── views/                 # Source HTML files
│   │   ├── components/        # Reusable HTML components
│   │   └── layouts/           # HTML layout templates
│   ├── css/
│   │   └── styles.css         # Site-wide responsive and accessible styles
│   ├── js/                    # Browser controllers, models, services, and types
│   └── assets/                # Images, annual data, and visitor resources
├── scripts/                   # Build, validation, and measurement tools
├── tests/                     # Unit and browser verification
├── docs/                      # Maintenance and product decision records
├── out/                       # Generated deployment output (gitignored)
├── manifest.webmanifest       # PWA configuration
├── service-worker.js          # Offline asset caching
├── robots.txt / sitemap.xml   # Published crawler metadata
└── README.md                  # Project overview and data sources
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
