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
- `aws/` is a Terraform **proposed map** (EKS, ECR, RDS, MSK, ElastiCache).
  Milestone 12 does not apply it.
- `.github/workflows/` runs lockfile CI, SHA-tagged image builds, and
  a manually gated deployment skeleton that stays off until you enable it.

## Local dependencies

From the repository root:

```powershell
# Validate interpolation and the complete Compose model.
docker compose -f infra/docker-compose.yml config

# Start only stateful dependencies (works before app workspaces are created).
docker compose -f infra/docker-compose.yml up -d postgres kafka kafka-init redis mailhog
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

These manifests are a learning target. Rendering them does not deploy a cluster.

```powershell
# Print the combined YAML only.
kubectl kustomize infra/k8s/base

# Client-side validation. Does not contact a cluster.
kubectl apply --dry-run=client -k infra/k8s/base
```

Before a real deployment:

1. Replace `OWNER` and `replace-me-with-git-sha` in an overlay with the image
   registry and the git SHA CI already built. Do not promote `:latest`.
2. Replace ConfigMap endpoint placeholders with managed service endpoints.
3. Copy `secret.template.yaml` outside version control, replace every value, and
   apply it, or use External Secrets/Secrets Store CSI. The template is
   intentionally excluded from Kustomize.
4. Run SQL as a Job from `migrate.template.yaml`. Replicas set `MIGRATE_ON_START=false`.
5. Install metrics-server for HPA metrics and an ingress controller.
6. Confirm probes: gateway `/health/live` vs `/health`; services `/health/live`
   vs `/health/ready`.

```powershell
Copy-Item infra/k8s/base/secret.template.yaml "$env:TEMP/arcade-secret.yaml"
# Edit the temporary file, then:
kubectl apply -f "$env:TEMP/arcade-secret.yaml"
kubectl apply -k infra/k8s/base
kubectl -n arcade get deploy,svc,ingress,hpa,pdb,netpol
```

The base uses an nginx ingress for local/general clusters. On EKS, install AWS
Load Balancer Controller and override the ingress class and annotations in an
environment overlay. Postgres, Kafka, and Redis are not in-cluster workloads.

## AWS map

See [Milestone 12](../docs/MILESTONE_12_AWS.md) and `aws/README.md`. Validate
with `terraform validate`. Do not apply from the learning path.

## GitHub Actions configuration

- `ci.yml` runs `npm ci`, typecheck, tests, build, Compose rendering,
  Kustomize rendering (rejects `:latest`), and Terraform formatting/validation.
- `images.yml` builds each workspace, tags the git SHA, scans with Trivy, and
  publishes only when `PUBLISH_IMAGES` and a manual `publish` input are set.
- `deploy.yml` runs only when the selected GitHub Environment has
  `DEPLOY_ENABLED=true` and the operator types `deploy`. Add required reviewers
  to that Environment.

The deployment Environment must define `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`,
`EKS_CLUSTER_NAME`, `ECR_REGISTRY`, `POSTGRES_HOST`, `KAFKA_BROKERS`, and
`REDIS_URL`. Configure GitHub's OIDC provider and restrict the role trust policy
to this repository, workflow/environment, and branch. Store application secrets
in AWS Secrets Manager; do not add them as repository files or workflow text.
