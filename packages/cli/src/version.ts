import fs from 'node:fs';

interface PackageManifest {
  version?: unknown;
}

/**
 * The package manifest is the release authority. Reading it at runtime keeps the CLI, socket/HTTP
 * handshakes, and MCP server identity on the version that was actually installed; a release bump
 * therefore has one editable value instead of four easy-to-miss string literals.
 */
function packageVersion(): string {
  const manifest = JSON.parse(
    fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as PackageManifest;
  if (typeof manifest.version !== 'string' || manifest.version.length === 0) {
    throw new Error('the @tenphi/akno package manifest has no version');
  }
  return manifest.version;
}

export const AKNO_VERSION = packageVersion();
