# Jam

For **front-end** developers who crave maintainable assets,
**Jam** is a **package manager** for JavaScript.
Unlike other repositories, we put the **browser** first by using
[AMD modules](http://requirejs.org/docs/whyamd.html).

[Visit the Jam website](http://groundcomputing.co.uk/code/jam)

* **Manage dependencies** - Using a stack of script tags isn't the most maintainable way of managing dependencies, with Jam packages and AMD modules you get automatic dependency resolution.
* **Fast and modular** - Faster load times with asynchronous loading and the ability to optimize downloads. AMD provides properly namespaced and more modular code.
* **Use with existing stack** - Jam manages only your front-end assets, the rest of your app can be written in your favourite language or framework. Node.js tools can use the repository directly with the Jam API.
* **Custom builds** - No more configuring custom builds of popular libraries. Now, every build can be optimized automatically depending on the parts you use, and additional components can always be loaded later.
* **Focus on size** - Installing multiple versions works great on the server, but client-side we don't want five versions of jQuery! Jam can use powerful dependency resolution to find a working set of packages using only a single version of each.
* **100% browser** - Every package you see here will work in the browser and play nicely with AMD loaders like RequireJS. We're not hijacking an existing repository, we're creating a 100% browser-focused community!


## Example usage

<pre><code class="no-highlight">$ jam install backbone
<span style="color: #038198">installing from repositories</span> backbone
Building version tree...
<span style="color: #038198">repositories</span> checking "backbone"
<span style="color: #038198">repositories</span> checking "underscore"
<span style="color: #038198">downloading</span> http://packages.jamjs.org/backbone/backbone-0.9.2.tar.gz
<span style="color: #038198">downloading</span> http://packages.jamjs.org/underscore/underscore-1.3.3.tar.gz
<span style="color: #038198">extracting</span> /home/caolan/.jam/cache/backbone/0.9.2/backbone-0.9.2.tar.gz
<span style="color: #038198">extracting</span> /home/caolan/.jam/cache/underscore/1.3.3/underscore-1.3.3.tar.gz
<span style="color: #038198">installing</span> underscore@1.3.3
<span style="color: #038198">installing</span> backbone@0.9.2
<span style="color: #038198">updating</span> jam/jam.json
<span style="color: #038198">updating</span> jam/require.config.js
<span style="color: #038198">updating</span> jam/require.js
<span style="color: #81e234; font-weight: bold;">OK</span></code></pre>


<pre><code class="xml"><span class="tag">&lt;<span class="title">script</span> <span class="attribute">src</span>=<span class="value">"jam/require.js"</span>&gt;</span><span class="javascript"></span><span class="tag">&lt;/<span class="title">script</span>&gt;</span>

<span class="tag">&lt;<span class="title">script</span>&gt;</span><span class="javascript">
  require([<span class="string">'backbone'</span>], <span class="function"><span class="keyword">function</span> <span class="params">(Backbone)</span> {</span>
    ...
  });
</span><span class="tag">&lt;/<span class="title">script</span>&gt;</span></code></pre>


[Learn more...](http://groundcomputing.co.uk/code/jam)
