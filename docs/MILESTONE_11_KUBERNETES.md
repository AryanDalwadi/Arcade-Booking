# Milestone 11: Kubernetes

## Goal

Describe **how the lunchboxes run as a group**: copies, names, a front door,
and health checks during a rolling update.

Docker packed each service. CI tagged the image with a git SHA. Kubernetes
**keeps the desired number of those images running**. This milestone is
manifests and rendering. It does not create an AWS cluster.

## Manager vs one tray

```text
Compose (laptop)     = one tray on one table
Kubernetes (cluster) = a manager: restart, scale, roll out a new SHA
```

| Word | Easy meaning |
| --- | --- |
| **Pod** | One running box |
| **Deployment** | “Keep 2 booking pods on this image SHA” |
| **Service** | Internal DNS: `http://booking:4103` |
| **Ingress** | Front door: only **web** and **gateway** |
| **Probe** | Health: starting / ready for traffic / still alive |
| **PDB** | Do not evict the last healthy copy |

## Files

| File | Role |
| --- | --- |
| `infra/k8s/base/workloads.yaml` | Deployments + Services, probes, non-root, `/tmp` |
| `infra/k8s/base/ingress.yaml` | Public paths `/` → web, `/api` → gateway |
| `infra/k8s/base/configmap.yaml` | Non-secret URLs; `MIGRATE_ON_START=false` |
| `infra/k8s/base/secret.template.yaml` | Copy outside git; never applied from Kustomize |
| `infra/k8s/base/pdb.yaml` | Keep at least one pod during drains |
| `infra/k8s/base/networkpolicy.yaml` | Default deny; gateway → domain HTTP |
| `infra/k8s/base/migrate.template.yaml` | One-off Job, not every replica |
| `infra/k8s/policy.test.mjs` | No `:latest`, no public booking, placeholders only |

Postgres, Kafka, and Redis stay **outside** the cluster in this design
(managed services later). The ConfigMap points at `*.example.internal` hosts.

## Three probes (do not mix them)

| Probe | Question | Arcade mapping |
| --- | --- | --- |
| **Startup** | Still booting? | `/health/live` — wait, do not kill yet |
| **Readiness** | Send traffic? | `/health/ready` (gateway: `/health`) — **503 while draining** |
| **Liveness** | Deadlocked? | `/health/live` — stays 200 during drain |

If liveness used the drain URL, Kubernetes would **kill the pod mid-request**.
That is why the gateway gained `/health/live`.

`terminationGracePeriodSeconds: 20` is the cluster’s version of Compose
`stop_grace_period: 12s`.

## Immutable image

Kustomize sets `newTag: replace-me-with-git-sha`, not `latest`. A real overlay
substitutes the SHA CI already built. Rebuilding a different image for “prod”
is the failure mode Milestone 10 warned about.

## How to verify (no cluster required)

```powershell
npm run test:policies
kubectl kustomize infra/k8s/base
```

The second command only **prints YAML**. It does not apply anything.

Optional on Docker Desktop Kubernetes / kind:

```powershell
kubectl apply --dry-run=client -k infra/k8s/base
```

Do not `kubectl apply` to AWS from this milestone.

The arcade UI on http://localhost:3000 is still Compose. Kubernetes is the
**paper plan** for the same images.

## What is still not a deployed platform

- No live EKS/kubeadm cluster is claimed
- Image names still contain `OWNER` until an overlay
- HPAs need metrics-server
- Ingress needs a controller (`ingressClassName: nginx`)
- Secrets must be created from the template **outside git**

## Interview answer

> Kubernetes runs the arcade images: a Deployment pins an immutable SHA and
> replica count, a Service gives DNS, and Ingress exposes only the web app and
> gateway. Startup, readiness, and liveness probes are different: readiness
> fails while the process drains, liveness stays up so the pod is not killed.
> I keep migrations as a Job, secrets out of git, and Postgres/Kafka/Redis
> managed rather than in-cluster. Manifests are the learning target; rendering
> them is not the same as operating a cluster.
