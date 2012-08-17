var utils = require('../utils'),
    logger = require('../logger'),
    repository = require('../repository'),
    argParse = require('../args').parse,
    url = require('url'),
    urlParse = url.parse,
    urlFormat = url.format;


exports.summary = 'Remove a published package from a repository';

exports.usage = '' +
'jam unpublish PACKAGE[@VERSION]\n' +
'\n' +
'Parameters:\n' +
'  PACKAGE       Package name to unpublish\n' +
'  VERSION       Package version to unpublish, if no version is specified\n' +
'                all versions of the package are removed\n' +
'\n' +
'Options:\n' +
'  -r, --repository    Target repository URL (defaults to first value in jamrc)';


exports.run = function (settings, args) {
    var a = argParse(args, {
        'repo': {match: ['-r', '--repository'], value: true}
    });
    var repo = a.options.repo || settings.repositories[0];
    if (process.env.JAM_TEST) {
        repo = process.env.JAM_TEST_DB;
        if (!repo) {
            throw 'JAM_TEST environment variable set, but no JAM_TEST_DB set';
        }
    }

    var name = a.positional[0];
    var version;

    if (!name) {
        return logger.error('No package name specified');
    }
    if (name.indexOf('@') !== -1) {
        var parts = name.split('@');
        name = parts[0];
        version = parts.slice(1).join('@');
    }

    utils.completeAuth(repo, true, function (err, repo) {
        if (err) {
            return logger.error(err);
        }
        utils.catchAuthError(
            repository.unpublish, repo, [name, version, a.options],
            function (err) {
                if (err) {
                    return logger.error(err);
                }
                logger.end();
            }
        );
    });
};
