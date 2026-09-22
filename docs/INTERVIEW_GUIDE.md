# Arcade Platform Interview Guide

Use this with `LEARNING_ROADMAP.md`. Each topic has the same evidence-oriented
shape: definition, project reason, flow, risks, practice, checks, and a concise
spoken answer. The platform described here is a target learning architecture.
Do not say Docker, Kubernetes, AWS, or any other infrastructure is deployed
unless you have personally verified and can demonstrate it.

## Project summary

> I am evolving an arcade administration application into a TypeScript learning
> platform with explicit domain boundaries. The target design has a React client
> calling one API gateway; identity, catalog, booking, and payment own their
> behavior and PostgreSQL data. Versioned Kafka events allow notification and
> analytics to react asynchronously, with an outbox, idempotent consumers, and
> dead-letter handling. Redis is for temporary concerns such as rate limits,
> cache entries, holds, and idempotency results. Docker, CI/CD, Kubernetes, and
> an AWS mapping are staged learning milestones, not claims of a live production
> deployment. I can explain where each tool helps, where it fails, and when a
> simpler modular monolith would be the better choice.

## 1. Monorepo and TypeScript

**Definition:** A monorepo versions related deployable units and libraries in
one repository. TypeScript statically checks JavaScript source before emitting
JavaScript.

**Why here:** The client, gateway, services, and contracts change together.
Atomic changes and a shared strict baseline catch contract mistakes early while
explicit package entry points preserve ownership.

**Flow:** Workspace dependency graph → package type-check/build → exported
contract → consuming package → affected CI checks.

**Trade-offs and failure modes:** Builds may become slow; shared libraries can
couple services; editor aliases may not resolve at runtime; types do not validate
untrusted JSON.

**Practical exercise:** Break a required field in a shared booking contract and
observe consumer type errors, then reject malformed runtime JSON.

**Verification checklist:**

- [ ] Clean workspace install, type-check, and build succeed.
- [ ] Consumers use public package exports only.
- [ ] Boundary payloads have runtime validation.

**60–90 second answer:**

> I use a monorepo because the arcade client, gateway, services, and contracts
> are related but remain separately deployable. It gives one dependency graph,
> reproducible installs, and atomic contract updates. TypeScript catches
> mismatched fields, invalid API usage, and unsafe null handling before runtime.
> Each package still owns its build and public interface, and a service never
> imports another service's domain implementation. That protects against the
> main monorepo risk: creating a distributed monolith through shared code. I
> share only versioned contracts and small infrastructure utilities, and CI can
> test affected packages to manage build time. Static types are not runtime
> security, so incoming HTTP and Kafka data is validated at the boundary before
> typed domain code uses it.

## 2. React with TypeScript

**Definition:** React composes state-driven UI components; TypeScript defines
safe props, state, forms, and API results.

**Why here:** Typed booking and staff workflows need reusable screens, explicit
async states, and one gateway-facing client.

**Flow:** Route → typed query → loading/error/data render → validated command →
cache invalidation or refresh.

**Trade-offs and failure modes:** Global-state sprawl, stale availability,
duplicate submissions, inaccessible controls, and optimistic updates without
rollback.

**Practical exercise:** Build a booking form that handles loading, validation,
`409 Conflict`, retry, and success.

**Verification checklist:**

- [ ] All async states and keyboard paths are tested.
- [ ] The browser knows only one gateway base URL.
- [ ] The server, not UI state, decides booking availability.

**60–90 second answer:**

> React with TypeScript fits the arcade frontend because booking and operations
> screens benefit from reusable components, typed forms, and explicit state. A
> route loads a feature, calls a typed gateway client, renders loading, empty,
> error, and success states, and refreshes server data after a command. I keep
> local state close to its component and add shared state only when multiple
> features genuinely need it. The browser calls one configurable gateway URL,
> not individual services. TypeScript catches UI and contract mismatches, but it
> cannot make a stale availability result current. The service remains
> authoritative and the UI treats a booking conflict as an expected outcome.
> I also design for keyboard access, request cancellation, duplicate submission,
> and rollback when an optimistic update fails.

