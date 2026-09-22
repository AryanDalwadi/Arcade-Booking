import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('github actions policy', () => {
  const ci = read('.github/workflows/ci.yml');
  const images = read('.github/workflows/images.yml');
  const deploy = read('.github/workflows/deploy.yml');

  it('installs from the lockfile and keeps the default token read-only', () => {
    assert.match(ci, /npm ci/);
    assert.doesNotMatch(ci, /npm install(?:\s|$)/);
    assert.match(ci, /permissions:\s*\n\s*contents: read/);
    assert.match(ci, /git ls-files/);
  });

  it('tags images with the commit SHA and does not publish on every push', () => {
    assert.match(images, /GIT_SHA=\$\{\{ github\.sha \}\}/);
    assert.match(images, /tags: \$\{\{ steps\.workspace\.outputs\.image \}\}:\$\{\{ github\.sha \}\}/);
    assert.match(images, /vars\.PUBLISH_IMAGES == 'true'/);
    assert.match(images, /trivy-action/);
    assert.doesNotMatch(images, /github\.event_name == 'push'/);
  });

  it('keeps deploy as a manual skeleton behind confirm and DEPLOY_ENABLED', () => {
    assert.match(deploy, /workflow_dispatch/);
    assert.match(deploy, /inputs\.confirm == 'deploy'/);
    assert.match(deploy, /vars\.DEPLOY_ENABLED == 'true'/);
    assert.match(deploy, /This is not a live deploy/);
  });
});
