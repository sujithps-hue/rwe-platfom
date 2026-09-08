module "us_east" {
  source      = "../../modules/regional-stack"
  region_code = "us-east"
  aws_region  = "us-east-1"
}

# HIPAA note: this stack alone does not make the deployment HIPAA-compliant — it must also sit
# behind a signed AWS Business Associate Addendum (BAA) for every AWS service used, per
# docs/COMPLIANCE.md's readiness checklist.

output "us_east" {
  value = {
    db_endpoint             = module.us_east.db_endpoint
    kms_key_arn              = module.us_east.kms_key_arn
    tenant_documents_bucket  = module.us_east.tenant_documents_bucket
  }
}
