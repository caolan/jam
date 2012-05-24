module.exports = {
    help: require('./help'),
    install: require('./install'),
    update: require('./update'),
    clean: require('./clean'),
    publish: require('./publish'),
    unpublish: require('./unpublish'),
    pack: require('./pack'),
    unpack: require('./unpack'),
    'clear-cache': require('./clear-cache'),
    optimize: require('./optimize')
    // ls
    // lock ? - without version arg, locks current version, with version arg triggers install name@version (updating other packages appropiately)
    // remove
};
