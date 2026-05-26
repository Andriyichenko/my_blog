// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';

// https://astro.build/config
export default defineConfig({
  site: 'https://example.com',
  integrations: [
    mdx({
        remarkPlugins: [remarkMath],
        rehypePlugins: [
            [rehypeMathjax, { packages: ['base', 'ams', 'autoload', 'require', 'configmacros'], tex: { tags: 'ams', processEscapes: true } }]
        ]
    }), 
    sitemap(), 
    react()
  ],

  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      [rehypeMathjax, { tex: { tags: 'ams', processEscapes: true } }]
    ],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
