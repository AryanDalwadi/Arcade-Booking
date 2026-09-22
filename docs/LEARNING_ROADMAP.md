# Arcade Platform Learning Roadmap

This roadmap grows the arcade booking project through 13 independently
verifiable milestones. Complete the exercise and checklist before moving on.
The target architecture is a learning design: Docker, Kubernetes, AWS, and the
other infrastructure described below are not claimed to be deployed.

## 1. Monorepo and TypeScript

### Definition

A monorepo stores related applications, services, and shared libraries in one
versioned repository. TypeScript adds static types to JavaScript and compiles to
JavaScript. Project references, package boundaries, and a shared base
configuration keep builds predictable without turning every package into one
coupled application.

### Why this project uses it

The web client, gateway, domain services, and contract package evolve together.
A monorepo makes an event or API contract change visible to all consumers in one
change set. TypeScript catches mismatched payloads, missing fields, and unsafe
null handling before runtime. Shared code should be limited to contracts and
small platform utilities; domain behavior remains inside its owning service.

### Flow

1. A workspace command selects packages from the root dependency graph.
2. TypeScript checks each package against the shared strict defaults.
3. Package-specific configuration emits its own build output.
4. Applications import published workspace contracts, not another service's
   internal source.
5. CI restores dependencies once and runs affected lint, test, and build tasks.

### Trade-offs and failure modes

- One repository simplifies atomic changes but can create slow pipelines.
- Shared libraries can accidentally couple independently deployable services.
- Path aliases may work in the editor but fail at runtime if package exports are
  wrong.
- A single lockfile improves reproducibility but dependency upgrades can affect
  many packages.
- TypeScript checks types, not untrusted runtime input; validate network data.

### Practical exercise

Create a typed `BookingCreatedV1` contract, consume it from two packages, then
intentionally remove a required field. Confirm both consumers fail type-checking.
Add runtime validation for a malformed JSON payload to show the boundary between
compile-time and runtime safety.

### Verification checklist

- [ ] A clean install and workspace build succeed from the repository root.
- [ ] Strict TypeScript checking is enabled and emits no errors.
- [ ] Packages expose explicit entry points instead of importing private files.
- [ ] Contract changes fail affected consumers during type-checking.
- [ ] Invalid external JSON is rejected by runtime validation.

### 60–90 second interview answer

> I use a monorepo because the arcade UI, gateway, services, and contracts are
> related but separately deployable units. It gives one dependency graph,
> reproducible installs, and atomic contract changes, while TypeScript catches
> payload and API mismatches before runtime. Each package still owns its build
> and public API; services do not import one another's domain implementation.
> That boundary matters because a monorepo can easily become a distributed
> monolith through shared code. I reserve shared packages for versioned
> contracts and small infrastructure utilities. CI can test only affected
> packages to control build time. TypeScript is not runtime validation, so HTTP
> and Kafka payloads are validated when they enter the system.

## 2. React with TypeScript

### Definition

React builds interfaces from components whose rendered output follows state.
TypeScript describes props, component state, form values, and API results.
Routing maps URLs to screens, while server-state tools or Redux Toolkit manage
data that must be shared beyond a component.

### Why this project uses it

Customers need to browse machines, see availability, create bookings, and view
payment status. Staff need typed forms and operational views. React supports
composable screens, and TypeScript keeps UI assumptions aligned with gateway
contracts. The browser calls one gateway URL and never needs service locations.

### Flow

1. A route loads a feature page.
2. The page requests data from a typed gateway client.
3. Loading, success, empty, and error states render explicitly.
4. A validated form sends a command with an idempotency key when appropriate.
5. The client invalidates or refreshes stale server state after success.

### Trade-offs and failure modes

- Excess global state makes ownership and updates hard to reason about.
- Client validation improves usability but never replaces server validation.
- Optimistic updates can display false success unless rollback is implemented.
- Stale caches can show unavailable machines; booking must be confirmed by the
  server.
- Broad component re-renders, inaccessible controls, and unhandled request
  cancellation degrade the experience.

### Practical exercise

Build a typed availability page and booking form with loading, empty, validation,
conflict, retry, and success states. Simulate two users selecting the same slot;
show a useful `409 Conflict` response rather than trusting client-side state.

### Verification checklist

