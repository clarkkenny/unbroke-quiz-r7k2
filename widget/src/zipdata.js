  /* =====================================================================
     ZIP DATA (ported from the client's build: src/quiz/col.ts + src/quiz/zipStats.ts)
     One file in Webflow assets holds the BEA cost-of-living areas and Census ACS figures
     per zip. It is downloaded whole, so the zip never leaves the visitor's browser.
     ===================================================================== */
  var TIER_CUTS = [93, 101, 108];
  function tierForRpp(rpp) { return TIER_CUTS.filter(function (c) { return rpp >= c; }).length; }

  function decodeZipData(raw) {
    var table = new Int16Array(100000).fill(-1), pos = 0;
    raw.rle.split(',').forEach(function (run) {
      var p = run.split('.'), n = parseInt(p[1], 36);
      if (p[0] !== '_') table.fill(parseInt(p[0], 36), pos, pos + n);
      pos += n;
    });
    var census = {}, zip = 0;
    raw.z.split(';').forEach(function (row) {
      var f = row.split(',');
      zip += parseInt(f[0], 36);
      var v = function (i) { return f[i] ? parseInt(f[i], 36) : null; };
      var inc = v(1), rent = v(2), pct = v(3), home = v(4);
      census[('0000' + zip).slice(-5)] = { income: inc, rent: rent, rentPct: pct === null ? null : pct / 10, home: home };
    });
    var areas = raw.areas.map(function (a) { return { label: a[0], kind: a[1], rpp: a[2], housing: a[3] }; });
    return { areas: areas, table: table, census: census };
  }

  // Area for a zip; falls back to the most common area in its 3-digit prefix.
  function lookupArea(db, zip) {
    if (!db || !/^\d{5}$/.test(zip || '')) return null;
    var n = Number(zip), t = db.table;
    if (t[n] !== -1) return db.areas[t[n]];
    // ties go to the area seen first in the prefix, as in the client's version
    var ids = [], counts = {}, best = null, start = Math.floor(n / 100) * 100;
    for (var i = start; i < start + 100; i++) if (t[i] !== -1) {
      if (!(t[i] in counts)) { counts[t[i]] = 0; ids.push(t[i]); }
      counts[t[i]]++;
    }
    ids.forEach(function (id) { if (best === null || counts[id] > counts[best]) best = id; });
    return best === null ? null : db.areas[best];
  }

  var SALARY_BANDS = { q2_a: [null, 50000], q2_b: [50000, 100000], q2_c: [100000, 200000], q2_d: [200000, null] };
  var TOP = { income: 250001, rent: 3501, rentPct: 50, home: 2000001 };
  var RENT_LINE = 30;
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function money(n) {
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    return '$' + Math.round(n / 1000) + 'K';
  }
  function band(q2, factor) {
    var b = SALARY_BANDS[q2]; if (!b) return null;
    if (b[0] === null) return 'under ' + money(b[1] * factor);
    if (b[1] === null) return money(b[0] * factor) + '+';
    return money(b[0] * factor) + '–' + money(b[1] * factor);
  }
  function formatPct(p) { return p === 0 ? '0%' : (p > 0 ? '+' : '−') + Math.abs(p) + '%'; }
  var FMT = {
    income: function (n) { return n >= TOP.income ? '$250K+' : money(n); },
    rent: function (n) { return n >= TOP.rent ? '$3,500+' : '$' + Math.round(n).toLocaleString('en-US'); },
    rentPct: function (n) { return n >= TOP.rentPct ? '50%+' : Math.round(n) + '%'; },
    home: function (n) { return n >= TOP.home ? '$2M+' : money(n); }
  };
  function incomeLine(q2, median, zip) {
    var b = SALARY_BANDS[q2]; if (!b) return null;
    var label = band(q2, 1), typical = 'the typical household in ' + zip + ' (' + FMT.income(median) + ')';
    if (b[1] !== null && b[1] <= median) return 'At ' + label + ', your household earns less than ' + typical + '.';
    if (b[0] !== null && b[0] >= median) return 'At ' + label + ', your household earns more than ' + typical + '.';
    return 'At ' + label + ', your household earns about what ' + typical + ' does.';
  }
  function rentShareLine(pct, zip) {
    var r = Math.round(pct), vs = r > RENT_LINE ? 'past' : r < RENT_LINE ? 'under' : 'right at';
    return 'Renters in ' + zip + ' typically spend ' + FMT.rentPct(pct) + ' of their income on rent, ' + vs + ' the ' + RENT_LINE + '% line most planners use.';
  }

  // "Your zip, by the numbers". Same output as the client's zipStats().
  function zipStats(zip, area, local, q2) {
    var areaTitle = area ? (area.kind === 'm' ? area.label + ' area' : cap(area.label)) : null;
    var tiles = [], lines = [], sources = [];
    if (zip && local) {
      if (local.income !== null) tiles.push({ value: FMT.income(local.income), label: 'typical household income' });
      if (local.rent !== null) tiles.push({ value: FMT.rent(local.rent), label: 'median rent per month' });
      if (local.rentPct !== null) tiles.push({ value: FMT.rentPct(local.rentPct), label: 'of income goes to rent (typical renter)' });
      if (local.home !== null) tiles.push({ value: FMT.home(local.home), label: 'median home value' });
      if (local.income !== null) { var il = incomeLine(q2, local.income, zip); if (il) lines.push({ text: il, strong: true }); }
      if (local.rentPct !== null) lines.push({ text: rentShareLine(local.rentPct, zip) });
      if (tiles.length) sources.push('U.S. Census Bureau, ACS 2020–2024 5-year estimates (zip)');
    }
    var hasLocal = tiles.length > 0;
    if (area) {
      var costPct = Math.round(area.rpp - 100), housingPct = Math.round(area.housing - 100);
      var place = area.kind === 'm' ? 'around ' + area.label : 'in ' + area.label;
      if (!hasLocal) {
        tiles.push({ value: formatPct(costPct), label: 'cost of living vs. US average' });
        tiles.push({ value: formatPct(housingPct), label: 'housing vs. US average' });
      }
      var cost = costPct === 0 ? 'life ' + place + ' costs about the same as the US average'
        : 'life ' + place + ' costs ' + Math.abs(costPct) + '% ' + (costPct > 0 ? 'more' : 'less') + ' than the US average';
      var housing = housingPct === 0 ? 'housing sits right at the national average'
        : 'housing alone runs ' + Math.abs(housingPct) + '% ' + (housingPct > 0 ? 'more' : 'less');
      lines.push({ text: (hasLocal ? 'Zoom out: ' + cost : cap(cost)) + ', and ' + housing + '.' });
      var here = band(q2, 1);
      if (here) lines.push({ text: cap(here) + ' here goes about as far as ' + band(q2, 100 / area.rpp) + ' in an average US city.', strong: !hasLocal });
      sources.push('U.S. Bureau of Economic Analysis, Regional Price Parities (metro)');
    }
    if (!tiles.length) return null;
    return { title: hasLocal ? zip : areaTitle, subtitle: hasLocal ? areaTitle : null, tiles: tiles, lines: lines,
      source: 'Sources: ' + sources.join('; ') + '.' };
  }

  var zipDb = null;
  function loadZipData(url) {
    if (!zipDb) {
      zipDb = !url ? Promise.resolve(null)
        : fetch(url).then(function (r) { return r.ok ? r.json() : null; })
            .then(function (raw) { return raw ? decodeZipData(raw) : null; })
            .catch(function () { return null; });
    }
    return zipDb;
  }
  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (res) { setTimeout(function () { res(null); }, ms); })]);
  }

