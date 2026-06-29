# train.py 
import os
import glob
import re
import numpy as np
from supabase import create_client, Client
from sentence_transformers import SentenceTransformer
# from dotenv import load_dotenv

# load_dotenv()


def parse_markdown_frontmatter(file_path):
    """提取 Astro 文章的 title 和 description"""
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
    
    # 没description，就截取正文前 100 字作为语义特征
    if not description:
        body = content.split('---')[-1].strip()
        body_clean = re.sub(r'[#\*`\$\-\n\{\}]', '', body)
        description = body_clean[:100].replace('\n', ' ') + '...'
    
    return title, description

def parse_embedding(embedding):
    """将字符串格式的 embedding 转换为 numpy 数组"""
    if isinstance(embedding, str):
        # 移除方括号并分割
        embedding = embedding.strip('[]').split(',')
        embedding = [float(x.strip()) for x in embedding]
    return np.array(embedding, dtype=np.float32)

def cosine_similarity(a, b):
    """计算两个向量的余弦相似度"""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def generate_recommendations(supabase: Client, slug: str, embedding: list, top_k: int = 5):
    """为指定文章生成 top_k 个推荐"""
    response = supabase.table("post_embeddings").select("slug, title, description, embedding").execute()
    
    if not response.data:
        print(f"⚠️ 数据库中没有其他文章")
        return []
    
    recommendations = []
    current_embedding = parse_embedding(embedding)
    
    for post in response.data:
        if post['slug'] == slug:
            continue
        
        other_embedding = parse_embedding(post['embedding'])
        similarity = cosine_similarity(current_embedding, other_embedding)
        
        recommendations.append({
            'slug': post['slug'],
            'title': post['title'],
            'similarity': similarity
        })
    
    recommendations.sort(key=lambda x: x['similarity'], reverse=True)
    top_recommendations = [r['slug'] for r in recommendations[:top_k]]
    
    supabase.table("post_embeddings").update({
        "recommendations": top_recommendations
    }).eq("slug", slug).execute()
    
    print(f"✅ 为文章 [{slug}] 生成了 {len(top_recommendations)} 个推荐")
    return top_recommendations

def main():
    print("===> MLOps: Loading...")
    model = SentenceTransformer('all-MiniLM-L6-v2')

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("❌ Fail! 缺少 Supabase 环境变量！")
        return
    supabase: Client = create_client(url, key)

    search_path = os.path.join('src', 'content', 'blog', '**', '*.md*')
    post_files = glob.glob(search_path, recursive=True)

    print(f"===> 找到 {len(post_files)} 篇 Blogs")
    
    # 打印所有找到的文件，便于调试
    for file_path in post_files:
        file_name = os.path.basename(file_path)
        slug = os.path.splitext(file_name)[0]
        print(f"  📄 {file_name} → slug: {slug}")

    print(f"\n===> Processing...")

    for file_path in post_files:
        file_name = os.path.basename(file_path)
        slug = os.path.splitext(file_name)[0]
        
        title, description = parse_markdown_frontmatter(file_path)
        if not title:
            title = slug 
            
        text_to_embed = f"{title} {description}"
        
        print(f"正在为文章 [{slug}] 生成深度学习语义向量...")
        embedding = model.encode(text_to_embed).tolist()

        supabase.table("post_embeddings").upsert({
            "slug": slug,
            "title": title,
            "description": description,
            "embedding": embedding
        }).execute()

    print("\n===> 生成推荐关系...")
    response = supabase.table("post_embeddings").select("slug, embedding").execute()
    
    for post in response.data:
        slug = post['slug']
        embedding = post['embedding']
        generate_recommendations(supabase, slug, embedding, top_k=5)

    print("\n✅ ===> MLOps 同步成功！")

if __name__ == "__main__":
    main()
