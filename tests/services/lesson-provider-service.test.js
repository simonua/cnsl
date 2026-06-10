const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const LessonProviderService = require('../../src/js/services/lesson-provider-service.js');

const provider = {
  id: 'example-provider',
  name: 'Example Provider',
  websiteUrl: 'https://example.com/lessons',
  contactUrl: 'https://example.com/contact',
  contactName: 'Swim Lesson Program Supervisor',
  contactEmail: 'lessons@example.com',
  phone: '410-555-0100',
  logo: { src: 'assets/images/provider-logos/example-provider.png', width: 120, height: 50 },
  classTypes: ['Introductory swim'],
  sourceUrl: 'https://example.com/lessons',
  reviewedOn: '2026-06-08'
};

describe('LessonProviderService', () => {
  it('normalizes a usable provider document without sharing mutable arrays', () => {
    const [normalized] = LessonProviderService.normalizeDocument({ providers: [provider] });

    assert.deepEqual(normalized, provider);
    assert.notEqual(normalized.classTypes, provider.classTypes);
  });

  it('normalizes omitted optional contact details', () => {
    const [normalized] = LessonProviderService.normalizeDocument({
      providers: [{ ...provider, contactUrl: undefined, contactName: undefined, contactEmail: undefined, phone: undefined }]
    });

    assert.equal(normalized.contactUrl, '');
    assert.equal(normalized.contactName, '');
    assert.equal(normalized.contactEmail, '');
    assert.equal(normalized.phone, '');
  });

  it('rejects missing provider arrays and incomplete records', () => {
    assert.throws(() => LessonProviderService.normalizeDocument({}), /Invalid lesson provider data response/);
    assert.throws(() => LessonProviderService.normalizeProvider(null), /Invalid lesson provider record/);
    assert.throws(() => LessonProviderService.normalizeDocument({ providers: [{ name: 'Incomplete' }] }), /Invalid lesson provider record/);
  });

  it('rejects unsafe provider destinations and malformed phone numbers', () => {
    assert.throws(() => LessonProviderService.normalizeDocument({
      providers: [{ ...provider, websiteUrl: 'javascript:alert(1)' }]
    }), /Invalid lesson provider record/);
    assert.throws(() => LessonProviderService.normalizeDocument({
      providers: [{ ...provider, contactUrl: 'data:text/html,unsafe' }]
    }), /Invalid lesson provider record/);
    assert.throws(() => LessonProviderService.normalizeDocument({
      providers: [{ ...provider, phone: 'call-me' }]
    }), /Invalid lesson provider record/);
    assert.throws(() => LessonProviderService.normalizeDocument({
      providers: [{ ...provider, contactEmail: 'not-an-email' }]
    }), /Invalid lesson provider record/);
    assert.throws(() => LessonProviderService.normalizeDocument({
      providers: [{ ...provider, contactName: undefined }]
    }), /Invalid lesson provider record/);
    assert.throws(() => LessonProviderService.normalizeDocument({
      providers: [{ ...provider, websiteUrl: 'not a URL' }]
    }), /Invalid lesson provider record/);
  });

  it('normalizes related swimming programs and rejects unsafe destinations', () => {
    const relatedProgram = {
      id: 'example-team',
      name: 'Example Team',
      programType: 'Year-round swim team',
      logo: { src: 'assets/images/provider-logos/example-team.jpg', width: 230, height: 186 },
      websiteUrl: 'https://example.com/team',
      informationUrl: 'https://example.com/team/join',
      eligibility: 'Swimmers must complete an evaluation.',
      highlights: ['Year-round training'],
      practiceSetting: 'Practices are held indoors.',
      summerLeagueFit: 'The program is separate from summer league.',
      sourceUrl: 'https://example.com/team',
      reviewedOn: '2026-06-08'
    };

    assert.deepEqual(LessonProviderService.normalizeRelatedPrograms({ relatedPrograms: [relatedProgram] }), [relatedProgram]);
    assert.notEqual(
      LessonProviderService.normalizeRelatedPrograms({ relatedPrograms: [relatedProgram] })[0].highlights,
      relatedProgram.highlights
    );
    assert.throws(() => LessonProviderService.normalizeRelatedPrograms({
      relatedPrograms: [{ ...relatedProgram, websiteUrl: 'javascript:alert(1)' }]
    }), /Invalid related swimming program record/);
    assert.throws(() => LessonProviderService.normalizeRelatedPrograms({
      relatedPrograms: [{ ...relatedProgram, informationUrl: 'data:text/html,unsafe' }]
    }), /Invalid related swimming program record/);
    assert.throws(
      () => LessonProviderService.normalizeRelatedPrograms({}),
      /Invalid related swimming program data response/
    );
  });

  it('rejects arbitrary or incomplete logo assets', () => {
    assert.throws(() => LessonProviderService.normalizeDocument({
      providers: [{ ...provider, logo: { src: 'https://example.com/logo.png', width: 100, height: 100 } }]
    }), /Invalid lesson directory logo/);
  });

  it('normalizes CA outdoor swim programs with resolved pool names', () => {
    const documentData = {
      outdoorSwimPrograms: {
        sourceUrl: 'https://example.com/outdoor',
        registrationUrl: 'https://example.com/register',
        reviewedOn: '2026-06-10',
        options: [{
          name: 'Morning lesson camps',
          schedule: '10:00am - 12:00pm',
          cadence: 'Five-day sessions',
          locations: [{ poolId: 'dhp', days: 'Monday - Friday' }]
        }],
        bring: ['Goggles'],
        weatherPolicy: 'Lessons continue in light rain.',
        alternative: { name: 'Personal Swim Training', url: 'https://example.com/training' }
      }
    };

    const normalized = LessonProviderService.normalizeOutdoorSwimPrograms(documentData, [{ id: 'dhp', name: 'Dorsey Hall' }]);
    assert.equal(normalized.options[0].locations[0].poolName, 'Dorsey Hall');
    assert.notEqual(normalized.bring, documentData.outdoorSwimPrograms.bring);
  });

  it('rejects unsafe or unresolved outdoor swim program data', () => {
    const programs = {
      sourceUrl: 'https://example.com/outdoor',
      registrationUrl: 'https://example.com/register',
      reviewedOn: '2026-06-10',
      options: [{ name: 'Morning', schedule: 'Morning', cadence: 'Weekly', locations: [{ poolId: 'missing', days: 'Monday' }] }],
      bring: ['Towel'],
      weatherPolicy: 'Light rain is permitted.',
      alternative: { name: 'Training', url: 'https://example.com/training' }
    };
    assert.throws(
      () => LessonProviderService.normalizeOutdoorSwimPrograms({ outdoorSwimPrograms: programs }, []),
      /Invalid outdoor swim program location/
    );
    assert.throws(
      () => LessonProviderService.normalizeOutdoorSwimPrograms({
        outdoorSwimPrograms: { ...programs, sourceUrl: 'javascript:alert(1)', options: [{ ...programs.options[0], locations: [{ poolId: 'dhp', days: 'Monday' }] }] }
      }, [{ id: 'dhp', name: 'Dorsey Hall' }]),
      /Invalid outdoor swim program data response/
    );
  });

  it('installs once as a browser script global', () => {
    const sourcePath = path.join(__dirname, '..', '..', 'src', 'js', 'services', 'lesson-provider-service.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const context = { URL, window: {} };
    vm.runInNewContext(source, context, { filename: sourcePath });
    const installedService = context.window.LessonProviderService;
    vm.runInNewContext(source, context, { filename: sourcePath });

    assert.equal(typeof installedService, 'function');
    assert.equal(context.window.LessonProviderService, installedService);
  });
});