- [ ] Props, form values, and gateway responses have explicit types.
- [ ] Routes and keyboard-accessible controls work.
- [ ] Loading, empty, error, conflict, and success states are testable.
- [ ] The UI uses one configurable gateway base URL.
- [ ] Duplicate submission is prevented or safely retried.

### 60–90 second interview answer

> The arcade frontend is a React TypeScript SPA because its booking and staff
> workflows benefit from reusable components, typed forms, and explicit state.
> A feature page calls a typed client through one API gateway URL, renders
> loading and failure states, and refreshes server state after a command.
> TypeScript catches incorrect props and contract usage, but the server remains
> authoritative: availability can change after the UI reads it, so booking
> conflicts are handled as normal responses. I keep local UI state near the
> component and use shared state only when multiple routes need it. The main
> risks are stale data, overgrown global state, inaccessible controls, and
> duplicate submissions, addressed with invalidation, focused stores,
> accessibility tests, and idempotent commands.

## 3. API Gateway

### Definition

An API gateway is the public entry point that routes client requests to internal
services. It centralizes edge concerns such as TLS termination, authentication,
CORS, rate limits, request size limits, correlation IDs, and route versioning.

### Why this project uses it

The arcade browser needs one stable API rather than knowledge of identity,
catalog, booking, or payment topology. The gateway can apply consistent edge
policy while services retain authorization and business rules for their data.

### Flow

1. The gateway accepts an HTTPS request and attaches a correlation ID.
2. It enforces CORS, size, authentication, and rate-limit policy.
3. A versioned route maps the request to one internal service.
4. Timeouts and response mapping protect the client from hanging dependencies.
5. Structured logs record route, status, latency, and correlation ID.

### Trade-offs and failure modes

- It is a potential bottleneck and common failure point, so it must be stateless
  and horizontally replicated.
- Domain logic in the gateway creates a difficult-to-change second monolith.
- Retries on non-idempotent commands can duplicate work.
- Missing timeouts can exhaust sockets; generous retries can amplify an outage.
- Authentication at the edge does not remove service-level authorization.

### Practical exercise

Proxy catalog and booking routes through one URL. Add a correlation ID, a short
upstream timeout, per-client rate limiting, and consistent error JSON. Stop the
booking service and verify the gateway fails quickly with a safe `503`.

### Verification checklist

- [ ] Clients know only the gateway URL.
- [ ] Route versions and ownership are documented.
- [ ] Correlation IDs cross the gateway-service boundary.
- [ ] CORS, rate limits, request limits, and upstream timeouts are tested.
- [ ] Gateway code contains no booking or payment decisions.

### 60–90 second interview answer

> The API gateway gives the arcade clients one stable endpoint while internal
> services can move or scale independently. At the edge it handles TLS, CORS,
> authentication, rate limiting, request limits, correlation IDs, and versioned
> routing. It forwards identity context, but each service still authorizes
> operations and owns domain validation. I keep orchestration and booking rules
> out of the gateway so it does not become another monolith. Its main risks are
> becoming a bottleneck, hiding upstream failures, and retrying unsafe commands.
> I address those with stateless replicas, health probes, strict timeouts,
> bounded retries only for safe operations, and idempotency keys. Logs and
> metrics include the route and correlation ID so a request can be traced into
> the responsible service.

## 4. Microservices and Arcade Bounded Contexts

### Definition

A microservice is an independently deployable process aligned to a bounded
context: a domain boundary with its own model and language. For this platform,
candidate contexts are identity, catalog, booking, payment, notification, and
analytics. Inventory may be part of catalog or separate only when its rules and
operational needs justify that boundary.

### Why this project uses it

Booking enforces slot rules, payment handles money and provider interactions,
and notification performs retryable delivery. These capabilities change, fail,
and scale differently. Separating them demonstrates autonomy and failure
isolation, though a modular monolith would be the simpler production starting
point for a small team.

### Flow

1. The gateway sends a command or query to the owning context.
2. That service validates rules and writes only its own data.
3. Immediate information is obtained by HTTP when a response is required.
4. Completed facts are published as events for asynchronous consumers.
5. Correlation and causation IDs connect work across service boundaries.

### Trade-offs and failure modes

