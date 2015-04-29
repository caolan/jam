var cp = require('child_process'),
    settings = require('./settings'),
    logger = require('./logger'),
    env = require('./env'),
    rimraf = require('rimraf'),
    ncp = require('ncp'),
    mkdirp = require('mkdirp'),
    fs = require('fs'),
    async = require('async'),
    url = require('url'),
    _ = require("underscore");

function run(command, options, cb) {
    if (_.isFunction(options)) {
        cb = options;
        options = {};
    }

    cp.exec(command, options, function(err, stdout, stderr) {
        if (err) {
            cb(err);
            return;
        }

        cb(null, stderr, stdout);
    });
}

exports.repositories = [];
exports.temp = [];

function Repository(path) {
    this.path = path;
    this.at = null;
}

exports.Repository = Repository;

Repository.prototype = {
    log: (function() {
        var command;

        command = _.template('git log --format="%H"');

        return function(callback) {
            logger.debug("git", "getting log from " + this.path);

            // with 5MB
            run(command(), { cwd: this.path, maxBuffer: 1024 * 1024 * 5 }, function(err, stderr, stdout) {
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

            // with 5MB
            run(command(), { cwd: this.path, maxBuffer: 1024 * 1024 * 5 }, function(err, stderr, stdout) {
                var found, result;

                if (err) {
                    callback(err);
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

    checkout: (function() {
        var command;

        command = _.template('git checkout <%= commitish %>');

        return function(commitish, callback) {
            var self = this;

            if (this.at === commitish) {
                callback(null);
                return;
            }

            logger.debug("git", "checking out " + this.path + "#" + commitish);

            run(command({ commitish: commitish }), { cwd: this.path }, function(err, stderr, stdout) {
                if (err) {
                    callback(err);
                    return;
                }

                self.at = commitish;

                callback(null);
            });
        }
    })(),

    pull: (function() {
        var command;

        command = _.template('git pull');

        return function(callback) {
            logger.debug("git", "pulling out " + this.path);

            run(command(), { cwd: this.path }, function(err, stderr, stdout) {
                if (err) {
                    callback(err);
                    return;
                }

                callback(null);
            });
        }
    })(),

    fetch: (function() {
        var command;

        command = _.template('git fetch');

        return function(callback) {
            var self = this;

            logger.debug("git", "fetching out " + this.path);

            run(command(), { cwd: this.path }, function(err, stderr, stdout) {
                if (err) {
                    callback(err);
                    return;
                }

                callback(null);
            });
        }
    })(),

    switchTo: function(commitish, callback) {
        async.series(
            [
                async.apply(this.checkout.bind(this), commitish),
                async.apply(this.pull.bind(this))
            ],
            function(err) {
                if (err) {
                    callback(err);
                    return;
                }

                callback(null);
            }
        );
    },

    includes: function(commitish, callback) {
        var self = this;

        async.parallel(
            [
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

    snapshot: function(commitish, callback) {
        var self = this;

        logger.debug("git", "serving snapshot " + this.path + "#" + commitish);

        this.switchTo(commitish, function(err) {
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

            logger.debug("git", "copying snapshot " + self.path + "#" + commitish + " => " + path);

            async.series(
                [
                    async.apply(mkdirp, path),
                    async.apply(ncp.ncp, self.path, path, options)
                ],
                function(err) {
                    if (err) {
                        callback(err);
                        return;
                    }

                    exports.temp.push(path);

                    callback(null, path);
                }
            );
        });
    }
};


/**
 * Cache directory used to clone new remotes
 */
exports.CACHE_DIR = env.home + '/.jam/git';

/**
 * Temporary directory used to snapshot revisions
 */
exports.TMP_DIR = env.home + '/.jam/tmp';

/**
 * Gets the repository by url.
 * @type {Function}
 */
exports.get = (function() {
    var command;

    command = _.template('git clone <%= uri %> <%= to %>');

    function hash(str) {
        var hash, len, i;

        hash = 0;
        len = str.length;

        for (i = 0; i < len; i++) {
            hash = ( (hash << 5) - hash ) + str.charCodeAt(i);
            hash = hash & hash;
        }

        return Math.abs(hash).toString(16);
    }

    return function(uri, callback) {
        async.waterfall(
            [
                function(next) {
                    var path, repository, uriParsed,
                        uriCloneConfig, uriClone,
                        sshProject;

                    uriParsed = url.parse(uri);

                    //ssh://git@gitlab.corp.mail.ru:mail/toolkit-common.git

                    if (!_.isString(uriParsed.hostname)) {
                        next(new Error("Git URI is not valid"));
                        return;
                    }

                    switch (uriParsed.protocol) {
                        case "ssh:": {

                            uriCloneConfig = _.pick(uriParsed, [ "host", "auth" ]);

                            // project path could be divided by `:` or `/`
                            if (uriParsed.pathname.indexOf(":") == -1) {
                                sshProject = uriParsed.pathname.substr(1);
                            } else {
                                sshProject = uriParsed.pathname.split(":")[1]
                            }

                            if (!_.isString(sshProject)) {
                                next(new Error("Git SSH URI does not provide project name"));
                                return;
                            }

                            uriClone = url.format(uriCloneConfig).substr(2) + ":" + sshProject;

                            break;
                        }

                        default: {
                            uriClone = uriParsed.format();
                            break;
                        }
                    }

                    if (repository = exports.repositories[uriClone]) {
                        next(null, repository, false);
                        return;
                    }

                    path = [
                        exports.CACHE_DIR,
                        uriParsed.hostname,
                        _.isString(uriParsed.pathname) ? uriParsed.pathname.substr(1).replace(/:/gi, "").replace(/(\/|\.)/gi, "-") : hash(uri)
                    ].join("/");


                    fs.stat(path, function(err, stats) {
                        var isEmpty;

                        if (err) {
                            switch (err.code) {
                                case "ENOENT": {
                                    isEmpty = true;
                                    break;
                                }

                                default: {
                                    next(err);
                                    return;
                                }
                            }
                        }

                        if (!isEmpty && stats.isDirectory()) {
                            logger.debug("git", "using cached clone from " + path);
                            next(null, (exports.repositories[uri] = new Repository(path)), true);
                            return;
                        }

                        logger.debug("git", "cloning " + uriClone);

                        run(command({ uri: uriClone, to: path }), function(err, stderr, stdout) {
                            if (err) {
                                callback(err);
                                return;
                            }

                            next(null, (exports.repositories[uriClone] = new Repository(path)), false);
                        });
                    });
                },
                function(repository, mustFetch, next) {
                    if (mustFetch) {
                        repository.fetch(function(err) {
                            next(err, repository);
                        });

                        return;
                    }

                    next(null, repository);
                }
            ],
            function(err, repository) {
                if (err) {
                    callback(err);
                    return;
                }

                callback(null, repository);
            }
        );
    }
})();

/**
 * Cleaning up temp directories.
 * @param cb
 */
exports.cleanup = function(cb) {
    logger.debug("git", "cleaning up");

    async.forEach(
        exports.temp,
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

            repository.switchTo(commitish, function(err) {
                if (err) {
                    callback(err);
                    return;
                }

                logger.debug("git", "loading package.json " + repository.path + "#" + commitish);

                settings.load(repository.path, function(err, doc) {
                    var versions;

                    if (err) {
                        logger.warning('package "' + name + '" from ' + uri + " does not provide valid package.json");
                        callback(err);
                        return;
                    }

                    (versions = []).push({
                        source: 'git',
                        git: {
                            path: path,
                            commitish: commitish,
                            uri: uri
                        },
                        config: doc,
                        version: doc.version
                    });

                    callback(null, versions);
                });
            });
        });
    });
};