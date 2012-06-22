var utils = require('../utils'),
    logger = require('../logger'),
    repository = require('../repository'),
    async = require('async');


exports.summary = 'Search available package sources';

exports.usage = '' +
    'jam search QUERY\n' +
    '\n' +
    'Parameters:\n' +
    '  QUERY    The package name to search for\n' +
    '\n' +
    'Options:\n' +
    '  -r, --repository   Source repository URL (otherwise uses values in jamrc)'


exports.run = function (settings, args, commands) {
    var a = argParse(args, {
        'repository': {match: ['-r', '--repository'], value: true}
    });

    var opt = a.options;
    var repos = opt.repository ? [opt.repository]: settings.repositories;
    var q = a.positional[0];

    if (!q) {
        logger.error('No query parameter');
        return;
    }

    var total = 0;
    async.forEachLimit(repos, 4, function (repo, cb) {
        repository.search(repo, q, function (err, data) {
            if (repos.length > 1) {
                console.log(
                    logger.bold('\n' + logger.magenta(
                        'Results for ' + utils.noAuthURL(repo)
                    ))
                );
            }
            if (err) {
                logger.error(err);
                return cb(err);
            }
            total += data.rows.length;
            data.rows.forEach(function (r) {
                var desc = utils.truncate(r.doc.description.split('\n')[0], 76);
                console.log(
                    logger.bold(r.doc.name) +
                    logger.yellow(' ' + r.doc.tags.latest + '\n') +
                    '    ' + desc
                );
            });
            if (repos.length > 1) {
                console.log(logger.cyan(data.rows.length + ' results\n'));
            }
            cb();
        });
    },
    function (err) {
        if (!err) {
            return logger.end(total + ' total results');
        }
    });
};