- Network calls add latency, partial failure, and versioning concerns.
- Cross-service transactions become sagas or eventually consistent workflows.
- Poor boundaries cause chatty calls and duplicated business rules.
- Shared databases destroy ownership and independent deployment.
- More services increase deployment, observability, security, and test cost.

### Practical exercise

Write a context map assigning commands, data, and events to identity, catalog,
booking, payment, notification, and analytics. Implement one booking flow using
HTTP for an immediate query and an event for notification. Explain why each
interaction style was chosen.

### Verification checklist

- [ ] Every capability and table has one named owner.
- [ ] Services can build and start independently.
- [ ] No service imports another service's domain implementation.
- [ ] Synchronous calls have timeouts and failure behavior.
- [ ] Eventual-consistency states are visible and recoverable.

### 60–90 second interview answer

> I define services around arcade business capabilities rather than technical
> layers. Identity owns users, catalog owns machines and descriptive data,
> booking owns reservations and slot rules, payment owns charges, and
> notification and analytics react asynchronously. A request goes to the
> owning service, which changes only its database and publishes facts for other
> contexts. This allows independent deployment, scaling, and failure isolation;
> for example, notification downtime should not reject a valid booking. The
> cost is network failure, eventual consistency, contract evolution, and much
> more operational work. I would begin with a modular monolith for a small team
> and extract boundaries when justified. This project uses microservices as a
> deliberate learning architecture, not as a claim that more services are
> automatically better.

## 5. PostgreSQL and Service Data Ownership

### Definition

PostgreSQL is a relational database with ACID transactions, constraints,
indexes, MVCC, and rich query support. Service data ownership means one service
is the only writer to its schema or database; other services use APIs, events,
or local projections instead of direct table access.

### Why this project uses it

Bookings and payments need strong invariants, safe concurrency, auditability,
and transactional updates. PostgreSQL can prevent two active bookings for the
same machine and slot. Separate ownership lets services evolve schemas without
silently breaking consumers.

### Flow

1. The service validates an input command.
2. A bounded connection pool opens a transaction.
3. Constraints, conditional writes, or locks enforce the invariant.
4. Domain changes and an outbox row commit atomically.
5. Migrations evolve the owner schema through backward-compatible stages.

### Trade-offs and failure modes

- Strong consistency is local to one database, not the whole platform.
- Long transactions and lock contention reduce throughput.
- Missing indexes cause slow queries; excess indexes slow writes.
- Shared tables couple releases and bypass domain rules.
- Unbounded pools can exhaust database connections.
- Destructive migrations can break old replicas during rolling deployment.

### Practical exercise

Create a booking transaction that prevents overlapping active reservations with
a constraint or lock-safe conditional write. Run concurrent attempts and prove
only one succeeds. Inspect the query plan and add the smallest useful index.

### Verification checklist

- [ ] Concurrent booking attempts cannot both commit.
- [ ] Queries use parameters, never string interpolation.
- [ ] Pools, statement timeouts, and transaction boundaries are bounded.
- [ ] Each schema/table has one service owner.
- [ ] Migrations support both old and new application versions during rollout.

### 60–90 second interview answer

> PostgreSQL is the source of truth for bookings and payments because those
> domains need transactions, constraints, joins, indexes, and reliable
> concurrency control. A booking command runs in one short transaction and uses
> a database-enforced invariant, such as a unique or exclusion constraint, so
> two requests cannot reserve the same machine and slot. The same transaction
> records an outbox event. Each service is the only writer to its data; other
> services consume APIs or events and build their own projections. That avoids
> hidden coupling through shared tables. I use parameterized SQL, bounded pools,
> query timeouts, and measured indexes. The main risks are lock contention,
> connection exhaustion, and unsafe migrations, so migrations follow
> expand-and-contract steps that remain compatible during rolling releases.

## 6. Kafka, Events, Outbox, Idempotency, and DLQ

### Definition

Kafka is a durable, partitioned event log. Producers append immutable events;
consumer groups independently process ordered records within each partition.
The transactional outbox closes the database/event dual-write gap, idempotent
consumers make repeated delivery safe, and a dead-letter topic quarantines
records that cannot be processed after a bounded retry policy.

### Why this project uses it

A committed `BookingCreatedV1` can trigger notification, analytics, and other
reactions without booking depending on those services. A booking ID partition
key preserves order for one aggregate. At-least-once delivery is accepted and
handled explicitly rather than claiming exactly-once business processing.

