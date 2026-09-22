import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('docker image policy', () => {
  const nodeDockerfile = read('infra/docker/node.Dockerfile');
  const gatewayDockerfile = read('apps/api-gateway/Dockerfile');
  const webDockerfile = read('apps/web/Dockerfile');
  const dockerignore = read('.dockerignore');

  it('uses a lockfile install instead of a floating npm install', () => {
    for (const file of [nodeDockerfile, gatewayDockerfile, webDockerfile]) {
      assert.match(file, /COPY package.json package-lock.json/);
      assert.match(file, /npm ci/);
      assert.doesNotMatch(file, /npm install(?:\s|$)/);
    }
  });

  it('runs Node processes as non-root', () => {
    assert.match(nodeDockerfile, /USER node/);
    assert.match(gatewayDockerfile, /USER node/);
    assert.match(webDockerfile, /nginx-unprivileged/);
  });

  it('does not bake secrets into ENV', () => {
    for (const file of [nodeDockerfile, gatewayDockerfile, webDockerfile]) {
      assert.doesNotMatch(file, /JWT_SECRET=/);
      assert.doesNotMatch(file, /PASSWORD=/);
      assert.doesNotMatch(file, /DATABASE_URL=postgres:\/\//);
    }
  });

  it('keeps a slim runtime and a health check', () => {
    assert.match(nodeDockerfile, /FROM node:22-alpine AS runtime/);
    assert.match(nodeDockerfile, /HEALTHCHECK/);
    assert.match(nodeDockerfile, /STOPSIGNAL SIGTERM/);
    assert.match(nodeDockerfile, /migrations/);
    assert.doesNotMatch(nodeDockerfile, /COPY --from=build[^\n]+SERVICE_PATH \.\/\$\{SERVICE_PATH\}/);
    assert.match(gatewayDockerfile, /HEALTHCHECK/);
    assert.match(webDockerfile, /HEALTHCHECK/);
  });

  it('excludes git, local env files, and legacy apps from the build context', () => {
    assert.match(dockerignore, /^\.git$/m);
    assert.match(dockerignore, /^\.env$/m);
    assert.match(dockerignore, /^backend$/m);
    assert.match(dockerignore, /^frontend$/m);
  });

  it('gives Compose init and a stop grace period', () => {
    const compose = read('infra/docker-compose.yml');
    assert.match(compose, /init: true/);
    assert.match(compose, /stop_grace_period: 12s/);
  });
});
