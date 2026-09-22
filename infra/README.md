# Arcade Booking delivery infrastructure

These assets are deliberately educational: they show the boundary between local
dependencies, application images, Kubernetes deployment, and an AWS production
shape. Review sizing, security, recovery, and cost before production use.

## Layout

- `docker-compose.yml` runs PostgreSQL, Kafka in KRaft mode, Redis, web, gateway,
  and seven service containers.
- `postgres/init/` safely creates one local database owner and database per
  service the first time the PostgreSQL volume is initialized.
- `docker/node.Dockerfile` is a common npm-workspace image recipe.
- `k8s/base/` is a Kustomize base with namespace, configuration, workloads,
  services, ingress, probes, resource policies, and HPAs.
- `aws/` is a Terraform starter and service mapping for EKS, ECR, RDS, MSK,
  ElastiCache, S3, IAM, Secrets Manager, VPC, ALB integration, and CloudWatch.
- `.github/workflows/` runs lockfile CI, SHA-tagged image builds, and
  a manually gated deployment skeleton that stays off until you enable it.

## Local dependencies

From the repository root:

```powershell
# Validate interpolation and the complete Compose model.
docker compose -f infra/docker-compose.yml config

# Start only stateful dependencies (works before app workspaces are created).
docker compose -f infra/docker-compose.yml up -d postgres kafka kafka-init redis
docker compose -f infra/docker-compose.yml ps

# Follow logs or stop without deleting data.
docker compose -f infra/docker-compose.yml logs -f postgres kafka redis
docker compose -f infra/docker-compose.yml down
```

PostgreSQL is available only to containers on the internal `data` network.
Kafka's developer listener is exposed on `localhost:29092`; Redis is internal
only. The defaults are local-only credentials. Override every password through
environment variables or a local untracked `.env` file.

Database initialization runs only for a new `postgres-data` volume. To recreate
local databases from scratch, stop Compose and deliberately remove its volumes:

```powershell
# Destructive: deletes all local PostgreSQL, Kafka, and Redis data.
docker compose -f infra/docker-compose.yml down --volumes
docker compose -f infra/docker-compose.yml up -d postgres kafka redis
```

## Application containers

All application workspaces now have build/start scripts, health endpoints, and
non-root images. Service containers run their idempotent PostgreSQL migrations
before startup. The web app is served at `http://localhost:3000` and the gateway
at `http://localhost:4000`.

```powershell
docker compose -f infra/docker-compose.yml build gateway
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps
```

The Linux image build resolves dependencies inside the container so
platform-specific optional packages are correct. CI still uses the committed
monorepo lockfile for application verification.

## Kubernetes

Render before applying:

```powershell
kubectl kustomize infra/k8s/base > arcade-rendered.yaml
kubectl apply --dry-run=server -f arcade-rendered.yaml
```

Before a real deployment:

1. Replace all `ghcr.io/OWNER/...` image names and immutable tags in an overlay.
2. Replace ConfigMap endpoint placeholders with managed service endpoints.
3. Copy `secret.template.yaml` outside version control, replace every value, and
   apply it, or use External Secrets/Secrets Store CSI. The template is
   intentionally excluded from Kustomize.
4. Install metrics-server for HPA metrics and an ingress controller.
5. Confirm the gateway serves `/health`, domain services serve `/health/live`
   and `/health/ready`, and every container listens on its documented port.

```powershell
Copy-Item infra/k8s/base/secret.template.yaml "$env:TEMP/arcade-secret.yaml"
# Edit the temporary file, then:
kubectl apply -f "$env:TEMP/arcade-secret.yaml"
kubectl apply -k infra/k8s/base
kubectl -n arcade get deploy,svc,ingress,hpa
```

The base uses an nginx ingress for local/general clusters. On EKS, install AWS
Load Balancer Controller and override the ingress class and annotations in an
environment overlay.

## AWS starter

See `aws/README.md`. At minimum, use remote encrypted Terraform state, review
the plan and cost, protect production stateful resources, create service-owned
RDS roles/databases, and connect Kubernetes workloads through Pod Identity
rather than long-lived AWS keys.

## GitHub Actions configuration

- `ci.yml` runs npm install, typecheck, tests, build, Compose rendering,
  Kustomize rendering, and Terraform formatting/validation.
- `images.yml` builds each workspace, scans with Trivy, and publishes only on
  `main` or an explicitly approved manual invocation.
- `deploy.yml` runs only when the selected GitHub Environment has
  `DEPLOY_ENABLED=true` and the operator types `deploy`. Add required reviewers
  to that Environment.

The deployment Environment must define `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`,
`EKS_CLUSTER_NAME`, `ECR_REGISTRY`, `POSTGRES_HOST`, `KAFKA_BROKERS`, and
`REDIS_URL`. Configure GitHub's OIDC provider and restrict the role trust policy
to this repository, workflow/environment, and branch. Store application secrets
in AWS Secrets Manager; do not add them as repository files or workflow text.
