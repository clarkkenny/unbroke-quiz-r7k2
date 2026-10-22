/*! Unbroke "How broke are you?" quiz widget
 *  Add to any page with:
 *    <div data-unbroke-quiz></div>
 *    <script src="https://clarkkenny.github.io/unbroke-quiz-r7k2/widget/unbroke-quiz.js" defer></script>
 *  Signups: put a native Webflow Form Block on the same page, named "Quiz Signup", and hide it.
 *  The widget fills and submits it, so entries land in Webflow form submissions.
 *  Optional attributes on the div:
 *    data-webflow-form="Quiz Signup"  Webflow form name to use, if you named it something else.
 *    data-endpoint="https://..."      POST URL for signups as JSON, only used when no Webflow form is found.
 *    data-share-url="https://..."     Link people share. Defaults to the page the quiz is on.
 *  With neither a Webflow form nor an endpoint, the quiz runs in test mode and stores nothing.
 *  Built from widget/src. Edit there, then run: python3 widget/build.py
 */
(function () {
  'use strict';

  var SCRIPT = document.currentScript || document.querySelector('script[src*="unbroke-quiz.js"]');
  var BASE = SCRIPT ? SCRIPT.src.replace(/[^\/]*$/, '') : '';

  /* =====================================================================
     CONTENT AND SCORING (follows "How Broke Are You — Scoring & Results Spec")
     ===================================================================== */

  // Spec §9 report copy per bucket: level, name, desc, reading, moves, note
  var REPORT = {
    "bucket_1": {
      "level": "Crisis",
      "name": "One Flat Tire From a Full Spiral",
      "desc": "less than a month of cushion",
      "reading": "You're running on timing. It works right up until a $400 surprise lands on a Tuesday, and then it doesn't. Here's the truth most finance advice skips: this isn't a discipline problem. Building your first cushion is the slowest, least rewarding stretch of the whole thing. It feels like nothing is happening because mathematically, almost nothing is. That's the design. Not your failure.",
      "moves": [
        "Stop canceling subscriptions to fix this. Trimming $12 lattes won't save a situation like yours, and pretending it will is how you stay stuck. Small stuff is the lowest-stakes corner of your finances.",
        "Run a Stability Sprint. A bounded 60 to 90 day push, with an end date, where every spare dollar goes to one target. Not a forever-diet. It ends.",
        "Get to one month of runway. Then three. That's the whole assignment. Boring, and the most useful thing on this list.",
        "If cutting won't close the gap alone, add income: sell what you don't use, pick up a short gig, renegotiate one bill eating your cash flow."
      ],
      "note": "Your salary and zip nudged this. A modest income in an expensive city can land you here even when you're doing everything right, which is more or less the entire point of the book."
    },
    "bucket_2": {
      "level": "Fragile",
      "name": "Cautiously Caffeinated",
      "desc": "roughly one to three months of runway",
      "reading": "You can survive one bad thing. You can't yet survive two in the same month, and disasters travel in packs. You've got a cushion and a plan that mostly holds, which puts you ahead of most people and squarely in the limbo where the dream still feels a few zeros off. You already did the ugly part. What matters now isn't clipping coupons harder.",
      "moves": [
        "Move your attention from pennies to the decisions that actually change the number: your career, where you live, what you pay for housing. A $15K raise beats a decade of grocery optimizing, and it isn't close.",
        "Run a Career Audit once a year. What's your real market value today, not what you accepted three years ago? More than 15% under market is a gap worth a conversation.",
        "If housing is the thing crushing you, there are five things to try before you relocate: downsize in-market, renegotiate mid-lease, add a roommate, audit the lease for costs your landlord owes, check assistance programs. Relocating is the last resort, not the first.",
        "Before any decision that's hard to undo, ask whether it's a one-way door or a two-way door. Two-way doors get your gut. One-way doors get real analysis."
      ],
      "note": "Your zip did quiet work here. The same life costs wildly different amounts city to city, and that gap is a lever, not a sentence."
    },
    "bucket_3": {
      "level": "Stable",
      "name": "Solid, Still Building",
      "desc": "three-plus months of runway, but the pile is still small",
      "reading": "A surprise expense doesn't scare you anymore. That's real, and most people never get here. But don't mistake a solid cushion for being done. You're in the hardest stretch of wealth-building: the climb toward your first $100K, where progress feels slow because it genuinely is slow. Below that line the math barely moves. The difference now is that your safety net finally lets you stop playing defense and start pulling the levers that actually compound.",
      "moves": [
        "Your first $100K is the hardest money you'll ever save and the most important. After it, compounding starts doing a bigger share of the work. You're not there yet, so the job is to feed the machine.",
        "Automate retirement. Get the full employer match (it's free money), pick a target-date fund, and stop overthinking it. Below $100K, the act of contributing beats any clever strategy.",
        "Raise your contribution 1% every six months. You'll barely feel each step, and you'll be at 10% in two years without a painful overhaul.",
        "Point your attention at the big levers, not the grocery budget: career, location, housing. And when the next raise comes, don't let lifestyle creep quietly eat it."
      ],
      "note": "Your salary and zip held this steady. You've got breathing room. The task is turning breathing room into momentum."
    },
    "bucket_4": {
      "level": "Durable",
      "name": "Quietly Unbothered",
      "desc": "deep runway, and the invested assets to match",
      "reading": "An unexpected expense doesn't wreck your week. It mildly annoys you, and you should know how rare that is. You're past the hardest, most important money you'll ever save, and compounding is quietly doing the work now. Your risk isn't being broke anymore. It's being quietly, expensively stuck while your net worth looks great on paper.",
      "moves": [
        "Watch for paper wealth. A strong balance sheet trapped in home equity and retirement accounts you can't touch isn't freedom. If you can't spend it without a penalty or selling the roof over your head, it's a number on a screen.",
        "Check you're not house-poor in disguise: the beautiful home that quietly ate your 401(k) contribution and your Friday nights.",
        "Ask the question the whole book builds to. Money is one score. Are your Work, Time, and Life freedoms keeping up, or is the money growing while the life shrinks?",
        "Past a certain point, a few hours a year with a fee-only planner pays for itself. This is the one stage where good advice is worth the fee."
      ],
      "note": "The number says you're winning. The only thing left to confirm is whether you're winning the game you meant to play."
    }
  };

  // Spec §2 questions. Answer ID = question id + '_' + key (e.g. q5_d)
  var QUESTIONS = [
    { id: 'q1', text: "It's the 14th of the month. Your card gets declined buying a $6 coffee. Your first thought:", options: [
      { key: 'a', text: '"Weird, the machine must be broken." (It is not the machine.)' },
      { key: 'b', text: '"Right, I moved money into savings. Let me shuffle it back." Mild logistics, no panic.' },
      { key: 'c', text: '"Huh." You tap a different card. You genuinely didn\'t notice.' }
    ]},
    { id: 'q2', text: "Let's talk numbers. What's the household salary situation?", options: [
      { key: 'a', text: 'Under $50K, and the group chat thinks I make more' },
      { key: 'b', text: '$50K–$100K, comfortable-ish, one bad month from un-comfortable' },
      { key: 'c', text: '$100K–$200K and still somehow broke, which is its own genre of pain' },
      { key: 'd', text: "$200K+ (we'll allow it, show-off)" }
    ]},
    { id: 'q3', type: 'zip', text: "Drop your zip code. We're not stalking you, we're doing math.",
      placeholder: 'Five digit ZIP code',
      note: 'Because $70K in Des Moines and $70K in Brooklyn are two completely different personalities, and one of them owns a couch.' },
    { id: 'q4', text: 'The dream. When you picture "made it," what\'s the actual image?', options: [
      { key: 'a', text: "Not flinching at the grocery total. That's it. That's the dream." },
      { key: 'b', text: 'A house, a dog, and the ability to book the flight without a spreadsheet summit' },
      { key: 'c', text: "Quitting the job that's fine but slowly killing me" },
      { key: 'd', text: 'A beach, a laptop, and geographic smugness' }
    ]},
    { id: 'q5', text: 'Someone hands you an unexpected $2,000. Be honest. It:', options: [
      { key: 'a', text: 'Is already spent. It was spent before it arrived. RIP.' },
      { key: 'b', text: "Kills a credit card balance that's been following me like a stray cat" },
      { key: 'c', text: 'Goes straight to savings, and I feel a small, weird thrill about it' },
      { key: 'd', text: 'Gets invested, and I have Opinions about where' }
    ]},
    { id: 'q6', text: 'Your relationship with risk, described as a dating profile:', options: [
      { key: 'a', text: 'Avoidant. One surprise expense and I ghost my own budget.' },
      { key: 'b', text: '"Looking for something stable." Index funds. A high-yield savings account. Nothing that texts back weird.' },
      { key: 'c', text: "Down to gamble a little if the upside is real. I've read one Reddit thread and feel prepared." },
      { key: 'd', text: 'I have crypto opinions at dinner parties. People have stopped inviting me.' }
    ]},
    { id: 'q7', text: 'Sunday night. Bed. Lights off. When money crosses your mind, you feel:', options: [
      { key: 'a', text: "A low hum of dread I've learned to sleep through" },
      { key: 'b', text: 'Fine, mostly. Until I remember one specific thing. Then less fine.' },
      { key: 'c', text: 'Genuinely calm. If something broke tomorrow, I could handle it.' }
    ]}
  ];

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
     COPY
     ===================================================================== */
  var COPY = {
    gateKicker: 'Results ready',
    gateHeadline: 'We know how broke you are. You should probably sit down for this.',
    gateSub: [
      'Your results are weirdly specific. Drop your name and email to see where you landed and download your full report.',
      "You'll get your reading, the one uncomfortable truth, and the exact thing to do about it."
    ],
    gateFine: 'No spam. No "one weird trick." Occasionally a genuinely useful email about being less broke.',
    gateButton: 'Read my results',
    gateWait: 'Unlocking…',
    gateError: "That didn't go through. Check your connection and try again.",
    reportHeading: 'Your full report',
    reportItems: function (n) { return ['All ' + n + ' moves that change your number', 'How your salary and zip shaped this result', 'A copy to keep, as a PDF']; },
    pdfButton: 'Download full report',
    shareLabel: 'Share your result',
    shareText: function (name) { return 'I got "' + name + '" on the How Broke Are You? quiz. Where do you land?'; },
    retake: 'Retake the quiz',
    disclaimer: 'For educational purposes only. Not individual investment, legal or tax advice.'
  };

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

  /* =====================================================================
     FONTS: @font-face must live in the page, not the shadow root.
     A unique family name keeps it from touching the site's own fonts.
     ===================================================================== */
  function injectFonts() {
    if (document.getElementById('unbroke-quiz-fonts')) return;
    var faces = [['500', 'normal', '500-normal'], ['600', 'normal', '600-normal'], ['700', 'normal', '700-normal'], ['800', 'normal', '800-normal'], ['500', 'italic', '500-italic']];
    var css = faces.map(function (f) {
      return '@font-face{font-family:"Unbroke Inter Tight";font-style:' + f[1] + ';font-weight:' + f[0] +
        ';font-display:swap;src:url(' + BASE + 'fonts/inter-tight-latin-' + f[2] + '.woff2) format("woff2")}';
    }).join('');
    var s = document.createElement('style');
    s.id = 'unbroke-quiz-fonts';
    s.textContent = css;
    document.head.appendChild(s);
  }

  var CSS = ":host{all:initial;display:block;width:100%} [hidden]{display:none!important} .uq-wrap{container-type:inline-size;width:100%;text-align:left;line-height:1.4} .uq{ --uq-ink:#000; --uq-btn:#0a3a26; --uq-btn-hover:#11553a; --uq-opt:#edfdf0; --uq-opt-on:#a9f5bf; --uq-accent:#1b7a46; --uq-dot:#c4f2d1; --uq-off-bg:#d7dcd9; --uq-off-ink:#3f4743; --uq-err:#9b1c13; --uq-font:\"Unbroke Inter Tight\",\"Inter Tight\",system-ui,-apple-system,sans-serif; --uq-font-letter:Georgia,\"Times New Roman\",serif; --uq-font-mono:ui-monospace,SFMono-Regular,Menlo,monospace; --uq-ease:cubic-bezier(.16,1,.3,1); --uq-sel-dur:320ms; position:relative;max-width:1040px;margin:0 auto; padding:clamp(24px,6cqi,64px); border:2px solid var(--uq-ink);border-radius:28px; background:#fff;color:var(--uq-ink);overflow:hidden;box-sizing:border-box; font-family:var(--uq-font);-webkit-font-smoothing:antialiased;scroll-margin-top:24px; } .uq *,.uq *::before,.uq *::after{box-sizing:border-box} .uq::before{ content:\"\";position:absolute;inset:0;pointer-events:none; background-image:radial-gradient(circle,var(--uq-dot) 1.3px,transparent 1.8px); background-size:11px 11px; -webkit-mask-image:radial-gradient(ellipse 75% 70% at 50% 50%,#000 35%,transparent 100%); mask-image:radial-gradient(ellipse 75% 70% at 50% 50%,#000 35%,transparent 100%); } .uq>*{position:relative} .uq-head{margin-bottom:clamp(28px,6cqi,60px)} .uq-count{font-family:var(--uq-font-mono);font-size:14px;color:var(--uq-btn);display:block} .uq-bar{margin-top:12px;height:3px;border-radius:3px;background:rgba(10,58,38,.12);overflow:hidden} .uq-bar>span{display:block;height:100%;background:var(--uq-btn);transform-origin:left;transform:scaleX(0); transition:transform 700ms var(--uq-ease)} .uq-stage{margin:-6px;padding:6px} .uq-q{font-family:var(--uq-font);font-weight:700;font-size:clamp(23px,3cqi,34px);line-height:1.15; letter-spacing:-.025em;margin:0 0 clamp(20px,3cqi,28px);outline:none;text-wrap:balance} .uq-opts{display:grid;gap:clamp(10px,1.6cqi,16px)} .uq-opt{all:unset;box-sizing:border-box;position:relative;isolation:isolate;overflow:hidden; display:flex;align-items:center;gap:14px;width:100%;min-height:56px; padding:clamp(14px,2cqi,20px) clamp(18px,2.6cqi,26px); border:2px solid var(--uq-ink);border-radius:16px;background:var(--uq-opt);cursor:pointer; font-family:var(--uq-font);font-weight:600;font-size:clamp(16px,1.8cqi,18px);line-height:1.3;letter-spacing:-.01em; -webkit-tap-highlight-color:transparent; transition:color .2s ease,transform .25s var(--uq-ease),box-shadow .25s var(--uq-ease)} .uq-opt::before{content:\"\";position:absolute;inset:0;z-index:-1;background:var(--uq-opt-on); transform:scaleX(0);transform-origin:left center;transition:transform var(--uq-sel-dur) var(--uq-ease)} .uq-opt[aria-pressed=\"true\"]::before{transform:scaleX(1)} .uq-opt:focus-visible{outline:3px solid var(--uq-accent);outline-offset:3px} .uq-opt:active{transform:scale(.985)} @media (hover:hover){ .uq-opt:hover{color:var(--uq-accent);transform:translateY(-2px);box-shadow:0 4px 0 0 var(--uq-ink)} .uq-opt[aria-pressed=\"true\"]:hover{color:var(--uq-ink)} .uq-opt:active{transform:translateY(0) scale(.985);box-shadow:0 0 0 0 var(--uq-ink)} } .uq-letter{font-family:var(--uq-font-letter);font-weight:400;font-size:clamp(24px,3cqi,28px);line-height:1;flex:none; display:inline-block;min-width:.9em} .uq-zip{display:block;width:100%;height:clamp(96px,17cqi,200px);padding:0 clamp(20px,3cqi,32px); border:2px solid var(--uq-ink);border-radius:16px;background:var(--uq-opt);color:var(--uq-ink); font-family:var(--uq-font);font-weight:600;font-size:clamp(22px,3cqi,32px);letter-spacing:.04em; transition:box-shadow .25s var(--uq-ease)} .uq-zip::placeholder{color:#5f6b65;letter-spacing:0;font-weight:500} .uq-zip:focus{outline:none;box-shadow:0 0 0 3px #fff,0 0 0 6px var(--uq-accent)} .uq-note{font-family:var(--uq-font);font-weight:700;font-size:clamp(18px,2.5cqi,26px);line-height:1.22; letter-spacing:-.02em;margin:clamp(18px,3cqi,28px) 0 0;text-wrap:pretty} .uq-actions{display:flex;gap:12px;margin-top:clamp(28px,4cqi,40px)} .uq-next,.uq-back{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:10px; height:clamp(60px,8cqi,84px);border-radius:12px;cursor:pointer;-webkit-tap-highlight-color:transparent; font-family:var(--uq-font);text-transform:uppercase} .uq-next{flex:1;background:var(--uq-btn);color:#fff;font-weight:800;font-size:clamp(18px,2.6cqi,26px);letter-spacing:.01em; transition:background-color .25s ease,color .25s ease,transform .15s ease} .uq-next svg,.uq-back svg{width:1em;height:1em;flex:none;transition:transform .3s var(--uq-ease)} .uq-next[aria-disabled=\"true\"]{background:var(--uq-off-bg);color:var(--uq-off-ink);cursor:not-allowed} .uq-back{flex:none;padding:0 clamp(18px,3cqi,28px);background:#fff;color:var(--uq-ink);border:2px solid var(--uq-ink); font-weight:700;font-size:clamp(15px,1.8cqi,18px);letter-spacing:.02em; transition:background-color .2s ease,transform .15s ease} .uq-next:focus-visible,.uq-back:focus-visible{outline:3px solid var(--uq-accent);outline-offset:3px} @media (hover:hover){ .uq-next:not([aria-disabled=\"true\"]):hover{background:var(--uq-btn-hover)} .uq-next:not([aria-disabled=\"true\"]):hover svg{transform:translateX(4px)} .uq-back:hover{background:var(--uq-opt)} .uq-back:hover svg{transform:translateX(-3px)} } .uq-next:not([aria-disabled=\"true\"]):active,.uq-back:active{transform:scale(.98)} .uq-hint{font-family:var(--uq-font-mono);font-size:13px;color:var(--uq-err);text-align:center;margin:12px 0 0;min-height:1.3em} .uq-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap} .uq>.uq-flood{position:absolute;inset:0;width:100%;height:100%;pointer-events:none} .uq.is-unlock{background:var(--uq-unlock-bg,#94fcae)} .uq.is-unlock::before{display:none} .uq.is-unlock .uq-head{display:none} .uq-kicker{display:block;font-family:var(--uq-font-mono);font-size:14px;color:var(--uq-btn);margin-bottom:clamp(20px,4cqi,36px)} .uq-gate-sub{font-family:var(--uq-font);font-weight:600;font-size:clamp(16px,2cqi,19px);line-height:1.4;letter-spacing:-.01em; margin:0 0 12px;max-width:52ch} .uq-form{margin-top:clamp(14px,2.6cqi,26px)} .uq-gate-fine{font-family:var(--uq-font-mono);font-size:13px;line-height:1.5;color:var(--uq-btn);margin:16px 0 0;max-width:60ch} .uq-form form{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0} .uq-form .uq-field{position:relative;grid-column:1/-1;margin:0} .uq-form .uq-field.uq-half{grid-column:auto} .uq-form .uq-field label{position:absolute;top:12px;left:14px;z-index:1;margin:0;padding:3px 7px;border-radius:4px; background:var(--uq-ink);color:#fff;font:700 10px/1.25 var(--uq-font);letter-spacing:.07em;text-transform:uppercase;pointer-events:none} .uq-form .uq-field input{display:block;width:100%;height:clamp(72px,9cqi,84px);margin:0;padding:30px 16px 10px; border:2px solid var(--uq-ink);border-radius:16px;background:#fff;color:var(--uq-ink);box-shadow:none; font:600 clamp(17px,2cqi,20px)/1.2 var(--uq-font);letter-spacing:-.01em;-webkit-appearance:none;appearance:none; transition:box-shadow .25s var(--uq-ease),transform .25s var(--uq-ease)} .uq-form .uq-field input::placeholder{color:#5f6b65;font-weight:500} .uq-form .uq-field input:focus{outline:none;box-shadow:0 0 0 2px #fff,0 0 0 5px var(--uq-btn)} .uq-form .uq-submit{grid-column:1/-1;display:block;width:100%;height:clamp(60px,8cqi,84px);margin:8px 0 0;padding:0 16px; border:0;border-radius:12px;background:var(--uq-btn);color:#fff;cursor:pointer;-webkit-appearance:none;appearance:none; font:800 clamp(18px,2.6cqi,26px)/1 var(--uq-font);text-transform:uppercase;letter-spacing:.01em; transition:background-color .25s ease,transform .15s ease} .uq-form .uq-submit:focus-visible{outline:3px solid var(--uq-btn);outline-offset:3px} @media (hover:hover){.uq-form .uq-submit:hover{background:var(--uq-btn-hover)}} .uq-form .uq-submit:active{transform:scale(.98)} @container (max-width:520px){ .uq{border-radius:22px} .uq-opt{gap:12px;border-radius:14px} .uq-back{width:60px;padding:0} .uq-back-label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap} .uq-back svg{width:22px;height:22px} .uq-form .uq-field.uq-half{grid-column:1/-1} } @media (prefers-reduced-motion:reduce){ .uq *,.uq *::before{transition-duration:.01ms!important} } .uq-form{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:clamp(14px,2.6cqi,26px) 0 0} .uq-form .uq-submit:disabled{background:var(--uq-off-bg);color:var(--uq-off-ink);cursor:progress} .uq-form-err{grid-column:1/-1;margin:4px 0 0;font-family:var(--uq-font-mono);font-size:13px;color:var(--uq-err);min-height:0} .uq-form-err:empty{display:none} .uq-level{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 clamp(16px,2.6cqi,22px); font-family:var(--uq-font-mono);font-size:14px;line-height:1.3;color:var(--uq-btn)} .uq-chip{display:inline-block;padding:4px 9px;border-radius:5px;background:var(--uq-ink);color:#fff; font:700 11px/1.25 var(--uq-font);letter-spacing:.07em;text-transform:uppercase} .uq-result-title{font-family:var(--uq-font);font-weight:800;font-size:clamp(32px,5.6cqi,58px);line-height:1;letter-spacing:-.04em; margin:0 0 clamp(16px,2.6cqi,22px);outline:none;text-wrap:balance} .uq-reading{font-family:var(--uq-font);font-weight:600;font-size:clamp(16px,2cqi,20px);line-height:1.45;letter-spacing:-.01em; max-width:56ch;margin:0 0 clamp(24px,4cqi,34px)} .uq-label{font:700 11px/1 var(--uq-font);letter-spacing:.08em;text-transform:uppercase;color:var(--uq-btn);margin:0 0 10px} .uq-move{padding:16px 18px;border:2px solid var(--uq-ink);border-radius:14px;background:#fff;max-width:62ch;margin:0 0 clamp(20px,3cqi,28px); font-family:var(--uq-font);font-weight:500;font-size:clamp(16px,1.8cqi,18px);line-height:1.45} .uq-report{display:grid;gap:16px;padding:clamp(18px,3cqi,28px);border:2px solid var(--uq-ink);border-radius:16px;background:var(--uq-btn);color:#fff; margin:0 0 clamp(20px,3cqi,28px)} .uq-report h4{margin:0;font-family:var(--uq-font);font-weight:800;font-size:clamp(20px,2.6cqi,26px);line-height:1.15;letter-spacing:-.02em} .uq-report ul{margin:0;padding:0;list-style:none;display:grid;gap:8px} .uq-report li{position:relative;padding-left:24px;font-family:var(--uq-font);font-weight:600;font-size:16px;line-height:1.4} .uq-report li::before{content:\"\";position:absolute;left:0;top:5px;width:12px;height:12px;border-radius:3px;background:var(--uq-unlock-bg,#94fcae)} .uq-pdf{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:10px;height:clamp(56px,7cqi,68px); padding:0 clamp(18px,3cqi,26px);border-radius:12px;background:var(--uq-unlock-bg,#94fcae);color:var(--uq-ink);cursor:pointer; font:800 clamp(16px,2cqi,19px)/1 var(--uq-font);text-transform:uppercase;letter-spacing:.01em;transition:transform .15s ease,filter .2s ease} .uq-pdf svg{width:1.1em;height:1.1em} .uq-pdf:focus-visible{outline:3px solid #fff;outline-offset:3px} @media (hover:hover){.uq-pdf:hover{filter:brightness(1.06)}} .uq-pdf:active{transform:scale(.98)} .uq-pdf[aria-busy=\"true\"]{cursor:progress;opacity:.75} .uq-pdf-msg{margin:0;font-family:var(--uq-font-mono);font-size:13px;color:#d9f9e2} .uq-pdf-msg:empty{display:none} .uq-share{display:grid;gap:10px;margin:0 0 clamp(20px,3cqi,28px)} .uq-share-row{display:flex;flex-wrap:wrap;gap:8px} .uq-sbtn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 14px;border:2px solid var(--uq-ink); border-radius:10px;background:#fff;color:var(--uq-ink);cursor:pointer;font:700 14px/1 var(--uq-font);letter-spacing:.01em;text-decoration:none; transition:background-color .2s ease,transform .15s ease} .uq-sbtn svg{width:16px;height:16px;flex:none} .uq-sbtn:focus-visible{outline:3px solid var(--uq-btn);outline-offset:3px} @media (hover:hover){.uq-sbtn:hover{background:var(--uq-opt)}} .uq-sbtn:active{transform:scale(.97)} .uq-retake{all:unset;cursor:pointer;font-family:var(--uq-font-mono);font-size:14px;color:var(--uq-btn);text-decoration:underline;text-underline-offset:3px} .uq-retake:focus-visible{outline:2px solid var(--uq-btn);outline-offset:4px} .uq-toast{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);padding:10px 14px;border-radius:8px;background:var(--uq-ink);color:#fff; font:600 14px/1.2 var(--uq-font);pointer-events:none;opacity:0;transition:opacity .2s ease} .uq-toast.on{opacity:1} ";

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
        var share = encodeURIComponent(shareUrl), text = encodeURIComponent(COPY.shareText(r.name));
        stage.innerHTML =
          '<span class="uq-kicker uq-a">Your result</span>' +
          '<p class="uq-level uq-a"><span class="uq-chip">' + esc(r.level) + '</span><span>' + esc(r.desc) + '</span></p>' +
          '<h3 class="uq-result-title uq-a" tabindex="-1">' + esc(person.firstName) + ", you're " + esc(r.name) + '.</h3>' +
          '<p class="uq-reading uq-a">' + esc(r.reading) + '</p>' +
          '<p class="uq-label uq-a">Preview: move 1 of ' + r.moves.length + '</p>' +
          '<div class="uq-move uq-a">' + esc(r.moves[0]) + '</div>' +
          '<div class="uq-report uq-a"><h4>' + esc(COPY.reportHeading) + '</h4><ul>' +
            COPY.reportItems(r.moves.length).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' +
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
      navigator.share({ title: 'How broke are you?', text: COPY.shareText(r.name), url: shareUrl }).catch(function () {});
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
    function fontB64(file) {
      return fetch(BASE + 'fonts/' + file).then(function (r) { if (!r.ok) throw new Error(file); return r.arrayBuffer(); }).then(function (buf) {
        var bytes = new Uint8Array(buf), bin = '';
        for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      });
    }
    function getPdfLib() {
      if (pdfLib) return pdfLib;
      var files = { IT500: 'inter-tight-500-normal.ttf', IT700: 'inter-tight-700-normal.ttf', IT800: 'inter-tight-800-normal.ttf', IT500i: 'inter-tight-500-italic.ttf' };
      pdfLib = (window.jspdf ? Promise.resolve() : loadScript(BASE + 'vendor/jspdf.umd.min.js')).then(function () {
        var names = Object.keys(files);
        return Promise.all(names.map(function (n) { return fontB64(files[n]); })).then(function (data) {
          var fonts = {}; names.forEach(function (n, i) { fonts[n] = data[i]; }); return fonts;
        });
      });
      pdfLib.catch(function () { pdfLib = null; });
      return pdfLib;
    }

    function downloadPdf(btn) {
      var msg = stage.querySelector('.uq-pdf-msg');
      btn.setAttribute('aria-busy', 'true');
      msg.textContent = 'Building your report…';
      getPdfLib().then(function (fonts) {
        buildPdf(fonts);
        msg.textContent = '';
      }).catch(function (e) {
        if (debug) console.error(e);
        msg.textContent = "The report didn't download. Try again in a moment.";
      }).then(function () { btn.removeAttribute('aria-busy'); });
    }

    function buildPdf(fonts) {
      var r = REPORT[result.bucket];
      var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
      Object.keys(fonts).forEach(function (n) { doc.addFileToVFS(n + '.ttf', fonts[n]); doc.addFont(n + '.ttf', n, 'normal'); });
      var PW = 612, PH = 792, ML = 54, MR = 54, CW = PW - ML - MR, y = 0;
      var GREEN = [148, 252, 174], INK = [0, 0, 0], DEEP = [10, 58, 38], MINT = [237, 253, 240];
      function font(n, size, color) { doc.setFont(n, 'normal'); doc.setFontSize(size); doc.setTextColor.apply(doc, color || INK); }
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
    injectFonts();
    Array.prototype.forEach.call(hosts, mount);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
