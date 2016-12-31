var tree = require('../../lib/tree');


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
            ranges: {}
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

    tree.extend(bar, sources, packages, function (err, packages) {
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
                ranges: {'bar': '<= 0.0.2'}
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
                ranges: {}
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
            ranges: {bar: '<= 0.0.2'}
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
            ranges: {}
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

    tree.extend(bar, sources, packages, function (err, packages) {
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
                ranges: {bar: '> 0.0.2'}
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
                ranges: {}
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
            ranges: {}
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
    tree.extend(bar, sources, packages, function (err, packages) {
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
            ranges: {}
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
    tree.extend(bar, sources, packages, function (err, packages) {
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
            test.same(def, { name: 'bar', range: '>= 0.0.2' });
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
    tree.build(foo, sources, function (err, packages) {
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
                ranges: {},
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
                ranges: {'foo': '>= 0.0.2'},
                current_version: '0.0.2'
            }
        });
        test.done(err);
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
            test.same(def, { name: 'bar', range: '>= 0.0.2' });
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
            test.same(def, { name: 'bar', range: '>= 0.0.2' });
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
    tree.build(foo, sources, function (err, packages) {
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
                ranges: {},
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
                ranges: {'foo': '>= 0.0.2'},
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
            test.same(def, { name: 'bar', range: '>= 0.0.3' });
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
            test.same(def, { name: 'bar', range: '>= 0.0.3' });
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
            test.same(def, { name: 'bar', range: '>= 0.0.3' });
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
    tree.build(foo, sources, function (err, packages) {
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
                ranges: {},
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
                ranges: {'foo': '>= 0.0.3'},
                current_version: '0.0.3'
            }
        });
        test.done(err);
    });
};