### Flow

1. Booking and an outbox row commit in one PostgreSQL transaction.
2. An outbox publisher sends the versioned event to Kafka and marks progress.
3. Kafka stores it in a partition selected by booking ID.
4. Each consumer validates the schema and checks a processed-event key.
5. The consumer applies its local change and records completion atomically.
6. Transient failures retry with backoff; poison records go to a DLQ with
   error, topic, partition, offset, and correlation metadata.
7. Operators fix or explicitly replay DLQ records.

### Trade-offs and failure modes

- Consumers see eventual, not immediate, consistency.
- Ordering exists only within a partition, and hot keys limit parallelism.
- Publishing before commit creates phantom events; committing without an outbox
  can lose events.
- A crash after processing but before offset commit causes duplicate delivery.
- Infinite retries block partitions; a DLQ without ownership becomes a graveyard.
- Breaking schema changes can stop old consumers.

### Practical exercise

Implement `BookingCreatedV1` through an outbox publisher and two consumers.
Force duplicate delivery and prove no duplicate notification record is created.
Send an invalid event, observe bounded retries and DLQ metadata, repair it, and
perform a controlled replay.

### Verification checklist

- [ ] Domain state and outbox rows commit atomically.
- [ ] Events have IDs, versions, timestamps, aggregate keys, and correlation IDs.
- [ ] Duplicate delivery produces the same final state.
- [ ] Retries are bounded and distinguish transient from permanent errors.
- [ ] DLQ depth is monitored and replay is an explicit procedure.
- [ ] Consumers tolerate compatible schema evolution.

### 60–90 second interview answer

> Kafka decouples a successful arcade booking from notification and analytics.
> Booking writes its state and a `BookingCreatedV1` outbox row in one PostgreSQL
> transaction, then a publisher delivers that row to a topic keyed by booking
> ID. That avoids the dual-write failure where the database commits but the
> event is lost. Kafka is at-least-once, so consumers store the event ID with
> their local update and safely ignore duplicates. Transient failures use
> bounded backoff; malformed or permanently failing records move to a
> dead-letter topic with enough metadata to diagnose and replay them. The
> trade-offs are eventual consistency, schema governance, ordering only per
> partition, and operational complexity. Immediate commands still use HTTP when
> the caller needs a synchronous result.

## 7. Redis

See the hands-on guide: [Milestone 7 Redis](./MILESTONE_07_REDIS.md).

### Definition

Redis is an in-memory data store with low-latency keys, counters, expirations,
and atomic operations. Cache-aside reads populate Redis on demand; TTLs bound
staleness. It is useful for temporary coordination and acceleration, not as the
authoritative booking ledger.

### Why this project uses it

The gateway can keep rate-limit counters, catalog reads can be cached, booking
can represent short-lived checkout holds, and APIs can remember idempotency
results. PostgreSQL remains authoritative because Redis data may expire, be
evicted, lag behind, or become unavailable.

### Flow

1. A cache read checks a namespaced, versioned key.
2. On a miss, the owner reads PostgreSQL and writes a bounded-TTL value.
3. Writes update PostgreSQL first and invalidate or refresh the cache.
4. Atomic set-if-absent plus TTL creates a temporary hold or idempotency claim.
5. Failure policy chooses safe degradation rather than assuming Redis persists.

### Trade-offs and failure modes

- Cache invalidation can serve stale data.
- Hot keys and cache stampedes overload Redis or the database.
- Distributed locks can expire while work continues and need fencing for strong
  correctness.
- Eviction and failover mean temporary data can disappear.
- Rate-limit fail-open versus fail-closed is a product and security decision.

### Practical exercise

Add cache-aside machine details with TTL and invalidation, then create a
short-lived booking hold using an atomic operation. Stop Redis and verify
catalog reads fall back safely while final booking correctness still comes from
PostgreSQL.

### Verification checklist

- [ ] Every key has a namespace, owner, and TTL where appropriate.
- [ ] Cache miss and Redis outage behavior are tested.
- [ ] Cache stampede protection is considered for popular keys.
- [ ] Holds expire and cannot override PostgreSQL constraints.
- [ ] Idempotency records return the original result for duplicate commands.

### 60–90 second interview answer

