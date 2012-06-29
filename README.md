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


## Installation

    # npm install -g jamjs

Requires [node.js](http://nodejs.org)
