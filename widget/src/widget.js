/*! Unbroke "How broke are you?" quiz, Webflow build
 *  Lives entirely in Webflow:
 *   1. Code Embed where the card sits: <div data-unbroke-quiz></div> plus the content JSON (all copy).
 *   2. Page settings > Custom code > Before </body>: this script.
 *   3. A hidden Form Block named "Quiz Signup" on the same page. The quiz fills and submits it,
 *      then sends the person to their Webflow result page (paths in the content JSON "pages").
 *  Fonts come from the site (Inter Tight in Site settings > Fonts). Result pages use result-page.js.
 *  Edit widget/src, then run: python3 widget/build.py
 */
(function () {
  'use strict';


  /* =====================================================================
     CONTENT AND SCORING (follows "How Broke Are You — Scoring & Results Spec")
     ===================================================================== */

  // Copy, questions and results come from the content JSON in the Code Embed (see boot()).
  var REPORT, QUESTIONS, COPY, PAGES;
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
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>'
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
      '<div class="uq-stage"></div></section></div>';

    var root = shadow.querySelector('.uq');
    var head = shadow.querySelector('.uq-head');
    var stage = shadow.querySelector('.uq-stage');
    var countEl = shadow.querySelector('.uq-count');
    var barEl = shadow.querySelector('.uq-bar > span');

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
      var testMode = host.hasAttribute('data-test-mode');
      if (debug) console.log('[unbroke-quiz] signup form:', wf || 'NOT FOUND', '| payload:', payload);
      var send = wf ? sendViaWebflow(wf, payload)
        : endpoint
        ? fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); })
        : testMode
        ? Promise.resolve()
        : Promise.reject(new Error('No Webflow form named "' + (host.getAttribute('data-webflow-form') || 'Quiz Signup') +
            '" on this page. Check the Form Block\'s form name in its settings.'));
      send.then(function () {
        host.dispatchEvent(new CustomEvent('unbroke-quiz:signup', { bubbles: true, composed: true, detail: { bucket: result.bucket, score: result.final, tier: COL_TIER_NAMES[result.tier], adjustment: result.adjustment } }));
        goToResult();
      }, function (e) {
        console.error('[unbroke-quiz] Signup was not saved:', e && e.message);
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
          if (fail && shown(fail)) return reject(new Error('Webflow rejected the submission (its error message showed). Check for extra required fields or reCAPTCHA on the form.'));
          if (Date.now() - t0 > 15000) return reject(new Error('Webflow never confirmed the submission. A required field on the hidden form may be empty, or the page needs republishing.'));
          setTimeout(poll, 150);
        })();
        if (form.requestSubmit) form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
    }

    /* ---------- hand-off to the Webflow result page ----------
       The result page script reads this to guard the page, personalise it and build the PDF. */
    function goToResult() {
      var r = REPORT[result.bucket];
      var data = {
        bucket: result.bucket, firstName: person.firstName, lastName: person.lastName,
        final: result.final, tier: result.tier, adjustment: result.adjustment,
        report: r, disclaimer: COPY.disclaimer, shareText: fill(COPY.shareText, { name: r.name }), shareUrl: shareUrl
      };
      try {
        sessionStorage.setItem('uq_unlocked', result.bucket);
        sessionStorage.setItem('uq_name', person.firstName);
        sessionStorage.setItem('uq_report', JSON.stringify(data));
      } catch (e) {}
      location.href = PAGES[result.bucket];
    }

    /* ---------- events ---------- */
    root.addEventListener('click', function (e) {
      if (busy) return;
      var t;
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
      COPY = content.copy; QUESTIONS = content.questions; REPORT = content.results; PAGES = content.pages;
    } catch (e) {
      console.error('[unbroke-quiz] Could not read the quiz content. Check the JSON in the Code Embed (quotes and commas).', e);
      return;
    }
    Array.prototype.forEach.call(hosts, mount);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
