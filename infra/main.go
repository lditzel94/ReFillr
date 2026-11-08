// Infrastructure for ReFillr: the Cloudflare Pages project that hosts the PWA and the Supabase
// project behind it. App deploys stay in CI (wrangler pages deploy) and the database schema
// lives in Supabase migrations; this program only declares what has to exist and how it is set up.
package main

import (
	"encoding/json"

	"github.com/pulumi/pulumi-cloudflare/sdk/v6/go/cloudflare"
	"github.com/pulumi/pulumi-terraform-provider/sdks/go/supabase/supabase"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi/config"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		cfg := config.New(ctx, "")
		region := cfg.Get("supabaseRegion")
		if region == "" {
			region = "sa-east-1" // São Paulo, the closest region to Argentina
		}

		// Direct Upload project: no Git source, CI publishes each build into it with wrangler.
		// The name is fixed because it becomes the refillr.pages.dev subdomain.
		pages, err := cloudflare.NewPagesProject(ctx, "refillr", &cloudflare.PagesProjectArgs{
			AccountId:        pulumi.String(cfg.Require("cloudflareAccountId")),
			Name:             pulumi.String("refillr"),
			ProductionBranch: pulumi.String("main"),
		})
		if err != nil {
			return err
		}

		// Deleting or replacing this project would drop the database, so Pulumi refuses to.
		db, err := supabase.NewProject(ctx, "refillr", &supabase.ProjectArgs{
			OrganizationId:   pulumi.String(cfg.Require("supabaseOrgId")),
			Name:             pulumi.String("refillr"),
			Region:           pulumi.String(region),
			DatabasePassword: cfg.RequireSecret("dbPassword"),
		}, pulumi.Protect(true))
		if err != nil {
			return err
		}

		// Auth emails (sign-up confirmation, password reset) must link back to the deployed site;
		// localhost is allowed for `npm start`.
		siteURL := pulumi.Sprintf("https://%s", pages.Subdomain)
		authSettings := siteURL.ApplyT(func(url string) (string, error) {
			settings, err := json.Marshal(map[string]any{
				"site_url":       url,
				"uri_allow_list": url + "/**,http://localhost:4200/**",
			})
			return string(settings), err
		}).(pulumi.StringOutput)

		_, err = supabase.NewSettings(ctx, "refillr", &supabase.SettingsArgs{
			ProjectRef: db.ID().ToStringOutput(),
			Auth:       authSettings,
		})
		if err != nil {
			return err
		}

		ctx.Export("siteUrl", siteURL)
		ctx.Export("supabaseUrl", pulumi.Sprintf("https://%s.supabase.co", db.ID()))
		return nil
	})
}
