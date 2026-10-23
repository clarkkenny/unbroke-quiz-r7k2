/*! Unbroke quiz result page. Paste into each result page: Page settings > Custom code > Inside <head> tag.
 *  Change THIS_RESULT on each page: bucket_1 One Flat Tire, bucket_2 Cautiously Caffeinated,
 *  bucket_3 Solid Still Building, bucket_4 Quietly Unbothered.
 *  Custom attributes you can put on your own Webflow elements:
 *    data-quiz-name                 text is replaced with the person's first name
 *    data-quiz-pdf                  click downloads the full report as a PDF
 *    data-quiz-share="copy"         copies the quiz link
 *    data-quiz-share="x" | "linkedin" | "facebook"   opens that site's share window
 *    data-quiz-share="native"       phone share sheet (hidden where the browser has none)
 */
(function () {
  'use strict';
  var THIS_RESULT = 'bucket_1';
  var QUIZ_PAGE = '/quiz';

  var data = null;
  try {
    if (sessionStorage.getItem('uq_unlocked') === THIS_RESULT) data = JSON.parse(sessionStorage.getItem('uq_report') || 'null');
  } catch (e) {}

  // No unlock in this tab, or a different result: send them to take the quiz
  if (!data || data.bucket !== THIS_RESULT) {
    document.documentElement.style.visibility = 'hidden';
    location.replace(QUIZ_PAGE);
    return;
  }

  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  function flash(el, text) {
    el.classList.add('is-done');
    var plain = !el.children.length, before = el.textContent;
    if (plain) el.textContent = text;
    setTimeout(function () { el.classList.remove('is-done'); if (plain) el.textContent = before; }, 2000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    each('[data-quiz-name]', function (el) { el.textContent = data.firstName; });

    var url = encodeURIComponent(data.shareUrl), text = encodeURIComponent(data.shareText);
    var LINKS = {
      x: 'https://twitter.com/intent/tweet?text=' + text + '&url=' + url,
      linkedin: 'https://www.linkedin.com/sharing/share-offsite/?url=' + url,
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + url
    };
    each('[data-quiz-share]', function (el) {
      var k = el.getAttribute('data-quiz-share');
      if (LINKS[k]) {
        el.setAttribute('href', LINKS[k]); el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener');
        if (el.tagName !== 'A') el.addEventListener('click', function (e) { e.preventDefault(); window.open(LINKS[k], '_blank', 'noopener'); });
      } else if (k === 'native') {
        if (!navigator.share) { el.style.display = 'none'; return; }
        el.addEventListener('click', function (e) {
          e.preventDefault();
          navigator.share({ title: 'How broke are you?', text: data.shareText, url: data.shareUrl }).catch(function () {});
        });
      } else if (k === 'copy') {
        el.addEventListener('click', function (e) { e.preventDefault(); copy(data.shareUrl, el); });
      }
    });

    each('[data-quiz-pdf]', function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        if (el.classList.contains('is-loading')) return;
        el.classList.add('is-loading');
        getPdfLib().then(buildPdf, function () { flash(el, 'Try again'); })
          .then(function () { el.classList.remove('is-loading'); });
      });
    });
  });

  function copy(text, el) {
    function ok() { flash(el, 'Link copied'); }
    function fallback() {
      var t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ok(); } catch (e) {}
      t.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  }

  /* ---------- PDF ---------- */
  var JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var pdfLib = null;
  function getPdfLib() {
    if (pdfLib) return pdfLib;
    pdfLib = window.jspdf ? Promise.resolve() : new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = JSPDF_URL; s.async = true; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    pdfLib.catch(function () { pdfLib = null; });
    return pdfLib;
  }

  function buildPdf() {
    var r = data.report;
    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
    var FACE = { r: ['helvetica', 'normal'], b: ['helvetica', 'bold'], i: ['helvetica', 'italic'] };
    var PW = 612, PH = 792, ML = 54, MR = 54, CW = PW - ML - MR, y = 0;
    var GREEN = [148, 252, 174], INK = [0, 0, 0], DEEP = [10, 58, 38], MINT = [237, 253, 240], WHITE = [255, 255, 255];
    function font(n, size, color) { doc.setFont(FACE[n][0], FACE[n][1]); doc.setFontSize(size); doc.setTextColor.apply(doc, color || INK); }
    function lines(text, n, size, width) { font(n, size); return doc.splitTextToSize(text, width || CW); }
    function ensure(h) { if (y + h > PH - 70) { doc.addPage(); y = 64; } }
    function para(text, n, size, lh, color) {
      var ls = lines(text, n, size);
      font(n, size, color);
      ls.forEach(function (l) { ensure(size * lh); doc.text(l, ML, y + size); y += size * lh; });
    }

    doc.setFillColor.apply(doc, GREEN); doc.rect(0, 0, PW, 150, 'F');
    doc.setDrawColor.apply(doc, INK); doc.setLineWidth(2); doc.line(0, 150, PW, 150);
    font('b', 22); doc.text('UNBROKE', ML, 60, { charSpace: -0.6 });
    font('b', 10, DEEP); doc.text('HOW BROKE ARE YOU?  ·  YOUR FULL REPORT', ML, 82, { charSpace: 0.6 });
    var when = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    font('r', 11, DEEP); doc.text('Prepared for ' + data.firstName + ' ' + data.lastName + '  ·  ' + when, ML, 124);
    y = 190;

    font('b', 9); var chipW = doc.getTextWidth(r.level.toUpperCase()) + 18;
    doc.setFillColor.apply(doc, INK); doc.roundedRect(ML, y - 2, chipW, 20, 4, 4, 'F');
    font('b', 9, WHITE); doc.text(r.level.toUpperCase(), ML + 9, y + 11.5, { charSpace: 0.6 });
    font('r', 11, DEEP); doc.text(r.desc, ML + chipW + 10, y + 12);
    y += 36;

    para(data.firstName + ", you're " + r.name + '.', 'b', 28, 1.1, INK);
    y += 14;
    para(r.reading, 'r', 12, 1.5, INK);
    y += 22;

    ensure(40);
    font('b', 16); doc.text('What changes it', ML, y + 16); y += 34;
    r.moves.forEach(function (m, i) {
      var ls = lines(m, 'r', 11.5, CW - 58), h = ls.length * 11.5 * 1.45 + 26;
      ensure(h + 10);
      doc.setFillColor.apply(doc, MINT); doc.setDrawColor.apply(doc, INK); doc.setLineWidth(1.5);
      doc.roundedRect(ML, y, CW, h, 10, 10, 'FD');
      doc.setFillColor.apply(doc, DEEP); doc.circle(ML + 22, y + 22, 10, 'F');
      font('b', 11, WHITE); doc.text(String(i + 1), ML + 22, y + 26, { align: 'center' });
      font('r', 11.5, INK);
      ls.forEach(function (l, j) { doc.text(l, ML + 44, y + 13 + 11.5 + j * 11.5 * 1.45); });
      y += h + 10;
    });
    y += 10;

    para(r.note, 'i', 12, 1.5, DEEP);
    y += 18;

    ensure(60);
    doc.setDrawColor.apply(doc, DEEP); doc.setLineWidth(0.75); doc.line(ML, y, ML + CW, y); y += 18;
    font('b', 9, DEEP); doc.text('HOW WE SCORED IT', ML, y + 9, { charSpace: 0.6 }); y += 20;
    var tierWord = ['low', 'mid', 'high', 'very high'][data.tier];
    para('Score ' + data.final + ' on a scale of -2 to 18. Your salary and zip put you in a ' + tierWord +
      ' cost-of-living area, which moved your score by ' + (data.adjustment > 0 ? '+' : '') + data.adjustment + '.', 'r', 10.5, 1.5, DEEP);

    var pages = doc.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p);
      font('r', 8.5, [63, 71, 67]);
      doc.text(data.disclaimer, ML, PH - 36);
      doc.text(data.shareUrl.replace(/^https?:\/\//, ''), ML, PH - 24);
      doc.text(p + ' / ' + pages, PW - MR, PH - 24, { align: 'right' });
    }
    doc.save('unbroke-report-' + r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pdf');
  }
})();
