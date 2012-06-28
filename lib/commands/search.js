var utils = require('../utils'),
    logger = require('../logger'),
    repository = require('../repository'),
    github = require('../github'),
    async = require('async');


exports.summary = 'Search available package sources';

exports.usage = '' +
    'jam search QUERY\n' +
    '\n' +
    'Parameters:\n' +
    '  QUERY    The package name to search for\n' +
    '\n' +
    'Options:\n' +
    '  -r, --repository   Source repository URL (otherwise uses values in jamrc)\n' +
    '  -g, --github       Search GitHub for matching repository name\n' +
    '                     (does not search package repositories when used)\n' +
    '  -l, --limit        Maximum number of results to return (defaults to 10).\n' +
    '                     When searching multiple repositories the limit is\n' +
    '                     applied to each repository, not the total';


exports.run = function (settings, args, commands) {
    var a = argParse(args, {
        'repository': {match: ['-r', '--repository'], value: true},
        'github': {match: ['-g', '--github']},
        'limit': {match: ['-l', '--limit'], value: true}
    });

    var opt = a.options;
    var repos = opt.repository ? [opt.repository]: settings.repositories;
    var limit = opt.limit || 10;
    var q = a.positional[0];

    if (!q) {
        logger.error('No query parameter');
        return;
    }

    if (opt.github) {
        exports.searchGitHub(q, limit);
    }
    else {
        exports.searchRepositories(repos, q, limit);
    }
};


exports.searchRepositories = function (repos, q, limit) {
    var total = 0;
    async.forEachLimit(repos, 4, function (repo, cb) {
        repository.search(repo, q, limit, function (err, data) {
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
                console.log(logger.cyan(
                    data.rows.length + ' results (limit: ' + limit + ')\n'
                ));
            }
            cb();
        });
    },
    function (err) {
        if (!err) {
            return logger.end(
                total + ' total results' +
                (repos.length > 1 ? '': ' (limit: ' + limit + ')')
            );
        }
    });
};


exports.searchGitHub = function (q, limit) {
    github.repos.search(q, function (err, data) {
        if (err) {
            return console.error(err);
        }
        var repos = data.repositories.slice(0, limit);
        repos.forEach(function (r) {
            var desc = utils.truncate(r.description.split('\n')[0], 76);
            console.log(
                logger.bold('gh:' + r.owner + '/' + r.name) + '\n' +
                //logger.yellow(' ' + r.version + '\n') + //TODO get latest tag?
                '    ' + desc
            );
        });
        return logger.end(repos.length + ' total results (limit: ' + limit + ')');
    });
};
