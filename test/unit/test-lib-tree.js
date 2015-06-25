var tree = require('../../lib/tree'),
    logger = require("../../lib/logger");

//logger.level = "verbose";

exports['build - should work with async sources'] = function (test) {
    test.expect(1);

    var translation = {
        'git://path.to/repo.git': '1.0.5'
    };

    var foo = {
        config: {
            name: 'root',
            version: '0.0.1',
            jam: {
                dependencies: {
                    'toolkit':  'git://path.to/repo.git',
                    'viewer':   '0.1.0',
                    'injector': '2.0.0'
                }
            }
        },
        source: 'local',
        priority: 0
    };

    var sources = [
        // aka git source
        function (def, callback) {
            if (def.name == "toolkit" && def.range == "git://path.to/repo.git") {
                setTimeout(function() {
                    callback(null, [
                        {
                            config: {
                                name:    def.name,
                                version: def.translation,
                                jam: {
                                    dependencies: {
                                        "injector": "2.0.0"
                                    }
                                }
                            },
                            source: 'git',
                            version: def.translation
                        }
                    ]);
                }, 100);
            } else {
                process.nextTick(function() {
                    callback(null, []);
                })
            }
        },
        // aka other
        function (def, callback) {
            var result;

            switch (def.name) {
                case "viewer": {
                    result = [{
                        config: {
                            name:    def.name,
                            version: def.range,
                            jam: {
                                dependencies: {
                                    toolkit: "~1.0.0"
                                }
                            }
                        },
                        source: 'repository',
                        version: def.range
                    }];

                    break;
                }

                case "toolkit": {
                    result = [{
                        config: {
                            name:    def.name,
                            version: "1.0.0",
                            jam: {
                                dependencies: {
                                    "injector": "1.0.0"
                                }
                            }
                        },
                        source: 'repository',
                        version: "1.0.0"
                    }];

                    break;
                }

                case "injector": {
                    result = [
                        {
                            config: {
                                name:    def.name,
                                version: "1.0.0"
                            },
                            source: 'repository',
                            version: "1.0.0"
                        },
                        {
                            config: {
                                name:    def.name,
                                version: "2.0.0"
                            },
                            source: 'repository',
                            version: "2.0.0"
                        }
                    ];

                    break;
                }
            }

            process.nextTick(function () {
                callback(null, result);
            });
        }
    ];
    var translators = [
        function(def, cb) {
            var result;

            if (result = translation[def.range]) {
                return setTimeout(function() {
                    cb(null, result);
                }, 100);
            }

            cb(null);
        }
    ];

    tree.build(foo, sources, translators, function (err, packages) {
        // console.log('packages', require('json-honey')(packages));
        test.ok(1);
        test.done(err);
    });
};

exports['extend - install new - reduce dep version'] = function (test) {
    var packages = {
        'foo': {
            versions: [
                {
                    config: { name: 'foo', version: '0.0.1', jam: { dependencies: {} } },
                    source: 'local',
                    priority: 0,
                    version: '0.0.1'
                },
                {
                    config: { name: 'foo', version: '0.0.2', jam: { dependencies: {} } },
                    source: 'local',
                    priority: 0,
                    version: '0.0.2'
                },
                {
                    config: { name: 'foo', version: '0.0.3', jam: { dependencies: {} } },
                    source: 'repository',
                    priority: 1,
                    version: '0.0.3'
                }
            ],
            current_version: '0.0.3',
            requirements: []
        }
    };
    var bar = {
        config: {
            name: 'bar',
            version: '0.0.1',
            jam: {
                dependencies: {
                    'foo': '<= 0.0.2'
                }
            }
        },
        source: 'local',
        priority: 0
    };

    var sources = [];
    var translators = [];

    tree.extend([], bar, sources, translators, packages, function (err, packages) {
        test.same(packages, {
            'foo': {
                versions: [
                    {
                        config: { name: 'foo', version: '0.0.1', jam: { dependencies: {} } },
                        source: 'local',
                        priority: 0,
                        version: '0.0.1'
                    },
                    {
                        config: { name: 'foo', version: '0.0.2', jam: { dependencies: {} } },
                        source: 'local',
                        priority: 0,
                        version: '0.0.2'
                    },
                    {
                        config: { name: 'foo', version: '0.0.3', jam: { dependencies: {} } },
                        source: 'repository',
                        priority: 1,
                        version: '0.0.3'
                    }
                ],
                current_version: '0.0.2',
                requirements: [
                    {
                        path: { parents: [ 'bar' ], name: 'foo', enabled: true },
                        range: { range: '<= 0.0.2', source: '<= 0.0.2' },
                        enabled: true
                    }
                ]
            },
            'bar': {
                versions: [
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            jam: { dependencies: { 'foo': '<= 0.0.2' } }
                        },
                        source: 'local',
                        priority: 0,
                        version: '0.0.1'
                    }
                ],
                current_version: '0.0.1',
                requirements: []
            }
        });
        test.done(err);
    });
};


