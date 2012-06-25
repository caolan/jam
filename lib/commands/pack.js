var logger = require('../logger'),
    settings = require('../settings'),
    tar = require('../tar'),
    path = require('path');


exports.summary = 'Create a tar.gz package';

exports.usage = '' +
    'jam pack SOURCE [TARGET]\n' +
    '\n' +
    'Parameters:\n' +
    '  SOURCE   The directory to pack\n' +
    '  TARGET   The .tar.gz file to create';


exports.run = function (_settings, args, commands) {
    if (args.length < 1) {
        console.log(exports.usage);
        logger.clean_exit = true;
        return;
    }
    var source = args[0];

    // TODO: add package.json validation
    settings.load(source, function (err, cfg) {
        if (err) {
            return logger.error(err);
        }

        var target = args[1] || cfg.name + '-' + cfg.version + '.tar.gz';

        // TODO: add directory to cache as name/version/package, then pack
        // package directory and store as name/version/package.tar.gz and
        // cp file to TARGET

        tar.create(cfg, source, target, function (err) {
            if (err) {
                return logger.error(err);
            }
            logger.end(target);
        });
    });
};
