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

# Workers + D1 are created with wrangler (see scripts/provision-cloudflare.sh).
# After you attach a custom domain in the Worker dashboard, these records publish
# customer-facing hostnames (SSL is automatic on Cloudflare).

resource "cloudflare_dns_record" "app" {
  for_each = var.root_domain != "" ? { for a in local.apps : a.slug => a } : {}

  zone_id = var.cloudflare_zone_id
  name    = each.value.subdomain
  type    = "AAAA"
  content = "100::"
  proxied = true
  comment = "CRUD factory → Worker ${each.value.workerName}"
}
