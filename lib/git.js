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
    _ = require("underscore"),
    inherits = require("inherits-js"),
    Commitish, RemoteCommitish;

function run(command, options, cb) {
    if (_.isFunction(options)) {
        cb = options;
        options = {};
    }

    logger.verbose("git", 'running exec "' + command + '"');

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


Commitish = function(hash, type, value) {
    this.hash = hash;

    if (!value) {
        this.type = Commitish.COMMIT;
        this.value = hash;
    } else {
        this.type = type;
        this.value = value;
    }
};

Commitish.prototype.isEqual = function(commitish) {
    var test;

    test = commitish instanceof this.constructor;
    test = test && commitish.hash == this.hash;
    test = test && commitish.type == this.type;
    test = test && commitish.value == this.value;

    return test;
};

Commitish.COMMIT = "commit";
Commitish.TAG    = "tags";
Commitish.REMOTE = "remotes";
Commitish.HEAD   = "heads";

RemoteCommitish = inherits(Commitish, {
    constructor: function(hash, type, value, remote) {
        Commitish.prototype.constructor.apply(this, arguments);
        this.remote = remote;
    },

    isEqual: function(commitish) {
        return Commitish.prototype.isEqual.apply(this, arguments) && this.remote == commitish.remote;
    }
});

exports.Commitish = Commitish;
exports.RemoteCommitish = RemoteCommitish;


function Repository(path, uri) {
    this.path = path;
    this.uri = uri;
    this.at = null;
}

exports.Repository = Repository;

Repository.prototype = {
    log: (function() {
        var command;

        command = _.template('git rev-list --full-history --all');

        return function(callback) {
            var self = this;

            logger.debug("git", "getting log from " + this.path);

            // with 5MB
            run(command(), { cwd: this.path, maxBuffer: 1024 * 1024 * 5 }, function(err, stderr, stdout) {
                var log;

                if (err) {
                    callback(err);
                    return;
                }

                log = stdout.split("\n").filter(_.identity).map(function(hash) {
                    return new Commitish(hash);
                });

                logger.verbose("git", "log for " + self.path, log);

                callback(null, log);
            });
        }
    })(),

    ref: (function() {
        var command, regex;

        command = _.template('git show-ref');
        regex = /([0-9a-f]{5,40})\srefs\/(?:(?=tags|heads)(tags|heads)\/([^\/]+)|(?=remotes)(remotes)\/([^\/]+)\/([^\/]+))\n/gi;

        return function(callback) {
            var self = this;

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
                    var commitish;

                    if (found[4]) {
                        commitish = new RemoteCommitish(found[1], found[4], found[6], found[5]);
                    } else {
                        commitish = new Commitish(found[1], found[2], found[3]);
                    }

                    result.push(commitish);
                }

                regex.lastIndex = 0;

                logger.verbose("git", "refs for " + self.path, result);

                callback(null, result);
            });
        }
    })(),

    checkout: (function() {
        var cli, command;

        cli = {
            local:  _.template('git checkout <%= value %>'),
            remote: _.template('git checkout -b <%= value %> <%= remote %>/<%= value %>')
        };

        command = function(ctx) {
            var commitish;

            commitish = ctx.commitish;

            switch (ctx.commitish.type) {
                case Commitish.REMOTE: {
                    return cli.remote(commitish);
                }

                case Commitish.HEAD:
                case Commitish.TAG:
                case Commitish.COMMIT: {
                    return cli.local(commitish);
                }

                default: {
                    throw new Error("Could not define commitish type");
                }
            }
        };

        return function(commitish, callback) {
            var self = this;

            if (this.at && commitish.isEqual(this.at)) {
                callback(null);
                return;
            }

            logger.debug("git", "checking out " + this.path + "#" + commitish.value);

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

        command = _.template('git fetch --tags');

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
        var self = this;

        async.series(
            [
                async.apply(this.checkout.bind(this), commitish),
                function(done) {
                    // if we are on branch
                    if ( _.contains([Commitish.REMOTE, Commitish.HEAD], commitish.type) ) {
                        return self.pull(done)
                    }

                    done();
                }
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

    resolve: function(spec, callback) {
        var self = this;

        async.parallel(
            [
                function(next) {
                    self.ref(function(err, refs) {
                        if (err) {
                            next(err);
                            return;
                        }

                        next(null, refs);
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
                var list, commitish, order, isUnique;

                if (err) {
                    callback(err);
                    return;
                }

                order = [ Commitish.TAG, Commitish.HEAD, Commitish.COMMIT, Commitish.REMOTE ];

                list = _.chain(result)
                    .flatten()
                    .filter(function(commitish) {
                        return commitish.value == spec;
                    })
                    .map(function(commitish) {
                        return {
                            criteria: order.indexOf(commitish.type),
                            value: commitish
                        };
                    })
                    .sortBy("commitish")
                    .pluck("value")
                    .value();

                isUnique = list.length <= 1;

                commitish = _.first(list);

                if (!isUnique) {
                    //uniq = _.uniq(commitish, function(c) {
                    //    return c.hash;
                    //});

                    //if (uniq.length > 1) {
                    logger.info('git', 'multiple refs was found for the commitish "' + self.uri + '@' + spec + '": ' + _.pluck(list, 'type').join(', ') + '; during order using: ' + commitish.type);
                    //}
                }

                callback(null, commitish || null);
            }
        );
    },

    snapshot: function(commitish, callback) {
        var self = this;

        logger.debug("git", "serving snapshot " + this.path + "#" + commitish.value);

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

            logger.debug("git", "copying snapshot " + self.path + "#" + commitish.value + " => " + path);

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
                    var path, realHost, realPath, realUri, repository, uriParsed,
                        uriCloneConfig, uriClone,
                        sshProject;

                    uriParsed = url.parse(uri);

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
                        (realHost = uriParsed.hostname),
                        (realPath = _.isString(uriParsed.pathname) ? uriParsed.pathname.substr(1).replace(/:/gi, "").replace(/\.git$/gi, "") : hash(uri))
                    ].join("/");

                    realUri = [realHost, realPath].join("/");

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
                            next(null, (exports.repositories[uri] = new Repository(path, realUri)), true);
                            return;
                        }

                        logger.debug("git", "cloning " + uriClone);

                        run(command({ uri: uriClone, to: path }), function(err, stderr, stdout) {
                            if (err) {
                                callback(err);
                                return;
                            }

                            next(null, (exports.repositories[uriClone] = new Repository(path, realUri)), false);
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
    var spec, uriParsed, path;

    uriParsed = url.parse(uri);

    path = uri.split("#")[0];
    spec = uriParsed.hash ? uriParsed.hash.substr(1) : "master";

    exports.get(path, function(err, repository) {
        if (err) {
            callback(err);
            return;
        }

        repository.resolve(spec, function(err, commitish) {
            if (err) {
                callback(err);
                return;
            }

            if (!commitish) {
                logger.warning('package "' + name + '" from ' + path + ' does not provide any ref, tag or commit like "' + spec + '"');
                callback(null, {});
                return;
            }

            repository.switchTo(commitish, function(err) {
                if (err) {
                    callback(err);
                    return;
                }

                logger.debug("git", "loading package.json " + repository.path + "#" + spec);

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