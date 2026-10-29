---
'@tenphi/akno-core': minor
---

Add ChatGPT subscription access for the generative roles. A provider with `auth: "chatgpt"` bills the ChatGPT plan Codex is signed in to on this machine instead of an API key. It reads the login from `$CODEX_HOME/auth.json` on every call and never refreshes it, and it sends streamed, stateless Responses calls to the Codex backend. Embeddings and a Decisions or endpoint reranker still need an API-key provider: pointed at the subscription, those roles resolve as unavailable with the fix in the reason. A missing or expired login makes the subscription roles unavailable without sending a request. API keys remain the default.
