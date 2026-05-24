const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  collectSources,
  formatReport,
  isDateWithinSeason,
  monitorSources,
  normalizeHtml,
  normalizePageContent,
  parseReadmePdfSources,
  sha256
} = require('../../scripts/season-data-agent');

describe('season data agent', () => {
  describe('normalizeHtml', () => {
    it('should compare visible page text without script or layout whitespace changes', () => {
      const first = '<main><h1>Pool Hours</h1><p>Open today</p></main><script>build=1</script>';
      const second = '<main>\n<h1>Pool Hours</h1> <p>Open today</p>\n</main><script>build=2</script>';

      assert.strictEqual(normalizeHtml(first), normalizeHtml(second));
    });
  });

  describe('normalizePageContent', () => {
    it('should ignore unrelated pool index content while watching outdoor schedule links', () => {
      const first = '<header>Spring campaign</header><h4>Outdoor Pools Schedule</h4><a href="/bwp">View BWP effective May 23</a><h4>Indoor Pools Schedule</h4><p>Indoor May schedule</p>';
      const second = '<header>Summer campaign</header><h4>Outdoor Pools Schedule</h4><a href="/bwp">View BWP effective May 23</a><h4>Indoor Pools Schedule</h4><p>Indoor June schedule</p>';
      const changedLink = '<h4>Outdoor Pools Schedule</h4><a href="/bwp-june">View BWP effective June 1</a><h4>Indoor Pools Schedule</h4>';

      assert.strictEqual(
        normalizePageContent(first, 'outdoor-pool-schedules'),
        normalizePageContent(second, 'outdoor-pool-schedules')
      );
      assert.notStrictEqual(
        normalizePageContent(first, 'outdoor-pool-schedules'),
        normalizePageContent(changedLink, 'outdoor-pool-schedules')
      );
    });
  });

  describe('parseReadmePdfSources', () => {
    it('should find locally retained meet and team official documents', () => {
      const markdown = [
        '| Meet | [Download PDF](https://example.test/meet.pdf) | `meets/meet-schedules/meet.pdf` | today |',
        '| Practice | [Download PDF](https://example.test/practice.pdf) | `teams/team-schedules/practice.pdf` | today |'
      ].join('\n');

      assert.deepStrictEqual(parseReadmePdfSources(markdown), [
        {
          domain: 'meets',
          label: 'meet.pdf',
          localPath: 'meets/meet-schedules/meet.pdf',
          url: 'https://example.test/meet.pdf'
        },
        {
          domain: 'teams',
          label: 'practice.pdf',
          localPath: 'teams/team-schedules/practice.pdf',
          url: 'https://example.test/practice.pdf'
        }
      ]);
    });
  });

  describe('collectSources', () => {
    it('should discover pool, meet, and team sources from active annual data', () => {
      const sources = collectSources({
        annualReadme: '[CNSL home page](https://league.test/home)\n| Team | [Download PDF](https://league.test/practice.pdf) | `teams/team-schedules/practice.pdf` | now |',
        meetsData: { url: 'https://league.test/meet.pdf' },
        poolsData: {
          caPoolDirectoryUrl: 'https://pools.test/directory',
          caPoolGuideUrl: 'https://pools.test/guide',
          pools: [{
            caUrl: 'https://pools.test/bryant',
            name: 'Bryant Woods',
            scheduleUrl: 'https://pools.test/Bryant_Woods.pdf'
          }]
        },
        teamsData: {
          teams: [{
            name: 'Marlins',
            staff: { sourceUrl: 'https://team.test/staff' },
            url: 'https://team.test/home'
          }]
        }
      });

      assert.strictEqual(sources.documents.length, 3);
      assert.ok(sources.documents.some((source) => source.domain === 'pools'));
      assert.ok(sources.documents.some((source) => source.domain === 'meets'));
      assert.ok(sources.documents.some((source) => source.domain === 'teams'));
      assert.ok(sources.pages.some((source) => source.url === 'https://pools.test/bryant'));
      assert.deepStrictEqual(
        sources.pages.find((source) => source.url === 'https://league.test/home').domains,
        ['meets', 'teams']
      );
    });
  });

  describe('isDateWithinSeason', () => {
    it('should include the first and final published season days', () => {
      const season = { seasonStartDate: '2026-05-23', seasonEndDate: '2026-09-07' };

      assert.strictEqual(isDateWithinSeason('2026-05-23', season), true);
      assert.strictEqual(isDateWithinSeason('2026-09-07', season), true);
      assert.strictEqual(isDateWithinSeason('2026-09-08', season), false);
    });
  });

  describe('formatReport', () => {
    it('should request review of each affected domain', () => {
      const report = formatReport({
        checkedOn: '2026-06-01',
        season: 2026,
        changes: [
          {
            domain: 'pools',
            kind: 'Official document content changed',
            label: 'Pool',
            localPath: 'pools/pool-schedules/pool.pdf',
            url: 'https://pools.test/pool.pdf'
          },
          {
            domains: ['meets', 'teams'],
            kind: 'Public page content changed',
            label: 'League',
            url: 'https://league.test'
          }
        ]
      });

      assert.match(report, /pools\/pools\.json/);
      assert.match(report, /meets\/meets\.json/);
      assert.match(report, /teams\/teams\.json/);
    });
  });

  describe('monitorSources', () => {
    it('should ignore a webpage difference that is not repeated on confirmation', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cnsl-source-monitor-'));
      const dataRoot = path.join(root, 'src', 'assets', 'data', '2026');
      const baselineContent = '<main>Accepted page text</main>';
      const noisyUrl = 'https://pools.test/facility';
      const pageUrls = [
        noisyUrl,
        'https://pools.test/guide',
        'https://pools.test/directory',
        'https://league.test/home',
        'https://team.test/home',
        'https://team.test/staff'
      ];
      const pdfContent = Buffer.from('%PDF-retained');

      await Promise.all([
        fs.mkdir(path.join(dataRoot, 'pools', 'pool-schedules'), { recursive: true }),
        fs.mkdir(path.join(dataRoot, 'meets', 'meet-schedules'), { recursive: true }),
        fs.mkdir(path.join(dataRoot, 'teams', 'team-schedules'), { recursive: true }),
        fs.mkdir(path.join(root, 'src', 'js', 'config'), { recursive: true }),
        fs.mkdir(path.join(root, '.github', 'data-agent'), { recursive: true })
      ]);
      await Promise.all([
        fs.writeFile(path.join(root, 'src', 'js', 'config', 'app-config.js'), 'const YEAR = 2026;\n'),
        fs.writeFile(path.join(dataRoot, 'README.md'), '[CNSL home page](https://league.test/home)\n| Practice | [Download PDF](https://league.test/practice.pdf) | `teams/team-schedules/practice.pdf` | now |\n'),
        fs.writeFile(path.join(dataRoot, 'pools', 'pools.json'), JSON.stringify({
          caPoolDirectoryUrl: 'https://pools.test/directory',
          caPoolGuideUrl: 'https://pools.test/guide',
          seasonEndDate: '2026-09-07',
          seasonStartDate: '2026-05-23',
          pools: [{ caUrl: noisyUrl, name: 'Pool', scheduleUrl: 'https://pools.test/pool.pdf' }]
        })),
        fs.writeFile(path.join(dataRoot, 'meets', 'meets.json'), JSON.stringify({ url: 'https://league.test/meet.pdf' })),
        fs.writeFile(path.join(dataRoot, 'teams', 'teams.json'), JSON.stringify({
          teams: [{ name: 'Team', staff: { sourceUrl: 'https://team.test/staff' }, url: 'https://team.test/home' }]
        })),
        fs.writeFile(path.join(dataRoot, 'pools', 'pool-schedules', 'pool.pdf'), pdfContent),
        fs.writeFile(path.join(dataRoot, 'meets', 'meet-schedules', 'meet.pdf'), pdfContent),
        fs.writeFile(path.join(dataRoot, 'teams', 'team-schedules', 'practice.pdf'), pdfContent),
        fs.writeFile(path.join(root, '.github', 'data-agent', 'source-state.json'), JSON.stringify({
          acceptedOn: '2026-05-24',
          season: 2026,
          pages: pageUrls.map((url) => ({ domains: ['pools'], label: 'Source', sha256: sha256(normalizeHtml(baselineContent)), url }))
        }))
      ]);

      let noisyRequestCount = 0;
      const fetchImplementation = async (url) => {
        let content = Buffer.from(baselineContent);
        if (url.endsWith('.pdf')) {
          content = pdfContent;
        } else if (url === noisyUrl && noisyRequestCount++ === 0) {
          content = Buffer.from('<main>Transient response text</main>');
        }
        return { ok: true, arrayBuffer: async () => content };
      };

      try {
        const result = await monitorSources({ fetchImplementation, repositoryRoot: root, today: '2026-06-01' });
        assert.strictEqual(result.changed, false);
        assert.strictEqual(noisyRequestCount, 2);
      } finally {
        await fs.rm(root, { force: true, recursive: true });
      }
    });
  });
});
