var couchdb = require('./couchdb'),
    settings = require('./settings'),
    versions = require('./versions'),
    cache = require('./cache'),
    utils = require('./utils'),
    rimraf = require('rimraf'),
    logger = require('./logger'),
    env = require('./env'),
    semver = require('semver'),
    mime = require('mime'),
    async = require('async'),
    path = require('path'),
    url = require('url'),
    urlParse = url.parse,
    urlFormat = url.format,
    fs = require('fs'),
    _ = require('underscore');


/**
 * Temporary directory used to download new packages to before unpacking and
 * adding to cache.
 */

exports.TMP_DIR = env.home + '/.jam/tmp';


/**
 * Attaches a .tar.gz file to a package document prior to publishing a new
 * version.
 *
 * @param {Object} doc - the document to attach the file to
 * @param {Object} cfg - the values from package.json
 * @param {String} tfile - the path to the .tar.gz file to attach
 * @param {Function} callback
 */

exports.attachTar = function (doc, cfg, tfile, callback) {
    fs.readFile(tfile, function (err, content) {
        if (err) {
            return callback(err);
        }
        doc._attachments = doc._attachments || {};
        doc._attachments[cfg.name + '-' + cfg.version + '.tar.gz'] = {
            content_type: 'application/x-compressed-tar',
            data: content.toString('base64')
        };
        callback(null, doc);
    });
};


/**
 * Attaches README file to a package document prior to publishing a new version.
 *
 * @param {Object} doc - the document to attach the file to
 * @param {Object} cfg - the values from package.json
 * @param {String} readme - the path to the README file to attach
 * @param {Function} callback
 */

exports.attachREADME = function (doc, cfg, readme, callback) {
    if (!readme) {
        return callback(null, doc);
    }
    fs.readFile(readme, function (err, content) {
        if (err) {
            return callback(err);
        }
        var basename = path.basename(readme);
        doc._attachments = doc._attachments || {};
        doc._attachments['docs/' + cfg.version + '/' + basename] = {
            content_type: mime.lookup(readme),
            data: content.toString('base64')
        };
        callback(null, doc);
    });
};


/**
 * Update a package document for a new published version. Adds .tar.gz archive
 * and README file as attachments.
 *
 * @param {Object} doc - the doc object to update
 * @param {Date} time - created time of the package
 * @param {Object} cfg - the config options from package.json
 * @param {String} tfile - the path to the .tar.gz archive for the new version
 * @param {String} readme - path to the README file for the new version
 * @param {Function} callback
 */

exports.updateDoc = function (doc, user, time, cfg, tfile, readme, callback) {
    doc.time.modified = utils.ISODateString(time);
    doc.time[cfg.version] = utils.ISODateString(time);

    doc.versions[cfg.version] = cfg;

    if (!doc.activity) {
        doc.activity = [];
    }
    doc.activity.push({
        user: user,
        time: doc.time.modified,
        action: doc._rev ? 'updated': 'created',
        version: cfg.version
    });

    var vers = Object.keys(doc.versions);
    var highest = versions.max(vers);

    if (highest === cfg.version) {
        doc.tags = doc.tags || {};
        doc.tags.latest = cfg.version;

        doc.name = cfg.name;
        doc.description = cfg.description;
        doc.keywords = cfg.keywords;
        doc.categories = cfg.categories;
        doc.homepage = cfg.homepage;
        doc.github = cfg.github;
    }

    async.parallel([
        async.apply(exports.attachTar, doc, cfg, tfile),
        async.apply(exports.attachREADME, doc, cfg, readme)
    ],
    function (err) {
        callback(err, doc);
    });
};


/**
 * Creates a new package document for publishing a new package.
 *
 * @param {String} user - owner of the package
 * @param {Date} time - created time of the package
 * @param {Object} cfg - the config options from package.json
 * @param {String} tfile - the path to the .tar.gz archive for this package
 * @param {String} readme - path to the README file
 * @param {Function} callback
 */

