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
    jamrc = require('../jamrc'),
    install = require('./install'),
    args = require('../args'),
    tar = require('../tar'),
    path = require('path'),
    requirejs = require('requirejs'),
    project = require('../project');


exports.summary = 'Combines modules and requirejs into a single file';

exports.usage = '\n' +
    'jam compile TARGET\n' +
    'jam compile -i MODULE ... -o TARGET\n' +
    '\n' +
    'When called without -i parameters, all installed packages are included\n' +
    'in the compiled output. With -i parameters, only the specified\n' +
    'packages are compiled, this can also include modules from your own\n' +
    'project directory.\n' +
    '\n' +
    'Parameters:\n' +
    '  TARGET    The filename to save compiled output to\n' +
    '\n' +
    'Options:\n' +
    '  -i, --include       Specific modules to optimize, combining them and\n' +
    '                      their dependencies into a single file.\n' +
    '  -e, --exclude       Shallow excludes a module from the build (it\'s\n' +
    '                      dependencies will still be included).\n' +
    '  -E, --deep-exclude  Deep excludes a module and it\'s dependencies\n' +
    '                      from the build.\n' +
    '  -o, --out           Output file for the compiled code\n' +
    '  -d, --package-dir   Jam directory to use (defaults to "./jam")\n' +
    '  -w, --wrap          Wraps the output in an anonymous function to avoid\n' +
    '                      require and define functions being added to the\n' +
    '                      global scope, this often makes sense when using the\n' +
    '                      almond option.\n' +
    '  -a, --almond        Use the lighweight almond shim instead of RequireJS,\n' +
    '                      smaller filesize but can only load bundled resources\n' +
    '                      and cannot request additional modules.\n' +
    '  -v, --verbose       Increase log level to report all compiled modules\n' +
    '  --no-minify         Do not minify concatenated file with UglifyJS.\n' +
    '  --no-license        Do not include license comments.';


exports.run = function (settings, _args) {
    var logger = require('../logger');

    var a = args.parse(_args, {
        includes: {match: ['-i', '--include'], multiple: true, value: true},
        shallowExcludes: {
            match: ['-e', '--exclude'],
            multiple: true,
            value: true
        },
        deepExcludes: {
            match: ['-E', '--deep-exclude'],
            multiple: true,
            value: true
        },
        output: {match: ['-o', '--out'], value: true},
        pkgdir: {match: ['-d','--package-dir'], value: true},
        baseurl: {match: ['--baseurl'], value: true},
        wrap: {match: ['-w','--wrap']},
        almond: {match: ['-a','--almond']},
        verbose: {match: ['-v','--verbose']},
        nominify: {match: ['--no-minify']},
        nolicense: {match: ['--no-license']}
    });

    var opt = a.options;
    opt.output = opt.output || a.positional[0];

    if (!opt.output) {
        logger.error('You must specify an output file');
        console.log(exports.usage);
        logger.clean_exit = true;
        return;
    }

    var start_time = new Date().getTime();
    opt.cwd = process.cwd();
    opt.settings = settings;

    exports.compile(opt, function (err) {
        if (err) {
            return logger.error(err);
        }
        var duration = new Date().getTime() - start_time;
        logger.end(opt.output + ' (' + duration + 'ms)');
    });
};


// DONT forget to update docs in index.js file when changing args!
exports.compile = function (opt, callback) {
    if (!opt.settings) {
        opt.settings = jamrc.DEFAULTS;
    }
    if (!opt.cwd) {
        opt.cwd = process.cwd();
    }
    install.initDir(opt.settings, opt.cwd, opt, function (err, opt, cfg, pdir) {
        if (err) {
            return logger.error(err);
        }

        if (!opt.pkgdir) {
            if (cfg.jam && cfg.jam.packageDir) {
                opt.pkgdir = path.resolve(pdir, cfg.jam.packageDir);
            }
            else {
                opt.pkgdir = path.resolve(pdir, opt.settings.package_dir);
            }
        }
        if (!opt.baseurl) {
            if (cfg.jam && cfg.jam.baseUrl) {
                opt.baseurl = path.resolve(pdir, cfg.jam.baseUrl);
            }
            else {
                opt.baseurl = path.resolve(pdir, opt.settings.baseUrl);
            }
        }

        var configfile = path.resolve(opt.pkgdir, 'require.config');

        var packages = require(configfile).packages;
        if (!opt.includes.length) {
            // compile all installed modules by default
            opt.includes = packages.map(function (pkg) {
                return pkg.name;
            });
        }
        if (!opt.output) {
            return callback('You must specify an output file');
        }

        logger.info('compiling', opt.output);
        if (opt.includes.length) {
            logger.info('include', opt.includes.join(', '));
        }

        var impl;
        if (opt.almond) {
            logger.info('using almond.js');
            impl = path.relative(
                path.resolve(opt.baseurl),
                path.resolve(__dirname, '../../node_modules/almond/almond')
            );
        }
        else {
            impl = path.relative(
                path.resolve(opt.baseurl),
                path.resolve(__dirname, '../../node_modules/requirejs/require')
            );
        }

        var includes;
        if (opt.almond) {
            includes = opt.includes;
        }
        else {
            includes = [
                path.relative(opt.baseurl, configfile)
            ].concat(opt.includes);
        }

        var config = {
            baseUrl: opt.baseurl,
            packages: packages,
            name: 'requireLib',
            wrap: opt.wrap,
            optimize: 'uglify',
            include: includes,
            out: opt.output,
            paths: {requireLib: impl}
        };
        if (opt.verbose) {
            config.logLevel = 0;
        }
        if (opt.nominify) {
            config.optimize = 'none';
        }
        if (opt.nolicense) {
            config.preserveLicenseComments = false;
        }
        if (opt.shallowExcludes && opt.shallowExcludes.length) {
            config.excludeShallow = opt.shallowExcludes;
        }
        if (opt.deepExcludes && opt.deepExcludes.length) {
            config.exclude = opt.deepExcludes;
        }
        try {
            requirejs.optimize(config, function (build_response) {
                callback(null, build_response);
            });
        }
        catch (e) {
            return callback(e);
        }
    });
};
