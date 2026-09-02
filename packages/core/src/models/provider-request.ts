const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BODY_PRESERVING_REDIRECT_STATUSES = new Set([307, 308]);
const DEFAULT_MAX_REDIRECTS = 5;

/** A content-free transport failure. URL paths and header values deliberately stay out of it. */
export class ProviderRequestError extends Error {
  readonly requests: number;
  readonly timedOut: boolean;

  constructor(message: string, requests: number, options?: ErrorOptions & { timedOut?: boolean }) {
    super(message, options);
    this.name = 'ProviderRequestError';
    this.requests = requests;
    this.timedOut = options?.timedOut ?? false;
  }
}

export interface ProviderResponse {
  response: Response;
  /** Physical requests, including accepted same-origin redirects. */
  requests: number;
}

/**
 * Send one model POST without allowing Fetch to move credentials or content to another origin.
 *
 * A 307 or 308 has the one redirect meaning a model endpoint can safely honor: repeat the same
 * method and body at a new same-origin path. The older 301/302 behavior varies for POST, and 303
 * explicitly rewrites it to GET, so those statuses fail instead of guessing at provider intent.
 */
export async function requestConfiguredProvider(
  configuredBaseUrl: string,
  endpointUrl: string,
  init: RequestInit,
  maxRedirects = DEFAULT_MAX_REDIRECTS,
): Promise<ProviderResponse> {
  let configured: URL;
  let current: URL;
  try {
    configured = new URL(configuredBaseUrl);
    current = new URL(endpointUrl);
  } catch (cause) {
    throw new ProviderRequestError('configured provider URL is invalid', 0, { cause });
  }

  if (!isHttp(configured) || configured.username || configured.password) {
    throw new ProviderRequestError('configured provider URL is unsupported', 0);
  }
  if (current.origin !== configured.origin || !isHttp(current) || current.username || current.password) {
    throw new ProviderRequestError('model request does not match the configured provider origin', 0);
  }

  const visited = new Set<string>([current.href]);
  let requests = 0;
  let redirects = 0;

  while (true) {
    let response: Response;
    try {
      requests += 1;
      response = await fetch(current, { ...init, redirect: 'manual' });
    } catch (cause) {
      const timedOut =
        cause instanceof Error && (cause.name === 'TimeoutError' || cause.name === 'AbortError');
      throw new ProviderRequestError(
        timedOut ? 'provider request timed out' : 'provider request failed',
        requests,
        { cause, timedOut },
      );
    }

    if (!REDIRECT_STATUSES.has(response.status)) return { response, requests };

    if (!BODY_PRESERVING_REDIRECT_STATUSES.has(response.status)) {
      await response.body?.cancel().catch(() => undefined);
      throw new ProviderRequestError(
        `provider returned ${response.status}, which cannot preserve a model POST safely`,
        requests,
      );
    }

    const location = response.headers.get('location');
    if (!location) {
      await response.body?.cancel().catch(() => undefined);
      throw new ProviderRequestError('provider redirect omitted its destination', requests);
    }

    let target: URL;
    try {
      target = new URL(location, current);
    } catch (cause) {
      await response.body?.cancel().catch(() => undefined);
      throw new ProviderRequestError('provider redirect destination is malformed', requests, { cause });
    }

    if (!isHttp(target) || target.username || target.password) {
      await response.body?.cancel().catch(() => undefined);
      throw new ProviderRequestError('provider redirect destination is unsupported', requests);
    }
    if (target.origin !== configured.origin) {
      await response.body?.cancel().catch(() => undefined);
      throw new ProviderRequestError('provider redirected outside its configured origin', requests);
    }
    if (visited.has(target.href)) {
      await response.body?.cancel().catch(() => undefined);
      throw new ProviderRequestError('provider redirect loop was refused', requests);
    }
    if (redirects >= maxRedirects) {
      await response.body?.cancel().catch(() => undefined);
      throw new ProviderRequestError('provider redirect limit was exceeded', requests);
    }

    await response.body?.cancel().catch(() => undefined);
    redirects += 1;
    visited.add(target.href);
    current = target;
  }
}

function isHttp(url: URL): boolean {
  return url.protocol === 'http:' || url.protocol === 'https:';
}
