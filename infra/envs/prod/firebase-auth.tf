# Firebase Authentication (Identity Platform) — sign-in methods managed by Terraform.
# Anonymous + Email/Password are enabled unconditionally (no external credentials).
# Google sign-in needs an OAuth 2.0 client (client id + secret) → gated behind
# enable_google_signin; create the OAuth client once, put the values in
# terraform.tfvars, then set enable_google_signin = true.
#
# Note: the very first apply may require Identity Platform to be initialized for
# the project (accepting its terms). If apply errors on the config resource,
# open Firebase Console → Authentication → Get started once, then re-apply.

resource "google_identity_platform_config" "auth" {
  project = var.project_id

  sign_in {
    allow_duplicate_emails = false

    anonymous {
      enabled = true
    }

    email {
      enabled           = true
      password_required = true
    }
  }

  authorized_domains = [
    "localhost",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
  ]

  depends_on = [google_project_service.services]
}

resource "google_identity_platform_default_supported_idp_config" "google" {
  count = var.enable_google_signin ? 1 : 0

  project       = var.project_id
  idp_id        = "google.com"
  client_id     = var.google_oauth_client_id
  client_secret = var.google_oauth_client_secret
  enabled       = true

  depends_on = [google_identity_platform_config.auth]
}
