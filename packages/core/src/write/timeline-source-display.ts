import { fromMarkdown } from 'mdast-util-from-markdown';

/** Presentation only: matching uses the original identity, never its Markdown label. */
export function timelineSourceDisplay(
  body: string,
  reporter: string | undefined,
  innerReporters: readonly { speaker?: string }[] = [],
): { reporter?: string; body: string } {
  if (!reporter) return { body: readableEmails(body) };
  const name = suppliedSenderName(reporter);
  // A display name shared by another chain participant is not an identity alias.
  const ambiguous = innerReporters.some(
    (inner) => inner.speaker && suppliedSenderName(inner.speaker).toLowerCase() === name.toLowerCase(),
  );
  const identities = ambiguous ? [] : [...new Set([reporter, name])];
  let readable = body;
  for (const identity of identities) {
    const escaped = identity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const relay = new RegExp(
      `^(?:${escaped}(?:[’']s (?:digest|report))? (?:reports|reported|says|said|states|stated)(?: that)? |According to ${escaped}, |Reported by ${escaped}: )`,
      'iu',
    );
    const stripped = readable.replace(relay, '');
    if (stripped !== readable && stripped.trim()) {
      readable = stripped;
      break;
    }
    // Listing is a source action, not confirmation of the embedded event. Keep
    // the verb even when the qualifier supplies its otherwise repeated subject.
    const listing = new RegExp(`^${escaped} (lists|listed) `, 'iu').exec(readable);
    if (listing && readable.slice(listing[0].length).trim()) {
      const verb = listing[1]!;
      readable = `${verb[0]!.toUpperCase()}${verb.slice(1)} ${readable.slice(listing[0].length)}`;
      break;
    }
  }
  return {
    reporter: markdownLiteral(name.replace(/\s+/g, ' ').trim().slice(0, 200)),
    body: readableEmails(readable),
  };
}

function suppliedSenderName(value: string): string {
  const mailbox = /^([^<>]+?)\s*<[^<>\s]+@[^<>\s]+>$/u.exec(value.trim());
  const name = mailbox?.[1]?.trim();
  return name ? name.replace(/^"([^"\n]+)"$/u, '$1') : value.trim();
}

function markdownLiteral(value: string): string {
  return value.replaceAll('&', '&amp;').replace(/[\\`*_[\]<>|]/gu, '\\$&');
}

function readableEmails(body: string): string {
  // Let the Markdown grammar identify spans that already own their rendering
  // and destinations, including nested links and reference definitions.
  interface Node {
    type: string;
    position?: { start: { offset?: number }; end: { offset?: number } };
    children?: readonly Node[];
  }
  const protectedRanges: { start: number; end: number }[] = [];
  const visit = (node: Node): void => {
    if (
      [
        'inlineCode',
        'code',
        'link',
        'linkReference',
        'image',
        'imageReference',
        'html',
        'definition',
      ].includes(node.type)
    ) {
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) protectedRanges.push({ start, end });
      return;
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(fromMarkdown(body));
  return body.replace(/[a-z0-9.!#$%&'*+/=?^_{}|~-]+@[a-z0-9.-]+\.[a-z]{2,}/giu, (token, offset: number) =>
    body[offset - 1] === '\\' ||
    protectedRanges.some(({ start, end }) => offset < end && offset + token.length > start)
      ? token
      : markdownLiteral(token),
  );
}
