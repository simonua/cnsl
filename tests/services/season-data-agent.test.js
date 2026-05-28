const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  collectSources,
  createCandidateKey,
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

    it('should ignore pool page chrome while watching modeled facility evidence', () => {
      const first = '<header>Campaign A</header><main>Be sure to always check the Pool Status page. Pool has shade. Located at: 1 Main St. Amenities: Wi-fi. View Pool Schedule. Contact Us: Desk: 410-555-0100</main><footer>Copyright 2025</footer>';
      const second = '<header>Campaign B</header><main>Be sure to always check the Pool Status page. Pool has shade. Located at: 1 Main St. Amenities: Wi-fi. View Pool Schedule. Contact Us: Desk: 410-555-0100</main><footer>Copyright 2026</footer>';
      const changedAmenity = '<main>Be sure to always check the Pool Status page. Pool has shade. Located at: 1 Main St. Amenities: Wi-fi and slide. View Pool Schedule. Contact Us: Desk: 410-555-0100</main><footer>Copyright 2026</footer>';

      assert.strictEqual(normalizePageContent(first, 'pool-facility'), normalizePageContent(second, 'pool-facility'));
      assert.notStrictEqual(normalizePageContent(first, 'pool-facility'), normalizePageContent(changedAmenity, 'pool-facility'));
    });

    it('should detect a relocated official PDF link on a publication page', () => {
      const first = '<main>Meet schedule <a href="/files/meet-v1.pdf">Download</a></main>';
      const second = '<main>Meet schedule <a href="/files/meet-v2.pdf">Download</a></main>';

      assert.notStrictEqual(
        normalizePageContent(first, 'publication-links'),
        normalizePageContent(second, 'publication-links')
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
            id: 'bwp',
            name: 'Bryant Woods',
            scheduleUrl: 'https://pools.test/Bryant_Woods.pdf'
          }]
        },
        teamsData: {
          teams: [{
            id: 'lrm',
            name: 'Marlins',
            practice: { url: 'https://team.test/practices' },
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
      assert.strictEqual(sources.pages.find((source) => source.url === 'https://pools.test/bryant').fingerprint, 'pool-facility');
      assert.ok(sources.pages.some((source) => source.url === 'https://team.test/practices'));
      assert.ok(!sources.pages.some((source) => source.url === 'https://team.test/home'));
      assert.deepStrictEqual(
        sources.pages.find((source) => source.url === 'https://team.test/practices').sourceIds,
        ['team:lrm:practice']
      );
      assert.deepStrictEqual(
        sources.pages.find((source) => source.url === 'https://league.test/home').domains,
        ['meets', 'teams']
      );
      assert.strictEqual(sources.pages.find((source) => source.url === 'https://league.test/home').fingerprint, 'publication-links');
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
        candidateKey: '0123456789abcdef',
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
            domain: 'meets',
            kind: 'Official document content changed',
            label: 'Meet schedule',
            localPath: 'meets/meet-schedules/meet.pdf',
            url: 'https://league.test/meet.pdf'
          },
          {
            domain: 'teams',
            kind: 'Official document content changed',
            label: 'Practice schedule',
            localPath: 'teams/team-schedules/practice.pdf',
            url: 'https://league.test/practice.pdf'
          }
        ]
      });

      assert.match(report, /pools\/pools\.json/);
      assert.match(report, /meets\/meets\.json/);
      assert.match(report, /teams\/teams\.json/);
      assert.match(report, /coach and manager details and changed recorded practice schedules/);
      assert.match(report, /OFFICIAL_SOURCE_CHECKED_ON/);
      assert.match(report, /pnpm run validate:data/);
      assert.match(report, /Candidate key: `0123456789abcdef`/);
    });
  });

  describe('createCandidateKey', () => {
    it('should identify the same evidence independent of discovery order', () => {
      const pageChange = { domains: ['teams'], kind: 'Published data page content changed', sha256: 'page-hash', url: 'https://team.test/staff' };
      const documentChange = { domain: 'meets', kind: 'Official document content changed', remoteSha256: 'pdf-hash', url: 'https://league.test/meet.pdf' };

      assert.strictEqual(
        createCandidateKey([pageChange, documentChange]),
        createCandidateKey([documentChange, pageChange])
      );
    });
  });

  describe('monitorSources', () => {
    it('should report confirmed page or retained-document differences for represented-data review', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cnsl-source-monitor-'));
      const dataRoot = path.join(root, 'src', 'assets', 'data', '2026');
      const baselineContent = '<main>Accepted page text</main>';
      const noisyUrl = 'https://pools.test/facility';
      const relocatedStaffUrl = 'https://team.test/staff-current';
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
        fs.mkdir(path.join(root, '.github', 'automation', 'season-data-monitor'), { recursive: true })
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
          teams: [{ id: 'team', name: 'Team', staff: { sourceUrl: relocatedStaffUrl }, url: 'https://team.test/home' }]
        })),
        fs.writeFile(path.join(dataRoot, 'pools', 'pool-schedules', 'pool.pdf'), pdfContent),
        fs.writeFile(path.join(dataRoot, 'meets', 'meet-schedules', 'meet.pdf'), pdfContent),
        fs.writeFile(path.join(dataRoot, 'teams', 'team-schedules', 'practice.pdf'), pdfContent),
        fs.writeFile(path.join(root, '.github', 'automation', 'season-data-monitor', 'source-state.json'), JSON.stringify({
          acceptedOn: '2026-05-24',
          season: 2026,
          pages: pageUrls.map((url) => ({
            domains: new URL(url).hostname === 'team.test' ? ['teams'] : ['pools'],
            label: url === 'https://team.test/staff'
              ? 'Team staff page'
              : (url === 'https://team.test/home' ? 'Team home page' : 'Source'),
            sha256: sha256(normalizeHtml(baselineContent)),
            url
          }))
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

        const changedStaffFetchImplementation = async (url) => {
          let content = Buffer.from(baselineContent);
          if (url.endsWith('.pdf')) {
            content = pdfContent;
          } else if (url === relocatedStaffUrl) {
            content = Buffer.from('<main>Updated published coach listing</main>');
          }
          return { ok: true, arrayBuffer: async () => content };
        };
        const changedResult = await monitorSources({
          report: true,
          fetchImplementation: changedStaffFetchImplementation,
          repositoryRoot: root,
          today: '2026-06-01'
        });

        assert.strictEqual(changedResult.changed, true);
        assert.deepStrictEqual(changedResult.changes.map((change) => change.kind), ['Published data page content changed']);
        assert.deepStrictEqual(changedResult.pageChanges.map((change) => change.kind), ['Published data page content changed']);
        assert.strictEqual(changedResult.pageChanges[0].url, relocatedStaffUrl);
        assert.match(changedResult.candidateKey, /^[0-9a-f]{16}$/);
        assert.match(
          await fs.readFile(path.join(root, '.github', 'automation', 'season-data-monitor', 'update-report.md'), 'utf8'),
          /Review the official source against the modeled annual JSON fields/
        );

        const unavailableDocumentResult = await monitorSources({
          fetchImplementation: async (url) => {
            if (url === 'https://league.test/meet.pdf') {
              return { ok: false, status: 404, arrayBuffer: async () => Buffer.alloc(0) };
            }
            const content = url.endsWith('.pdf') ? pdfContent : Buffer.from(baselineContent);
            return { ok: true, arrayBuffer: async () => content };
          },
          repositoryRoot: root,
          today: '2026-06-01'
        });

        assert.strictEqual(unavailableDocumentResult.changed, true);
        assert.ok(unavailableDocumentResult.changes.some((change) => change.kind === 'Official document link unavailable or relocated'));

        const changedPdfContent = Buffer.from('%PDF-updated-schedule');
        const changedDocumentFetchImplementation = async (url) => {
          const content = url === 'https://league.test/practice.pdf' ? changedPdfContent : (url.endsWith('.pdf') ? pdfContent : Buffer.from(baselineContent));
          return { ok: true, arrayBuffer: async () => content };
        };
        const changedDocumentResult = await monitorSources({
          apply: true,
          fetchImplementation: changedDocumentFetchImplementation,
          repositoryRoot: root,
          today: '2026-06-01'
        });

        assert.strictEqual(changedDocumentResult.changed, true);
        assert.deepStrictEqual(changedDocumentResult.changes.map((change) => change.kind), ['Official document content changed']);
        assert.deepStrictEqual(await fs.readFile(path.join(dataRoot, 'teams', 'team-schedules', 'practice.pdf')), changedPdfContent);
      } finally {
        await fs.rm(root, { force: true, recursive: true });
      }
    });
  });
});
