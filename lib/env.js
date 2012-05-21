var isWindows = exports.isWindows = process.platform === 'win32';
exports.temp = process.env.TMPDIR || process.env.TMP || process.env.TEMP || ( isWindows ? "c:\\windows\\temp" : "/tmp" );
exports.home = ( isWindows ? process.env.USERPROFILE : process.env.HOME );
if (exports.home) {
    process.env.HOME = exports.home;
} else {
    exports.home = exports.temp;
}

if ( isWindows ) {
    exports.osSep = '\\';
    exports.nullDevice = 'NUL';

    // Regex to split a windows path into three parts: [*, device, slash, tail] windows-only
    var splitDeviceRe = /^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/][^\\\/]+)?([\\\/])?([\s\S]*?)$/;

    /**
     * Returns true if the path given is absolute.
     * @param {String} p1
     * @return {Boolean}
     * @api public
     */
    exports.isAbsolute = function(p) {
        var result = splitDeviceRe.exec(p),
            device = result[1] || '',
            isUnc = device && device.charAt(1) !== ':';
        return !!result[2] || isUnc; // UNC paths are always absolute
    };

} else {
    exports.osSep = '/';
    exports.nullDevice = '/dev/null';

    /**
     * Returns true if the path given is absolute.
     * @param {String} p1
     * @return {Boolean}
     * @api public
     */
    exports.isAbsolute = function(p) {
        return p[0] === '/';
    };
}