## 3. API Gateway

**Definition:** A gateway is the public reverse proxy and policy boundary for
internal APIs.

**Why here:** Clients get one stable endpoint for routing, authentication, CORS,
rate limiting, request limits, correlation IDs, and versioning.

**Flow:** HTTPS request → edge policy → route lookup → timed upstream call →
normalized response and structured telemetry.

**Trade-offs and failure modes:** Bottleneck, single failure domain, retry
amplification, socket exhaustion, and domain logic leaking into the edge.

**Practical exercise:** Stop an upstream service and verify a bounded timeout,
safe `503`, and traceable correlation ID.

**Verification checklist:**

- [ ] Gateway replicas are stateless.
- [ ] Unsafe commands are not automatically retried.
- [ ] Services still enforce authorization and domain rules.

**60–90 second answer:**

> The API gateway gives arcade clients one stable endpoint while internal
> services can change location or scale independently. It centralizes edge
> concerns: TLS, CORS, authentication, rate limits, request size limits,
> correlation IDs, and versioned routing. It forwards identity context, but
> each service still authorizes access and applies its own business rules. I
> deliberately keep booking and payment decisions out of the gateway so it does
> not become a second monolith. The risks are bottlenecks, a shared failure
> point, hanging upstream calls, and retry storms. I address those with
> stateless replicas, health checks, strict timeouts, limited retries only for
> safe operations, and idempotency keys for commands. Route latency, errors, and
> correlation IDs make failures traceable to the responsible service.

## 4. Microservices and arcade bounded contexts

**Definition:** A microservice is an independently deployable process aligned to
a bounded context with its own model and language.

**Why here:** Identity, catalog, booking, payment, notification, and analytics
have different rules, failure tolerance, and scaling patterns.

**Flow:** Gateway command/query → owning context → owner data transaction →
response and/or domain event → independent consumers.

**Trade-offs and failure modes:** Network latency, partial failures, chatty
boundaries, eventual consistency, duplicated rules, and operational overhead.

**Practical exercise:** Create a context map assigning every command, event, and
table to exactly one owner.

**Verification checklist:**

- [ ] Services build and start independently.
- [ ] No cross-service database writes exist.
- [ ] Sync and async interactions have explicit failure behavior.

**60–90 second answer:**

> I split services by arcade capabilities, not by controllers, business logic,
> and data layers. Identity owns users, catalog owns machine descriptions,
> booking owns reservations and slot rules, payment owns charges, and
> notification and analytics react to events. The owner handles a command,
> changes only its data, and publishes facts other contexts can consume. This
> supports independent deployment and prevents a notification outage from
> rejecting a valid booking. It also introduces latency, partial failure,
> eventual consistency, contract evolution, and more operational work. I would
> normally start a small team with a modular monolith and extract a context only
> when autonomy, scaling, or isolation justifies it. The microservice layout in
> this project is a deliberate learning model, not an assumption that smaller
> services are automatically better.

## 5. PostgreSQL and service data ownership

**Definition:** PostgreSQL is an ACID relational database. Service ownership
means only the owning service writes its schema or database.

**Why here:** Booking and payment require constraints, transactions, indexes,
auditing, and safe concurrent updates.

**Flow:** Validate command → acquire pooled connection → short transaction with
constraint/lock → commit domain row plus outbox → release connection.

**Trade-offs and failure modes:** Lock contention, connection exhaustion, poor
indexes, unsafe rolling migrations, and accidental coupling through shared
tables.

**Practical exercise:** Race two requests for one machine and slot; prove a
database invariant permits only one.

**Verification checklist:**

