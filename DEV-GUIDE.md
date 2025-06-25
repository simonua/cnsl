# 🚀 CNSL Pool Copilot - Development Guide

## Quick Start

### Hot Reloading Development (Recommended)
```bash
npm start
```
This will:
- ✅ Watch all files in `src/` directory for changes
- ✅ Automatically rebuild when files are modified, added, or deleted
- ✅ Refresh your browser automatically
- ✅ Open your browser to http://localhost:9090

### Simple Development (No Hot Reload)
```bash
npm run start:simple
```
This will build once and serve, but won't watch for changes.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | **Main development command** - Watches files and auto-refreshes browser |
| `npm run build` | Build the project once to `out/` directory |
| `npm run watch` | Watch for file changes and rebuild (no browser refresh) |
| `npm run serve` | Serve the built files with basic HTTP server |
| `npm run serve-live` | Serve with live reload capabilities |
| `npm run dev:watch` | Run watch + live server together |
| `npm run start:simple` | Simple build and serve (no watching) |

## File Watching

The development server watches for changes in:
- 📁 `src/views/` - HTML templates and components
- 🎨 `src/css/` - Stylesheets
- ⚙️ `src/js/` - JavaScript files
- 📄 `src/assets/` - Images, data files, etc.

### What happens when you save a file:
1. **HTML files** - Templates are processed and rebuilt
2. **CSS files** - Styles are copied to output and browser refreshes
3. **JS files** - Scripts are copied to output and browser refreshes
4. **Assets** - Files are copied and browser refreshes if needed

## Development Workflow

1. **Start development server:**
   ```bash
   npm start
   ```

2. **Edit your files in the `src/` directory:**
   - Modify templates in `src/views/`
   - Update styles in `src/css/styles.css`
   - Edit JavaScript in `src/js/`
   - Add assets to `src/assets/`

3. **Save your changes** - The browser will automatically refresh!

## Build Output

All files are built to the `out/` directory:
```
out/
├── index.html          # Processed from src/views/index.html
├── pools.html          # Processed from src/views/pools.html
├── css/
│   └── styles.css      # Copied from src/css/styles.css
├── js/
│   ├── copilot.js      # Copied from src/js/copilot.js
│   ├── speech.js       # Copied from src/js/speech.js
│   └── ...
├── assets/
│   ├── data/
│   └── images/
└── service-worker.js   # Updated with cache version
```

## Tips for Development

- 🔄 **Auto-refresh**: Your browser will automatically refresh when you save files
- 📱 **Mobile testing**: Access your dev server from mobile devices on the same network
- 🐛 **Debugging**: Check browser console and terminal for any errors
- ⚡ **Fast builds**: Only changed files trigger rebuilds for faster development

## Troubleshooting

### Browser not refreshing?
- Check that both the watch and live-server processes are running
- Try manually refreshing the browser
- Check the terminal for any error messages

### Build errors?
- Check the terminal output for specific error messages
- Ensure all required files exist in the `src/` directory
- Verify your HTML template syntax

### Port already in use?
- The server runs on port 9090 by default
- Kill any existing servers or change the port in package.json

## Mobile Testing

Access your development server from mobile devices:
1. Find your computer's IP address (e.g., 192.168.1.100)
2. Connect your mobile device to the same WiFi network
3. Open browser on mobile and go to: `http://YOUR_IP:9090`

Happy coding! 🎉
