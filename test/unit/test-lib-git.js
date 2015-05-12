var sinon = require('sinon'),
    cp = require('child_process'),
    fs = require('fs'),
    path = require('path'),
    ncp = require('ncp'),
    url = require('url'),
    async = require('async'),
    chance = require('chance')(),
    _ = require('underscore'),
    logger = require('../../lib/logger'),
    git,
    mkdirp, rimraf, mkdirpCache, rimrafCache;

logger.clean_exit = true;

// stub function modules before they will be loaded by dm
require("mkdirp");
require("rimraf");
mkdirpCache = path.resolve("../node_modules/mkdirp/index.js");
rimrafCache = path.resolve("../node_modules/rimraf/rimraf.js");
mkdirp = require.cache[mkdirpCache].exports = sinon.spy(function(path, callback) {
    callback(null);
});
rimraf = require.cache[rimrafCache].exports = sinon.spy(function(path, callback) {
    callback(null);
});

// now require git
git = require('../../lib/git');


exports['get - should throw error when uri is not valid'] = function (test) {
    var uri;

    uri = chance.word();

    git.get(uri, function(err) {
        test.ok(err);
        test.equals(err.message, "Git URI is not valid");

        test.done();
    });
};

exports['get - should call git clone, if there no cached remote'] = function (test) {
    var uri, exec, stat;

    uri = url.format({
        host:"mail.ru",
        protocol: "http:",
        pathname: "/" + chance.word()
    });

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        callback(null);
    });

    stat = sinon.stub(fs, "stat", function(path, callback) {
        // simulate that directory not exists
        callback({code: "ENOENT"});
    });

    git.get(uri, function(err, repository) {
        test.ok(!err);
        test.ok(repository instanceof git.Repository);

        test.equals(exec.callCount, 1);
        test.equals(exec.firstCall.args[0], "git clone " + uri + " " + repository.path);

        test.equals(stat.callCount, 1);
        test.equals(stat.firstCall.args[0], repository.path);

        stat.restore();
        exec.restore();

        test.done();
    });
};


exports['get - should call git clone without schema, if it ssh'] = function (test) {
    var uri, expectedURI, exec, stat;

    uri = "ssh://git@mail.ru:jam.git";
    expectedURI = uri.replace("ssh://", "");

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        callback(null);
    });

    stat = sinon.stub(fs, "stat", function(path, callback) {
        // simulate that directory not exists
        callback({code: "ENOENT"});
    });

    git.get(uri, function(err, repository) {
        test.equals(exec.callCount, 1);
        test.equals(exec.firstCall.args[0], "git clone " + expectedURI + " " + repository.path);

        stat.restore();
        exec.restore();

        test.done();
    });
};


exports['get - should not call git clone, but fetch, if there cached remote'] = function (test) {
    var uri, exec, stat;

    uri = url.format({
        host:"mail.ru",
        protocol: "http:",
        pathname: "/" + chance.word()
    });

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        callback(null);
    });

    stat = sinon.stub(fs, "stat", function(path, callback) {
        // simulate that directory exists
        callback(null, { isDirectory: function() { return true } });
    });

    git.get(uri, function(err, repository) {
        test.ok(!err);
        test.ok(repository instanceof git.Repository);

        test.equals(exec.callCount, 1);
        test.equals(exec.firstCall.args[0], "git fetch --tags");

        test.equals(stat.callCount, 1);
        test.equals(stat.firstCall.args[0], repository.path);

        stat.restore();
        exec.restore();

        test.done();
    });
};


exports['repository.log - should call git log and return normalized results'] = function (test) {
    var repository, path, exec, gitLogCount, gitLog;

    path = chance.word();
    repository = new git.Repository(path);

    gitLog = _.map(_.range(gitLogCount = chance.integer({min: 1, max: 21})), function() {
        return new git.Commitish(require("crypto").randomBytes(20).toString('hex'));
    });

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        // simulate git log format
        callback(null, gitLog.map(function(c) { return c.hash; }).join("\n") + "\n");
    });

    repository.log(function(err, log) {
        test.ok(!err);
        test.ok(_.isArray(log));

        test.equals(exec.callCount, 1);
        test.equals(exec.firstCall.args[0], 'git rev-list --full-history --all');
        test.same(exec.firstCall.args[1], { cwd: path, maxBuffer: 1024 * 1024 * 5 });

        test.equals(log.length, gitLogCount);
        log.forEach(function(entry, index) {
            test.ok(entry.isEqual(gitLog[index]));
        });

        exec.restore();

        test.done();
    });
};


