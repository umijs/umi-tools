const yParser = require('yargs-parser');
const rollup = require('rollup');
const assert = require('assert');
const { existsSync, readdirSync } = require('fs');
const { join } = require('path');
const nodeResolve = require('rollup-plugin-node-resolve');
const commonjs = require('rollup-plugin-commonjs');
const replace = require('rollup-plugin-replace');
const log = require('./utils/log');
const parseGlobals = require('./utils/parseGlobals');

const env = process.env.NODE_ENV;

function isLerna(cwd) {
  return existsSync(join(cwd, 'lerna.json'));
}

function build(dir, opts = {}) {
  const { cwd, watch, globals = {} } = opts;
  assert(dir.charAt(0) !== '/', `dir should be relative`);
  assert(cwd, `opts.cwd should be supplied`);

  const pkgPath = join(cwd, dir, 'package.json');
  assert(existsSync(pkgPath), 'package.json should exists');

  const inputOptions = {
    external: [
      'react',
      'react-dom',
      ...Object.keys(globals),
    ],
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
      ...globals,
    },
  };

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
const globals = parseGlobals(args.g || args.globals || '');
if (isLerna(cwd)) {
  const dirs = readdirSync(join(cwd, 'packages'));
  dirs.forEach(pkg => {
    if (pkg.charAt(0) === '.') return;
    build(`./packages/${pkg}`, {
      cwd,
      watch,
      globals,
    });
  });
} else {
  build('./', {
    cwd,
    watch,
    globals,
  });
}
