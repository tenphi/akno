# @tenphi/akno

The Akno command-line interface and service.

Akno gives agents cited reading and guarded writing operations over a Markdown knowledge base while the files
remain authoritative and editable in any normal editor.

Akno's native indexing, document extraction, socket runtime, and managed background service support macOS and
Linux with Node 22.18 or newer. macOS uses PDFKit, Vision, `textutil`, and launchd; Linux uses external Poppler,
Tesseract, and LibreOffice tools plus systemd `--user`. Missing extraction tools are reported as typed
degradation rather than disabling Markdown indexing.

```bash
npm install -g @tenphi/akno
akno init
akno index
akno doctor
akno recall "How long is the Zephyr QX-100 warranty?"
akno recall "What is planned for the Zephyr QX-100?" --memory-view planning
```

`akno init` offers the qualified OpenAI single-endpoint setup, a model-free lexical setup, or preservation of
manually configured specialist roles. Model roles degrade independently, so `doctor` explains both availability
and the consequence of a missing role.

## Main operations

```text
recall / answer / read / list / graph / timeline / context
write / remember / retain / forget / undo / move / folder
ingest / inbox / adopt
dream / plan
migrate / serve / service / doctor / rules / config / bench / redeploy
```

`akno --help` and `akno <command> --help` describe the installed interface. The service exposes the same typed
operation registry in process, over an owner-only Unix socket, through HTTP with public read-only loopback and
configured bearer identities, and over stdio MCP for agent hosts.

`akno timeline` reads authored events, retained states/plans/deadlines, and dated document evidence through one
clock-relative view. Use `--view actionable --order nearest` for active or accepted work while the default view
keeps cancelled, completed, and superseded history visible.

## Documentation

- [Project overview](https://github.com/tenphi/akno#readme)
- [Getting started](https://github.com/tenphi/akno/blob/main/docs/getting-started.md)
- [How Akno works](https://github.com/tenphi/akno/blob/main/docs/how-it-works.md)
- [Command reference](https://github.com/tenphi/akno/blob/main/docs/commands.md)
- [All guides](https://github.com/tenphi/akno/tree/main/docs)

## License

PolyForm Noncommercial License 1.0.0 — noncommercial use only.
