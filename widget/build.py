"""Builds the Webflow pastes and the GitHub Pages demo from widget/src.

Run: python3 widget/build.py [path/to/terser]
Outputs:
  webflow/1-code-embed.html        Code Embed where the quiz card sits (holds all copy)
  webflow/2-before-body.html       quiz page: Page settings > Custom code > Before </body> tag
  webflow/3-result-page-head.html  each result page: Page settings > Custom code > Inside <head> tag
  index.html + quiz/*.html         the demo (same code, with demo paths)
"""
import html, json, pathlib, re, subprocess, sys

here = pathlib.Path(__file__).parent
root = here.parent
src = here / 'src'
out = root / 'webflow'
out.mkdir(exist_ok=True)
terser = sys.argv[1] if len(sys.argv) > 1 else 'terser'

# ---------- quiz engine ----------
css = (src / 'widget.css').read_text()
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
css = re.sub(r'\s*\n\s*', ' ', css)
css = re.sub(r'\s*([{};,])\s*', r'\1', css).strip()
js = (src / 'widget.js').read_text()
assert js.count("/*__CSS__*/''") == 1
js = js.replace("/*__CSS__*/''", json.dumps(css, ensure_ascii=False))
mini = subprocess.run([terser, '--compress', '--mangle', '--comments', '/^!/'], input=js,
                      capture_output=True, text=True, check=True).stdout.strip()
engine = ('<!-- UNBROKE QUIZ: engine. Paste into Page settings > Custom code > Before </body> tag. '
          'Edit widget/src in the repo and rebuild instead of editing this. -->\n<script>\n' + mini + '\n</script>\n')

# ---------- content ----------
content = json.loads((src / 'content.json').read_text())
def embed_for(pages):
    c = dict(content, pages=pages)
    j = json.dumps(c, indent=2, ensure_ascii=False).replace('</', '<\\/')
    return ('<!-- UNBROKE QUIZ: Code Embed. All quiz copy lives in the JSON below. "pages" are the result page '
            'paths. Edit the text between quotes; keep the quotes, commas and brackets. -->\n'
            '<div data-unbroke-quiz></div>\n<script type="application/json" data-unbroke-quiz-content>\n' + j + '\n</script>\n')

# ---------- result page ----------
result_js = (src / 'result-page.js').read_text()
def result_for(bucket, quiz_page):
    j = result_js.replace("var THIS_RESULT = 'bucket_1';", f"var THIS_RESULT = '{bucket}';")
    j = j.replace("var QUIZ_PAGE = '/quiz';", f"var QUIZ_PAGE = '{quiz_page}';")
    return '<script>\n' + j.strip() + '\n</script>\n'

files = {
    '1-code-embed.html': embed_for(content['pages']),
    '2-before-body.html': engine,
    '3-result-page-head.html': result_for('bucket_1', '/quiz'),
}
for name, text in files.items():
    (out / name).write_text(text)
    print(f'{name}: {len(text):,} characters', '(OK)' if len(text) < 50000 else '(TOO LONG for Webflow)')

