import { defineDocsConfig } from '@tenphi/cookbook/config';

import aknoPackage from './packages/cli/package.json' with { type: 'json' };

export default defineDocsConfig({
  site: {
    title: 'Akno',
    version: aknoPackage.version,
    description: 'A two-way memory layer for agents over a Markdown knowledge base you own.',
    url: 'https://akno.tenphi.me',
    repository: 'https://github.com/tenphi/akno',
    favicon: 'public/akno.svg',
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
      { file: 'docs/index.md', route: '/' },
      { file: 'README.md', route: '/overview' },
      { file: 'docs/README.md', route: '/documentation' },
      {
        glob: 'docs/**/*.md',
        base: 'docs',
        exclude: ['docs/README.md', 'docs/index.md'],
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
        items: [
          '/overview',
          { label: 'Getting started', link: '/getting-started' },
          { label: 'The memory lifecycle', link: '/memory-lifecycle' },
          { label: 'Core concepts', link: '/concepts' },
        ],
      },
      {
        label: 'Workflows',
        items: [
          { label: 'Reading memory', link: '/reading' },
          { label: 'Writing and ingestion', link: '/writing' },
          { label: 'The dream cycle', link: '/dream-cycle' },
        ],
      },
      {
        label: 'Reference',
        items: [
          { label: 'Configuration', link: '/configuration' },
          { label: 'Command reference', link: '/commands' },
          { label: 'Operations', link: '/operations' },
          { label: 'Benchmarks and model qualification', link: '/benchmarks' },
          { label: 'Limitations', link: '/limitations' },
        ],
      },
      {
        label: 'Internals',
        items: [{ label: 'How Akno works', link: '/how-it-works' }, '/documentation'],
      },
    ],
  },
  theme: {
    brand: { from: '#6554c0' },
    styles: {
      StarlightHeader: {
        // The custom site title includes our mark in the home link.
        Logo: { hide: true },
      },
      Hero: {
        Visual: {
          inlineSize: { '': 'min(100%, 11rem)', '@mobile': '8rem' },
          blockSize: 'auto',
        },
      },
    },
  },
  components: {
    overrides: {
      SiteTitle: './docs/components/SiteTitle.astro',
    },
  },
  build: {
    strict: true,
    ci: process.env.CI === 'true',
  },
});
