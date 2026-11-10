/**
 * Where the app finds Supabase. `npm start` and production use the real project; `npm run
 * start:local` swaps in supabase.local.ts (angular.json, configuration "local").
 *
 * The publishable key is public by design: it ships in the bundle, and Row Level Security is what
 * protects the data. Its value comes from `pulumi stack output supabasePublishableKey` in infra/.
 */
export const supabaseConfig = {
  url: 'https://bdzlldteahgdfovbhcgg.supabase.co',
  publishableKey: 'sb_publishable_REPLACE_WITH_PULUMI_OUTPUT',
};
