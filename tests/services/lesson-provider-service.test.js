const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const LessonProviderService = require('../../src/js/services/lesson-provider-service.js');

const provider = {
  id: 'example-provider',
  name: 'Example Provider',
  websiteUrl: 'https://example.com/lessons',
  contactUrl: 'https://example.com/contact',
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

  it('rejects missing provider arrays and incomplete records', () => {
    assert.throws(() => LessonProviderService.normalizeDocument({}), /Invalid lesson provider data response/);
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
  });

  it('rejects arbitrary or incomplete logo assets', () => {
    assert.throws(() => LessonProviderService.normalizeDocument({
      providers: [{ ...provider, logo: { src: 'https://example.com/logo.png', width: 100, height: 100 } }]
    }), /Invalid lesson directory logo/);
  });
});