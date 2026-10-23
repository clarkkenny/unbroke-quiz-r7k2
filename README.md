# Unbroke quiz (Webflow build)

The quiz runs entirely inside Webflow. This repo holds the source and a demo page (GitHub Pages).

## Add it to Webflow
1. Site settings > Fonts: add **Inter Tight** (Google Fonts, weights 500 to 800).
2. On the quiz page, add a **Code Embed** where the card sits and paste `webflow/1-code-embed.html`.
   All copy (questions, unlock text, the four results) is in the JSON inside it.
3. Page settings > Custom code > **Before </body> tag**: paste `webflow/2-before-body.html`.
4. Add a **Form Block** to the same page. Form name: `Quiz Signup`. Fields: First Name, Last Name, Email.
   No other required fields, no redirect, reCAPTCHA off. Set it to Display: none.
   On the Form element inside the block, add the custom attribute `data-wf-no-turnstile` (no value).
   Webflow's Turnstile spam check only runs on forms that scroll into view, so it blocks a hidden form.
   Each signup arrives in Webflow form submissions with `quiz_bucket`, `quiz_result`, `quiz_score`,
   `quiz_dream`, `quiz_col_tier`, `quiz_answers`, `quiz_timestamp`.
5. Build four result pages (paths are set in the `pages` part of the Code Embed JSON):
   `/quiz/one-flat-tire`, `/quiz/cautiously-caffeinated`, `/quiz/solid-still-building`, `/quiz/quietly-unbothered`.
   Paste `webflow/3-result-page-head.html` into each one's Inside <head> tag and set `THIS_RESULT`
   (bucket_1 to bucket_4, in that order). Optional custom attributes on your own elements:
   `data-quiz-name`, `data-quiz-pdf`, `data-quiz-share="copy|x|linkedin|facebook|native"`.

The PDF download on the result pages loads jsPDF 2.5.1 from cdnjs the first time someone clicks it. Nothing loads from GitHub.

## Editing
- Copy only: edit the JSON in the Code Embed directly in Webflow, or `widget/src/content.json` here.
- Logic, scoring, styles: edit `widget/src/widget.js` / `widget.css`, then run `python3 widget/build.py`
  (needs `terser`: `npm i -g terser`) and re-paste `webflow/2-before-body.html`.
