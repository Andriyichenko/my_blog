import { useState, useEffect, useCallback } from 'react';

export default function FloatingTOC({ headings: initialHeadings = [] }) {
  const [activeId, setActiveId] = useState('');
  const [headings, setHeadings] = useState(initialHeadings);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // 如果没有传入 headings，从 DOM 中提取
  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialHeadings.length === 0) {
        const articleHeadings = document.querySelectorAll('article h2, article h3, article h4');
        const extractedHeadings = Array.from(articleHeadings).map((h) => ({
          depth: parseInt(h.tagName.charAt(1)),
          slug: h.id,
          text: h.textContent?.replace(/^#\s*/, '') || '',
        })).filter(h => h.slug && h.text);
        
        if (extractedHeadings.length > 0) {
          setHeadings(extractedHeadings);
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [initialHeadings]);

  // 滚动进度检测
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection Observer 监听活动标题
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter(e => e.isIntersecting);
        if (visibleEntries.length > 0) {
          const sorted = visibleEntries.sort((a, b) => 
            a.boundingClientRect.top - b.boundingClientRect.top
          );
          setActiveId(sorted[0].target.id);
        }
      },
      { root: null, rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    );

    headings.forEach((heading) => {
      const element = document.getElementById(heading.slug);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [headings]);

  // 点击跳转
  const handleClick = useCallback((slug) => {
    const element = document.getElementById(slug);
    if (element) {
      const offset = 80;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
    setIsExpanded(false);
  }, []);

  if (headings.length === 0) return null;

  const activeIndex = headings.findIndex(h => h.slug === activeId);
  const currentHeading = headings.find(h => h.slug === activeId);

  return (
    <>
      {/* 桌面端 - 右侧玻璃进度杆 + 悬停目录 */}
      <div 
        className="fixed right-4 top-1/2 -translate-y-1/2 z-40 hidden xl:flex flex-col items-center"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 悬停时显示的完整目录 */}
        <div className={`
          absolute right-12 top-1/2 -translate-y-1/2
          transition-all duration-300 ease-out
          ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}
        `}>
          <div className="bg-white/92 dark:bg-zinc-900/92 backdrop-blur-xl 
            rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50
            shadow-2xl shadow-black/10 dark:shadow-black/30
            py-4 px-5 min-w-[190px] max-w-[240px]">
            <div className="flex items-center justify-between mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="font-serif italic">TOC</span>
              <span className="font-mono text-purple-500">{Math.round(scrollProgress)}%</span>
            </div>
            <ul className="space-y-1.5">
              {headings.map((heading, index) => {
                const isActive = heading.slug === activeId;
                const isPast = activeIndex >= 0 && index < activeIndex;
                return (
                  <li key={heading.slug} style={{ paddingLeft: `${(heading.depth - 2) * 8}px` }}>
                    <button
                      onClick={() => handleClick(heading.slug)}
                      className={`
                        text-left text-[11px] leading-tight py-1 w-full
                        transition-colors duration-200 line-clamp-1 rounded-md px-1
                        ${isActive 
                          ? 'text-purple-600 dark:text-purple-400 font-medium bg-purple-50 dark:bg-purple-900/20' 
                          : isPast
                            ? 'text-zinc-400 dark:text-zinc-600'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-purple-500 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60'
                        }
                      `}
                    >
                      {heading.text}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* 竖向进度杆 */}
        <div className="relative w-4 h-56 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/60 dark:border-zinc-800/60 rounded-full shadow-lg shadow-black/10 flex items-center justify-center">
          <div className="w-1 bg-zinc-200 dark:bg-zinc-800 h-[210px] rounded-full overflow-hidden relative">
            <div
              className="absolute bottom-0 w-full bg-gradient-to-t from-purple-500 via-fuchsia-500 to-blue-500 rounded-full"
              style={{ height: `${Math.min(100, Math.max(0, scrollProgress))}%` }}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white dark:bg-zinc-900 border border-purple-400 shadow-[0_0_8px_rgba(129,140,248,0.55)] transition-all duration-200"
              style={{ bottom: `${Math.min(100, Math.max(0, scrollProgress))}%` }}
            />
          </div>
        </div>
        
        {/* 进度百分比 */}
        <span className="mt-2 text-[10px] font-mono text-purple-500/90 bg-white/80 dark:bg-zinc-900/80 px-2 py-1 rounded-full border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm">
          {Math.round(scrollProgress)}%
        </span>
      </div>

      {/* 移动端/平板 - 右下角迷你悬浮按钮 */}
      <div className="fixed bottom-6 right-4 z-40 xl:hidden">
        {/* 展开的目录面板 */}
        <div className={`
          absolute bottom-14 right-0 w-64
          transition-all duration-300 ease-out
          ${isExpanded 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
          }
        `}>
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl
            rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50
            shadow-2xl shadow-black/10 dark:shadow-black/30
            overflow-hidden max-h-[50vh] overflow-y-auto">
            
            {/* 头部 */}
            <div className="sticky top-0 px-4 py-3 
              bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md
              border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  目录 · {headings.length}章节
                </span>
                <span className="text-[10px] font-mono text-purple-500">
                  {Math.round(scrollProgress)}%
                </span>
              </div>
            </div>
            
            {/* 目录列表 */}
            <ul className="p-2">
              {headings.map((heading, index) => {
                const isActive = heading.slug === activeId;
                const isPast = activeIndex >= 0 && index < activeIndex;
                return (
                  <li key={heading.slug} style={{ paddingLeft: `${(heading.depth - 2) * 12}px` }}>
                    <button
                      onClick={() => handleClick(heading.slug)}
                      className={`
                        flex items-center gap-2 w-full text-left
                        py-2 px-3 rounded-lg text-sm
                        transition-all duration-200
                        ${isActive 
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium' 
                          : isPast
                            ? 'text-zinc-400 dark:text-zinc-600'
                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }
                      `}
                    >
                      <span className={`
                        w-1.5 h-1.5 rounded-full shrink-0
                        ${isActive 
                          ? 'bg-purple-500' 
                          : isPast 
                            ? 'bg-purple-300 dark:bg-purple-700'
                            : 'bg-zinc-300 dark:bg-zinc-600'
                        }
                      `} />
                      <span className="line-clamp-1">{heading.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* 迷你圆形按钮 - 优化设计 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            relative w-14 h-14 rounded-full
            bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-800 dark:to-zinc-900
            border border-zinc-200/80 dark:border-zinc-700/80
            shadow-xl shadow-purple-500/10 dark:shadow-purple-900/20
            flex items-center justify-center
            transition-all duration-300 ease-out
            hover:shadow-2xl hover:shadow-purple-500/20 hover:scale-105
            active:scale-95
            ${isExpanded ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : ''}
          `}
        >
          {/* 外圈背景环 */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="28" cy="28" r="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-zinc-200/60 dark:text-zinc-700/60"
            />
            {/* 渐变进度环 */}
            <circle
              cx="28" cy="28" r="24"
              fill="none"
              stroke="url(#progressGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 24}`}
              strokeDashoffset={`${2 * Math.PI * 24 * (1 - scrollProgress / 100)}`}
              className="transition-all duration-500 ease-out"
              style={{ filter: 'drop-shadow(0 0 3px rgba(139, 92, 246, 0.4))' }}
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#c4b5fd" />
                <stop offset="50%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* 中心内容 */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            <span className="text-[11px] font-bold bg-gradient-to-br from-purple-600 to-violet-600 bg-clip-text text-transparent">
              {Math.round(scrollProgress)}%
            </span>
            <span className="text-[8px] text-zinc-400 dark:text-zinc-500 font-medium -mt-0.5">TOC</span>
          </div>
        </button>
        
        {/* 当前章节提示 - 点击按钮时短暂显示 */}
        {currentHeading && !isExpanded && (
          <div className="absolute bottom-14 right-0 
            bg-zinc-900/90 dark:bg-zinc-100/90 
            text-white dark:text-zinc-900
            text-xs px-3 py-1.5 rounded-lg
            whitespace-nowrap max-w-[200px] truncate
            opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
            {currentHeading.text}
          </div>
        )}
      </div>

      {/* 点击外部关闭 */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-30 xl:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </>
  );
}
