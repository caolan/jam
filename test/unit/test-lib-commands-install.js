var install = require('../../lib/commands/install');
var logger = require("../../lib/logger");
var sinon = require("sinon");
var cuculus = require("cuculus");
var path = require("path");

//logger.clean_exit = true;


exports.setUp = function(cb) {
    cuculus.modify(path.resolve(__dirname, '../../lib/jamrc'), function(jamrc, onRestore){
        var stub;

        stub = sinon.stub(jamrc, "load", function(cb) {
            cb(null, {
                repositories: [
                    "http://jamjs.org/A",
                    "http://jamjs.org/B",
                    "http://jamjs.org/C"
                ]
            });
        });

        onRestore(stub.restore.bind(stub));
    });

    cb();
};

exports.tearDown = function(cb) {
    // cleanup
    cuculus.restore(path.resolve(__dirname, '../../lib/jamrc'));
    cb();
};

exports['extractValidVersion - multiple git'] = function (test) {
    var pkg;

    // before
    pkg = {
        "current_version": "1.0.5",
        "requirements": [
            {
                "enabled": true,
                "path": {
                    "enabled": true,
                    "name":    "toolkit",
                    "parents": [
                        "root"
                    ]
                },
                "range": {
                    "range":  "1.0.5",
                    "source": "git://path.to/repo.git#2222"
                }
            },
            {
                "enabled": true,
                "path": {
                    "enabled": true,
                    "name":    "toolkit",
                    "parents": [
                        "root",
                        "viewer"
                    ]
                },
                "range": {
                    "range":  "1.0.5",
                    "source": "git://path.to/repo.git#2222"
                }
            }
        ],
        "versions": [
            {
                "priority": 0,
                "source":   "git",
                "version":  "1.0.5",
                git: {
                    path:      "git://path.to/repo.git",
                    commitish: "2222",
                    uri:       "git://path.to/repo.git#2222"
                },
                "config": {
                    "name":    "toolkit",
                    "version": "1.0.5",
                    "jam": {}
                }
            },
            {
                "priority": 0,
                "source":   "git",
                "version":  "1.0.5",
                git: {
                    path:      "git://path.to/repo.git",
                    commitish: "2222",
                    uri:       "git://path.to/repo.git#2222"
                },
                "config": {
                    "name":    "toolkit",
                    "version": "1.0.5",
                    "jam": {}
                }
            }
        ]
    };

    install.extractValidVersion(pkg, "test", function(err) {
        if (err) {
            logger.error(err);
        }
        test.done(err);
    });
};

exports['extractValidVersion - should get less prioritized, if it is repository source'] = function (test) {
    var pkg;

    // before
    pkg = {
        "current_version": "1.0.5",
        "requirements": [
            {
                "enabled": true,
                "path": {
                    "enabled": true,
                    "name":    "toolkit",
                    "parents": [
                        "root"
                    ]
                },
                "range": {
                    "range":  "1.0.5",
                    "source": "1.0.5"
                }
            }
        ],
        "versions": [
            {
                "priority": 0,
                "source":   "repository",
                "version":  "1.0.5",
                "repository": "http://jamjs.org/B",
                "config": {
                    "name":    "toolkit",
                    "version": "1.0.5",
                    "jam": {}
                }
            },
            {
                "priority": 0,
                "source":   "repository",
                "version":  "1.0.5",
                "repository": "http://jamjs.org/A",
                "config": {
                    "name":    "toolkit",
                    "version": "1.0.5",
                    "jam": {}
                }
            },
            {
                "priority": 0,
                "source":   "repository",
                "version":  "1.0.5",
                "repository": "http://jamjs.org/C",
                "config": {
                    "name":    "toolkit",
                    "version": "1.0.5",
                    "jam": {}
                }
            }
        ]
    };

    install.extractValidVersion(pkg, "test", function(err, version) {
        if (err) {
            logger.error(err);
        }
        if (version.repository != "http://jamjs.org/A") {
            logger.error(err = new Error("Not prioritized repo!"))
        }
        test.done(err);
    });
};

exports['extractValidVersion - should throw'] = function (test) {
    var pkg;

    // before
    pkg = {
        "current_version": "1.0.5",
        "requirements": [
            {
                "enabled": true,
                "path": {
                    "enabled": true,
                    "name":    "toolkit",
                    "parents": [
                        "root"
                    ]
                },
                "range": {
                    "range":  "1.0.5",
                    "source": "1.0.5"
                }
            }
        ],
        "versions": [
            {
                "priority": 0,
                "source":   "repository",
                "version":  "1.0.5",
                "repository": "http://testrepo.org",
                "config": {
                    "name":    "toolkit",
                    "version": "1.0.5",
                    "jam": {}
                }
            },
            {
                "priority": 0,
                "source":   "git",
                "version":  "1.0.5",
                git: {
                    path:      "git://path.to/repo.git",
                    commitish: "2222",
                    uri:       "git://path.to/repo.git#2222"
                },
                "config": {
                    "name":    "toolkit",
                    "version": "1.0.5",
                    "jam": {}
                }
            }
        ]
    };

    install.extractValidVersion(pkg, "test", function(err) {
        var msg;

        msg = 'Multiple sources are found for the package "test@1.0.5":\n' +
            '\thttp://testrepo.org\n' +
            '\tgit://path.to/repo.git#2222\n';

        test.ok(err == msg, "Should throw an Error");
        test.done();
    });
};
