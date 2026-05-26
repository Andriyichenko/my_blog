import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			subtitle: z.string().optional(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),
            // New field for hierarchical categorization
            subcategory: z.string().optional(),
            // Maintain compatibility if some posts use 'date' instead of 'pubDate'
            date: z.coerce.date().optional(), 
            // Tags
            tags: z.array(z.string()).optional(),
            // Author Support
            author: z.string().default('Andre YI'),
            authorImage: image().optional(),
		}),
});

export const collections = { blog };