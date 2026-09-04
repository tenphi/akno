import { defineDocsConfig } from '@tenphi/cookbook';

import aknoPackage from './packages/cli/package.json' with { type: 'json' };

export default defineDocsConfig({
  site: {
    title: 'Akno',
    version: aknoPackage.version,
    description: 'A two-way memory layer for agents over a Markdown knowledge base you own.',
    url: 'https://akno.tenphi.me',
    repository: 'https://github.com/tenphi/akno',
  },
  head: [
    {
      tag: 'script',
      attrs: {
        defer: true,
        src: 'https://umami.tenphi.me/script.js',
        'data-website-id': 'fb522f6e-9997-4a27-a4fc-a8492a0fa0c0',
      },
    },
  ],
  content: {
    sources: [
      { file: 'README.md', route: '/' },
      { file: 'docs/README.md', route: '/documentation' },
      {
        glob: 'docs/**/*.md',
        base: 'docs',
        exclude: ['docs/README.md'],
        navigation: false,
      },
    ],
    localizeRepositoryLinks: false,
  },
  navigation: {
    items: [
      '/',
      {
        label: 'Start here',
        items: ['/getting-started', '/memory-lifecycle', '/concepts'],
      },
      {
        label: 'Workflows',
        items: ['/reading', '/writing', '/dream-cycle'],
      },
      {
        label: 'Reference',
        items: ['/configuration', '/commands', '/operations', '/benchmarks', '/limitations'],
      },
      {
        label: 'Internals',
        items: ['/how-it-works', '/documentation'],
      },
    ],
  },
  theme: {
    brand: { from: '#6554c0' },
  },
  build: {
    strict: true,
    ci: process.env.CI === 'true',
    base: '/',
  },
});
