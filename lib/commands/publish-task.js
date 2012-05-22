var argParse = require('../args').parse,
    publish = require('./publish').publish;


exports.summary = 'Publish a task to a repository';

exports.usage = '' +
'jam publish-task [TASK_PATH]\n' +
'\n' +
'Parameters:\n' +
'  TASK_PATH    Path to task directory to publish (defaults to ".")\n' +
'\n' +
'Options:\n' +
'  --repo         Target repository URL (otherwise uses "default" in .jamrc)\n' +
'  --force, -f    Overwrite if version is already published'


exports.run = function (settings, args) {
    var a = argParse(args, {
        'repo': {match: '--repo', value: true},
        'force': {match: ['--force', '-f']}
    });
    var dir = a.positional[0] || '.';
    var repo = a.options.repo || settings.task_repositories[0];
    publish('task', repo, dir, a.options);
};

