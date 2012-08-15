var fork = require('child_process').fork,
    path = require('path');


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
        if (code !== 0) {
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