exports.createDoc = function (user, time, cfg, tfile, readme, callback) {
    var doc = {
        _id: cfg.name,
        name: cfg.name,
        type: 'package',
        owners: [user],
        versions: {},
        time: {
            created: utils.ISODateString(time)
        },
        activity: []
    };
    exports.updateDoc(doc, user, time, cfg, tfile, readme, callback);
};


/**
 * Cache object used to store package documents from repositories when using the
 * get function.
 *
 * Stored as exports.CACHE[repository][package_name] = doc
 */

exports.CACHE = {};


/**
 * Get package document from repository. Returns null if package is missing,
 * will return cached copies if use_cache is set to true (default is false).
 *
 * @param {String} repository - the URL to the repository
 * @param {String} name - the name of the package to lookup
 * @param {Boolean} use_cache - whether to return cached results
 * @param {Function} callback
 */

exports.get = function (repository, name, /*optional*/use_cache, callback) {
    if (!callback) {
        callback = use_cache;
        use_cache = false;
    }
    if (!repository) {
        return callback(null, null);
    }
    var repourl = repository;
    if (typeof repository === 'object') {
        repourl = repository.url;
    }
    if (!exports.CACHE[repourl]) {
        exports.CACHE[repourl] = {};
    }
    if (use_cache) {
        // use cached copy of document if available
        if (exports.CACHE[repourl][name]) {
            return callback(null, exports.CACHE[repourl][name]);
        }
    }
    var db = couchdb(repourl);
    var id = couchdb.encode(name || '');
    db.client('GET', id, null, function (err, data, res) {
        res = res || {};
        if (res.statusCode !== 404 && err) {
            return callback(err);
        }
        exports.CACHE[repourl][name] = data;
        callback(null, (res.statusCode === 200) ? data: null);
    });
};


/**
 * Finds a README file (with any or no extension) and returns its filename
 * if found or null if not.
 *
 * @param {String} dir - the package directory to search
 * @param {Function} callback
 */

exports.findREADME = function (dir, callback) {
    fs.readdir(dir, function (err, files) {
        if (err) {
            return callback(err);
        }
        // make sure the files are sorted so the same filename will match
        // first reliably in the same set
        files = files.sort();

        var readme = _.detect(files, function (f) {
            return /^README$|^README\..*$/i.test(f);
        });
        var filename = path.join(dir, readme);
        if (readme) {
            fs.stat(filename, function (err, stat) {
                if (err) {
                    return callback(err);
                }
                return callback(null, stat.isFile() ? filename: null);
            });
        }
        else {
            return callback(null, null);
        }
    });
};


exports.publish = function (path, repository, /*opt*/options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }
    var time = options.server_time || new Date();
    var repourl = repository;
    if (typeof repository === 'object') {
        repourl = repository.url;
    }

    settings.load(path, function (err, cfg) {
        if (err) {
            return callback(err);
        }
        async.series({
            get: async.apply(exports.get, repourl, cfg.name),
            cache: async.apply(cache.update, cfg, path),
            readme: async.apply(exports.findREADME, path),
            session: function (cb) {
                var parsed = urlParse(repourl);
                delete parsed.pathname;
                delete parsed.path;
                delete parsed.href;
                var root = urlFormat(parsed);
                couchdb(root).session(cb);
            }
        },
        function (err, results) {
            if (err) {
                return callback(err);
            }
            var curr = results.get;
            var tfile = results.cache[0];
            var dir = results.cache[1];
            var readme = results.readme;
            var user = results.session[0].userCtx.name;

            var db = couchdb(repourl);

            if (!curr) {
                return exports.createDoc(
                    user, time, cfg, tfile, readme, function (err, doc) {
                        db.save(cfg.name, doc, callback);
                    }
                );
            }
            else if (curr.versions && curr.versions[cfg.version]) {
                if (!options.force) {
                    return callback(
                        'Entry already exists for ' + cfg.name + ' ' +
                        cfg.version
                    );
                }
            }
            return exports.updateDoc(
                curr, user, time, cfg, tfile, readme, function (err, doc) {
                    db.save(cfg.name, doc, callback);
                }
            );
        });
    });
};

