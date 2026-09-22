# AWS starter architecture

This Terraform is an educational starting point, not a production-ready account
baseline. It creates the expensive resources only after an explicit
`terraform apply`.

| Platform need | AWS service / implementation |
| --- | --- |
| Kubernetes | EKS managed control plane and managed ARM node group |
| Images | One immutable, scan-on-push ECR repository per workload |
| PostgreSQL | Encrypted private RDS PostgreSQL; create one database/role per service after provisioning |
| Kafka | Private MSK Serverless with IAM authentication |
| Redis | Private encrypted ElastiCache replication group |
| Assets | Private, encrypted, versioned S3 bucket |
| Optional NoSQL projection | DynamoDB analytics read model, disabled by default |
| Secrets | Secrets Manager; mount with External Secrets or Secrets Store CSI |
| Workload access | EKS Pod Identity roles using the starter IAM policy |
| Network | Three-AZ VPC, public load-balancer subnets, private nodes/data services, NAT |
| Public entry | AWS Load Balancer Controller creates an ALB from Kubernetes Ingress |
| Logs/metrics | CloudWatch log group plus Container Insights / managed observability add-on |

## Before applying

1. Use an encrypted remote Terraform backend (S3 with versioning and DynamoDB
   locking, or HCP Terraform). Local state contains the generated RDS password.
2. Pin reviewed module/provider versions and run `terraform init -upgrade`,
   `terraform fmt -check`, `terraform validate`, and a security scanner.
3. Set `deletion_protection = true` for production and review RDS/MSK/ElastiCache
   sizing and backup requirements.
4. Restrict the EKS public endpoint to trusted CIDRs or use a private endpoint.
5. Split the broad starter application policy into one Pod Identity role per
   Kubernetes service account. Scope MSK topic/group ARNs rather than `*`.
6. Install AWS Load Balancer Controller with Pod Identity, then change the
   Ingress class to `alb` and add scheme, target-type, healthcheck and TLS
   certificate annotations.
7. Install External Secrets (or Secrets Store CSI), metrics-server, and the
   CloudWatch observability add-on. Do not place secret values in manifests.
8. Create service-owned RDS roles/databases with a migration job or a
   privileged one-time administration process; applications must not use the
   RDS master user.
9. Enable `enable_dynamodb_analytics_projection` only when the documented
   high-volume analytics access pattern is required. PostgreSQL and Kafka
   remain the transactional source and event log.

## Commands

```powershell
cd infra/aws
terraform init
terraform fmt -check -recursive
terraform validate
terraform plan -out arcade.tfplan
# Review cost/security changes before explicitly running:
terraform apply arcade.tfplan
aws eks update-kubeconfig --region ap-south-1 --name arcade-dev
```

The Kubernetes base uses generic image and endpoint placeholders. A deployment
overlay should set ECR image URLs/tags, RDS/MSK/Redis endpoints, ALB annotations,
service accounts, Pod Identity associations, and production replica policies.
