var logger = require('./logger'),
    EventEmitter = require('events').EventEmitter,
    inherits = require('util').inherits,
    tar = require('tar'),
    ignore = require('fstream-ignore'),
    zlib = require('zlib'),
    fs = require('fs');


/**
 * Pack class, starts creating a new .tar.gz archive from the specified
 * directory. Emits 'error' event on errors, 'add' event when adding a file,
 * and 'end' event once finished writing to the target file.
 */

inherits(Pack, EventEmitter);

function Pack(source, target) {
    EventEmitter.apply(this);

    var that = this;

    var fwriter = fs.createWriteStream(target);
    fwriter.on('error', function (err) {
        that.emit('error', new Error(
            'error writing ' + target + '\n' +
            (err.message || err.stack || err.toString())
        ));
    });
    fwriter.on('close', function () {
        that.emit('end', target);
    });

    var istream = ignore({
        path: source,
        ignoreFiles: [".jamignore", ".gitignore"]
    });
    istream.on('error', function (err) {
        that.emit('error', new Error(
            'error reading ' + source + '\n' +
            (err.message || err.stack || err.toString())
        ));
    });
    istream.on("child", function (c) {
        that.emit('add', c.path.substr(c.root.path.length + 1));
    });

    var packer = tar.Pack();
    packer.on('error', function (err) {
        that.emit('error', new Error(
            'tar creation error ' + target + '\n' +
            (err.message || err.stack || err.toString())
        ));
    });

    var zipper = zlib.Gzip();
    zipper.on('error', function (err) {
        that.emit('error', new Error(
            'gzip error ' + target + '\n' +
            (err.message || err.stack || err.toString())
        ));
    });

    istream.pipe(packer).pipe(zipper).pipe(fwriter);
};
exports.Pack = Pack;


/**
 * Unpack class, starts extracting the provided archive to the target path,
 * emits 'error' event on errors, 'extract' event on each file being extracted,
 * and 'end' event when finished extracting the archive.
 */

inherits(Unpack, EventEmitter);

function Unpack(source, target) {
    EventEmitter.apply(this);

    var that = this;

    var freader = fs.createReadStream(source);
    freader.on('error', function (err) {
        that.emit('error', new Error(
            'error reading ' + source + '\n' +
            (err.message || err.stack || err.toString())
        ));
    });

    var extractor = tar.Extract({
        type: 'Directory',
        path: target,
        // TODO: strip 'package' directory from path using below line once added
        //strip: 1,
        filter: function () {
            // symbolic links are not allowed in packages
            if (this.type.match(/^.*Link$/)) {
                logger.warning(
                    'excluding symbolic link',
                    this.path.substr(target.length + 1) + ' -> ' + this.linkpath
                );
                return false;
            }
            return true;
        }
    });
    extractor.on('error', function (err) {
        that.emit('error', new Error(
            'untar error' + source + '\n' +
            (err.message || err.stack || err.toString())
        ));
    });
    extractor.on('entry', function (entry) {
        that.emit('extract', entry.path);
    });
    extractor.on('end', function () {
        that.emit('end', target);
    });

    var unzipper = zlib.Unzip();
    unzipper.on('error', function (err) {
        that.emit('error', new Error(
            'unzip error ' + source + '\n' +
            (err.message || err.stack || err.toString())
        ));
    });

    freader.pipe(unzipper).pipe(extractor);
};
exports.Unpack = Unpack;
