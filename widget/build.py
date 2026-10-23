"""Builds the two Webflow pastes from widget/src.

Run: python3 widget/build.py [path/to/terser]
Outputs:
  webflow/1-code-embed.html   paste into a Code Embed where the quiz card sits (holds all copy)
  webflow/2-before-body.html  paste into Page settings > Custom code > Before </body> tag
"""
import json, pathlib, re, subprocess, sys

here = pathlib.Path(__file__).parent
root = here.parent
src = here / 'src'
out = root / 'webflow'
out.mkdir(exist_ok=True)

# CSS, minified enough for a style string
css = (src / 'widget.css').read_text()
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
css = re.sub(r'\s*\n\s*', ' ', css)
css = re.sub(r'\s*([{};,])\s*', r'\1', css).strip()

js = (src / 'widget.js').read_text()
assert js.count("/*__CSS__*/''") == 1
js = js.replace("/*__CSS__*/''", json.dumps(css, ensure_ascii=False))

terser = sys.argv[1] if len(sys.argv) > 1 else 'terser'
mini = subprocess.run([terser, '--compress', '--mangle', '--comments', '/^!/'], input=js, capture_output=True, text=True, check=True).stdout

engine = ('<!-- UNBROKE QUIZ: engine. Paste into Page settings > Custom code > Before </body> tag. '
          'Edit widget/src in the repo and rebuild instead of editing this. -->\n'
          '<script>\n' + mini.strip() + '\n</script>\n')

content = json.loads((src / 'content.json').read_text())
content_json = json.dumps(content, indent=2, ensure_ascii=False).replace('</', '<\\/')
embed = ('<!-- UNBROKE QUIZ: Code Embed. All quiz copy lives in the JSON below. '
         'Edit the text between quotes; keep the quotes, commas and brackets. -->\n'
         '<div data-unbroke-quiz></div>\n'
         '<script type="application/json" data-unbroke-quiz-content>\n' + content_json + '\n</script>\n')

(out / '1-code-embed.html').write_text(embed)
(out / '2-before-body.html').write_text(engine)
for f in ('1-code-embed.html', '2-before-body.html'):
    n = len((out / f).read_text())
    print(f'{f}: {n:,} characters', '(OK, under 50,000)' if n < 50000 else '(TOO LONG for Webflow)')
