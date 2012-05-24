var logger = require('../logger'),
    settings = require('../settings'),
    args = require('../args'),
    tar = require('../tar'),
    path = require('path'),
    requirejs = require('requirejs');


exports.summary = 'Run RequireJS optimization on a project';

exports.usage = '' +
    'jam optimize SOURCE TARGET\n' +
    '\n' +
    'Parameters:\n' +
    '  SOURCE   The project (not jam) directory to optimize\n' +
    '  TARGET   The output directory for optimized files\n' +
    '\n' +
    'Options:\n' +
    '  -m, --module    modules to optimize, combining their dependencies\n' +
    '                  into a single file\n' +
    '  --package-dir   jam directory to use (defaults to SOURCE/jam)';


exports.run = function (settings, _args, commands) {
    var a = args.parse(_args, {
        modules: {match: ['-m', '--module'], multiple: true, value: true},
        pkgdir: {match: ['--package-dir'], value: true}
    });

    if (a.positional.length < 2) {
        console.log(exports.usage);
        logger.clean_exit = true;
        return;
    }

    var source = a.positional[0];
    var target = a.positional[1];

    if (path.resolve(source) === path.resolve(target)) {
        return logger.error('Cannot output to source directory');
    }

    logger.info('optimizing', source + ' => ' + target);
    if (a.options.modules.length) {
        logger.info('modules', a.options.modules.join(', '));
    }

    var configfile = path.resolve(
        source,
        a.options.pkgdir || 'jam',
        'require.config'
    );
    var packages = require(configfile).packages;

    var config = {
        appDir: source,
        baseUrl: source,
        packages: packages,
        dir: target,
        optimize: 'uglify',
        modules: a.options.modules.map(function (m) {
            return {name: m};
        })
    };
    requirejs.optimize(config, function (build_response) {
        logger.end(target);
    });
};
