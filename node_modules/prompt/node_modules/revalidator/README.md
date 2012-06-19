# revalidator [![Build Status](https://secure.travis-ci.org/flatiron/revalidator.png)](http://travis-ci.org/flatiron/revalidator)

A cross-browser / node.js validator used by resourceful and flatiron.

## Example
The core of `revalidator` is simple and succinct: `revalidator.validate(obj, schema)`: 
 
``` js
  var revalidator = require('revalidator');
  
  console.dir(revalidator.validate(someObject, {
    properties: {
      url: {
        description: 'the url the object should be stored at',
        type: 'string',
        pattern: '^/[^#%&*{}\\:<>?\/+]+$',
        required: true
      },
      challenge: {
        description: 'a means of protecting data (insufficient for production, used as example)',
        type: 'string',
        minLength: 5
      },
      body: {
        description: 'what to store at the url',
        type: 'any',
        default: null
      }
    }
  }));
```

This will return with a value indicating if the `obj` conforms to the `schema`. If it does not, a descriptive object will be returned containing the errors encountered with validation.

``` js
  {
    valid: true // or false
    errors: [/* Array of errors if valid is false */]
  }
```

In the browser, the validation function is exposed on `window.validate` by simply including `revalidator.js`.

## Installation

### Installing npm (node package manager)
``` bash
  $ curl http://npmjs.org/install.sh | sh
```

### Installing revalidator
``` bash 
  $ [sudo] npm install revalidator
```

## Tests
All tests are written with [vows][0] and should be run with [npm][1]:

``` bash
  $ npm test
```

#### Author: [Charlie Robbins](http://nodejitsu.com), [Alexis Sellier](http://cloudhead.io)
#### Contributors: [Fedor Indutny](http://github.com/indutny), [Bradley Meck](http://github.com/bmeck), [Laurie Harper](http://laurie.holoweb.net/)
#### License: Apache 2.0

[0]: http://vowsjs.org
[1]: http://npmjs.org
