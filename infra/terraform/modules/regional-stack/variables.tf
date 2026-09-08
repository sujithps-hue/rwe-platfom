variable "region_code" {
  description = "Platform region code used in resource naming, e.g. us-east, eu-central, me-uae, ap-southeast (see docs/MULTI_TENANCY.md)."
  type        = string
}

variable "aws_region" {
  description = "AWS region this stack deploys into."
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class for the control-plane + shared-tenant Postgres cluster."
  type        = string
  default     = "db.t3.medium"
}

variable "environment" {
  description = "Deployment environment name, e.g. staging, production."
  type        = string
  default     = "production"
}
