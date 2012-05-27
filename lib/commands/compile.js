// TODO
// https://github.com/jrburke/almond
//
//
//      jam compile -i backbone -i d3 -o built.js
//
//
// - set up package paths for requirejs optimizer
// - run equivalent of:
//     node r.js -o baseUrl=. name=path/to/almond.js include=main
//     out=main-built.js wrap=true
//
//  (wrap is optional)
//
//
//  OR should this just be an extension of the optimize command?

var logger = require('../logger'),
    settings = require('../settings'),
    args = require('../args'),
    tar = require('../tar'),
    path = require('path'),
    requirejs = require('requirejs');


exports.summary = 'Combines modules and requirejs into a single file';

exports.usage = '' +
    'jam compile -i MODULE ... -o TARGET\n' +
    '\n' +
    'Options:\n' +
    '  -i, --include   Modules to optimize, combining them and their their\n' +
    '                  dependencies into a single file\n' +
    '  -o, --out       Output file for the compiled code\n' +
    '  --package-dir   Jam directory to use (defaults to "./jam")\n' +
    '  --wrap          Wraps the output in an anonymous function to avoid\n' +
    '                  require and define functions being added to the\n' +
    '                  global scope, this often makes sense when using the\n' +
    '                  almond option.\n' +
    '  --almond        Use the lighweight almond shim instead of RequireJS,\n' +
    '                  smaller filesize but can only load bundled resources\n' +
    '                  and cannot request additional modules.';


exports.run = function (settings, _args, commands) {
    var a = args.parse(_args, {
        includes: {match: ['-i', '--include'], multiple: true, value: true},
        pkgdir: {match: ['--package-dir'], value: true},
        outfile: {match: ['-o', '--out'], value: true},
        almond: {match: ['--almond']},
        wrap: {match: ['--wrap']}
    });

    if (!a.options.includes.length) {
        logger.error('You must include at least one module');
        console.log(exports.usage);
        logger.clean_exit = true;
        return;
    }
    if (!a.options.outfile) {
        logger.error('You must specify an output file');
        console.log(exports.usage);
        logger.clean_exit = true;
        return;
    }

    logger.info('compiling', a.options.outfile);
    if (a.options.includes.length) {
        logger.info('includes', a.options.includes.join(', '));
    }

    var source = '.';
    var configfile = path.resolve(
        source,
        a.options.pkgdir || 'jam',
        'require.config'
    );
    var packages = require(configfile).packages;

    var impl;
    if (a.options.almond) {
        logger.info('using almond.js');
        impl = path.relative(
            source,
            path.resolve(__dirname, '../../node_modules/almond/almond.js')
        );
    }
    else {
        var impl = path.relative(
            source,
            path.resolve(__dirname, '../../node_modules/requirejs/require.js')
        );
    }

    var includes;
    if (a.options.almond) {
        includes = a.options.includes;
    }
    else {
        includes = ['jam/require.config.js'].concat(a.options.includes);
    }

    var config = {
        baseUrl: source,
        packages: packages,
        name: impl,
        wrap: a.options.wrap,
        optimize: 'uglify',
        include: includes,
        out: a.options.outfile
    };
    requirejs.optimize(config, function (build_response) {
        logger.end(a.options.outfile);
    });
};
