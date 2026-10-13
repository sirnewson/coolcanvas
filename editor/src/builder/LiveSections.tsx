import React from 'react';
import { ChevronDown, Star, Check, ArrowRight, Play } from 'lucide-react';

interface LiveProps {
  data: Record<string, string>;
  brand: string;
  type: string;
}

// ─── COLOUR PALETTE ─────────────────────────────────────────────────────────
// Mutable on purpose: the builder swaps palettes in place and re-mounts the
// preview, so every section picks up the new theme without prop plumbing.
export interface BuilderTheme {
  bg: string;
  bg2: string;
  ink: string;
  ink2: string;
  ink3: string;
  border: string;
  brand: string;
  brandLight: string;
  white: string;
  font: string;
}

export const THEMES: { id: string; label: string; theme: BuilderTheme }[] = [
  { id: "cream", label: "Cream & clay", theme: { bg: "#F4F1E9", bg2: "#FCFAF8", ink: "#2A2623", ink2: "#5E5852", ink3: "#958F88", border: "#EAE5DB", brand: "#C86041", brandLight: "rgba(200,96,65,0.10)", white: "#FFFFFF", font: "'Plus Jakarta Sans', sans-serif" } },
  { id: "slate", label: "Slate & blue", theme: { bg: "#F5F7FA", bg2: "#FFFFFF", ink: "#0F172A", ink2: "#475569", ink3: "#94A3B8", border: "#E2E8F0", brand: "#2563EB", brandLight: "rgba(37,99,235,0.10)", white: "#FFFFFF", font: "Inter, system-ui, sans-serif" } },
  { id: "forest", label: "Sand & forest", theme: { bg: "#F6F3EC", bg2: "#FFFDF8", ink: "#1E2A22", ink2: "#4E5D53", ink3: "#8E9A92", border: "#E6E1D4", brand: "#2E7D5B", brandLight: "rgba(46,125,91,0.12)", white: "#FFFFFF", font: "'DM Sans', system-ui, sans-serif" } },
  { id: "midnight", label: "Midnight & violet", theme: { bg: "#0F1020", bg2: "#171834", ink: "#F3F2FF", ink2: "#B9B7D6", ink3: "#7C7A9E", border: "#2A2B4A", brand: "#8B5CF6", brandLight: "rgba(139,92,246,0.18)", white: "#1C1D3A", font: "'Space Grotesk', system-ui, sans-serif" } },
  { id: "mono", label: "Ink & lime", theme: { bg: "#FAFAF7", bg2: "#FFFFFF", ink: "#111111", ink2: "#444444", ink3: "#8A8A8A", border: "#E5E5E0", brand: "#111111", brandLight: "rgba(17,17,17,0.08)", white: "#FFFFFF", font: "'IBM Plex Sans', system-ui, sans-serif" } },
  { id: "rose", label: "Blush & rose", theme: { bg: "#FBF4F4", bg2: "#FFFFFF", ink: "#2B1F22", ink2: "#63515A", ink3: "#A08F97", border: "#EEDFE3", brand: "#D0446B", brandLight: "rgba(208,68,107,0.12)", white: "#FFFFFF", font: "'Plus Jakarta Sans', sans-serif" } },
];

const C: BuilderTheme = { ...THEMES[0].theme };
const font: { fontFamily: string } = { fontFamily: C.font };

export function applyBuilderTheme(theme: BuilderTheme) {
  Object.assign(C, theme);
  font.fontFamily = theme.font;
}

// ─── SHARED MICRO-COMPONENTS ────────────────────────────────────────────────
const Btn = ({ children, outline = false, small = false }: { children: React.ReactNode; outline?: boolean; small?: boolean }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: small ? '8px 16px' : '14px 26px',
    background: outline ? 'transparent' : C.brand,
    color: outline ? C.brand : '#fff',
    border: `1.5px solid ${outline ? C.brand : 'transparent'}`,
    borderRadius: 12, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap' as const,
    transition: 'all 0.2s',
  }}>
    {children}
  </div>
);

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span style={{
    display: 'inline-block', padding: '4px 12px',
    background: C.brandLight, color: C.brand,
    borderRadius: 999, fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: 1,
  }}>{children}</span>
);

