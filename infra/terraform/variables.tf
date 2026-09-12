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
}

variable "root_domain" {
  type        = string
  default     = ""
  description = "e.g. yourdomain.com — creates demo.yourdomain.com per app with SSL"
}
