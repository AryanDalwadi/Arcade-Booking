import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('aws proposed map policy', () => {
  const main = read('infra/aws/main.tf');
  const variables = read('infra/aws/variables.tf');
  const outputs = read('infra/aws/outputs.tf');
  const mapping = JSON.parse(read('infra/aws/mapping.json'));
  const overlay = read('infra/k8s/overlays/aws/kustomization.yaml');
  const ingress = read('infra/k8s/overlays/aws/ingress-alb.yaml');

  it('is labeled proposed and not a live account', () => {
    assert.equal(mapping.status, 'proposed');
    assert.equal(mapping.live, false);
    assert.match(outputs, /proposed-not-deployed/);
    assert.match(variables, /i_understand_this_creates_billable_aws_resources/);
    assert.match(variables, /default\s+= false/);
    assert.match(main, /terraform_data" "apply_guard"/);
  });

  it('maps Compose pieces onto managed AWS services', () => {
    assert.equal(mapping.compose_to_aws.PostgreSQL, 'RDS PostgreSQL, private, not publicly_accessible');
    assert.match(mapping.compose_to_aws.Kafka, /MSK/);
    assert.match(mapping.compose_to_aws.Redis, /ElastiCache/);
    assert.deepEqual(mapping.public_edge, ['ALB']);
    assert.ok(mapping.private_data.includes('RDS'));
    assert.equal(mapping.dynamodb_analytics_default, false);
  });

  it('keeps data private, images immutable, and DynamoDB off by default', () => {
    assert.match(main, /publicly_accessible\s+= false/);
    assert.match(main, /image_tag_mutability\s+= "IMMUTABLE"/);
    assert.match(main, /scan_on_push\s+= true/);
    assert.match(main, /block_public_acls\s+= true/);
    assert.match(variables, /enable_dynamodb_analytics_projection/);
    assert.match(variables, /default\s+= false/);
    assert.doesNotMatch(main, /password\s+=\s+"[^"]+"/);
    assert.doesNotMatch(main, /Resource\s+=\s+"\*"/);
  });

  it('proposes ALB in front of the same Kubernetes base', () => {
    assert.match(overlay, /\.\.\/\.\.\/base/);
    assert.match(overlay, /ACCOUNT\.dkr\.ecr/);
    assert.match(overlay, /replace-me-with-git-sha/);
    assert.match(ingress, /ingressClassName: alb/);
    assert.doesNotMatch(overlay, /newTag:\s*latest/);
  });
});
