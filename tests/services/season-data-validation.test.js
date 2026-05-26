const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  collectIntegrityErrors,
  validateActiveSeason,
  validateRetainedDocuments,
  validateSchema
} = require('../../scripts/validate-season-data');

describe('season data validation', () => {
  describe('validateSchema', () => {
    it('should enforce date, URI, and email formats from annual schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date' },
          email: { type: 'string', format: 'email' },
          url: { type: 'string', format: 'uri' }
        },
        required: ['date', 'email', 'url']
      };

      const errors = validateSchema('sample', {
        date: '2026-02-30',
        email: 'not-an-email',
        url: 'not a url'
      }, schema);

      assert.strictEqual(errors.length, 3);
      assert.ok(errors.every((error) => error.startsWith('sample/')));
    });
  });

  describe('collectIntegrityErrors', () => {
    it('should reject unknown team pool and meet alias references', () => {
      const errors = collectIntegrityErrors({
        season: 2026,
        poolsData: {
          caPoolDirectoryUrl: 'https://pools.test/directory',
          caPoolGuideUrl: 'https://pools.test/guide',
          seasonStartDate: '2026-05-23',
          seasonEndDate: '2026-09-07',
          pools: [{
            id: 'pool',
            name: 'Known Pool',
            caUrl: 'https://pools.test/known',
            scheduleUrl: 'https://pools.test/Known_Pool.pdf',
            location: { googleMapsUrl: 'https://maps.google.com/known' },
            schedules: []
          }]
        },
        teamsData: {
          teams: [{
            id: 'team',
            name: 'Known Team',
            keywords: ['known'],
            url: 'https://teams.test/known',
            calendarUrl: 'http://teams.test/calendar',
            homePools: ['Missing Pool'],
            timeTrialsPool: 'Missing Time Trials Pool',
            practicePools: ['Known Pool'],
            staff: { sourceUrl: 'https://teams.test/staff' }
          }]
        },
        meetsData: {
          url: 'https://league.test/meets.pdf',
          regular_meets: [{
            date: '2026-06-13',
            home_team: 'Known',
            visiting_team: 'Missing Team',
            location: 'Known Pool Pool'
          }],
          special_meets: []
        }
      });

      assert.ok(errors.includes('Known Team references unknown pool: Missing Pool.'));
      assert.ok(errors.includes('Known Team references unknown pool: Missing Time Trials Pool.'));
      assert.ok(errors.includes('Known Team calendar URL must use HTTPS: http://teams.test/calendar.'));
      assert.ok(errors.includes('Regular meet 1 references an unknown team alias: missing team.'));
    });

    it('should reject detailed practice recurrence text that cannot render', () => {
      const errors = collectIntegrityErrors({
        season: 2026,
        poolsData: {
          caPoolDirectoryUrl: 'https://pools.test/directory',
          caPoolGuideUrl: 'https://pools.test/guide',
          seasonStartDate: '2026-05-23',
          seasonEndDate: '2026-09-07',
          pools: [{
            id: 'pool',
            name: 'Known Pool',
            caUrl: 'https://pools.test/known',
            scheduleUrl: 'https://pools.test/Known_Pool.pdf',
            location: { googleMapsUrl: 'https://maps.google.com/known' },
            schedules: []
          }]
        },
        teamsData: {
          teams: [{
            id: 'team',
            name: 'Known Team',
            keywords: ['known'],
            url: 'https://teams.test/known',
            homePools: ['Known Pool'],
            practicePools: ['Known Pool'],
            staff: { sourceUrl: 'https://teams.test/staff' },
            practice: {
              preseason: [{ period: 'May 29 - May 26', days: 'Business days' }]
            }
          }]
        },
        meetsData: {
          url: 'https://league.test/meets.pdf',
          regular_meets: [],
          special_meets: []
        }
      });

      assert.ok(errors.includes('Known Team practice preseason entry 1 date range cannot be rendered: May 29 - May 26.'));
      assert.ok(errors.includes('Known Team practice preseason entry 1 weekdays cannot be rendered: Business days.'));
    });
  });

  describe('validateActiveSeason', () => {
    it('should validate the active repository annual dataset', async () => {
      const result = await validateActiveSeason();

      assert.deepStrictEqual(result.errors, []);
      assert.ok(result.counts.pools > 0);
      assert.ok(result.counts.teams > 0);
      assert.ok(result.counts.retainedDocuments > 0);
    });
  });

  describe('validateRetainedDocuments', () => {
    it('should reject a stored official PDF omitted from annual data references', async () => {
      const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cnsl-data-validation-'));
      const teamDocument = path.join(dataRoot, 'teams', 'team-schedules', 'unlisted.pdf');
      await fs.mkdir(path.dirname(teamDocument), { recursive: true });
      await fs.writeFile(teamDocument, '%PDF-retained source');

      try {
        const result = await validateRetainedDocuments({
          annualReadme: '',
          dataRoot,
          meetsData: { url: 'invalid meet source' },
          poolsData: { pools: [] }
        });

        assert.ok(result.errors.includes(
          'Retained official document is not referenced by active data or its annual README: teams/team-schedules/unlisted.pdf.'
        ));
      } finally {
        await fs.rm(dataRoot, { force: true, recursive: true });
      }
    });
  });
});
