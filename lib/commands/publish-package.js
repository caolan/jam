var utils = require('../utils'),
    logger = require('../logger'),
    couchdb = require('../couchdb'),
    repository = require('../repository'),
    argParse = require('../args').parse,
    url = require('url'),
    urlParse = url.parse,
    urlFormat = url.format;


exports.summary = 'Publish a package to a repository';

exports.usage = '' +
'jam publish [PACKAGE_PATH]\n' +
'\n' +
'Parameters:\n' +
'  PACKAGE_PATH    Path to package directory to pack (defaults to ".")\n' +
'\n' +
'Options:\n' +
'  --repo         Target repository URL (otherwise uses "default" in jamrc)\n' +
'  --force, -f    Overwrite if version is already published'


exports.run = function (settings, args) {
    var a = argParse(args, {
        'repo': {match: '--repo', value: true},
        'force': {match: ['--force', '-f']}
    });
    var dir = a.positional[0] || '.';
    var repo = a.options.repo || settings.repositories[0];
    utils.completeAuth(repo, true, function (err, repo) {
        if (err) {
            return callback(err);
        }
        utils.catchAuthError(exports.publish, repo, [dir, a.options],
            function (err) {
                if (err) {
                    return logger.error(err);
                }
                logger.end();
            }
        );
    });
};


exports.publish = function (repo, dir, options, callback) {
    var root = couchdb(repo);
    root.instance.pathname = '';
    root.session(function (err, info, resp) {
        if (err) {
            return callback(err);
        }
        options.user = info.userCtx.name;
        options.server_time = new Date(resp.headers.date);
        repository.publish('package', dir, repo, options, callback);
    });
};

