import os from 'node:os';
import path from 'node:path';

export interface PlatformPathOptions {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
}

export interface PlatformPaths {
  configDir: string;
  stateDir: string;
  socketPath: string;
}

/** OS-owned defaults only; explicit Akno config and environment overlays are applied by callers. */
export function defaultPlatformPaths(options: PlatformPathOptions = {}): PlatformPaths {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const homeDir = options.homeDir ?? os.homedir();

  if (platform !== 'linux') {
    const stateDir = path.join(homeDir, '.akno');
    return { configDir: stateDir, stateDir, socketPath: path.join(stateDir, 'akno.sock') };
  }

  const defaultConfigDir = path.join(homeDir, '.config');
  const defaultStateDir = path.join(homeDir, '.local', 'state');
  const configHome = absoluteXdgPath(env.XDG_CONFIG_HOME, defaultConfigDir);
  const stateHome = absoluteXdgPath(env.XDG_STATE_HOME, defaultStateDir);
  const runtimeHome = absoluteXdgPath(env.XDG_RUNTIME_DIR, stateHome);
  const configDir = path.join(configHome, 'akno');
  const stateDir = path.join(stateHome, 'akno');
  const socketDir = path.join(runtimeHome, 'akno');
  return { configDir, stateDir, socketPath: path.join(socketDir, 'akno.sock') };
}

function absoluteXdgPath(value: string | undefined, fallback: string): string {
  return value && path.isAbsolute(value) ? value : fallback;
}
