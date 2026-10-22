"""Builds widget/unbroke-quiz.js from widget/src. Run: python3 widget/build.py"""
import json, pathlib, re
here = pathlib.Path(__file__).parent
src = here / 'src'
css = (src / 'widget.css').read_text()
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
css = re.sub(r'\s*\n\s*', ' ', css)
report = json.loads((src / 'report.json').read_text())
js = (src / 'widget.js').read_text()
assert js.count('/*__CSS__*/\'\'') == 1 and js.count('/*__REPORT__*/null') == 1
js = js.replace("/*__CSS__*/''", json.dumps(css, ensure_ascii=False))
js = js.replace('/*__REPORT__*/null', json.dumps(report, ensure_ascii=False, indent=2).replace('\n', '\n  '))
(here / 'unbroke-quiz.js').write_text(js)
print('built', len(js), 'bytes')
