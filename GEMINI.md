Project Context: MathVerse (Full Stack AI Math Blog)0. 元指令 (Meta-Instructions)致 AI Agent: 这是一个基于 Astro + React + Supabase 的全栈数学博客项目。请仔细阅读本文件理解架构、数据库结构和开发流程。在执行任务时，请严格遵守 "Directory Structure" 和 "Development Phases" 中的规范。1. 角色定义 (Role)你是一名精通 Astro, React, PostgreSQL (Supabase) 和 Vector Machine Learning 的高级全栈架构师。你的目标是协助用户构建一个高性能、Git 驱动的数学博客。核心亮点：完美数学渲染：支持复杂的 LaTeX 公式 (MathJax)。动态数据可视化：基于 Recharts/ForceGraph 的流量看板和知识图谱。AI 驱动的个性化系统：利用 Vector Embeddings 和 加权移动平均算法 实现“阅读即训练”的实时推荐，无需离线训练模型。2. 技术栈架构 (Tech Stack)Framework: Astro (SSG Mode) - 静态生成，极致性能。Frontend: React (Hooks, Components) - 处理动态交互。Styling: Tailwind CSS + @tailwindcss/typography。Math Engine: remark-math + rehype-mathjax (服务端渲染 LaTeX)。Database: Supabase (PostgreSQL + pgvector)。Backend Logic: Supabase Edge Functions (Deno) - 处理向量加权运算。AI Model: OpenAI text-embedding-3-small (Via API)。Deployment: AWS Amplify。3. 项目目录规范 (Directory Structure)/
├── supabase/
│   └── functions/
│       └── update-interest/      # Edge Function: 更新用户兴趣画像
│           └── index.ts
├── scripts/
│   └── generate-embeddings.js    # Node脚本: 批量生成文章向量 (本地运行)
├── src/
│   ├── components/
│   │   ├── ViewCounter.jsx       # 浏览计数组件
│   │   ├── KnowledgeGraph.jsx    # 知识图谱组件 (react-force-graph)
│   │   ├── Recommendation.jsx    # "为你推荐"列表组件
│   │   └── AdminGuard.jsx        # 管理员权限保护组件
│   ├── hooks/
│   │   └── useUserTracker.js     # 用户行为追踪 Hook
│   ├── layouts/
│   │   └── BlogPost.astro        # 文章通用布局
│   ├── lib/
│   │   └── supabase.ts           # 单例 Supabase 客户端
│   ├── pages/
│   │   └── blog/
│   │       └── [slug].mdx        # 博客文章内容 (Markdown + JSX)
├── astro.config.mjs              # Astro 核心配置
└── amplify.yml                   # AWS 构建配置
4. 开发阶段任务 (Development Phases)Phase 1: 初始化 (Setup)Command: npm create astro@latest my-math-blog (Template: Empty/Blog, TS: Yes).Integrations: npx astro add react tailwind.Dependencies:npm install remark-math rehype-mathjax @supabase/supabase-js openai dotenv react-force-graph-2d recharts
Phase 2: 配置 Astro (Math Config)修改 astro.config.mjs 以支持 MathJax：import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import remarkMath from 'remark-math';
import rehypeMathjax from 'rehype-mathjax';

export default defineConfig({
  integrations: [react(), tailwind()],
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      [rehypeMathjax, { tex: { tags: 'ams', processEscapes: true } }]
    ],
  },
});
Phase 3: 数据库架构 (Database Schema)状态：用户已在 Supabase Dashboard 完成配置。以下是 SQL 备份以供参考：-- 1. 启用向量扩展
create extension if not exists vector;

-- 2. 基础表结构
create table public.post_meta ( slug text primary key, views bigint default 0 );
create table public.daily_stats ( slug text, date date default current_date, views int default 0, primary key(slug, date) );
create table public.post_embeddings ( id bigserial primary key, slug text unique, title text, embedding vector(1536) );

-- 3. 用户画像表 (ML Core)
create table public.user_history ( id bigserial primary key, user_id uuid references auth.users(id), slug text, viewed_at timestamptz default now() );
create table public.user_profiles ( user_id uuid primary key references auth.users(id), interest_embedding vector(1536), updated_at timestamptz default now() );

-- 4. 安全策略 (RLS)
alter table public.post_meta enable row level security;
alter table public.post_embeddings enable row level security;
alter table public.user_history enable row level security;
alter table public.user_profiles enable row level security;

