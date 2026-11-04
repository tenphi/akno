---
'@tenphi/akno-core': patch
---

Read the answer the ChatGPT subscription backend streams. Its terminal `response.completed` event now carries an empty `output`, and each item arrives only in its own `response.output_item.done` event. Every generative call on the subscription therefore failed with "Responses API response had no output text", and that call never reached the API-key fallback, because the stream itself had completed. The streamed items now stand in for an empty terminal output. A terminal response that carries its own output, as the public API's does, is used unchanged.
