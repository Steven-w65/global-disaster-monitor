import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(resolve(process.cwd(), path), 'utf8');
const runStep = command => new RegExp(`^\\s*- run: ${command}\\s*$`, 'm');
const setupNodeStep = /^      - uses: actions\/setup-node@v4\r?\n        with:\r?\n          node-version: 24\r?\n          cache: npm$/m;

function job(workflow, name) {
  const lines = workflow.split(/\r?\n/);
  const start = lines.indexOf(`  ${name}:`);
  if (start < 0) return '';

  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (/^  \S/.test(line)) break;
    body.push(line);
  }
  return body.join('\n');
}

function rootBlock(workflow, name) {
  const lines = workflow.split(/\r?\n/);
  const start = lines.indexOf(`${name}:`);
  if (start < 0) return [];

  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (/^[^\s#]/.test(line)) break;
    if (line.trim() && !/^\s*#/.test(line)) body.push(line);
  }
  return body;
}

describe('deployment configuration', () => {
  it('runs the exact verification contract for pushes and pull requests', () => {
    const verify = read('.github/workflows/verify.yml');
    const verifyJob = job(verify, 'verify');

    expect(rootBlock(verify, 'on')).toEqual(['  pull_request:', '  push:']);
    expect(rootBlock(verify, 'permissions')).toEqual(['  contents: read']);
    expect(verifyJob).toMatch(/^      - uses: actions\/checkout@v4$/m);
    expect(verifyJob).toMatch(setupNodeStep);
    expect(verifyJob).toMatch(runStep('npm ci'));
    expect(verifyJob).toMatch(runStep('npx playwright install --with-deps chromium'));
    expect(verifyJob).toMatch(runStep('npm run verify'));
  });

  it('deploys only a verified production artifact through GitHub Pages', () => {
    const deploy = read('.github/workflows/deploy-pages.yml');
    const build = job(deploy, 'build');
    const deployJob = job(deploy, 'deploy');

    expect(rootBlock(deploy, 'on')).toEqual([
      '  push:',
      '    branches: [main]',
      '  workflow_dispatch:'
    ]);
    expect(rootBlock(deploy, 'permissions')).toEqual([
      '  contents: read',
      '  pages: write',
      '  id-token: write'
    ]);
    expect(deploy).toMatch(/^concurrency:\r?\n  group: pages\r?\n  cancel-in-progress: false$/m);
    expect(build).toMatch(/^      - uses: actions\/checkout@v4$/m);
    expect(build).toMatch(setupNodeStep);
    expect(build).toMatch(runStep('npm ci'));
    expect(build).toMatch(runStep('npx playwright install --with-deps chromium'));
    expect(build).toMatch(runStep('npm run verify'));
    expect(build).toMatch(/^      - uses: actions\/upload-pages-artifact@v3\r?\n        with:\r?\n          path: \.\/dist$/m);
    expect(deployJob).toMatch(/^    needs: build$/m);
    expect(deployJob).toMatch(/^    environment:\r?\n      name: github-pages\r?\n      url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}$/m);
    expect(deployJob).toMatch(/^      - id: deployment\r?\n        uses: actions\/deploy-pages@v4$/m);
  });

  it('documents exact local and production commands', () => {
    const readme = read('README.md');
    for (const command of [
      'npm install',
      'npm run dev',
      'npx playwright install --with-deps chromium',
      'npm run verify',
      'npm run build'
    ]) {
      expect(readme).toContain(command);
    }
  });

  it('declares the Node versions supported by jsdom while retaining the Node 24 CI target', () => {
    const manifest = JSON.parse(read('package.json'));
    const lockfile = JSON.parse(read('package-lock.json'));
    const supportedRange = '^22.22.2 || ^24.15.0 || >=26.0.0';

    expect(manifest.engines.node).toBe(supportedRange);
    expect(lockfile.packages[''].engines.node).toBe(supportedRange);
    expect(read('README.md')).toContain('Node.js 22.22.2 or newer in the 22.x line, 24.15.0 or newer in the 24.x line, or 26.0.0 or newer.');
    expect(job(read('.github/workflows/verify.yml'), 'verify')).toMatch(/node-version: 24/);
  });
});
