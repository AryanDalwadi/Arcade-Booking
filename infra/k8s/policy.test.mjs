import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('kubernetes manifest policy', () => {
  const kustomization = read('infra/k8s/base/kustomization.yaml');
  const workloads = read('infra/k8s/base/workloads.yaml');
  const ingress = read('infra/k8s/base/ingress.yaml');
  const config = read('infra/k8s/base/configmap.yaml');
  const secrets = read('infra/k8s/base/secret.template.yaml');
  const pdb = read('infra/k8s/base/pdb.yaml');
  const netpol = read('infra/k8s/base/networkpolicy.yaml');

  it('does not promote latest tags or bake the secret template into Kustomize', () => {
    assert.doesNotMatch(kustomization, /newTag:\s*latest/);
    assert.doesNotMatch(kustomization, /secret\.template/);
    assert.doesNotMatch(kustomization, /migrate\.template/);
    assert.match(kustomization, /replace-me-with-git-sha/);
    assert.match(kustomization, /pdb.yaml/);
    assert.match(kustomization, /networkpolicy.yaml/);
  });

  it('uses distinct live and ready probes and drains with SIGTERM time', () => {
    assert.match(workloads, /path: \/health\/ready/);
    assert.match(workloads, /path: \/health\/live/);
    assert.match(workloads, /terminationGracePeriodSeconds: 20/);
    assert.match(workloads, /maxUnavailable: 0/);
    assert.match(workloads, /runAsNonRoot: true/);
  });

  it('exposes only web and gateway through Ingress', () => {
    assert.match(ingress, /name: gateway/);
    assert.match(ingress, /name: web/);
    assert.doesNotMatch(ingress, /name: booking/);
    assert.doesNotMatch(ingress, /name: identity/);
    assert.doesNotMatch(ingress, /name: payment/);
  });

  it('keeps migrations off replicas and secrets as placeholders', () => {
    assert.match(config, /MIGRATE_ON_START: "false"/);
    assert.match(secrets, /REPLACE_ME/);
    assert.doesNotMatch(secrets, /local_admin_only/);
    assert.doesNotMatch(config, /JWT_SECRET/);
  });

  it('protects availability and internal HTTP', () => {
    assert.match(pdb, /kind: PodDisruptionBudget/);
    assert.match(pdb, /minAvailable: 1/);
    assert.match(netpol, /kind: NetworkPolicy/);
    assert.match(netpol, /allow-gateway-to-http-services/);
    assert.match(netpol, /allow-booking-to-catalog/);
    assert.match(netpol, /analytics/);
    assert.match(netpol, /default-deny-ingress/);
  });
});
