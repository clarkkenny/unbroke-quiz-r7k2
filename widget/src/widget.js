/*! Unbroke "How broke are you?" quiz, Webflow build
 *  Lives entirely in Webflow:
 *   1. Code Embed where the card sits: <div data-unbroke-quiz></div> plus the content JSON (all copy).
 *   2. Page settings > Custom code > Before </body>: this script.
 *   3. A hidden Form Block named "Quiz Signup" on the same page. The quiz fills and submits it.
 *  Fonts come from the site (Inter Tight in Site settings > Fonts). jsPDF loads from cdnjs on first PDF download.
 *  Edit widget/src, then run: python3 widget/build.py
 */
(function () {
  'use strict';


  /* =====================================================================
     CONTENT AND SCORING (follows "How Broke Are You — Scoring & Results Spec")
     ===================================================================== */

  // Copy, questions and results come from the content JSON in the Code Embed (see boot()).
  var REPORT, QUESTIONS, COPY;
  function fill(s, vars) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }); }

  // Spec §3 points, already weighted. Q4 is not scored.
  var SCORING = {
    q7: { a: 0, b: 3, c: 6 },
    q1: { a: 0, b: 2, c: 4 },
    q5: { a: 0, b: 2, c: 4, d: 4 },
    q6: { a: 0, b: 1, c: 2, d: 2 }
  };
  var SALARY_INDEX = { a: 0, b: 1, c: 2, d: 3 };

  // Spec §6. v1 static table by 3-digit ZIP prefix: [first, last, tier]. First match wins.
  // Tiers: 0 low, 1 mid, 2 high, 3 very_high. Unknown ZIP -> mid.
  var COL_TIER_NAMES = ['low', 'mid', 'high', 'very_high'];
  var COL_TABLE = [
    [100,102,3],[112,112,3],[940,941,3],[943,951,3],
    [103,111,2],[113,119,2],[206,209,2],[220,223,2],[19,24,2],[68,69,2],[330,331,2],[606,606,2],[800,803,2],
    [10,27,1],[28,29,1],[30,38,1],[39,49,1],[50,59,1],[60,69,1],
    [70,79,2],[80,89,1],[120,149,1],[150,196,1],[197,199,1],
    [200,205,2],[206,219,1],[220,246,1],[247,268,0],
    [270,289,1],[290,299,1],[300,319,0],[320,349,1],
    [350,369,0],[370,385,0],[386,397,0],[398,399,0],
    [400,427,0],[430,459,0],[460,479,0],[480,499,0],
    [500,528,0],[530,549,1],[550,567,1],[570,577,0],[580,588,0],
    [590,599,1],[600,629,1],[630,658,0],[660,679,0],[680,693,0],
    [700,714,0],[716,729,0],[730,749,0],[750,799,1],[885,885,1],
    [800,816,1],[820,831,1],[832,838,1],[840,847,1],
    [850,865,1],[870,884,1],[889,898,1],
    [900,961,2],[967,968,3],[970,979,2],[980,994,2],[995,999,2]
  ];
  function colTier(zip) {
    var p = /^\d{5}$/.test(zip || '') ? parseInt(zip.slice(0, 3), 10) : -1;
    for (var i = 0; i < COL_TABLE.length; i++) {
      if (p >= COL_TABLE[i][0] && p <= COL_TABLE[i][1]) return COL_TABLE[i][2];
    }
    return 1;
  }

  // Spec §4
  function computeResult(a, tier) {
    var adjustment = Math.max(-2, Math.min(2, SALARY_INDEX[a.q2] - tier));
    var final = SCORING.q7[a.q7] + SCORING.q1[a.q1] + SCORING.q5[a.q5] + SCORING.q6[a.q6] + adjustment;
    var bucket = final <= 3 ? 'bucket_1'
               : final <= 9 ? 'bucket_2'
               : final <= 14 ? 'bucket_3'
               : (a.q5 === 'd' ? 'bucket_4' : 'bucket_3');
    return { final: final, bucket: bucket, tier: tier, adjustment: adjustment };
  }

  /* =====================================================================
     MOTION (tune with ?tune on the demo page)
     ===================================================================== */
  var M = {
    inDuration: 560, outDuration: 200, stagger: 55, distance: 32, rise: 14, blur: 6,
    heightDuration: 460, selectDuration: 340,
    ease: 'cubic-bezier(.16,1,.3,1)', easeOut: 'cubic-bezier(.55,0,1,.45)',
    unlockColor: '#94fcae', floodOrigin: 'button', floodSpread: 700, dotGrow: 420, floodJitter: 160,
    unlockHeight: 760
  };

  var CSS = /*__CSS__*/'';

  var ICON = {
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.9L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/></svg>',
    in: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4v11H3v-11zm7 0h3.8v1.6h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6.1v5.3h-4v-4.7c0-1.1 0-2.6-1.6-2.6s-1.8 1.2-1.8 2.5v4.8h-4v-11z"/></svg>',
    fb: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1z"/></svg>'
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  /* =====================================================================
     WIDGET
     ===================================================================== */
  function mount(host) {
    if (host.__unbrokeQuiz) return;
    host.__unbrokeQuiz = true;

    var endpoint = host.getAttribute('data-endpoint') || '';
    var shareUrl = host.getAttribute('data-share-url') || (location.origin + location.pathname);
    var debug = /quizdebug/.test(location.search);

    var shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<style>' + CSS + '</style>' +
      '<div class="uq-wrap"><section class="uq" aria-label="How broke are you? quiz">' +
      '<div class="uq-head"><span class="uq-count"></span><div class="uq-bar" aria-hidden="true"><span></span></div></div>' +
      '<div class="uq-stage"></div><div class="uq-toast" role="status" aria-live="polite"></div></section></div>';

    var root = shadow.querySelector('.uq');
    var head = shadow.querySelector('.uq-head');
    var stage = shadow.querySelector('.uq-stage');
    var countEl = shadow.querySelector('.uq-count');
    var barEl = shadow.querySelector('.uq-bar > span');
    var toastEl = shadow.querySelector('.uq-toast');

    var reduced = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    function canAnimate() { return !reduced.matches && typeof Element.prototype.animate === 'function'; }
    function done(anims) { return Promise.all(anims.map(function (a) { return a.finished.catch(function () {}); })); }

    var step = 0, answers = {}, N = QUESTIONS.length, busy = false, mode = 'quiz';
    var result = null, person = null;

    function applyVars() {
      root.style.setProperty('--uq-ease', M.ease);
      root.style.setProperty('--uq-sel-dur', M.selectDuration + 'ms');
      root.style.setProperty('--uq-unlock-bg', M.unlockColor);
    }

    function valid(q) { return q.type === 'zip' ? /^\d{5}$/.test(answers[q.id] || '') : !!answers[q.id]; }

    /* ---------- question view ---------- */
    function renderQuestion() {
      applyVars();
      var q = QUESTIONS[step], last = step === N - 1, body;
      if (q.type === 'zip') {
        body = '<input class="uq-zip uq-a" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="postal-code" maxlength="5" aria-labelledby="uq-q" aria-describedby="uq-hint" placeholder="' + esc(q.placeholder) + '" value="' + esc(answers[q.id] || '') + '">' +
               '<p class="uq-note uq-a">' + esc(q.note) + '</p>';
      } else {
        body = '<div class="uq-opts" role="group" aria-labelledby="uq-q">' + q.options.map(function (o) {
          return '<button type="button" class="uq-opt uq-a" aria-pressed="' + (answers[q.id] === o.key) + '" data-key="' + o.key + '">' +
                 '<span class="uq-letter" aria-hidden="true">' + o.key + '.</span><span>' + esc(o.text) + '</span></button>';
        }).join('') + '</div>';
      }
      stage.innerHTML = '<h3 class="uq-q uq-a" id="uq-q" tabindex="-1">' + esc(q.text) + '</h3>' + body +
        '<div class="uq-actions uq-a">' +
          (step > 0 ? '<button type="button" class="uq-back">' + ICON.chev + '<span class="uq-back-label">Back</span></button>' : '') +
          '<button type="button" class="uq-next" aria-disabled="' + !valid(q) + '" aria-describedby="uq-hint"><span>' + (last ? 'Get my results' : 'Next question') + '</span>' + ICON.arrow + '</button>' +
        '</div><p class="uq-hint" id="uq-hint" role="status"></p>';
      countEl.textContent = 'Question ' + (step + 1) + ' of ' + N;
      barEl.style.transform = 'scaleX(' + ((step + 1) / N) + ')';
    }

    function targets() { return Array.prototype.slice.call(stage.querySelectorAll('.uq-a')); }

    function enter(dir) {
      if (!canAnimate()) return Promise.resolve();
      var x = M.distance * dir, y = dir ? 0 : M.rise;
      return done(targets().map(function (el, i) {
        return el.animate([
          { opacity: 0, transform: 'translate3d(' + x + 'px,' + y + 'px,0)', filter: 'blur(' + M.blur + 'px)' },
          { opacity: 1, transform: 'none', filter: 'blur(0px)' }
        ], { duration: M.inDuration, delay: i * M.stagger, easing: M.ease, fill: 'backwards' });
      }));
    }

    function leave(dir, extra) {
      if (!canAnimate()) return Promise.resolve();
      var x = -M.distance * 0.6 * (dir || 1);
      var els = (extra || []).concat(targets());
      return done(els.map(function (el, i) {
        return el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(' + x + 'px,0,0)' }],
          { duration: M.outDuration, delay: i * Math.round(M.stagger * 0.35), easing: M.easeOut, fill: 'forwards' });
      }));
    }

    function morph(el, h0, dur) {
      var h1 = el.offsetHeight;
      dur = dur == null ? M.heightDuration : dur;
      if (!canAnimate() || !dur || h0 === h1) return;
      var prev = el.style.overflow;
      el.style.overflow = 'hidden';
      var a = el.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: dur, easing: M.ease });
      a.finished.catch(function () {}).then(function () { el.style.overflow = prev; });
    }

    function keepInView() {
      if (root.getBoundingClientRect().top < 0) root.scrollIntoView({ behavior: canAnimate() ? 'smooth' : 'auto', block: 'start' });
    }

    function focusHeading() {
      var h = stage.querySelector('[tabindex="-1"]');
      if (h) h.focus({ preventScroll: true });
    }

    function go(dir) {
      if (busy) return;
      busy = true;
      var h0 = stage.offsetHeight;
      leave(dir).then(function () {
        step += dir;
        renderQuestion();
        morph(stage, h0);
        keepInView();
        return enter(dir);
      }).then(function () { busy = false; focusHeading(); });
    }

    function nudge(msg) {
      var hint = stage.querySelector('.uq-hint'), next = stage.querySelector('.uq-next');
      hint.textContent = msg;
      if (canAnimate()) next.animate([
        { transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' },
        { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }
      ], { duration: 360, easing: 'ease-out' });
    }

    function syncNext() { stage.querySelector('.uq-next').setAttribute('aria-disabled', !valid(QUESTIONS[step])); }

    function toast(msg) {
      toastEl.textContent = msg;
      toastEl.classList.add('on');
      clearTimeout(toast.t);
      toast.t = setTimeout(function () { toastEl.classList.remove('on'); }, 1800);
    }

    /* ---------- dot flood ---------- */
    function hexRgb(h) {
      h = String(h).trim().replace('#', '');
      if (h.length === 3) h = h.replace(/./g, '$&$&');
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    function flood(originEl) {
      return new Promise(function (resolve) {
        if (!canAnimate()) return resolve();
        var rect = root.getBoundingClientRect(), bw = 2;
        var W = rect.width - bw * 2, H = rect.height - bw * 2;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var c = document.createElement('canvas');
        c.className = 'uq-flood';
        c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
        root.insertBefore(c, root.firstChild);
        var ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
        var ox = W / 2, oy = H / 2;
        if (M.floodOrigin === 'top') { oy = 0; }
        if (M.floodOrigin === 'button' && originEl) {
          var b = originEl.getBoundingClientRect();
          ox = b.left + b.width / 2 - rect.left - bw; oy = b.top + b.height / 2 - rect.top - bw;
        }
        var g = 11, rMax = g * 0.75, dots = [], maxD = 1;
        for (var y = g / 2; y < H + g; y += g) for (var x = g / 2; x < W + g; x += g) {
          var d = Math.sqrt((x - ox) * (x - ox) + (y - oy) * (y - oy));
          if (d > maxD) maxD = d;
          dots.push([x, y, d, Math.random()]);
        }
        var from = hexRgb(getComputedStyle(root).getPropertyValue('--uq-dot') || '#c4f2d1');
        var to = hexRgb(M.unlockColor);
        var STEPS = 12, fills = [];
        for (var s = 0; s <= STEPS; s++) {
          var k = s / STEPS;
          fills.push('rgb(' + [0, 1, 2].map(function (i) { return Math.round(from[i] + (to[i] - from[i]) * k); }).join(',') + ')');
        }
        function ease(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
        var t0 = performance.now();
        (function frame(now) {
          var t = now - t0, finished = true;
          ctx.clearRect(0, 0, W, H);
          var buckets = [];
          for (var i = 0; i < dots.length; i++) {
            var dt = dots[i], start = (dt[2] / maxD) * M.floodSpread + dt[3] * M.floodJitter;
            var p = (t - start) / M.dotGrow;
            if (p < 1) finished = false;
            if (p <= 0) continue;
            var e = ease(Math.min(p, 1)), bi = Math.round(e * STEPS);
            (buckets[bi] || (buckets[bi] = [])).push(dt[0], dt[1], e * rMax);
          }
          for (var bk = 0; bk < buckets.length; bk++) {
            var list = buckets[bk]; if (!list) continue;
            ctx.fillStyle = fills[bk]; ctx.beginPath();
            for (var j = 0; j < list.length; j += 3) { ctx.moveTo(list[j] + list[j + 2], list[j + 1]); ctx.arc(list[j], list[j + 1], list[j + 2], 0, 6.2832); }
            ctx.fill();
          }
          if (!finished) return requestAnimationFrame(frame);
          root.classList.add('is-unlock');
          resolve();
          requestAnimationFrame(function () { c.remove(); });
        })(t0);
      });
    }

    /* ---------- email step ---------- */
    function finish() {
      busy = true;
      result = computeResult(answers, colTier(answers.q3));
      if (debug) console.log('[unbroke-quiz] result', result, answers);
      var btn = stage.querySelector('.uq-next');
      var lockH = root.offsetHeight;
      root.style.height = lockH + 'px';

      leave(1, [countEl, head.querySelector('.uq-bar')]).then(function () {
        return flood(btn);
      }).then(function () {
        mode = 'gate';
        root.classList.add('is-unlock');
        stage.innerHTML =
          '<span class="uq-kicker uq-a">' + esc(COPY.gateKicker) + '</span>' +
          '<h3 class="uq-q uq-a" tabindex="-1">' + esc(COPY.gateHeadline) + '</h3>' +
          COPY.gateSub.map(function (s) { return '<p class="uq-gate-sub uq-a">' + esc(s) + '</p>'; }).join('') +
          '<form class="uq-form" novalidate>' +
            field('uq-first', 'First name', 'text', 'given-name', 'Sam', true) +
            field('uq-last', 'Last name', 'text', 'family-name', 'Rivera', true) +
            field('uq-email', 'Email address', 'email', 'email', 'you@email.com', false) +
            '<button type="submit" class="uq-submit uq-a">' + esc(COPY.gateButton) + '</button>' +
            '<p class="uq-form-err" role="alert"></p>' +
          '</form>' +
          '<p class="uq-gate-fine uq-a">' + esc(COPY.gateFine) + '</p>';
        root.style.height = '';
        morph(root, lockH, M.unlockHeight);
        keepInView();
        return enter(0);
      }).then(function () { busy = false; focusHeading(); });
    }

    function field(id, label, type, ac, ph, half) {
      return '<div class="uq-field uq-a' + (half ? ' uq-half' : '') + '"><label for="' + id + '">' + esc(label) + '</label>' +
        '<input id="' + id + '" name="' + id + '" type="' + type + '" autocomplete="' + ac + '" placeholder="' + esc(ph) + '" required maxlength="120"></div>';
    }

    function submitGate(form) {
      var first = form.querySelector('#uq-first'), last = form.querySelector('#uq-last'), email = form.querySelector('#uq-email');
      var err = form.querySelector('.uq-form-err'), btn = form.querySelector('.uq-submit');
      err.textContent = '';
      var bad = [first, last, email].filter(function (i) { return !i.value.trim(); })[0] ||
                (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()) ? email : null);
      if (bad) {
        err.textContent = bad === email && email.value.trim() ? 'That email address looks off. Check it and try again.' : 'Fill in all three fields to see your results.';
        bad.focus();
        return;
      }
      person = { firstName: first.value.trim(), lastName: last.value.trim(), email: email.value.trim() };
      var payload = {
        firstName: person.firstName, lastName: person.lastName, email: person.email,
        bucket: result.bucket, result: REPORT[result.bucket].level + ': ' + REPORT[result.bucket].name,
        score: result.final, dream: 'q4_' + answers.q4, colTier: COL_TIER_NAMES[result.tier],
        answers: QUESTIONS.filter(function (q) { return q.type !== 'zip'; }).map(function (q) { return q.id + '_' + answers[q.id]; }).join(','),
        timestamp: new Date().toISOString(), page: location.origin + location.pathname
      };
      busy = true;
      btn.disabled = true;
      btn.textContent = COPY.gateWait;
      var wf = findWebflowForm();
      var send = wf ? sendViaWebflow(wf, payload)
        : endpoint
        ? fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); })
        : Promise.resolve(debug && console.log('[unbroke-quiz] test mode, not sent:', payload));
      send.then(function () {
        host.dispatchEvent(new CustomEvent('unbroke-quiz:signup', { bubbles: true, composed: true, detail: { bucket: result.bucket, score: result.final, tier: COL_TIER_NAMES[result.tier], adjustment: result.adjustment } }));
        showResult();
      }, function () {
        busy = false;
        btn.disabled = false;
        btn.textContent = COPY.gateButton;
        err.textContent = COPY.gateError;
      });
    }

    /* ---------- Webflow form hand-off ----------
       Looks for a native Webflow Form Block on the page whose form name is "Quiz Signup"
       (or whatever data-webflow-form says). Fills it, submits it through Webflow's own
       form handler, and waits for Webflow's success or error message. */
    function findWebflowForm() {
      var name = host.getAttribute('data-webflow-form') || 'Quiz Signup';
      var forms = document.querySelectorAll('form[data-name]');
      for (var i = 0; i < forms.length; i++) if (forms[i].getAttribute('data-name') === name) return forms[i];
      return null;
    }

    function sendViaWebflow(form, p) {
      var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
      var inputs = Array.prototype.filter.call(form.querySelectorAll('input, textarea, select'), function (i) { return i.type !== 'submit'; });
      function find(keys) { for (var i = 0; i < inputs.length; i++) if (keys.indexOf(norm(inputs[i].name)) > -1) return inputs[i]; return null; }
      function put(keys, value, name) {
        var el = find(keys);
        if (!el) { el = document.createElement('input'); el.type = 'hidden'; el.name = name; form.appendChild(el); inputs.push(el); }
        el.value = value;
      }
      put(['firstname', 'first'], p.firstName, 'First-Name');
      put(['lastname', 'last', 'surname'], p.lastName, 'Last-Name');
      var full = find(['name', 'fullname']);
      if (full) full.value = p.firstName + ' ' + p.lastName;
      put(['email', 'emailaddress'], p.email, 'Email');
      put(['quizbucket'], p.bucket, 'quiz_bucket');
      put(['quizresult'], p.result, 'quiz_result');
      put(['quizscore'], String(p.score), 'quiz_score');
      put(['quizdream'], p.dream, 'quiz_dream');
      put(['quizcoltier'], p.colTier, 'quiz_col_tier');
      put(['quizanswers'], p.answers, 'quiz_answers');
      put(['quiztimestamp'], p.timestamp, 'quiz_timestamp');

      var wrap = form.closest('.w-form') || form.parentNode;
      var ok = wrap.querySelector('.w-form-done'), fail = wrap.querySelector('.w-form-fail');
      function shown(el) { return el && (el.style.display === 'block' || getComputedStyle(el).display !== 'none'); }
      var okBefore = shown(ok);

      return new Promise(function (resolve, reject) {
        var t0 = Date.now();
        (function poll() {
          if (ok && !okBefore && shown(ok)) return resolve();
          if (fail && shown(fail)) return reject(new Error('Webflow form error'));
          if (Date.now() - t0 > 15000) return reject(new Error('Webflow form timeout'));
          setTimeout(poll, 150);
        })();
        if (form.requestSubmit) form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
    }

    /* ---------- results view ---------- */
    function showResult() {
      var r = REPORT[result.bucket];
      var h0 = root.offsetHeight;
      leave(1).then(function () {
        mode = 'result';
        var share = encodeURIComponent(shareUrl), text = encodeURIComponent(fill(COPY.shareText, { name: r.name }));
        stage.innerHTML =
          '<span class="uq-kicker uq-a">Your result</span>' +
          '<p class="uq-level uq-a"><span class="uq-chip">' + esc(r.level) + '</span><span>' + esc(r.desc) + '</span></p>' +
          '<h3 class="uq-result-title uq-a" tabindex="-1">' + esc(person.firstName) + ", you're " + esc(r.name) + '.</h3>' +
          '<p class="uq-reading uq-a">' + esc(r.reading) + '</p>' +
          '<p class="uq-label uq-a">Preview: move 1 of ' + r.moves.length + '</p>' +
          '<div class="uq-move uq-a">' + esc(r.moves[0]) + '</div>' +
          '<div class="uq-report uq-a"><h4>' + esc(COPY.reportHeading) + '</h4><ul>' +
            COPY.reportItems.map(function (i) { return '<li>' + esc(fill(i, { n: r.moves.length })) + '</li>'; }).join('') + '</ul>' +
            '<div><button type="button" class="uq-pdf">' + ICON.download + '<span>' + esc(COPY.pdfButton) + '</span></button></div>' +
            '<p class="uq-pdf-msg" role="status"></p></div>' +
          '<div class="uq-share uq-a"><p class="uq-label">' + esc(COPY.shareLabel) + '</p><div class="uq-share-row">' +
            (navigator.share ? '<button type="button" class="uq-sbtn" data-share="native">' + ICON.share + 'Share</button>' : '') +
            '<button type="button" class="uq-sbtn" data-share="copy">' + ICON.link + 'Copy link</button>' +
            '<a class="uq-sbtn" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + text + '&url=' + share + '">' + ICON.x + 'Post</a>' +
            '<a class="uq-sbtn" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=' + share + '">' + ICON.in + 'LinkedIn</a>' +
            '<a class="uq-sbtn" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + share + '">' + ICON.fb + 'Facebook</a>' +
          '</div></div>' +
          '<button type="button" class="uq-retake uq-a">' + esc(COPY.retake) + '</button>';
        morph(root, h0, M.unlockHeight);
        keepInView();
        return enter(0);
      }).then(function () { busy = false; focusHeading(); });
    }

    function shareNative() {
      var r = REPORT[result.bucket];
      navigator.share({ title: 'How broke are you?', text: fill(COPY.shareText, { name: r.name }), url: shareUrl }).catch(function () {});
    }

    function copyLink() {
      var text = shareUrl;
      var ok = function () { toast('Link copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, fallback);
      } else fallback();
      function fallback() {
        var t = document.createElement('textarea');
        t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); ok(); } catch (e) { toast(text); }
        t.remove();
      }
    }

    function retake() {
      busy = true;
      var h0 = root.offsetHeight;
      leave(-1).then(function () {
        mode = 'quiz'; step = 0; answers = {}; result = null; person = null;
        root.classList.remove('is-unlock');
        [countEl, head.querySelector('.uq-bar')].forEach(function (el) { el.getAnimations().forEach(function (a) { a.cancel(); }); });
        renderQuestion();
        morph(root, h0);
        keepInView();
        return enter(0);
      }).then(function () { busy = false; focusHeading(); });
    }

    /* ---------- events ---------- */
    root.addEventListener('click', function (e) {
      if (busy) return;
      var t;
      if (mode === 'result') {
        if (e.target.closest('.uq-pdf')) return downloadPdf(e.target.closest('.uq-pdf'));
        if ((t = e.target.closest('[data-share]'))) return t.getAttribute('data-share') === 'native' ? shareNative() : copyLink();
        if (e.target.closest('.uq-retake')) return retake();
        return;
      }
      if (mode !== 'quiz') return;
      var q = QUESTIONS[step];
      if ((t = e.target.closest('.uq-opt'))) {
        answers[q.id] = t.dataset.key;
        stage.querySelectorAll('.uq-opt').forEach(function (b) { b.setAttribute('aria-pressed', b === t); });
        stage.querySelector('.uq-hint').textContent = '';
        if (canAnimate()) t.querySelector('.uq-letter').animate(
          [{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.3) rotate(-8deg)' }, { transform: 'scale(1) rotate(0)' }],
          { duration: 420, easing: M.ease });
        syncNext();
      } else if (e.target.closest('.uq-back')) {
        go(-1);
      } else if (e.target.closest('.uq-next')) {
        if (!valid(q)) return nudge(q.type === 'zip' ? 'Five digits, US ZIP only.' : 'Pick an answer to keep going.');
        if (step === N - 1) finish(); else go(1);
      }
    });
    root.addEventListener('input', function (e) {
      if (mode !== 'quiz' || !e.target.classList.contains('uq-zip')) return;
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
      answers[QUESTIONS[step].id] = e.target.value;
      stage.querySelector('.uq-hint').textContent = '';
      syncNext();
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('uq-zip')) { e.preventDefault(); stage.querySelector('.uq-next').click(); }
    });
    root.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!busy && mode === 'gate') submitGate(e.target);
    });

    /* ---------- PDF ---------- */
    var pdfLib = null;
    function loadScript(src) {
      return new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = src; s.async = true; s.onload = res; s.onerror = function () { rej(new Error('load ' + src)); };
        document.head.appendChild(s);
      });
    }
    var JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    function getPdfLib() {
      if (pdfLib) return pdfLib;
      pdfLib = window.jspdf ? Promise.resolve() : loadScript(JSPDF_URL);
      pdfLib.catch(function () { pdfLib = null; });
      return pdfLib;
    }

    function downloadPdf(btn) {
      var msg = stage.querySelector('.uq-pdf-msg');
      btn.setAttribute('aria-busy', 'true');
      msg.textContent = 'Building your report…';
      getPdfLib().then(function () {
        buildPdf();
        msg.textContent = '';
      }).catch(function (e) {
        if (debug) console.error(e);
        msg.textContent = "The report didn't download. Try again in a moment.";
      }).then(function () { btn.removeAttribute('aria-busy'); });
    }

    function buildPdf() {
      var r = REPORT[result.bucket];
      var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
      var FACE = { IT500: ['helvetica', 'normal'], IT700: ['helvetica', 'bold'], IT800: ['helvetica', 'bold'], IT500i: ['helvetica', 'italic'] };
      var PW = 612, PH = 792, ML = 54, MR = 54, CW = PW - ML - MR, y = 0;
      var GREEN = [148, 252, 174], INK = [0, 0, 0], DEEP = [10, 58, 38], MINT = [237, 253, 240];
      function font(n, size, color) { doc.setFont(FACE[n][0], FACE[n][1]); doc.setFontSize(size); doc.setTextColor.apply(doc, color || INK); }
      function lines(text, n, size, width) { font(n, size); return doc.splitTextToSize(text, width || CW); }
      function ensure(h) { if (y + h > PH - 70) { doc.addPage(); y = 64; } }
      function para(text, n, size, lh, color, width, x) {
        var ls = lines(text, n, size, width);
        font(n, size, color);
        ls.forEach(function (l) { ensure(size * lh); doc.text(l, x || ML, y + size); y += size * lh; });
      }

      // Header band
      doc.setFillColor.apply(doc, GREEN); doc.rect(0, 0, PW, 150, 'F');
      doc.setDrawColor.apply(doc, INK); doc.setLineWidth(2); doc.line(0, 150, PW, 150);
      font('IT800', 22); doc.text('UNBROKE', ML, 60, { charSpace: -0.6 });
      font('IT700', 10, DEEP); doc.text('HOW BROKE ARE YOU?  ·  YOUR FULL REPORT', ML, 82, { charSpace: 0.6 });
      font('IT500', 11, DEEP);
      var when = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text('Prepared for ' + person.firstName + ' ' + person.lastName + '  ·  ' + when, ML, 124);
      y = 190;

      // Level chip + descriptor
      font('IT700', 9); var chipW = doc.getTextWidth(r.level.toUpperCase()) + 18;
      doc.setFillColor.apply(doc, INK); doc.roundedRect(ML, y - 2, chipW, 20, 4, 4, 'F');
      font('IT700', 9, [255, 255, 255]); doc.text(r.level.toUpperCase(), ML + 9, y + 11.5, { charSpace: 0.6 });
      font('IT500', 11, DEEP); doc.text(r.desc, ML + chipW + 10, y + 12);
      y += 36;

      // Title + reading
      para(person.firstName + ", you're " + r.name + '.', 'IT800', 30, 1.08, INK);
      y += 14;
      para(r.reading, 'IT500', 12, 1.5, INK);
      y += 22;

      // Moves
      ensure(40);
      font('IT800', 16); doc.text('What changes it', ML, y + 16); y += 34;
      r.moves.forEach(function (m, i) {
        var ls = lines(m, 'IT500', 11.5, CW - 58), h = ls.length * 11.5 * 1.45 + 26;
        ensure(h + 10);
        doc.setFillColor.apply(doc, MINT); doc.setDrawColor.apply(doc, INK); doc.setLineWidth(1.5);
        doc.roundedRect(ML, y, CW, h, 10, 10, 'FD');
        doc.setFillColor.apply(doc, DEEP); doc.circle(ML + 22, y + 22, 10, 'F');
        font('IT800', 11, [255, 255, 255]); doc.text(String(i + 1), ML + 22, y + 26, { align: 'center' });
        font('IT500', 11.5, INK);
        ls.forEach(function (l, j) { doc.text(l, ML + 44, y + 13 + 11.5 + j * 11.5 * 1.45); });
        y += h + 10;
      });
      y += 10;

      // Note
      para(r.note, 'IT500i', 12, 1.5, DEEP);
      y += 18;

      // How we scored it
      ensure(60);
      doc.setDrawColor.apply(doc, DEEP); doc.setLineWidth(0.75); doc.line(ML, y, ML + CW, y); y += 18;
      font('IT700', 9, DEEP); doc.text('HOW WE SCORED IT', ML, y + 9, { charSpace: 0.6 }); y += 20;
      var tierWord = ['low', 'mid', 'high', 'very high'][result.tier];
      para('Score ' + result.final + ' on a scale of −2 to 18. Your salary and zip put you in a ' + tierWord +
        ' cost-of-living area, which moved your score by ' + (result.adjustment > 0 ? '+' : '') + result.adjustment + '.', 'IT500', 10.5, 1.5, DEEP);

      // Footer on every page
      var pages = doc.getNumberOfPages();
      for (var p = 1; p <= pages; p++) {
        doc.setPage(p);
        font('IT500', 8.5, [63, 71, 67]);
        doc.text(COPY.disclaimer, ML, PH - 36);
        doc.text(shareUrl.replace(/^https?:\/\//, ''), ML, PH - 24);
        doc.text(p + ' / ' + pages, PW - MR, PH - 24, { align: 'right' });
      }
      doc.save('unbroke-report-' + r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pdf');
    }

    /* ---------- start ---------- */
    renderQuestion();
    enter(0);

    // Hooks for the ?tune panel on the demo page
    window.UQ = {
      motion: M,
      apply: applyVars,
      replay: function () { if (!busy) { busy = true; enter(1).then(function () { busy = false; }); } },
      restart: function () {
        mode = 'quiz'; step = 0; answers = {}; result = null; person = null; busy = false;
        root.classList.remove('is-unlock'); root.style.height = '';
        [countEl, head.querySelector('.uq-bar')].forEach(function (el) { el.getAnimations().forEach(function (a) { a.cancel(); }); });
        renderQuestion(); enter(0);
      },
      skipToUnlock: function () {
        if (busy) return;
        QUESTIONS.forEach(function (q) { answers[q.id] = q.type === 'zip' ? '10001' : q.options[1].key; });
        step = N - 1; renderQuestion(); finish();
      }
    };
  }

  function boot() {
    var hosts = document.querySelectorAll('[data-unbroke-quiz]');
    if (!hosts.length) return;
    var block = document.querySelector('script[data-unbroke-quiz-content]');
    try {
      var content = JSON.parse(block.textContent);
      COPY = content.copy; QUESTIONS = content.questions; REPORT = content.results;
    } catch (e) {
      console.error('[unbroke-quiz] Could not read the quiz content. Check the JSON in the Code Embed (quotes and commas).', e);
      return;
    }
    Array.prototype.forEach.call(hosts, mount);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
