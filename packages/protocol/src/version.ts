/**
 * Wire version, bumped only when an existing exchange changes in a way an older
 * client cannot absorb. `connect()` handshakes on it and refuses a server it cannot
 * speak to, rather than failing subtly on the third call.
 *
 * Adding an operation or an optional field is capability-compatible and must not
 * bump this number: the handshake already advertises `hello.ops`. A needless bump
 * disconnects long-lived hosts from otherwise unchanged operations until they are
 * restarted, which turns a service-only deploy into lost memory calls.
 */
// Timeline gained a third result variant (`memory`) and new required clock fields.
// An older client cannot safely exhaustively consume that existing exchange.
export const PROTOCOL_VERSION = 2;

/** Advertised MCP server name. The spec calls for `memory`, not `akno`. */
export const MCP_SERVER_NAME = 'memory';