const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: C.white, borderRadius: 20, border: `1px solid ${C.border}`,
    boxShadow: '0 4px 20px rgba(42,38,35,0.06)', padding: 28, ...style
  }}>
    {children}
  </div>
);

// ─── LIVE SECTION COMPONENTS ───────────────────────────────────────────────

// HDR variants
const LiveHeader = ({ data, brand }: LiveProps) => (
  <div style={{ background: C.bg2, borderBottom: `1px solid ${C.border}`, ...font }}>
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontWeight: 800, fontSize: 18, color: C.ink }}>{brand || 'YourBrand'}</span>
      <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
        {(data.nav_links || 'Home, About, Services, Contact').split(',').map((l, i) => (
          <span key={i} style={{ fontSize: 13, color: C.ink2, fontWeight: 600, cursor: 'pointer' }}>{l.trim()}</span>
        ))}
      </div>
      <Btn small>{data.cta_label || 'Get Started'}</Btn>
    </div>
  </div>
);

const LiveHeaderMinimal = ({ data, brand }: LiveProps) => (
  <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, ...font }}>
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontWeight: 900, fontSize: 17, color: C.ink }}>{brand || 'Studio'}</span>
      <div style={{ display: 'flex', gap: 28 }}>
        {(data.nav_links || 'Work, About, Contact').split(',').map((l, i) => (
          <span key={i} style={{ fontSize: 13, color: C.ink3, fontWeight: 600 }}>{l.trim()}</span>
        ))}
      </div>
    </div>
  </div>
);

const LiveMegaMenu = ({ data, brand }: LiveProps) => (
  <div style={{ background: C.ink, ...font }}>
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px', height: 64, display: 'flex', alignItems: 'center', gap: 32 }}>
      <span style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>{brand || 'TechMart'}</span>
      <div style={{ flex: 1, display: 'flex', gap: 24 }}>
        {(data.products_dropdown || 'Electronics, Fashion, Home').split(',').map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {l.trim()} <ChevronDown size={12} />
          </div>
        ))}
      </div>
      <Btn small>{data.cta_label || 'Login'}</Btn>
    </div>
  </div>
);

// HERO variants
const LiveHeroSplit = ({ data, brand }: LiveProps) => (
  <div style={{ background: C.bg, padding: '80px 40px', ...font }}>
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
      <div>
        <Tag>{brand || 'New'}</Tag>
        <h1 style={{ fontSize: 48, fontWeight: 900, color: C.ink, lineHeight: 1.1, marginTop: 16, marginBottom: 16 }}>
          {data.headline || 'Build websites that actually convert.'}
        </h1>
        <p style={{ fontSize: 17, color: C.ink2, lineHeight: 1.7, marginBottom: 32 }}>
          {data.subheadline || 'The professional-grade site builder trusted by 50,000+ founders and agencies worldwide.'}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <Btn>{data.primary_cta || 'Start Building'} <ArrowRight size={14} /></Btn>
          <Btn outline>See Demo <Play size={13} /></Btn>
        </div>
      </div>
      {data.image ? (
        <div style={{ borderRadius: 24, overflow: 'hidden', boxShadow: '0 20px 60px rgba(42,38,35,0.12)', aspectRatio: '4 / 3', background: `url(${data.image}) center / cover no-repeat` }} />
      ) : (
      <div style={{ background: C.white, borderRadius: 24, border: `1px solid ${C.border}`, overflow: 'hidden', boxShadow: '0 20px 60px rgba(42,38,35,0.12)' }}>
        <div style={{ height: 36, background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 }}>
          {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ height: 12, background: C.bg, borderRadius: 6, marginBottom: 12, width: '60%' }} />
          <div style={{ height: 8, background: C.border, borderRadius: 4, marginBottom: 8 }} />
          <div style={{ height: 8, background: C.border, borderRadius: 4, marginBottom: 8, width: '80%' }} />
          <div style={{ marginTop: 20, height: 36, background: C.brand, borderRadius: 10, width: 120 }} />
        </div>
      </div>
      )}
    </div>
  </div>
);

