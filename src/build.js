const babel = require('@babel/core');
const yParser = require('yargs-parser');
const { join, extname } = require('path');
const { existsSync, statSync, readdirSync } = require('fs');
const assert = require('assert');
const log = require('./utils/log');
const slash = require('slash2');
const chalk = require('chalk');
const rimraf = require('rimraf');
const vfs = require('vinyl-fs');
const through = require('through2');
const chokidar = require('chokidar');

const cwd = process.cwd();
let pkgCount = null;

function getBabelConfig(isBrowser) {
  const targets = isBrowser
    ? {
      browsers: ['last 2 versions', 'IE 10'],
    }
    : { node: 6 };
  return {
    presets: [
      [
        require.resolve('@babel/preset-env'),
        {
          targets,
        },
      ],
      ...(isBrowser ? [require.resolve('@babel/preset-react')] : []),
    ],
    plugins: [
      require.resolve('@babel/plugin-proposal-export-default-from'),
      require.resolve('@babel/plugin-proposal-do-expressions'),
      require.resolve('@babel/plugin-proposal-class-properties'),
    ],
  }
}

function addLastSlash(path) {
  return path.slice(-1) === '/' ? path : `${path}/`;
}

function transform(opts = {}) {
  const { content, path, pkg, root } = opts;
  assert(content, `opts.content should be supplied for transform()`);
  assert(path, `opts.path should be supplied for transform()`);
  assert(pkg, `opts.pkg should be supplied for transform()`);
  assert(root, `opts.root should be supplied for transform()`);
  assert(extname(path) === '.js', `extname of opts.path should be .js`);

  const { browserFiles } = pkg.umiTools || {};
  const isBrowser = browserFiles && browserFiles.includes(slash(path).replace(`${addLastSlash(slash(root))}`, ''));
  const babelConfig = getBabelConfig(isBrowser);
  log.transform(
    chalk[isBrowser ? 'yellow' : 'blue'](
      `${slash(path).replace(`${cwd}/`, '')}`,
    ),
  );
  return babel.transform(content, babelConfig).code;
}

function build(dir, opts = {}) {
  const { cwd, watch } = opts;
  assert(dir.charAt(0) !== '/', `dir should be relative`);
  assert(cwd, `opts.cwd should be supplied`);

  const pkgPath = join(cwd, dir, 'package.json');
  assert(existsSync(pkgPath), 'package.json should exists');
  const pkg = require(pkgPath);
  const libDir = join(dir, 'lib');
  const srcDir = join(dir, 'src');

  // clean
  rimraf.sync(join(cwd, libDir));

  function createStream(src) {
    assert(typeof src === 'string', `src for createStream should be string`);
    return vfs
      .src([
        src,
        `!${join(srcDir, '**/fixtures/**/*')}`,
        `!${join(srcDir, '**/.umi/**/*')}`,
        `!${join(srcDir, '**/.umi-production/**/*')}`,
        `!${join(srcDir, '**/*.test.js')}`,
        `!${join(srcDir, '**/*.e2e.js')}`,
      ], {
        allowEmpty: true,
        base: srcDir,
      })
      .pipe(through.obj((f, env, cb) => {
        if (extname(f.path) === '.js') {
          f.contents = Buffer.from(
            transform({
              content: f.contents,
              path: f.path,
              pkg,
              root: join(cwd, dir),
            }),
          );
        }
        cb(null, f);
      }))
      .pipe(vfs.dest(libDir));
  }

  // build
  const stream = createStream(join(srcDir, '**/*'));
  stream.on('end', () => {
    pkgCount -= 1;
    if (pkgCount === 0) {
      process.send('BUILD_COMPLETE');
    }
    // watch
    if (watch) {
      log.pending('start watch', srcDir);
      const watcher = chokidar.watch(join(cwd, srcDir), {
        ignoreInitial: true,
      });
      watcher.on('all', (event, fullPath) => {
        const relPath = fullPath.replace(join(cwd, srcDir), '');
        log.watch(`[${event}] ${join(srcDir, relPath)}`);
        if (!existsSync(fullPath)) return;
        if (statSync(fullPath).isFile()) {
          createStream(fullPath);
        }
      });
    }
  });
}

function isLerna(cwd) {
  return existsSync(join(cwd, 'lerna.json'));
}

// Init
const args = yParser(process.argv.slice(3));
const watch = args.w || args.watch;
if (isLerna(cwd)) {
  const dirs = readdirSync(join(cwd, 'packages'));
  pkgCount = dirs.length;
  dirs.forEach(pkg => {
    if (pkg.charAt(0) === '.') return;
    build(`./packages/${pkg}`, {
      cwd,
      watch,
    });
  });
} else {
  pkgCount = 1;
  build('./', {
    cwd,
    watch,
  });
}
