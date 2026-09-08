module "ap_southeast" {
  source      = "../../modules/regional-stack"
  region_code = "ap-southeast"
  aws_region  = "ap-southeast-1" # Singapore — serves Singapore PDPA tenants; a KSA/China/India tenant needing stricter in-country localization gets its own additional stack (me-ksa, cn-north, ap-south) rather than sharing this one.
}

output "ap_southeast" {
  value = {
    db_endpoint             = module.ap_southeast.db_endpoint
    kms_key_arn              = module.ap_southeast.kms_key_arn
    tenant_documents_bucket  = module.ap_southeast.tenant_documents_bucket
  }
}