> Redis provides fast temporary state for the arcade platform. I use it for
> gateway rate limits, cache-aside catalog reads, short-lived booking holds, and
> idempotency results. Each key is namespaced and usually has a TTL. A cache miss
> falls back to the owning service's PostgreSQL data, and writes update the
> source of truth before invalidating the cache. Redis is not the final booking
> authority because keys can expire, be evicted, or be unavailable; the
> PostgreSQL constraint still prevents double booking. Important failure modes
> are stale cache entries, hot keys, stampedes, and locks expiring mid-operation.
> I use jittered TTLs, request coalescing where needed, atomic operations, and a
> documented fail-open or fail-closed policy for each use case.

## 8. Twelve-Factor Applications

See the hands-on guide: [Milestone 8 Twelve-Factor](./MILESTONE_08_TWELVE_FACTOR.md).

### Definition

The Twelve-Factor methodology describes portable services: one codebase,
declared dependencies, configuration in the environment, attached backing
services, separate build/release/run stages, stateless processes, self-contained
service binding, concurrency through processes, disposability, development/
production parity, log streams, and one-off administrative processes.

### Why this project uses it

The same arcade service should run locally, in a container, or eventually on a
cluster without source edits. External configuration and stateless replicas make
deployments repeatable, while stdout logs and graceful shutdown make services
operable.

### Flow

1. CI creates an immutable artifact from one commit.
2. A release combines that artifact with environment-specific configuration.
3. Stateless processes start quickly and attach to PostgreSQL, Kafka, and Redis.
4. Logs stream to stdout for collection.
5. On termination, a process becomes unready, drains work, and exits cleanly.
6. Migrations run as an explicit one-off task.

### Trade-offs and failure modes

- Environment variables are easy to inject but awkward for large structured
  configuration and are not a secret manager by themselves.
- Statelessness pushes durable state into backing services.
- Environment drift remains possible without configuration validation.
- Slow startup and ignored termination signals cause failed rollouts.

### Practical exercise

Run one service with two configurations using the same build artifact. Validate
required variables at startup, emit structured logs to stdout, and send a
termination signal while requests are active to demonstrate graceful draining.

### Verification checklist

- [ ] No environment-specific values are compiled into the artifact.
- [ ] Required configuration is validated without logging secrets.
- [ ] The process keeps no required state on its local filesystem.
- [ ] Startup and graceful shutdown are tested.
- [ ] Logs are structured stdout/stderr streams.
- [ ] Migrations are explicit one-off commands.

### 60–90 second interview answer

> I apply Twelve-Factor principles so an arcade service behaves consistently
> across a laptop, container, and future cluster. Dependencies are declared,
> configuration and backing-service locations are supplied at release time, and
> the build artifact is immutable. Processes are stateless, bind their own port,
> start quickly, stream structured logs to stdout, and handle termination by
> becoming unready and draining work. Database migrations run as explicit
> one-off tasks rather than secretly at every process startup. The approach
> improves portability and horizontal scaling, but external configuration still
> needs schema validation and secrets need a real secret store. Statelessness
> also does not remove state; it moves durable state to PostgreSQL, Kafka,
> Redis, or object storage with clear ownership.

## 9. Docker

See the hands-on guide: [Milestone 9 Docker](./MILESTONE_09_DOCKER.md).

### Definition

Docker packages an application and its runtime dependencies as a layered,
immutable image. A container is a process created from that image with isolated
filesystem and networking. Compose can define local multi-container dependencies.

### Why this project uses it

One image per deployable arcade unit removes "works on my machine" runtime
differences. Local Compose can provide repeatable development dependencies and
service networking without claiming the platform is deployed.

### Flow

1. A multi-stage build installs locked dependencies, tests/builds, then copies
   only runtime output into a small final image.
2. CI tags the image with an immutable commit identifier.
3. Runtime configuration and secrets are injected, not baked in.
4. The non-root process exposes one port and emits stdout logs.
5. Health checks and graceful shutdown describe container lifecycle.

### Trade-offs and failure modes

- Large contexts and poor layer order make builds slow.
- Mutable tags such as `latest` make rollback and provenance ambiguous.
- Running as root, shipping build tools, or embedding secrets expands risk.
- CPU architecture differences and native modules can break runtime.
- Containers package software; they do not provide orchestration by themselves.

### Practical exercise

