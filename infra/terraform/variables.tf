variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "Cloudflare API token with Workers, D1, and DNS edit permissions"
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID"
}

variable "cloudflare_zone_id" {
  type        = string
  default     = ""
  description = "Zone ID for your root domain (required when root_domain is set)"

  validation {
    condition     = var.root_domain == "" || var.cloudflare_zone_id != ""
    error_message = "cloudflare_zone_id is required when root_domain is set."
  }
}

variable "root_domain" {
  type        = string
  default     = ""
  description = "e.g. yourdomain.com — optional; pnpm go-live can attach the same hostname via Wrangler"
}
