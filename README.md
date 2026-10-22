# Unbroke quiz widget

Self-contained "How broke are you?" quiz. Add it to any page (Webflow Code Embed) with:

```html
<div data-unbroke-quiz></div>
<script src="https://clarkkenny.github.io/unbroke-quiz-r7k2/widget/unbroke-quiz.js" defer></script>
```

Signups: add a Form Block to the same Webflow page, name it `Quiz Signup`, give it First Name, Last Name and Email fields, and hide it.
The widget fills and submits it, so entries land in Webflow form submissions with these extra fields:
`quiz_bucket`, `quiz_result`, `quiz_score`, `quiz_dream`, `quiz_col_tier`, `quiz_answers`, `quiz_timestamp`.

Optional attributes on the div:
- `data-webflow-form="..."` if the form is named something other than Quiz Signup.
- `data-endpoint="https://..."` receives signups as a JSON POST, only when no Webflow form is found.
- `data-share-url="https://..."` is the link people share. Defaults to the page the quiz is on.

Edit `widget/src/` (copy, scoring, styles, report text), then run `python3 widget/build.py`.
Fonts are Inter Tight (SIL Open Font License, see `widget/fonts/OFL.txt`). PDFs use jsPDF 2.5.2 (MIT).
