var tree = require('../../lib/tree');


exports['extend - install new - reduce dep version'] = function (test) {
    var packages = {
        'foo': {
            versions: {
                '0.0.1': {
                    config: { name: 'foo', version: '0.0.1', dependencies: {} },
                    source: 'local'
                },
                '0.0.2': {
                    config: { name: 'foo', version: '0.0.2', dependencies: {} },
                    source: 'local'
                },
                '0.0.3': {
                    config: { name: 'foo', version: '0.0.3', dependencies: {} },
                    source: 'repository'
                }
            },
            current_version: '0.0.3',
            ranges: {},
            sources: []
        }
    };
    var bar = {
        config: {
            name: 'bar',
            version: '0.0.1',
            dependencies: {
                'foo': '<= 0.0.2'
            }
        },
        source: 'local'
    }
    var sources = [];
    tree.extend(bar, sources, packages, function (err, packages) {
        test.same(packages, {
            'foo': {
                versions: {
                    '0.0.1': {
                        config: { name: 'foo', version: '0.0.1', dependencies: {} },
                        source: 'local'
                    },
                    '0.0.2': {
                        config: { name: 'foo', version: '0.0.2', dependencies: {} },
                        source: 'local'
                    },
                    '0.0.3': {
                        config: { name: 'foo', version: '0.0.3', dependencies: {} },
                        source: 'repository'
                    }
                },
                current_version: '0.0.2',
                ranges: {'bar': '<= 0.0.2'},
                sources: []
            },
            'bar': {
                versions: {
                    '0.0.1': {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            dependencies: { 'foo': '<= 0.0.2' }
                        },
                        source: 'local'
                    }
                },
                current_version: '0.0.1',
                ranges: {},
                sources: []
            }
        });
        test.done(err);
    });
};


exports['extend - reinstall existing - increase dep version'] = function (test) {
    var packages = {
        'foo': {
            versions: {
                '0.0.1': {
                    config: { name: 'foo', version: '0.0.1', dependencies: {} },
                    source: 'local'
                },
                '0.0.2': {
                    config: { name: 'foo', version: '0.0.2', dependencies: {} },
                    source: 'local'
                },
                '0.0.3': {
                    config: { name: 'foo', version: '0.0.3', dependencies: {} },
                    source: 'repository'
                }
            },
            current_version: '0.0.2',
            ranges: {bar: '<= 0.0.2'},
            sources: []
        },
        'bar': {
            versions: {
                '0.0.1': {
                    config: {
                        name: 'bar',
                        version: '0.0.1',
                        dependencies: { 'foo': '<= 0.0.2' }
                    },
                    source: 'local'
                }
            },
            current_version: '0.0.1',
            ranges: {},
            sources: []
        }
    };
    var bar = {
        config: {
            name: 'bar',
            version: '0.0.2',
            dependencies: {
                'foo': '> 0.0.2'
            }
        },
        source: 'local'
    }
    var sources = [];
    tree.extend(bar, sources, packages, function (err, packages) {
        test.same(packages, {
            'foo': {
                versions: {
                    '0.0.1': {
                        config: { name: 'foo', version: '0.0.1', dependencies: {} },
                        source: 'local'
                    },
                    '0.0.2': {
                        config: { name: 'foo', version: '0.0.2', dependencies: {} },
                        source: 'local'
                    },
                    '0.0.3': {
                        config: { name: 'foo', version: '0.0.3', dependencies: {} },
                        source: 'repository'
                    }
                },
                current_version: '0.0.3',
                ranges: {bar: '> 0.0.2'},
                sources: []
            },
            'bar': {
                versions: {
                    '0.0.1': {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            dependencies: { 'foo': '<= 0.0.2' }
                        },
                        source: 'local'
                    },
                    '0.0.2': {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            dependencies: { 'foo': '> 0.0.2' }
                        },
                        source: 'local'
                    }
                },
                current_version: '0.0.2',
                ranges: {},
                sources: []
            }
        });
        test.done(err);
    });
};


