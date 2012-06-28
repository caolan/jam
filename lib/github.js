var url = require('url'),
    request = require('request'),
    logger = require('./logger'),
    _ = require('underscore');


var uc = encodeURIComponent;


exports.GITHUB_URL = 'https://api.github.com';
exports.GITHUB_RAW_URL = 'https://raw.github.com';


exports.getRaw = function (user, repo, ref, path, callback) {
    var req = {
        json: true,
        url: url.resolve(
            exports.GITHUB_RAW_URL,
            _([user, repo, ref, path]).compact().map(uc).join('/')
        )
    };
    request.get(req, function (err, res, data) {
        if (data.error) {
            return callback(data.error);
        }
        callback(err, data);
    });
};


exports.repos = {};

exports.repos.getArchiveLink = function (user, repo, format, ref, callback) {
    var req = {
        json: true,
        followRedirect: false,
        headers: {
            'Accept': 'application/vnd.github.beta+json'
        },
        url: url.resolve(
            exports.GITHUB_URL,
            _.map(['repos', user, repo, format, ref], uc).join('/')
        )
    };
    logger.debug('getting github archive link', req.url);
    request.get(req, function (err, res, data) {
        if (err) {
            return callback(err);
        }
        if (data && data.error) {
            return callback(res.error);
        }
        if (res.statusCode === 404) {
            return callback('GitHub repository or tag not found');
        }
        if (!res.headers || !res.headers.location) {
            return callback('Failed to get archive link');
        }
        callback(null, res.headers.location);
    });
};

exports.repos.search = function (q, callback) {
    var req = {
        json: true,
        headers: {
            'Accept': 'application/vnd.github.beta+json'
        },
        url: url.resolve(
            exports.GITHUB_URL,
            ['legacy', 'repos', 'search', uc(q)].join('/')
        )
    };
    logger.debug('searching github repositories', req.url);
    request.get(req, function (err, res, data) {
        if (err) {
            return callback(err);
        }
        if (data && data.error) {
            return callback(res.error);
        }
        callback(null, data);
    });
};
