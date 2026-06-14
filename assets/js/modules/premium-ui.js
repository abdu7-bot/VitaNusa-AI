const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function addPremiumStyle() {
  if (document.getElementById('vn-premium-js-style')) return;
  const style = document.createElement('style');
  style.id = 'vn-premium-js-style';
  style.textContent = `
    html.js-ready{scroll-behavior:smooth}
    .vn-progress{position:fixed;top:0;left:0;height:4px;width:0;z-index:9999;background:linear-gradient(90deg,#18734f,#2bbb7f,#ffe0a4);box-shadow:0 0 18px rgba(43,187,127,.35);pointer-events:none}
    body.vn-scrolled .site-header{box-shadow:0 12px 32px rgba(15,61,46,.12)}
    .vn-reveal{opacity:0;transform:translateY(18px);transition:opacity .55s ease,transform .55s ease}
    .vn-reveal.is-visible{opacity:1;transform:translateY(0)}
    .main-nav a.is-active{background:rgba(24,115,79,.12);color:#0f3d2e;font-weight:800}
    .vn-top{position:fixed;right:18px;bottom:88px;z-index:80;width:46px;height:46px;border:0;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#18734f,#2bbb7f);color:#fff;font-weight:900;box-shadow:0 16px 34px rgba(15,61,46,.28);opacity:0;transform:translateY(12px) scale(.96);pointer-events:none;transition:.2s;cursor:pointer}
    .vn-top.is-visible{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}
    .vn-img-error{background:#fff4d6;outline:1px dashed rgba(15,61,46,.25)}
    #skor,.score span{transition:transform .18s ease}.vn-score-pop{transform:scale(1.06)}
    @media (prefers-reduced-motion:reduce){html.js-ready{scroll-behavior:auto}.vn-reveal,.vn-top,#skor,.score span{transition:none!important;transform:none!important}}
    @media(max-width:680px){.vn-top{right:14px;bottom:76px;width:42px;height:42px}}
  `;
  document.head.appendChild(style);
}

function frameThrottle(fn) {
  let busy = false;
  return () => {
    if (busy) return;
    busy = true;
    requestAnimationFrame(() => {
      fn();
      busy = false;
    });
  };
}

function initProgress() {
  const bar = document.createElement('div');
  bar.className = 'vn-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  const update = () => {
    const top = window.scrollY || document.documentElement.scrollTop;
    const max = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
    bar.style.width = `${Math.min(100, Math.max(0, (top / max) * 100))}%`;
    document.body.classList.toggle('vn-scrolled', top > 12);
  };

  const onScroll = frameThrottle(update);
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  update();

  return () => {
    removeEventListener('scroll', onScroll);
    removeEventListener('resize', onScroll);
    bar.remove();
  };
}

function initReveal() {
  const items = [...document.querySelectorAll('main > section,.card,.article-card,.featured-banner,.vstory-card,details')];
  if (!items.length) return null;
  items.forEach((el) => el.classList.add('vn-reveal'));

  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return null;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });

  items.forEach((el) => observer.observe(el));
  return () => observer.disconnect();
}

function initActiveNav() {
  const links = [...document.querySelectorAll('.main-nav a[href^="#"]')];
  const pairs = links.map((link) => [document.getElementById(link.hash.slice(1)), link]).filter(([section]) => section);
  if (!pairs.length || !('IntersectionObserver' in window)) return null;

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    links.forEach((link) => link.classList.remove('is-active'));
    pairs.find(([section]) => section === visible.target)?.[1].classList.add('is-active');
  }, { threshold: [.25, .5], rootMargin: '-18% 0px -62% 0px' });

  pairs.forEach(([section]) => observer.observe(section));
  return () => observer.disconnect();
}

function initSmoothLinks() {
  const handler = (event) => {
    const link = event.target.closest?.('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(link.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    const headerHeight = document.querySelector('.site-header')?.offsetHeight ?? 0;
    const top = target.getBoundingClientRect().top + scrollY - headerHeight - 10;
    scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
    history.replaceState(null, '', link.hash);
  };
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
}

function initImages() {
  [...document.images].forEach((img, index) => {
    if (index > 1 && !img.loading) img.loading = 'lazy';
    if (!img.decoding) img.decoding = 'async';
    img.addEventListener('error', () => img.classList.add('vn-img-error'), { once: true });
  });
}

function initBackTop() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'vn-top';
  btn.setAttribute('aria-label', 'Kembali ke atas');
  btn.textContent = '↑';
  document.body.appendChild(btn);

  const update = () => btn.classList.toggle('is-visible', scrollY > 540);
  const onScroll = frameThrottle(update);

  btn.addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  addEventListener('scroll', onScroll, { passive: true });
  update();

  return () => {
    removeEventListener('scroll', onScroll);
    btn.remove();
  };
}

function initFaqPolish() {
  const details = [...document.querySelectorAll('details')];
  const cleanups = details.map((item) => {
    const onToggle = () => {
      if (item.open) details.forEach((other) => {
        if (other !== item) other.open = false;
      });
    };
    item.addEventListener('toggle', onToggle);
    return () => item.removeEventListener('toggle', onToggle);
  });
  return () => cleanups.forEach((fn) => fn());
}

export function initPremiumUI() {
  addPremiumStyle();

  const cleanups = [
    initProgress(),
    initReveal(),
    initActiveNav(),
    initSmoothLinks(),
    initBackTop(),
    initFaqPolish(),
  ].filter(Boolean);

  initImages();

  return {
    destroy() {
      cleanups.forEach((fn) => fn());
    },
  };
}
