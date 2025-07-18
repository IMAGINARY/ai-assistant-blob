/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/bezier-easing@2.1.0/src/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
var r=.1,n="function"==typeof Float32Array;function t(r,n){return 1-3*n+3*r}function u(r,n){return 3*n-6*r}function e(r){return 3*r}function o(r,n,o){return((t(n,o)*r+u(n,o))*r+e(n))*r}function f(r,n,o){return 3*t(n,o)*r*r+2*u(n,o)*r+e(n)}function a(r){return r}var i=function(t,u,e,i){if(!(0<=t&&t<=1&&0<=e&&e<=1))throw new Error("bezier x values must be in [0, 1] range");if(t===u&&e===i)return a;for(var c=n?new Float32Array(11):new Array(11),v=0;v<11;++v)c[v]=o(v*r,t,e);function l(n){for(var u=0,a=1;10!==a&&c[a]<=n;++a)u+=r;--a;var i=u+(n-c[a])/(c[a+1]-c[a])*r,v=f(i,t,e);return v>=.001?function(r,n,t,u){for(var e=0;e<4;++e){var a=f(n,t,u);if(0===a)return n;n-=(o(n,t,u)-r)/a}return n}(n,i,t,e):0===v?i:function(r,n,t,u,e){var f,a,i=0;do{(f=o(a=n+(t-n)/2,u,e)-r)>0?t=a:n=a}while(Math.abs(f)>1e-7&&++i<10);return a}(n,u,u+r,t,e)}return function(r){return 0===r?0:1===r?1:o(l(r),u,i)}};export{i as default};
//# sourceMappingURL=/sm/061d7aa104ef4c81adb74b7e5439c3dd5b5d98639e255e84d29d70997b6f36ea.map