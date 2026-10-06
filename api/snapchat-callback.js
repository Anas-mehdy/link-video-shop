// Reserved OAuth callback. Token exchange is enabled in the next integration step.
// Never reflect or persist authorization parameters while the integration is pending.
module.exports = function snapchatCallback(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.setHeader('Allow', 'GET, HEAD');
    res.statusCode = 405;
    return res.end();
  }
  res.statusCode = 303;
  res.setHeader('Location', '/snapchat-connection.html');
  return res.end();
};