# ---------- demo ----------
idx = root / 'index.html'
if idx.exists():
    t = idx.read_text()
    demo_pages = {k: 'quiz/' + v.rsplit('/', 1)[-1] + '.html' for k, v in content['pages'].items()}
    def swap(t, start, new):
        a = t.index(start); b = t.index('</script>', a) + len('</script>')
        return t[:a] + new.strip() + t[b:]
    t = swap(t, '<!-- UNBROKE QUIZ: Code Embed.', embed_for(demo_pages))
    t = swap(t, '<!-- UNBROKE QUIZ: engine.', engine)
    idx.write_text(t)

    head = t[:t.index('</style></head><body>')]
    head = re.sub(r'<title>.*?</title>', '<title>{TITLE}</title>', head, count=1)
    nav = re.search(r'<nav class="nav">.*?</nav>', t, re.S).group(0).replace('href="./"', 'href="../"')
    (root / 'quiz').mkdir(exist_ok=True)
    page_css = """
.result{max-width:1040px;margin:0 auto 96px;padding:0 16px}
.card{border:2px solid #000;border-radius:28px;background:#94fcae;padding:clamp(28px,6vw,64px)}
.level{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 22px;font:14px/1.3 ui-monospace,Menlo,monospace;color:#0a3a26}
.chip{padding:4px 9px;border-radius:5px;background:#000;color:#fff;font:700 11px/1.25 "Inter Tight",system-ui,sans-serif;letter-spacing:.07em;text-transform:uppercase}
.card h1{font-weight:800;font-size:clamp(34px,6vw,60px);line-height:1;letter-spacing:-.04em;margin:0 0 20px;text-wrap:balance}
.card p.d{font-weight:600;font-size:clamp(17px,2vw,20px);line-height:1.45;max-width:56ch;margin:0 0 30px}
.card h2{font-weight:800;font-size:clamp(20px,2.4vw,24px);letter-spacing:-.02em;margin:0 0 14px}
.card ol{margin:0 0 28px;padding:0;list-style:none;display:grid;gap:12px;max-width:62ch;counter-reset:m}
.card li{position:relative;padding:14px 16px 14px 50px;border:2px solid #000;border-radius:14px;background:#fff;font-weight:500;font-size:clamp(16px,1.8vw,18px);line-height:1.45;counter-increment:m}
.card li::before{content:counter(m);position:absolute;left:14px;top:14px;width:24px;height:24px;border-radius:50%;background:#0a3a26;color:#fff;font:800 13px/24px "Inter Tight",system-ui,sans-serif;text-align:center}
.card p.n{font-style:italic;font-weight:500;font-size:clamp(16px,1.8vw,18px);line-height:1.5;max-width:60ch;margin:0 0 32px;color:#0a3a26}
.actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 24px}
.btn{display:inline-flex;align-items:center;justify-content:center;height:56px;padding:0 24px;border:2px solid #0a3a26;border-radius:12px;background:#0a3a26;color:#fff;font:800 16px/1 "Inter Tight",system-ui,sans-serif;text-transform:uppercase;text-decoration:none;cursor:pointer}
.btn.is-loading{opacity:.6;cursor:progress}
.sbtn{display:inline-flex;align-items:center;height:44px;padding:0 14px;border:2px solid #000;border-radius:10px;background:#fff;color:#000;font:700 14px/1 "Inter Tight",system-ui,sans-serif;text-decoration:none;cursor:pointer}
.sbtn.is-done{background:#edfdf0}
.retake{font:14px ui-monospace,Menlo,monospace;color:#0a3a26}
"""
    for bucket, path in content['pages'].items():
        r = content['results'][bucket]
        slug = path.rsplit('/', 1)[-1]
        moves = ''.join(f'<li>{html.escape(m)}</li>' for m in r['moves'])
        page = (head.replace('{TITLE}', html.escape(r['name'])) + page_css + '</style>\n' + result_for(bucket, '../') +
f'''</head><body>
{nav}
<main class="result">
<div class="note" role="note"><strong>Stand-in result page.</strong> The real result pages are designed in Webflow. The buttons here are plain elements with the custom attributes the result page script looks for: <code>data-quiz-pdf</code>, <code>data-quiz-share</code> and <code>data-quiz-name</code>.</div>
<div class="card">
<p class="level"><span class="chip">{html.escape(r["level"])}</span><span>{html.escape(r["desc"])}</span></p>
<h1><span data-quiz-name>You</span>, you're {html.escape(r["name"])}.</h1>
<p class="d">{html.escape(r["reading"])}</p>
<h2>What changes it</h2>
<ol>{moves}</ol>
<p class="n">{html.escape(r["note"])}</p>
<div class="actions"><button type="button" class="btn" data-quiz-pdf>Download full report</button></div>
<div class="actions"><button type="button" class="sbtn" data-quiz-share="native">Share</button><button type="button" class="sbtn" data-quiz-share="copy">Copy link</button><a class="sbtn" data-quiz-share="x">Post on X</a><a class="sbtn" data-quiz-share="linkedin">LinkedIn</a><a class="sbtn" data-quiz-share="facebook">Facebook</a></div>
<a class="retake" href="../">Retake the quiz</a>
</div></main>
<div class="result"><div class="note"><strong>Sent to the Webflow form (demo stand-in):</strong><pre id="wf" style="margin:8px 0 0;white-space:pre-wrap"></pre></div></div>
<p class="foot">Demo build for internal review.</p>
<script>try{{document.getElementById('wf').textContent=sessionStorage.getItem('demo_wf')||'Nothing yet. Take the quiz first.'}}catch(e){{}}</script>
</body></html>
''')
        (root / 'quiz' / f'{slug}.html').write_text(page)
    print('demo rebuilt:', ', '.join(demo_pages.values()))
