# Jam

For **front-end** developers who crave maintainable assets,
**Jam** is a **package manager** for JavaScript.
Unlike other repositories, we put the **browser** first by using
[AMD modules](http://requirejs.org/docs/whyamd.html).


* **Manage dependencies** - Using a stack of script tags isn't the most maintainable way of managing dependencies, with Jam packages and AMD modules you get automatic dependency resolution.

* **Fast and modular** - Faster load times with asynchronous loading and the ability to optimize downloads. AMD provides properly namespaced and more modular code.

* **Use with existing stack** - Jam manages only your front-end assets, the rest of your app can be written in your favourite language or framework. Node.js tools can use the repository directly with the Jam API.

* **Custom builds** - No more configuring custom builds of popular libraries. Now, every build can be optimized automatically depending on the parts you use, and additional components can always be loaded later.

* **Focus on size** - Installing multiple versions works great on the server, but client-side we don't want five versions of jQuery! Jam can use powerful dependency resolution to find a working set of packages using only a single version of each.

* **100% browser** - Every package you see here will work in the browser and play nicely with AMD loaders like RequireJS. We're not hijacking an existing repository, we're creating a 100% browser-focused community!


[Visit the Jam website](http://groundcomputing.co.uk/code/jam)


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

[Learn more...](http://groundcomputing.co.uk/code/jam)


## Installation

    # npm install -g jamjs

Requires [node.js](http://nodejs.org)
