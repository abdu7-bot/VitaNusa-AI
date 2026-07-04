const SHELL_READY_ATTR = 'data-vn-ui-shell-ready';

const FEATURES = [
  ['Nusa Chat', 'Tanya edukasi amanah', 'index.html', 'AI'],
  ['VitaCheck', 'Refleksi kebiasaan', 'vitacheck.html', 'VC'],
  ['VitaGame', 'Game klaim sehat', 'vitagame.html/', 'VG'],
  ['Komik', 'Cerita visual edukatif', 'komik/', 'KS'],
  ['Artikel', 'Bacaan edukatif', 'articles/index.html', 'AR'],
  ['Produk Amanah', 'Katalog reseller', 'products/index.html', 'PA'],
  ['Prinsip Amanah', 'Batas klaim', 'prinsip-amanah.html', 'AM'],
  ['Kontak', 'WhatsApp & email', 'contact.html', 'WA'],
  ['Akun', 'Profil & akses pengguna', 'account.html', 'AK'],
  ['Pengaturan', 'Preferensi aplikasi', 'settings.html', 'PG']
];

function getRelativePrefix() {
  const path = window.location.pathname.replace(/\\/g, '/');
  const nestedRoots = ['articles', 'products', 'documents', 'komik', 'vitagame.html'];
  const segments = path.split('/').filter(Boolean);
  const rootIndex = segments.findIndex((segment) => nestedRoots.includes(segment));

  if (rootIndex === -1) return '';

  const childSegments = segments.slice(rootIndex + 1);
  const lastSegment = childSegments[childSegments.length - 1] || '';
  const endsWithFile = /\.[a-z0-9]+$/i.test(lastSegment);
  const depth = 1 + Math.max(0, childSegments.length - (endsWithFile ? 1 : 0));

  return '../'.repeat(depth);
}

