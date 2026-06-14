import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 读取所有博客文章（直接读文件，不用 astro:content）
const blogDir = path.join(__dirname, '../src/content/blog');
const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));

console.log(`找到 ${files.length} 篇文章：`, files);

async function getEmbedding(text) {
  const res = await fetch(
    `https://api.minimax.chat/v1/embeddings?GroupId=${MINIMAX_GROUP_ID}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'embo-01',
        texts: [text.slice(0, 2000)],
        type: 'db'
      })
    }
  );
  const data = await res.json();
  if (!data?.vectors?.[0]) {
    console.error('MiniMax 返回异常：', JSON.stringify(data));
  }
  return data?.vectors?.[0];
}

for (const file of files) {
  const slug = file.replace(/\.(md|mdx)$/, '');
  const raw = fs.readFileSync(path.join(blogDir, file), 'utf-8');
  const { data: frontmatter, content } = matter(raw);
  
  const text = `${frontmatter.title || ''} ${frontmatter.description || ''} ${content}`;
  
  console.log(`\n处理中：${slug}`);
  const embedding = await getEmbedding(text);
  
  if (!embedding) {
    console.error(`  ✗ 获取 embedding 失败，跳过`);
    continue;
  }
  
  const { error } = await supabase
    .from('post_embeddings')
    .upsert({ slug, embedding });
  
  if (error) {
    console.error(`  ✗ 写入 Supabase 失败：`, error.message);
  } else {
    console.log(`  ✓ 写入成功`);
  }
  
  await new Promise(r => setTimeout(r, 500));
}

console.log('\n全部完成！');