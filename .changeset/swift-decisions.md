---
'@tenphi/akno-core': minor
'@tenphi/akno-protocol': minor
---

Use OpenAI Decisions API by default in the OpenAI Luna setup for faster reranking without output generation. Add explicit Decisions probability qualification and complete-batch validation; preserve native endpoint and base-model LLM modes. Failed or invalid requests retain candidates with visible degradation.

Recall qualification now has a Decisions variant, so the wire protocol advances to 5. Upgrade the client and server together and restart long-running hosts.