exports['extend - reinstall existing - increase dep version'] = function (test) {
    var packages = {
        'foo': {
            versions: [
                {
                    config: { name: 'foo', version: '0.0.1', jam: { dependencies: {} } },
                    source: 'local',
                    priority: 0,
                    version: '0.0.1'
                },
                {
                    config: { name: 'foo', version: '0.0.2', jam: { dependencies: {} } },
                    source: 'local',
                    priority: 0,
                    version: '0.0.2'
                },
                {
                    config: { name: 'foo', version: '0.0.3', jam: { dependencies: {} } },
                    source: 'repository',
                    priority: 1,
                    version: '0.0.3'
                }
            ],
            current_version: '0.0.2',
            requirements: []
        },
        'bar': {
            versions: [
                {
                    config: {
                        name: 'bar',
                        version: '0.0.1',
                        jam: { dependencies: { 'foo': '<= 0.0.2' } }
                    },
                    source: 'local',
                    priority: 0,
                    version: '0.0.1'
                }
            ],
            current_version: '0.0.1',
            requirements: []
        }
    };
    var bar = {
        config: {
            name: 'bar',
            version: '0.0.2',
            jam: { dependencies: { 'foo': '> 0.0.2' } }
        },
        source: 'local',
        priority: 0
    };

    var sources = [];
    var translators = [];

    tree.extend([], bar, sources, translators, packages, function (err, packages) {
        test.same(packages, {
            'foo': {
                versions: [
                    {
                        config: { name: 'foo', version: '0.0.1', jam: { dependencies: {} } },
                        source: 'local',
                        priority: 0,
                        version: '0.0.1'
                    },
                    {
                        config: { name: 'foo', version: '0.0.2', jam: { dependencies: {} } },
                        source: 'local',
                        priority: 0,
                        version: '0.0.2'
                    },
                    {
                        config: { name: 'foo', version: '0.0.3', jam: { dependencies: {} } },
                        source: 'repository',
                        priority: 1,
                        version: '0.0.3'
                    }
                ],
                current_version: '0.0.3',
                requirements: [
                    {
                        path: { parents: [ 'bar' ], name: 'foo', enabled: true },
                        range: { range: '> 0.0.2', source: '> 0.0.2' },
                        enabled: true
                    }
                ]
            },
            'bar': {
                versions: [
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            jam: { dependencies: { 'foo': '<= 0.0.2' } }
                        },
                        source: 'local',
                        priority: 0,
                        version: '0.0.1'
                    },
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            jam: { dependencies: { 'foo': '> 0.0.2' } }
                        },
                        source: 'local',
                        priority: 0,
                        version: '0.0.2'
                    }
                ],
                current_version: '0.0.2',
                requirements: []
            }
        });
        test.done(err);
    });
};


exports['extend- install new - missing dep version'] = function (test) {
    test.expect(1);
    var packages = {
        'foo': {
            versions: [
                {
                    config: { name: 'foo', version: '0.0.2', jam: { dependencies: {} } },
                    source: 'local',
                    priority: 0,
                    version: '0.0.2'
                },
                {
                    config: { name: 'foo', version: '0.0.3', jam: { dependencies: {} } },
                    source: 'local',
                    priority: 0,
                    version: '0.0.3'
                }
            ],
            current_version: '0.0.3',
            requirements: []
        }
    };
    var bar = {
        config: {
            name: 'bar',
            version: '0.0.1',
            jam: { dependencies: { 'foo': '< 0.0.2' } }
        },
        source: 'local',
        priority: 0
    };
    var sources = [];
    var translators = [];
    tree.extend([], bar, sources, translators, packages, function (err, packages) {
        test.ok(
            /No matching version for 'foo'/.test(err.message),
            "No matching version for 'foo'"
        );
        test.done();
    });
};


