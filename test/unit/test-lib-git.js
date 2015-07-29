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
    cuculus = require('cuculus'),
    git,
    mkdirp, rimraf;

logger.clean_exit = true;


exports.setUp = function(cb) {
    cuculus.drop('mkdirp');
    cuculus.drop('rimraf');
    cuculus.drop(path.resolve(__dirname, '../../lib/git'));

    mkdirp = sinon.spy(function(path, callback) { callback(null); });
    cuculus.replace('mkdirp', mkdirp);

    rimraf = sinon.spy(function(path, callback) { callback(null); });
    cuculus.replace('rimraf', rimraf);

    // now require git
    git = require('../../lib/git');

    cb();
};

exports.tearDown = function(cb) {
    // cleanup
    cuculus.drop('mkdirp');
    cuculus.drop('rimraf');
    cuculus.drop(path.resolve(__dirname, '../../lib/git'));

    cb();
};


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
        test.equals(exec.firstCall.args[0], "git fetch && git fetch --tags");

        test.equals(stat.callCount, 1);
        test.equals(stat.firstCall.args[0], repository.path);

        stat.restore();
        exec.restore();

        test.done();
    });
};

exports['fromDirectory - should test directory with git status'] = function(test) {
    var exec, directory;

    directory = chance.word();

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        callback(null);
    });

    git.fromDirectory(directory, function(err, repository) {
        test.ok(!err);
        test.ok(repository instanceof git.Repository);

        test.equals(repository.path, directory);

        test.equals(exec.callCount, 1);
        test.equals(exec.firstCall.args[0], "git status");

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
        test.ok((new RegExp('git checkout \\-b [a-z0-9]+ ' + remote + '\\/' + branch)).test(exec.firstCall.args[0]));
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
        [ git.Commitish.COMMIT, git.Commitish.TAG, git.Commitish.HEAD ].map(function(type) {
            return function(next) {
                var commitish;

                commitish = type == git.Commitish.COMMIT
                    ? new git.Commitish(hash)
                    : new git.Commitish(hash, type, commit);

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
        test.equals(exec.firstCall.args[0], 'git fetch && git fetch --tags');
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


exports['repository.switchTo - should checkout&pull if on branch'] = function (test) {
    var repository, path, checkout, pull, commitishs;

    path = chance.word();
    repository = new git.Repository(path);
    commitishs = [];

    checkout = sinon.stub(repository, "checkout", function(commitish, callback) {
        callback(null);
    });

    pull = sinon.stub(repository, "pull", function(callback) {
        callback(null);
    });

    async.parallel(
        [ git.Commitish.HEAD, git.Commitish.REMOTE ].map(function(type) {
            return function(next) {
                var commitish, hash, commit;

                hash = require("crypto").randomBytes(20).toString('hex');
                commit = chance.word();

                commitishs.push(commitish = new git.Commitish(hash, type, commit));

                repository.switchTo(commitish, next);
            }
        })
        ,
        function(err) {
            test.ok(!err);

            test.equals(checkout.callCount, 2);
            test.equals(pull.callCount, 2);

            _.times(2, function(i) {
                test.equals(checkout.getCall(i).args[0], commitishs[i]);
                test.ok(checkout.getCall(i).calledBefore(pull.getCall(i)));
            });

            test.done();
        }
    );
};

exports['repository.switchTo - should checkout if on link'] = function (test) {
    var repository, path, checkout, pull, commitishs;

    path = chance.word();
    repository = new git.Repository(path);
    commitishs = [];

    checkout = sinon.stub(repository, "checkout", function(commitish, callback) {
        callback(null);
    });

    pull = sinon.stub(repository, "pull", function(callback) {
        callback(null);
    });

    async.parallel(
        [ git.Commitish.TAG, git.Commitish.COMMIT ].map(function(type) {
            return function(next) {
                var commitish, hash, commit;

                hash = require("crypto").randomBytes(20).toString('hex');
                commit = chance.word();

                commitishs.push(commitish = new git.Commitish(hash, type, commit));

                repository.switchTo(commitish, next);
            }
        })
        ,
        function(err) {
            test.ok(!err);

            test.equals(checkout.callCount, 2);
            test.equals(pull.callCount, 0);

            _.times(2, function(i) {
                test.equals(checkout.getCall(i).args[0], commitishs[i]);
            });

            test.done();
        }
    );
};

exports['repository.resolve - should search in logs and refs given spec'] = function (test) {
    var repository, path, ref, log,
        specHead, specRemote, specCommit, specRandom;

    path = chance.word();
    repository = new git.Repository(path);

    specRandom = new git.Spec(chance.word());
    specHead   = new git.Spec(chance.word());
    specCommit = new git.Spec(chance.word());

    specRemote = new git.Spec(chance.word());
    specRemote.type = git.Commitish.REMOTE;
    specRemote.remote = chance.word();

    ref = sinon.stub(repository, "ref", function(callback) {
        callback(null, [
            new git.Commitish(chance.word(), git.Commitish.HEAD, specHead.value),
            new git.RemoteCommitish(chance.word(), git.Commitish.REMOTE, specRemote.value, specRemote.remote)
        ]);
    });

    log = sinon.stub(repository, "log", function(callback) {
        callback(null, [ new git.Commitish(specCommit.value, git.Commitish.COMMIT, specCommit.value) ]);
    });

    async.parallel(
        [
            async.apply(repository.resolve.bind(repository), specRandom),
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

exports['repository.remotes - should return list of remotes'] = function (test) {
    var repository, path, exec, remotesCount, remotes, tpl;

    path = chance.word();
    repository = new git.Repository(path);

    remotes = _.map(_.range(remotesCount = chance.integer({min: 1, max: 21})), function() {
        return {
            name: chance.word(),
            uri:  chance.url(),
            type: Math.random() > 0.5 ? "fetch" : "push"
        };
    });

    tpl = _.template("<%= name %>\t<%= uri %> (<%= type %>)");
    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        // simulate git remote -v format
        callback(
            null,
            remotes
                .map(function(remote) {
                    return tpl(remote);
                })
                .join("\n")
        );
    });

    repository.remotes(function(err, result) {
        test.ok(!err);
        test.ok(_.isArray(result));

        test.equals(exec.callCount, 1);
        test.equals(exec.firstCall.args[0], 'git remote -v');
        test.same(exec.firstCall.args[1], { cwd: path });

        test.equals(result.length, remotesCount);
        result.forEach(function(entry, index) {
            test.ok(_.isEqual(entry, remotes[index]));
        });

        exec.restore();

        test.done();
    });
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

