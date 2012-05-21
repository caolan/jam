var logger = require('../logger'),
    tar = require('../tar');


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

    tar.extract(source, target, function (err) {
        if (err) {
            return logger.error(err);
        }
        logger.end(target);
    });
};