exports['extend - install new - missing dep package'] = function (test) {
    test.expect(1);
    var packages = {
        'foo': {
            versions: [
                {
                    config: { name: 'foo', version: '0.0.3', jam: { dependencies: {} } },
                    source: 'local',
                    priority: 0,
                    version: '0.0.3'
                }
            ],
            current_version: '0.0.3',
            requirements: []
        }
    };
    var bar = {
        config: {
            name: 'bar',
            version: '0.0.1',
            jam: {
                dependencies: {
                    'foo': null,
                    'baz': null
                }
            }
        },
        source: 'local',
        priority: 0
    };
    var sources = [];
    var translators = [
        function(def, callback) {
            if (def.range == null || def.range == "") {
                return callback(null, "*");
            }

            callback(null);
        }
    ];
    tree.extend([], bar, sources, translators, packages, function (err, packages) {
        test.ok(
            /No package for 'baz'/.test(err.message),
            "No package for 'baz'"
        );
        test.done();
    });
};


exports['build - fetch from sources'] = function (test) {
    test.expect(2);
    var foo = {
        config: {
            name: 'foo',
            version: '0.0.1',
            jam: {
                dependencies: {
                    'bar': '>= 0.0.2'
                }
            }
        },
        source: 'local',
        priority: 0
    };
    var sources = [
        function (def, callback) {
            test.same(def, { name: 'bar', range: '>= 0.0.2', translation: '>= 0.0.2' });
            process.nextTick(function () {
                callback(null, [
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            jam: { dependencies: {} }
                        },
                        source: 'local',
                        version: '0.0.1'
                    },
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            jam: { dependencies: {} }
                        },
                        source: 'local',
                        version: '0.0.2'
                    }
                ]);
            })
        }
    ];
    var translators = [];
    tree.build(foo, sources, translators, function (err, packages) {
        test.same(packages, {
            'foo': {
                versions: [
                    {
                        config: {
                            name: 'foo',
                            version: '0.0.1',
                            jam: {
                                dependencies: {
                                    'bar': '>= 0.0.2'
                                }
                            }
                        },
                        source: 'local',
                        priority: 0,
                        version: '0.0.1'
                    }
                ],
                requirements: [],
                current_version: '0.0.1'
            },
            'bar': {
                versions: [
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            jam: { dependencies: {} }
                        },
                        source: 'local',
                        priority: 0,
                        version: '0.0.1'
                    },
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            jam: { dependencies: {} }
                        },
                        source: 'local',
                        priority: 0,
                        version: '0.0.2'
                    }
                ],
                requirements: [
                    {
                        path: { parents: [ 'foo' ], name: 'bar', enabled: true },
                        range: { range: '>= 0.0.2', source: '>= 0.0.2' },
                        enabled: true
                    }
                ],
                current_version: '0.0.2'
            }
        });
        test.done(err);
    });
};


