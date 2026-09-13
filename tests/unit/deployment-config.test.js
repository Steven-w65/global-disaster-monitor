import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = path => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('deployment configuration', () => {
  it('verifies before deploying only the production artifact', () => {
    expect(read('.github/workflows/verify.yml')).toContain('npm run verify');
    const deploy = read('.github/workflows/deploy-pages.yml');
    expect(deploy).toContain('npm run verify');
    expect(deploy).toContain('path: ./dist');
    expect(deploy).toContain('actions/deploy-pages@');
  });

  it('documents exact local and production commands', () => {
    const readme = read('README.md');
    for (const command of ['npm install', 'npm run dev', 'npm run verify', 'npm run build']) {
      expect(readme).toContain(command);
    }
  });
});
