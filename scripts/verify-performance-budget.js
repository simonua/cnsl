const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const outputDirectory = path.join(__dirname, '..', 'out');
const budgets = {
  precacheResources: 72,
  javascriptBytes: 280000,
  stylesheetBytes: 90000,
  routeLocalScripts: {
    'index.html': 10,
    'pools.html': 22,
    'teams.html': 21,
    'meets.html': 21,
    'settings.html': 19
  }
};

function totalTextBytes(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
    const entryPath = path.join(directory, entry.name);
    return total + (entry.isDirectory()
      ? totalTextBytes(entryPath)
      : Buffer.byteLength(fs.readFileSync(entryPath, 'utf8').replace(/\r\n/g, '\n'), 'utf8'));
  }, 0);
}

function countLocalScripts(pageName) {
  const html = fs.readFileSync(path.join(outputDirectory, pageName), 'utf8');
  return (html.match(/<script[^>]+src="js\//g) || []).length;
}

assert.ok(fs.existsSync(outputDirectory), 'Build output is missing. Run pnpm run build before checking budgets.');

const manifestContext = { self: {} };
vm.runInNewContext(fs.readFileSync(path.join(outputDirectory, 'precache-manifest.js'), 'utf8'), manifestContext);
const precacheResources = manifestContext.self.PRECACHE_RESOURCES.length;
const javascriptBytes = totalTextBytes(path.join(outputDirectory, 'js'));
const stylesheetBytes = totalTextBytes(path.join(outputDirectory, 'css'));
const routeScriptCounts = Object.fromEntries(
  Object.keys(budgets.routeLocalScripts).map(pageName => [pageName, countLocalScripts(pageName)])
);

assert.ok(precacheResources <= budgets.precacheResources, `Precache inventory budget exceeded: ${precacheResources} > ${budgets.precacheResources}.`);
assert.ok(javascriptBytes <= budgets.javascriptBytes, `Delivered JavaScript budget exceeded: ${javascriptBytes} > ${budgets.javascriptBytes} bytes.`);
assert.ok(stylesheetBytes <= budgets.stylesheetBytes, `Delivered stylesheet budget exceeded: ${stylesheetBytes} > ${budgets.stylesheetBytes} bytes.`);
Object.entries(routeScriptCounts).forEach(([pageName, scriptCount]) => {
  const budget = budgets.routeLocalScripts[pageName];
  assert.ok(scriptCount <= budget, `${pageName} local script budget exceeded: ${scriptCount} > ${budget}.`);
});

console.log(`Performance budget passed: ${precacheResources}/${budgets.precacheResources} precache resources, ${javascriptBytes}/${budgets.javascriptBytes} JS bytes, ${stylesheetBytes}/${budgets.stylesheetBytes} CSS bytes.`);
Object.entries(routeScriptCounts).forEach(([pageName, scriptCount]) => {
  console.log(`- ${pageName}: ${scriptCount}/${budgets.routeLocalScripts[pageName]} local scripts`);
});