Create a multi-stage image for one service, run it as a non-root user, and add a
health check. Compare image contents and size with a single-stage build. Scan it,
stop it gracefully, and run it with no writable application filesystem.

### Verification checklist

- [ ] The build is reproducible from the lockfile.
- [ ] The final image excludes source secrets and build-only dependencies.
- [ ] The process runs as non-root.
- [ ] Images use immutable version or digest references.
- [ ] Health, logs, and termination behavior work locally.

### 60–90 second interview answer

> Docker gives each arcade component a consistent runtime from development
> through a future deployment. I use a multi-stage build: the builder installs
> locked dependencies and compiles TypeScript, while the final image contains
> only production output and runs as a non-root user. Configuration and secrets
> arrive at runtime, logs go to stdout, and the process handles health checks and
> termination signals. Images are tagged with a commit SHA or referenced by
> digest so the released artifact is traceable and rollback is deterministic.
> Common failures are huge build contexts, leaked secrets, mutable tags,
> architecture-specific dependencies, and bloated images with unnecessary
> tools. Docker solves packaging, not scheduling or high availability; Compose
> is useful for repeatable local integration, while orchestration is a separate
> concern.

## 10. CI/CD

### Definition

Continuous integration automatically validates each change. Continuous delivery
produces a deployable, versioned artifact and keeps promotion automated;
continuous deployment additionally promotes every passing change without a
manual gate.

### Why this project uses it

The arcade platform has many contract and service boundaries. A pipeline can
catch type, test, migration, image, and security failures before integration,
then promote the same artifact instead of rebuilding differently per environment.
This roadmap designs that pipeline; it does not claim a live deployment.

### Flow

1. A change runs formatting, lint, type checks, unit tests, and secret scanning.
2. Integration and contract tests start real dependencies where valuable.
3. Images are built once, scanned, signed or attested, and stored by digest.
4. A release promotes that digest through environments with approvals as needed.
5. Backward-compatible migrations precede application rollout.
6. Health signals decide success; rollback or roll-forward uses the same audit
   trail.

### Trade-offs and failure modes

- Slow or flaky pipelines train teams to bypass checks.
- Rebuilding at promotion time creates untested artifacts.
- Shared credentials and overly broad CI permissions increase supply-chain risk.
- Forward-only database changes may make application rollback unsafe.
- Deployment success does not prove user-visible correctness.

### Practical exercise

Build a local or hosted pipeline that lints, type-checks, tests, builds one image,
scans dependencies and the image, and records an immutable digest. Deliberately
break a contract and a migration to prove the release is blocked.

### Verification checklist

- [ ] Required checks block merge or release on failure.
- [ ] Tests are deterministic and flaky checks have owners.
- [ ] One immutable artifact is promoted, not rebuilt.
- [ ] CI credentials are short-lived and least privilege.
- [ ] Migration compatibility and rollback/roll-forward are rehearsed.
- [ ] Release metadata maps artifact, commit, tests, and approver.

### 60–90 second interview answer

> CI validates every arcade change with linting, TypeScript checks, unit,
> contract, and selected integration tests. It also checks migrations, scans
> dependencies and images, and prevents a release when a required check fails.
> The pipeline builds each image once, identifies it by digest, and promotes that
> exact artifact rather than rebuilding for each environment. Delivery can use
> approvals, while a mature low-risk path might deploy automatically. Database
> changes use expand-and-contract compatibility because rolling replicas may run
> different versions and rollback may otherwise fail. I watch for flaky tests,
> slow pipelines, permanent cloud credentials, and false confidence from a
> green deployment. Health metrics, audit metadata, and a rehearsed rollback or
> roll-forward strategy complete the release process. This is the intended
> pipeline design, not a claim that production deployment exists.

## 11. Kubernetes

### Definition

Kubernetes reconciles declared workload state. Deployments manage stateless
replicas, Services provide discovery, ConfigMaps and Secrets inject
configuration, probes control traffic and restart behavior, and Ingress or a
cloud load balancer exposes selected routes.

### Why this project uses it

The target design needs independent scaling and rolling updates for the gateway
and arcade services. Kubernetes provides a common operational model, but it is
introduced only after containers and service boundaries are understood. No
cluster deployment is asserted by this guide.

### Flow

