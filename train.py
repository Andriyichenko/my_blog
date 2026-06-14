# train.py (完整生产环境版)
import os
import glob
import re
from dotenv import load_dotenv
from supabase import create_client, Client
from sentence_transformers import SentenceTransformer

# 自动加载本地 .env 文件（本地测试用，Amplify 线上会自动读取控台变量）
load_dotenv()

def parse_markdown_frontmatter(file_path):
    """极其鲁棒的 YAML Frontmatter 解析器，提取 Astro 文章的 title 和 description"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 匹配 Astro 开头的 --- 区域
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
    title, description = "", ""
    if match:
        frontmatter = match.group(1)
        for line in frontmatter.split('\n'):
            if line.startswith('title:'):
                title = line.replace('title:', '').strip().strip('"').strip("'")
            elif line.startswith('description:'):
                description = line.replace('description:', '').strip().strip('"').strip("'")
    
    # 容错降级：如果写博客时没写 description，就截取正文前 100 字作为语义特征
    if not description:
        body = content.split('---')[-1].strip()
        # 过滤掉一些 markdown 语法符号
        body_clean = re.sub(r'[#\*`\[\]\-]', '', body)
        description = body_clean[:100].replace('\n', ' ') + '...'
        
    return title, description

def main():
    print("===> MLOps: 正在加载开源轻量级 Embedding 模型...")
    model = SentenceTransformer('all-MiniLM-L6-v2')

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("错误: 缺少 Supabase 环境变量！")
        return
    supabase: Client = create_client(url, key)

    # 自动扫描你本地所有的 blog 文章文件（支持 .md 和 .mdx）
    search_path = os.path.join('src', 'content', 'blog', '**', '*.md*')
    post_files = glob.glob(search_path, recursive=True)

    print(f"===> 找到 {len(post_files)} 篇本地博客文章，开始生成语义向量...")

    for file_path in post_files:
        # 获取文件名（不带后缀）作为 Astro 默认的 id / slug
        file_name = os.path.basename(file_path)
        slug = os.path.splitext(file_name)[0]
        
        # 提取真实文章的标题和描述
        title, description = parse_markdown_frontmatter(file_path)
        if not title:
            title = slug 
            
        # 拼接核心文本特征
        text_to_embed = f"{title} {description}"
        
        print(f"正在为文章 [{slug}] 生成深度学习语义向量...")
        # 向量化推理 (384维)
        embedding = model.encode(text_to_embed).tolist()

        # upsert 写入数据库：如果 slug 已存在就更新特征，不存在就新建
        supabase.table("post_embeddings").upsert({
            "slug": slug,
            "title": title,
            "description": description,
            "embedding": embedding
        }).execute()

    print("===> 本地真实数据 MLOps 同步成功！")

if __name__ == "__main__":
    main()