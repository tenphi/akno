# Akno documentation

The root [README](../README.md) is the short introduction. These guides explain the workflows and design in
more depth without making every reader carry the complete implementation history.

## Start here

1. [Getting started](getting-started.md) — install Akno, choose a setup, index, and run the first recall.
2. [Core concepts](concepts.md) — understand pages, documents, roles, rules, citations, and result states.
3. [Reading memory](reading.md) or [Writing and ingestion](writing.md) — follow the workflow you need.
4. [The dream cycle](dream-cycle.md) — understand maintenance before enabling scheduled writes.

## Reference and internals

- [Configuration](configuration.md) — config layers, secrets, models, profiles, and folder rules.
- [Command reference](commands.md) — purpose, write behavior, and model needs for every command.
- [How Akno works](how-it-works.md) — indexing, retrieval, mutation, service, and recovery architecture.
- [Operations](operations.md) — services, schedules, diagnostics, privacy, recovery, and platform constraints.
- [Benchmarks](benchmarks.md) — reproducible quality gates and current qualified-model evidence.
- [Limitations](limitations.md) — current capability boundaries and deliberate non-goals.

## Common paths

| Goal                              | Read                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Try Akno safely                   | [Getting started](getting-started.md) → [Reading memory](reading.md)                                              |
| Connect an agent host             | [Reading memory: automatic context](reading.md#automatic-context-for-an-agent-host) → [Operations](operations.md) |
| Import existing files             | [Writing and ingestion](writing.md#documents-and-ingestion) → [Core concepts](concepts.md#pages-and-documents)    |
| Enable autonomous maintenance     | [Dream cycle](dream-cycle.md) → [Configuration](configuration.md#maintenance-authority)                           |
| Diagnose missing or slow behavior | [Operations](operations.md#diagnostics) → [Benchmarks](benchmarks.md)                                             |
| Change Akno itself                | [CONTRIBUTING.md](../CONTRIBUTING.md) and [AGENTS.md](../AGENTS.md)                                               |
