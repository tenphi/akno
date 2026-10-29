/**
 * ChatGPT subscription access for the generative roles.
 *
 * A provider with `auth: "chatgpt"` bills the ChatGPT plan that Codex is signed in to on this
 * machine instead of an API key. The backend serves only streamed Responses calls: no embeddings,
 * no Decisions, no Chat Completions, and no `temperature`.
 *
 * Codex owns the login. Its refresh tokens rotate on use, so a second refresher would sign one of
 * the two apps out. Akno re-reads Codex's auth file on every request and leaves refreshing to
 * Codex (the ChatGPT app, or `codex login`).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Where `auth: "chatgpt"` providers send Responses calls unless `base_url` says otherwise. */
export const CHATGPT_CODEX_BASE_URL = 'https://chatgpt.com/backend-api/codex';

export interface ChatGptLogin {
  accessToken: string;
  accountId: string;
}

export type ChatGptLoginProblem = 'missing' | 'not_chatgpt' | 'unreadable' | 'expired';

export type ChatGptLoginState = { status: 'ok'; login: ChatGptLogin } | { status: ChatGptLoginProblem };

const LOGIN_PROBLEMS: Record<ChatGptLoginProblem, string> = {
  missing: 'no ChatGPT login found; sign in to Codex with a ChatGPT account',
  not_chatgpt: 'Codex is signed in with an API key, not a ChatGPT account; sign in to Codex with ChatGPT',
  unreadable: 'the Codex login file could not be read; sign in to Codex again',
  expired: 'the ChatGPT login has expired; open Codex or run `codex login` to refresh it',
};

/** Operator-facing explanation for a login problem. Never contains credential values. */
export function describeChatGptLoginProblem(problem: ChatGptLoginProblem): string {
  return LOGIN_PROBLEMS[problem];
}

/** Codex keeps its login under `$CODEX_HOME`, `~/.codex` by default. */
export function codexAuthPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'auth.json');
}

function tokenExpiry(token: string): number | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as {
      exp?: unknown;
    };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

/** Read Codex's ChatGPT login. Never throws. */
export function readChatGptLogin(file = codexAuthPath(), now = Date.now()): ChatGptLoginState {
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return { status: 'missing' };
  }
  let doc: { auth_mode?: unknown; tokens?: { access_token?: unknown; account_id?: unknown } | null };
  try {
    doc = JSON.parse(raw) as typeof doc;
  } catch {
    return { status: 'unreadable' };
  }
  const accessToken = doc.tokens?.access_token;
  const accountId = doc.tokens?.account_id;
  if (typeof accessToken !== 'string' || !accessToken || typeof accountId !== 'string' || !accountId) {
    return { status: doc.auth_mode !== undefined && doc.auth_mode !== 'chatgpt' ? 'not_chatgpt' : 'missing' };
  }
  const expiresAt = tokenExpiry(accessToken);
  if (expiresAt !== undefined && expiresAt <= now) return { status: 'expired' };
  return { status: 'ok', login: { accessToken, accountId } };
}

export function chatGptHeaders(login: ChatGptLogin): Record<string, string> {
  return {
    authorization: `Bearer ${login.accessToken}`,
    'chatgpt-account-id': login.accountId,
    originator: 'akno',
    accept: 'text/event-stream',
  };
}

/**
 * Collapse a streamed Responses call into the response object a non-streaming call returns.
 *
 * The terminal event carries the whole response, so the deltas before it are skipped. A stream
 * that reports an error, or ends without a terminal event, becomes a `failed` response whose
 * message the caller reports.
 */
export async function readResponsesStream(response: Response): Promise<unknown> {
  const text = await response.text();
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data || data === '[DONE]') continue;
    let event: { type?: unknown; response?: unknown; message?: unknown; error?: { message?: unknown } };
    try {
      event = JSON.parse(data) as typeof event;
    } catch {
      continue;
    }
    if (
      event.type === 'response.completed' ||
      event.type === 'response.incomplete' ||
      event.type === 'response.failed'
    ) {
      return event.response;
    }
    if (event.type === 'error') {
      const message = event.message ?? event.error?.message;
      return {
        status: 'failed',
        error: { message: typeof message === 'string' && message ? message : 'the stream reported an error' },
      };
    }
  }
  return { status: 'failed', error: { message: 'the stream ended before the response completed' } };
}
