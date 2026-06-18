'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const dataDirectory = path.join(__dirname, '..', 'src', 'assets', 'data');
const data = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'lessons.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'lessons.schema.json'), 'utf8'));
const config = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'config', 'app-config.js'), 'utf8');
const activeYear = config.match(/\bconst YEAR = (\d{4});/);
if (!activeYear) {
  throw new Error('Could not find the active YEAR in src/js/config/app-config.js.');
}
const poolsData = JSON.parse(fs.readFileSync(path.join(dataDirectory, activeYear[1], 'pools', 'pools.json'), 'utf8'));
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
    const poolIds = new Set(poolsData.pools.map(pool => pool.id));
    const unknownPoolIds = data.outdoorSwimPrograms.options
      .flatMap(option => option.locations)
      .map(location => location.poolId)
      .filter(poolId => !poolIds.has(poolId));
    if (unknownPoolIds.length > 0) {
      [...new Set(unknownPoolIds)].forEach(poolId => console.error(`CA outdoor swim program references unknown pool id: ${poolId}.`));
      process.exitCode = 1;
    } else {
      console.log(`Validated ${data.providers.length} swim lesson provider record(s), ${data.outdoorSwimPrograms.options.length} outdoor lesson option(s), and ${data.relatedPrograms.length} related program record(s).`);
    }
  }
}
