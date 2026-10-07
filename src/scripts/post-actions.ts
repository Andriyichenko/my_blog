// 文章的「いいね」「シェア」客户端逻辑（配合 src/components/PostActions.astro）
// - 访客用浏览器本地生成的随机 UUID 识别，数据库只存它的 sha256，不收集 IP
// - 点赞是乐观更新：先改 UI，再把「期望状态」同步到 Supabase；连续点击只会发送最终状态
// - 页面上的多个 PostActions 共享同一份状态

type Engagement = { like_count: number; share_count: number; liked: boolean };
type Channel = 'copy' | 'native' | 'x' | 'line' | 'hatena' | 'facebook';

const VISITOR_KEY = 'rmb:visitor-id';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let memoryVisitorId: string | null = null;

function randomUUID(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function getVisitorId(): string {
    try {
        let id = localStorage.getItem(VISITOR_KEY);
        if (!id || !UUID_RE.test(id)) {
            id = randomUUID();
            localStorage.setItem(VISITOR_KEY, id);
        }
        return id;
    } catch {
        // 隐私模式等无法使用 localStorage 时，仅在本次页面内有效
        return (memoryVisitorId ??= randomUUID());
    }
}

const numberFormat = new Intl.NumberFormat('ja-JP');
const fmt = (n: number | null) => (n === null ? '–' : numberFormat.format(n));

// ---- Toast ----
let toastEl: HTMLDivElement | null = null;
let toastTimer: number | undefined;

function toast(message: string) {
    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.setAttribute('role', 'status');
        toastEl.setAttribute('aria-live', 'polite');
        toastEl.className =
            'fixed left-1/2 bottom-6 z-[100] -translate-x-1/2 translate-y-2 opacity-0 pointer-events-none ' +
            'rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white ' +
            'shadow-lg shadow-black/10 transition-all duration-200';
        document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.remove('opacity-0', 'translate-y-2');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl?.classList.add('opacity-0', 'translate-y-2'), 2200);
}

async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
    }
}

