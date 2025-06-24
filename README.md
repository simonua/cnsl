![GitHub Pages](https://img.shields.io/badge/hosted%20on-GitHub%20Pages-121013?logo=github&logoColor=white&style=flat-square)
![PWA Ready](https://img.shields.io/badge/PWA-ready-0abf53?logo=googlechrome&logoColor=white&style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)


# Columbia Association Pool Copilot

A lightweight, mobile-first web app that helps Columbia Neighborhood Swim League (CNSL) swimmers, families, and fans quickly find information about pool openings, team practices, meets, and league policies. Includes natural language search and voice input for on-the-go access.

---

## 🔍 Features

- Natural language search ("Where do the Barracudas swim today?")
- Mobile-friendly design with large, tappable buttons
- Voice input via Web Speech API
- Team profiles with coaches and practice schedules
- Meet calendar with pool closures
- FAQs and league documents from official CNSL sources
- Installable Progressive Web App (PWA)
- WCAG-compliant accessible layout and color palette
- Hosted via GitHub Pages with custom domain and HTTPS

---

## 🧱 Repo Structure

/CNSL
├── index.html                 # Copilot homepage with natural language search
├── pools.html                 # Pool directory with filters (coming soon)
├── teams.html                 # Team cards and practice info (coming soon)
├── meets.html                 # Meet schedule with closures (coming soon)
├── faq.html                   # CNSL documents and policies (coming soon)
├── css/
│   └── styles.css             # Site-wide responsive and accessible styles
├── js/
│   └── copilot.js             # Copilot logic + voice input
├── manifest.webmanifest       # PWA configuration
├── service-worker.js          # Offline asset caching
├── CNAME                      # Custom domain declaration
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
- Live site: [cnsl.longreachmarlins.org](https://cnsl.longreachmarlins.org)

Custom domain configured with GitHub DNS and secured with HTTPS.

---

## 👤 Maintainer

Maintained by [Simon Kurtz](mailto:simonkurtz@gmail.com?cnsl)

> Community-driven. Not affiliated with Columbia Association or CNSL.
