var install = require('../../lib/commands/install'),
    logger = require("../../lib/logger");

//logger.clean_exit = true;

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

exports['extractValidVersion - multiple repo'] = function (test) {
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
                "repository": "a",
                "version":  "1.0.5",
                "config": {
                    "name":    "toolkit",
                    "version": "1.0.5",
                    "jam": {}
                }
            },
            {
                "priority": 0,
                "source":   "repository",
                "repository": "b",
                "version":  "1.0.5",
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
