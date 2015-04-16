var sinon = require('sinon'),
    cp = require('child_process'),
    fs = require('fs'),
    path = require('path'),
    ncp = require('ncp'),
    async = require('async'),
    chance = require('chance')(),
    _ = require('underscore'),
    logger = require('../../lib/logger'),
    mkdirp, rimraf, mkdirpCache, rimrafCache;


// stub mkdirp before it will be loaded by dm
require("mkdirp");
mkdirpCache = path.resolve("../node_modules/mkdirp/index.js");
rimrafCache = path.resolve("../node_modules/rimraf/rimraf.js");

mkdirp = require.cache[mkdirpCache].exports = sinon.spy(function(path, callback) {
    callback(null);
});

rimraf = require.cache[rimrafCache].exports = sinon.spy(function(path, callback) {
    console.log("RIMRAF CALL");
    callback(null);
});

var git = require('../../lib/git');

logger.clean_exit = true;


exports['get - should call git clone, if there no cache'] = function (test) {
    var uri, exec, stat;

    uri = chance.word();

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


exports['get - should not call git clone, if there cache'] = function (test) {
    var uri, exec, stat;

    uri = chance.word();

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        callback("This must not be called");
    });

    stat = sinon.stub(fs, "stat", function(path, callback) {
        // simulate that directory exists
        callback(null, { isDirectory: function() { return true } });
    });

    git.get(uri, function(err, repository) {
        test.ok(!err);
        test.ok(repository instanceof git.Repository);
        test.equals(exec.callCount, 0);

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
        return require("crypto").randomBytes(20).toString('hex');
    });

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        // simulate git log format
        callback(null, gitLog.join("\n") + "\n");
    });

    repository.log(function(err, log) {
        test.ok(!err);
        test.ok(_.isArray(log));

        test.equals(exec.callCount, 1);
        test.equals(exec.firstCall.args[0], 'git log --format="%H"');
        test.same(exec.firstCall.args[1], { cwd: path });

        test.equals(log.length, gitLogCount);
        log.forEach(function(entry, index) {
            test.equals(entry, gitLog[index]);
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
        var line, value, remote;

        line = [ require("crypto").randomBytes(20).toString('hex') ];
        value = chance.word();

        switch (index % 3) {
            case 0: {
                line.push("refs/heads/" + value);
                values.push({ type: "heads", value: value });
                break;
            }

            case 1: {
                line.push("refs/tags/" + value);
                values.push({ type: "tags", value: value });
                break;
            }

            case 2: {
                remote = chance.word();
                line.push("refs/remotes/" + remote + "/" + value);
                values.push({ type: "remotes", remote: remote, value: value });
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
        test.same(exec.firstCall.args[1], { cwd: path });

        test.equals(refs.length, gitRefsCount);

        refs.forEach(function(entry, index) {
            test.same(entry, values[index]);
        });

        exec.restore();

        test.done();
    });
};


exports['repository.checkout - should call git checkout'] = function (test) {
    var repository, path, commit, exec;

    path = chance.word();
    repository = new git.Repository(path);

    commit = chance.word();

    exec = sinon.stub(cp, "exec", function(command, options, callback) {
        callback(null);
    });

    repository.checkout(commit, function(err, refs) {
        test.ok(!err);

        test.equals(exec.callCount, 1);
        test.equals(exec.firstCall.args[0], 'git checkout ' + commit);
        test.same(exec.firstCall.args[1], { cwd: path });

        exec.restore();

        test.done();
    });
};


exports['repository.includes - should search in logs and refs given value'] = function (test) {
    var repository, path, ref, log,
        refValue, logValue;

    path = chance.word();
    repository = new git.Repository(path);

    refValue = chance.word();
    logValue = chance.word();

    ref = sinon.stub(repository, "ref", function(callback) {
        callback(null, [ { value: refValue } ]);
    });

    log = sinon.stub(repository, "log", function(callback) {
        callback(null, [ logValue ]);
    });

    async.parallel(
        [
            async.apply(repository.includes.bind(repository), chance.word()),
            async.apply(repository.includes.bind(repository), refValue),
            async.apply(repository.includes.bind(repository), logValue)
        ],
        function(err, result) {
            test.ok(!err);

            test.equals(ref.callCount, 3);
            test.equals(log.callCount, 3);

            test.equals(result[0], false);
            test.equals(result[1], true);
            test.equals(result[2], true);

            test.done();
        }
    );
};


exports['repository.snapshot - should copy version in temp folder'] = function (test) {
    var repository, path, checkout, cp, commit;

    path = chance.word();
    repository = new git.Repository(path);

    commit = chance.word();

    checkout = sinon.stub(repository, "checkout", function(commitish, callback) {
        callback(null);
    });

    cp = sinon.stub(ncp, "ncp", function(from, to, options, callback) {
        callback(null);
    });

    repository.snapshot(commit, function(err, filepath) {
        var makePath;

        test.ok(!err);

        test.equals(checkout.callCount, 1);
        test.equals(checkout.firstCall.args[0], commit);

        test.equals(mkdirp.callCount, 1);
        test.ok(_.isString(mkdirp.firstCall.args[0]));

        makePath = mkdirp.firstCall.args[0];

        test.equals(cp.callCount, 1);
        test.equals(cp.firstCall.args[0], path);
        test.equals(cp.firstCall.args[1], makePath);

        test.ok(_.contains(git.temp, makePath));

        test.done();
    });
};


exports['cleanup - should rimraf all temp folders'] = function (test) {
    git.temp = _.range(chance.integer({min: 1, max: 7}), function() {
        return git.TMP_DIR + "/" + chance.word();
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