exports.unpublish = function (repository, name, version, options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }
    var repourl = repository;
    if (typeof repository === 'object') {
        repourl = repository.url;
    }
    var db = couchdb(repourl);

    function removeVersionFromCache(v) {
        return function (err) {
            if (err) {
                return callback(err);
            }
            cache.clear(name, v, callback);
        };
    }

    function removeVersion(v, data) {
        delete data.versions[v];
        delete data._attachments[name + '-' + v + '.tar.gz'];
        delete data.time[v];
        data.time.modified = utils.ISODateString(new Date());

        if (data.tags['latest'] === v) {
            var versions = Object.keys(data.versions).sort(semver.compare);
            data.tags['latest'] = versions[versions.length - 1];
        }

        if (Object.keys(data.versions).length) {
            db.save(name, data, removeVersionFromCache(v));
        }
        else {
            // no more version remaining
            db.delete(name, data._rev, removeVersionFromCache());
        }
    }
    exports.get(repourl, name, function (err, data) {
        if (err) {
            return callback(err);
        }
        if (!data) {
            return callback('No entry exists for ' + name);
        }
        if (!version) {
            return db.delete(
                name, data._rev, removeVersionFromCache()
            );
        }
        if (data.versions && data.versions[version]) {
            return removeVersion(version, data);
        }
        if (data.tags && data.tags[version]) {
            var v = data.tags[version];
            if (version !== 'latest') {
                delete data.tags[version];
            }
            return removeVersion(v, data);
        }
        return callback('No entry exists for ' + name + ' ' + version);
    });
};


/**
 * Find the maximum version of package by name which satisfies the provided
 * range. Returns the version, the package document and the repository URL
 * where the package is located. Repositories are checked in priority order
 * (earlier in the array is higher priority).
 *
 * @param {String} name - the name of the package to lookup
 * @param {String|Array} range - acceptable version range (or array of ranges)
 * @param {Array} repos - the repository URLs to check
 * @param {Function} callback
 */

exports.resolve = function (name, ranges, repos, callback) {
    if (!Array.isArray(ranges)) {
        ranges = [ranges];
    }
    if (!repos || !repos.length) {
        return callback(new Error('No repositories specified'));
    }
    exports.maxSatisfying(name, ranges, repos, function (err, m, vers) {
        if (err) {
            return callback(err);
        }
        if (!m) {
            if (vers && vers.length) {
                var e = new Error(
                    'No package for ' + name + ' @ ' + range + '\n' +
                    'Available versions: ' + vers.join(', ')
                );
                e.missing = true;
                e.versions = vers;
                return callback(e);
            }
            else {
                var e = new Error('No package for ' + name);
                e.missing = true;
                return callback(e);
            }
        }
        return callback(null, m.version, m.config, m.repository);
    });
};


/**
 * Checks a list of repositories for all available versions of a package.
 * Returns an object keyed by version containing a 'repository' property
 * containing a repository url for each key, which is the highest-priority
 * repository with that version (in order of the original array, earlier is
 * higher priority), and a 'doc' property containing the package document from
 * that repository.
 *
 * @param {String} name - the name of the package to lookup
 * @param {Array} repositories - an array of repository URLs
 * @param {Function} callback
 */

exports.availableVersions = function (name, repositories, callback) {
    var versions = {};
    async.forEach(repositories, function (repo, cb) {
        exports.get(repo, name, true, function (err, doc) {
            if (err) {
                return cb(err);
            }
            if (doc && doc.versions) {
                for (var k in doc.versions) {
                    if (!versions[k]) {
                        versions[k] = {
                            repository: repo,
                            config: doc.versions[k],
                            source: 'repository'
                        };
                    }
                }
            }
            cb();
        });
    },
    function (err) {
        callback(err, versions);
    });
};


