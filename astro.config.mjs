// @ts-check
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';

export default defineConfig({
  site: 'https://example.com',

  output: 'static',

  integrations: [
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        [
          rehypeMathjax,
          {
            packages: ['base', 'ams', 'autoload', 'require', 'configmacros'],
            tex: { tags: 'ams', processEscapes: true },
          },
        ],
      ],
    }),
    sitemap(),
    react(),
  ],

  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      [
        rehypeMathjax,
        {
          tex: { tags: 'ams', processEscapes: true },
        },
      ],
    ],
  },

  vite: {
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.PUBLIC_SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL),
      'import.meta.env.PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
    },
  },
});