import { defineComponent } from '@tenphi/cookbook/styling';

export const SiteTitleRoot = defineComponent('AknoSiteTitle', {
  as: 'a',
  styles: {
    display: 'flex',
    alignItems: 'center',
    gap: '1x',
    minInlineSize: '0',
    color: '#text',
    preset: { '': 'h4 / strong', '@mobile': 'h5 / strong' },
    textDecoration: 'none',
    Logo: {
      $: '> svg',
      display: 'block',
      flexShrink: '0',
      inlineSize: { '': '4x', '@mobile': '3.5x' },
      blockSize: { '': '4x', '@mobile': '3.5x' },
      color: '#text',
    },
    Label: {
      $: '> span',
      minInlineSize: '0',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  },
});
