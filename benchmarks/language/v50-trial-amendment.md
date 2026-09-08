# V50 post-probe disposition

Both declared exposed probes completed on `9bc0bcb` and are preserved under `results/v50`. Independently useful answers are 0/80, useful retained sets 0/10 and case availability failures 10/10. All failures occur during retention verification before storage; fresh V20 held-out remains unexecuted.

The new Zod candidate discriminator emits `oneOf` through the actual endpoint serializer. The documented structured-output subset supports nested `anyOf`. Original trace instrumentation omitted error messages, so the specific provider rejection string cannot be recovered from these reports. V51 will fix the candidate-union serialization without loosening its disjoint literal-ID validation and will test the wire schema and preserve protocol errors explicitly. Full execution is deferred under the unchanged readiness rule. All started V50 results remain counted; no semantic retry was performed.