-- 策略定义
create policy "Public Read Meta" on public.post_meta for select using (true);
create policy "Public Read Embeddings" on public.post_embeddings for select using (true);
create policy "User Manage History" on public.user_history using (auth.uid() = user_id);
create policy "User Read Profile" on public.user_profiles for select using (auth.uid() = user_id);

-- 5. RPC: 浏览计数 (同时更新总数和每日统计)
create or replace function increment_views(row_slug text) returns void as $$
begin
  insert into public.post_meta (slug, views) values (row_slug, 1) on conflict(slug) do update set views = post_meta.views + 1;
  insert into public.daily_stats (slug, date, views) values (row_slug, current_date, 1) on conflict(slug, date) do update set views = daily_stats.views + 1;
end;
$$ language plpgsql;

-- 6. RPC: 相似度匹配 (知识图谱用)
create or replace function match_posts (query_embedding vector(1536), match_threshold float, match_count int, current_slug text)
returns table (slug text, title text, similarity float) language plpgsql as $$
begin
  return query select slug, title, 1 - (embedding <=> query_embedding) as similarity
  from post_embeddings where 1 - (embedding <=> query_embedding) > match_threshold and slug != current_slug
  order by embedding <=> query_embedding limit match_count;
end;
$$;

-- 7. RPC: 个性化推荐 (基于用户画像)
create or replace function get_personalized_recommendations(p_user_id uuid, match_count int default 5)
returns table (slug text, title text, similarity float) language plpgsql as $$
declare v_user_interest vector(1536);
begin
  select interest_embedding into v_user_interest from user_profiles where user_id = p_user_id;
  if v_user_interest is null then return query select slug, title, 0.0::float from post_embeddings limit match_count;
  else return query select slug, title, 1 - (embedding <=> v_user_interest) as sim from post_embeddings
    where slug not in (select slug from user_history where user_id = p_user_id order by viewed_at desc limit 10)
    order by embedding <=> v_user_interest limit match_count;
  end if;
end;
$$;
Phase 4: 后端逻辑 (Edge Function ML)这是实现加权移动平均算法的地方。初始化: supabase functions new update-interest.逻辑:接收 article_slug 和 user_id。获取文章向量 (post_embeddings)。获取用户旧向量 (user_profiles)。计算 NewVector = OldVector * (1-alpha) + ArticleVector * alpha (alpha 建议 0.15)。更新 user_profiles。Phase 5: 数据流与脚本 (Data Pipeline)脚本路径: scripts/generate-embeddings.js功能: 遍历 src/pages/blog/*.mdx -> 提取文本 -> OpenAI API -> Supabase post_embeddings。权限: 此脚本运行在本地，需读取 .env 中的 SUPABASE_SERVICE_ROLE_KEY (严禁暴露给前端)。Phase 6: 前端组件 (Frontend Components)ViewCounter.jsx: 挂载时调用 increment_views RPC。KnowledgeGraph.jsx: 根据当前文章向量，调用 match_posts RPC，渲染 2D 力导向图。Recommendation.jsx: 调用 get_personalized_recommendations RPC，显示“猜你喜欢”。useUserTracker.js (Hook):监听用户停留时长 (>30s)。调用 supabase.functions.invoke('update-interest') 触发学习。Phase 7: 部署 (Deployment)amplify.yml:version: 1
frontend:
  phases:
    preBuild:
      commands: [npm ci]
    build:
      commands: [npm run build]
  artifacts:
    baseDirectory: dist
    files: ['**/*']
  cache:
    paths: [node_modules/**/*]
Environment Variables (AWS Amplify Console):PUBLIC_SUPABASE_URL: 你的 Supabase URL。PUBLIC_SUPABASE_ANON_KEY: 你的 Supabase Anon Key。5. 关键操作指南 (Operational Guide)怎么写文章？在 src/pages/blog/ 新建 .mdx 文件。使用 Frontmatter 定义 title, date 等元数据。正文使用 Markdown，数学公式用 $$...$$ 包裹 (LaTeX)。需要交互组件时，直接 import Component from '../../components/...'。怎么更新 AI 数据？每次发布新文章或修改文章后，在本地终端运行：node scripts/generate-embeddings.js
这将使新文章进入推荐系统和知识图谱网络。怎么调试？运行 npm run dev，在浏览器打开 localhost:4321，配合 VS Code 进行实时预览。