- [ ] SQL is parameterized and pools/timeouts are bounded.
- [ ] Every table has one service owner.
- [ ] Migrations use backward-compatible expand-and-contract steps.

**60–90 second answer:**

> PostgreSQL is authoritative for bookings and payments because those domains
> need ACID transactions, constraints, joins, and reliable concurrency control.
> A booking command uses a short transaction and a database-enforced invariant,
> such as an exclusion or unique constraint, so concurrent requests cannot both
> reserve the same machine and slot. The transaction also records an outbox row.
> Each service is the only writer to its data; other services call its API or
> consume events and create local projections. That keeps schema evolution
> independent and prevents rules being bypassed through shared tables. I use
> parameterized queries, bounded pools, statement timeouts, and indexes justified
> by query plans. Main risks are locks, exhausted connections, and incompatible
> migrations, addressed with short work and expand-and-contract releases.

## 6. Kafka, event-driven design, outbox, idempotency, and DLQ

**Definition:** Kafka is a partitioned durable log. The outbox prevents lost
database/event dual writes, idempotency makes duplicate delivery harmless, and a
DLQ isolates records that exceed bounded retry policy.

**Why here:** One booking fact can independently drive notification and
analytics without extending booking response time.

**Flow:** Booking + outbox commit → publisher → keyed Kafka partition → schema
validation → idempotent consumer transaction → offset commit; bounded failures
go to DLQ and controlled replay.

**Trade-offs and failure modes:** Eventual consistency, ordering only per
partition, hot keys, duplicates, poison messages, schema breaks, and neglected
DLQs.

**Practical exercise:** Deliver one event twice, send one malformed event to a
DLQ, then repair and replay it.

**Verification checklist:**

- [ ] Outbox and domain changes commit atomically.
- [ ] Consumers prove duplicate-safe final state.
- [ ] DLQ depth, ownership, metadata, and replay procedure are defined.

**60–90 second answer:**

> Kafka lets booking publish `BookingCreatedV1` once while notification and
> analytics process it independently. Booking stores its state and an outbox
> row in one PostgreSQL transaction, then a publisher sends that event to a
> topic keyed by booking ID. This avoids committing a booking while losing its
> event. Kafka delivery is at least once, so each consumer validates the version
> and records the event ID atomically with its local update; a duplicate has the
> same final result. Transient failures retry with bounded backoff. Malformed or
> permanently failing records move to a dead-letter topic with topic, partition,
> offset, error, and correlation metadata for explicit repair and replay. The
> costs are eventual consistency, schema governance, partition planning, and
> operating retries and DLQs.

## 7. Redis

**Definition:** Redis is a low-latency in-memory data store supporting atomic
operations, counters, and key expiration.

**Why here:** It fits rate limits, cache-aside reads, temporary checkout holds,
and idempotency results; PostgreSQL remains authoritative.

**Flow:** Namespaced key lookup → hit or owner-database fallback → bounded TTL;
writes change the source of truth then invalidate cache.

**Trade-offs and failure modes:** Stale entries, eviction, hot keys, stampedes,
failover loss, and locks expiring before work completes.

**Practical exercise:** Cache machine details and create a TTL hold, then stop
Redis and demonstrate safe behavior.

**Verification checklist:**

- [ ] Keys have owners, namespaces, and TTL policy.
- [ ] Cache miss and outage paths are tested.
- [ ] No hold or cache entry can bypass booking constraints.

**60–90 second answer:**

> Redis handles low-latency temporary concerns in the arcade platform: gateway
> rate-limit counters, cache-aside machine details, short checkout holds, and
> idempotency results. Keys are namespaced and generally expire. On a cache miss,
> the owner loads PostgreSQL and repopulates Redis; a successful write changes
> PostgreSQL first and invalidates the cache. Redis is not the booking source of
> truth because data may expire, be evicted, or disappear during an outage. The
> database constraint still decides whether a reservation succeeds. Important
> failures include stale values, hot keys, cache stampedes, and a lock expiring
> while work continues. I use jittered TTLs, atomic operations, stampede
> protection where justified, and an explicit fail-open or fail-closed policy
> for each feature.

