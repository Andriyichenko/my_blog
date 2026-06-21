import { useState, useRef, useEffect } from 'react';

const ANGLE_STEP = 17;
const R = 340;
const ARC_H = 41;
const ARC_W = 330;

export default function CircularPeopleSelector({ people, initialSlug }) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(people.findIndex((p) => p.slug === initialSlug), 0)
  );
  const [visualOffset, setVisualOffset] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const isAnimating = useRef(false);
  const rafRef = useRef(null);

  const person = people[currentIndex];

  function getSlotStyle(offset) {
    const angleDeg = offset * ANGLE_STEP;
    const angleRad = (angleDeg * Math.PI) / 180;
    const cx = ARC_W / 2;
    const x = cx + R * Math.sin(angleRad);
    const y = ARC_H + R * (Math.cos(angleRad) - 1);
    const absOff = Math.abs(offset);
    const isCenter = absOff === 0;
    const size = isCenter ? 74 : absOff === 1 ? 52 : 36;
    const opacity = isCenter ? 1 : absOff === 1 ? 0.7 : 0.35;
    const zIndex = 10 - absOff * 2;

    return {
      position: 'absolute',
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      opacity,
      zIndex,
      transition: visualOffset === 0
        ? 'left 0.42s cubic-bezier(0.34,1.56,0.64,1), top 0.42s cubic-bezier(0.34,1.56,0.64,1), width 0.35s ease, height 0.35s ease, opacity 0.3s ease'
        : 'none',
    };
  }

  function goTo(dir) {
    if (isAnimating.current) return;
    const nextIndex = (currentIndex + dir + people.length) % people.length;
    isAnimating.current = true;

    setVisualOffset(dir);
    setCurrentIndex(nextIndex);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setVisualOffset(0);
        setAnimKey((k) => k + 1);
        setTimeout(() => {
          isAnimating.current = false;
        }, 420);
      });
    });
  }

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const slots = [-2, -1, 0, 1, 2];

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', flexDirection: 'column' }}>

      {/* 顶部导航 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        position: 'sticky', top: 60, zIndex: 40,
        background: 'rgba(255,255,255,0)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(108,99,255,0.08)',
      }}>
        <a href="/about" style={{ color: '#999', textDecoration: 'none', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← About
        </a>
        {/* 顶部名字：日文名 + 英文名小字 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#1a1a2e', lineHeight: 1.3 }}>
            {person.name}
          </div>
          {person.nameEn && (
            <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.3 }}>
              {person.nameEn}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {people.map((_, i) => (
            <div key={i} style={{
              width: i === currentIndex ? 18 : 6, height: 6, borderRadius: 3,
              background: i === currentIndex ? '#6c63ff' : '#ddd',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>
      </div>

      {/* 弧形选择器 */}
      <div style={{
        position: 'sticky', top: 109, zIndex: 30,
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.95) 70%, rgba(255,255,255,0) 100%)',
        paddingTop: 10,
      }}>
        <div style={{ position: 'relative' }}>
          {/* 左箭头 */}
          <button
            onClick={() => goTo(-1)}
            style={{
              position: 'absolute', left: 0, top: '50%',
              transform: 'translateY(-50%)', zIndex: 50,
              background: 'linear-gradient(to right, rgba(255,255,255,0.9), rgba(255,255,255,0))',
              border: 'none', cursor: 'pointer',
              width: 48, height: 64,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
              paddingLeft: 8,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>

          {/* 右箭头 */}
          <button
            onClick={() => goTo(1)}
            style={{
              position: 'absolute', right: 0, top: '50%',
              transform: 'translateY(-50%)', zIndex: 50,
              background: 'linear-gradient(to left, rgba(255,255,255,0.9), rgba(255,255,255,0))',
              border: 'none', cursor: 'pointer',
              width: 48, height: 64,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              paddingRight: 8,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>

          <div style={{
            position: 'relative', height: ARC_H + 40,
            display: 'flex', justifyContent: 'center',
            overflow: 'clip', overflowClipMargin: '40px 0',
          }}>
            {/* SVG 弧线 */}
            <svg width={ARC_W} height={ARC_H + 40}
              style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}
            >
              <defs>
                <linearGradient id="bowlGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(167,139,250,0)" />
                  <stop offset="30%" stopColor="#a78bfa" />
                  <stop offset="50%" stopColor="#6c63ff" />
                  <stop offset="70%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="rgba(167,139,250,0)" />
                </linearGradient>
              </defs>
              {(() => {
                const halfAngle = 48 * Math.PI / 180;
                const cx = ARC_W / 2;
                const x1 = cx - R * Math.sin(halfAngle);
                const y1 = ARC_H + R * (Math.cos(halfAngle) - 1);
                const x2 = cx + R * Math.sin(halfAngle);
                return (
                  <>
                    <path d={`M ${x1} ${y1} A ${R} ${R} 0 0 0 ${x2} ${y1}`} fill="none" stroke="#e5e2f8" strokeWidth="1" />
                    {(() => {
                      const ha2 = 26 * Math.PI / 180;
                      const hx1 = cx - R * Math.sin(ha2);
                      const hy1 = ARC_H + R * (Math.cos(ha2) - 1);
                      const hx2 = cx + R * Math.sin(ha2);
                      return <path d={`M ${hx1} ${hy1} A ${R} ${R} 0 0 0 ${hx2} ${hy1}`} fill="none" stroke="url(#bowlGrad)" strokeWidth="2.5" strokeLinecap="round" />;
                    })()}
                    <circle cx={x1} cy={y1} r={3.5} fill="#c4bfef" />
                    <circle cx={x2} cy={y1} r={3.5} fill="#c4bfef" />
                    {[-2,-1,0,1,2].map(i => {
                      const a = i * ANGLE_STEP * Math.PI / 180;
                      const px = cx + R * Math.sin(a);
                      const py = ARC_H + R * (Math.cos(a) - 1);
                      const len = i === 0 ? 10 : 6;
                      return <line key={i} x1={px} y1={py} x2={px - Math.sin(a)*len} y2={py + Math.cos(a)*len} stroke={i === 0 ? '#6c63ff' : '#c9c5ee'} strokeWidth={i === 0 ? 2 : 1} strokeLinecap="round" />;
                    })}
                  </>
                );
              })()}
            </svg>

            {/* 头像容器 */}
            <div style={{
              position: 'absolute', top: 0, left: '50%',
              transform: 'translateX(-50%)',
              width: ARC_W, height: ARC_H + 70,
              overflow: 'clip', overflowClipMargin: '40px 0px',
            }}>
              {slots.map((offset) => {
                const visualSlot = offset + visualOffset;
                const dataIndex = (currentIndex + offset + people.length) % people.length;
                const style = getSlotStyle(visualSlot);
                const p = people[dataIndex];
                const isCenter = offset === 0;

                return (
                  <div key={offset} style={style} onClick={() => { if (offset !== 0) goTo(offset); }}>
                    <div style={{
                      width: '100%', height: '100%', borderRadius: '50%',
                      border: isCenter ? '2.5px solid #6c63ff' : '2px solid rgba(108,99,255,0.2)',
                      boxShadow: isCenter ? '0 0 0 4px rgba(108,99,255,0.12), 0 6px 20px rgba(108,99,255,0.2)' : 'none',
                      overflow: 'hidden',
                      cursor: offset === 0 ? 'default' : 'pointer',
                      background: '#ddd',
                      transition: 'border 0.3s, box-shadow 0.3s',
                    }}>
                      <img src={p.avatar} alt={p.name}
                        onError={e => { e.currentTarget.src = '/authors/default.jpg'; }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{
                      position: 'absolute', top: '100%', left: '50%',
                      transform: 'translateX(-50%)', marginTop: 4,
                      fontSize: isCenter ? 11 : 9, fontWeight: isCenter ? 600 : 400,
                      color: isCenter ? '#6c63ff' : '#aaa',
                      whiteSpace: 'nowrap', textAlign: 'center', pointerEvents: 'none',
                      transition: 'font-size 0.3s, color 0.3s',
                    }}>
                      {p.slug}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div key={animKey} style={{
        flex: 1, padding: '8px 20px 60px',
        maxWidth: 600, margin: '0 auto', width: '100%',
        animation: 'fadeUp 0.4s ease both',
      }}>
        <style>{`@keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }`}</style>

        {/* 头部：头像 + 姓名 + role */}
        <div style={{ display:'flex', alignItems:'center', gap:16, background:'#fff', borderRadius:18, padding:'18px', boxShadow:'0 2px 16px rgba(108,99,255,0.07)', marginBottom:14 }}>
          <div style={{ width:72, height:72, borderRadius:16, overflow:'hidden', flexShrink:0, boxShadow:'0 4px 14px rgba(108,99,255,0.18)' }}>
            <img src={person.avatar} alt={person.name} onError={e=>{e.currentTarget.src='/authors/default.jpg'}} style={{width:'100%',height:'100%',objectFit:'cover'}} />
          </div>
          <div>
            {/* 日文名 */}
            <div style={{ fontWeight:700, fontSize:20, color:'#1a1a2e', lineHeight:1.3 }}>
              {person.name}
            </div>
            {/* 英文名（仅当 nameEn 存在时显示） */}
            {person.nameEn && (
              <div style={{ fontSize:13, color:'#999', marginBottom:4, lineHeight:1.3 }}>
                {person.nameEn}
              </div>
            )}
            <span style={{ display:'inline-block', background:'rgba(108,99,255,0.1)', color:'#6c63ff', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:500 }}>
              {person.role}
            </span>
          </div>
        </div>

        {/* About */}
        <div style={{ background:'#fff', borderRadius:18, padding:'18px', boxShadow:'0 2px 16px rgba(108,99,255,0.07)', marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'#aaa', letterSpacing:1, marginBottom:10, textTransform:'uppercase' }}>About</div>
          <p style={{ margin:0, fontSize:14.5, color:'#444', lineHeight:1.8 }}>{person.bio || person.shortBio}</p>
        </div>

        {/* Email */}
        {person.email && (
          <div style={{ background:'#fff', borderRadius:18, padding:'6px 8px', boxShadow:'0 2px 16px rgba(108,99,255,0.07)', marginBottom:14 }}>
            <InfoRow
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>}
              label="Email" value={person.email} href={`mailto:${person.email}`}
            />
          </div>
        )}

        {/* 社交链接 */}
        {(person.github || person.x || person.website) && (
          <div style={{ background:'#fff', borderRadius:18, padding:'6px 8px', boxShadow:'0 2px 16px rgba(108,99,255,0.07)', marginBottom:14 }}>
            {person.github && (
              <InfoRow
                icon={<svg viewBox="0 0 24 24" fill="currentColor" style={{width:20,height:20,color:'#333'}}><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>}
                label="GitHub" value={person.github} href={person.github}
              />
            )}
            {person.x && (
              <InfoRow
                icon={<svg viewBox="0 0 24 24" fill="currentColor" style={{width:20,height:20,color:'#000'}}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>}
                label="X" value={person.x} href={person.x}
              />
            )}
            {person.website && (
              <InfoRow
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:20,height:20,color:'#6c63ff'}}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>}
                label="Private HP" value={person.website} href={person.website}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, href }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 10px', borderRadius:12, textDecoration:'none', transition:'background 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8f7ff'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ width:28, display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:11, color:'#bbb', marginBottom:1 }}>{label}</div>
        <div style={{ fontSize:13.5, color:'#555', fontWeight:500 }}>{value}</div>
      </div>
      <span style={{ color:'#ccc', fontSize:16 }}>›</span>
    </a>
  );
}