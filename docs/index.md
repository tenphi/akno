---
title: Akno
description: A two-way memory layer for agents over a Markdown knowledge base you own.
template: splash
hero:
  title: Memory your agent can cite, and you can edit.
  tagline: Akno gives an agent continuity across conversations without turning memory into an opaque chat-provider feature—the Markdown files you already own stay the source of truth.
  image:
    html: '<img src="/akno.svg" width="176" height="176" alt="Akno logo" style="width:100%;height:auto" />'
  actions:
    - text: Get started
      link: /getting-started/
      variant: primary
    - text: Read the overview
      link: /overview/
      variant: minimal
---

## Evidence, not fragments

Ordinary retrieval hands an agent text. Akno hands it evidence with enough structure to act
responsibly: every returned claim carries a page line or document-page citation, `recall` finds and
ranks that evidence while `answer` produces a separately verified response, and a clean miss stays
distinct from a failed model or a degraded ranking path.

### Files stay authoritative

Indexing leaves the set and bytes of your source files unchanged by default. Search projections are
rebuildable, so the same notes you edit in Obsidian, vim, or any other editor remain the thing Akno
reads from.

### Evidence is not automatically belief

Pages, source documents, inferred observations, and ignored material carry different roles and
retrieval policies. A proposal or an attributed report stays useful as context without silently
becoming a current fact.

### Writes are bounded

Mutations are journalled and undoable. The nightly [dream cycle](dream-cycle.md) plans exact diffs
before a human or a separate curator decides what may apply, and scheduled maintenance defaults to
audit mode.

## Choose a path

| If you want to…                         | Start with                                                       |
| --------------------------------------- | ---------------------------------------------------------------- |
| Install Akno or try the demo            | [Getting started](getting-started.md)                            |
| Understand the everyday memory workflow | [Memory lifecycle](memory-lifecycle.md), [Concepts](concepts.md) |
| Read or supply agent context            | [Reading memory](reading.md)                                     |
| Write memory or ingest documents        | [Writing and ingestion](writing.md)                              |
| Configure autonomous maintenance        | [The dream cycle](dream-cycle.md)                                |
| Deploy, diagnose, or recover Akno       | [Operations](operations.md)                                      |
| Understand the implementation           | [How Akno works](how-it-works.md)                                |

Akno is in active pre-1.0 development and runs on a real personal knowledge base. It does not replace
your editor, backup system, or judgment—it only knows what the indexed files and documents contain.
See [Limitations](limitations.md) for the boundaries that matter before you rely on it.