const LiveHeroCentered = ({ data, brand }: LiveProps) => (
  <div style={{ background: C.bg, padding: '100px 40px', textAlign: 'center', ...font }}>
    <Tag>{brand || 'Agency'}</Tag>
    <h1 style={{ fontSize: 56, fontWeight: 900, color: C.ink, lineHeight: 1.1, margin: '20px auto', maxWidth: 700 }}>
      {data.headline || 'We build brands that last.'}
    </h1>
    <p style={{ fontSize: 18, color: C.ink2, lineHeight: 1.7, maxWidth: 560, margin: '0 auto 36px' }}>
      {data.subheadline || 'Award-winning design studio based in Nairobi, crafting digital experiences for ambitious brands.'}
    </p>
    <Btn>{data.cta_label || 'See Our Work'} <ArrowRight size={14} /></Btn>
  </div>
);

const LiveHeroVideo = ({ data }: LiveProps) => (
  <div style={{ position: 'relative', background: data.image ? `url(${data.image}) center / cover no-repeat` : C.ink, padding: '120px 40px', textAlign: 'center', overflow: 'hidden', ...font }}>
    <div style={{ position: 'absolute', inset: 0, background: data.image ? 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.55))' : 'linear-gradient(135deg, rgba(200,96,65,0.3) 0%, transparent 60%)', pointerEvents: 'none' }} />
    <Tag>{data.video_desc || 'Cinematic Experience'}</Tag>
    <h1 style={{ fontSize: 60, fontWeight: 900, color: '#fff', lineHeight: 1.1, margin: '20px 0', maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
      {data.headline || 'Experience the wild.'}
    </h1>
    <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, maxWidth: 500, margin: '0 auto 40px' }}>
      {data.subheadline || '4K safari experiences, handpicked just for you.'}
    </p>
    <Btn>{data.cta_label || 'Explore'} <Play size={14} /></Btn>
  </div>
);

const LiveHeroStats = ({ data }: LiveProps) => (
  <div style={{ background: C.bg, padding: '80px 40px', ...font }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 52, fontWeight: 900, color: C.ink, lineHeight: 1.1, marginBottom: 20, maxWidth: 600 }}>
        {data.headline || "Kenya's largest hotel network."}
      </h1>
      <p style={{ fontSize: 17, color: C.ink2, maxWidth: 500, lineHeight: 1.7, marginBottom: 40 }}>No middlemen. No commissions. Direct connections.</p>
      <div style={{ display: 'flex', gap: 48, marginBottom: 40 }}>
        {[data.stat_1 || '500+ Verified', data.stat_2 || '47 Counties', '0% Commission'].map((s, i) => (
          <div key={i}>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.brand }}>{s.split(' ')[0]}</div>
            <div style={{ fontSize: 13, color: C.ink3, fontWeight: 600 }}>{s.split(' ').slice(1).join(' ')}</div>
          </div>
        ))}
      </div>
      <Btn>{data.cta_label || 'Browse Now'} <ArrowRight size={14} /></Btn>
    </div>
  </div>
);