1. A Deployment references an immutable image and desired replica count.
2. The scheduler places pods using resource requests and constraints.
3. Startup and readiness probes keep unready pods out of Service endpoints.
4. Traffic reaches the gateway through Ingress; services use internal DNS.
5. Rolling updates replace pods while respecting availability limits.
6. Autoscaling and operators react to measured demand and failures.

### Trade-offs and failure modes

- Kubernetes adds control-plane and operational complexity.
- Wrong readiness probes send traffic too early; wrong liveness probes create
  restart loops during dependency outages.
- Missing requests cause poor scheduling; low limits cause throttling or OOM.
- Stateful backing services are often safer as managed services.
- ConfigMaps and Kubernetes Secrets require access control and encryption; a
  Secret object is not automatically a full secret-management solution.

### Practical exercise

Render and validate manifests for one service with Deployment, Service,
configuration, resource requests/limits, PodDisruptionBudget, and startup,
readiness, and liveness probes. In a local cluster, perform a rolling update and
simulate a failed readiness probe.

### Verification checklist

- [ ] Manifests reference immutable image versions.
- [ ] Startup, readiness, and liveness probes have distinct purposes.
- [ ] Requests and limits are based on measurements.
- [ ] Graceful termination and rollout availability are tested.
- [ ] Internal services are not publicly exposed.
- [ ] No manifest contains plaintext production credentials.

### 60–90 second interview answer

> Kubernetes is the target orchestrator for the arcade containers. A Deployment
> declares the image, replicas, rollout policy, and resources; a Service gives
> stable discovery; and only the gateway is exposed through an Ingress or load
> balancer. Startup probes protect slow initialization, readiness decides
> whether a pod receives traffic, and liveness is reserved for processes that
> cannot recover without restart. Requests guide scheduling and limits contain
> resource use, while graceful SIGTERM handling supports zero-downtime rolling
> updates. The trade-off is substantial operational complexity, especially
> around probes, capacity, security, and debugging. I would keep PostgreSQL,
> Kafka, and Redis managed where possible rather than operating them casually in
> the cluster. These manifests are a learning target; I would not describe the
> platform as deployed without a verified cluster and operational evidence.

## 12. AWS Target Architecture

### Definition

AWS provides managed compute, data, networking, identity, storage, and
observability services. The target mapping is EKS for Kubernetes, ECR for
images, RDS PostgreSQL, MSK Kafka, ElastiCache Redis, S3 object storage, IAM
authorization, a multi-AZ VPC, ALB ingress, and CloudWatch telemetry.

### Why this project uses it

The mapping shows how the locally learned components could run with managed
control planes and integrated security. It reduces undifferentiated operations
but adds cloud cost, quotas, service-specific behavior, and responsibility for
correct architecture. It is a design, not a deployed-state claim.

### Flow

1. CI authenticates with short-lived federation and pushes images to ECR.
2. EKS nodes or serverless compute run private workloads across availability
   zones; an ALB exposes only the gateway.
3. EKS workloads use IAM roles for service accounts and least-privilege policies.
4. Private network paths reach RDS, MSK, and ElastiCache; security groups permit
   only required flows.
5. S3 stores receipts, exports, static artifacts, or backups with encryption and
   lifecycle policy.
6. CloudWatch receives logs, metrics, dashboards, and alarms tied to runbooks.

### Trade-offs and failure modes

- Multi-AZ managed services improve resilience but do not replace tested backup,
  restore, failover, and disaster-recovery procedures.
- NAT gateways, cross-AZ traffic, logs, and idle capacity can dominate cost.
- Broad IAM policies or public subnets expose resources.
- Connection storms can overwhelm RDS during scaling or recovery.
- MSK and ElastiCache require capacity, patching, and failure planning despite
  being managed.
- CloudWatch without retention and actionable alarms becomes expensive noise.

### Practical exercise

Draw the target architecture and create an infrastructure proposal listing
subnets, routes, security-group flows, IAM roles, encryption keys, backups,
alarms, budgets, and recovery assumptions. Use pricing estimates and static
validation only; label every resource as proposed unless actually verified.

### Verification checklist

- [ ] EKS, ECR, RDS, MSK, ElastiCache, S3, IAM, VPC, ALB, and CloudWatch each
  have a documented responsibility.
- [ ] Workloads and data services are private; only intended ALB listeners are
  public.
