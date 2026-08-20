# Akno product specifications

These documents describe the next version of Akno's maintenance and retrieval experience. They are
product and engineering contracts, not descriptions of current behavior. Current behavior remains documented
in [HOW-IT-WORKS.md](../HOW-IT-WORKS.md).

The intended experience is an autonomous memory system: Akno notices structural and factual maintenance
work, prepares exact changes, makes a separate decision about those changes, applies the authorized subset,
and verifies the result. A human can occupy the decision point, but should not have to operate every step.

## Product principles

1. **Plan before changing.** Every autonomous edit exists first as a durable, inspectable proposal containing
   the exact file operations and diffs.
2. **Decision is a separate turn.** A curator or human reviews the complete plan after generation. The model
   that proposes a change does not silently authorize it in the same response.
3. **Autonomy is policy, not blind trust.** Automatic mode authorizes defined classes of validated work. It
   does not mean applying arbitrary model output.
4. **Retrieval must not wait for organization.** An extracted document can be recalled before it has an owning
   Markdown page. Adoption is an optimization and filing operation, not a visibility requirement.
5. **Contradictions constrain inference.** Conflict analysis precedes phases that infer new knowledge, and
   unresolved claims cannot become foundations for new observations.
6. **Every applied plan is reversible and verified.** Input hashes, the change journal, post-write indexing,
   and explicit verification receipts make unattended operation understandable and recoverable.
7. **One-provider onboarding should be useful.** A single general-purpose model can cover generation and
   LLM-based reranking while Akno retains lexical retrieval. Optional specialist models improve that baseline.

## Specifications and dependency order

| Order | Specification                                                             | Outcome                                                              | Depends on               |
| ----- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------ |
| 1     | [Maintenance plans and decisions](001-maintenance-plans-and-decisions.md) | Durable exact diffs with human or curator decisions                  | current change journal   |
| 2     | [Autonomous page curation](002-autonomous-page-curation.md)               | Split, extract, merge, hygiene, links, contradictions, and synthesis | 001                      |
| 3     | [Dream lifecycle](003-dream-lifecycle.md)                                 | Inspect → plan → decide → apply → reindex → verify                   | 001, 002                 |
| 4     | [Orphan-document retrieval](004-orphan-document-retrieval.md)             | Immediate recall without waiting for `adopt`                         | current document index   |
| 5     | [Trust modes and maintenance status](005-trust-modes-and-status.md)       | Audit, review, and autonomous policies with visible state            | 001, 003                 |
| 6     | [Single-model setup](006-single-model-setup.md)                           | Guided setup and an OpenAI GPT-5.6 Luna preset                       | 005, 007                 |
| 7     | [LLM reranking benchmark](007-llm-reranking-benchmark.md)                 | Evidence for the single-model ranking choice                         | current recall benchmark |

The recommended implementation slices are:

1. Plan storage, CLI inspection, and manual decisions.
2. Audit-only planners for each page transformation.
3. Atomic apply and verification.
4. Curator decisions and automatic policies.
5. Direct orphan-document recall.
6. Guided setup, LLM reranking, and its benchmark gate.

This order keeps each slice useful. It also avoids coupling the large curation surface to the setup experience
before its safety and quality can be measured.

## Shared terminology

- **Run:** one invocation of the maintenance lifecycle.
- **Plan:** an immutable snapshot of proposed work against known input hashes.
- **Item:** one independently decidable unit in a plan. It may contain multiple file operations when those
  operations must be atomic, such as merging a page and updating inbound links.
- **Planner:** deterministic code plus an optional model call that proposes an item.
- **Curator:** a separate decision pass that accepts, rejects, or requests a revision of a plan item.
- **Policy:** configuration that determines whether an item is only reported, waits for a human, is sent to a
  curator, or may be applied automatically.
- **Receipt:** the durable result of planning, decision, apply, and verification, including failures and skips.
- **Orphan document:** an indexed document whose `page_id` is null. It is searchable evidence even though it
  has not yet been filed under a knowledge page.

## Status

All specifications are **proposed**. Open questions are intentionally recorded in each document. An
implementation may be split into smaller changes, but it should not weaken the invariants or acceptance
criteria without updating the relevant specification first.