exports['build - translate from translators'] = function (test) {
    test.expect(2);

    var translation = {
        'abc': '0.0.2'
    };

    var foo = {
        config: {
            name: 'foo',
            version: '0.0.1',
            jam: {
                dependencies: {
                    'bar': 'abc'
                }
            }
        },
        source: 'local',
        priority: 0
    };

    var sources = [
        function (def, callback) {
            test.same(def, { name: 'bar', range: 'abc', translation: '0.0.2' });
            process.nextTick(function () {
                callback(null, [
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            jam: { dependencies: {} }
                        },
                        source: 'local',
                        version: '0.0.2'
                    }
                ]);
            })
        }
    ];
    var translators = [
        function(def, cb) {
            var result;

            if (result = translation[def.range]) {
                return cb(null, result);
            }

            cb(null);
        }
    ];

    tree.build(foo, sources, translators, function (err, packages) {
        test.same(packages, {
            'foo': {
                versions: [
                    {
                        config: {
                            name: 'foo',
                            version: '0.0.1',
                            jam: {
                                dependencies: {
                                    'bar': 'abc'
                                }
                            }
                        },
                        source: 'local',
                        priority: 0,
                        version: '0.0.1'
                    }
                ],
                requirements: [],
                current_version: '0.0.1'
            },
            'bar': {
                versions: [
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            jam: { dependencies: {} }
                        },
                        source: 'local',
                        priority: 0,
                        version: '0.0.2'
                    }
                ],
                requirements: [
                    {
                        path: { parents: [ 'foo' ], name: 'bar', enabled: true },
                        range: { range: '0.0.2', source: 'abc' },
                        enabled: true
                    }
                ],
                current_version: '0.0.2'
            }
        });
        test.done(err);
    });
};


exports['build - fall in no matching version'] = function (test) {
    test.expect(1);

    var translation = {
        'git://path.to/repo.git': '0.2.0'
    };

    var foo = {
        config: {
            name: 'foo',
            version: '0.0.1',
            jam: {
                dependencies: {
                    'bar': 'git://path.to/repo.git',
                    'baz': '*'
                }
            }
        },
        source: 'local',
        priority: 0
    };

    var sources = [
        function (def, callback) {
            process.nextTick(function () {
                callback(null, (def.name == "bar" && def.range == "git://path.to/repo.git") ? [
                    {
                        config: {
                            name:    def.name,
                            version: def.translation
                        },
                        source: 'git',
                        version: def.translation
                    }
                ] : []);
            })
        },
        function (def, callback) {
            var result;

            switch (def.name) {
                case "bar": {
                    result = {
                        config: {
                            name:    "bar",
                            version: "0.1.5"
                        },
                        source: 'repository',
                        version: "0.1.5"
                    };

                    break;
                }

                case "baz": {
                    result = {
                        config: {
                            name:    "baz",
                            version: "0.1.0",
                            jam: {
                                dependencies: {
                                    "bar": "~0.1.0"
                                }
                            }
                        },
                        source: 'repository',
                        version: "0.1.0"
                    };

                    break;
                }
            }

            process.nextTick(function () {
                callback(null, [result]);
            });
        }
    ];
    var translators = [
        function(def, cb) {
            var result;

            if (result = translation[def.range]) {
                return cb(null, result);
            }

            cb(null);
        }
    ];

    tree.build(foo, sources, translators, function (err, packages) {
        test.ok(
            /No matching version for 'bar'/.test(err.message.split("\n")[0]),
            "No matching version for 'bar'"
        );

        test.done();
    });
};


exports['build - check multiple sources'] = function (test) {
    test.expect(4);
    var source_calls = [];
    var foo = {
        config: {
            name: 'foo',
            version: '0.0.1',
            jam: { dependencies: { 'bar': '>= 0.0.2' } },
        },
        source: 'local',
        priority: 0
    };
    var sources = [
        function (def, callback) {
            test.same(def, { name: 'bar', range: '>= 0.0.2', translation: '>= 0.0.2' });
            source_calls.push('one');
            process.nextTick(function () {
                callback(null, [
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            jam: { dependencies: {} }
                        },
                        source: 'local',
                        version: '0.0.1'
                    }
                ]);
            })
        },
        function (def, callback) {
            test.same(def, { name: 'bar', range: '>= 0.0.2', translation: '>= 0.0.2' });
            source_calls.push('two');
            process.nextTick(function () {
                callback(null, [
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            jam: { dependencies: {} }
                        },
                        source: 'repository',
                        version: '0.0.1'
                    },
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            jam: { dependencies: {} }
                        },
                        source: 'repository',
                        version: '0.0.2'
                    }
                ]);
            })
        }
    ];
    var translators = [];
    tree.build(foo, sources, translators, function (err, packages) {
        test.same(source_calls, ['one', 'two']);
        test.same(packages, {
            'foo': {
                versions: [
                    {
                        config: {
                            name: 'foo',
                            version: '0.0.1',
                            jam: { dependencies: { 'bar': '>= 0.0.2' } }
                        },
                        source: 'local',
                        priority: 0,
                        version: '0.0.1'
                    }
                ],
                requirements: [],
                current_version: '0.0.1'
            },
            'bar': {
                versions: [
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            jam: { dependencies: {} }
                        },
                        source: 'local',
                        priority: 0,
                        version: '0.0.1'
                    },
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            jam: { dependencies: {} }
                        },
                        source: 'repository',
                        priority: 1,
                        version: '0.0.1'
                    },
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            jam: { dependencies: {} }
                        },
                        source: 'repository',
                        priority: 1,
                        version: '0.0.2'
                    }
                ],
                requirements:  [
                    {
                        path: { parents: [ 'foo' ], name: 'bar', enabled: true },
                        range: { range: '>= 0.0.2', source: '>= 0.0.2' },
                        enabled: true
                    }
                ],
                current_version: '0.0.2'
            }
        });
        test.done(err);
    });
};

