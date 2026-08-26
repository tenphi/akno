# Limitations

Akno is an autonomous-capable memory layer, not a general knowledge-management platform. These are the current
capability boundaries that materially affect how it should be used.

## One owner or one trusted shared owner

Akno assumes a person and their agent share authority over one knowledge base. It has one write handle and
transport-level allow lists, but no user accounts, per-page ACLs, tenancy, approval roles, or attribution model
for mutually untrusted collaborators.

This works for a personal memory or a trusted household/team folder with one shared policy. It is not enough for
an organization where different people must be unable to read or change each other's material.

## macOS host

The core and CLI target macOS. Document extraction uses PDFKit, Vision, and `textutil`; background operation
uses launchd. The protocol and client packages are portable, so a container or another machine can call a
macOS-hosted service, but the full Akno runtime is not a supported Linux or Windows installation.

## Conservative entity resolution

Akno has an evidence graph and bounded multi-hop traversal. It resolves identities from exact signals: canonical
slugs, explicit aliases, unique titles and basenames, authored links, `akno.about`, document ownership, and
optional contextual choice among already-known same-name candidates.

It does not perform open-ended named-entity recognition, infer arbitrary relationships from prose, or decide
that similar pages represent the same real-world entity. Duplicate merging requires allowed-folder policy plus
either an exact alias or a narrow graph-backed signal: at least two distinct current attributes resolve exactly
to a canonical entity with a multi-token name, and the candidate title contains that complete name. The
independent verifier and curator must still agree that the page has no useful separate scope. This avoids
dangerous false joins, but loosely written pages without exact subjects or aliases remain outside automatic
merging.

Broader semantic discovery remains research-only. Its development benchmark confirmed that embedding cosine
alone is unsafe: repeated templates and adjacent product identities can score above genuine near-purpose pairs.
A permissive embedding prefilter plus a strict Luna classifier passed the invented development corpus, but Akno
will not turn those candidates into executable merges until a frozen, independently reviewed held-out corpus
also passes repeated stability checks.

## Retrieval is not omniscience

`recall` and `answer` can only use indexed and permitted evidence. Empty retrieval does not prove that a fact is
false or absent from the world. Documents with failed extraction, ignored paths, disabled model roles, ambiguous
identity, tight budgets, or unavailable endpoints may reduce the searchable evidence.

Typed `empty`, `degraded`, and `unavailable` states make that boundary visible, but callers still need to handle
it. `answer` verifies support against retrieved evidence; it does not independently verify the evidence against
outside reality.

## Model quality remains a boundary

Deterministic guards can reject malformed, unsupported, stale, over-budget, or unauthorized model output. They
cannot turn a weak inference into an insightful one. Observe, reflect, synthesis, routing, answer generation,
and contextual disambiguation remain sensitive to model quality and prompt compatibility.

The qualified OpenAI preset is backed by invented benchmarks, not a guarantee for every private corpus or
future provider revision. Run `doctor` after model changes and use the relevant live benchmark before granting
automatic write authority.

## The review queue is not universal

Hygiene, synthesis, split, extraction, merge, contradiction changes, broken-link changes, adoption, observation,
and reflection use durable plans. Report-only conflict findings, the legacy repair surface, and housekeeping do
not all become actionable queue items. There is no snooze or “request revision” decision yet; the available
decisions are approval, rejection, pending, and later replanning.

Consequently, some diagnostics still require a person or future planner to translate a report into an exact
operation.

## Dependency planning is bounded

A full dream cycle separates all planning from decisions and applies safe items in dependency order. It can
replan work invalidated by successful earlier items once. It does not repeatedly loop until every possible
transformation settles.

Cross-phase composition, arbitrary same-page proposal merging, document-attachment dependency inference, and
pinning every planner read to one global database revision remain incomplete. Ambiguous or persistent
dependencies are deferred to a later cycle rather than guessed through.

## No configurable fail-fast maintenance mode

Autonomous maintenance favors independent progress: one degraded or blocked item does not stop unrelated safe
work. There is currently no profile setting that makes the first degraded writable phase abort the rest of the
cycle. Installations that require all-or-nothing nightly execution should remain in audit or review and inspect
the complete receipt before applying.

## Setup does not abstract every provider detail

`akno init` provides a qualified OpenAI single-endpoint path, a model-free path, and preservation of manually
configured specialist roles. The OpenAI preset uses the dedicated Responses adapter, while third-party
OpenAI-compatible providers default to Chat Completions and may opt into persistently learned `api: auto`
selection.

Auto-resolution establishes only which generative route accepts every configured model. It cannot prove that a
gateway implements strict structured output correctly, that a model honors a requested reasoning effort, or
that one provider block can safely mix models requiring different transports. Specialist setups therefore still
require understanding role assignment, structured-output support, dimensions, reasoning controls, and
degradation behavior; `doctor` and live benchmarks test those higher-level contracts.

## Inference can still look authoritative

Observation and reflection pages are marked derived, kept separate from authored evidence, and ranked lower.
They are also append-only, cited, planned, and independently decided. Even so, fluent derived Markdown can look
more certain than it is when read outside Akno.

Editors and downstream tools should preserve the role metadata and evidence links. Important decisions should
prefer authored or primary-document evidence over a derived observation.

## Not an editor, backup, or world model

Akno deliberately does not provide a graphical notes editor, version-control replacement, backup service,
general web research agent, or independent source of truth. It can synthesize existing pages using supplied
outside facts when the operation and policy authorize that evidence, but it does not autonomously browse the
world during ordinary recall or maintenance.

The Markdown files remain the durable product. Keep them readable without Akno and back them up independently.
