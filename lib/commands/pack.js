var logger = require('../logger'),
    utils = require('../utils'),
    tar = require('tar'),
    ignore = require('fstream-ignore'),
    path = require('path'),
    zlib = require('zlib'),
    fs = require('fs');


exports.summary = 'Create a .tar.gz file';

exports.usage = '' +
    'jam pack SOURCE [TARGET]\n' +
    '\n' +
    'Parameters:\n' +
    '  SOURCE   The directory to pack\n' +
    '  TARGET   The .tar.gz file to create';


exports.run = function (settings, args, commands) {
    if (args.length < 1) {
        console.log(exports.usage);
        logger.clean_exit = true;
        return;
    }
    var source = args[0];

    utils.readJSON(path.resolve(source, 'package.json'), function (err, cfg) {
        if (err) {
            return logger.error(err);
        }

        var target = args[1] || cfg.name + '-' + cfg.version + '.tar.gz';

        var fwriter = fs.createWriteStream(target);
        fwriter.on('error', function (err) {
            logger.error('error writing ' + target);
            logger.error(err);
        });
        fwriter.on('close', function () {
            logger.end(target);
        });

        var istream = ignore({
            path: source,
            ignoreFiles: [".jamignore", ".gitignore"]
        });
        istream.on('error', function (err) {
            logger.error('error reading ' + source);
        });
        istream.on("child", function (c) {
            logger.info('adding', c.path.substr(c.root.path.length + 1));
        });

        var packer = tar.Pack();
        packer.on('error', function (err) {
            logger.error('tar creation error ' + target);
        });

        var zipper = zlib.Gzip();
        zipper.on('error', function (err) {
            logger.error('gzip error ' + target);
        });

        istream.pipe(packer).pipe(zipper).pipe(fwriter);
    });
};