## 8. Twelve-Factor applications

**Definition:** Twelve-Factor is a set of practices for portable, disposable,
stateless services with external configuration and attached backing resources.

**Why here:** One arcade build should run with different local or target
environment configuration without source changes.

**Flow:** Immutable build → release configuration → stateless run process →
stdout telemetry → graceful drain; migrations run as one-off tasks.

**Trade-offs and failure modes:** Configuration drift, secret leakage, slow
startup, ignored termination, and shifting all persistence pressure to backing
services.

**Practical exercise:** Run one artifact with two configurations and terminate
it during requests to prove draining.

**Verification checklist:**

- [ ] Startup validates required configuration without logging secrets.
- [ ] Logs are structured stdout/stderr streams.
- [ ] The process starts quickly and handles shutdown.

**60–90 second answer:**

> Twelve-Factor practices make an arcade service portable between a laptop,
> container, and future cluster. Dependencies are declared, configuration and
> backing-service locations are supplied at release time, and the same immutable
> build is promoted. Processes are stateless, bind their own port, start
> quickly, stream structured logs to stdout, and react to termination by
> becoming unready and draining requests. Schema migrations run as explicit
> one-off tasks rather than secretly from every replica. This supports scaling
> and repeatability, but environment variables are not a secret manager and all
> configuration still needs validation. Statelessness also does not eliminate
> state; it transfers durable responsibility to PostgreSQL, Kafka, Redis, or
> object storage. Those backing services need capacity, availability, and
> ownership plans.

## 9. Docker

See the hands-on guide: [Milestone 9 Docker](./MILESTONE_09_DOCKER.md).

**Definition:** Docker builds layered immutable images and runs isolated
processes from them.

**Why here:** One image per deployable unit makes runtime dependencies
repeatable; Compose can support local integration.

**Flow:** Locked install/build stage → minimal runtime stage → immutable tag or
digest → injected config → non-root process with health and shutdown behavior.

**Trade-offs and failure modes:** Large images, leaked build secrets, root
processes, mutable tags, architecture mismatches, and confusing packaging with
orchestration.

**Practical exercise:** Compare single-stage and multi-stage images, scan both,
and run the final image read-only as non-root.

**Verification checklist:**

- [ ] Final images contain no source secrets or build tools.
- [ ] Images are traceable to a commit and digest.
- [ ] Health, logs, and termination work locally.

**60–90 second answer:**

> Docker packages each arcade component with a predictable runtime. My target
> build uses multiple stages: a builder installs locked dependencies and
> compiles TypeScript, while the final image contains only production output and
> runs as a non-root user. Environment configuration and secrets are injected at
> runtime, logs go to stdout, and health and termination behavior are explicit.
> Images are identified by commit SHA or digest rather than a mutable `latest`
> tag, making promotion and rollback traceable. Common failures are oversized
> contexts, poor layer caching, accidentally copied credentials, root execution,
> native dependency architecture differences, and unnecessary tooling in the
> runtime image. Docker solves packaging and local repeatability; it does not by
> itself provide scheduling, service discovery, failover, or production
> deployment.

## 10. CI/CD

See the hands-on guide: [Milestone 10 CI/CD](./MILESTONE_10_CICD.md).

**Definition:** CI continuously validates changes; delivery creates a releasable
artifact; deployment promotes it to an environment.

**Why here:** Automated type, contract, migration, image, and security checks
protect many service boundaries.

**Flow:** Lint/type/test → integration and contract checks → build/scan/attest
once → digest promotion → compatible migration and rollout → health decision.

**Trade-offs and failure modes:** Flaky or slow checks, artifact rebuilding,
overprivileged credentials, unsafe database rollback, and green pipelines that
miss user-visible failure.

