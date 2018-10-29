#!/usr/bin/env node

const signale = require('signale');
const yParser = require('yargs-parser');

const args = yParser(process.argv.slice(2));

if (args.v || args.version) {
  console.log(require('./package').version);
  process.exit(0);
}

switch (args._[0]) {
  case 'build':
  case 'test':
    require(`./src/${args._}`);
    break;
  default:
    signale.error(`Unknown command ${args._}`);
    break;
}
