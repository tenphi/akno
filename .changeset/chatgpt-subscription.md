---
'@tenphi/akno-core': minor
'@tenphi/akno-protocol': minor
---

Add ChatGPT subscription access for the generative roles. A provider with `auth: "chatgpt"` bills the ChatGPT plan Codex is signed in to on this machine instead of an API key. It reads the login from `$CODEX_HOME/auth.json` on every call and never refreshes it, and it sends streamed, stateless Responses calls to the Codex backend. Embeddings and a Decisions or endpoint reranker still need an API-key provider: pointed at the subscription, those roles resolve as unavailable with the fix in the reason. API keys remain the default.

`fallback` on a subscription provider names an API-key provider that serves a call the subscription cannot: no usable login, a refusal, a usage limit, an outage or a timeout. Every result whose op needed such a call carries a `model_fallback` entry in a new optional `warnings` field, beside an unchanged `status`. The CLI prints it, the service logs fallbacks from background work, and `akno doctor` shows a warning on roles that are falling back. The protocol version is unchanged: the field is optional.