exports['repository.ref - should call git show-refs and return normalized results'] = function (test) {
    var repository, path, exec, gitRefsCount, gitRefs, values;

    path = chance.word();
    repository = new git.Repository(path);

    values = [];
    gitRefs = _.map(_.range(gitRefsCount = chance.integer({min: 1, max: 21})), function(index) {
        var line, hash, value, remote;

        line = [ ( hash = require("crypto").randomBytes(20).toString('hex') ) ];
        value = chance.word();

        switch (index % 3) {
            case 0: {
                line.push("refs/heads/" + value);
                values.push(new git.Commitish(hash, git.Commitish.HEAD, value));
                break;
            }

            case 1: {
                line.push("refs/tags/" + value);
                values.push(new git.Commitish(hash, git.Commitish.TAG, value));
                break;
            }

            case 2: {
                remote = chance.word() + "REMOTE";
                line.push("refs/remotes/" + remote + "/" + value);
                values.push(new git.RemoteCommitish(hash, git.Commitish.REMOTE, value, remote));
                break;
            }
        }

        return line.join(" ");
    });

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        // simulate git show-ref format
        callback(null, gitRefs.join("\n") + "\n");
    });

    repository.ref(function(err, refs) {
        test.ok(!err);
        test.ok(_.isArray(refs));

        test.equals(exec.callCount, 1);
        test.equals(exec.firstCall.args[0], 'git show-ref');
        test.same(exec.firstCall.args[1], { cwd: path, maxBuffer: 1024 * 1024 * 5 });

        test.equals(refs.length, gitRefsCount);

        refs.forEach(function(entry, index) {
            test.ok(entry.isEqual(values[index]));
        });

        exec.restore();

        test.done();
    });
};


exports['repository.checkout - should call git checkout remote'] = function (test) {
    var repository, path, remote, branch, commitish, exec, hash;

    path = chance.word();
    repository = new git.Repository(path);

    hash = require("crypto").randomBytes(20).toString('hex');
    remote = chance.word();
    branch = chance.word();

    commitish = new git.RemoteCommitish(hash, git.Commitish.REMOTE, branch, remote);

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        callback(null);
    });

    repository.checkout(commitish, function(err) {
        test.ok(!err);

        test.equals(exec.callCount, 1);
        test.equals(exec.firstCall.args[0], 'git checkout -b ' + branch + ' ' + remote + '/' + branch);
        test.same(exec.firstCall.args[1], { cwd: path });

        exec.restore();

        test.done();
    });
};

exports['repository.checkout - should call git checkout local'] = function (test) {
    var repository, path, commit, hash, exec;

    path = chance.word();
    repository = new git.Repository(path);

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        callback(null);
    });

    sinon.spy(repository, "checkout");

    commit = chance.word();
    hash = require("crypto").randomBytes(20).toString('hex');

    async.parallel(
        ["COMMIT", "TAG", "HEAD"].map(function(type) {
            return function(next) {
                var commitish;

                commitish = type == "COMMIT"
                    ? new git.Commitish(hash)
                    : new git.Commitish(hash, git.Commitish[type], commit);

                repository.checkout(commitish, next);
            }
        })
        ,
        function(err) {
            test.ok(!err);

            test.equals(exec.callCount, 3);

            _.times(3, function(i) {
                var commitish;

                commitish = repository.checkout.getCall(i).args[0];

                test.equals(exec.getCall(i).args[0], 'git checkout ' + ( commitish.type == git.Commitish.COMMIT ? commitish.hash : commitish.value ));
                test.same(exec.getCall(i).args[1], { cwd: path });
            });

            exec.restore();

            test.done();
        }
    );
};


exports['repository.checkout - should call git checkout once'] = function (test) {
    var repository, path, commitish, exec;

    path = chance.word();
    repository = new git.Repository(path);

    commitish = new git.Commitish(require("crypto").randomBytes(20).toString('hex'));

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        callback(null);
    });

    async.series(
        [
            async.apply(repository.checkout.bind(repository), commitish),
            async.apply(repository.checkout.bind(repository), commitish)
        ],
        function(err) {
            test.ok(!err);

            test.equals(exec.callCount, 1);

            exec.restore();

            test.done();
        }
    );
};


exports['repository.fetch - should call git fetch'] = function (test) {
    var repository, path, exec;

    path = chance.word();
    repository = new git.Repository(path);

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        callback(null);
    });

    repository.fetch(function(err) {
        test.ok(!err);

        test.equals(exec.callCount, 1);
        test.equals(exec.firstCall.args[0], 'git fetch --tags');
        test.same(exec.firstCall.args[1], { cwd: path });

        exec.restore();

        test.done();
    });
};


