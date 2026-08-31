import { defineConfig } from 'astro/config';
import cookbook from '@tenphi/cookbook';

import docs from './docs.config.js';

const site = 'https://akno.tenphi.me';

export default defineConfig({
  output: 'static',
  site,
  integrations: [cookbook({ config: docs })],
});