**Practical exercise:** Break a contract and migration and prove required checks
block the proposed release.

**Verification checklist:**

- [ ] One immutable artifact moves between stages.
- [ ] CI uses short-lived least-privilege credentials.
- [ ] Rollback or roll-forward and migration compatibility are rehearsed.

**60–90 second answer:**

> CI validates arcade changes through linting, TypeScript checks, unit tests,
> contracts, selected integration tests, migration checks, and security scans.
> The delivery pipeline builds an image once, records its digest and provenance,
> and promotes that exact artifact rather than rebuilding in each environment.
> Database changes follow expand-and-contract steps because old and new replicas
> may overlap during a rolling update, and application rollback cannot undo an
> incompatible schema safely. The major risks are flaky checks, slow feedback,
> permanent cloud credentials, and treating deployment completion as proof of
> user success. I use required deterministic gates, short-lived identity,
> release metadata, health signals, and a rehearsed rollback or roll-forward
> path. This describes the intended pipeline; it does not claim the project is
> currently deployed.

## 11. Kubernetes

See the hands-on guide: [Milestone 11 Kubernetes](./MILESTONE_11_KUBERNETES.md).

**Definition:** Kubernetes reconciles declared workload state using resources
such as Deployments, Services, configuration, probes, and Ingress.

**Why here:** It is the target model for independent service scaling and rolling
updates after container fundamentals are proven.

**Flow:** Deployment image → scheduler → startup/readiness gates → Service DNS →
gateway Ingress → rolling update and measured autoscaling.

**Trade-offs and failure modes:** Operational complexity, probe restart loops,
bad resource sizing, public exposure, secret mishandling, and running stateful
systems without expertise.

**Practical exercise:** In a local cluster, fail readiness during a rolling
update and verify traffic avoids the pod.

**Verification checklist:**

- [ ] Probe purposes are distinct and tested.
- [ ] Requests, limits, disruption, and termination are defined.
- [ ] Only the gateway is externally exposed.

**60–90 second answer:**

> Kubernetes is the target orchestrator for arcade containers. A Deployment
> declares immutable images, replicas, resources, and rollout policy; a Service
> gives stable internal discovery; and only the gateway is exposed through
> Ingress or a load balancer. Startup probes cover initialization, readiness
> decides whether traffic reaches a pod, and liveness is reserved for a process
> that cannot recover without restart. Resource requests guide scheduling,
> limits contain consumption, and graceful termination allows rolling updates to
> drain traffic. Kubernetes adds significant complexity in security, capacity,
> probes, and debugging, so I would prefer managed PostgreSQL, Kafka, and Redis
> over casually operating them in-cluster. The project can validate manifests
> and use a local cluster, but I would not say it is deployed without verified
> infrastructure and operational evidence.

## 12. AWS target architecture

See the hands-on guide: [Milestone 12 AWS](./MILESTONE_12_AWS.md).

**Definition:** The target uses EKS compute, ECR images, RDS PostgreSQL, MSK
Kafka, ElastiCache Redis, S3 objects, IAM authorization, VPC networking, ALB
ingress, and CloudWatch observability.

**Why here:** Managed AWS services map the learned components to a resilient
cloud design while retaining clear responsibility boundaries.

**Flow:** Federated CI → ECR → private multi-AZ EKS → ALB gateway; IAM roles and
security groups authorize private access to RDS/MSK/ElastiCache/S3; CloudWatch
collects telemetry.

**Trade-offs and failure modes:** Cost, quotas, broad IAM, public resources,
connection storms, cross-AZ/NAT charges, noisy logs, and untested recovery.

**Practical exercise:** Produce a target diagram, security-group matrix, IAM
policy list, recovery assumptions, alarms, and cost estimate without provisioning.

**Verification checklist:**

