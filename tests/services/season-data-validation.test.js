const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const meetsData = require('../../src/assets/data/2026/meets/meets.json');
const meetsSchema = require('../../src/assets/data/2026/meets/meets.schema.json');
const poolsData = require('../../src/assets/data/2026/pools/pools.json');
const poolSchema = require('../../src/assets/data/2026/pools/pools.schema.json');
const teamsData = require('../../src/assets/data/2026/teams/teams.json');
const teamsSchema = require('../../src/assets/data/2026/teams/teams.schema.json');

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

    it('should enforce exact pool activity classifications and hours shapes', () => {
      const hoursSchema = {
        $ref: '#/definitions/Hours',
        definitions: poolSchema.definitions
      };
      const validRecords = [{
        weekDays: ['Mon'], types: ['Adult Laps Only'], accessStatus: 'public',
        startTime: '5:30am', endTime: '9:45am'
      }, {
        weekDays: ['Tue'], types: ['Closed to Public'], accessStatus: 'closed-to-public'
      }, {
        weekDays: ['Wed'], types: ['Closed to Public'], accessStatus: 'closed-to-public',
        startTime: '5:00pm', endTime: '8:00pm'
      }, {
        weekDays: ['Thu'], types: ['Masters Swim', 'Adult Laps Only'], accessStatus: 'public',
        startTime: '5:30am', endTime: '7:00am'
      }];
      const invalidRecords = [{
        weekDays: ['Mon'], types: 'Adult Laps Only', accessStatus: 'public',
        startTime: '5:30am', endTime: '9:45am'
      }, {
        weekDays: ['Mon'], types: ['Adult Laps Only'], accessStatus: 'restricted',
        startTime: '5:30am', endTime: '9:45am'
      }, {
        weekDays: ['Mon'], types: ['Adult Laps Only'], accessStatus: 'public'
      }, {
        weekDays: ['Mon'], types: ['Closed to Public'], accessStatus: 'closed-to-public', startTime: '5:30am'
      }, {
        weekDays: ['Mon'], types: ['Adult Laps Only'], accessStatus: 'public',
        startTime: '19:00pm', endTime: '9:45pm'
      }, {
        weekDays: ['Mon'], types: ['Masters Swim', 'Rec Swim'], accessStatus: 'public',
        startTime: '5:30am', endTime: '9:45am'
      }, {
        weekDays: ['Mon'], types: ['Pool Party'], accessStatus: 'special-event',
        isSpecialEvent: true, startTime: '6:00pm', endTime: '8:00pm'
      }];

      validRecords.forEach((record) => assert.deepStrictEqual(validateSchema('hours', record, hoursSchema), []));
      invalidRecords.forEach((record) => assert.ok(validateSchema('hours', record, hoursSchema).length > 0));
    });

    it('should require structured pool identity, location, and official HTTPS sources', () => {
      ['id', 'caUrl', 'location'].forEach((property) => {
        const invalidPoolsData = structuredClone(poolsData);
        delete invalidPoolsData.pools[0][property];
        assert.ok(validateSchema('pools', invalidPoolsData, poolSchema).length > 0);
      });

      ['caPoolDirectoryUrl', 'caPoolGuideUrl'].forEach((property) => {
        const invalidPoolsData = structuredClone(poolsData);
        delete invalidPoolsData[property];
        assert.ok(validateSchema('pools', invalidPoolsData, poolSchema).length > 0);
      });

      const insecurePoolsData = structuredClone(poolsData);
      insecurePoolsData.pools[0].caUrl = 'http://example.com/pool';
      assert.ok(validateSchema('pools', insecurePoolsData, poolSchema).length > 0);
    });

    it('should enforce real meet dates and HTTPS sources in annual schemas', () => {
      const invalidMeetsData = structuredClone(meetsData);
      invalidMeetsData.regular_meets[0].date = '2026-02-30';
      assert.ok(validateSchema('meets', invalidMeetsData, meetsSchema).length > 0);

      const insecureMeetsData = structuredClone(meetsData);
      insecureMeetsData.url = 'http://example.com/meets.pdf';
      assert.ok(validateSchema('meets', insecureMeetsData, meetsSchema).length > 0);

      const insecureTeamsData = structuredClone(teamsData);
      insecureTeamsData.teams[0].staff.sourceUrl = 'http://example.com/staff';
      assert.ok(validateSchema('teams', insecureTeamsData, teamsSchema).length > 0);
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
            laneCount: 6,
            laneLengthUnits: 'yards',
            laneLength: 25,
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
            eventsSubscriptionUrl: 'http://teams.test/Events.ics',
            booster: { name: 'Known Booster', url: 'http://teams.test/booster' },
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
      assert.ok(errors.includes('Known Team events subscription URL must use HTTPS: http://teams.test/Events.ics.'));
      assert.ok(errors.includes('Known Team booster URL must use HTTPS: http://teams.test/booster.'));
      assert.ok(errors.includes('Regular meet 1 references an unknown team alias: missing team.'));
      assert.ok(!errors.some((error) => error.includes('Known Pool lane measurement')));
    });

    it('should reject a known lane length without measurement units', () => {
      const errors = collectIntegrityErrors({
        season: 2026,
        poolsData: {
          caPoolDirectoryUrl: 'https://pools.test/directory', caPoolGuideUrl: 'https://pools.test/guide',
          seasonStartDate: '2026-05-23', seasonEndDate: '2026-09-07',
          pools: [{
            id: 'pool', name: 'Known Pool', caUrl: 'https://pools.test/known',
            scheduleUrl: 'https://pools.test/Known_Pool.pdf', location: { googleMapsUrl: 'https://maps.google.com/known' },
            laneCount: 6, laneLengthUnits: null, laneLength: 25, schedules: []
          }]
        },
        teamsData: { teams: [] },
        meetsData: { url: 'https://league.test/meets.pdf', regular_meets: [], special_meets: [] }
      });

      assert.ok(errors.includes('Known Pool lane measurement units must be provided when lane length is known.'));
    });

    it('should reject pool hours that do not end after their start time', () => {
      const errors = collectIntegrityErrors({
        season: 2026,
        poolsData: {
          caPoolDirectoryUrl: 'https://pools.test/directory', caPoolGuideUrl: 'https://pools.test/guide',
          seasonStartDate: '2026-05-23', seasonEndDate: '2026-09-07',
          pools: [{
            id: 'pool', name: 'Known Pool', caUrl: 'https://pools.test/known',
            scheduleUrl: 'https://pools.test/Known_Pool.pdf', location: { googleMapsUrl: 'https://maps.google.com/known' },
            laneCount: 6, laneLengthUnits: 'yards', laneLength: 25,
            schedules: [{
              startDate: '2026-06-01', endDate: '2026-06-30',
              hours: [{ weekDays: ['Mon'], types: ['Laps'], accessStatus: 'public', startTime: '7:00pm', endTime: '6:00pm' }]
            }],
            scheduleOverrides: [{
              startDate: '2026-06-15', endDate: '2026-06-15', reason: 'Test override',
              hours: [{ weekDays: ['Mon'], types: ['Laps'], accessStatus: 'public', startTime: '8:00pm', endTime: '8:00pm' }]
            }]
          }]
        },
        teamsData: { teams: [] },
        meetsData: { url: 'https://league.test/meets.pdf', regular_meets: [], special_meets: [] }
      });

      assert.ok(errors.includes('Known Pool schedule 1 hours 1 must end after it starts: 7:00pm to 6:00pm.'));
      assert.ok(errors.includes('Known Pool schedule override 1 hours 1 must end after it starts: 8:00pm to 8:00pm.'));
    });

    it('should reject unordered meet and team timing windows', () => {
      const errors = collectIntegrityErrors({
        season: 2026,
        poolsData: {
          caPoolDirectoryUrl: 'https://pools.test/directory',
          caPoolGuideUrl: 'https://pools.test/guide',
          seasonStartDate: '2026-05-23',
          seasonEndDate: '2026-09-07',
          pools: []
        },
        teamsData: {
          teams: [{
            id: 'team',
            name: 'Known Team',
            keywords: ['known'],
            url: 'https://teams.test/known',
            homePools: [],
            timeTrialsPool: '',
            practicePools: [],
            staff: { sourceUrl: 'https://teams.test/staff' },
            meetTimeOverrides: {
              timeTrials: { start: '12:00', end: '07:00' }
            }
          }]
        },
        meetsData: {
          url: 'https://league.test/meets.pdf',
          meetTimes: {
            dualMeets: {
              start: '07:00',
              end: '12:00',
              relayCheckInDeadline: '08:05',
              firstSwimTime: '08:00'
            },
            timeTrials: { start: '12:00', end: '07:00' }
          },
          regular_meets: [],
          special_meets: []
        }
      });

      assert.ok(errors.includes('Known Team timeTrials timing window must end after it starts: 12:00 to 07:00.'));
      assert.ok(errors.includes('Meet timeTrials timing window must end after it starts: 12:00 to 07:00.'));
      assert.ok(errors.includes(
        'Meet dualMeets timing must order start, relay check-in deadline, first swim, and end: 07:00, 08:05, 08:00, 12:00.'
      ));
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

    it('should reject detailed practice locations outside the declared pool relationships', () => {
      const errors = collectIntegrityErrors({
        season: 2026,
        poolsData: {
          caPoolDirectoryUrl: 'https://pools.test/directory',
          caPoolGuideUrl: 'https://pools.test/guide',
          seasonStartDate: '2026-05-23',
          seasonEndDate: '2026-09-07',
          pools: [{
            id: 'known', name: 'Known Pool', caUrl: 'https://pools.test/known',
            scheduleUrl: 'https://pools.test/Known_Pool.pdf',
            location: { googleMapsUrl: 'https://maps.google.com/known' }, schedules: []
          }]
        },
        teamsData: {
          teams: [{
            id: 'missing-declaration', name: 'Missing Declaration', keywords: ['missing'],
            url: 'https://teams.test/missing', homePools: ['Known Pool'], practicePools: [],
            staff: { sourceUrl: 'https://teams.test/staff' },
            practice: { preseason: [{ period: 'May 25 - May 29', days: 'Monday', location: 'Known Pool Pool', sessions: [{ group: 'All', time: '5:00 - 6:00pm' }] }] }
          }, {
            id: 'unknown-location', name: 'Unknown Location', keywords: ['unknown'],
            url: 'https://teams.test/unknown', homePools: ['Known Pool'], practicePools: ['Known Pool'],
            staff: { sourceUrl: 'https://teams.test/staff' },
            practice: { preseason: [{ period: 'May 25 - May 29', days: 'Monday', location: 'Absent Pool Pool', sessions: [{ group: 'All', time: '5:00 - 6:00pm' }] }] }
          }]
        },
        meetsData: { url: 'https://league.test/meets.pdf', regular_meets: [], special_meets: [] }
      });

      assert.ok(errors.includes('Missing Declaration detailed practice location is missing from practicePools: Known Pool.'));
      assert.ok(errors.includes('Unknown Location detailed practice references unknown pool location: Absent Pool Pool.'));
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