exports['repository.pull - should call git pull'] = function (test) {
    var repository, path, exec;

    path = chance.word();
    repository = new git.Repository(path);

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        callback(null);
    });

    repository.pull(function(err) {
        test.ok(!err);

        test.equals(exec.callCount, 1);
        test.equals(exec.firstCall.args[0], 'git pull');
        test.same(exec.firstCall.args[1], { cwd: path });

        exec.restore();

        test.done();
    });
};


exports['repository.switchTo - should checkout&pull'] = function (test) {
    var repository, path, checkout, pull, commitish;

    path = chance.word();
    repository = new git.Repository(path);

    checkout = sinon.stub(repository, "checkout", function(commitish, callback) {
        callback(null);
    });

    pull = sinon.stub(repository, "pull", function(callback) {
        callback(null);
    });

    commitish = new git.Commitish(chance.word());

    repository.switchTo(commitish, function(err) {
        test.ok(!err);

        test.equals(checkout.callCount, 1);
        test.equals(checkout.firstCall.args[0], commitish);

        test.equals(pull.callCount, 1);

        test.ok(checkout.calledBefore(pull));

        test.done();
    });
};

exports['repository.resolve - should search in logs and refs given spec'] = function (test) {
    var repository, path, ref, log,
        specHead, specRemote, specCommit;

    path = chance.word();
    repository = new git.Repository(path);

    specHead   = chance.word();
    specRemote = chance.word();
    specCommit = chance.word();

    ref = sinon.stub(repository, "ref", function(callback) {
        callback(null, [
            new git.Commitish(chance.word(), git.Commitish.HEAD,   specHead),
            new git.Commitish(chance.word(), git.Commitish.REMOTE, specRemote)
        ]);
    });

    log = sinon.stub(repository, "log", function(callback) {
        callback(null, [ new git.Commitish(specCommit) ]);
    });

    async.parallel(
        [
            async.apply(repository.resolve.bind(repository), chance.word()),
            async.apply(repository.resolve.bind(repository), specHead),
            async.apply(repository.resolve.bind(repository), specRemote),
            async.apply(repository.resolve.bind(repository), specCommit)
        ],
        function(err, result) {
            test.ok(!err);

            test.equals(ref.callCount, 4);
            test.equals(log.callCount, 4);

            test.ok(result[0] === null);
            test.ok(result[1] instanceof git.Commitish);
            test.ok(result[2] instanceof git.Commitish);
            test.ok(result[3] instanceof git.Commitish);

            test.done();
        }
    );
};


exports['repository.snapshot - should switch to commitish and then copy snapshot in a temp folder'] = function (test) {
    var repository, path, switchTo, cp, commit, commitish;

    path = chance.word();
    repository = new git.Repository(path);

    commit = chance.word();
    commitish = new git.Commitish(git.Commitish.COMMIT, commit);

    switchTo = sinon.stub(repository, "switchTo", function(commitish, callback) {
        callback(null);
    });

    cp = sinon.stub(ncp, "ncp", function(from, to, options, callback) {
        callback(null);
    });

    repository.snapshot(commitish, function(err, filepath) {
        var makePath;

        test.ok(!err);

        test.equals(switchTo.callCount, 1);
        test.equals(switchTo.firstCall.args[0], commitish);

        test.equals(mkdirp.callCount, 1);
        test.ok(_.isString(mkdirp.firstCall.args[0]));

        makePath = mkdirp.firstCall.args[0];

        test.equals(cp.callCount, 1);
        test.equals(cp.firstCall.args[0], path);
        test.equals(cp.firstCall.args[1], makePath);

        test.ok(mkdirp.calledBefore(cp));

        test.ok(_.contains(git.temp, makePath));

        test.equals(makePath, filepath);

        test.done();
    });
};


exports['cleanup - should rimraf all temp folders'] = function (test) {
    git.temp = _.map(_.range(chance.integer({min: 1, max: 7})), function() {
        return "/dev/null/" + chance.word();
    });

    git.cleanup(function(err) {
        test.ok(!err);

        test.equals(rimraf.callCount, git.temp.length);
        git.temp.forEach(function(p, i) {
            test.equals(rimraf.getCall(i).args[0], p);
        });

        test.done();
    });
};

// cleanup
delete require.cache[mkdirpCache];
delete require.cache[rimrafCache];