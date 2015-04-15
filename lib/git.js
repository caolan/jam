var exec = require('child_process').exec,
    settings = require('./settings'),
    logger = require('./logger'),
    semver = require('semver'),
    env = require('./env'),
    rimraf = require('rimraf'),
    ncp = require('ncp').ncp,
    mkdirp = require('mkdirp'),
    fs = require('fs'),
    async = require('async'),
    url = require('url'),
    _ = require("underscore");

var repositories = {},
    temp = [];

function run(command, options, cb) {
    if (_.isFunction(options)) {
        cb = options;
        options = {};
    }

    exec(command, options, function(err, stdout, stderr) {
        if (err) {
            cb(err);
            return;
        }

        cb(null, stderr, stdout);
    });
}

function Repository(path) {
    this.path = path;
}

Repository.prototype = {
    log: (function() {
        var command;

        command = _.template('git log --format="%H"');

        return function(callback) {
            logger.debug("git", "getting log from " + this.path);

            run(command(), { cwd: this.path }, function(err, stderr, stdout) {
                if (err) {
                    callback(err);
                    return;
                }

                callback(null, stdout.split("\n").filter(_.identity));
            });
        }
    })(),

    ref: (function() {
        var command, regex;

        command = _.template('git show-ref');
        regex = /refs\/(?:(?=tags|heads)(tags|heads)\/([^\/]+)|(?=remotes)(remotes)\/([^\/]+)\/([^\/]+))\n/gi;

        return function(callback) {
            logger.debug("git", "getting refs from " + this.path);

            run(command(), { cwd: this.path }, function(err, stderr, stdout) {
                var found, result;

                if (err || stderr) {
                    callback(err || stderr);
                    return;
                }

                result = [];
                while (found = regex.exec(stdout)) {
                    var def;

                    if (found[3]) {
                        def = {
                            type: found[3],
                            remote: found[4],
                            value: found[5]
                        }
                    } else {
                        def = {
                            type: found[1],
                            value: found[2]
                        }
                    }

                    result.push(def);
                }

                regex.lastIndex = 0;

                callback(null, result);
            });
        }
    })(),

    includes: function(commitish, callback) {
        var self = this;

        async.parallel([
                function(next) {
                    self.ref(function(err, refs) {
                        if (err) {
                            next(err);
                            return;
                        }

                        next(null, refs.map(function(ref) {
                            return ref.value;
                        }));
                    });
                },
                function(next) {
                    self.log(function(err, logs) {
                        if (err) {
                            next(err);
                            return;
                        }

                        next(null, logs);
                    });
                }
            ],
            function(err, result) {
                if (err) {
                    callback(err);
                    return;
                }

                callback(null, _.chain(result).flatten().contains(commitish).value());
            }
        );
    },

    checkout: (function() {
        var command;

        command = _.template('git checkout <%= commitish %>');

        return function(commitish, callback) {
            logger.debug("git", "checking out " + this.path + "#" + commitish);

            run(command({ commitish: commitish }), { cwd: this.path }, function(err, stderr, stdout) {
                if (err) {
                    callback(err);
                    return;
                }

                callback(null, stdout);
            });
        }
    })(),

    snapshot: function(commitish, callback) {
        var self = this;

        this.checkout(commitish, function(err) {
            var path, options;

            if (err) {
                callback(err);
                return;
            }

            path = exports.TMP_DIR + "/" + [ "git", Date.now().toString(16), Math.floor(Math.random() * (( 1 << 16) + 1)).toString(16)].join("-");

            options = {
                stopOnError: true,
                filter: (function() {
                    var regexp;

                    regexp = /\.(git|gitignore)$/i;

                    return function(file) {
                        return !regexp.test(file);
                    }
                })()
            };

            async.series(
                [
                    async.apply(mkdirp, path),
                    async.apply(ncp, self.path, path, options),
                ],
                function(err) {
                    if (err) {
                        callback(err);
                        return;
                    }

                    temp.push(path);

                    callback(null, path);
                }
            );
        });
    }
};


/**
 * Temporary directory used to download new packages
 */

exports.TMP_DIR = env.home + '/.jam/tmp';
exports.CACHE_DIR = env.home + '/.jam/git';


/**
 *
 * @type {Function}
 */
exports.get = (function() {
    var command;

    command = _.template('git clone <%= uri %> <%= to %>');

    function getPath(uri) {
        var uriParsed;

        uriParsed = url.parse(uri);

        return exports.CACHE_DIR + "/" + [ uriParsed.hostname, uriParsed.pathname.substr(1).replace(/(\/|\.)/gi, "-") ].join("/");
    }

    return function(uri, callback) {
        var path, repository;

        if (repository = repositories[uri]) {
            callback(null, repository);
            return;
        }

        path = getPath(uri);

        fs.stat(path, function(err, stats) {
            var resolve, isEmpty;

            if (err) {
                switch (err.code) {
                    case "ENOENT": {
                        isEmpty = true;
                        break;
                    }

                    default: {
                        callback(err);
                        return;
                    }
                }
            }

            resolve = function() {
                callback(null, (repositories[uri] = new Repository(path)));
            };

            if (!isEmpty && stats.isDirectory()) {
                logger.debug("git", "using cached clone from " + path);
                resolve();
                return;
            }

            logger.debug("git", "cloning " + uri);

            run(command({ uri: uri, to: path }), function(err, stderr, stdout) {
                if (err) {
                    callback(err);
                    return;
                }

                resolve();
            });
        });
    }
})();

exports.cleanup = function(cb) {
    logger.debug("git", "cleaning up");

    async.forEach(
        temp,
        function(path, next) {
            logger.debug("git", "rimraf " + path);
            rimraf(path, next);
        },
        cb
    );
};

/**
 *
 * @param name
 * @param uri
 * @param callback
 */
exports.availableVersions = function (name, uri, callback) {
    var commitish, uriParsed, path;

    uriParsed = url.parse(uri);

    path = uri.split("#")[0];
    commitish = uriParsed.hash ? uriParsed.hash.substr(1) : "master";

    exports.get(path, function(err, repository) {
        if (err) {
            callback(err);
            return;
        }

        repository.includes(commitish, function(err, includes) {
            if (err) {
                callback(err);
                return;
            }

            if (!includes) {
                logger.warning('package "' + name + '" from ' + path + ' does not provide any ref, tag or commit like "' + commitish + '"');
                callback(null, {});
                return;
            }

            repository.checkout(commitish, function(err) {
                if (err) {
                    callback(err);
                    return;
                }

                settings.load(repository.path, function(err, doc) {
                    var versions;

                    if (err) {
                        logger.warning('package "' + name + '" from ' + uri + " does not provide package.json");
                        callback(err);
                        return;
                    }

                    (versions = {})[uri] = {
                        def: {
                            path: path,
                            commitish: commitish,
                            uri: uri
                        },
                        config: _.extend({}, doc, {
                            // hm
                            name: name
                        }),
                        source: 'git'
                    };

                    callback(null, versions);
                });
            });
        });
    });
};