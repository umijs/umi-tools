const yParser = require('yargs-parser');
const rollup = require('rollup');
const assert = require('assert');
const { existsSync, readdirSync } = require('fs');
const { join } = require('path');
const nodeResolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const replace = require('rollup-plugin-replace');
const log = require('./utils/log');

const env = process.env.NODE_ENV;

const inputOptions = {
  external: ['react', 'react-dom'],
  plugins: [
    nodeResolve({
      jsnext: true,
    }),
    replace({
      'process.env.NODE_ENV': JSON.stringify(env),
    }),
    commonjs(),
  ],
};

const outputOptions = {
  format: 'umd',
  extend: true,
  globals: {
    'react': 'React',
    'react-dom': 'ReactDOM',
  },
};

function isLerna(cwd) {
  return existsSync(join(cwd, 'lerna.json'));
}

function build(dir, opts = {}) {
  const { cwd, watch } = opts;
  assert(dir.charAt(0) !== '/', `dir should be relative`);
  assert(cwd, `opts.cwd should be supplied`);

  const pkgPath = join(cwd, dir, 'package.json');
  assert(existsSync(pkgPath), 'package.json should exists');

  const pkg = require(pkgPath);
  const { rollupFiles = [] } = pkg.umiTools || {};

  (async () => {
    for (let rollupFile of rollupFiles) {
      const [ file, opts = {} ] = rollupFile;
      log.info(`build ${file}`);
      const input = {
        ...inputOptions,
        input: join(dir, file),
      };
      const output = {
        ...outputOptions,
        file: join(dir, file.replace(/\.js$/, '.umd.js')),
        name: opts.name,
      };

      if (watch) {
        const watcher = rollup.watch({
          ...input,
          output,
        });
        watcher.on('event', event => {
          log.info(`watch ${event.code}`);
        });
      } else {
        const bundle = await rollup.rollup(input);
        await bundle.write(output);
      }
    }
  })();
}

// Init
const cwd = process.cwd();
const args = yParser(process.argv.slice(3));
const watch = args.w || args.watch;
if (isLerna(cwd)) {
  const dirs = readdirSync(join(cwd, 'packages'));
  dirs.forEach(pkg => {
    if (pkg.charAt(0) === '.') return;
    build(`./packages/${pkg}`, {
      cwd,
      watch,
    });
  });
} else {
  build('./', {
    cwd,
    watch,
  });
}
