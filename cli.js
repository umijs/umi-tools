#!/usr/bin/env node

const signale = require('signale');

const script = process.argv[2];
switch (script) {
  case 'build':
    require(`./src/${script}`);
    break;
  default:
    signale.error(`Unknown command ${script}`);
    break;
}
