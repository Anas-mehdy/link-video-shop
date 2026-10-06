# Snapchat connection setup

Register this exact Snap Redirect URI in the Snapchat app:

https://link-video-shop.vercel.app/api/snapchat-callback

The URL is reserved and deployed, but OAuth is not enabled yet. The handler strips
all query parameters with a redirect to an explicit pending page. It does not
exchange authorization codes, store tokens, or mark an account connected.

After app creation, implement authenticated authorization initiation, single-use
state validation, server-side token exchange and encrypted credential storage
before asking the advertiser to authorize. Never place the app secret in public
JavaScript or commit it to GitHub.
