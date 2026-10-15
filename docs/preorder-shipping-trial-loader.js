// Replace ONLY the preorder loader on "ملاك تجارب" (1409940314).
// Keep protection-widget.js and link-sidebar.js loaders exactly as they are.
// This opt-in trial is not approved for the live theme.
(function () {
  if (document.getElementById('link-preorder-shipping-loader')) return;
  var script = document.createElement('script');
  script.id = 'link-preorder-shipping-loader';
  script.src = 'https://link-video-shop.vercel.app/preorder-shipping-trial.js?v=20261015-1';
  script.dataset.shippingTrial = '1';
  script.async = true;
  document.head.appendChild(script);
})();
