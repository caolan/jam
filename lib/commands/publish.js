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
'  PACKAGE_PATH    Path to package directory to publish (defaults to ".")\n' +
'\n' +
'Options:\n' +
'  -r, --repository  Target repository URL (defaults to first value in .jamrc)\n' +
'  -f, --force       Overwrite if version is already published';


exports.run = function (settings, args) {
    var a = argParse(args, {
        'repo': {match: ['-r', '--repository'], value: true},
        'force': {match: ['-f', '--force']}
    });
    var dir = a.positional[0] || '.';
    var repo = a.options.repo || settings.repositories[0];
    if (process.env.JAM_TEST) {
        repo = process.env.JAM_TEST_DB;
        if (!repo) {
            throw 'JAM_TEST environment variable set, but no JAM_TEST_DB set';
        }
    }
    exports.publish('package', repo, dir, a.options);
};


// called by both publish and publish-task commands
exports.publish = function (type, repo, dir, options) {
    utils.completeAuth(repo, true, function (err, repo) {
        if (err) {
            return callback(err);
        }
        utils.catchAuthError(exports.doPublish, repo, [type, dir, options],
            function (err) {
                if (err) {
                    return logger.error(err);
                }
                logger.end();
            }
        );
    });
};


exports.doPublish = function (repo, type, dir, options, callback) {
    var root = couchdb(repo);
    root.instance.pathname = '';
    root.session(function (err, info, resp) {
        if (err) {
            return callback(err);
        }
        options.user = info.userCtx.name;
        options.server_time = new Date(resp.headers.date);
        repository.publish(dir, repo, options, callback);
    });
};

