(function (root) {
	 var jam = "{data}"; // placeholder for jam config

	 if (typeof module === 'object' && module.exports) {
		 // Node. Does not work with strict CommonJS, but
		 // only CommonJS-like environments that support module.exports,
		 // like Node.
		 module.exports = jam;
	 } else if (typeof require === 'function' && require.config) {
		 // RequireJS.
		 root.jam = jam;
		 require.config("{data}"); // don't "optimize" it!!! or rjs will be broken
	 } else if (typeof root === 'object') {
		 root.jam = jam;
	 }

 })(this);