- [ ] IAM permissions are least privilege and use short-lived credentials.
- [ ] Encryption, backup, restore, multi-AZ, and retention policies are defined.
- [ ] Cost, quotas, scaling, and recovery assumptions are explicit.
- [ ] Documentation clearly says proposed, local, or verified deployed state.

### 60–90 second interview answer

> My AWS design maps the arcade platform to managed services: ECR stores
> immutable images, EKS runs the gateway and services, RDS provides PostgreSQL,
> MSK provides Kafka, ElastiCache provides Redis, and S3 holds objects such as
> exports or receipts. An ALB exposes only the gateway; workloads and data
> services stay in private subnets across availability zones. IAM roles for
> service accounts grant narrowly scoped, short-lived access, and security
> groups allow only required flows. CloudWatch collects logs, metrics, and
> alarms linked to runbooks. Managed services reduce control-plane work but do
> not remove capacity, backup, failover, security, or cost responsibilities. I
> would validate restores and watch NAT, cross-AZ, and telemetry costs. This is
> the target architecture, not a claim that the infrastructure is deployed.

## 13. SQL vs NoSQL and a DynamoDB Analytics Projection

### Definition

Relational databases organize normalized data with schemas, joins, constraints,
and multi-row transactions. NoSQL systems optimize particular data models and
access patterns. DynamoDB is a managed key-value/document database whose table
and indexes should be designed from known partition-key and sort-key queries.
A projection is a derived read model, not the system of record.

### Why this project uses it

PostgreSQL remains authoritative for users, machines, bookings, and payments.
A DynamoDB analytics projection is a deliberate learning case for high-volume,
denormalized queries such as daily venue-machine utilization. Kafka events can
update that projection without giving analytics ownership of booking truth.

### Flow

1. A booking or payment transaction commits in its owning PostgreSQL service.
2. A versioned event reaches the analytics consumer through Kafka.
3. The consumer performs an idempotent conditional or atomic update in DynamoDB.
4. Partition and sort keys serve predefined dashboard queries.
5. The dashboard displays projection freshness and tolerates eventual consistency.
6. A replay rebuilds the projection from retained events or an authoritative
   export when logic changes.

### Trade-offs and failure modes

- Denormalization improves reads but duplicates data and complicates updates.
- Poor partition keys create hot partitions; scans create unpredictable cost.
- Global secondary indexes add write cost and are limited to planned queries.
- Eventual consistency means dashboards can lag behind transactions.
- Lost or duplicate events corrupt projections without reconciliation and
  idempotency.
- Adding DynamoDB without a justified access pattern creates needless polyglot
  persistence and operational burden.

### Practical exercise

Define two analytics queries first, then design a single-table key pattern for
daily utilization by venue and machine. Consume duplicate and out-of-order
events with conditional writes, display a freshness timestamp, and rebuild the
projection from a replay.

### Verification checklist

- [ ] PostgreSQL remains the documented transactional source of truth.
- [ ] Every DynamoDB index maps to a named access pattern.
- [ ] Partition cardinality and hot-key risk are estimated.
- [ ] Duplicate and out-of-order events are tested.
- [ ] Projection lag, reconciliation, and rebuild procedures are observable.
- [ ] Read/write capacity and index/storage costs are estimated.

### 60–90 second interview answer

> I choose a database from invariants and access patterns. PostgreSQL owns
> bookings and payments because they need constraints, flexible queries, and
> multi-row transactions. DynamoDB is useful here only as a derived analytics
> projection, for example daily utilization by venue and machine at high read
> volume. A Kafka consumer updates a denormalized item with an idempotent,
> conditional write; dashboards show freshness because the view is eventually
> consistent. Keys and secondary indexes are designed from named queries, not
> added speculatively, and the projection can be rebuilt from retained events or
> authoritative exports. Risks include hot partitions, expensive scans and
> indexes, duplicate or out-of-order events, and reconciliation drift. Polyglot
> persistence is justified only when that access pattern outweighs the added
> operational complexity.

## Completion Standard

The roadmap is complete when every exercise has reproducible evidence, every
checklist item is satisfied, and the learner can explain both the selected
design and a simpler alternative. Local demonstrations, proposed manifests, and
target cloud diagrams must remain clearly distinguished from verified deployed
infrastructure.
