/*! Unbroke page transition, site-wide. Click an internal link: the page is covered, then a real page load,
 *  then the next page is revealed. Every style ends fully covered in config.color, and this script runs in
 *  the <head>, so the next page paints that same colour (and word) before its first frame: no white flash.
 *  Real loads keep Webflow's own interactions working; no Barba/Swup.
 *  Links that never transition: new tab, #anchors on the same page, downloads, mailto/tel, other sites,
 *  Cmd/Ctrl/Shift-click, and anything inside [data-tx-prevent]. Give a link data-tx-word="..." to show a word.
 */
(function () {
  'use strict';
  var config = {
    style: 'flood',            // flood | iris | shutter | blinds | card
    color: '#95ffb1',          // cover colour
    coverEase: 'inout',        // see EASES
    revealEase: 'expo',
    coverDuration: 720,        // ms on the quiz page
    revealDuration: 820,       // ms on the result page
    revealFrom: 'same',        // same (where the click was) | center | top
    // flood
    dotSize: 22,               // grid cell, px
    spread: 0.7,               // share of the time spent travelling outward (0 = all at once)
    jitter: 0.25,              // randomness in each dot's start
    // shutter / card
    curve: 90,                 // bulge of the moving edge, px
    radius: 28,                // card corner radius at the start
    // blinds
    bars: 7,
    stagger: 0.45,
    // the word held on the cover across the page load
    word: 'level',             // quiz -> result: level ("STABLE") | name ("Solid, Still Building") | none
    linkWord: 'none',          // other links: none | text (the link's own text). data-tx-word on a link always wins
    wordColor: '#073823',
    wordFont: '"Abcgravityxxcompressed Ultra", Anton, Impact, "Arial Narrow", sans-serif',
    wordSize: 0.17,            // share of viewport width
    wordRise: 36,              // px it travels in and out
    prefetch: true,            // start loading a page when the pointer reaches its link
    watchdog: 6000             // ms: if the next page never comes, uncover this one
  };

  var EASES = {
    expo: [0.16, 1, 0.3, 1], soft: [0.22, 1, 0.36, 1], inout: [0.65, 0, 0.35, 1],
    snappy: [0.2, 0.8, 0.2, 1], overshoot: [0.34, 1.4, 0.64, 1], linear: [0, 0, 1, 1]
  };
  function bezier(p) {
    var x1 = p[0], y1 = p[1], x2 = p[2], y2 = p[3];
    function a(a1, a2) { return 1 - 3 * a2 + 3 * a1; }
    function b(a1, a2) { return 3 * a2 - 6 * a1; }
    function c(a1) { return 3 * a1; }
    function at(t, a1, a2) { return ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t; }
    function slope(t, a1, a2) { return 3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1); }
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i++) { var s = slope(t, x1, x2); if (Math.abs(s) < 1e-6) break; t -= (at(t, x1, x2) - x) / s; }
      return at(Math.min(1, Math.max(0, t)), y1, y2);
    };
  }
  function ease(name) { return bezier(EASES[name] || EASES.expo); }
  function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  var KEY = 'uq_tx', canvas = null, ctx = null, W = 0, H = 0, raf = 0;
  var state = { ox: 0.5, oy: 0.5, rect: null, word: '' };

  function mount() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483000;pointer-events:none';
      ctx = canvas.getContext('2d');
    }
    if (!canvas.isConnected) document.documentElement.appendChild(canvas);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function unmount() { cancelAnimationFrame(raf); if (canvas && canvas.isConnected) canvas.remove(); }

  function origin(phase) {
    if (phase === 'reveal' && config.revealFrom === 'center') return [W / 2, H / 2];
    if (phase === 'reveal' && config.revealFrom === 'top') return [W / 2, -H * 0.1];
    return [state.ox * W, state.oy * H];
  }
  function far(x, y) { return Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y)); }

  /* ---- one frame of one phase at raw progress p (0..1). Exposed for the scrub slider. ---- */
  function frame(phase, p) {
    if (!ctx) mount();
    var cover = phase === 'cover', e = ease(cover ? config.coverEase : config.revealEase);
    var o = origin(phase), ox = o[0], oy = o[1], s = config.style;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = config.color;

    if (s === 'flood') {
      var cell = Math.max(6, config.dotSize), R = cell * 0.75, maxD = far(ox, oy), sp = clamp(config.spread), j = clamp(config.jitter);
      var cols = Math.ceil(W / cell) + 1, rows = Math.ceil(H / cell) + 1, n = 0;
      ctx.beginPath();
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
        var x = c * cell + cell / 2, y = r * cell + cell / 2, d = Math.hypot(x - ox, y - oy) / maxD;
        var start = sp * (d * (1 - j) + rnd(++n) * j), lp = sp >= 1 ? (p >= start ? 1 : 0) : clamp((p - start) / (1 - sp));
        var k = cover ? e(lp) : 1 - e(lp), rad = R * k;
        if (rad > 0.3) { ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, Math.PI * 2); }
      }
      ctx.fill();
    } else if (s === 'iris') {
      var m = far(ox, oy), t = e(p);
      if (cover) { ctx.beginPath(); ctx.arc(ox, oy, m * t, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(ox, oy, m * t, 0, Math.PI * 2, true); ctx.fill(); }
    } else if (s === 'shutter') {
      var t2 = e(p), bulge = Math.sin(Math.PI * clamp(p)) * config.curve;
      ctx.beginPath();
      if (cover) { // rises from the bottom, top edge bowed upward
        var top = H * (1 - t2);
        ctx.moveTo(0, H); ctx.lineTo(0, top); ctx.quadraticCurveTo(W / 2, top - bulge, W, top); ctx.lineTo(W, H);
      } else {     // keeps rising off the top, bottom edge bowed
        var bot = H * (1 - t2);
        ctx.moveTo(0, 0); ctx.lineTo(0, bot); ctx.quadraticCurveTo(W / 2, bot - bulge, W, bot); ctx.lineTo(W, 0);
      }
      ctx.closePath(); ctx.fill();
    } else if (s === 'blinds') {
      var nb = Math.max(2, Math.round(config.bars)), bh = H / nb, st = clamp(config.stagger);
      var order = []; for (var i = 0; i < nb; i++) order.push({ i: i, d: Math.abs((i + 0.5) * bh - oy) });
      order.sort(function (a, b) { return a.d - b.d; });
      order.forEach(function (it, rank) {
        var start = nb > 1 ? st * rank / (nb - 1) : 0, lp = st >= 1 ? 1 : clamp((p - start) / (1 - st));
        var k = cover ? e(lp) : 1 - e(lp), h = (bh + 1) * k;
        ctx.fillRect(0, it.i * bh + (bh - h) / 2, W, h);
      });
    } else if (s === 'card') {
      var t3 = e(p);
      if (cover) {
        var rc = state.rect || { x: ox - 40, y: oy - 28, w: 80, h: 56 };
        var x0 = rc.x * (1 - t3), y0 = rc.y * (1 - t3), w0 = rc.w + (W - rc.w) * t3, h0 = rc.h + (H - rc.h) * t3;
        round(x0, y0, w0, h0, config.radius * (1 - t3));
      } else {     // the sheet lifts away, bottom corners rounding as it goes
        var lift = H * t3;
        roundBottom(0, -lift, W, H, config.radius * Math.min(1, t3 * 3));
      }
    }

    // the word, held across the load
    if (state.word && config.word !== 'none') {
      var a, dy;
      if (cover) { var q = clamp((p - 0.55) / 0.45); a = q; dy = config.wordRise * (1 - ease('expo')(q)); }
      else { var q2 = ease('expo')(clamp(p / 0.5)); a = 1 - q2; dy = -config.wordRise * q2; }
      if (a > 0.01) {
        var size = Math.round(Math.min(W * config.wordSize, H * 0.32, 260));
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = config.wordColor;
        ctx.font = size + 'px ' + config.wordFont; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        fit(state.word, size);
        ctx.fillText(state.word, W / 2, H / 2 + dy);
        ctx.restore();
      }
    }
  }
  function fit(text, size) {
    var w = ctx.measureText(text).width, max = W * 0.9;
    if (w > max) size = Math.floor(size * max / w);
    ctx.font = size + 'px ' + config.wordFont;
    state.wordVw = size / W;   // the next page's pre-paint hold uses the same fitted size
  }
  function round(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }
  function roundBottom(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.closePath(); ctx.fill();
  }

  function run(phase, ms) {
    return new Promise(function (res) {
      var t0 = performance.now();
      cancelAnimationFrame(raf);
      (function tick(now) {
        var p = Math.min(1, (now - t0) / ms);
        frame(phase, p);
        if (p < 1) raf = requestAnimationFrame(tick); else res();
      })(t0);
    });
  }
  function reduced() { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function setOrigin(from) {
    var r = from && from.getBoundingClientRect ? from.getBoundingClientRect() : null;
    if (r) { state.ox = (r.left + r.width / 2) / innerWidth; state.oy = (r.top + r.height / 2) / innerHeight; state.rect = { x: r.left, y: r.top, w: r.width, h: r.height }; }
    else if (from && typeof from.x === 'number') { state.ox = from.x / innerWidth; state.oy = from.y / innerHeight; state.rect = null; }
  }

  function pickWord(w) {
    if (!w || config.word === 'none' && typeof w === 'object') return '';
    if (typeof w === 'object') return (config.word === 'name' ? w.name : w.level) || '';
    return String(w);
  }

  /* Cover the screen and remember how, so the next page can pick up from the same colour and word. */
  function cover(from, word) {
    mount(); setOrigin(from); state.word = pickWord(word); state.wordVw = 0;
    canvas.style.pointerEvents = 'auto';
    var save = function () {
      try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), ox: state.ox, oy: state.oy, word: state.word, vw: state.wordVw })); } catch (e) {}
    };
    if (reduced()) { frame('cover', 1); save(); return Promise.resolve(); }
    return run('cover', config.coverDuration).then(save);
  }

  var leaving = false, dog = 0;
  /* Cover, then navigate. The quiz calls this with the result page, the button and {level, name}. */
  function go(url, from, word) {
    if (leaving) return;
    leaving = true;
    cover(from, word).then(function () {
      dog = setTimeout(function () { leaving = false; unmount(); }, config.watchdog);
      api.navigate(url);
    });
  }

  /* Next page, in the <head>, before first paint: hold the cover colour and word. */
  function arrive() {
    var t = null;
    try { t = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!t || Date.now() - t.at > 15000) return false;
    var css = 'html{background:' + config.color + '!important}' +
      'html::before{content:"";position:fixed;inset:0;z-index:2147483000;background:' + config.color + '}';
    if (t.word) css += 'html::after{content:' + JSON.stringify(t.word) + ';position:fixed;left:5vw;right:5vw;top:50%;z-index:2147483001;' +
      'transform:translateY(-50%);text-align:center;white-space:nowrap;color:' + config.wordColor + ';' +
      'font-size:' + (t.vw ? (t.vw * 100).toFixed(3) + 'vw' : 'min(' + (config.wordSize * 100) + 'vw,32vh,260px)') + ';line-height:1;font-family:' + config.wordFont + '}';
    var st = document.getElementById('uq-tx-hold') || document.createElement('style');
    st.id = 'uq-tx-hold'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
    return true;
  }

  /* Next page, once the DOM is in: reveal. Safe to call when there was no transition. */
  function reveal() {
    var t = null;
    try { t = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); } catch (e) {}
    if (!t) { release(); return Promise.resolve(false); }
    state.ox = t.ox; state.oy = t.oy; state.word = t.word || '';
    mount(); canvas.style.pointerEvents = 'none'; frame('reveal', 0); release();
    var go2 = function () { return reduced() ? Promise.resolve() : run('reveal', config.revealDuration); };
    var fonts = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 250); })]) : Promise.resolve();
    return fonts.then(go2).then(function () { unmount(); return true; });
  }
  // drop the pre-paint hold painted by arrive()
  function release() { var h = document.getElementById('uq-tx-hold'); if (h) h.remove(); }

  /* ---- which links transition ---- */
  function target(a) {
    if (!a || !a.href || a.closest('[data-tx-prevent]') || a.hasAttribute('download')) return null;
    var tg = a.getAttribute('target'); if (tg && tg !== '_self') return null;
    var u; try { u = new URL(a.href, location.href); } catch (e) { return null; }
    if (!/^https?:$/.test(u.protocol) || u.origin !== location.origin) return null;
    if (u.pathname === location.pathname && u.search === location.search) return null; // same page / #anchor
    return u;
  }
  function onClick(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]'), u = target(a);
    if (!u) return;
    e.preventDefault();
    var w = a.getAttribute('data-tx-word');
    if (w === null && config.linkWord === 'text') { w = (a.textContent || '').trim(); if (w.length > 24) w = ''; }
    go(u.href, { x: e.clientX || innerWidth / 2, y: e.clientY || innerHeight / 2 }, w || '');
  }
  var fetched = {};
  function onHover(e) {
    if (!config.prefetch) return;
    var a = e.target.closest && e.target.closest('a[href]'), u = target(a);
    if (!u || fetched[u.href]) return;
    fetched[u.href] = 1;
    var l = document.createElement('link'); l.rel = 'prefetch'; l.href = u.href; document.head.appendChild(l);
  }

  /* Wire it up. Call once, in the <head>, after any config changes. */
  function start() {
    var vt = document.createElement('style');
    // hold the covered frame across the load where the browser can (Chrome, Safari), with no animation of its own
    vt.textContent = '@view-transition{navigation:auto}::view-transition-group(*),::view-transition-old(*),::view-transition-new(*){animation:none}';
    (document.head || document.documentElement).appendChild(vt);
    arrive();
    var ready = function () { api.reveal(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
    document.addEventListener('click', onClick);
    document.addEventListener('pointerover', onHover, { passive: true });
    document.addEventListener('touchstart', onHover, { passive: true });
    // back/forward from the cache: never come back to a covered page
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) { clearTimeout(dog); leaving = false; release(); unmount(); }
    });
    setTimeout(release, 4000); // the hold can never outlive a stuck page
  }

  var api = window.UQTransition = {
    config: config, EASES: EASES, ease: ease, frame: frame, state: state,
    start: start, go: go, cover: cover, arrive: arrive, reveal: reveal, release: release, mount: mount, unmount: unmount, setOrigin: setOrigin,
    eligible: function (a) { return !!target(a); },
    _reset: function () { leaving = false; clearTimeout(dog); },
    navigate: function (url) { location.href = url; }   // the tuner swaps this for a fake page load
  };
})();
