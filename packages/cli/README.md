# @tenphi/akno

The Akno command-line interface and service.

Akno gives agents cited reading and guarded writing operations over a Markdown knowledge base while the files
remain authoritative and editable in any normal editor.

Akno's runtime currently supports macOS and Node 22.18 or newer.

```bash
npm install -g @tenphi/akno
akno init
akno index
akno doctor
akno recall "How long is the Zephyr QX-100 warranty?"
```

`akno init` offers the qualified OpenAI single-endpoint setup, a model-free lexical setup, or preservation of
manually configured specialist roles. Model roles degrade independently, so `doctor` explains both availability
and the consequence of a missing role.

## Main operations

```text
recall / answer / read / list / graph / timeline / context
write / remember / forget / undo / move / folder
ingest / inbox / adopt
dream / plan
serve / service / doctor / rules / config / bench / redeploy
```

`akno --help` and `akno <command> --help` describe the installed interface. The service exposes the same typed
operation registry in process, over an owner-only Unix socket, through loopback HTTP for containers, and over
stdio MCP for agent hosts.

## Documentation

- [Project overview](https://github.com/tenphi/akno#readme)
- [Getting started](https://github.com/tenphi/akno/blob/main/docs/getting-started.md)
- [How Akno works](https://github.com/tenphi/akno/blob/main/docs/how-it-works.md)
- [Command reference](https://github.com/tenphi/akno/blob/main/docs/commands.md)
- [All guides](https://github.com/tenphi/akno/tree/main/docs)

## License

PolyForm Noncommercial License 1.0.0 — noncommercial use only.
