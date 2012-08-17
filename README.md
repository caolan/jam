# Jam

For **front-end** developers who crave maintainable assets,
**Jam** is a **package manager** for JavaScript.
Unlike other repositories, we put the **browser** first.


* **Manage dependencies** - Using a stack of script tags isn't the most maintainable way of managing dependencies, with Jam packages and loaders like RequireJS you get automatic dependency resolution.

* **Fast and modular** - Achieve faster load times with asynchronous loading and the ability to optimize downloads. JavaScript modules and packages provide properly namespaced and more modular code.

* **Use with existing stack** - Jam manages only your front-end assets, the rest of your app can be written in your favourite language or framework. Node.js tools can use the repository directly with the Jam API.

* **Custom builds** - No more configuring custom builds of popular libraries. Now, every build can be optimized automatically depending on the parts you use, and additional components can always be loaded later.

* **Focus on size** - Installing multiple versions works great on the server, but client-side we don't want five versions of jQuery! Jam can use powerful dependency resolution to find a working set of packages using only a single version of each.

* **100% browser** - Every package you see here will work in the browser and play nicely with module loaders like RequireJS. We're not hijacking an existing repository, we're creating a 100% browser-focused community!


[Visit the Jam website](http://jamjs.org)


## Example usage

    $ jam install jquery


```html
<script src="jam/require.js"></script>

<script>
    require(['jquery'], function ($) {
        ...
    });
</script>
```

[Learn more...](http://jamjs.org)


## Browser packages in package.json

You can also define your browser dependencies in a project-level package.json
file. If you use Node.js, this format will already familiar to you, and the
Jam dependencies can live alongside your NPM dependencies. It's also possible
to define custom install paths and baseUrls here:

```javascript
{
    "name": "my-project",
    "version": "0.0.1",
    "description": "My example project",
    "jam": {
        "baseUrl": "public",
        "packageDir": "public/vendor",
        "dependencies": {
            "jquery": "1.7.x",
            "underscore": null
        }
    }
}
```


## Installation

    # npm install -g jamjs

Requires [node.js](http://nodejs.org)


## Settings

You can customize Jam by creating a `.jamrc` file in your home directory.

### .jamrc

#### repositories

An array with Jam repositiories. Jam uses `http://jamjs.org/repository` by
default, but it's possible to create a local, e.g. corporate, repository.

```javascript
exports.repositories = [
    "http://mycorporation.com:5984/repository/",
    "http://jamjs.org/repository"
];
```

Repositories are in preference-order, so packages from repositories earlier
in the list will be preferred over packages in repositories later in the
list. However, when no package version is specified, the highest version
number will be installed (even if that's not from the earliest repository).

You can add custom search URLs to repositories too:

```javascript
exports.repositories = [
    {
        url: "http://mycorporation.com:5984/repository/",
        search: "http://db.com:5984/_fti/key/_design/search/something"
    },
    "http://jamjs.org/repository"
];
```

### package\_dir

Sets the default package installation directory (normally uses `./jam`). This
is best customized in your project-level package.json file, to ensure other
developers also install to the correct location.

```javascript
exports.package_dir = 'libs';
```


## Running the tests

Jam includes two test suites, unit tests (in `test/unit`) and integration
tests (in `test/integration`). The unit tests are easy to run by running the
`test/unit.sh` script, or `test\unit.bat` on Windows. The integration tests
first require you to set up a CouchDB instance to test against (you can get
a free account at [IrisCouch](iriscouch.com] if you don't want to install
CouchDB). You then need to set the JAM\_TEST\_DB environment variable to
point to a CouchDB database URL for testing:

#### Linux
```
export JAM_TEST_DB=http://user:password@localhost:5984/jamtest
```

#### Windows
```
set JAM_TEST_DB=http://user:password@localhost:5984/jamtest
```

**Warning:** All data in the test database will be deleted!

You can then run the integration tests using `test/integration.sh` or
`test\integration.bat`. To run BOTH the unit and integration tests use
`test/all.sh` or `test\all.bat`.


## More documentation

To learn how to create and publish packages etc, and for more info on using
packages, consult the [Jam documentation website](http://jamjs.org/docs).


## Links

* [Homepage](http://jamjs.org)
* [Packages](http://jamjs.org/packages/)
* [Docs](http://jamjs.org/doc)
