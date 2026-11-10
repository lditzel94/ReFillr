// Infrastructure for ReFillr: the Cloudflare Pages project that hosts the PWA and the Supabase
// project behind it. App deploys stay in CI (wrangler pages deploy) and the database schema
// lives in Supabase migrations; this program only declares what has to exist and how it is set up.
import * as pulumi from '@pulumi/pulumi';
import * as cloudflare from '@pulumi/cloudflare';
import * as supabase from '@pulumi/supabase';

const config = new pulumi.Config();

// Direct Upload project: no Git source, CI publishes each build into it with wrangler.
// The name is fixed because it becomes the refillr.pages.dev subdomain.
const pages = new cloudflare.PagesProject('refillr', {
  accountId: config.require('cloudflareAccountId'),
  name: 'refillr',
  productionBranch: 'main',
});

// Deleting or replacing this project would drop the database, so Pulumi refuses to.
const db = new supabase.Project(
  'refillr',
  {
    organizationId: config.require('supabaseOrgId'),
    name: 'refillr',
    region: config.get('supabaseRegion') ?? 'sa-east-1', // São Paulo, the closest to Argentina
    databasePassword: config.requireSecret('dbPassword'),
  },
  { protect: true },
);

// Auth emails (invitation, password reset) must link back to the deployed site;
// localhost is allowed for `npm start`.
const siteUrl = pulumi.interpolate`https://${pages.subdomain}`;

// No custom email templates here: on the free plan Supabase only allows them with a custom SMTP
// provider. Its default emails link to /auth/v1/verify, which lands on the site with the session in
// the URL hash; AuthService picks that up and continues on /set-password. The Spanish templates in
// supabase/templates are used by the local Supabase (config.toml) and can come back here once an
// SMTP provider is configured.
new supabase.Settings('refillr', {
  projectRef: db.id,
  auth: siteUrl.apply((url) =>
    JSON.stringify({
      site_url: url,
      uri_allow_list: `${url}/**,http://localhost:4200/**`,
      // Accounts are created by the admin (Authentication > Invite user); nobody signs up alone.
      disable_signup: true,
      password_min_length: 8,
    }),
  ),
});

// The app talks to Supabase with the publishable key. It is public by design (it ships in the
// JavaScript bundle); Row Level Security is what protects the data.
const keys = supabase.getApikeysOutput({ projectRef: db.id });

export { siteUrl };
export const supabaseUrl = pulumi.interpolate`https://${db.id}.supabase.co`;
export const supabasePublishableKey = pulumi.unsecret(keys.publishableKey);
