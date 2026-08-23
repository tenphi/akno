/**
 * Wire version, bumped whenever an op's schema changes in a way a client cannot
 * absorb. `connect()` handshakes on it and refuses a server it cannot speak to,
 * rather than failing subtly on the third call.
 */
export const PROTOCOL_VERSION = 2;

/** Advertised MCP server name. The spec calls for `memory`, not `akno`. */
export const MCP_SERVER_NAME = 'memory';
