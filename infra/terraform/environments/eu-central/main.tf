module "eu_central" {
  source      = "../../modules/regional-stack"
  region_code = "eu-central"
  aws_region  = "eu-central-1" # Frankfurt — keeps EU tenant data within the EU/EEA per GDPR residency (docs/COMPLIANCE.md)
}

output "eu_central" {
  value = {
    db_endpoint             = module.eu_central.db_endpoint
    kms_key_arn              = module.eu_central.kms_key_arn
    tenant_documents_bucket  = module.eu_central.tenant_documents_bucket
  }
}
