module "me_uae" {
  source      = "../../modules/regional-stack"
  region_code = "me-uae"
  aws_region  = "me-central-1" # UAE (Dubai/Abu Dhabi) region — satisfies UAE PDPL/DHA in-country data residency (docs/COMPLIANCE.md)
}

output "me_uae" {
  value = {
    db_endpoint             = module.me_uae.db_endpoint
    kms_key_arn              = module.me_uae.kms_key_arn
    tenant_documents_bucket  = module.me_uae.tenant_documents_bucket
  }
}
