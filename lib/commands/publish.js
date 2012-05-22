var utils = require('../utils'),
    logger = require('../logger'),
    couchdb = require('../couchdb'),
    repository = require('../repository'),
    argParse = require('../args').parse,
    url = require('url'),
    urlParse = url.parse,
    urlFormat = url.format;


exports.hidden = true;

exports.run = function (settings, args) {
    console.log('Did you mean publish-package or publish-task?');
};


// called by publish-package and publish-task commands
exports.doPublish = function (type) {
    return function (settings, args) {
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
            utils.catchAuthError(exports.publish, repo, [type, dir, a.options],
                function (err) {
                    if (err) {
                        return logger.error(err);
                    }
                    logger.end();
                }
            );
        });
    };
};


exports.publish = function (repo, type, dir, options, callback) {
    var root = couchdb(repo);
    root.instance.pathname = '';
    root.session(function (err, info, resp) {
        if (err) {
            return callback(err);
        }
        options.user = info.userCtx.name;
        options.server_time = new Date(resp.headers.date);
        repository.publish(type, dir, repo, options, callback);
    });
};

