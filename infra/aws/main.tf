# Proposed AWS map for Milestone 12. This file is not a live account.
# terraform validate is in CI. terraform apply is blocked until
# i_understand_this_creates_billable_aws_resources is set to true.
data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "${var.project_name}-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, 3)
  services = toset([
    "web", "gateway", "identity", "catalog", "booking",
    "payment", "notification", "inventory", "analytics"
  ])
}

resource "terraform_data" "apply_guard" {
  input = var.i_understand_this_creates_billable_aws_resources
  lifecycle {
    precondition {
      condition     = var.i_understand_this_creates_billable_aws_resources
      error_message = "Milestone 12 is a laptop map. Refusing apply until you set i_understand_this_creates_billable_aws_resources=true and accept the bill."
    }
  }
}

resource "aws_budgets_budget" "monthly" {
  name         = "${local.name}-monthly"
  budget_type  = "COST"
  limit_amount = var.monthly_budget_usd
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.13"

  name = local.name
  cidr = var.vpc_cidr
  azs  = local.azs

  private_subnets = [for index, _ in local.azs : cidrsubnet(var.vpc_cidr, 4, index)]
  public_subnets  = [for index, _ in local.azs : cidrsubnet(var.vpc_cidr, 8, index + 48)]

  enable_nat_gateway   = true
  single_nat_gateway   = var.environment != "prod"
  enable_dns_hostnames = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
  }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.24"

  cluster_name                             = local.name
  cluster_version                          = var.kubernetes_version
  cluster_endpoint_public_access           = true
  enable_cluster_creator_admin_permissions = true

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_addons = {
    coredns                = { most_recent = true }
    kube-proxy             = { most_recent = true }
    vpc-cni                = { most_recent = true }
    eks-pod-identity-agent = { most_recent = true }
  }

  eks_managed_node_groups = {
    default = {
      instance_types = ["m7g.large"]
      ami_type       = "AL2023_ARM_64_STANDARD"
      min_size       = 2
      max_size       = 6
      desired_size   = 2
    }
  }
}

resource "aws_ecr_repository" "service" {
  for_each             = local.services
  name                 = "${local.name}-${each.key}"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
}

resource "aws_ecr_lifecycle_policy" "service" {
  for_each   = aws_ecr_repository.service
  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Retain the newest 30 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 30
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_security_group" "data" {
  name_prefix = "${local.name}-data-"
  description = "Data services reachable only from EKS nodes"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "PostgreSQL from EKS"
    protocol        = "tcp"
    from_port       = 5432
    to_port         = 5432
    security_groups = [module.eks.node_security_group_id]
  }
  ingress {
    description     = "Redis from EKS"
    protocol        = "tcp"
    from_port       = 6379
    to_port         = 6379
    security_groups = [module.eks.node_security_group_id]
  }
  ingress {
    description     = "Kafka IAM from EKS"
    protocol        = "tcp"
    from_port       = 9098
    to_port         = 9098
    security_groups = [module.eks.node_security_group_id]
  }
  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = module.vpc.private_subnets
}

resource "random_password" "database" {
  length  = 32
  special = true
}

resource "aws_db_instance" "postgres" {
  identifier                 = local.name
  engine                     = "postgres"
  engine_version             = "16"
  instance_class             = var.db_instance_class
  allocated_storage          = 50
  max_allocated_storage      = 250
  storage_encrypted          = true
  db_name                    = "arcade"
  username                   = "arcade_admin"
  password                   = random_password.database.result
  db_subnet_group_name       = aws_db_subnet_group.main.name
  vpc_security_group_ids     = [aws_security_group.data.id]
  multi_az                   = var.environment == "prod"
  publicly_accessible        = false
  backup_retention_period    = var.environment == "prod" ? 14 : 3
  deletion_protection        = var.deletion_protection
  skip_final_snapshot        = var.environment != "prod"
  final_snapshot_identifier  = var.environment == "prod" ? "${local.name}-final" : null
  auto_minor_version_upgrade = true
}

resource "aws_secretsmanager_secret" "database" {
  name                    = "${local.name}/database"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id
  secret_string = jsonencode({
    host     = aws_db_instance.postgres.address
    port     = aws_db_instance.postgres.port
    database = aws_db_instance.postgres.db_name
    username = aws_db_instance.postgres.username
    password = random_password.database.result
  })
}

resource "aws_elasticache_subnet_group" "main" {
  name       = local.name
  subnet_ids = module.vpc.private_subnets
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = local.name
  description                = "Arcade cache and ephemeral coordination"
  node_type                  = "cache.t4g.small"
  port                       = 6379
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.data.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  automatic_failover_enabled = var.environment == "prod"
  multi_az_enabled           = var.environment == "prod"
  num_cache_clusters         = var.environment == "prod" ? 2 : 1
}

resource "aws_msk_serverless_cluster" "events" {
  cluster_name = local.name
  vpc_config {
    subnet_ids         = module.vpc.private_subnets
    security_group_ids = [aws_security_group.data.id]
  }
  client_authentication {
    sasl {
      iam { enabled = true }
    }
  }
}

resource "aws_s3_bucket" "assets" {
  bucket_prefix = "${local.name}-assets-"
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_dynamodb_table" "analytics_projection" {
  count        = var.enable_dynamodb_analytics_projection ? 1 : 0
  name         = "${local.name}-analytics-projection"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }

  server_side_encryption { enabled = true }
  point_in_time_recovery { enabled = var.environment == "prod" }
}

resource "aws_iam_policy" "analytics_projection" {
  count = var.enable_dynamodb_analytics_projection ? 1 : 0
  name  = "${local.name}-analytics-projection"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:BatchWriteItem",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:Query",
        "dynamodb:UpdateItem"
      ]
      Resource = aws_dynamodb_table.analytics_projection[0].arn
    }]
  })
}

resource "aws_iam_policy" "application" {
  name = "${local.name}-application"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_secretsmanager_secret.database.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.assets.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["kafka-cluster:Connect", "kafka-cluster:DescribeCluster"]
        Resource = aws_msk_serverless_cluster.events.arn
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "application" {
  name              = "/arcade/${var.environment}/application"
  retention_in_days = var.environment == "prod" ? 90 : 14
}
