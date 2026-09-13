terraform {
  required_version = ">= 1.5.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

locals {
  apps = jsondecode(file("${path.module}/../../apps.registry.json")).apps
}

# Fast path: `pnpm go-live <slug>` deploys the Worker to workers.dev and, when
# ROOT_DOMAIN is set, attaches a Workers custom domain (SSL is automatic).
#
# This Terraform is optional — use it when you want hostnames in state instead
# of Wrangler routes. Do not attach the same hostname from both places.

resource "cloudflare_workers_custom_domain" "app" {
  for_each = var.root_domain != "" ? { for a in local.apps : a.slug => a } : {}

  account_id  = var.cloudflare_account_id
  zone_id     = var.cloudflare_zone_id
  hostname    = "${each.value.subdomain}.${var.root_domain}"
  service     = each.value.workerName
  environment = "production"
}
