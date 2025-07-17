const os = require('os');
const spawn = require('cross-spawn');
const path = require('path');
const chokidar = require('chokidar');
const fs = require('fs');
const { merge: webpackMerge } = require('webpack-merge');
/**
 *
 * @param {Object } conf
 * @param {string}  conf.webpack-config  Path to webpack config
 * @param {boolean} conf.watch          Run mocha with watch
 * @param {string}  conf.spec           Glob to mocha spec files.
 */

const preProcess = (conf) => {
  const febsOverridePath = path.join(process.cwd(), 'webpack.overrides.conf.js');
  const hasOverrideFile = fs.existsSync(febsOverridePath);

  const getWebpackConfig = () => {
    if (conf['webpack-config']) {
      return conf['webpack-config'];
    } else if (hasOverrideFile) {
      const defaultConfigPath = path.join(__dirname, 'webpack.config.js');
      const tempConfigPath = path.join(process.cwd(), '.vunit-webpack-merged.config.js');
      const configContent = `const { merge } = require('webpack-merge');
const defaultConfig = require('${defaultConfigPath}');
const overrides = require('${febsOverridePath}');

module.exports = merge(defaultConfig, overrides);`;
      fs.writeFileSync(tempConfigPath, configContent);
      
      return tempConfigPath;
    }
    return path.join(__dirname, 'webpack.config.js');
  };

  return {
    watchedDirectories: conf.watch && conf.watch.length ? conf.watch.split(',') : [],
    webpackConfig: getWebpackConfig(),
    specGlob: `${conf.spec ? conf.spec : ''}`,
    coverage: conf.coverage,
    report: conf.report,
    require: conf.require ? conf.require : '',
    reporter: conf.reporter ? conf.reporter : 'spec',
    hasOverrideFile,
  };
};

module.exports.preProcess = preProcess;

// Path to client's NYC config (may or may not actually exist)
const localNYCConfigPath = path.join(process.cwd(), '.nycrc');

// Helper function to return passed in path if it exists or a default path.
const fileExistsOrDefault = (path1, defaultPath, fslocal = fs) => (fslocal.existsSync(path1)
  ? path1
  : defaultPath
);

/**
 * Get the full path to NYC config in order to point the client to .nycrc in @rei/vunit.
 * If a local .nycrc exists, use that, otherwise use the path to @rei/vunit's .nycrc.
 * @returns {string}
 */
const pathToNYCConfig = fileExistsOrDefault(localNYCConfigPath, path.join(__dirname, '.nycrc'));

/**
 * Check if file is is valid JSON.
 * @param pth
 * @param fslocal
 * @returns {boolean}
 */
const isValidJSON = (pth, fslocal = fs) => {
  try {
    JSON.parse(fslocal.readFileSync(pth, 'utf8'));
  } catch (e) {
    return false;
  }
  return true;
};

// Check JSON config.
if (!isValidJSON(pathToNYCConfig)) {
  console.error(`.nycrc is invalid, ${pathToNYCConfig}`);
  process.exit(1);
}

module.exports.isValidJSON = isValidJSON;
module.exports.fileExistsOrDefault = fileExistsOrDefault;

module.exports.run = (conf) => {
  let watcher;

  if (!conf) {
    return;
  }

  const confPreprocessed = preProcess(conf);

  console.log('Running tests:');
  console.log('--------------------------------');
  console.log(`watched directories: ${confPreprocessed.watchedDirectories}`);
  
  let configMessage;
  if (conf['webpack-config']) {
    configMessage = conf['webpack-config'];
  } else if (confPreprocessed.hasOverrideFile) {
    configMessage = 'Using built-in config merged with webpack.overrides.conf.js';
  } else {
    configMessage = 'Using built-in config';
  }
  console.log(`webpack config: ${configMessage}`);
  
  console.log(`specGlob: ${confPreprocessed.specGlob}`);
  console.log(`Coverage: ${confPreprocessed.coverage}`);

  if (confPreprocessed.coverage) {
    console.log(`NYC Config: ${pathToNYCConfig}`);
  }

  if (conf.require)console.log(`Required files: ${confPreprocessed.require}`);
  console.log('--------------------------------');

  /**
   * Compile via webpack config and run unit tests.
   */
  const run = () => {
    // Base spawn command.
    const spawnCmd = [
      'cross-env',
      'BABEL_ENV=test',
      'NODE_ENV=test',
      'nyc',
      `--nycrc-path=${pathToNYCConfig}`, // Use local .nycrc
      '--reporter=lcov',
      '--reporter=text',
      '--reporter=json-summary', // Required by @rei/cov-stats
      '--report-dir=coverage',
      'mochapack',
      '--require', path.join(__dirname, 'setup.js'),
      '--colors',
      '--webpack-config',
      confPreprocessed.webpackConfig,
      '--require', path.join(__dirname, 'setup.js'),
      '--require', 'ignore-styles',
      `--reporter=${confPreprocessed.reporter}`,
      confPreprocessed.specGlob,
    ];

    // Remove nyc and its options if not running coverage.
    if (!confPreprocessed.coverage) {
      spawnCmd.splice(3, 6);
    }

    if (conf.require) {
      spawnCmd.push('--require');
      spawnCmd.push(confPreprocessed.require);
    }

    // Execute mochapack.
    const cmd = spawn('npx', spawnCmd);

    cmd.stdout.on('data', (data) => {
      const d = data.toString();
      if (d !== os.EOL) {
        process.stdout.write(d);
      }
    });

    // Log errors.
    cmd.stdout.on('error', (error) => {
      if (error) console.log(error);
    });

    // Log errors.
    cmd.stderr.on('data', (data) => {
      console.log(data.toString());
    });

    cmd.on('exit', (code) => {
      process.exitCode = code;
    });
  };

  // Re-run tests on file change.
  if (confPreprocessed.watchedDirectories.length > 0) {
    if (!watcher) {
      watcher = chokidar.watch(confPreprocessed.watchedDirectories);
      watcher.on('change', (pathToFile) => {
        console.log(`${pathToFile} changed.`);
        run();
      });
    }
  }

  // Run tests.
  run();
};
