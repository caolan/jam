var fork = require('child_process').fork,
    rimraf = require('rimraf'),
    path = require('path'),
    _ = require('underscore');


exports.runJam = function (args, /*optional*/opts, callback) {
    if (!callback) {
        callback = opts;
        opts = {};
    }
    opts.silent = true;

    var bin = path.resolve(__dirname, '..', 'bin', 'jam.js');
    var jam = fork(bin, args, opts);
    var stdout = '', stderr = '';

    jam.stdout.on('data', function (data) {
        stdout += data.toString();
    });
    jam.stderr.on('data', function (data) {
        stderr += data.toString();
    });
    jam.on('exit', function (code) {
        if (code !== 0 && !opts.expect_error) {
            console.log(['Jam command failed', args]);
            console.log(stdout);
            console.log(stderr);
            return callback(
                new Error('Returned status code: ' + code),
                stdout,
                stderr
            );
        }
        callback(null, stdout, stderr);
    });
    jam.disconnect();
};


// Invalidates cached module and re-requires it. Used to load require.config.js.
exports.freshRequire = function (p) {
    var cached = Object.keys(require.cache);
    var resolved = require.resolve(p);
    if (_.indexOf(cached, resolved) !== -1) {
        delete require.cache[resolved];
    }
    return require(p);
};

exports.myrimraf = function (p, callback, tries) {
    tries = tries || 50;
    rimraf(p, function (err) {
        if (err && err.code === 'EMBUSY') {
            if (tries) {
                setTimeout(function () {
                    exports.myrimraf(p, callback, tries - 1);
                }, 100);
                return;
            }
        }
        return callback.apply(this, arguments);
    });
};