exports['build - check only as many sources as needed'] = function (test) {
    test.expect(4);
    var source_calls = [];
    var foo = {
        config: {
            name: 'foo',
            version: '0.0.1',
            jam: { dependencies: { 'bar': '>= 0.0.3' } }
        },
        source: 'local',
        priority: 0
    };
    var sources = [
        function (def, callback) {
            test.same(def, { name: 'bar', range: '>= 0.0.3', translation: '>= 0.0.3' });
            source_calls.push('one');
            process.nextTick(function () {
                callback(null, [
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            jam: { dependencies: {} }
                        },
                        source: 'local',
                        version: '0.0.1'
                    },
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            jam: { dependencies: {} }
                        },
                        source: 'local',
                        version: '0.0.2'
                    }
                ]);
            });
        },
        function (def, callback) {
            test.same(def, { name: 'bar', range: '>= 0.0.3', translation: '>= 0.0.3' });
            source_calls.push('two');
            process.nextTick(function () {
                callback(null, [
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            jam: { dependencies: {} }
                        },
                        source: 'repository',
                        version: '0.0.2'
                    },
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.3',
                            jam: { dependencies: {} }
                        },
                        source: 'repository',
                        version: '0.0.3'
                    }
                ]);
            });
        },
        function (def, callback) {
            test.same(def, { name: 'bar', range: '>= 0.0.3', translation: '>= 0.0.3' });
            source_calls.push('two');
            process.nextTick(function () {
                callback(null, [
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.3',
                            jam: { dependencies: {} }
                        },
                        source: 'space',
                        version: '0.0.3'
                    },
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.4',
                            jam: { dependencies: {} }
                        },
                        source: 'space',
                        version: '0.0.4'
                    }
                ]);
            });
        }
    ];
    var translators = [];
    tree.build(foo, sources, translators, function (err, packages) {
        test.same(source_calls, ['one', 'two']);
        test.same(packages, {
            'foo': {
                versions: [
                    {
                        config: {
                            name: 'foo',
                            version: '0.0.1',
                            jam: { dependencies: { 'bar': '>= 0.0.3' } }
                        },
                        source: 'local',
                        priority: 0,
                        version: '0.0.1'
                    }
                ],
                requirements: [],
                current_version: '0.0.1'
            },
            'bar': {
                versions: [
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            jam: { dependencies: {} }
                        },
                        source: 'local',
                        priority: 0,
                        version: '0.0.1'
                    },
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            jam: { dependencies: {} }
                        },
                        source: 'local',
                        priority: 0,
                        version: '0.0.2'
                    },
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            jam: { dependencies: {} }
                        },
                        source: 'repository',
                        priority: 1,
                        version: '0.0.2'
                    },
                    {
                        config: {
                            name: 'bar',
                            version: '0.0.3',
                            jam: { dependencies: {} }
                        },
                        source: 'repository',
                        priority: 1,
                        version: '0.0.3'
                    }
                ],
                requirements: [
                    {
                        path: { parents: [ 'foo' ], name: 'bar', enabled: true },
                        range: { range: '>= 0.0.3', source: '>= 0.0.3' },
                        enabled: true
                    }
                ],
                current_version: '0.0.3'
            }
        });
        test.done(err);
    });
};
