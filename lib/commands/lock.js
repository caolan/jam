var logger = require('../logger'),
    settings = require('../settings'),
    project = require('../project'),
    install = require('./install'),
    async = require('async'),
    path = require('path');


exports.summary = 'Locks a package to a specific version';

exports.usage = '' +
    'jam lock [PACKAGE[@VERSION] ...]\n' +
    '\n' +
    'When called without any parameters lists current locks.\n' +
    '\n' +
    'Parameters:\n' +
    '  PACKAGE    The package to lock to a specific version\n' +
    '  VERSION    The version to lock the package to\n' +
    '             (defaults to current version).\n' +
    '             You can also specify version ranges,\n' +
    '             eg, "1.2.x", "<= 3.4.0".\n' +
    '\n' +
    'Options:\n' +
    '  --repository   Source repository URL (otherwise uses values in jamrc)\n' +
    '  --package-dir  Jam package directory (defaults to "./jam")';


exports.run = function (_settings, args, commands) {
    var a = argParse(args, {
        'target_dir': {match: '--package-dir', value: true},
        'repository': {match: '--repository', value: true}
    });

    var opt = a.options;
    opt.target_dir = opt.target_dir || './jam';

    opt.repositories = _settings.repositories;
    if (a.options.repository) {
        opt.repositories = [a.options.repository];
        // don't allow package dir .jamrc file to overwrite repositories
        opt.fixed_repositories = true;
    }

    project.load(opt.target_dir, function (err, meta) {
        if (err) {
            return logger.error(err);
        }

        // list current locks
        if (a.positional.length < 1) {
            for (var name in meta.dependencies) {
                if (meta.dependencies[name]) {
                    console.log(name + '@' + meta.dependencies[name]);
                }
            }
            logger.clean_exit = true;
            return;
        }

        async.map(a.positional, function (name, cb) {
            var range = null;
            if (!range && name.indexOf('@') !== -1) {
                var parts = name.split('@');
                name = parts[0];
                range = parts.slice(1).join('@');
            }
            if (!(name in meta.dependencies)) {
                return cb(new Error('Package not found: "' + name + '"'));
            }
            if (!range) {
                // use current version
                var pkgdir = path.resolve(opt.target_dir, name);
                settings.load(pkgdir, function (err, cfg) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, {name: cfg.name, range: cfg.version});
                });
            }
            else {
                cb(null, {name: name, range: range});
            }
        },
        function (err, results) {
            if (err) {
                return logger.error(err);
            }
            results.forEach(function (r) {
                meta.dependencies[r.name] = r.range;
            });
            install.reinstallPackages(meta, opt, function (err) {
                if (err) {
                    return logger.error(err);
                }
                logger.end();
            });
        });
    });
};
