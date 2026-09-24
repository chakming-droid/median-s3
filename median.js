(function (root) {
  "use strict";

  function parseFreqToken(raw) {
    const text = String(raw ?? "").trim().toLowerCase();
    if (text === "x") return { c: 0, k: 1 };
    if (!/^\d+$/.test(text)) return null;
    const n = Number(text);
    if (!Number.isInteger(n) || n <= 0) return null;
    return { c: n, k: 0 };
  }

  function addFreq(a, b) {
    return { c: a.c + b.c, k: a.k + b.k };
  }

  function freqAt(freq, x) {
    return freq.c + freq.k * x;
  }

  function normalizeRows(rawRows) {
    const buckets = new Map();
    for (const row of rawRows) {
      const val = Number(row.val);
      const freq = parseFreqToken(row.freq);
      if (!Number.isFinite(val) || freq == null) {
        return { error: "invalid" };
      }
      const prev = buckets.get(val) || { c: 0, k: 0 };
      buckets.set(val, addFreq(prev, freq));
    }

    let unknownCoef = 0;
    const rows = [...buckets.keys()].sort((a, b) => a - b).map((val) => {
      const freq = buckets.get(val);
      unknownCoef += freq.k;
      return { val, freq };
    });

    if (unknownCoef > 1) return { error: "multi-x" };
    if (rows.length === 0) return { error: "empty" };
    return { rows, hasX: unknownCoef === 1 };
  }

  function totalExpr(rows) {
    return rows.reduce((sum, row) => addFreq(sum, row.freq), { c: 0, k: 0 });
  }

  function medianForX(rows, x) {
    if (!Number.isInteger(x) || x <= 0) return null;
    const total = totalExpr(rows);
    const N = freqAt(total, x);
    if (N <= 0) return null;

    function valueAt(position) {
      let left = position;
      for (const row of rows) {
        const count = freqAt(row.freq, x);
        if (left <= count) return row.val;
        left -= count;
      }
      return undefined;
    }

    if (N % 2 === 1) {
      const position = (N + 1) / 2;
      const value = valueAt(position);
      return { N, odd: true, positions: [position], values: [value], median: value };
    }

    const first = N / 2;
    const second = first + 1;
    const value1 = valueAt(first);
    const value2 = valueAt(second);
    return {
      N,
      odd: false,
      positions: [first, second],
      values: [value1, value2],
      median: (value1 + value2) / 2
    };
  }

  function sameNumber(a, b) {
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9;
  }

  function matchesTarget(result, target) {
    return !!result && sameNumber(result.median, target);
  }

  function rangeForTarget(rows, target, limit) {
    const scanLimit = limit || 4000;
    const hits = [];
    for (let x = 1; x <= scanLimit; x += 1) {
      if (matchesTarget(medianForX(rows, x), target)) hits.push(x);
    }

    if (hits.length === 0) {
      return { min: null, max: null, unbounded: false, intervals: [], none: true };
    }

    const intervals = [];
    let start = hits[0];
    let prev = hits[0];
    for (let i = 1; i < hits.length; i += 1) {
      if (hits[i] === prev + 1) {
        prev = hits[i];
        continue;
      }
      intervals.push([start, prev]);
      start = hits[i];
      prev = hits[i];
    }
    intervals.push([start, prev]);

    const last = hits[hits.length - 1];
    let unbounded = false;
    if (last === scanLimit) {
      const probes = [scanLimit + 1, scanLimit + 20, scanLimit + 200];
      unbounded = probes.every((x) => matchesTarget(medianForX(rows, x), target));
    }

    return {
      min: hits[0],
      max: unbounded ? null : last,
      unbounded,
      intervals,
      none: false
    };
  }

  function formatExpr(expr) {
    const c = expr.c;
    const k = expr.k;
    if (k === 0) return String(c);
    if (c === 0) return k === 1 ? "x" : k + "x";
    const xPart = k === 1 ? "x" : k + "x";
    if (c > 0) return c + "+" + xPart;
    return xPart + "-" + (-c);
  }

  function groupSpan(rows, target) {
    let before = { c: 0, k: 0 };
    for (const row of rows) {
      if (sameNumber(row.val, target)) {
        return {
          found: true,
          before,
          count: row.freq,
          start: { c: before.c + 1, k: before.k },
          end: { c: before.c + row.freq.c, k: before.k + row.freq.k }
        };
      }
      before = addFreq(before, row.freq);
    }
    return { found: false };
  }

  function adjacentAverages(rows) {
    const pairs = [];
    for (let i = 0; i < rows.length - 1; i += 1) {
      pairs.push({
        left: rows[i].val,
        right: rows[i + 1].val,
        average: (rows[i].val + rows[i + 1].val) / 2
      });
    }
    return pairs;
  }

  function parseExpr(input) {
    const source = String(input ?? "")
      .trim()
      .toLowerCase()
      .replace(/加/g, "+")
      .replace(/＋/g, "+")
      .replace(/－/g, "-")
      .replace(/（/g, "(")
      .replace(/）/g, ")")
      .replace(/\s+/g, "");
    if (!source || !/^[0-9x+\-()]+$/.test(source)) return null;

    let i = 0;

    function parseExpression() {
      let node = parseTerm();
      if (!node) return null;
      while (source[i] === "+" || source[i] === "-") {
        const op = source[i];
        i += 1;
        const right = parseTerm();
        if (!right) return null;
        node = op === "+"
          ? { c: node.c + right.c, k: node.k + right.k }
          : { c: node.c - right.c, k: node.k - right.k };
      }
      return node;
    }

    function parseTerm() {
      if (source[i] === "(") {
        i += 1;
        const inner = parseExpression();
        if (!inner || source[i] !== ")") return null;
        i += 1;
        return inner;
      }
      if (source[i] === "x") {
        i += 1;
        return { c: 0, k: 1 };
      }
      if (/\d/.test(source[i] || "")) {
        let n = 0;
        while (/\d/.test(source[i] || "")) {
          n = n * 10 + Number(source[i]);
          i += 1;
        }
        if (source[i] === "x") {
          i += 1;
          return { c: 0, k: n };
        }
        return { c: n, k: 0 };
      }
      return null;
    }

    const node = parseExpression();
    if (!node || i !== source.length) return null;
    return node;
  }

  function parseExprFromText(input) {
    const cleaned = String(input ?? "")
      .toLowerCase()
      .replace(/加/g, "+")
      .replace(/＋/g, "+")
      .replace(/－/g, "-")
      .replace(/（/g, "(")
      .replace(/）/g, ")")
      .replace(/[^0-9x+\-()]/g, " ");
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const joined = parseExpr(parts.join(""));
    if (joined) return joined;
    const sorted = parts.slice().sort((a, b) => b.length - a.length);
    for (const part of sorted) {
      const parsed = parseExpr(part);
      if (parsed) return parsed;
    }
    return null;
  }

  function sameExpr(a, b) {
    return !!a && !!b && a.c === b.c && a.k === b.k;
  }

  function describeProblem(rows, target) {
    const total = totalExpr(rows);
    const span = groupSpan(rows, target);
    const averages = adjacentAverages(rows);
    const averageHits = averages.filter((pair) => sameNumber(pair.average, target));
    return {
      total,
      totalText: formatExpr(total),
      span,
      startText: span.found ? formatExpr(span.start) : "",
      endText: span.found ? formatExpr(span.end) : "",
      beforeText: span.found ? formatExpr(span.before) : "",
      countText: span.found ? formatExpr(span.count) : "",
      averages,
      boundaryCanAverageToTarget: averageHits.length > 0
    };
  }

  function classifyQuota(body) {
    const text = JSON.stringify(body || {}).toLowerCase();
    const minute = /rate_limit_exceeded|perminute|per_minute|retry|retrydelay/.test(text);
    const daily = /quota_exceeded|perday|per_day|daily/.test(text);
    if (minute && !daily) return "minute";
    return "daily";
  }

  function monotoneSpline(points) {
    const n = points.length;
    if (n < 2) return null;
    const h = [];
    const delta = [];
    for (let i = 0; i < n - 1; i += 1) {
      h[i] = points[i + 1].x - points[i].x;
      if (!(h[i] > 0)) return null;
      delta[i] = (points[i + 1].y - points[i].y) / h[i];
    }
    const m = new Array(n);
    m[0] = delta[0];
    m[n - 1] = delta[n - 2];
    for (let i = 1; i < n - 1; i += 1) {
      if (delta[i - 1] === 0 || delta[i] === 0 || delta[i - 1] * delta[i] < 0) m[i] = 0;
      else m[i] = (delta[i - 1] + delta[i]) / 2;
    }
    for (let i = 0; i < n - 1; i += 1) {
      if (delta[i] === 0) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i] / delta[i];
      const b = m[i + 1] / delta[i];
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[i] = t * a * delta[i];
        m[i + 1] = t * b * delta[i];
      }
    }
    return { points, h, m };
  }

  function hermite(y0, y1, m0, m1, h, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y0
      + (t3 - 2 * t2 + t) * h * m0
      + (-2 * t3 + 3 * t2) * y1
      + (t3 - t2) * h * m1;
  }

  function splineY(spline, x) {
    const pts = spline.points;
    if (x <= pts[0].x) return pts[0].y;
    if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y;
    let i = 0;
    while (i < pts.length - 2 && x > pts[i + 1].x) i += 1;
    const t = (x - pts[i].x) / spline.h[i];
    return hermite(pts[i].y, pts[i + 1].y, spline.m[i], spline.m[i + 1], spline.h[i], t);
  }

  function splineXForY(spline, y) {
    const pts = spline.points;
    if (y <= pts[0].y) return pts[0].x;
    if (y >= pts[pts.length - 1].y) return pts[pts.length - 1].x;
    let lo = pts[0].x;
    let hi = pts[pts.length - 1].x;
    for (let step = 0; step < 60; step += 1) {
      const mid = (lo + hi) / 2;
      if (splineY(spline, mid) < y) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function curveSamples(points, step) {
    const spline = monotoneSpline(points);
    if (!spline) return [];
    const gap = step || 0.25;
    const samples = [];
    const last = points[points.length - 1].x;
    for (let x = points[0].x; x < last; x += gap) {
      samples.push({ x, y: splineY(spline, x) });
    }
    samples.push({ x: last, y: points[points.length - 1].y });
    return samples;
  }

  function curveMedian(points) {
    const spline = monotoneSpline(points);
    if (!spline) return null;
    const total = points[points.length - 1].y - points[0].y;
    if (!(total > 0)) return null;
    const half = total / 2;
    const targetY = points[0].y + half;
    const rawX = splineXForY(spline, targetY);
    return {
      total,
      half,
      rawX,
      minute: Math.round(rawX)
    };
  }

  root.MedianMath = {
    parseFreqToken,
    normalizeRows,
    medianForX,
    rangeForTarget,
    formatExpr,
    groupSpan,
    parseExpr,
    parseExprFromText,
    sameExpr,
    describeProblem,
    sameNumber,
    classifyQuota,
    monotoneSpline,
    splineY,
    curveSamples,
    curveMedian
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
