# Milestone 12: AWS Target Architecture

## Goal

Draw the arcade on **Amazon’s map**. Each laptop piece gets a managed AWS
name. This is a **proposal**. It does not create an AWS account or a bill.

Compose at http://localhost:3000 is still the live demo.

`terraform apply` is blocked until you set
`i_understand_this_creates_billable_aws_resources=true`. Milestone 12 leaves
that **false**.

## Same arcade, different landlord

```text
Laptop Compose          Proposed AWS
-------------------     ---------------------------
web + gateway           ALB (front door) → EKS pods
identity…analytics      EKS in private subnets
Docker image :SHA       ECR (immutable tags)
PostgreSQL              RDS (private)
Kafka                   MSK Serverless
Redis                   ElastiCache
stdout JSON logs        CloudWatch
passwords               Secrets Manager (not git)
```

| AWS name | Easy meaning |
| --- | --- |
| **VPC** | Private neighborhood (3 AZs) |
| **EKS** | Amazon runs the Kubernetes manager |
| **ECR** | Shelf for SHA-tagged images |
| **RDS** | Managed PostgreSQL |
| **MSK** | Managed Kafka |
| **ElastiCache** | Managed Redis |
| **ALB** | Public door; only web + `/api` |
| **IAM** | Short-lived who-can-do-what |
| **S3** | Files/exports, not booking truth |
| **CloudWatch** | Logs and a budget alarm |

One RDS instance is a **cost compromise**. After a real apply you would still
create **one database/role per service**, same as Compose.

DynamoDB stays **off** in Terraform. Milestone 13 uses the same keys in
analytics memory on the laptop; PostgreSQL remains the source of truth.

## Files

| File | Role |
| --- | --- |
| `infra/aws/mapping.json` | Compose → AWS table used by tests |
| `infra/aws/main.tf` | Proposed VPC, EKS, ECR, RDS, MSK, Redis, S3 |
| `infra/aws/variables.tf` | Apply guard default **false**; DynamoDB default **false** |
| `infra/aws/terraform.tfvars.example` | Local copy; do not apply for this milestone |
| `infra/aws/backend.tf.example` | Remote state only when you have an account |
| `infra/k8s/overlays/aws/` | Same K8s base, Ingress class `alb` |
| `infra/aws/policy.test.mjs` | Private RDS, immutable ECR, no `Resource = "*"` |

NAT Gateways, EKS, MSK, and RDS are the usual **credit burners**. A budget
resource of $50 is in the map; it does not stop resources by itself.

## How to verify (no AWS account)

```powershell
npm run test:policies
terraform -chdir=infra/aws fmt -check -recursive
terraform -chdir=infra/aws init -backend=false -input=false
terraform -chdir=infra/aws validate
kubectl kustomize infra/k8s/overlays/aws
```

`validate` checks syntax. It does **not** create servers.  
`plan` / `apply` need credentials and the apply-guard variable.

## What is still not deployed

- No EKS cluster, no RDS, no public URL on Amazon
- Image names still contain `ACCOUNT`
- Ingress overlay is paper until AWS Load Balancer Controller exists
- Credits do not change this milestone: the live arcade is still Compose

## Interview answer

> The AWS target maps the arcade to managed services: ECR for immutable images,
> EKS for the gateway and services, RDS for PostgreSQL, MSK for Kafka,
> ElastiCache for Redis, and an ALB as the only public edge. Data stays in
> private subnets; secrets stay in Secrets Manager; IAM is short-lived. One RDS
> is a starter; each service still owns its database. DynamoDB is optional and
> off by default. Managed does not mean free: NAT, MSK, and idle EKS dominate
> cost. This is a proposed map, not a claim that production is deployed.
