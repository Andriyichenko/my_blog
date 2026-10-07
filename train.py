# train.py
# 为 src/content/blog 下的每篇文章生成语义向量，写入 Supabase 的 post_embeddings，
# 并计算每篇文章的 top-k 相似文章写入 recommendations 列。
import os
import sys
import glob
import re
from datetime import date, datetime
import numpy as np
import yaml
from supabase import create_client, Client
from sentence_transformers import SentenceTransformer

try:
    from dotenv import load_dotenv
    load_dotenv()  # 本地运行时读取 .env；GitHub Actions 中直接用 secrets 注入的环境变量
except ImportError:
    pass

MODEL_NAME = 'all-MiniLM-L6-v2'  # 384 维，需与数据库 embedding 列维度一致
TOP_K = 5
FRONTMATTER_RE = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)
DATE_FORMATS = ('%Y-%m-%d', '%Y/%m/%d', '%b %d %Y', '%B %d %Y', '%Y-%m-%dT%H:%M:%S')


def parse_pub_date(value):
    """把 frontmatter 的 pubDate / date 转成 ISO 字符串（写入 post_embeddings.pub_date）"""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        text = value.strip()
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(text, fmt).date().isoformat()
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(text).isoformat()
        except ValueError:
            pass
    return None


def astro_slug(file_path, frontmatter_slug=None):
    """与 Astro glob loader 的 post.id 保持一致：优先 frontmatter slug，否则按 github-slugger 规则处理文件名"""
    if frontmatter_slug:
        return str(frontmatter_slug).strip()
    name = os.path.splitext(os.path.basename(file_path))[0].lower()
    name = re.sub(r'[^\w\- ]', '', name)  # 去掉括号等符号，例如 "feynman-propagator(1)" -> "feynman-propagator1"
    return name.replace(' ', '-')


def parse_markdown(file_path):
    """提取 Astro 文章的 title、description 和发布日期"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    frontmatter, body = {}, content
    match = FRONTMATTER_RE.match(content)
    if match:
        try:
            frontmatter = yaml.safe_load(match.group(1)) or {}
        except yaml.YAMLError as e:
            print(f"  ⚠️ frontmatter 解析失败 ({file_path}): {e}")
        body = content[match.end():]

    title = str(frontmatter.get('title') or '').strip()
    description = str(frontmatter.get('description') or '').strip()
    raw_date = frontmatter.get('pubDate') or frontmatter.get('date')
    pub_date = parse_pub_date(raw_date)
    if raw_date and not pub_date:
        print(f"  ⚠️ 无法解析发布日期 ({file_path}): {raw_date!r}")

    # 没description，就截取正文前 100 字作为语义特征
    if not description:
        body_clean = re.sub(r'[#\*`\$\-\{\}]', '', body)
        body_clean = re.sub(r'\s+', ' ', body_clean).strip()
        description = body_clean[:100] + '...'

    return title, description, pub_date, astro_slug(file_path, frontmatter.get('slug'))


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    # 写入需要 service_role key（绕过 RLS）
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    missing = [n for n, v in [("SUPABASE_URL", url), ("SUPABASE_SERVICE_ROLE_KEY", key)] if not v]
    if missing:
        sys.exit(f"❌ Fail! 缺少 Supabase 环境变量: {', '.join(missing)}")
    return create_client(url, key)


def compute_recommendations(slugs, embeddings, top_k=TOP_K):
    """在内存中计算余弦相似度，返回 {slug: [推荐 slug...]}"""
    vecs = np.asarray(embeddings, dtype=np.float32)
    vecs /= np.linalg.norm(vecs, axis=1, keepdims=True)
    sims = vecs @ vecs.T
    np.fill_diagonal(sims, -np.inf)  # 排除自己

    result = {}
    for i, slug in enumerate(slugs):
        order = np.argsort(-sims[i])[:min(top_k, len(slugs) - 1)]
        result[slug] = [slugs[j] for j in order]
    return result


def main():
    supabase = get_supabase()

    post_files = sorted(glob.glob(os.path.join('src', 'content', 'blog', '**', '*.md*'), recursive=True))
    post_files = [p for p in post_files if p.endswith(('.md', '.mdx'))]
    if not post_files:
        sys.exit("❌ 没有找到任何文章，请确认在仓库根目录运行")
    print(f"===> 找到 {len(post_files)} 篇 Blogs")

    posts = []
    for file_path in post_files:
        title, description, pub_date, slug = parse_markdown(file_path)
        posts.append({"slug": slug, "title": title or slug, "description": description, "pub_date": pub_date})
        print(f"  📄 {os.path.basename(file_path)} → slug: {slug}")

    print(f"\n===> 加载模型 {MODEL_NAME} 并生成语义向量...")
    model = SentenceTransformer(MODEL_NAME)
    texts = [f"{p['title']} {p['description']}" for p in posts]  # pub_date 不参与向量
    embeddings = model.encode(texts).tolist()

    slugs = [p['slug'] for p in posts]
    recs = compute_recommendations(slugs, embeddings)

    rows = [
        {**p, "embedding": emb, "recommendations": recs[p['slug']]}
        for p, emb in zip(posts, embeddings)
    ]
    # 只写这几列，不会覆盖 featured / featured_order
    supabase.table("post_embeddings").upsert(rows, on_conflict="slug").execute()
    for slug in slugs:
        print(f"✅ [{slug}] → {recs[slug]}")

    # 数据库中存在但本地已删除的文章：只提示，不自动删除（避免误删 featured 配置）
    existing = supabase.table("post_embeddings").select("slug").execute().data or []
    stale = sorted({r['slug'] for r in existing} - set(slugs))
    if stale:
        print(f"\n⚠️ 以下 slug 在数据库中存在但本地没有对应文章（不会被推荐）: {stale}")

    print(f"\n✅ ===> MLOps 同步成功！共 {len(rows)} 篇")


if __name__ == "__main__":
    main()
