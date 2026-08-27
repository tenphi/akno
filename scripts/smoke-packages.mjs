#!/usr/bin/env node
/**
 * Install the actual release tarballs together and exercise Akno outside the checkout.
 *
 * Build/tests import workspace files directly. Even `pnpm pack` only proves the archive shape;
 * it does not prove that npm can link the four rewritten manifests, that the installed core can
 * find its packaged defaults, or that the installed bin can open its native SQLite dependency.
 * This smoke owns that boundary. It uses one invented page, no configured models, and a temporary
 * state directory, so it sends nothing externally and leaves no knowledge-base changes behind.
 *
 * Pass a directory containing all four tarballs to reuse release-workflow output. With no argument,
 * the script packs the current build first.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = path.resolve(import.meta.dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'akno-package-smoke-'));
const tarballDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(scratch, 'tarballs');
const installRoot = path.join(scratch, 'install');
const knowledgeBase = path.join(scratch, 'memory');
const stateDir = path.join(scratch, 'state');
const pagePath = path.join(knowledgeBase, 'equipment', 'zephyr.md');
const page = `---
title: "Zephyr warranty"
---

# Zephyr warranty

Ada Marlow recorded a five-year warranty for the Zephyr QX-100.
`;

try {
  fs.mkdirSync(tarballDir, { recursive: true });
  fs.mkdirSync(path.dirname(pagePath), { recursive: true });
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(pagePath, page, 'utf8');

  if (!process.argv[2]) {
    for (const name of ['protocol', 'core', 'client', 'cli']) {
      execute('pnpm', ['pack', '--pack-destination', tarballDir], {
        cwd: path.join(repoRoot, 'packages', name),
      });
    }
  }

  const tarballs = fs
    .readdirSync(tarballDir)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => path.join(tarballDir, name))
    .sort();
  assert(tarballs.length === 4, `expected four package tarballs, found ${tarballs.length}`);

  execute(
    'npm',
    ['install', '--prefix', installRoot, '--no-package-lock', '--no-audit', '--no-fund', ...tarballs],
    { cwd: scratch },
  );

  const packageNames = ['@tenphi/akno-protocol', '@tenphi/akno-core', '@tenphi/akno-client', '@tenphi/akno'];
  const manifests = packageNames.map((name) => installedManifest(name));
  const versions = new Set(manifests.map(({ manifest }) => manifest.version));
  assert(versions.size === 1, `installed package versions disagree: ${[...versions].join(', ')}`);
  for (const { name, root: packageRoot, manifest } of manifests) {
    assert(manifest.license === 'PolyForm-Noncommercial-1.0.0', `${name} has the wrong license metadata`);
    assert(manifest.engines?.node === '>=22.18', `${name} does not declare the supported Node runtime`);
    assert(fs.existsSync(path.join(packageRoot, 'LICENSE')), `${name} has no packaged LICENSE`);
    assert(fs.existsSync(path.join(packageRoot, 'README.md')), `${name} has no packaged README`);
    const dependencies = { ...manifest.dependencies, ...manifest.optionalDependencies };
    assert(
      Object.values(dependencies).every((value) => !/^(workspace|catalog):/.test(value)),
      `${name} has an unresolved workspace or catalog dependency`,
    );
  }

  const coreRoot = manifests.find(({ name }) => name === '@tenphi/akno-core').root;
  assert(fs.existsSync(path.join(coreRoot, 'config', 'default.jsonc')), 'installed core has no defaults');
  assert(
    fs.existsSync(path.join(coreRoot, 'swift', 'extract.swift')),
    'installed core has no extractor source',
  );

  const resolveInstalled = createRequire(path.join(installRoot, 'release-smoke.cjs')).resolve;
  const protocol = await import(pathToFileURL(resolveInstalled('@tenphi/akno-protocol')).href);
  const core = await import(pathToFileURL(resolveInstalled('@tenphi/akno-core')).href);
  const client = await import(pathToFileURL(resolveInstalled('@tenphi/akno-client')).href);
  assert(typeof protocol.OPS?.recall === 'object', 'installed protocol entrypoint has no recall schema');
  assert(typeof core.open === 'function', 'installed core entrypoint has no open function');
  assert(typeof client.connect === 'function', 'installed client entrypoint has no connect function');

  const cli = path.join(installRoot, 'node_modules', '.bin', 'akno');
  assert(fs.existsSync(cli), 'npm did not link the installed akno binary');
  const initialEnv = aknoEnv({
    AKNO_ISOLATED: '1',
    AKNO_PATH: knowledgeBase,
    AKNO_STATE_DIR: stateDir,
  });

  const installedVersion = manifests.find(({ name }) => name === '@tenphi/akno').manifest.version;
  const reportedVersion = execute(cli, ['--version'], { cwd: scratch, env: initialEnv }).trim();
  assert(
    reportedVersion === installedVersion,
    `installed CLI reports ${reportedVersion || 'nothing'}, package is ${installedVersion}`,
  );
  execute(cli, ['--help'], { cwd: scratch, env: initialEnv });
  const initialConfig = jsonCli(cli, ['config'], initialEnv);
  assert(
    initialConfig.sources?.[0]?.includes(
      path.join('node_modules', '@tenphi', 'akno-core', 'config', 'default.jsonc'),
    ),
    `installed config did not load packaged defaults: ${initialConfig.sources?.[0] ?? 'no source'}`,
  );

  const setup = jsonCli(
    cli,
    [
      'init',
      '--preset',
      'no-model',
      '--maintenance',
      'audit',
      '--akno-path',
      knowledgeBase,
      '--state-dir',
      stateDir,
    ],
    initialEnv,
  );
  assert(setup.applied === true, 'installed no-model setup did not write its configuration');
  assert(typeof setup.write?.path === 'string', 'installed setup returned no configuration path');

  const configuredEnv = aknoEnv({
    AKNO_CONFIG: setup.write.path,
    AKNO_STATE_DIR: stateDir,
  });
  const indexed = jsonCli(cli, ['index'], configuredEnv);
  assert(indexed.pagesIndexed === 1, `installed index wrote ${indexed.pagesIndexed} pages, expected one`);
  assert(indexed.chunksWritten > 0, 'installed index wrote no chunks');

  const recalled = jsonCli(cli, ['recall', 'Zephyr warranty'], configuredEnv);
  assert(
    recalled.results?.some((result) => result.type === 'page' && result.slug === 'equipment/zephyr'),
    'installed lexical recall did not return the invented page',
  );
  assert(
    recalled.degraded?.includes('no_embedding_model'),
    'installed no-model recall did not report embedding degradation',
  );
  assert(fs.readFileSync(pagePath, 'utf8') === page, 'installed index changed knowledge-base bytes');

  process.stdout.write('installed package smoke passed\n');
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

function jsonCli(cli, args, env) {
  return JSON.parse(execute(cli, [...args, '--json'], { cwd: scratch, env }));
}

function installedManifest(name) {
  const packageRoot = path.join(installRoot, 'node_modules', ...name.split('/'));
  const manifestPath = path.join(packageRoot, 'package.json');
  assert(fs.existsSync(manifestPath), `${name} was not installed`);
  return {
    name,
    root: packageRoot,
    manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
  };
}

function execute(command, args, options) {
  try {
    return execFileSync(command, args, {
      ...options,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    const stdout = typeof error.stdout === 'string' ? error.stdout.trim() : '';
    const stderr = typeof error.stderr === 'string' ? error.stderr.trim() : '';
    throw new Error(
      `${command} ${args.join(' ')} failed` +
        `${stdout ? `\nstdout:\n${stdout}` : ''}` +
        `${stderr ? `\nstderr:\n${stderr}` : ''}`,
      { cause: error },
    );
  }
}

function aknoEnv(values) {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.startsWith('AKNO_')) delete env[name];
  }
  return { ...env, NO_COLOR: '1', ...values };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
