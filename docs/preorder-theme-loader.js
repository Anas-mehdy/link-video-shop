// Append only to the custom JavaScript of "ملاك تجارب" (version 1409940314).
// Preserve the existing protection/sidebar loaders. Do not install in the live theme yet.
(function () {
  if (document.getElementById('link-preorder-loader')) return;
  var script = document.createElement('script');
  script.id = 'link-preorder-loader';
  script.src = 'https://link-video-shop.vercel.app/preorder-widget.js?v=20261014-1';
  script.dataset.mode = 'preview';
  script.async = true;
  document.head.appendChild(script);
})();
