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

describe('deployment configuration', () => {
  it('runs the exact verification contract for pushes and pull requests', () => {
    const verify = read('.github/workflows/verify.yml');
    const verifyJob = job(verify, 'verify');

    expect(verify).toMatch(/^on:\r?\n  pull_request:\s*\r?\n  push:\s*$/m);
    expect(verify).toMatch(/^permissions:\r?\n  contents: read$/m);
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

    expect(deploy).toMatch(/^on:\r?\n  push:\r?\n    branches: \[main\]\r?\n  workflow_dispatch:\s*$/m);
    expect(deploy).toMatch(/^permissions:\r?\n  contents: read\r?\n  pages: write\r?\n  id-token: write$/m);
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
    for (const command of ['npm install', 'npm run dev', 'npm run verify', 'npm run build']) {
      expect(readme).toContain(command);
    }
  });
});