export function initPostActions() {
    const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-post-actions]'));
    if (roots.length === 0) return;

    const { slug = '', title = document.title, sbUrl, sbKey } = roots[0].dataset;
    const enabled = Boolean(slug && sbUrl && sbKey);
    const visitorId = getVisitorId();
    const pageUrl = `${location.origin}${location.pathname}`;

    // ---- 状态 ----
    const state: { likeCount: number | null; shareCount: number | null; liked: boolean } = {
        likeCount: null,
        shareCount: null,
        liked: false,
    };
    let server: Engagement = { like_count: 0, share_count: 0, liked: false };
    let wantedLiked: boolean | null = null;
    let syncing = false;

    function render() {
        for (const root of roots) {
            root.dataset.liked = String(state.liked);
            root.querySelectorAll('[data-like]').forEach((btn) => {
                btn.setAttribute('aria-pressed', String(state.liked));
                btn.setAttribute('aria-label', state.liked ? 'いいねを取り消す' : 'いいね');
            });
            root.querySelectorAll('[data-like-count]').forEach((el) => (el.textContent = fmt(state.likeCount)));
            root.querySelectorAll<HTMLElement>('[data-share-count]').forEach((el) => {
                el.textContent = fmt(state.shareCount);
                el.hidden = !state.shareCount;
            });
            root.querySelectorAll<HTMLElement>('[data-share-wrap]').forEach((el) => (el.hidden = !state.shareCount));
        }
    }

    function applyServer(data: Engagement) {
        server = data;
        state.likeCount = data.like_count;
        state.shareCount = data.share_count;
        state.liked = data.liked;
        render();
    }

    async function rpc(fn: string, body: Record<string, unknown>): Promise<Engagement> {
        const res = await fetch(`${sbUrl}/rest/v1/rpc/${fn}`, {
            method: 'POST',
            headers: {
                apikey: sbKey!,
                Authorization: `Bearer ${sbKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`${fn} failed: ${res.status}`);
        return res.json();
    }

    const loaded: Promise<void> = enabled
        ? rpc('get_post_engagement', { p_slug: slug, p_visitor_id: visitorId })
              .then(applyServer)
              .catch((err) => console.warn('[post-actions] load failed', err))
        : Promise.resolve();

    // ---- いいね ----
    async function syncLike() {
        if (syncing) return;
        syncing = true;
        try {
            await loaded;
            // 请求进行中用户又点了，循环会继续发送最新的期望状态
            while (wantedLiked !== null && wantedLiked !== server.liked) {
                server = await rpc('set_post_like', { p_slug: slug, p_visitor_id: visitorId, p_liked: wantedLiked });
            }
            wantedLiked = null;
            applyServer(server);
        } catch (err) {
            console.warn('[post-actions] like failed', err);
            wantedLiked = null;
            applyServer(server);
            toast('通信に失敗しました。時間をおいて再度お試しください');
        } finally {
            syncing = false;
        }
    }

    function onLike(btn: HTMLElement) {
        if (!enabled) {
            toast('いいね機能は現在ご利用いただけません');
            return;
        }
        const next = !state.liked;
        state.liked = next;
        state.likeCount = Math.max(0, (state.likeCount ?? 0) + (next ? 1 : -1));
        render();
        if (next) {
            btn.classList.remove('pa-pop');
            void btn.offsetWidth; // 重新触发动画
            btn.classList.add('pa-pop');
        }
        wantedLiked = next;
        syncLike();
    }

    // ---- シェア ----
    const shareLinks: Record<Exclude<Channel, 'copy' | 'native'>, string> = {
        x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(pageUrl)}`,
        line: `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(pageUrl)}`,
        hatena: `https://b.hatena.ne.jp/add?mode=confirm&url=${encodeURIComponent(pageUrl)}&title=${encodeURIComponent(title)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
    };

    async function recordShare(channel: Channel) {
        if (!enabled) return;
        try {
            const data = await rpc('record_post_share', { p_slug: slug, p_visitor_id: visitorId, p_channel: channel });
            // 只更新分享数，避免覆盖进行中的点赞乐观状态
            server = { ...server, share_count: data.share_count };
            state.shareCount = data.share_count;
            render();
        } catch (err) {
            console.warn('[post-actions] share record failed', err);
        }
    }

    async function onShare(channel: Channel, event: Event) {
        if (channel === 'copy') {
            event.preventDefault();
            if (await copyText(pageUrl)) {
                toast('リンクをコピーしました');
                recordShare('copy');
            } else {
                toast('コピーできませんでした');
            }
        } else if (channel === 'native') {
            event.preventDefault();
            try {
                await navigator.share({ title, url: pageUrl });
                recordShare('native');
            } catch (err) {
                if ((err as DOMException)?.name !== 'AbortError') toast('共有できませんでした');
            }
        } else {
            // <a target="_blank"> 自行打开分享页
            recordShare(channel);
        }
    }

    // ---- シェアメニュー（标题下的变体）----
    function closeMenus(except?: HTMLElement) {
        for (const root of roots) {
            const menu = root.querySelector<HTMLElement>('[data-share-menu]');
            const toggle = root.querySelector<HTMLElement>('[data-share-toggle]');
            if (!menu || !toggle || menu === except) continue;
            menu.hidden = true;
            toggle.setAttribute('aria-expanded', 'false');
        }
    }

    // ---- 绑定 ----
    const canNativeShare = typeof navigator.share === 'function';

    for (const root of roots) {
        root.querySelectorAll<HTMLElement>('[data-like]').forEach((btn) => btn.addEventListener('click', () => onLike(btn)));

        root.querySelectorAll<HTMLElement>('[data-share-channel]').forEach((el) => {
            const channel = el.dataset.shareChannel as Channel;
            if (channel === 'native') el.hidden = !canNativeShare;
            if (el instanceof HTMLAnchorElement && channel in shareLinks) {
                el.href = shareLinks[channel as keyof typeof shareLinks];
            } else if (el instanceof HTMLAnchorElement && channel === 'copy') {
                el.href = pageUrl;
            }
            el.addEventListener('click', (e) => {
                onShare(channel, e);
                closeMenus();
            });
        });

        const toggle = root.querySelector<HTMLElement>('[data-share-toggle]');
        const menu = root.querySelector<HTMLElement>('[data-share-menu]');
        if (!toggle || !menu) continue;

        const items = () => Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([hidden])'));

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = menu.hidden;
            closeMenus(menu);
            menu.hidden = !open;
            toggle.setAttribute('aria-expanded', String(open));
            if (open) items()[0]?.focus();
        });

        menu.addEventListener('keydown', (e) => {
            const list = items();
            const i = list.indexOf(document.activeElement as HTMLElement);
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                list[(i + 1) % list.length]?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                list[(i - 1 + list.length) % list.length]?.focus();
            } else if (e.key === 'Escape') {
                closeMenus();
                toggle.focus();
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!(e.target as HTMLElement).closest('[data-share-menu]')) closeMenus();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenus();
    });

    render();
}
