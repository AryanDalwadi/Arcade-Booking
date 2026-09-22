output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "ecr_repository_urls" {
  value = { for name, repository in aws_ecr_repository.service : name => repository.repository_url }
}

output "postgres_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "database_secret_arn" {
  value = aws_secretsmanager_secret.database.arn
}

output "redis_primary_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "msk_bootstrap_brokers_sasl_iam" {
  value = aws_msk_serverless_cluster.events.bootstrap_brokers_sasl_iam
}

output "assets_bucket" {
  value = aws_s3_bucket.assets.id
}

output "application_policy_arn" {
  description = "Attach through EKS Pod Identity to least-privilege service roles."
  value       = aws_iam_policy.application.arn
}

output "analytics_projection_table" {
  description = "Optional derived DynamoDB read model; null when deliberately disabled."
  value       = try(aws_dynamodb_table.analytics_projection[0].name, null)
}

output "analytics_projection_policy_arn" {
  description = "Attach only to the analytics workload through EKS Pod Identity."
  value       = try(aws_iam_policy.analytics_projection[0].arn, null)
}