// FEATURES variants
const LiveFeatureCards = ({ data }: LiveProps) => (
  <div style={{ background: C.bg2, padding: '80px 40px', ...font }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', fontSize: 38, fontWeight: 900, color: C.ink, marginBottom: 12 }}>
        {data.section_title || 'Why choose us?'}
      </h2>
      <p style={{ textAlign: 'center', color: C.ink3, fontSize: 16, marginBottom: 52 }}>Everything you need in one platform.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {[data.feature_1 || '⚡ · Fast · Instant results', data.feature_2 || '🛡️ · Secure · Enterprise-grade', data.feature_3 || '💸 · Affordable · No hidden fees'].map((f, i) => {
          const [icon, title, desc] = f.split(' · ');
          return (
            <div key={i}>
              <Card>
                <div style={{ fontSize: 28, marginBottom: 16 }}>{icon}</div>
                <div style={{ fontWeight: 800, fontSize: 17, color: C.ink, marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 14, color: C.ink2, lineHeight: 1.6 }}>{desc}</div>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

const LiveFeatureZigzag = ({ data }: LiveProps) => (
  <div style={{ background: C.bg, padding: '80px 40px', ...font }}>
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 72 }}>
      {[
        { title: data.block_1_title || 'Search without barriers', body: data.block_1_body || 'Browse by region, price, or amenity. Find exactly what you need in seconds.', flip: false },
        { title: data.block_2_title || 'Contact directly', body: data.block_2_body || 'One tap opens a WhatsApp chat straight to the property owner.', flip: true },
      ].map((b, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center', direction: b.flip ? 'rtl' : 'ltr' as any }}>
          <div style={{ direction: 'ltr' }}>
            <Tag>Feature {i + 1}</Tag>
            <h3 style={{ fontSize: 30, fontWeight: 900, color: C.ink, marginTop: 12, marginBottom: 16 }}>{b.title}</h3>
            <p style={{ fontSize: 16, color: C.ink2, lineHeight: 1.7 }}>{b.body}</p>
          </div>
          <div style={{ background: C.white, borderRadius: 20, height: 180, border: `1px solid ${C.border}`, boxShadow: '0 8px 30px rgba(42,38,35,0.06)' }}>
            <div style={{ height: '100%', background: `linear-gradient(135deg, ${C.brandLight}, transparent)`, borderRadius: 20 }} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

const LiveStats = ({ data }: LiveProps) => (
  <div style={{ background: C.ink, padding: '72px 40px', ...font }}>
    <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ fontSize: 34, fontWeight: 900, color: '#fff', marginBottom: 52 }}>{data.section_title || 'Trusted locally'}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }}>
        {[data.stat_1 || '500+ Hotels', data.stat_2 || '47 Counties', '0% Fees', '2M+ Users'].map((s, i) => (
          <div key={i}>
            <div style={{ fontSize: 40, fontWeight: 900, color: C.brand }}>{s.split(' ')[0]}</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>{s.split(' ').slice(1).join(' ')}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const LiveBento = ({ data }: LiveProps) => (
  <div style={{ background: C.bg2, padding: '80px 40px', ...font }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ fontSize: 38, fontWeight: 900, color: C.ink, marginBottom: 40 }}>{data.section_title || 'Discover the magic'}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gridTemplateRows: 'auto auto', gap: 20 }}>
        <Card style={{ gridRow: '1 / 3', background: C.brand + '12', borderColor: C.brand + '30', minHeight: 280 }}>
          <Tag>Core</Tag>
          <h3 style={{ fontSize: 26, fontWeight: 900, color: C.ink, marginTop: 16, marginBottom: 12 }}>{(data.box_1 || 'Analytics Dashboard · See all numbers instantly').split(' · ')[0]}</h3>
          <p style={{ color: C.ink2, fontSize: 15, lineHeight: 1.6 }}>{(data.box_1 || 'Analytics Dashboard · See all numbers instantly').split(' · ')[1]}</p>
        </Card>
        <Card>
          <div style={{ fontSize: 22, marginBottom: 8 }}>📱</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.ink }}>{(data.box_2 || 'Mobile Ready · Works on iOS & Android').split(' · ')[0]}</div>
          <div style={{ fontSize: 13, color: C.ink3, marginTop: 6 }}>{(data.box_2 || 'Mobile Ready · Works on iOS & Android').split(' · ')[1]}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 22, marginBottom: 8 }}>🛡️</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.ink }}>{(data.box_3 || 'Secure · 256-bit encryption').split(' · ')[0]}</div>
          <div style={{ fontSize: 13, color: C.ink3, marginTop: 6 }}>{(data.box_3 || 'Secure · 256-bit encryption').split(' · ')[1]}</div>
        </Card>
      </div>
    </div>
  </div>
);

