import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const remote = git(['remote', 'get-url', 'origin']);
const revision = git(['rev-parse', '--short', 'HEAD']);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'scrollwork-pages-'));
try {
  await cp(path.join(root, 'dist-pages'), temporary, { recursive: true });
  await writeFile(path.join(temporary, '.nojekyll'), '');
  git(['init', '-b', 'gh-pages'], temporary);
  git(['config', 'user.name', git(['config', 'user.name'])], temporary);
  git(['config', 'user.email', git(['config', 'user.email'])], temporary);
  git(['remote', 'add', 'origin', remote], temporary);
  if (git(['ls-remote', '--heads', 'origin', 'gh-pages'])) {
    git(['fetch', '--depth=1', 'origin', 'gh-pages'], temporary);
    git(['reset', '--soft', 'FETCH_HEAD'], temporary);
  }
  git(['add', '--all'], temporary);
  git(['commit', '--allow-empty', '-m', `Deploy Scrollwork Studio (${revision})`], temporary);
  // Fast-forward only; deployment never overwrites a newer remote branch.
  console.log(git(['push', 'origin', 'HEAD:gh-pages'], temporary));
  console.log('Published static assets to gh-pages.');
} finally { await rm(temporary, { recursive: true, force: true }); }
