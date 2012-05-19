var logger = require('../logger'),
    tar = require('tar'),
    ignore = require('fstream-ignore'),
    zlib = require('zlib'),
    fs = require('fs');


exports.summary = 'Create a .tar.gz file';

exports.usage = '' +
    'jam pack SOURCE TARGET\n' +
    '\n' +
    'Parameters:\n' +
    '  SOURCE   The directory to pack\n' +
    '  TARGET   The .tar.gz file to create';


exports.run = function (settings, args, commands) {
    if (args.length < 2) {
        console.log(exports.usage);
        logger.clean_exit = true;
        return;
    }
    var source = args[0];
    var target = args[1];

    var fwriter = fs.createWriteStream(target);
    fwriter.on('close', function () {
        logger.end(target);
    });

    var istream = ignore({
        path: source,
        ignoreFiles: [".jamignore", ".gitignore"]
    });
    istream.on("child", function (c) {
        logger.info('adding', c.path.substr(c.root.path.length + 1))
    });

    istream.pipe(tar.Pack()).pipe(zlib.Gzip()).pipe(fwriter);
};
