 var jam = {data};

if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
	module.exports = jam;
} else if (typeof require !== 'undefined' && require.config) {
	require.config(jam)
} else if (typeof window === 'object') {
	window.require = jam;
}