/**
 * Checks all repositories in the list for available versions, then tests
 * all versions against all ranges and returns the highest version which
 * satisfies all ranges (null if none satisfy all of them). The object
 * returned has two properties 'repository' which is the repository the version
 * was found on, and 'version' which is the actual max satisfying version.
 *
 * @param {String} name - the name of the package to look up
 * @param {Array} ranges - an array of version range requirements
 * @param {Array} repositories - an array of repository URLs
 * @param {Function} callback
 */

exports.maxSatisfying = function (name, ranges, repositories, callback) {
    // TODO: what to do about tags?
    exports.availableVersions(name, repositories, function (err, vers) {
        if (err) {
            return callback(err);
        }
        var max = versions.maxSatisfying(Object.keys(vers), ranges);
        if (!max) {
            return callback(null, null);
        }
        return callback(null, {
            source: vers[max].source,
            repository: vers[max].repository,
            config: vers[max].config,
            version: max
        }, vers);
    });
};


exports.fetch = function (name, version, repos, callback) {
    logger.debug('fetching', name + ' (' + version + ')');

    cache.get(name, version, function (err, tarfile, cachedir) {
        if (cachedir && tarfile) {
            settings.load(cachedir, function (err, cfg) {
                if (err) {
                    return callback(err);
                }
                callback(null, tarfile, cachedir, version, cfg, true);
            });
            return;
        }

        exports.resolve(name, version, repos, function (err, v, cfg, repo) {
            if (err) {
                return callback(err);
            }
            var repourl = repo;
            if (typeof repourl === 'object') {
                repourl = repo.url;
            }
            cache.get(name, v, function (err, c_tfile, c_cdir) {
                if (err) {
                    return callback(err);
                }
                if (c_tfile && c_cdir) {
                    settings.load(cachedir, function (err, cfg) {
                        if (err) {
                            return callback(err);
                        }
                        callback(null, c_tfile, c_cdir, v, cfg, true);
                    });
                    return;
                }
                var filename = name + '-' + v + '.tar.gz';
                var url = repourl + '/' + name + '/' + filename;
                logger.info('downloading', utils.noAuthURL(url));
                exports.download(url, function (err, tarfile) {
                    if (err) {
                        return callback(err);
                    }
                    cache.moveTar(name, v, tarfile,
                        function (err, tfile, cdir) {
                            callback(err, tfile, cdir, v, cfg);
                        }
                    );
                });
            });
        });

    });
};


exports.download = function (file, callback) {
    var target = exports.TMP_DIR + '/' + path.basename(file);
    utils.download(file, target, callback);
};


exports.search = function (repo, q, /*optional*/limit, callback) {
    if (!callback) {
        callback = limit;
        limit = 10;
    }
    var repourl = repo;
    if (typeof repo === 'object') {
        repourl = repo.url;
    }
    var r = repourl.replace(/\/$/,'') + '/';
    var s_url = url.resolve(
        r, '/_fti/local/jam_packages/_design/jam-packages/packages'
    );
    if (typeof repo === 'object' && repo.search) {
        s_url = repo.search;
    }
    if (!/\s/.test(q)) {
        // if only a single word add a wildcard
        if (q.substr(q.length-1, 1) !== '*') {
            q += '*';
        }
    }
    var qs = {
        q: q,
        limit: limit,
        include_docs: true
    };
    logger.debug('using search at', utils.noAuthURL(s_url));

    var db = new couchdb.CouchDB(s_url);
    db.client('GET', '', qs, function (err, data, res) {
        if (!err && res.statusCode !== 200) {
            if (res.statusCode === 404) {
                return callback('Search API not available');
            }
            return callback('Search API returned status code: ' + res.statusCode);
        }
        return callback(err, data);
    });
};