// PROOF variants
const LiveTestimonials = ({ data }: LiveProps) => (
  <div style={{ background: C.bg2, padding: '80px 40px', ...font }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', fontSize: 38, fontWeight: 900, color: C.ink, marginBottom: 52 }}>
        {data.section_title || 'What they say'}
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {[data.quote_1 || '"Amazing service" · Amara O. · Hotel Owner', data.quote_2 || '"We use it daily" · John D. · Traveller', '"Tripled our bookings" · Sara N. · Manager'].map((q, i) => {
          const [quote, name, role] = q.split(' · ');
          return (
            <div key={i}>
              <Card>
                <div style={{ display: 'flex', gap: 3, marginBottom: 16 }}>
                  {[1,2,3,4,5].map(s => <Star key={s} size={14} fill={C.brand} color={C.brand} />)}
                </div>
                <p style={{ fontSize: 15, color: C.ink, lineHeight: 1.7, fontStyle: 'italic', marginBottom: 20 }}>{quote}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.brandLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: C.brand }}>
                    {(name || 'U')[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.ink }}>{name}</div>
                    <div style={{ fontSize: 12, color: C.ink3 }}>{role}</div>
                  </div>
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

const LiveLogoWall = ({ data }: LiveProps) => (
  <div style={{ background: C.bg, padding: '56px 40px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, ...font }}>
    <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
      <p style={{ fontSize: 12, fontWeight: 800, color: C.ink3, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 32 }}>
        {data.section_title || 'Featured in'}
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap', alignItems: 'center' }}>
        {(data.logos || 'Nation Media, Citizen TV, Standard, KBC').split(',').map((l, i) => (
          <div key={i} style={{ fontSize: 15, fontWeight: 800, color: C.ink3, letterSpacing: -0.5 }}>{l.trim()}</div>
        ))}
      </div>
    </div>
  </div>
);

// CTA variants
const LiveCTABanner = ({ data }: LiveProps) => (
  <div style={{ background: C.ink, padding: '80px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden', ...font }}>
    <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(200,96,65,0.15)', pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(200,96,65,0.10)', pointerEvents: 'none' }} />
    <h2 style={{ fontSize: 46, fontWeight: 900, color: '#fff', marginBottom: 16 }}>
      {data.headline || 'Ready to explore?'}
    </h2>
    <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', marginBottom: 40 }}>
      {data.subtext || '500+ hotels. Zero commission. Real connections.'}
    </p>
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
      <Btn>{data.cta_label || 'Browse Now'} <ArrowRight size={14} /></Btn>
    </div>
  </div>
);

const LiveNewsletter = ({ data }: LiveProps) => (
  <div style={{ background: C.bg2, padding: '72px 40px', textAlign: 'center', ...font }}>
    <h2 style={{ fontSize: 34, fontWeight: 900, color: C.ink, marginBottom: 12 }}>{data.headline || 'Get travel deals'}</h2>
    <p style={{ color: C.ink2, marginBottom: 32 }}>Join 50,000+ subscribers. No spam, ever.</p>
    <div style={{ display: 'flex', gap: 0, maxWidth: 460, margin: '0 auto', borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}`, boxShadow: '0 4px 20px rgba(42,38,35,0.08)' }}>
      <input readOnly placeholder={data.input_placeholder || 'your@email.com'} style={{ flex: 1, padding: '14px 20px', border: 'none', outline: 'none', fontSize: 14, background: C.white, color: C.ink, fontFamily: 'inherit' }} />
      <div style={{ padding: '14px 24px', background: C.brand, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{data.cta_label || 'Subscribe'}</div>
    </div>
  </div>
);

// PRICING variants
const LivePricing = ({ data }: LiveProps) => {
  const plans = [
    { name: 'Free', price: '$0', period: '/mo', features: ['5 pages', '1 user', 'Basic analytics'], highlight: false, plan: data.plan_1 },
    { name: 'Pro', price: '$29', period: '/mo', features: ['Unlimited pages', '5 users', 'Advanced analytics', 'Priority support'], highlight: true, plan: data.plan_2 },
    { name: 'Agency', price: '$99', period: '/mo', features: ['Unlimited', 'Unlimited users', 'White label', 'Dedicated manager'], highlight: false, plan: data.plan_3 },
  ];
  return (
    <div style={{ background: C.bg2, padding: '80px 40px', ...font }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 38, fontWeight: 900, color: C.ink, marginBottom: 12 }}>{data.section_title || 'Simple pricing'}</h2>
        <p style={{ textAlign: 'center', color: C.ink3, marginBottom: 52 }}>No hidden fees. Cancel anytime.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, alignItems: 'center' }}>
          {plans.map((p, i) => (
            <div key={i} style={{
              background: p.highlight ? C.ink : C.white,
              borderRadius: 24, border: `2px solid ${p.highlight ? C.brand : C.border}`,
              boxShadow: p.highlight ? '0 20px 60px rgba(42,38,35,0.20)' : '0 4px 20px rgba(42,38,35,0.06)',
              padding: p.highlight ? '44px 32px' : '32px 28px',
              transform: p.highlight ? 'scale(1.04)' : 'none',
            }}>
              {p.highlight && <Tag>Most Popular</Tag>}
              <div style={{ fontSize: 16, fontWeight: 800, color: p.highlight ? 'rgba(255,255,255,0.7)' : C.ink3, marginTop: p.highlight ? 16 : 0, marginBottom: 8 }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 24 }}>
                <span style={{ fontSize: 40, fontWeight: 900, color: p.highlight ? '#fff' : C.ink }}>{p.price}</span>
                <span style={{ fontSize: 14, color: p.highlight ? 'rgba(255,255,255,0.4)' : C.ink3 }}>{p.period}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {p.features.map((f, j) => (
                  <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: p.highlight ? 'rgba(255,255,255,0.8)' : C.ink2 }}>
                    <Check size={14} color={C.brand} strokeWidth={3} /> {f}
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 0', background: p.highlight ? C.brand : C.ink, borderRadius: 12, textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                Get started
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// FAQ variant
const LiveFAQ = ({ data }: LiveProps) => {
  const faqs = (data.faqs || 'Q: Is it free?\nA: Yes, completely free for travellers.\nQ: How do hotels list?\nA: Simply register and submit your property.\nQ: Is there a mobile app?\nA: Coming soon on iOS & Android.').split('\n').reduce<{q:string,a:string}[]>((acc, line) => {
    if (line.startsWith('Q: ')) acc.push({ q: line.slice(3), a: '' });
    else if (line.startsWith('A: ') && acc.length) acc[acc.length-1].a = line.slice(3);
    return acc;
  }, []);
  return (
    <div style={{ background: C.bg2, padding: '80px 40px', ...font }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h2 style={{ fontSize: 38, fontWeight: 900, color: C.ink, marginBottom: 48, textAlign: 'center' }}>{data.section_title || 'Frequently asked questions'}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {faqs.map((f, i) => (
            <div key={i} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px', boxShadow: '0 2px 8px rgba(42,38,35,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{f.q}</span>
                <ChevronDown size={18} color={C.ink3} />
              </div>
              {f.a && <p style={{ marginTop: 12, fontSize: 14, color: C.ink2, lineHeight: 1.7 }}>{f.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// FORM variant
const LiveContactForm = ({ data }: LiveProps) => (
  <div style={{ background: C.bg, padding: '80px 40px', ...font }}>
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ fontSize: 38, fontWeight: 900, color: C.ink, marginBottom: 8 }}>{data.section_title || 'Get in touch'}</h2>
      <p style={{ color: C.ink2, fontSize: 16, marginBottom: 40 }}>We respond within 24 hours.</p>
      <div style={{ background: C.white, borderRadius: 24, padding: 40, border: `1px solid ${C.border}`, boxShadow: '0 8px 32px rgba(42,38,35,0.07)' }}>
        {(data.form_fields || 'Name\nEmail\nMessage').split('\n').map((field, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.ink3, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{field}</label>
            {field.toLowerCase() === 'message' ? (
              <div style={{ width: '100%', height: 100, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, boxSizing: 'border-box' }} />
            ) : (
              <div style={{ width: '100%', height: 44, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, boxSizing: 'border-box' }} />
            )}
          </div>
        ))}
        <Btn>{data.cta_label || 'Send Message'} <ArrowRight size={14} /></Btn>
      </div>
    </div>
  </div>
);

// GALLERY variant
const LiveGalleryGrid = ({ data }: LiveProps) => (
  <div style={{ background: C.bg2, padding: '80px 40px', ...font }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h2 style={{ fontSize: 38, fontWeight: 900, color: C.ink, marginBottom: 40 }}>{data.section_title || 'Browse work'}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { h: 220, bg: `linear-gradient(135deg, ${C.brand}22, ${C.brand}66)` },
          { h: 280, bg: `linear-gradient(135deg, #5E5852, #2A2623)` },
          { h: 220, bg: `linear-gradient(135deg, ${C.bg}, ${C.brand}22)` },
          { h: 260, bg: `linear-gradient(135deg, ${C.brand}44, transparent)` },
          { h: 220, bg: `linear-gradient(135deg, #F4F1E9, #EAE5DB)` },
          { h: 280, bg: `linear-gradient(135deg, ${C.ink}, #5E5852)` },
        ].map((item, i) => (
          <div key={i} style={{ height: item.h, borderRadius: 20, background: data[`image_${i + 1}`] ? `url(${data[`image_${i + 1}`]}) center / cover no-repeat` : data.image && i === 0 ? `url(${data.image}) center / cover no-repeat` : item.bg, border: `1px solid ${C.border}`, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: 12, left: 12, fontSize: 12, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
              {(data.images || '').split('\n')[i] || `Project ${i + 1}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// FOOTER variants
const LiveFooter = ({ data, brand }: LiveProps) => (
  <div style={{ background: C.ink, padding: '64px 40px 32px', ...font }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48, paddingBottom: 48, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20, color: '#fff', marginBottom: 16 }}>{brand || 'YourBrand'}</div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.7, maxWidth: 260 }}>The professional-grade builder trusted by thousands of businesses worldwide.</p>
        </div>
        {(data.col_1_title || 'Explore: Home, About').split(': ').slice(0, 1).map(() => null)}
        {['Product', 'Company', 'Legal'].map((col, i) => (
          <div key={i}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20 }}>{col}</div>
            {['Features', 'Pricing', 'About us', 'Privacy'].slice(i, i + 3).map((link, j) => (
              <div key={j} style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 12, cursor: 'pointer' }}>{link}</div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>{data.copyright || `© ${new Date().getFullYear()} ${brand || 'Company'}. All rights reserved.`}</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {['Twitter', 'LinkedIn', 'Instagram'].map(s => (
            <div key={s} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <div style={{ width: 14, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.3)' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const LiveFooterMinimal = ({ data, brand }: LiveProps) => (
  <div style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: '32px 40px', ...font }}>
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 800, color: C.ink3, fontSize: 13 }}>{brand || 'Company'} © {new Date().getFullYear()}</span>
      <div style={{ display: 'flex', gap: 24 }}>
        {(data.links || 'Privacy, Terms, Contact').split(',').map((l, i) => (
          <span key={i} style={{ fontSize: 13, color: C.ink3, cursor: 'pointer' }}>{l.trim()}</span>
        ))}
      </div>
    </div>
  </div>
);

const LiveFooterCTA = ({ data }: LiveProps) => (
  <div style={{ background: C.bg2, padding: '80px 40px', textAlign: 'center', ...font }}>
    <h2 style={{ fontSize: 48, fontWeight: 900, color: C.ink, marginBottom: 24 }}>{data.headline || 'Ready to start?'}</h2>
    <Btn>{data.cta_label || 'Get Started Free'} <ArrowRight size={14} /></Btn>
    <div style={{ marginTop: 48, paddingTop: 32, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'center', gap: 32 }}>
      {['Privacy', 'Terms', 'Cookies'].map(l => (
        <span key={l} style={{ fontSize: 12, color: C.ink3 }}>{l}</span>
      ))}
    </div>
  </div>
);

// ─── COMPONENT REGISTRY ────────────────────────────────────────────────────
// Maps section ID -> the live component to render
export const LIVE_COMPONENT_MAP: Record<string, React.ComponentType<LiveProps>> = {
  // HEADERS
  HDR_01: LiveHeader,
  HDR_02: LiveHeaderMinimal,
  HDR_03: LiveHeader,
  HDR_04: LiveHeaderMinimal,
  HDR_05: LiveMegaMenu,
  HDR_06: LiveHeader,
  HDR_07: LiveHeader,
  HDR_08: LiveHeader,
  HDR_09: LiveHeaderMinimal,
  HDR_10: LiveHeader,
  HDR_11: LiveHeaderMinimal,

  // HEROES
  HERO_01: LiveHeroSplit,
  HERO_02: LiveHeroCentered,
  HERO_03: LiveHeroVideo,
  HERO_04: LiveHeroVideo,
  HERO_05: LiveHeroCentered,
  HERO_06: LiveHeroSplit,
  HERO_07: LiveHeroCentered,
  HERO_08: LiveHeroStats,
  HERO_09: LiveHeroSplit,
  HERO_10: LiveHeroSplit,
  HERO_11: LiveHeroCentered,

  // FEATURES
  FEAT_01: LiveFeatureCards,
  FEAT_02: LiveFeatureCards,
  FEAT_03: LiveFeatureZigzag,
  FEAT_04: LiveFeatureCards,
  FEAT_05: LiveFeatureCards,
  FEAT_06: LiveStats,
  FEAT_07: LiveFeatureCards,
  FEAT_08: LiveFeatureCards,
  FEAT_09: LiveFeatureCards,
  FEAT_10: LiveBento,
  FEAT_11: LiveFeatureCards,
  FEAT_12: LiveStats,

  // PROOF
  TST_01: LiveTestimonials,
  TST_02: LiveTestimonials,
  TST_03: LiveTestimonials,
  TST_04: LiveTestimonials,
  TST_05: LiveLogoWall,
  TST_06: LiveTestimonials,
  TST_07: LiveTestimonials,
  TST_08: LiveLogoWall,
  TST_09: LiveTestimonials,
  TST_10: LiveTestimonials,
  TST_11: LiveLogoWall,

  // CTA
  CTA_01: LiveCTABanner,
  CTA_02: LiveCTABanner,
  CTA_03: LiveNewsletter,
  CTA_04: LiveCTABanner,
  CTA_05: LiveCTABanner,
  CTA_06: LiveCTABanner,
  CTA_07: LiveCTABanner,
  CTA_08: LiveCTABanner,
  CTA_09: LiveCTABanner,
  CTA_10: LiveNewsletter,
  CTA_11: LiveNewsletter,

  // PRICING
  PRC_01: LivePricing,
  PRC_02: LivePricing,
  PRC_03: LivePricing,
  PRC_04: LivePricing,
  PRC_05: LivePricing,
  PRC_06: LivePricing,
  PRC_07: LivePricing,
  PRC_08: LivePricing,
  PRC_09: LivePricing,
  PRC_10: LivePricing,
  PRC_11: LivePricing,

  // FAQ
  FAQ_01: LiveFAQ,
  FAQ_02: LiveFAQ,
  FAQ_03: LiveFAQ,
  FAQ_04: LiveFAQ,
  FAQ_05: LiveFAQ,
  FAQ_06: LiveFAQ,
  FAQ_07: LiveFAQ,
  FAQ_08: LiveFAQ,
  FAQ_09: LiveFAQ,
  FAQ_10: LiveFAQ,
  FAQ_11: LiveFAQ,

  // FORMS
  FRM_01: LiveContactForm,
  FRM_02: LiveContactForm,
  FRM_03: LiveContactForm,
  FRM_04: LiveContactForm,
  FRM_05: LiveContactForm,
  FRM_06: LiveContactForm,
  FRM_07: LiveContactForm,
  FRM_08: LiveContactForm,
  FRM_09: LiveContactForm,
  FRM_10: LiveContactForm,
  FRM_11: LiveContactForm,

  // GALLERY
  GAL_01: LiveGalleryGrid,
  GAL_02: LiveGalleryGrid,
  GAL_03: LiveGalleryGrid,
  GAL_04: LiveGalleryGrid,
  GAL_05: LiveGalleryGrid,
  GAL_06: LiveGalleryGrid,
  GAL_07: LiveGalleryGrid,
  GAL_08: LiveGalleryGrid,
  GAL_09: LiveGalleryGrid,
  GAL_10: LiveGalleryGrid,
  GAL_11: LiveGalleryGrid,

  // FOOTER
  FTR_01: LiveFooter,
  FTR_02: LiveFooter,
  FTR_03: LiveFooterMinimal,
  FTR_04: LiveFooter,
  FTR_05: LiveFooterCTA,
  FTR_06: LiveFooter,
  FTR_07: LiveFooter,
  FTR_08: LiveFooter,
  FTR_09: LiveFooterMinimal,
  FTR_10: LiveFooter,
  FTR_11: LiveFooter,
};
