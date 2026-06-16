import profileImg from '../assets/port_img.jpg';

export const people = [
  {
    slug: 'Andre',
    name: 'Andre YI',
    role: 'Founder / Researcher',
    category: ['math', 'physics'] as const,
    avatar: profileImg,
    email: 'andre@example.com',
    shortBio: '专注于数学、金融工程、人工智能与知识系统设计。',
    bio: `Andre YI 是 Andre's Blog 的创建者，主要关注数学、金融工程、随机过程、人工智能以及个人知识系统的构建。\n\n他的研究兴趣包括随机微积分、Black-Scholes 模型、AI Agent、知识图谱与交互式教育系统。`,
  },
  {
    slug: 'Alice',
    name: 'Alice Chen',
    role: 'Mathematics Contributor',
    category: ['math'] as const,
    avatar: profileImg,
    email: 'alice@example.com',
    shortBio: '关注分析学、概率论与数学教育。',
    bio: `Alice Chen 主要负责数学内容的整理与审校，尤其关注微积分、实分析、概率论与随机过程。\n\n她希望通过更直观的方式解释抽象数学概念。`,
  },
  {
    slug: 'Bob',
    name: 'Bob Wang',
    role: 'Physics Contributor',
    category: ['physics'] as const,
    avatar: profileImg,
    email: 'bob@example.com',
    shortBio: '专注于理论物理与计算物理研究。',
    bio: `Bob Wang 负责物理相关内容的撰写，研究方向包括量子力学、统计力学与计算模拟。\n\n他希望通过可视化手段让物理更易理解。`,
  },
];