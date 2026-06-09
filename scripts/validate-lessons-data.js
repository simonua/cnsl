'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const dataDirectory = path.join(__dirname, '..', 'src', 'assets', 'data');
const data = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'lessons.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'lessons.schema.json'), 'utf8'));
const validator = new Ajv({ allErrors: true, strict: false });
addFormats(validator);
const validate = validator.compile(schema);

if (!validate(data)) {
  validate.errors.forEach(error => console.error(`lessons${error.instancePath || '/'}: ${error.message}`));
  process.exitCode = 1;
} else {
  const recordIds = [...data.providers, ...data.relatedPrograms].map(record => record.id);
  if (new Set(recordIds).size !== recordIds.length) {
    console.error('Lesson provider and related program IDs must be unique.');
    process.exitCode = 1;
  } else {
    console.log(`Validated ${data.providers.length} swim lesson provider record(s) and ${data.relatedPrograms.length} related program record(s).`);
  }
}