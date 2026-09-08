# Regional deployment stack: one of these is applied per residency zone (us-east, eu-central,
# me-uae, ap-southeast, ...) so that a tenant's data never leaves its assigned region at the
# infrastructure layer — see docs/MULTI_TENANCY.md#regional-placement and
# docs/ARCHITECTURE.md#deployment-topology.
#
# This module is a representative skeleton, not a production-ready stack: it establishes the
# shape (isolated VPC, regional KMS key, regional Postgres, regional object storage) that a real
# rollout fills in with the org's actual networking, IAM, backup/DR, and monitoring standards —
# see the compliance readiness checklist in docs/ARCHITECTURE.md before applying this against a
# real account with real tenant data.

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_kms_key" "tenant_data" {
  description             = "Envelope-encryption key for tenant data at rest in region ${var.region_code}"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Region      = var.region_code
    Environment = var.environment
    Purpose     = "rwe-platform-tenant-data"
  }
}

resource "aws_vpc" "regional" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "rwe-platform-${var.region_code}"
  }
}

resource "aws_db_subnet_group" "regional" {
  name       = "rwe-platform-${var.region_code}"
  subnet_ids = [] # TODO: populate with private subnet ids once the networking module for this account is defined

  tags = {
    Region = var.region_code
  }
}

resource "aws_db_instance" "control_plane" {
  identifier              = "rwe-platform-${var.region_code}"
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = var.db_instance_class
  allocated_storage       = 100
  storage_encrypted       = true
  kms_key_id              = aws_kms_key.tenant_data.arn
  db_subnet_group_name    = aws_db_subnet_group.regional.name
  username                = "rwe_admin"
  manage_master_user_password = true
  backup_retention_period = 35 # days — comfortably covers the shortest breach/audit windows in docs/COMPLIANCE.md
  deletion_protection     = true
  skip_final_snapshot     = false

  tags = {
    Region      = var.region_code
    Environment = var.environment
  }
}

resource "aws_s3_bucket" "tenant_documents" {
  bucket = "rwe-platform-${var.region_code}-tenant-documents"

  tags = {
    Region = var.region_code
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tenant_documents" {
  bucket = aws_s3_bucket.tenant_documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.tenant_data.arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tenant_documents" {
  bucket                  = aws_s3_bucket.tenant_documents.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