exports['extend- install new - missing dep version'] = function (test) {
    test.expect(1);
    var packages = {
        'foo': {
            versions: {
                '0.0.2': {
                    config: { name: 'foo', version: '0.0.2', dependencies: {} },
                    source: 'local'
                },
                '0.0.3': {
                    config: { name: 'foo', version: '0.0.3', dependencies: {} },
                    source: 'local'
                }
            },
            current_version: '0.0.3',
            ranges: {},
            sources: []
        }
    };
    var bar = {
        config: {
            name: 'bar',
            version: '0.0.1',
            dependencies: {
                'foo': '< 0.0.2'
            }
        },
        source: 'local'
    }
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
            versions: {
                '0.0.3': {
                    config: { name: 'foo', version: '0.0.3', dependencies: {} },
                    source: 'local'
                }
            },
            current_version: '0.0.3',
            ranges: {},
            sources: []
        }
    };
    var bar = {
        config: {
            name: 'bar',
            version: '0.0.1',
            dependencies: {
                'foo': null,
                'baz': null
            }
        },
        source: 'local'
    }
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
            dependencies: {
                'bar': '>= 0.0.2'
            }
        },
        source: 'local'
    };
    var sources = [
        function (name, callback) {
            test.equal(name, 'bar');
            process.nextTick(function () {
                callback(null, {
                    '0.0.1': {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            dependencies: {}
                        },
                        source: 'local'
                    },
                    '0.0.2': {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            dependencies: {}
                        },
                        source: 'local'
                    }
                });
            })
        }
    ];
    tree.build(foo, sources, function (err, packages) {
        delete packages['bar'].ev;
        test.same(packages, {
            'foo': {
                versions: {
                    '0.0.1': {
                        config: {
                            name: 'foo',
                            version: '0.0.1',
                            dependencies: {
                                'bar': '>= 0.0.2'
                            }
                        },
                        source: 'local'
                    }
                },
                ranges: {},
                sources: [],
                current_version: '0.0.1'
            },
            'bar': {
                versions: {
                    '0.0.1': {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            dependencies: {}
                        },
                        source: 'local'
                    },
                    '0.0.2': {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            dependencies: {}
                        },
                        source: 'local'
                    }
                },
                update_in_progress: false,
                ranges: {'foo': '>= 0.0.2'},
                sources: [],
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
            dependencies: {
                'bar': '>= 0.0.2'
            }
        },
        source: 'local'
    };
    var sources = [
        function (name, callback) {
            test.equal(name, 'bar');
            source_calls.push('one');
            process.nextTick(function () {
                callback(null, {
                    '0.0.1': {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            dependencies: {}
                        },
                        source: 'local'
                    }
                });
            })
        },
        function (name, callback) {
            test.equal(name, 'bar');
            source_calls.push('two');
            process.nextTick(function () {
                callback(null, {
                    '0.0.1': {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            dependencies: {}
                        },
                        source: 'repository'
                    },
                    '0.0.2': {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            dependencies: {}
                        },
                        source: 'repository'
                    }
                });
            })
        }
    ];
    tree.build(foo, sources, function (err, packages) {
        test.same(source_calls, ['one', 'two']);
        delete packages['bar'].ev;
        test.same(packages, {
            'foo': {
                versions: {
                    '0.0.1': {
                        config: {
                            name: 'foo',
                            version: '0.0.1',
                            dependencies: {
                                'bar': '>= 0.0.2'
                            }
                        },
                        source: 'local'
                    }
                },
                ranges: {},
                sources: [],
                current_version: '0.0.1'
            },
            'bar': {
                versions: {
                    '0.0.1': {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            dependencies: {}
                        },
                        source: 'local'
                    },
                    '0.0.2': {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            dependencies: {}
                        },
                        source: 'repository'
                    }
                },
                ranges: {'foo': '>= 0.0.2'},
                sources: [],
                update_in_progress: false,
                current_version: '0.0.2'
            }
        });
        test.done(err);
    });
};

exports['build - check only as many sources as needed'] = function (test) {
    test.expect(3);
    var source_calls = [];
    var foo = {
        config: {
            name: 'foo',
            version: '0.0.1',
            dependencies: {
                'bar': '>= 0.0.2'
            }
        },
        source: 'local'
    };
    var sources = [
        function (name, callback) {
            test.equal(name, 'bar');
            source_calls.push('one');
            process.nextTick(function () {
                callback(null, {
                    '0.0.1': {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            dependencies: {}
                        },
                        source: 'local'
                    },
                    '0.0.2': {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            dependencies: {}
                        },
                        source: 'local'
                    }
                });
            })
        },
        function (name, callback) {
            test.equal(name, 'bar');
            source_calls.push('two');
            process.nextTick(function () {
                callback(null, {
                    '0.0.2': {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            dependencies: {}
                        },
                        souce: 'repository'
                    },
                    '0.0.3': {
                        config: {
                            name: 'bar',
                            version: '0.0.3',
                            dependencies: {}
                        },
                        source: 'repository'
                    }
                });
            })
        }
    ];
    tree.build(foo, sources, function (err, packages) {
        test.same(source_calls, ['one']);
        delete packages['bar'].ev;
        test.same(packages, {
            'foo': {
                versions: {
                    '0.0.1': {
                        config: {
                            name: 'foo',
                            version: '0.0.1',
                            dependencies: {
                                'bar': '>= 0.0.2'
                            }
                        },
                        source: 'local'
                    }
                },
                ranges: {},
                sources: [],
                current_version: '0.0.1'
            },
            'bar': {
                versions: {
                    '0.0.1': {
                        config: {
                            name: 'bar',
                            version: '0.0.1',
                            dependencies: {}
                        },
                        source: 'local'
                    },
                    '0.0.2': {
                        config: {
                            name: 'bar',
                            version: '0.0.2',
                            dependencies: {}
                        },
                        source: 'local'
                    }
                },
                ranges: {'foo': '>= 0.0.2'},
                sources: [sources[1]],
                update_in_progress: false,
                current_version: '0.0.2'
            }
        });
        test.done(err);
    });
};
