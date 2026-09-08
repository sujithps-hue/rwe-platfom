output "db_endpoint" {
  value = aws_db_instance.control_plane.endpoint
}

output "kms_key_arn" {
  value = aws_kms_key.tenant_data.arn
}

output "tenant_documents_bucket" {
  value = aws_s3_bucket.tenant_documents.bucket
}

output "vpc_id" {
  value = aws_vpc.regional.id
}