function normalizeHref(href, prefix) {
  if (/^https?:|^mailto:|^#/i.test(href)) return href;
  return `${prefix}${href}`;
}

function getCurrentKey() {
  const path = window.location.pathname.toLowerCase();
  if (path.includes('/articles/')) return 'Artikel';
  if (path.includes('/products/')) return 'Produk Amanah';
  if (path.includes('/komik')) return 'Komik';
  if (path.includes('/vitagame')) return 'VitaGame';
  if (path.endsWith('/vitacheck.html')) return 'VitaCheck';
  if (path.endsWith('/prinsip-amanah.html')) return 'Prinsip Amanah';
  if (path.endsWith('/contact.html')) return 'Kontak';
  if (path.endsWith('/account.html') || path.endsWith('/akun.html')) return 'Akun';
  if (path.endsWith('/settings.html') || path.endsWith('/pengaturan.html')) return 'Pengaturan';
  return 'Nusa Chat';
}

function injectShellStyles() {
  if (document.getElementById('vn-ui-shell-style')) return;
  const style = document.createElement('style');
  style.id = 'vn-ui-shell-style';
  style.textContent = `
    :root{--vn-shell-green:#14532d;--vn-shell-green-2:#16a34a;--vn-shell-soft:#f0fdf4;--vn-shell-cream:#fbf7ed;--vn-shell-line:rgba(22,163,74,.15);--vn-shell-ink:#143d2c;--vn-shell-muted:#64766b;}
    /* Layout tweaks for polished shell */
    body.vn-shell-polished:not(.nusa-chat-page){background:radial-gradient(circle at top left,rgba(220,252,231,.8),transparent 32rem),radial-gradient(circle at bottom right,rgba(250,244,226,.85),transparent 30rem),#f6fbf7;color:var(--vn-shell-ink);}
    body.vn-shell-polished:not(.nusa-chat-page){padding-right:min(360px,30vw);}
    body.vn-shell-polished .hero,body.vn-shell-polished .article-hero,body.vn-shell-polished .principle-hero,body.vn-shell-polished .product-hero{background:radial-gradient(circle at 82% 12%,rgba(255,224,164,.26),transparent 28%),linear-gradient(135deg,#0f3d2e,#18734f 58%,#16a34a)!important;}
    body.vn-shell-polished .card,body.vn-shell-polished .article-card,body.vn-shell-polished .article-body,body.vn-shell-polished .trust-panel,body.vn-shell-polished .catalog-card,body.vn-shell-polished details{border-color:var(--vn-shell-line)!important;box-shadow:0 18px 44px rgba(20,83,45,.08)!important;}

    /* Right rail (sidebar) - solid, non-blurry */
    .vn-right-rail {
      position: fixed;
      top: 10px;
      right: 10px;
      bottom: 10px;
      z-index: 9999;
      width: min(356px, calc(100vw - 20px));
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
      border: 1px solid rgba(22, 163, 74, .15);
      border-radius: 24px;
      background: #ffffff;
      color: #143d2c;
      box-shadow: 0 24px 70px rgba(20, 83, 45, .18);
      overflow-y: auto;
      overflow-x: hidden;
      opacity: 1;
      filter: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }

    .vn-rail-brand{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--vn-shell-line);border-radius:20px;background:linear-gradient(135deg,#fff,var(--vn-shell-soft));color:var(--vn-shell-green);text-decoration:none;}
    .vn-rail-mark{display:grid;place-items:center;width:42px;height:42px;border-radius:15px;background:linear-gradient(135deg,#14532d,#16a34a);color:#fff;font-weight:900;box-shadow:0 10px 22px rgba(20,83,45,.22);}
    .vn-rail-brand strong,.vn-rail-brand small,.vn-rail-link strong,.vn-rail-link small{display:block;}
    .vn-rail-brand small,.vn-rail-link small{color:var(--vn-shell-muted);font-size:.78rem;line-height:1.28;}

    .vn-rail-nav{display:grid;gap:8px;}

    .vn-rail-link {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 58px;
      padding: 9px;
      border: 1px solid rgba(22, 163, 74, .12);
      border-radius: 18px;
      background: #ffffff;
      color: var(--vn-shell-ink);
      text-decoration: none;
      transition: transform .18s ease, border-color .18s ease, background .18s ease;
    }

    .vn-rail-link:hover, .vn-rail-link:focus-visible { transform: translateY(-1px); border-color: rgba(22,163,74,.28); }
    .vn-rail-link.is-active { background: #ecfdf5; }

    .vn-rail-icon { display: grid; place-items: center; width: 35px; height: 35px; flex: 0 0 auto; border-radius: 13px; background: #e7f6ed; color: var(--vn-shell-green); font-size: .76rem; font-weight: 850; }

    .vn-rail-note { margin: 0; padding: 12px; border: 1px solid rgba(180,83,9,.15); border-radius: 16px; background: #fff; color: #4f3c20; font-size: .78rem; line-height: 1.48; }

    /* Feature toggle button */
    .vn-shell-toggle {
      position: fixed;
      top: 10px;
      right: 10px;
      bottom: auto;
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 42px;
      padding: 9px 12px;
      border: 1px solid rgba(22, 163, 74, .15);
      border-radius: 999px;
      background: #ffffff;
      color: #14532d;
      font-weight: 850;
      box-shadow: 0 16px 34px rgba(20, 83, 45, .16);
      opacity: 1;
      filter: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }

    /* Overlay should only darken background, not blur */
    .vn-shell-overlay {
      position: fixed;
      inset: 0;
      z-index: 9000;
      background: rgba(8, 28, 18, .32);
      filter: none;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }

    .vn-shell-overlay[hidden] { display: none; }

    .vn-rail-close { display: none; width: 40px; height: 40px; border: 1px solid rgba(22,163,74,.15); border-radius: 999px; background: #fff; color: #14532d; font-weight: 900; }

    .vn-rail-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }

    @media (max-width: 1180px) {
      body.vn-shell-polished:not(.nusa-chat-page) { padding-right: 0; }
      .vn-shell-toggle, .vn-rail-close { display: inline-flex; align-items: center; justify-content: center; }
      .vn-right-rail { transform: translateX(calc(100% + 24px)); transition: transform .24s ease; }
      body.vn-shell-open { overflow: hidden; }
      body.vn-shell-open .vn-right-rail { transform: translateX(0); }
    }

    @media (max-width: 860px) { body.nusa-chat-page .vn-shell-toggle { top: 14px; right: 14px; bottom: auto; min-height: 40px; padding: 8px 11px; } }
    @media (max-width: 520px) { .vn-right-rail { top: 10px; right: 10px; bottom: 10px; width: min(356px, calc(100vw - 20px)); border-radius: 24px; } .vn-shell-toggle span:last-child { display: none; } }

    /* Strong override to neutralize any remaining blur/filters */
    body .vn-right-rail,
    body .vn-right-rail *,
    body .vn-shell-toggle,
    body .vn-shell-overlay {
      filter: none !important;
      -webkit-filter: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    body .vn-right-rail { background: #ffffff !important; opacity: 1 !important; z-index: 9999 !important; }
    body .vn-shell-toggle { top: 10px !important; right: 10px !important; bottom: auto !important; z-index: 10000 !important; }
    body .vn-shell-overlay { z-index: 9000 !important; }
  `;
  document.head.appendChild(style);
}

function normalizeExistingLinks() {
  document.querySelectorAll('a[href="vitagame.html"]').forEach((link) => {
    link.setAttribute('href', 'vitagame.html/');
  });
  document.querySelectorAll('a[href="../vitagame.html"]').forEach((link) => {
    link.setAttribute('href', '../vitagame.html/');
  });
}

function buildRail(prefix, currentKey) {
  const aside = document.createElement('aside');
  aside.className = 'vn-right-rail';
  aside.setAttribute('data-vn-right-rail', '');
  aside.setAttribute('aria-label', 'Fitur VitaNusa AI');
  aside.setAttribute('aria-hidden', 'false');
  aside.innerHTML = `
    <div class="vn-rail-head">
      <a class="vn-rail-brand" href="${normalizeHref('index.html', prefix)}" aria-label="VitaNusa AI">
        <span class="vn-rail-mark">VN</span>
        <span><strong>VitaNusa AI</strong><small>Asisten edukasi amanah</small></span>
      </a>
      <button class="vn-rail-close" type="button" data-vn-shell-close aria-label="Tutup menu fitur">×</button>
    </div>
    <nav class="vn-rail-nav" aria-label="Menu fitur VitaNusa">
      ${FEATURES.map(([title, desc, href, icon]) => `<a class="vn-rail-link${title === currentKey ? ' is-active' : ''}" href="${normalizeHref(href, prefix)}"><span class="vn-rail-icon" aria-hidden="true">${icon}</span><span><strong>${title}</strong><small>${desc}</small></span></a>`).join('')}
    </nav>
    <p class="vn-rail-note"><strong>Amanah:</strong> edukasi dulu, produk belakangan. Tidak menggantikan dokter, fatwa ahli, atau keputusan profesional.</p>
  `;
  return aside;
}

export function initNusaUiShell() {
  if (document.documentElement.hasAttribute(SHELL_READY_ATTR)) return;
  document.documentElement.setAttribute(SHELL_READY_ATTR, 'true');
  document.body.classList.add('vn-shell-polished');
  injectShellStyles();
  normalizeExistingLinks();

  if (document.querySelector('[data-vn-right-rail]')) return;

  const prefix = getRelativePrefix();
  const currentKey = getCurrentKey();
  const rail = buildRail(prefix, currentKey);
  const overlay = document.createElement('div');
  overlay.className = 'vn-shell-overlay';
  overlay.hidden = true;
  overlay.setAttribute('data-vn-shell-overlay', '');
  overlay.setAttribute('aria-hidden', 'true');

  const toggle = document.createElement('button');
  toggle.className = 'vn-shell-toggle';
  toggle.type = 'button';
  toggle.setAttribute('data-vn-shell-toggle', '');
  toggle.setAttribute('aria-label', 'Buka fitur VitaNusa');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span aria-hidden="true">☰</span><span>Fitur</span>';

  document.body.append(overlay, rail, toggle);

  const closeButton = rail.querySelector('[data-vn-shell-close]');
  const setOpen = (open) => {
    document.body.classList.toggle('vn-shell-open', open);
    overlay.hidden = !open;
    overlay.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    if (window.matchMedia('(max-width: 1180px)').matches) {
      rail.setAttribute('aria-hidden', String(!open));
    } else {
      rail.setAttribute('aria-hidden', 'false');
    }
    if (open) closeButton?.focus({ preventScroll: true });
  };

  const syncRailState = () => {
    const isMobile = window.matchMedia('(max-width: 1180px)').matches;
    const open = document.body.classList.contains('vn-shell-open');
    rail.setAttribute('aria-hidden', String(isMobile && !open));
    if (!isMobile) {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('vn-shell-open');
    }
  };

  toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('vn-shell-open')));
  closeButton?.addEventListener('click', () => setOpen(false));
  overlay.addEventListener('click', () => setOpen(false));
  rail.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
  window.addEventListener('resize', syncRailState);
  syncRailState();
}
