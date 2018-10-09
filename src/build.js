const babel = require('@babel/core');
const { join, extname } = require('path');
const { existsSync, statSync, readdirSync } = require('fs');
const assert = require('assert');
const { Signale } = require('signale');
const slash = require('slash2');
const chalk = require('chalk');
const rimraf = require('rimraf');
const vfs = require('vinyl-fs');
const through = require('through2');
const chokidar = require('chokidar');

const cwd = process.cwd();
const signale = new Signale({
  types: {
    transform: {
      badge: '🎅',
      color: 'blue',
      label: 'transform',
    },
    pending: {
      badge: '++',
      color: 'magenta',
      label: 'pending'
    },
    watch: {
      badge: '**',
      color: 'yellow',
      label: 'watch'
    },
  }
})

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

function transform(opts = {}) {
  const { content, path, pkg, root } = opts;
  assert(content, `opts.content should be supplied for transform()`);
  assert(path, `opts.path should be supplied for transform()`);
  assert(pkg, `opts.pkg should be supplied for transform()`);
  assert(root, `opts.root should be supplied for transform()`);
  assert(extname(path) === '.js', `extname of opts.path should be .js`);

  const { browserFiles } = pkg.umiTools || {};
  const isBrowser = browserFiles && browserFiles.includes(slash(path).replace(`${slash(root)}/`, ''));
  const babelConfig = getBabelConfig(isBrowser);
  signale.transform(
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
        `!${join(srcDir, '**/fixtures')}`,
        `!${join(srcDir, '**/*.test.js')}`,
        `!${join(srcDir, '**/*.e2e.js')}`,
      ], {
        allowEmpty: true,
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
    // watch
    if (watch) {
      signale.pending('start watch', srcDir);
      const watcher = chokidar.watch(join(cwd, srcDir), {
        ignoreInitial: true,
      });
      watcher.on('all', (event, fullPath) => {
        const relPath = fullPath.replace(join(cwd, srcDir), '');
        signale.watch(`[${event}] ${join(srcDir, relPath)}`);
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
const watch = process.argv.includes('-w') || process.argv.includes('--watch');
if (isLerna(cwd)) {
  const dirs = readdirSync(join(cwd, 'packages'));
  dirs.forEach(pkg => {
    if (pkg.charAt(0) === '.') return;
    build(`./packages/${pkg}`, {
      cwd,
      watch,
    })
  });
} else {
  build('./', {
    cwd,
    watch,
  });
}
