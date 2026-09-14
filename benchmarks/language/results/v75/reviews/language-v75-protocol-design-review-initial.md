# V75 provider protocol design review — initial

## Disposition

The ten-fixture declaration is a valid successor to the preserved V74 7/10 failure: after removing the incompatible patterns, every fixture's expected value, schema structure, API, caller cap, role cap and audit expectation is unchanged. The generated declaration contains no Unicode-property escape or lookaround. Only the mixed clock-repair schema retains the previously accepted plain single-line terminal-punctuation patterns.

Two harness corrections are required before launch.

First, `safeError` applies credential and URL redaction but stores the resulting string without a length bound, despite the declared bounded-error requirement. A provider can echo a large schema or body in its error. Store a fixed-size redacted excerpt plus a truncation indicator, or a closed error class with a bounded excerpt. Redaction must occur before truncation. This change does not alter any fixture, schema, expected value, cap or provider call.

Second, the wrapped `chatTransport` writes a `status:'started'` entry and awaits the original transport without a local `try/catch`. If it throws, the outer control catch marks the logical control failed, but the transport entry remains permanently `started` with no bounded error. The plan requires every started outcome to be captured. Finalize the transport entry as failed with the same bounded/redacted error before rethrowing, and make the final gate require every transport status to be completed or failed rather than relying only on the logical control's `ok` value.

The suite otherwise has the required once-only file guard, frozen SHA and clean tracked-tree checks, exact declaration-byte check, sequential controls, per-transport start receipts, exact/schema/audit/cap gates and final all-ten assertion. A failed result remains preserved and cannot be overwritten. This review does not authorize `--live`; launch approval follows the corrected harness, frozen build/deployment receipts, and separate final preflight.