- [ ] Every named AWS service has one justified responsibility.
- [ ] Network, identity, encryption, backup, and restore are explicit.
- [ ] All infrastructure status is labeled proposed, local, or verified.

**60–90 second answer:**

> The AWS target maps the arcade platform to managed services. ECR stores
> immutable images; EKS runs the gateway and services; RDS provides PostgreSQL;
> MSK provides Kafka; ElastiCache provides Redis; and S3 stores exports,
> receipts, or static objects. An ALB exposes only the gateway, while workloads
> and data services remain in private VPC subnets across availability zones.
> IAM roles for service accounts grant least-privilege, short-lived access, and
> security groups permit only required paths. CloudWatch gathers logs, metrics,
> dashboards, and actionable alarms. Managed does not mean maintenance-free:
> capacity, connection storms, backups, restore tests, failover, quotas, and
> NAT, cross-AZ, and telemetry costs remain my responsibility. This is a target
> architecture and I would not present it as deployed.

## 13. SQL vs NoSQL and DynamoDB analytics projection

See the hands-on guide: [Milestone 13 SQL vs DynamoDB](./MILESTONE_13_DYNAMODB.md).

**Definition:** SQL databases optimize relational integrity and flexible
transactions; DynamoDB optimizes predefined key-value/document access patterns.
A projection is a rebuildable derived read model.

**Why here:** PostgreSQL owns transactional booking truth. DynamoDB is considered
only for a high-volume denormalized analytics view such as daily utilization.

**Flow:** PostgreSQL commit → Kafka event → idempotent analytics consumer →
DynamoDB key/index update → eventually consistent dashboard with freshness →
reconciliation or replay.

**Trade-offs and failure modes:** Hot partitions, scans, index cost, duplicated
data, lag, out-of-order events, drift, and unjustified polyglot persistence.

**Practical exercise:** Design keys from two named utilization queries, process
duplicate/out-of-order events, and rebuild the table.

**Verification checklist:**

- [ ] PostgreSQL remains the source of truth.
- [ ] Every DynamoDB index serves a named access pattern.
- [ ] Lag, reconciliation, replay, and cost are measurable.

**60–90 second answer:**

> I choose storage based on invariants and access patterns. PostgreSQL owns
> bookings and payments because they require constraints, flexible queries, and
> multi-row transactions. DynamoDB is justified only as a derived analytics
> projection, such as daily machine utilization by venue at high read volume. A
> Kafka consumer performs idempotent conditional updates to denormalized items,
> and the dashboard exposes projection freshness because updates are eventually
> consistent. Partition and sort keys, plus any secondary indexes, are designed
> from named queries rather than added speculatively. The view can be reconciled
> and rebuilt from retained events or an authoritative export. Risks include hot
> keys, expensive scans and indexes, duplicate or out-of-order events, and
> operational overhead. I add NoSQL only when that access pattern outweighs the
> simplicity of PostgreSQL.

## Common follow-up questions

**Why not call notification directly?** A notification outage should not reject
a valid booking. Kafka buffers a committed fact and supports independent retry.

**How do you avoid duplicate charges?** Require an idempotency key, store it with
the payment result under a unique constraint, and return the original result for
repeated requests.

**How do you trace a request?** The gateway creates or forwards a correlation ID;
HTTP requests, event metadata, and structured logs carry it. Causation IDs link
follow-on events.

**How do you evolve events?** Prefer additive optional fields for compatible
change. Use an explicit new event version for breaking semantics and support a
measured consumer migration window.

**How do you secure services?** Validate untrusted input, parameterize SQL,
authenticate at the edge, authorize in the owner service, encrypt traffic and
data, rotate secrets, isolate networks, use least-privilege IAM, and retain
auditable security events.

**What would you build first?** A modular monolith with PostgreSQL and clear
module boundaries, then the typed client and gateway. I would extract services,
Kafka, Redis, Kubernetes, and cloud resources only when the learning objective
or measured operational need justifies their cost.
