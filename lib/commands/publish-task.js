var publish = require('./publish');


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


exports.run = publish.doPublish('task');
