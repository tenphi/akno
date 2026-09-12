# V73 distinct mixed-repair control review

## Decision

Approved for one execution after this review is saved. I found no fixture, schema, cap, accounting, or provenance blocker.

## Fixture and runner checks

The three replacement strings are different, grammatical invented prose sentences. They contain no newline or NUL, use normalized single spacing, end in punctuation, and have exact JavaScript/UTF-16 lengths of 200, 78, and 120 units. Their concatenation with the production's two single-space separators is exactly 400 units. The final content markers `silverpine`, `amberfin`, and `quartzleaf` are distinct and occur in different nonrepetitive sentences, so omission or compression cannot masquerade as copying an interchangeable repeated unit.

The new runner preserves the material protocol conditions:

- frozen HEAD and `v73-frozen-runtime.txt` both identify `1eb002b84c05927b1ac1c5f69e974908de36c224`;
- it captures the same production mixed repair schema and rejects strict-mode violations;
- it starts from the same captured expected object, replacing only the three report-text strings;
- the complete full-candidate sibling and its index remain unchanged;
- the report and full-candidate branches retain indices 0 and 1 in one transaction;
- caller maximum remains 3,200 and the role/effective ceiling remains 2,400;
- success still requires provider success, local schema validity, and deep exact equality;
- it writes a new start/result receipt and refuses to overwrite it;
- it names the amendment, distinct fixture, and preserved failed receipt in the new receipt.

This is not a relaxation of the original failure. Shorter output, semantic equivalence, schema validity without equality, or a second attempt cannot pass. The original repetitive script and completed failed receipt remain unchanged.

The fixture prose carries invented report semantics, but the control remains an exact protocol echo rather than semantic evidence. A pass can establish transport of this distinct maximum-bound mixed object under this one call. It cannot establish universal exact-copy reliability, report semantic competence, repair success in the cleaner, or budget sufficiency for arbitrary content.

## Accounting and wrapper correction

The amendment's eight-call accounting is coherent if the three pending calls pass:

- five passing controls fulfill the amended plan: the two already completed planned controls, the intended rendering pair, and this distinct mixed-repair control;
- two simpler alignment controls are preserved as passing but unplanned, with unavailable raw values/usage disclosed rather than inferred;
- the original repetitive mixed-repair control remains a failed invocation.

The corrected rendering wrapper differs from `postdeploy-v73-rendering-before-destination-correction.mjs` only in its output destination, changing `tmp/v73-protocol-controls.json` to the unused `tmp/v73-declared-protocol-controls.json`. Its control logic, schemas, model configuration, caps, and assertions are unchanged. This avoids overwriting the mistakenly created alignment receipt and makes the intended pair its first execution.

## Required disposition


Run `protocol-report-repair-distinct-v73.mjs` exactly once and preserve its started/completed receipt even if its final assertion fails. Run the intended rendering pair exactly once under its corrected destination. Any failure defers the corpus probes; there is no retry. If all three pending invocations pass, record all eight calls, explicitly retain the failed original and unplanned pair, complete independent preflight, and only then consider the declared exposed probes. Fresh held-out inputs remain untouched.
