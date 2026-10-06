# Supabase dashboard login

## Activation on Link Store

1. Run `crm-auth.sql` in the Link project's SQL Editor.
2. In Authentication > Users, use Add user > Create new user to create the admin's email/password account. Create or confirm the email in the Supabase dashboard. No public signup endpoint is added.
3. Replace the email in this query and run it after the user exists:

```sql
insert into public.crm_admin_members (merchant_id,user_id)
select 1829345766,id from auth.users
where lower(email)=lower('YOUR_EMAIL_HERE')
on conflict (merchant_id,user_id) do update set active=true;

select u.email,m.active from public.crm_admin_members m
join auth.users u on u.id=m.user_id
where m.merchant_id=1829345766;
```

Verify the final query returns the intended account before switching modes. A missing email inserts zero rows and does not authorize anyone.

4. Set production Vercel environment variable `CRM_AUTH_MODE=supabase` and redeploy.
5. Open `/dashboard` and sign in with the authorized email/password. Verify WhatsApp, Snapchat advertiser selection, video administration and protection administration under the same session. Legacy token authentication is rejected on every admin API in Supabase mode.

The deployed default remains `legacy` until this explicit switch so manual database provisioning does not lock out the existing admin. Unknown mode values fail closed. After confirming the new login, the old `VIDEO_SHOP_ADMIN_TOKEN` may be removed from production. Worker and Salla webhook credentials are unaffected.

## Design

Existing `/api/crm-admin?resource=auth` hosts config, login, session and logout actions; no new Vercel Function is needed. Password login and refresh use Supabase Auth's REST endpoints. Provider access/refresh tokens remain in HttpOnly, Secure, SameSite=Lax cookies on production. Tokens are never returned to browser JavaScript, localStorage or sessionStorage. The server service key remains server-only. Passwords are forwarded to Supabase Auth for validation and are not stored in the application database.

Every admin endpoint awaits server verification via `/auth/v1/user`, then looks up an active `crm_admin_members` row for the configured merchant. User-editable metadata is never accepted as an authorization source. Disabled membership takes effect on the next request. Supabase access JWTs can otherwise remain valid until expiry after sign-out; membership authorization supplies a fresh server-side restriction.

Cookie-authenticated mutations, login and logout require the configured application Origin. `CRM_APP_ORIGIN` defaults to `https://link-video-shop.vercel.app`. Change it server-side when hosting on a custom domain. HTTPS is required in production; an explicit localhost Origin is allowed for local tests. Supabase's rate limits are surfaced without exposing provider error bodies. There is no shared cache of account authorization.

GET session validates the access token, refreshes only after authentication failure, and checks membership again before setting rotated cookies. The browser retries an admin request once after successful session renewal. Logout revokes the current provider session and expires both local cookies, then broadcasts logout to other tabs and frames.

Standalone Video Shop and Protection pages use the same shared authentication helper and session. Frontend signup, reset-password email delivery, MFA and management of employee roles are outside this first login implementation; additional accounts can be created and explicitly authorized through Supabase.

## Verification

Tests cover old-token rejection in Supabase mode, non-member denial even with user metadata claiming admin, cookie flags/token redaction, cross-origin rejection before IO, session rotation, logout and repeatable private membership SQL. Browser verification passed email/password login, HttpOnly cookies with no JavaScript token storage, reload restoration, expired-session refresh and retry, Video Shop/Protection single sign-in, and logout across tabs. Browser testing uses fixture Supabase responses; actual production activation requires the manual setup above.
