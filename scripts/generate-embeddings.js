import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');
const DATA_DIR = path.join(process.cwd(), 'src/data');
const OUTPUT_FILE = path.join(DATA_DIR, 'embeddings.json');

async function generateEmbeddings() {
  if (!fs.existsSync(BLOG_DIR)) {
      console.log("Blog directory not found:", BLOG_DIR);
      return;
  }
  
  if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let embeddingsCache = {};
  if (fs.existsSync(OUTPUT_FILE)) {
      try {
          embeddingsCache = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      } catch (e) {
          console.error("Error reading cache, starting fresh.");
      }
  }

  const files = fs.readdirSync(BLOG_DIR).filter(file => file.endsWith('.mdx'));
  let updated = false;

  for (const file of files) {
    const filePath = path.join(BLOG_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const slug = file.replace('.mdx', '');
    
    // Check cache (key by slug)
    if (embeddingsCache[slug]) {
        continue; // Skip if exists
    }

    // Extract Text for Embedding (Title + Desc + Tags + Content snippet)
    // Simple Frontmatter Regex
    const titleMatch = content.match(/title:\s*["']?(.*?)["']?(\r\n|\n)/);
    const descMatch = content.match(/description:\s*["']?(.*?)["']?(\r\n|\n)/);
    const tagsMatch = content.match(/tags:\s*\[(.*?)\]/);
    
    const title = titleMatch ? titleMatch[1] : slug;
    const desc = descMatch ? descMatch[1] : '';
    const tags = tagsMatch ? tagsMatch[1] : '';
    
    // Remove frontmatter
    const body = content.replace(/^---[\s\S]*?---/, '').trim().substring(0, 1000); // First 1k chars

    const textToEmbed = `Title: ${title}\nDescription: ${desc}\nTags: ${tags}\nContent: ${body}`;

    console.log(`Generating embedding for: ${slug}`);

    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: textToEmbed,
        });

        const embedding = response.data[0].embedding;
        embeddingsCache[slug] = embedding;
        updated = true;
        
        // Rate limit protection (simple)
        await new Promise(resolve => setTimeout(resolve, 200));

    } catch (e) {
        console.error(`Error generating embedding for ${slug}:`, e);
    }
  }

  if (updated) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(embeddingsCache, null, 2));
      console.log(`Saved ${Object.keys(embeddingsCache).length} embeddings to ${OUTPUT_FILE}`);
  } else {
      console.log("No new posts to process.");
  }
}

generateEmbeddings();