# AWS starter architecture

This Terraform is a **proposed map** (Milestone 12). It is not a live AWS
account. `terraform validate` is in CI. `terraform apply` stays blocked until
`i_understand_this_creates_billable_aws_resources` is set to true.

Hands-on guide: [Milestone 12 AWS](../docs/MILESTONE_12_AWS.md)

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
| Cost guard | Monthly budget resource (does not stop idle NAT/EKS by itself) |

## Laptop checks (this milestone)

```powershell
cd infra/aws
terraform init -backend=false -input=false
terraform fmt -check -recursive
terraform validate
```

Do not run `terraform apply` for Milestone 12.

## Before applying (later, on purpose)

1. Set `i_understand_this_creates_billable_aws_resources=true` and review cost.
2. Use an encrypted remote Terraform backend (see `backend.tf.example`).
3. Restrict the EKS public endpoint to trusted CIDRs or use a private endpoint.
4. Split the starter application policy into one Pod Identity role per service.
5. Install AWS Load Balancer Controller, then use `infra/k8s/overlays/aws`.
6. Create service-owned RDS roles/databases; applications must not use the
   RDS master user.
7. Leave `enable_dynamodb_analytics_projection` false unless you accept a real
   DynamoDB table. Milestone 13 runs the same keys in analytics **memory** on
   the laptop.
