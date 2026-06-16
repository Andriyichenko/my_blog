import { useState, useRef } from 'react';

const ANGLE_STEP = 17; // 每格角度（度）
const R = 340;         // 碗形弧半径（越大越平缓）
const ARC_H = 41;     // 弧区容器高度（露出碗口的高度）
const ARC_W = 330;     // 宽度（控制裁切范围）

export default function CircularPeopleSelector({ people, initialSlug }) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(people.findIndex((p) => p.slug === initialSlug), 0)
  );
  const [rotating, setRotating] = useState(false);
  const [rotateDir, setRotateDir] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const isAnimating = useRef(false);

  const person = people[currentIndex];

  // 下半圆坐标计算：圆心在容器顶部以上，头像沿碗底排布
  // 圆心 y = ARC_H - R（在容器顶部以上）
  // offset=0 时头像在 y=ARC_H（碗底），两侧向上
  function getSlotStyle(offset) {
    const angleDeg = offset * ANGLE_STEP;
    const angleRad = (angleDeg * Math.PI) / 180;

    const cx = ARC_W / 2;
    // 下半圆：圆心在顶部外，沿圆弧向下分布
    const x = cx + R * Math.sin(angleRad);
    const y = ARC_H + R * (Math.cos(angleRad) - 1); // offset=0时 y=ARC_H，两侧向上偏移

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
      transition: rotating
        ? 'left 0.42s cubic-bezier(0.34,1.56,0.64,1), top 0.42s cubic-bezier(0.34,1.56,0.64,1), width 0.35s ease, height 0.35s ease, opacity 0.3s ease'
        : 'all 0.3s ease',
    };
  }

  function goTo(dir) {
    if (isAnimating.current) return;
    const nextIndex = (currentIndex - dir + people.length) % people.length;
    isAnimating.current = true;
    setRotateDir(dir);
    setRotating(true);
    setTimeout(() => {
      setCurrentIndex(nextIndex);
      setRotating(false);
      setAnimKey((k) => k + 1);
      isAnimating.current = false;
    }, 420);
  }

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
        <a href="/about" style={{
          color: '#999', textDecoration: 'none', fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 4
        }}>
          ← About
        </a>
        <span style={{ fontWeight: 600, fontSize: 15, color: '#1a1a2e' }}>{person.name}</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {people.map((_, i) => (
            <div key={i} style={{
              width: i === currentIndex ? 18 : 6,
              height: 6, borderRadius: 3,
              background: i === currentIndex ? '#6c63ff' : '#ddd',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>
      </div>

      {/* 下半圆弧选择器（sticky） */}
      <div style={{
        position: 'sticky', top: 109, zIndex: 30,
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.95) 70%, rgba(255,255,255,0) 100%)',
        paddingTop: 10,
      }}>
        {/* <div style={{
          position: 'relative',
          height: ARC_H + 40,
          display: 'flex',
          overflow: 'clip',           
          justifyContent: 'center',
        //   overflowX: 'hidden', // 裁掉两侧多余部分
        //   overflowY: 'visible',
        }}> */}
        <div style={{
            position: 'relative',
            height: ARC_H + 40,
            display: 'flex',
            justifyContent: 'center',
            overflow: 'clip',              // ✅ 只需要这一行
            overflowClipMargin: '40px 0', // 底部留余量，防止头像被裁
        }}>

          {/* 装饰 SVG 弧线 */}
          <svg
            width={ARC_W}
            height={ARC_H + 40}
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
            {/* 主装饰弧线 */}
            {(() => {
              // 画弧：从左端到右端，弧顶在 y=ARC_H（容器底部），两端在 y≈ARC_H - R*(1-cos(60°))
              const halfAngle = 48 * Math.PI / 180;
              const cx = ARC_W / 2;
              const x1 = cx - R * Math.sin(halfAngle);
              const y1 = ARC_H + R * (Math.cos(halfAngle) - 1);
              const x2 = cx + R * Math.sin(halfAngle);
              const y2 = y1;
              return (
                <>
                  {/* 浅色底弧 */}
                  <path
                    d={`M ${x1} ${y1} A ${R} ${R} 0 0 0 ${x2} ${y2}`}
                    fill="none" stroke="#e5e2f8" strokeWidth="1"
                  />
                  {/* 高亮弧 */}
                  {(() => {
                    const ha2 = 26 * Math.PI / 180;
                    const hx1 = cx - R * Math.sin(ha2);
                    const hy1 = ARC_H + R * (Math.cos(ha2) - 1);
                    const hx2 = cx + R * Math.sin(ha2);
                    return (
                      <path
                        d={`M ${hx1} ${hy1} A ${R} ${R} 0 0 0 ${hx2} ${hy1}`}
                        fill="none" stroke="url(#bowlGrad)" strokeWidth="2.5" strokeLinecap="round"
                      />
                    );
                  })()}
                  {/* 端点圆 */}
                  <circle cx={x1} cy={y1} r={3.5} fill="#c4bfef" />
                  <circle cx={x2} cy={y2} r={3.5} fill="#c4bfef" />
                  {/* 刻度线（从弧线向内） */}
                  {[-2,-1,0,1,2].map(i => {
                    const a = i * ANGLE_STEP * Math.PI / 180;
                    const px = cx + R * Math.sin(a);
                    const py = ARC_H + R * (Math.cos(a) - 1);
                    // 法线方向（指向圆心，即向上偏内）
                    const nx = Math.sin(a);
                    const ny = -(Math.cos(a)); // 向圆心方向
                    const len = i === 0 ? 10 : 6;
                    return (
                      <line key={i}
                        x1={px} y1={py}
                        x2={px - nx * len} y2={py - ny * len}
                        stroke={i === 0 ? '#6c63ff' : '#c9c5ee'}
                        strokeWidth={i === 0 ? 2 : 1}
                        strokeLinecap="round"
                      />
                    );
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
            overflow: 'clip',
            // overflowY: 'visible',
            overflowClipMargin: '40px 0px', // 底部留余量，防止头像被裁
          }}>
            {slots.map((offset) => {
              const dataIndex = (currentIndex + offset + people.length) % people.length;
              const displayOffset = rotating ? offset - rotateDir : offset;
              const style = getSlotStyle(displayOffset);
              const p = people[dataIndex];
              const isCenter = offset === 0;

              return (
                <div
                  key={`${dataIndex}-${offset}`}
                  style={style}
                  onClick={() => { if (offset !== 0) goTo(-offset); }}
                >
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '50%',
                    border: isCenter
                      ? '2.5px solid #6c63ff'
                      : '2px solid rgba(108,99,255,0.2)',
                    boxShadow: isCenter
                      ? '0 0 0 4px rgba(108,99,255,0.12), 0 6px 20px rgba(108,99,255,0.2)'
                      : 'none',
                    overflow: 'hidden',
                    cursor: offset === 0 ? 'default' : 'pointer',
                    background: '#ddd',
                    transition: 'border 0.3s, box-shadow 0.3s',
                  }}>
                    <img
                      src={typeof p.avatar === 'object' ? p.avatar.src : p.avatar}
                      alt={p.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginTop: 4,
                        fontSize: isCenter ? 11 : 9,
                        fontWeight: isCenter ? 600 : 400,
                        color: isCenter ? '#6c63ff' : '#aaa',
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                        pointerEvents: 'none',
                        transition: 'font-size 0.3s, color 0.3s',
                        }}>
                        {p.name.split(' ')[0]}  {/* 只显示名字第一个词，避免太长 */}
                        </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div
        key={animKey}
        style={{
          flex: 1,
          padding: '8px 20px 60px',
          maxWidth: 600,
          margin: '0 auto',
          width: '100%',
          animation: 'fadeUp 0.4s ease both',
        }}
      >
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(18px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* 头部：头像 + 姓名 + role */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          background: '#fff', borderRadius: 18, padding: '18px 18px',
          boxShadow: '0 2px 16px rgba(108,99,255,0.07)',
          marginBottom: 14,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 16,
            overflow: 'hidden', flexShrink: 0,
            boxShadow: '0 4px 14px rgba(108,99,255,0.18)',
          }}>
            <img
              src={typeof person.avatar === 'object' ? person.avatar.src : person.avatar}
              alt={person.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#1a1a2e', marginBottom: 4 }}>
              {person.name}
            </div>
            <span style={{
              display: 'inline-block',
              background: 'rgba(108,99,255,0.1)',
              color: '#6c63ff', borderRadius: 20,
              padding: '3px 12px', fontSize: 12, fontWeight: 500,
            }}>
              {person.role}
            </span>
          </div>
        </div>

        {/* 自我介绍 */}
        <div style={{
          background: '#fff', borderRadius: 18, padding: '18px 18px',
          boxShadow: '0 2px 16px rgba(108,99,255,0.07)',
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>
            About
          </div>
          <p style={{ margin: 0, fontSize: 14.5, color: '#444', lineHeight: 1.8 }}>
            {person.bio || person.shortBio}
          </p>
        </div>

        {/* 联系方式 / 信息字段 */}
        {person.email && (
          <div style={{
            background: '#fff', borderRadius: 18, padding: '6px 8px',
            boxShadow: '0 2px 16px rgba(108,99,255,0.07)',
            marginBottom: 14,
          }}>
            <InfoRow icon="✉️" label="Email" value={person.email} href={`mailto:${person.email}`} />
          </div>
        )}

        {/* 其他字段，按需添加 */}
        {(person.github || person.twitter || person.website) && (
          <div style={{
            background: '#fff', borderRadius: 18, padding: '6px 8px',
            boxShadow: '0 2px 16px rgba(108,99,255,0.07)',
            marginBottom: 14,
          }}>
            {person.github && <InfoRow icon="🐙" label="GitHub" value={person.github} href={person.github} />}
            {person.twitter && <InfoRow icon="𝕏" label="Twitter" value={person.twitter} href={person.twitter} />}
            {person.website && <InfoRow icon="🔗" label="Website" value={person.website} href={person.website} />}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 10px', borderRadius: 12, textDecoration: 'none',
        transition: 'background 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8f7ff'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: '#bbb', marginBottom: 1 }}>{label}</div>
        <div style={{ fontSize: 13.5, color: '#555', fontWeight: 500 }}>{value}</div>
      </div>
      <span style={{ color: '#ccc', fontSize: 16 }}>›</span>
    </a>
  );
}