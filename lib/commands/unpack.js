var logger = require('../logger'),
    tar = require('tar'),
    zlib = require('zlib'),
    fs = require('fs');


exports.summary = 'Create a .tar.gz file';

exports.usage = '' +
    'jam unpack SOURCE TARGET\n' +
    '\n' +
    'Parameters:\n' +
    '  SOURCE   The .tar.gz to extract\n' +
    '  TARGET   The location to extract to';


exports.run = function (settings, args, commands) {
    if (args.length < 2) {
        console.log(exports.usage);
        logger.clean_exit = true;
        return;
    }
    var source = args[0];
    var target = args[1];

    var freader = fs.createReadStream(source);
    freader.on('error', function (err) {
        logger.error('error reading ' + source);
        logger.error(err);
    });

    var extractor = tar.Extract({
        type: 'Directory',
        path: target,
        //strip: 1,
        filter: function () {
            // symbolic links are not allowed in packages
            if (this.type.match(/^.*Link$/)) {
                logger.warning(
                    'excluding symbolic link',
                    this.path.substr(target.length + 1) + ' -> ' + this.linkpath
                );
                return false;
            }
            return true;
        }
    });
    extractor.on('error', function (err) {
        logger.error('untar error ' + source);
        logger.error(err);
    });
    extractor.on('entry', function (entry) {
        logger.info('extracting', entry.path);
    });
    extractor.on('end', function () {
        logger.end(target);
    });

    var unzipper = zlib.Unzip();
    unzipper.on('error', function (err) {
        logger.error('unzip error ' + source);
        logger.error(err);
    });

    freader.pipe(unzipper).pipe(extractor);
};
