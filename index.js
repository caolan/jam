/**
 * Public API to Jam features
 */


// silence logger module
var logger = require('./lib/logger');
logger.level = 'none'
logger.clean_exit = true;

exports.compile = require('./lib/commands/compile').compile;
