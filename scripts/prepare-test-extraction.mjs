// Concurrent macOS CI workers otherwise race to compile the shared helper inside 30-second tests.
// Use the production source/cache path before the suite; local and non-macOS runs keep their setup.
if (process.env.GITHUB_ACTIONS === 'true' && process.platform === 'darwin') {
  const { extractionCapabilities } = await import('../packages/core/src/ingest/extract.ts');
  const capabilities = await extractionCapabilities('darwin');
  if (!capabilities.swift) throw new Error('The macOS document extractor could not be prepared');
  console.log('macOS document extractor ready');
}
