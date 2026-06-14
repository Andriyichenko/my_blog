import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { config } from 'dotenv';

config();

const supabase = createClient(
    process.env.PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// MiniMax Embedding 函数
async function getEmbedding(text) {
    const response = await fetch(
        `https://api.minimax.chat/v1/embeddings?GroupId=${process.env.MINIMAX_GROUP_ID}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'embo-01',
                texts: [text.slice(0, 4096)],
                type: 'db',
            }),
        }
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`MiniMax API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    return data.vectors[0];
}

// 读取所有博客文章
const blogDir = './src/content/blog';
const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));

for (const file of files) {
    const slug = file.replace(/\.(md|mdx)$/, '');
    const content = fs.readFileSync(path.join(blogDir, file), 'utf-8');
    const { data: frontmatter, content: body } = matter(content);

    const text = [
        frontmatter.title || '',
        frontmatter.description || '',
        frontmatter.tags?.join(' ') || '',
        body.slice(0, 500)
    ].join('\n');

    console.log(`Processing: ${slug}`);

    try {
        const embedding = await getEmbedding(text);

        const { error } = await supabase
            .from('post_embeddings')
            .upsert({ slug, embedding });

        if (error) {
            console.error(`  ❌ Supabase error for ${slug}:`, error.message);
        } else {
            console.log(`  ✅ Done: ${slug}`);
        }
    } catch (err) {
        console.error(`  ❌ MiniMax error for ${slug}:`, err.message);
    }

    // 避免触发速率限制
    await new Promise(r => setTimeout(r, 300));
}

console.log('\n🎉 All embeddings generated!');