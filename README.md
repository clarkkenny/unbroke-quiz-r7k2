# Unbroke quiz widget

Self-contained "How broke are you?" quiz. Add it to any page (Webflow Code Embed) with:

```html
<div data-unbroke-quiz></div>
<script src="https://clarkkenny.github.io/unbroke-quiz-r7k2/widget/unbroke-quiz.js" defer></script>
```

Optional attributes on the div:
- `data-endpoint="https://..."` receives each signup as a JSON POST. Without it the quiz runs in test mode and stores nothing.
- `data-share-url="https://..."` is the link people share. Defaults to the page the quiz is on.

Edit `widget/src/` (copy, scoring, styles, report text), then run `python3 widget/build.py`.
Fonts are Inter Tight (SIL Open Font License, see `widget/fonts/OFL.txt`). PDFs use jsPDF 2.5.2 (MIT).
