const assert = require('assert');
const path = require('path');
const core = require('../core');

describe('preProcess', () => {
  it('should exist', () => {
    assert(typeof core.preProcess === 'function');
  });

  describe('watch', () => {
    it('doesn\'t watch any dirs if none passed in', () => {
      assert.deepEqual(core.preProcess({
        watch: undefined,
      }).watchedDirectories, []);
    });

    it('should pass values through', () => {
      assert.deepEqual(core.preProcess({
        watch: 'a,b',
      }).watchedDirectories, ['a', 'b']);
    });
  });

  describe('webpackConfig', () => {
    it('should pass passed in value through', () => {
      assert.equal(core.preProcess({
        'webpack-config': 'a',
      }).webpackConfig, 'a');
    });

    it('should default to local webpack config when no overrides exist', () => {
      assert.equal(core.preProcess({
        'webpack-config': undefined,
      }).webpackConfig, path.resolve(__dirname, '..', 'webpack.config.js'));
    });
  });

  describe('specGlob', () => {
    it('should pass passed in value through', () => {
      assert.equal(core.preProcess({
        spec: 'a',
      }).specGlob, 'a');
    });

    it('should default to empty', () => {
      assert.equal(core.preProcess({
        spec: undefined,
      }).specGlob, '');
    });
  });
  describe('additional required file', () => {
    it('should pass in an additional required file if specified', () => {
      assert.equal(core.preProcess({
        require: './a',
      }).require, './a');
    });
    it('should exclude the argument if empty', () => {
      assert.equal(core.preProcess({
        require: false,
      }).require, '');
    });
  });

  describe('NYC Config', () => {
    it('should use client .nycrc', () => {
      assert.equal(core.fileExistsOrDefault('path/one', 'path/two', {
        existsSync: () => true,
      }), 'path/one');
    });

    it('should use default .nycrc if no client .nycrc present', () => {
      assert.equal(core.fileExistsOrDefault('path/one', 'path/two', {
        existsSync: () => false,
      }), 'path/two');
    });

    it('isValidJSON should return false if invalid .nycrc JSON', () => {
      assert.equal(core.isValidJSON('', {
        readFileSync: () => '',
      }), false);
    });

    it('isValidJSON should return true if valid .nycrc JSON', () => {
      assert.equal(core.isValidJSON('', {
        readFileSync: () => JSON.stringify({ a: 1, b: 2 }),
      }), true);
    });
  });

  describe('webpack override functionality', () => {
    it('should create merged config when webpack.overrides.conf.js exists', () => {
      const fs = require('fs');
      const overridePath = path.join(process.cwd(), 'webpack.overrides.conf.js');
      const tempConfigPath = path.join(process.cwd(), '.vunit-webpack-merged.config.js');
      
      fs.writeFileSync(overridePath, 'module.exports = { resolve: { alias: { "@test": "/test" } } };');
      
      try {
        const result = core.preProcess({
          'webpack-config': undefined,
        });
        
        assert.equal(result.webpackConfig, tempConfigPath);
        assert.equal(result.hasOverrideFile, true);
        assert(fs.existsSync(tempConfigPath), 'Merged config file should be created');
        
        const mergedConfig = require(tempConfigPath);
        assert(mergedConfig.resolve, 'Merged config should have resolve property');
        assert(mergedConfig.resolve.alias, 'Merged config should have resolve.alias');
        assert.equal(mergedConfig.resolve.alias['@test'], '/test', 'Override alias should be present');
      } finally {
        if (fs.existsSync(overridePath)) fs.unlinkSync(overridePath);
        if (fs.existsSync(tempConfigPath)) fs.unlinkSync(tempConfigPath);
      }
    });

    it('should prioritize explicit webpack-config over overrides', () => {
      const fs = require('fs');
      const overridePath = path.join(process.cwd(), 'webpack.overrides.conf.js');
      
      fs.writeFileSync(overridePath, 'module.exports = { resolve: { alias: { "@test": "/test" } } };');
      
      try {
        const result = core.preProcess({
          'webpack-config': '/custom/webpack.config.js',
        });
        
        assert.equal(result.webpackConfig, '/custom/webpack.config.js');
        assert.equal(result.hasOverrideFile, true);
      } finally {
        if (fs.existsSync(overridePath)) fs.unlinkSync(overridePath);
      }
    });
  });
});
