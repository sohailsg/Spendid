(function () {
    'use strict';

    /** Escape text so interpolated strings are safe in HTML attribute/text contexts. */
    function escapeHtml(raw) {
        return raw
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    /**
     * Token count display for dashboard UI.
     * Shared between Storybook helpers and optional runtime wiring.
     * @see ADR-005
     */
    const fullFmt = new Intl.NumberFormat("en-US");
    /** Full-format integers like live dashboard `fmt()` (no decimals). */
    function formatTokenCountFull(n) {
        return fullFmt.format(Math.round(n));
    }
    /**
     * Compact display for large counts:
     * - ≥ 10_000: ceil to whole k, no decimal (e.g. 41_200 → "42k")
     * - 1_000–9_999: one decimal, trim trailing ".0" (e.g. 6_900 → "6.9k", 6_000 → "6k")
     * - &lt; 1_000: full Intl integer
     */
    function formatTokenCountAbbreviated(n) {
        const x = Number(n);
        if (!Number.isFinite(x))
            return "—";
        const rounded = Math.round(x);
        if (rounded >= 10_000) {
            return `${Math.ceil(rounded / 1000)}k`;
        }
        if (rounded >= 1000) {
            const k = rounded / 1000;
            const oneDecimal = Math.round(k * 10) / 10;
            const s = oneDecimal % 1 === 0 ? String(oneDecimal) : oneDecimal.toFixed(1);
            return `${s}k`;
        }
        return fullFmt.format(rounded);
    }

    /**
     * Generic dashboard action button.
     * @see ADR-005
     */
    function dashboardButtonHtml(props) {
        const idAttr = props.id ? ` id="${escapeHtml(props.id)}"` : "";
        const cls = props.className?.trim()
            ? ` class="${escapeHtml(props.className.trim())}"`
            : "";
        const aria = props.ariaLabel != null && props.ariaLabel !== ""
            ? ` aria-label="${escapeHtml(props.ariaLabel)}"`
            : "";
        return `<button type="button"${idAttr}${cls}${aria}>${escapeHtml(props.label)}</button>`;
    }

    function eventRoleToTimelineClass(role) {
        if (role === "user_prompt")
            return "user";
        if (role === "assistant_message" ||
            role === "assistant_delta" ||
            role === "assistant")
            return "assistant";
        if (role.startsWith("tool_"))
            return "tool";
        if (role.startsWith("shell_"))
            return "shell";
        return "other";
    }

    /**
     * Build SVG polyline `points` for the efficiency sparkline (viewBox 200×48, pad 4).
     */
    function sparklinePolylinePoints(points) {
        if (!points || points.length === 0)
            return null;
        const w = 200;
        const h = 48;
        const pad = 4;
        const ys = points.map((p) => p.efficiencyScore);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys, 1);
        const coords = points.map((p, i) => {
            const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
            const y = h -
                pad -
                ((p.efficiencyScore - minY) / Math.max(1e-6, maxY - minY)) *
                    (h - pad * 2);
            return `${x},${y}`;
        });
        return coords.join(" ");
    }

    /**
     * Compose a trimmed `class` attribute value from a base name, optional extras, and grid span.
     */
    function normalizeAddedClasses(addedClasses) {
        if (typeof addedClasses === "string") {
            return addedClasses
                .split(/\s+/)
                .map((part) => part.trim())
                .filter(Boolean);
        }
        return addedClasses
            .map((part) => (typeof part === "string" ? part.trim() : ""))
            .filter(Boolean);
    }
    function classHelper(className = "", addedClasses = [], span) {
        const parts = [];
        const base = className.trim();
        if (base) {
            parts.push(base);
        }
        parts.push(...normalizeAddedClasses(addedClasses));
        if (typeof span === "number" &&
            Number.isFinite(span) &&
            span >= 2 &&
            Number.isInteger(span)) {
            parts.push(`span-${span}`);
        }
        return parts.join(" ").trim();
    }

    /**
     * Section chrome for dashboard panels.
     * @see ADR-005
     */
    function dashboardCardHtml(props) {
        const spanNum = props.span === "2" ? 2 : props.span === "3" ? 3 : undefined;
        const componentClass = classHelper("card", props.className?.trim() ?? "", spanNum);
        const heading = props.title != null && props.title !== ""
            ? `<h2>${escapeHtml(props.title)}</h2>\n`
            : "";
        const idAttr = props.id != null && props.id !== "" ? ` id="${escapeHtml(props.id)}"` : "";
        return `
<section${idAttr} class="${escapeHtml(componentClass)}">
  ${heading}${props.bodyHtml}
</section>
`.trim();
    }

    /**
     * Observable usage total + caption column.
     * Half-doughnut dial is opt-in (`showDialChart`); Chart.js attaches imperatively (`attachUsageDialChart`).
     * @see ADR-005
     */
    function usageTotalGaugeInnerHtml(props) {
        const idAttr = props.valueElementId != null && props.valueElementId.trim() !== ""
            ? ` id="${escapeHtml(props.valueElementId.trim())}"`
            : "";
        const captionInner = `<span class="muted gauge-value-label">${escapeHtml(props.caption)}</span>`;
        const valueInner = `<span class="gauge-value"${idAttr}>${escapeHtml(props.valueText)}</span>`;
        if (props.showDialChart !== true) {
            return `
<div class="gauge">
  ${valueInner}
  ${captionInner}
</div>
`.trim();
        }
        return `
<div class="gauge gauge--with-dial" data-gauge-dial-root>
  <div class="gauge-dial-slot">
    <div class="gauge-center-copy">
      ${captionInner}
      ${valueInner}
    </div>
    <canvas data-gauge-dial="1" role="presentation" aria-hidden="true"></canvas>
  </div>
</div>
`.trim();
    }

    /*!
     * @kurkle/color v0.3.4
     * https://github.com/kurkle/color#readme
     * (c) 2024 Jukka Kurkela
     * Released under the MIT License
     */
    function round(v) {
      return v + 0.5 | 0;
    }
    const lim = (v, l, h) => Math.max(Math.min(v, h), l);
    function p2b(v) {
      return lim(round(v * 2.55), 0, 255);
    }
    function n2b(v) {
      return lim(round(v * 255), 0, 255);
    }
    function b2n(v) {
      return lim(round(v / 2.55) / 100, 0, 1);
    }
    function n2p(v) {
      return lim(round(v * 100), 0, 100);
    }

    const map$1 = {0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, a: 10, b: 11, c: 12, d: 13, e: 14, f: 15};
    const hex = [...'0123456789ABCDEF'];
    const h1 = b => hex[b & 0xF];
    const h2 = b => hex[(b & 0xF0) >> 4] + hex[b & 0xF];
    const eq = b => ((b & 0xF0) >> 4) === (b & 0xF);
    const isShort = v => eq(v.r) && eq(v.g) && eq(v.b) && eq(v.a);
    function hexParse(str) {
      var len = str.length;
      var ret;
      if (str[0] === '#') {
        if (len === 4 || len === 5) {
          ret = {
            r: 255 & map$1[str[1]] * 17,
            g: 255 & map$1[str[2]] * 17,
            b: 255 & map$1[str[3]] * 17,
            a: len === 5 ? map$1[str[4]] * 17 : 255
          };
        } else if (len === 7 || len === 9) {
          ret = {
            r: map$1[str[1]] << 4 | map$1[str[2]],
            g: map$1[str[3]] << 4 | map$1[str[4]],
            b: map$1[str[5]] << 4 | map$1[str[6]],
            a: len === 9 ? (map$1[str[7]] << 4 | map$1[str[8]]) : 255
          };
        }
      }
      return ret;
    }
    const alpha = (a, f) => a < 255 ? f(a) : '';
    function hexString(v) {
      var f = isShort(v) ? h1 : h2;
      return v
        ? '#' + f(v.r) + f(v.g) + f(v.b) + alpha(v.a, f)
        : undefined;
    }

    const HUE_RE = /^(hsla?|hwb|hsv)\(\s*([-+.e\d]+)(?:deg)?[\s,]+([-+.e\d]+)%[\s,]+([-+.e\d]+)%(?:[\s,]+([-+.e\d]+)(%)?)?\s*\)$/;
    function hsl2rgbn(h, s, l) {
      const a = s * Math.min(l, 1 - l);
      const f = (n, k = (n + h / 30) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return [f(0), f(8), f(4)];
    }
    function hsv2rgbn(h, s, v) {
      const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
      return [f(5), f(3), f(1)];
    }
    function hwb2rgbn(h, w, b) {
      const rgb = hsl2rgbn(h, 1, 0.5);
      let i;
      if (w + b > 1) {
        i = 1 / (w + b);
        w *= i;
        b *= i;
      }
      for (i = 0; i < 3; i++) {
        rgb[i] *= 1 - w - b;
        rgb[i] += w;
      }
      return rgb;
    }
    function hueValue(r, g, b, d, max) {
      if (r === max) {
        return ((g - b) / d) + (g < b ? 6 : 0);
      }
      if (g === max) {
        return (b - r) / d + 2;
      }
      return (r - g) / d + 4;
    }
    function rgb2hsl(v) {
      const range = 255;
      const r = v.r / range;
      const g = v.g / range;
      const b = v.b / range;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      let h, s, d;
      if (max !== min) {
        d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        h = hueValue(r, g, b, d, max);
        h = h * 60 + 0.5;
      }
      return [h | 0, s || 0, l];
    }
    function calln(f, a, b, c) {
      return (
        Array.isArray(a)
          ? f(a[0], a[1], a[2])
          : f(a, b, c)
      ).map(n2b);
    }
    function hsl2rgb(h, s, l) {
      return calln(hsl2rgbn, h, s, l);
    }
    function hwb2rgb(h, w, b) {
      return calln(hwb2rgbn, h, w, b);
    }
    function hsv2rgb(h, s, v) {
      return calln(hsv2rgbn, h, s, v);
    }
    function hue(h) {
      return (h % 360 + 360) % 360;
    }
    function hueParse(str) {
      const m = HUE_RE.exec(str);
      let a = 255;
      let v;
      if (!m) {
        return;
      }
      if (m[5] !== v) {
        a = m[6] ? p2b(+m[5]) : n2b(+m[5]);
      }
      const h = hue(+m[2]);
      const p1 = +m[3] / 100;
      const p2 = +m[4] / 100;
      if (m[1] === 'hwb') {
        v = hwb2rgb(h, p1, p2);
      } else if (m[1] === 'hsv') {
        v = hsv2rgb(h, p1, p2);
      } else {
        v = hsl2rgb(h, p1, p2);
      }
      return {
        r: v[0],
        g: v[1],
        b: v[2],
        a: a
      };
    }
    function rotate(v, deg) {
      var h = rgb2hsl(v);
      h[0] = hue(h[0] + deg);
      h = hsl2rgb(h);
      v.r = h[0];
      v.g = h[1];
      v.b = h[2];
    }
    function hslString(v) {
      if (!v) {
        return;
      }
      const a = rgb2hsl(v);
      const h = a[0];
      const s = n2p(a[1]);
      const l = n2p(a[2]);
      return v.a < 255
        ? `hsla(${h}, ${s}%, ${l}%, ${b2n(v.a)})`
        : `hsl(${h}, ${s}%, ${l}%)`;
    }

    const map = {
    	x: 'dark',
    	Z: 'light',
    	Y: 're',
    	X: 'blu',
    	W: 'gr',
    	V: 'medium',
    	U: 'slate',
    	A: 'ee',
    	T: 'ol',
    	S: 'or',
    	B: 'ra',
    	C: 'lateg',
    	D: 'ights',
    	R: 'in',
    	Q: 'turquois',
    	E: 'hi',
    	P: 'ro',
    	O: 'al',
    	N: 'le',
    	M: 'de',
    	L: 'yello',
    	F: 'en',
    	K: 'ch',
    	G: 'arks',
    	H: 'ea',
    	I: 'ightg',
    	J: 'wh'
    };
    const names$1 = {
    	OiceXe: 'f0f8ff',
    	antiquewEte: 'faebd7',
    	aqua: 'ffff',
    	aquamarRe: '7fffd4',
    	azuY: 'f0ffff',
    	beige: 'f5f5dc',
    	bisque: 'ffe4c4',
    	black: '0',
    	blanKedOmond: 'ffebcd',
    	Xe: 'ff',
    	XeviTet: '8a2be2',
    	bPwn: 'a52a2a',
    	burlywood: 'deb887',
    	caMtXe: '5f9ea0',
    	KartYuse: '7fff00',
    	KocTate: 'd2691e',
    	cSO: 'ff7f50',
    	cSnflowerXe: '6495ed',
    	cSnsilk: 'fff8dc',
    	crimson: 'dc143c',
    	cyan: 'ffff',
    	xXe: '8b',
    	xcyan: '8b8b',
    	xgTMnPd: 'b8860b',
    	xWay: 'a9a9a9',
    	xgYF: '6400',
    	xgYy: 'a9a9a9',
    	xkhaki: 'bdb76b',
    	xmagFta: '8b008b',
    	xTivegYF: '556b2f',
    	xSange: 'ff8c00',
    	xScEd: '9932cc',
    	xYd: '8b0000',
    	xsOmon: 'e9967a',
    	xsHgYF: '8fbc8f',
    	xUXe: '483d8b',
    	xUWay: '2f4f4f',
    	xUgYy: '2f4f4f',
    	xQe: 'ced1',
    	xviTet: '9400d3',
    	dAppRk: 'ff1493',
    	dApskyXe: 'bfff',
    	dimWay: '696969',
    	dimgYy: '696969',
    	dodgerXe: '1e90ff',
    	fiYbrick: 'b22222',
    	flSOwEte: 'fffaf0',
    	foYstWAn: '228b22',
    	fuKsia: 'ff00ff',
    	gaRsbSo: 'dcdcdc',
    	ghostwEte: 'f8f8ff',
    	gTd: 'ffd700',
    	gTMnPd: 'daa520',
    	Way: '808080',
    	gYF: '8000',
    	gYFLw: 'adff2f',
    	gYy: '808080',
    	honeyMw: 'f0fff0',
    	hotpRk: 'ff69b4',
    	RdianYd: 'cd5c5c',
    	Rdigo: '4b0082',
    	ivSy: 'fffff0',
    	khaki: 'f0e68c',
    	lavFMr: 'e6e6fa',
    	lavFMrXsh: 'fff0f5',
    	lawngYF: '7cfc00',
    	NmoncEffon: 'fffacd',
    	ZXe: 'add8e6',
    	ZcSO: 'f08080',
    	Zcyan: 'e0ffff',
    	ZgTMnPdLw: 'fafad2',
    	ZWay: 'd3d3d3',
    	ZgYF: '90ee90',
    	ZgYy: 'd3d3d3',
    	ZpRk: 'ffb6c1',
    	ZsOmon: 'ffa07a',
    	ZsHgYF: '20b2aa',
    	ZskyXe: '87cefa',
    	ZUWay: '778899',
    	ZUgYy: '778899',
    	ZstAlXe: 'b0c4de',
    	ZLw: 'ffffe0',
    	lime: 'ff00',
    	limegYF: '32cd32',
    	lRF: 'faf0e6',
    	magFta: 'ff00ff',
    	maPon: '800000',
    	VaquamarRe: '66cdaa',
    	VXe: 'cd',
    	VScEd: 'ba55d3',
    	VpurpN: '9370db',
    	VsHgYF: '3cb371',
    	VUXe: '7b68ee',
    	VsprRggYF: 'fa9a',
    	VQe: '48d1cc',
    	VviTetYd: 'c71585',
    	midnightXe: '191970',
    	mRtcYam: 'f5fffa',
    	mistyPse: 'ffe4e1',
    	moccasR: 'ffe4b5',
    	navajowEte: 'ffdead',
    	navy: '80',
    	Tdlace: 'fdf5e6',
    	Tive: '808000',
    	TivedBb: '6b8e23',
    	Sange: 'ffa500',
    	SangeYd: 'ff4500',
    	ScEd: 'da70d6',
    	pOegTMnPd: 'eee8aa',
    	pOegYF: '98fb98',
    	pOeQe: 'afeeee',
    	pOeviTetYd: 'db7093',
    	papayawEp: 'ffefd5',
    	pHKpuff: 'ffdab9',
    	peru: 'cd853f',
    	pRk: 'ffc0cb',
    	plum: 'dda0dd',
    	powMrXe: 'b0e0e6',
    	purpN: '800080',
    	YbeccapurpN: '663399',
    	Yd: 'ff0000',
    	Psybrown: 'bc8f8f',
    	PyOXe: '4169e1',
    	saddNbPwn: '8b4513',
    	sOmon: 'fa8072',
    	sandybPwn: 'f4a460',
    	sHgYF: '2e8b57',
    	sHshell: 'fff5ee',
    	siFna: 'a0522d',
    	silver: 'c0c0c0',
    	skyXe: '87ceeb',
    	UXe: '6a5acd',
    	UWay: '708090',
    	UgYy: '708090',
    	snow: 'fffafa',
    	sprRggYF: 'ff7f',
    	stAlXe: '4682b4',
    	tan: 'd2b48c',
    	teO: '8080',
    	tEstN: 'd8bfd8',
    	tomato: 'ff6347',
    	Qe: '40e0d0',
    	viTet: 'ee82ee',
    	JHt: 'f5deb3',
    	wEte: 'ffffff',
    	wEtesmoke: 'f5f5f5',
    	Lw: 'ffff00',
    	LwgYF: '9acd32'
    };
    function unpack() {
      const unpacked = {};
      const keys = Object.keys(names$1);
      const tkeys = Object.keys(map);
      let i, j, k, ok, nk;
      for (i = 0; i < keys.length; i++) {
        ok = nk = keys[i];
        for (j = 0; j < tkeys.length; j++) {
          k = tkeys[j];
          nk = nk.replace(k, map[k]);
        }
        k = parseInt(names$1[ok], 16);
        unpacked[nk] = [k >> 16 & 0xFF, k >> 8 & 0xFF, k & 0xFF];
      }
      return unpacked;
    }

    let names;
    function nameParse(str) {
      if (!names) {
        names = unpack();
        names.transparent = [0, 0, 0, 0];
      }
      const a = names[str.toLowerCase()];
      return a && {
        r: a[0],
        g: a[1],
        b: a[2],
        a: a.length === 4 ? a[3] : 255
      };
    }

    const RGB_RE = /^rgba?\(\s*([-+.\d]+)(%)?[\s,]+([-+.e\d]+)(%)?[\s,]+([-+.e\d]+)(%)?(?:[\s,/]+([-+.e\d]+)(%)?)?\s*\)$/;
    function rgbParse(str) {
      const m = RGB_RE.exec(str);
      let a = 255;
      let r, g, b;
      if (!m) {
        return;
      }
      if (m[7] !== r) {
        const v = +m[7];
        a = m[8] ? p2b(v) : lim(v * 255, 0, 255);
      }
      r = +m[1];
      g = +m[3];
      b = +m[5];
      r = 255 & (m[2] ? p2b(r) : lim(r, 0, 255));
      g = 255 & (m[4] ? p2b(g) : lim(g, 0, 255));
      b = 255 & (m[6] ? p2b(b) : lim(b, 0, 255));
      return {
        r: r,
        g: g,
        b: b,
        a: a
      };
    }
    function rgbString(v) {
      return v && (
        v.a < 255
          ? `rgba(${v.r}, ${v.g}, ${v.b}, ${b2n(v.a)})`
          : `rgb(${v.r}, ${v.g}, ${v.b})`
      );
    }

    const to = v => v <= 0.0031308 ? v * 12.92 : Math.pow(v, 1.0 / 2.4) * 1.055 - 0.055;
    const from = v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    function interpolate$1(rgb1, rgb2, t) {
      const r = from(b2n(rgb1.r));
      const g = from(b2n(rgb1.g));
      const b = from(b2n(rgb1.b));
      return {
        r: n2b(to(r + t * (from(b2n(rgb2.r)) - r))),
        g: n2b(to(g + t * (from(b2n(rgb2.g)) - g))),
        b: n2b(to(b + t * (from(b2n(rgb2.b)) - b))),
        a: rgb1.a + t * (rgb2.a - rgb1.a)
      };
    }

    function modHSL(v, i, ratio) {
      if (v) {
        let tmp = rgb2hsl(v);
        tmp[i] = Math.max(0, Math.min(tmp[i] + tmp[i] * ratio, i === 0 ? 360 : 1));
        tmp = hsl2rgb(tmp);
        v.r = tmp[0];
        v.g = tmp[1];
        v.b = tmp[2];
      }
    }
    function clone$1(v, proto) {
      return v ? Object.assign(proto || {}, v) : v;
    }
    function fromObject(input) {
      var v = {r: 0, g: 0, b: 0, a: 255};
      if (Array.isArray(input)) {
        if (input.length >= 3) {
          v = {r: input[0], g: input[1], b: input[2], a: 255};
          if (input.length > 3) {
            v.a = n2b(input[3]);
          }
        }
      } else {
        v = clone$1(input, {r: 0, g: 0, b: 0, a: 1});
        v.a = n2b(v.a);
      }
      return v;
    }
    function functionParse(str) {
      if (str.charAt(0) === 'r') {
        return rgbParse(str);
      }
      return hueParse(str);
    }
    class Color {
      constructor(input) {
        if (input instanceof Color) {
          return input;
        }
        const type = typeof input;
        let v;
        if (type === 'object') {
          v = fromObject(input);
        } else if (type === 'string') {
          v = hexParse(input) || nameParse(input) || functionParse(input);
        }
        this._rgb = v;
        this._valid = !!v;
      }
      get valid() {
        return this._valid;
      }
      get rgb() {
        var v = clone$1(this._rgb);
        if (v) {
          v.a = b2n(v.a);
        }
        return v;
      }
      set rgb(obj) {
        this._rgb = fromObject(obj);
      }
      rgbString() {
        return this._valid ? rgbString(this._rgb) : undefined;
      }
      hexString() {
        return this._valid ? hexString(this._rgb) : undefined;
      }
      hslString() {
        return this._valid ? hslString(this._rgb) : undefined;
      }
      mix(color, weight) {
        if (color) {
          const c1 = this.rgb;
          const c2 = color.rgb;
          let w2;
          const p = weight === w2 ? 0.5 : weight;
          const w = 2 * p - 1;
          const a = c1.a - c2.a;
          const w1 = ((w * a === -1 ? w : (w + a) / (1 + w * a)) + 1) / 2.0;
          w2 = 1 - w1;
          c1.r = 0xFF & w1 * c1.r + w2 * c2.r + 0.5;
          c1.g = 0xFF & w1 * c1.g + w2 * c2.g + 0.5;
          c1.b = 0xFF & w1 * c1.b + w2 * c2.b + 0.5;
          c1.a = p * c1.a + (1 - p) * c2.a;
          this.rgb = c1;
        }
        return this;
      }
      interpolate(color, t) {
        if (color) {
          this._rgb = interpolate$1(this._rgb, color._rgb, t);
        }
        return this;
      }
      clone() {
        return new Color(this.rgb);
      }
      alpha(a) {
        this._rgb.a = n2b(a);
        return this;
      }
      clearer(ratio) {
        const rgb = this._rgb;
        rgb.a *= 1 - ratio;
        return this;
      }
      greyscale() {
        const rgb = this._rgb;
        const val = round(rgb.r * 0.3 + rgb.g * 0.59 + rgb.b * 0.11);
        rgb.r = rgb.g = rgb.b = val;
        return this;
      }
      opaquer(ratio) {
        const rgb = this._rgb;
        rgb.a *= 1 + ratio;
        return this;
      }
      negate() {
        const v = this._rgb;
        v.r = 255 - v.r;
        v.g = 255 - v.g;
        v.b = 255 - v.b;
        return this;
      }
      lighten(ratio) {
        modHSL(this._rgb, 2, ratio);
        return this;
      }
      darken(ratio) {
        modHSL(this._rgb, 2, -ratio);
        return this;
      }
      saturate(ratio) {
        modHSL(this._rgb, 1, ratio);
        return this;
      }
      desaturate(ratio) {
        modHSL(this._rgb, 1, -ratio);
        return this;
      }
      rotate(deg) {
        rotate(this._rgb, deg);
        return this;
      }
    }

    /*!
     * Chart.js v4.5.1
     * https://www.chartjs.org
     * (c) 2025 Chart.js Contributors
     * Released under the MIT License
     */

    /**
     * @namespace Chart.helpers
     */ /**
     * An empty function that can be used, for example, for optional callback.
     */ function noop() {
    /* noop */ }
    /**
     * Returns a unique id, sequentially generated from a global variable.
     */ const uid = (()=>{
        let id = 0;
        return ()=>id++;
    })();
    /**
     * Returns true if `value` is neither null nor undefined, else returns false.
     * @param value - The value to test.
     * @since 2.7.0
     */ function isNullOrUndef(value) {
        return value === null || value === undefined;
    }
    /**
     * Returns true if `value` is an array (including typed arrays), else returns false.
     * @param value - The value to test.
     * @function
     */ function isArray(value) {
        if (Array.isArray && Array.isArray(value)) {
            return true;
        }
        const type = Object.prototype.toString.call(value);
        if (type.slice(0, 7) === '[object' && type.slice(-6) === 'Array]') {
            return true;
        }
        return false;
    }
    /**
     * Returns true if `value` is an object (excluding null), else returns false.
     * @param value - The value to test.
     * @since 2.7.0
     */ function isObject(value) {
        return value !== null && Object.prototype.toString.call(value) === '[object Object]';
    }
    /**
     * Returns true if `value` is a finite number, else returns false
     * @param value  - The value to test.
     */ function isNumberFinite(value) {
        return (typeof value === 'number' || value instanceof Number) && isFinite(+value);
    }
    /**
     * Returns `value` if finite, else returns `defaultValue`.
     * @param value - The value to return if defined.
     * @param defaultValue - The value to return if `value` is not finite.
     */ function finiteOrDefault(value, defaultValue) {
        return isNumberFinite(value) ? value : defaultValue;
    }
    /**
     * Returns `value` if defined, else returns `defaultValue`.
     * @param value - The value to return if defined.
     * @param defaultValue - The value to return if `value` is undefined.
     */ function valueOrDefault(value, defaultValue) {
        return typeof value === 'undefined' ? defaultValue : value;
    }
    const toPercentage = (value, dimension)=>typeof value === 'string' && value.endsWith('%') ? parseFloat(value) / 100 : +value / dimension;
    const toDimension = (value, dimension)=>typeof value === 'string' && value.endsWith('%') ? parseFloat(value) / 100 * dimension : +value;
    /**
     * Calls `fn` with the given `args` in the scope defined by `thisArg` and returns the
     * value returned by `fn`. If `fn` is not a function, this method returns undefined.
     * @param fn - The function to call.
     * @param args - The arguments with which `fn` should be called.
     * @param [thisArg] - The value of `this` provided for the call to `fn`.
     */ function callback(fn, args, thisArg) {
        if (fn && typeof fn.call === 'function') {
            return fn.apply(thisArg, args);
        }
    }
    function each(loopable, fn, thisArg, reverse) {
        let i, len, keys;
        if (isArray(loopable)) {
            len = loopable.length;
            {
                for(i = 0; i < len; i++){
                    fn.call(thisArg, loopable[i], i);
                }
            }
        } else if (isObject(loopable)) {
            keys = Object.keys(loopable);
            len = keys.length;
            for(i = 0; i < len; i++){
                fn.call(thisArg, loopable[keys[i]], keys[i]);
            }
        }
    }
    /**
     * Returns true if the `a0` and `a1` arrays have the same content, else returns false.
     * @param a0 - The array to compare
     * @param a1 - The array to compare
     * @private
     */ function _elementsEqual(a0, a1) {
        let i, ilen, v0, v1;
        if (!a0 || !a1 || a0.length !== a1.length) {
            return false;
        }
        for(i = 0, ilen = a0.length; i < ilen; ++i){
            v0 = a0[i];
            v1 = a1[i];
            if (v0.datasetIndex !== v1.datasetIndex || v0.index !== v1.index) {
                return false;
            }
        }
        return true;
    }
    /**
     * Returns a deep copy of `source` without keeping references on objects and arrays.
     * @param source - The value to clone.
     */ function clone(source) {
        if (isArray(source)) {
            return source.map(clone);
        }
        if (isObject(source)) {
            const target = Object.create(null);
            const keys = Object.keys(source);
            const klen = keys.length;
            let k = 0;
            for(; k < klen; ++k){
                target[keys[k]] = clone(source[keys[k]]);
            }
            return target;
        }
        return source;
    }
    function isValidKey(key) {
        return [
            '__proto__',
            'prototype',
            'constructor'
        ].indexOf(key) === -1;
    }
    /**
     * The default merger when Chart.helpers.merge is called without merger option.
     * Note(SB): also used by mergeConfig and mergeScaleConfig as fallback.
     * @private
     */ function _merger(key, target, source, options) {
        if (!isValidKey(key)) {
            return;
        }
        const tval = target[key];
        const sval = source[key];
        if (isObject(tval) && isObject(sval)) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            merge(tval, sval, options);
        } else {
            target[key] = clone(sval);
        }
    }
    function merge(target, source, options) {
        const sources = isArray(source) ? source : [
            source
        ];
        const ilen = sources.length;
        if (!isObject(target)) {
            return target;
        }
        options = options || {};
        const merger = options.merger || _merger;
        let current;
        for(let i = 0; i < ilen; ++i){
            current = sources[i];
            if (!isObject(current)) {
                continue;
            }
            const keys = Object.keys(current);
            for(let k = 0, klen = keys.length; k < klen; ++k){
                merger(keys[k], target, current, options);
            }
        }
        return target;
    }
    function mergeIf(target, source) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return merge(target, source, {
            merger: _mergerIf
        });
    }
    /**
     * Merges source[key] in target[key] only if target[key] is undefined.
     * @private
     */ function _mergerIf(key, target, source) {
        if (!isValidKey(key)) {
            return;
        }
        const tval = target[key];
        const sval = source[key];
        if (isObject(tval) && isObject(sval)) {
            mergeIf(tval, sval);
        } else if (!Object.prototype.hasOwnProperty.call(target, key)) {
            target[key] = clone(sval);
        }
    }
    // resolveObjectKey resolver cache
    const keyResolvers = {
        // Chart.helpers.core resolveObjectKey should resolve empty key to root object
        '': (v)=>v,
        // default resolvers
        x: (o)=>o.x,
        y: (o)=>o.y
    };
    /**
     * @private
     */ function _splitKey(key) {
        const parts = key.split('.');
        const keys = [];
        let tmp = '';
        for (const part of parts){
            tmp += part;
            if (tmp.endsWith('\\')) {
                tmp = tmp.slice(0, -1) + '.';
            } else {
                keys.push(tmp);
                tmp = '';
            }
        }
        return keys;
    }
    function _getKeyResolver(key) {
        const keys = _splitKey(key);
        return (obj)=>{
            for (const k of keys){
                if (k === '') {
                    break;
                }
                obj = obj && obj[k];
            }
            return obj;
        };
    }
    function resolveObjectKey(obj, key) {
        const resolver = keyResolvers[key] || (keyResolvers[key] = _getKeyResolver(key));
        return resolver(obj);
    }
    /**
     * @private
     */ function _capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    const defined = (value)=>typeof value !== 'undefined';
    const isFunction = (value)=>typeof value === 'function';
    // Adapted from https://stackoverflow.com/questions/31128855/comparing-ecma6-sets-for-equality#31129384
    const setsEqual = (a, b)=>{
        if (a.size !== b.size) {
            return false;
        }
        for (const item of a){
            if (!b.has(item)) {
                return false;
            }
        }
        return true;
    };
    /**
     * @param e - The event
     * @private
     */ function _isClickEvent(e) {
        return e.type === 'mouseup' || e.type === 'click' || e.type === 'contextmenu';
    }

    /**
     * @alias Chart.helpers.math
     * @namespace
     */ const PI = Math.PI;
    const TAU = 2 * PI;
    const INFINITY = Number.POSITIVE_INFINITY;
    const RAD_PER_DEG = PI / 180;
    const HALF_PI = PI / 2;
    const QUARTER_PI = PI / 4;
    const TWO_THIRDS_PI = PI * 2 / 3;
    const sign = Math.sign;
    /**
     * Returns an array of factors sorted from 1 to sqrt(value)
     * @private
     */ function _factorize(value) {
        const result = [];
        const sqrt = Math.sqrt(value);
        let i;
        for(i = 1; i < sqrt; i++){
            if (value % i === 0) {
                result.push(i);
                result.push(value / i);
            }
        }
        if (sqrt === (sqrt | 0)) {
            result.push(sqrt);
        }
        result.sort((a, b)=>a - b).pop();
        return result;
    }
    /**
     * Verifies that attempting to coerce n to string or number won't throw a TypeError.
     */ function isNonPrimitive(n) {
        return typeof n === 'symbol' || typeof n === 'object' && n !== null && !(Symbol.toPrimitive in n || 'toString' in n || 'valueOf' in n);
    }
    function isNumber(n) {
        return !isNonPrimitive(n) && !isNaN(parseFloat(n)) && isFinite(n);
    }
    function toRadians(degrees) {
        return degrees * (PI / 180);
    }
    function toDegrees(radians) {
        return radians * (180 / PI);
    }
    // Gets the angle from vertical upright to the point about a centre.
    function getAngleFromPoint(centrePoint, anglePoint) {
        const distanceFromXCenter = anglePoint.x - centrePoint.x;
        const distanceFromYCenter = anglePoint.y - centrePoint.y;
        const radialDistanceFromCenter = Math.sqrt(distanceFromXCenter * distanceFromXCenter + distanceFromYCenter * distanceFromYCenter);
        let angle = Math.atan2(distanceFromYCenter, distanceFromXCenter);
        if (angle < -0.5 * PI) {
            angle += TAU; // make sure the returned angle is in the range of (-PI/2, 3PI/2]
        }
        return {
            angle,
            distance: radialDistanceFromCenter
        };
    }
    function distanceBetweenPoints(pt1, pt2) {
        return Math.sqrt(Math.pow(pt2.x - pt1.x, 2) + Math.pow(pt2.y - pt1.y, 2));
    }
    /**
     * Normalize angle to be between 0 and 2*PI
     * @private
     */ function _normalizeAngle(a) {
        return (a % TAU + TAU) % TAU;
    }
    /**
     * @private
     */ function _angleBetween(angle, start, end, sameAngleIsFullCircle) {
        const a = _normalizeAngle(angle);
        const s = _normalizeAngle(start);
        const e = _normalizeAngle(end);
        const angleToStart = _normalizeAngle(s - a);
        const angleToEnd = _normalizeAngle(e - a);
        const startToAngle = _normalizeAngle(a - s);
        const endToAngle = _normalizeAngle(a - e);
        return a === s || a === e || sameAngleIsFullCircle && s === e || angleToStart > angleToEnd && startToAngle < endToAngle;
    }
    /**
     * Limit `value` between `min` and `max`
     * @param value
     * @param min
     * @param max
     * @private
     */ function _limitValue(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
    /**
     * @param {number} value
     * @private
     */ function _int16Range(value) {
        return _limitValue(value, -32768, 32767);
    }
    /**
     * @param value
     * @param start
     * @param end
     * @param [epsilon]
     * @private
     */ function _isBetween(value, start, end, epsilon = 1e-6) {
        return value >= Math.min(start, end) - epsilon && value <= Math.max(start, end) + epsilon;
    }

    function _lookup(table, value, cmp) {
        cmp = cmp || ((index)=>table[index] < value);
        let hi = table.length - 1;
        let lo = 0;
        let mid;
        while(hi - lo > 1){
            mid = lo + hi >> 1;
            if (cmp(mid)) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        return {
            lo,
            hi
        };
    }
    /**
     * Binary search
     * @param table - the table search. must be sorted!
     * @param key - property name for the value in each entry
     * @param value - value to find
     * @param last - lookup last index
     * @private
     */ const _lookupByKey = (table, key, value, last)=>_lookup(table, value, last ? (index)=>{
            const ti = table[index][key];
            return ti < value || ti === value && table[index + 1][key] === value;
        } : (index)=>table[index][key] < value);
    /**
     * Reverse binary search
     * @param table - the table search. must be sorted!
     * @param key - property name for the value in each entry
     * @param value - value to find
     * @private
     */ const _rlookupByKey = (table, key, value)=>_lookup(table, value, (index)=>table[index][key] >= value);
    /**
     * Return subset of `values` between `min` and `max` inclusive.
     * Values are assumed to be in sorted order.
     * @param values - sorted array of values
     * @param min - min value
     * @param max - max value
     */ function _filterBetween(values, min, max) {
        let start = 0;
        let end = values.length;
        while(start < end && values[start] < min){
            start++;
        }
        while(end > start && values[end - 1] > max){
            end--;
        }
        return start > 0 || end < values.length ? values.slice(start, end) : values;
    }
    const arrayEvents = [
        'push',
        'pop',
        'shift',
        'splice',
        'unshift'
    ];
    function listenArrayEvents(array, listener) {
        if (array._chartjs) {
            array._chartjs.listeners.push(listener);
            return;
        }
        Object.defineProperty(array, '_chartjs', {
            configurable: true,
            enumerable: false,
            value: {
                listeners: [
                    listener
                ]
            }
        });
        arrayEvents.forEach((key)=>{
            const method = '_onData' + _capitalize(key);
            const base = array[key];
            Object.defineProperty(array, key, {
                configurable: true,
                enumerable: false,
                value (...args) {
                    const res = base.apply(this, args);
                    array._chartjs.listeners.forEach((object)=>{
                        if (typeof object[method] === 'function') {
                            object[method](...args);
                        }
                    });
                    return res;
                }
            });
        });
    }
    function unlistenArrayEvents(array, listener) {
        const stub = array._chartjs;
        if (!stub) {
            return;
        }
        const listeners = stub.listeners;
        const index = listeners.indexOf(listener);
        if (index !== -1) {
            listeners.splice(index, 1);
        }
        if (listeners.length > 0) {
            return;
        }
        arrayEvents.forEach((key)=>{
            delete array[key];
        });
        delete array._chartjs;
    }
    /**
     * @param items
     */ function _arrayUnique(items) {
        const set = new Set(items);
        if (set.size === items.length) {
            return items;
        }
        return Array.from(set);
    }
    /**
    * Request animation polyfill
    */ const requestAnimFrame = function() {
        if (typeof window === 'undefined') {
            return function(callback) {
                return callback();
            };
        }
        return window.requestAnimationFrame;
    }();
    /**
     * Throttles calling `fn` once per animation frame
     * Latest arguments are used on the actual call
     */ function throttled(fn, thisArg) {
        let argsToUse = [];
        let ticking = false;
        return function(...args) {
            // Save the args for use later
            argsToUse = args;
            if (!ticking) {
                ticking = true;
                requestAnimFrame.call(window, ()=>{
                    ticking = false;
                    fn.apply(thisArg, argsToUse);
                });
            }
        };
    }
    /**
     * Debounces calling `fn` for `delay` ms
     */ function debounce(fn, delay) {
        let timeout;
        return function(...args) {
            if (delay) {
                clearTimeout(timeout);
                timeout = setTimeout(fn, delay, args);
            } else {
                fn.apply(this, args);
            }
            return delay;
        };
    }
    /**
     * Converts 'start' to 'left', 'end' to 'right' and others to 'center'
     * @private
     */ const _toLeftRightCenter = (align)=>align === 'start' ? 'left' : align === 'end' ? 'right' : 'center';
    /**
     * Returns `start`, `end` or `(start + end) / 2` depending on `align`. Defaults to `center`
     * @private
     */ const _alignStartEnd = (align, start, end)=>align === 'start' ? start : align === 'end' ? end : (start + end) / 2;

    const atEdge = (t)=>t === 0 || t === 1;
    const elasticIn = (t, s, p)=>-(Math.pow(2, 10 * (t -= 1)) * Math.sin((t - s) * TAU / p));
    const elasticOut = (t, s, p)=>Math.pow(2, -10 * t) * Math.sin((t - s) * TAU / p) + 1;
    /**
     * Easing functions adapted from Robert Penner's easing equations.
     * @namespace Chart.helpers.easing.effects
     * @see http://www.robertpenner.com/easing/
     */ const effects = {
        linear: (t)=>t,
        easeInQuad: (t)=>t * t,
        easeOutQuad: (t)=>-t * (t - 2),
        easeInOutQuad: (t)=>(t /= 0.5) < 1 ? 0.5 * t * t : -0.5 * (--t * (t - 2) - 1),
        easeInCubic: (t)=>t * t * t,
        easeOutCubic: (t)=>(t -= 1) * t * t + 1,
        easeInOutCubic: (t)=>(t /= 0.5) < 1 ? 0.5 * t * t * t : 0.5 * ((t -= 2) * t * t + 2),
        easeInQuart: (t)=>t * t * t * t,
        easeOutQuart: (t)=>-((t -= 1) * t * t * t - 1),
        easeInOutQuart: (t)=>(t /= 0.5) < 1 ? 0.5 * t * t * t * t : -0.5 * ((t -= 2) * t * t * t - 2),
        easeInQuint: (t)=>t * t * t * t * t,
        easeOutQuint: (t)=>(t -= 1) * t * t * t * t + 1,
        easeInOutQuint: (t)=>(t /= 0.5) < 1 ? 0.5 * t * t * t * t * t : 0.5 * ((t -= 2) * t * t * t * t + 2),
        easeInSine: (t)=>-Math.cos(t * HALF_PI) + 1,
        easeOutSine: (t)=>Math.sin(t * HALF_PI),
        easeInOutSine: (t)=>-0.5 * (Math.cos(PI * t) - 1),
        easeInExpo: (t)=>t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
        easeOutExpo: (t)=>t === 1 ? 1 : -Math.pow(2, -10 * t) + 1,
        easeInOutExpo: (t)=>atEdge(t) ? t : t < 0.5 ? 0.5 * Math.pow(2, 10 * (t * 2 - 1)) : 0.5 * (-Math.pow(2, -10 * (t * 2 - 1)) + 2),
        easeInCirc: (t)=>t >= 1 ? t : -(Math.sqrt(1 - t * t) - 1),
        easeOutCirc: (t)=>Math.sqrt(1 - (t -= 1) * t),
        easeInOutCirc: (t)=>(t /= 0.5) < 1 ? -0.5 * (Math.sqrt(1 - t * t) - 1) : 0.5 * (Math.sqrt(1 - (t -= 2) * t) + 1),
        easeInElastic: (t)=>atEdge(t) ? t : elasticIn(t, 0.075, 0.3),
        easeOutElastic: (t)=>atEdge(t) ? t : elasticOut(t, 0.075, 0.3),
        easeInOutElastic (t) {
            const s = 0.1125;
            const p = 0.45;
            return atEdge(t) ? t : t < 0.5 ? 0.5 * elasticIn(t * 2, s, p) : 0.5 + 0.5 * elasticOut(t * 2 - 1, s, p);
        },
        easeInBack (t) {
            const s = 1.70158;
            return t * t * ((s + 1) * t - s);
        },
        easeOutBack (t) {
            const s = 1.70158;
            return (t -= 1) * t * ((s + 1) * t + s) + 1;
        },
        easeInOutBack (t) {
            let s = 1.70158;
            if ((t /= 0.5) < 1) {
                return 0.5 * (t * t * (((s *= 1.525) + 1) * t - s));
            }
            return 0.5 * ((t -= 2) * t * (((s *= 1.525) + 1) * t + s) + 2);
        },
        easeInBounce: (t)=>1 - effects.easeOutBounce(1 - t),
        easeOutBounce (t) {
            const m = 7.5625;
            const d = 2.75;
            if (t < 1 / d) {
                return m * t * t;
            }
            if (t < 2 / d) {
                return m * (t -= 1.5 / d) * t + 0.75;
            }
            if (t < 2.5 / d) {
                return m * (t -= 2.25 / d) * t + 0.9375;
            }
            return m * (t -= 2.625 / d) * t + 0.984375;
        },
        easeInOutBounce: (t)=>t < 0.5 ? effects.easeInBounce(t * 2) * 0.5 : effects.easeOutBounce(t * 2 - 1) * 0.5 + 0.5
    };

    function isPatternOrGradient(value) {
        if (value && typeof value === 'object') {
            const type = value.toString();
            return type === '[object CanvasPattern]' || type === '[object CanvasGradient]';
        }
        return false;
    }
    function color(value) {
        return isPatternOrGradient(value) ? value : new Color(value);
    }
    function getHoverColor(value) {
        return isPatternOrGradient(value) ? value : new Color(value).saturate(0.5).darken(0.1).hexString();
    }

    const numbers = [
        'x',
        'y',
        'borderWidth',
        'radius',
        'tension'
    ];
    const colors = [
        'color',
        'borderColor',
        'backgroundColor'
    ];
    function applyAnimationsDefaults(defaults) {
        defaults.set('animation', {
            delay: undefined,
            duration: 1000,
            easing: 'easeOutQuart',
            fn: undefined,
            from: undefined,
            loop: undefined,
            to: undefined,
            type: undefined
        });
        defaults.describe('animation', {
            _fallback: false,
            _indexable: false,
            _scriptable: (name)=>name !== 'onProgress' && name !== 'onComplete' && name !== 'fn'
        });
        defaults.set('animations', {
            colors: {
                type: 'color',
                properties: colors
            },
            numbers: {
                type: 'number',
                properties: numbers
            }
        });
        defaults.describe('animations', {
            _fallback: 'animation'
        });
        defaults.set('transitions', {
            active: {
                animation: {
                    duration: 400
                }
            },
            resize: {
                animation: {
                    duration: 0
                }
            },
            show: {
                animations: {
                    colors: {
                        from: 'transparent'
                    },
                    visible: {
                        type: 'boolean',
                        duration: 0
                    }
                }
            },
            hide: {
                animations: {
                    colors: {
                        to: 'transparent'
                    },
                    visible: {
                        type: 'boolean',
                        easing: 'linear',
                        fn: (v)=>v | 0
                    }
                }
            }
        });
    }

    function applyLayoutsDefaults(defaults) {
        defaults.set('layout', {
            autoPadding: true,
            padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0
            }
        });
    }

    const intlCache = new Map();
    function getNumberFormat(locale, options) {
        options = options || {};
        const cacheKey = locale + JSON.stringify(options);
        let formatter = intlCache.get(cacheKey);
        if (!formatter) {
            formatter = new Intl.NumberFormat(locale, options);
            intlCache.set(cacheKey, formatter);
        }
        return formatter;
    }
    function formatNumber(num, locale, options) {
        return getNumberFormat(locale, options).format(num);
    }

    const formatters = {
     values (value) {
            return isArray(value) ?  value : '' + value;
        }};
     var Ticks = {
        formatters
    };

    function applyScaleDefaults(defaults) {
        defaults.set('scale', {
            display: true,
            offset: false,
            reverse: false,
            beginAtZero: false,
     bounds: 'ticks',
            clip: true,
     grace: 0,
            grid: {
                display: true,
                lineWidth: 1,
                drawOnChartArea: true,
                drawTicks: true,
                tickLength: 8,
                tickWidth: (_ctx, options)=>options.lineWidth,
                tickColor: (_ctx, options)=>options.color,
                offset: false
            },
            border: {
                display: true,
                dash: [],
                dashOffset: 0.0,
                width: 1
            },
            title: {
                display: false,
                text: '',
                padding: {
                    top: 4,
                    bottom: 4
                }
            },
            ticks: {
                minRotation: 0,
                maxRotation: 50,
                mirror: false,
                textStrokeWidth: 0,
                textStrokeColor: '',
                padding: 3,
                display: true,
                autoSkip: true,
                autoSkipPadding: 3,
                labelOffset: 0,
                callback: Ticks.formatters.values,
                minor: {},
                major: {},
                align: 'center',
                crossAlign: 'near',
                showLabelBackdrop: false,
                backdropColor: 'rgba(255, 255, 255, 0.75)',
                backdropPadding: 2
            }
        });
        defaults.route('scale.ticks', 'color', '', 'color');
        defaults.route('scale.grid', 'color', '', 'borderColor');
        defaults.route('scale.border', 'color', '', 'borderColor');
        defaults.route('scale.title', 'color', '', 'color');
        defaults.describe('scale', {
            _fallback: false,
            _scriptable: (name)=>!name.startsWith('before') && !name.startsWith('after') && name !== 'callback' && name !== 'parser',
            _indexable: (name)=>name !== 'borderDash' && name !== 'tickBorderDash' && name !== 'dash'
        });
        defaults.describe('scales', {
            _fallback: 'scale'
        });
        defaults.describe('scale.ticks', {
            _scriptable: (name)=>name !== 'backdropPadding' && name !== 'callback',
            _indexable: (name)=>name !== 'backdropPadding'
        });
    }

    const overrides = Object.create(null);
    const descriptors = Object.create(null);
     function getScope$1(node, key) {
        if (!key) {
            return node;
        }
        const keys = key.split('.');
        for(let i = 0, n = keys.length; i < n; ++i){
            const k = keys[i];
            node = node[k] || (node[k] = Object.create(null));
        }
        return node;
    }
    function set(root, scope, values) {
        if (typeof scope === 'string') {
            return merge(getScope$1(root, scope), values);
        }
        return merge(getScope$1(root, ''), scope);
    }
     class Defaults {
        constructor(_descriptors, _appliers){
            this.animation = undefined;
            this.backgroundColor = 'rgba(0,0,0,0.1)';
            this.borderColor = 'rgba(0,0,0,0.1)';
            this.color = '#666';
            this.datasets = {};
            this.devicePixelRatio = (context)=>context.chart.platform.getDevicePixelRatio();
            this.elements = {};
            this.events = [
                'mousemove',
                'mouseout',
                'click',
                'touchstart',
                'touchmove'
            ];
            this.font = {
                family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
                size: 12,
                style: 'normal',
                lineHeight: 1.2,
                weight: null
            };
            this.hover = {};
            this.hoverBackgroundColor = (ctx, options)=>getHoverColor(options.backgroundColor);
            this.hoverBorderColor = (ctx, options)=>getHoverColor(options.borderColor);
            this.hoverColor = (ctx, options)=>getHoverColor(options.color);
            this.indexAxis = 'x';
            this.interaction = {
                mode: 'nearest',
                intersect: true,
                includeInvisible: false
            };
            this.maintainAspectRatio = true;
            this.onHover = null;
            this.onClick = null;
            this.parsing = true;
            this.plugins = {};
            this.responsive = true;
            this.scale = undefined;
            this.scales = {};
            this.showLine = true;
            this.drawActiveElementsOnTop = true;
            this.describe(_descriptors);
            this.apply(_appliers);
        }
     set(scope, values) {
            return set(this, scope, values);
        }
     get(scope) {
            return getScope$1(this, scope);
        }
     describe(scope, values) {
            return set(descriptors, scope, values);
        }
        override(scope, values) {
            return set(overrides, scope, values);
        }
     route(scope, name, targetScope, targetName) {
            const scopeObject = getScope$1(this, scope);
            const targetScopeObject = getScope$1(this, targetScope);
            const privateName = '_' + name;
            Object.defineProperties(scopeObject, {
                [privateName]: {
                    value: scopeObject[name],
                    writable: true
                },
                [name]: {
                    enumerable: true,
                    get () {
                        const local = this[privateName];
                        const target = targetScopeObject[targetName];
                        if (isObject(local)) {
                            return Object.assign({}, target, local);
                        }
                        return valueOrDefault(local, target);
                    },
                    set (value) {
                        this[privateName] = value;
                    }
                }
            });
        }
        apply(appliers) {
            appliers.forEach((apply)=>apply(this));
        }
    }
    var defaults = /* #__PURE__ */ new Defaults({
        _scriptable: (name)=>!name.startsWith('on'),
        _indexable: (name)=>name !== 'events',
        hover: {
            _fallback: 'interaction'
        },
        interaction: {
            _scriptable: false,
            _indexable: false
        }
    }, [
        applyAnimationsDefaults,
        applyLayoutsDefaults,
        applyScaleDefaults
    ]);

    /**
     * Converts the given font object into a CSS font string.
     * @param font - A font object.
     * @return The CSS font string. See https://developer.mozilla.org/en-US/docs/Web/CSS/font
     * @private
     */ function toFontString(font) {
        if (!font || isNullOrUndef(font.size) || isNullOrUndef(font.family)) {
            return null;
        }
        return (font.style ? font.style + ' ' : '') + (font.weight ? font.weight + ' ' : '') + font.size + 'px ' + font.family;
    }
    /**
     * @private
     */ function _measureText(ctx, data, gc, longest, string) {
        let textWidth = data[string];
        if (!textWidth) {
            textWidth = data[string] = ctx.measureText(string).width;
            gc.push(string);
        }
        if (textWidth > longest) {
            longest = textWidth;
        }
        return longest;
    }
    /**
     * Returns the aligned pixel value to avoid anti-aliasing blur
     * @param chart - The chart instance.
     * @param pixel - A pixel value.
     * @param width - The width of the element.
     * @returns The aligned pixel value.
     * @private
     */ function _alignPixel(chart, pixel, width) {
        const devicePixelRatio = chart.currentDevicePixelRatio;
        const halfWidth = width !== 0 ? Math.max(width / 2, 0.5) : 0;
        return Math.round((pixel - halfWidth) * devicePixelRatio) / devicePixelRatio + halfWidth;
    }
    /**
     * Clears the entire canvas.
     */ function clearCanvas(canvas, ctx) {
        if (!ctx && !canvas) {
            return;
        }
        ctx = ctx || canvas.getContext('2d');
        ctx.save();
        // canvas.width and canvas.height do not consider the canvas transform,
        // while clearRect does
        ctx.resetTransform();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
    function drawPoint(ctx, options, x, y) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        drawPointLegend(ctx, options, x, y);
    }
    // eslint-disable-next-line complexity
    function drawPointLegend(ctx, options, x, y, w) {
        let type, xOffset, yOffset, size, cornerRadius, width, xOffsetW, yOffsetW;
        const style = options.pointStyle;
        const rotation = options.rotation;
        const radius = options.radius;
        let rad = (rotation || 0) * RAD_PER_DEG;
        if (style && typeof style === 'object') {
            type = style.toString();
            if (type === '[object HTMLImageElement]' || type === '[object HTMLCanvasElement]') {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(rad);
                ctx.drawImage(style, -style.width / 2, -style.height / 2, style.width, style.height);
                ctx.restore();
                return;
            }
        }
        if (isNaN(radius) || radius <= 0) {
            return;
        }
        ctx.beginPath();
        switch(style){
            // Default includes circle
            default:
                {
                    ctx.arc(x, y, radius, 0, TAU);
                }
                ctx.closePath();
                break;
            case 'triangle':
                width = radius;
                ctx.moveTo(x + Math.sin(rad) * width, y - Math.cos(rad) * radius);
                rad += TWO_THIRDS_PI;
                ctx.lineTo(x + Math.sin(rad) * width, y - Math.cos(rad) * radius);
                rad += TWO_THIRDS_PI;
                ctx.lineTo(x + Math.sin(rad) * width, y - Math.cos(rad) * radius);
                ctx.closePath();
                break;
            case 'rectRounded':
                // NOTE: the rounded rect implementation changed to use `arc` instead of
                // `quadraticCurveTo` since it generates better results when rect is
                // almost a circle. 0.516 (instead of 0.5) produces results with visually
                // closer proportion to the previous impl and it is inscribed in the
                // circle with `radius`. For more details, see the following PRs:
                // https://github.com/chartjs/Chart.js/issues/5597
                // https://github.com/chartjs/Chart.js/issues/5858
                cornerRadius = radius * 0.516;
                size = radius - cornerRadius;
                xOffset = Math.cos(rad + QUARTER_PI) * size;
                xOffsetW = Math.cos(rad + QUARTER_PI) * (size);
                yOffset = Math.sin(rad + QUARTER_PI) * size;
                yOffsetW = Math.sin(rad + QUARTER_PI) * (size);
                ctx.arc(x - xOffsetW, y - yOffset, cornerRadius, rad - PI, rad - HALF_PI);
                ctx.arc(x + yOffsetW, y - xOffset, cornerRadius, rad - HALF_PI, rad);
                ctx.arc(x + xOffsetW, y + yOffset, cornerRadius, rad, rad + HALF_PI);
                ctx.arc(x - yOffsetW, y + xOffset, cornerRadius, rad + HALF_PI, rad + PI);
                ctx.closePath();
                break;
            case 'rect':
                if (!rotation) {
                    size = Math.SQRT1_2 * radius;
                    width = size;
                    ctx.rect(x - width, y - size, 2 * width, 2 * size);
                    break;
                }
                rad += QUARTER_PI;
            /* falls through */ case 'rectRot':
                xOffsetW = Math.cos(rad) * (radius);
                xOffset = Math.cos(rad) * radius;
                yOffset = Math.sin(rad) * radius;
                yOffsetW = Math.sin(rad) * (radius);
                ctx.moveTo(x - xOffsetW, y - yOffset);
                ctx.lineTo(x + yOffsetW, y - xOffset);
                ctx.lineTo(x + xOffsetW, y + yOffset);
                ctx.lineTo(x - yOffsetW, y + xOffset);
                ctx.closePath();
                break;
            case 'crossRot':
                rad += QUARTER_PI;
            /* falls through */ case 'cross':
                xOffsetW = Math.cos(rad) * (radius);
                xOffset = Math.cos(rad) * radius;
                yOffset = Math.sin(rad) * radius;
                yOffsetW = Math.sin(rad) * (radius);
                ctx.moveTo(x - xOffsetW, y - yOffset);
                ctx.lineTo(x + xOffsetW, y + yOffset);
                ctx.moveTo(x + yOffsetW, y - xOffset);
                ctx.lineTo(x - yOffsetW, y + xOffset);
                break;
            case 'star':
                xOffsetW = Math.cos(rad) * (radius);
                xOffset = Math.cos(rad) * radius;
                yOffset = Math.sin(rad) * radius;
                yOffsetW = Math.sin(rad) * (radius);
                ctx.moveTo(x - xOffsetW, y - yOffset);
                ctx.lineTo(x + xOffsetW, y + yOffset);
                ctx.moveTo(x + yOffsetW, y - xOffset);
                ctx.lineTo(x - yOffsetW, y + xOffset);
                rad += QUARTER_PI;
                xOffsetW = Math.cos(rad) * (radius);
                xOffset = Math.cos(rad) * radius;
                yOffset = Math.sin(rad) * radius;
                yOffsetW = Math.sin(rad) * (radius);
                ctx.moveTo(x - xOffsetW, y - yOffset);
                ctx.lineTo(x + xOffsetW, y + yOffset);
                ctx.moveTo(x + yOffsetW, y - xOffset);
                ctx.lineTo(x - yOffsetW, y + xOffset);
                break;
            case 'line':
                xOffset = Math.cos(rad) * radius;
                yOffset = Math.sin(rad) * radius;
                ctx.moveTo(x - xOffset, y - yOffset);
                ctx.lineTo(x + xOffset, y + yOffset);
                break;
            case 'dash':
                ctx.moveTo(x, y);
                ctx.lineTo(x + Math.cos(rad) * (radius), y + Math.sin(rad) * radius);
                break;
            case false:
                ctx.closePath();
                break;
        }
        ctx.fill();
        {
            ctx.stroke();
        }
    }
    /**
     * Returns true if the point is inside the rectangle
     * @param point - The point to test
     * @param area - The rectangle
     * @param margin - allowed margin
     * @private
     */ function _isPointInArea(point, area, margin) {
        margin = margin || 0.5; // margin - default is to match rounded decimals
        return !area || point && point.x > area.left - margin && point.x < area.right + margin && point.y > area.top - margin && point.y < area.bottom + margin;
    }
    function clipArea(ctx, area) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
        ctx.clip();
    }
    function unclipArea(ctx) {
        ctx.restore();
    }
    function setRenderOpts(ctx, opts) {
        if (opts.translation) {
            ctx.translate(opts.translation[0], opts.translation[1]);
        }
        if (!isNullOrUndef(opts.rotation)) {
            ctx.rotate(opts.rotation);
        }
        if (opts.color) {
            ctx.fillStyle = opts.color;
        }
        if (opts.textAlign) {
            ctx.textAlign = opts.textAlign;
        }
        if (opts.textBaseline) {
            ctx.textBaseline = opts.textBaseline;
        }
    }
    function decorateText(ctx, x, y, line, opts) {
        if (opts.strikethrough || opts.underline) {
            /**
         * Now that IE11 support has been dropped, we can use more
         * of the TextMetrics object. The actual bounding boxes
         * are unflagged in Chrome, Firefox, Edge, and Safari so they
         * can be safely used.
         * See https://developer.mozilla.org/en-US/docs/Web/API/TextMetrics#Browser_compatibility
         */ const metrics = ctx.measureText(line);
            const left = x - metrics.actualBoundingBoxLeft;
            const right = x + metrics.actualBoundingBoxRight;
            const top = y - metrics.actualBoundingBoxAscent;
            const bottom = y + metrics.actualBoundingBoxDescent;
            const yDecoration = opts.strikethrough ? (top + bottom) / 2 : bottom;
            ctx.strokeStyle = ctx.fillStyle;
            ctx.beginPath();
            ctx.lineWidth = opts.decorationWidth || 2;
            ctx.moveTo(left, yDecoration);
            ctx.lineTo(right, yDecoration);
            ctx.stroke();
        }
    }
    function drawBackdrop(ctx, opts) {
        const oldColor = ctx.fillStyle;
        ctx.fillStyle = opts.color;
        ctx.fillRect(opts.left, opts.top, opts.width, opts.height);
        ctx.fillStyle = oldColor;
    }
    /**
     * Render text onto the canvas
     */ function renderText(ctx, text, x, y, font, opts = {}) {
        const lines = isArray(text) ? text : [
            text
        ];
        const stroke = opts.strokeWidth > 0 && opts.strokeColor !== '';
        let i, line;
        ctx.save();
        ctx.font = font.string;
        setRenderOpts(ctx, opts);
        for(i = 0; i < lines.length; ++i){
            line = lines[i];
            if (opts.backdrop) {
                drawBackdrop(ctx, opts.backdrop);
            }
            if (stroke) {
                if (opts.strokeColor) {
                    ctx.strokeStyle = opts.strokeColor;
                }
                if (!isNullOrUndef(opts.strokeWidth)) {
                    ctx.lineWidth = opts.strokeWidth;
                }
                ctx.strokeText(line, x, y, opts.maxWidth);
            }
            ctx.fillText(line, x, y, opts.maxWidth);
            decorateText(ctx, x, y, line, opts);
            y += Number(font.lineHeight);
        }
        ctx.restore();
    }
    /**
     * Add a path of a rectangle with rounded corners to the current sub-path
     * @param ctx - Context
     * @param rect - Bounding rect
     */ function addRoundedRectPath(ctx, rect) {
        const { x , y , w , h , radius  } = rect;
        // top left arc
        ctx.arc(x + radius.topLeft, y + radius.topLeft, radius.topLeft, 1.5 * PI, PI, true);
        // line from top left to bottom left
        ctx.lineTo(x, y + h - radius.bottomLeft);
        // bottom left arc
        ctx.arc(x + radius.bottomLeft, y + h - radius.bottomLeft, radius.bottomLeft, PI, HALF_PI, true);
        // line from bottom left to bottom right
        ctx.lineTo(x + w - radius.bottomRight, y + h);
        // bottom right arc
        ctx.arc(x + w - radius.bottomRight, y + h - radius.bottomRight, radius.bottomRight, HALF_PI, 0, true);
        // line from bottom right to top right
        ctx.lineTo(x + w, y + radius.topRight);
        // top right arc
        ctx.arc(x + w - radius.topRight, y + radius.topRight, radius.topRight, 0, -HALF_PI, true);
        // line from top right to top left
        ctx.lineTo(x + radius.topLeft, y);
    }

    const LINE_HEIGHT = /^(normal|(\d+(?:\.\d+)?)(px|em|%)?)$/;
    const FONT_STYLE = /^(normal|italic|initial|inherit|unset|(oblique( -?[0-9]?[0-9]deg)?))$/;
    /**
     * @alias Chart.helpers.options
     * @namespace
     */ /**
     * Converts the given line height `value` in pixels for a specific font `size`.
     * @param value - The lineHeight to parse (eg. 1.6, '14px', '75%', '1.6em').
     * @param size - The font size (in pixels) used to resolve relative `value`.
     * @returns The effective line height in pixels (size * 1.2 if value is invalid).
     * @see https://developer.mozilla.org/en-US/docs/Web/CSS/line-height
     * @since 2.7.0
     */ function toLineHeight(value, size) {
        const matches = ('' + value).match(LINE_HEIGHT);
        if (!matches || matches[1] === 'normal') {
            return size * 1.2;
        }
        value = +matches[2];
        switch(matches[3]){
            case 'px':
                return value;
            case '%':
                value /= 100;
                break;
        }
        return size * value;
    }
    const numberOrZero = (v)=>+v || 0;
    function _readValueToProps(value, props) {
        const ret = {};
        const objProps = isObject(props);
        const keys = objProps ? Object.keys(props) : props;
        const read = isObject(value) ? objProps ? (prop)=>valueOrDefault(value[prop], value[props[prop]]) : (prop)=>value[prop] : ()=>value;
        for (const prop of keys){
            ret[prop] = numberOrZero(read(prop));
        }
        return ret;
    }
    /**
     * Converts the given value into a TRBL object.
     * @param value - If a number, set the value to all TRBL component,
     *  else, if an object, use defined properties and sets undefined ones to 0.
     *  x / y are shorthands for same value for left/right and top/bottom.
     * @returns The padding values (top, right, bottom, left)
     * @since 3.0.0
     */ function toTRBL(value) {
        return _readValueToProps(value, {
            top: 'y',
            right: 'x',
            bottom: 'y',
            left: 'x'
        });
    }
    /**
     * Converts the given value into a TRBL corners object (similar with css border-radius).
     * @param value - If a number, set the value to all TRBL corner components,
     *  else, if an object, use defined properties and sets undefined ones to 0.
     * @returns The TRBL corner values (topLeft, topRight, bottomLeft, bottomRight)
     * @since 3.0.0
     */ function toTRBLCorners(value) {
        return _readValueToProps(value, [
            'topLeft',
            'topRight',
            'bottomLeft',
            'bottomRight'
        ]);
    }
    /**
     * Converts the given value into a padding object with pre-computed width/height.
     * @param value - If a number, set the value to all TRBL component,
     *  else, if an object, use defined properties and sets undefined ones to 0.
     *  x / y are shorthands for same value for left/right and top/bottom.
     * @returns The padding values (top, right, bottom, left, width, height)
     * @since 2.7.0
     */ function toPadding(value) {
        const obj = toTRBL(value);
        obj.width = obj.left + obj.right;
        obj.height = obj.top + obj.bottom;
        return obj;
    }
    /**
     * Parses font options and returns the font object.
     * @param options - A object that contains font options to be parsed.
     * @param fallback - A object that contains fallback font options.
     * @return The font object.
     * @private
     */ function toFont(options, fallback) {
        options = options || {};
        fallback = fallback || defaults.font;
        let size = valueOrDefault(options.size, fallback.size);
        if (typeof size === 'string') {
            size = parseInt(size, 10);
        }
        let style = valueOrDefault(options.style, fallback.style);
        if (style && !('' + style).match(FONT_STYLE)) {
            console.warn('Invalid font style specified: "' + style + '"');
            style = undefined;
        }
        const font = {
            family: valueOrDefault(options.family, fallback.family),
            lineHeight: toLineHeight(valueOrDefault(options.lineHeight, fallback.lineHeight), size),
            size,
            style,
            weight: valueOrDefault(options.weight, fallback.weight),
            string: ''
        };
        font.string = toFontString(font);
        return font;
    }
    /**
     * Evaluates the given `inputs` sequentially and returns the first defined value.
     * @param inputs - An array of values, falling back to the last value.
     * @param context - If defined and the current value is a function, the value
     * is called with `context` as first argument and the result becomes the new input.
     * @param index - If defined and the current value is an array, the value
     * at `index` become the new input.
     * @param info - object to return information about resolution in
     * @param info.cacheable - Will be set to `false` if option is not cacheable.
     * @since 2.7.0
     */ function resolve(inputs, context, index, info) {
        let i, ilen, value;
        for(i = 0, ilen = inputs.length; i < ilen; ++i){
            value = inputs[i];
            if (value === undefined) {
                continue;
            }
            if (value !== undefined) {
                return value;
            }
        }
    }
    /**
     * @param minmax
     * @param grace
     * @param beginAtZero
     * @private
     */ function _addGrace(minmax, grace, beginAtZero) {
        const { min , max  } = minmax;
        const change = toDimension(grace, (max - min) / 2);
        const keepZero = (value, add)=>beginAtZero && value === 0 ? 0 : value + add;
        return {
            min: keepZero(min, -Math.abs(change)),
            max: keepZero(max, change)
        };
    }
    function createContext(parentContext, context) {
        return Object.assign(Object.create(parentContext), context);
    }

    /**
     * Creates a Proxy for resolving raw values for options.
     * @param scopes - The option scopes to look for values, in resolution order
     * @param prefixes - The prefixes for values, in resolution order.
     * @param rootScopes - The root option scopes
     * @param fallback - Parent scopes fallback
     * @param getTarget - callback for getting the target for changed values
     * @returns Proxy
     * @private
     */ function _createResolver(scopes, prefixes = [
        ''
    ], rootScopes, fallback, getTarget = ()=>scopes[0]) {
        const finalRootScopes = rootScopes || scopes;
        if (typeof fallback === 'undefined') {
            fallback = _resolve('_fallback', scopes);
        }
        const cache = {
            [Symbol.toStringTag]: 'Object',
            _cacheable: true,
            _scopes: scopes,
            _rootScopes: finalRootScopes,
            _fallback: fallback,
            _getTarget: getTarget,
            override: (scope)=>_createResolver([
                    scope,
                    ...scopes
                ], prefixes, finalRootScopes, fallback)
        };
        return new Proxy(cache, {
            /**
         * A trap for the delete operator.
         */ deleteProperty (target, prop) {
                delete target[prop]; // remove from cache
                delete target._keys; // remove cached keys
                delete scopes[0][prop]; // remove from top level scope
                return true;
            },
            /**
         * A trap for getting property values.
         */ get (target, prop) {
                return _cached(target, prop, ()=>_resolveWithPrefixes(prop, prefixes, scopes, target));
            },
            /**
         * A trap for Object.getOwnPropertyDescriptor.
         * Also used by Object.hasOwnProperty.
         */ getOwnPropertyDescriptor (target, prop) {
                return Reflect.getOwnPropertyDescriptor(target._scopes[0], prop);
            },
            /**
         * A trap for Object.getPrototypeOf.
         */ getPrototypeOf () {
                return Reflect.getPrototypeOf(scopes[0]);
            },
            /**
         * A trap for the in operator.
         */ has (target, prop) {
                return getKeysFromAllScopes(target).includes(prop);
            },
            /**
         * A trap for Object.getOwnPropertyNames and Object.getOwnPropertySymbols.
         */ ownKeys (target) {
                return getKeysFromAllScopes(target);
            },
            /**
         * A trap for setting property values.
         */ set (target, prop, value) {
                const storage = target._storage || (target._storage = getTarget());
                target[prop] = storage[prop] = value; // set to top level scope + cache
                delete target._keys; // remove cached keys
                return true;
            }
        });
    }
    /**
     * Returns an Proxy for resolving option values with context.
     * @param proxy - The Proxy returned by `_createResolver`
     * @param context - Context object for scriptable/indexable options
     * @param subProxy - The proxy provided for scriptable options
     * @param descriptorDefaults - Defaults for descriptors
     * @private
     */ function _attachContext(proxy, context, subProxy, descriptorDefaults) {
        const cache = {
            _cacheable: false,
            _proxy: proxy,
            _context: context,
            _subProxy: subProxy,
            _stack: new Set(),
            _descriptors: _descriptors(proxy, descriptorDefaults),
            setContext: (ctx)=>_attachContext(proxy, ctx, subProxy, descriptorDefaults),
            override: (scope)=>_attachContext(proxy.override(scope), context, subProxy, descriptorDefaults)
        };
        return new Proxy(cache, {
            /**
         * A trap for the delete operator.
         */ deleteProperty (target, prop) {
                delete target[prop]; // remove from cache
                delete proxy[prop]; // remove from proxy
                return true;
            },
            /**
         * A trap for getting property values.
         */ get (target, prop, receiver) {
                return _cached(target, prop, ()=>_resolveWithContext(target, prop, receiver));
            },
            /**
         * A trap for Object.getOwnPropertyDescriptor.
         * Also used by Object.hasOwnProperty.
         */ getOwnPropertyDescriptor (target, prop) {
                return target._descriptors.allKeys ? Reflect.has(proxy, prop) ? {
                    enumerable: true,
                    configurable: true
                } : undefined : Reflect.getOwnPropertyDescriptor(proxy, prop);
            },
            /**
         * A trap for Object.getPrototypeOf.
         */ getPrototypeOf () {
                return Reflect.getPrototypeOf(proxy);
            },
            /**
         * A trap for the in operator.
         */ has (target, prop) {
                return Reflect.has(proxy, prop);
            },
            /**
         * A trap for Object.getOwnPropertyNames and Object.getOwnPropertySymbols.
         */ ownKeys () {
                return Reflect.ownKeys(proxy);
            },
            /**
         * A trap for setting property values.
         */ set (target, prop, value) {
                proxy[prop] = value; // set to proxy
                delete target[prop]; // remove from cache
                return true;
            }
        });
    }
    /**
     * @private
     */ function _descriptors(proxy, defaults = {
        scriptable: true,
        indexable: true
    }) {
        const { _scriptable =defaults.scriptable , _indexable =defaults.indexable , _allKeys =defaults.allKeys  } = proxy;
        return {
            allKeys: _allKeys,
            scriptable: _scriptable,
            indexable: _indexable,
            isScriptable: isFunction(_scriptable) ? _scriptable : ()=>_scriptable,
            isIndexable: isFunction(_indexable) ? _indexable : ()=>_indexable
        };
    }
    const readKey = (prefix, name)=>prefix ? prefix + _capitalize(name) : name;
    const needsSubResolver = (prop, value)=>isObject(value) && prop !== 'adapters' && (Object.getPrototypeOf(value) === null || value.constructor === Object);
    function _cached(target, prop, resolve) {
        if (Object.prototype.hasOwnProperty.call(target, prop) || prop === 'constructor') {
            return target[prop];
        }
        const value = resolve();
        // cache the resolved value
        target[prop] = value;
        return value;
    }
    function _resolveWithContext(target, prop, receiver) {
        const { _proxy , _context , _subProxy , _descriptors: descriptors  } = target;
        let value = _proxy[prop]; // resolve from proxy
        // resolve with context
        if (isFunction(value) && descriptors.isScriptable(prop)) {
            value = _resolveScriptable(prop, value, target, receiver);
        }
        if (isArray(value) && value.length) {
            value = _resolveArray(prop, value, target, descriptors.isIndexable);
        }
        if (needsSubResolver(prop, value)) {
            // if the resolved value is an object, create a sub resolver for it
            value = _attachContext(value, _context, _subProxy && _subProxy[prop], descriptors);
        }
        return value;
    }
    function _resolveScriptable(prop, getValue, target, receiver) {
        const { _proxy , _context , _subProxy , _stack  } = target;
        if (_stack.has(prop)) {
            throw new Error('Recursion detected: ' + Array.from(_stack).join('->') + '->' + prop);
        }
        _stack.add(prop);
        let value = getValue(_context, _subProxy || receiver);
        _stack.delete(prop);
        if (needsSubResolver(prop, value)) {
            // When scriptable option returns an object, create a resolver on that.
            value = createSubResolver(_proxy._scopes, _proxy, prop, value);
        }
        return value;
    }
    function _resolveArray(prop, value, target, isIndexable) {
        const { _proxy , _context , _subProxy , _descriptors: descriptors  } = target;
        if (typeof _context.index !== 'undefined' && isIndexable(prop)) {
            return value[_context.index % value.length];
        } else if (isObject(value[0])) {
            // Array of objects, return array or resolvers
            const arr = value;
            const scopes = _proxy._scopes.filter((s)=>s !== arr);
            value = [];
            for (const item of arr){
                const resolver = createSubResolver(scopes, _proxy, prop, item);
                value.push(_attachContext(resolver, _context, _subProxy && _subProxy[prop], descriptors));
            }
        }
        return value;
    }
    function resolveFallback(fallback, prop, value) {
        return isFunction(fallback) ? fallback(prop, value) : fallback;
    }
    const getScope = (key, parent)=>key === true ? parent : typeof key === 'string' ? resolveObjectKey(parent, key) : undefined;
    function addScopes(set, parentScopes, key, parentFallback, value) {
        for (const parent of parentScopes){
            const scope = getScope(key, parent);
            if (scope) {
                set.add(scope);
                const fallback = resolveFallback(scope._fallback, key, value);
                if (typeof fallback !== 'undefined' && fallback !== key && fallback !== parentFallback) {
                    // When we reach the descriptor that defines a new _fallback, return that.
                    // The fallback will resume to that new scope.
                    return fallback;
                }
            } else if (scope === false && typeof parentFallback !== 'undefined' && key !== parentFallback) {
                // Fallback to `false` results to `false`, when falling back to different key.
                // For example `interaction` from `hover` or `plugins.tooltip` and `animation` from `animations`
                return null;
            }
        }
        return false;
    }
    function createSubResolver(parentScopes, resolver, prop, value) {
        const rootScopes = resolver._rootScopes;
        const fallback = resolveFallback(resolver._fallback, prop, value);
        const allScopes = [
            ...parentScopes,
            ...rootScopes
        ];
        const set = new Set();
        set.add(value);
        let key = addScopesFromKey(set, allScopes, prop, fallback || prop, value);
        if (key === null) {
            return false;
        }
        if (typeof fallback !== 'undefined' && fallback !== prop) {
            key = addScopesFromKey(set, allScopes, fallback, key, value);
            if (key === null) {
                return false;
            }
        }
        return _createResolver(Array.from(set), [
            ''
        ], rootScopes, fallback, ()=>subGetTarget(resolver, prop, value));
    }
    function addScopesFromKey(set, allScopes, key, fallback, item) {
        while(key){
            key = addScopes(set, allScopes, key, fallback, item);
        }
        return key;
    }
    function subGetTarget(resolver, prop, value) {
        const parent = resolver._getTarget();
        if (!(prop in parent)) {
            parent[prop] = {};
        }
        const target = parent[prop];
        if (isArray(target) && isObject(value)) {
            // For array of objects, the object is used to store updated values
            return value;
        }
        return target || {};
    }
    function _resolveWithPrefixes(prop, prefixes, scopes, proxy) {
        let value;
        for (const prefix of prefixes){
            value = _resolve(readKey(prefix, prop), scopes);
            if (typeof value !== 'undefined') {
                return needsSubResolver(prop, value) ? createSubResolver(scopes, proxy, prop, value) : value;
            }
        }
    }
    function _resolve(key, scopes) {
        for (const scope of scopes){
            if (!scope) {
                continue;
            }
            const value = scope[key];
            if (typeof value !== 'undefined') {
                return value;
            }
        }
    }
    function getKeysFromAllScopes(target) {
        let keys = target._keys;
        if (!keys) {
            keys = target._keys = resolveKeysFromAllScopes(target._scopes);
        }
        return keys;
    }
    function resolveKeysFromAllScopes(scopes) {
        const set = new Set();
        for (const scope of scopes){
            for (const key of Object.keys(scope).filter((k)=>!k.startsWith('_'))){
                set.add(key);
            }
        }
        return Array.from(set);
    }

    /**
     * @private
     */ function _isDomSupported() {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }
    /**
     * @private
     */ function _getParentNode(domNode) {
        let parent = domNode.parentNode;
        if (parent && parent.toString() === '[object ShadowRoot]') {
            parent = parent.host;
        }
        return parent;
    }
    /**
     * convert max-width/max-height values that may be percentages into a number
     * @private
     */ function parseMaxStyle(styleValue, node, parentProperty) {
        let valueInPixels;
        if (typeof styleValue === 'string') {
            valueInPixels = parseInt(styleValue, 10);
            if (styleValue.indexOf('%') !== -1) {
                // percentage * size in dimension
                valueInPixels = valueInPixels / 100 * node.parentNode[parentProperty];
            }
        } else {
            valueInPixels = styleValue;
        }
        return valueInPixels;
    }
    const getComputedStyle$1 = (element)=>element.ownerDocument.defaultView.getComputedStyle(element, null);
    function getStyle(el, property) {
        return getComputedStyle$1(el).getPropertyValue(property);
    }
    const positions = [
        'top',
        'right',
        'bottom',
        'left'
    ];
    function getPositionedStyle(styles, style, suffix) {
        const result = {};
        suffix = suffix ? '-' + suffix : '';
        for(let i = 0; i < 4; i++){
            const pos = positions[i];
            result[pos] = parseFloat(styles[style + '-' + pos + suffix]) || 0;
        }
        result.width = result.left + result.right;
        result.height = result.top + result.bottom;
        return result;
    }
    const useOffsetPos = (x, y, target)=>(x > 0 || y > 0) && (!target || !target.shadowRoot);
    /**
     * @param e
     * @param canvas
     * @returns Canvas position
     */ function getCanvasPosition(e, canvas) {
        const touches = e.touches;
        const source = touches && touches.length ? touches[0] : e;
        const { offsetX , offsetY  } = source;
        let box = false;
        let x, y;
        if (useOffsetPos(offsetX, offsetY, e.target)) {
            x = offsetX;
            y = offsetY;
        } else {
            const rect = canvas.getBoundingClientRect();
            x = source.clientX - rect.left;
            y = source.clientY - rect.top;
            box = true;
        }
        return {
            x,
            y,
            box
        };
    }
    /**
     * Gets an event's x, y coordinates, relative to the chart area
     * @param event
     * @param chart
     * @returns x and y coordinates of the event
     */ function getRelativePosition(event, chart) {
        if ('native' in event) {
            return event;
        }
        const { canvas , currentDevicePixelRatio  } = chart;
        const style = getComputedStyle$1(canvas);
        const borderBox = style.boxSizing === 'border-box';
        const paddings = getPositionedStyle(style, 'padding');
        const borders = getPositionedStyle(style, 'border', 'width');
        const { x , y , box  } = getCanvasPosition(event, canvas);
        const xOffset = paddings.left + (box && borders.left);
        const yOffset = paddings.top + (box && borders.top);
        let { width , height  } = chart;
        if (borderBox) {
            width -= paddings.width + borders.width;
            height -= paddings.height + borders.height;
        }
        return {
            x: Math.round((x - xOffset) / width * canvas.width / currentDevicePixelRatio),
            y: Math.round((y - yOffset) / height * canvas.height / currentDevicePixelRatio)
        };
    }
    function getContainerSize(canvas, width, height) {
        let maxWidth, maxHeight;
        if (width === undefined || height === undefined) {
            const container = canvas && _getParentNode(canvas);
            if (!container) {
                width = canvas.clientWidth;
                height = canvas.clientHeight;
            } else {
                const rect = container.getBoundingClientRect(); // this is the border box of the container
                const containerStyle = getComputedStyle$1(container);
                const containerBorder = getPositionedStyle(containerStyle, 'border', 'width');
                const containerPadding = getPositionedStyle(containerStyle, 'padding');
                width = rect.width - containerPadding.width - containerBorder.width;
                height = rect.height - containerPadding.height - containerBorder.height;
                maxWidth = parseMaxStyle(containerStyle.maxWidth, container, 'clientWidth');
                maxHeight = parseMaxStyle(containerStyle.maxHeight, container, 'clientHeight');
            }
        }
        return {
            width,
            height,
            maxWidth: maxWidth || INFINITY,
            maxHeight: maxHeight || INFINITY
        };
    }
    const round1 = (v)=>Math.round(v * 10) / 10;
    // eslint-disable-next-line complexity
    function getMaximumSize(canvas, bbWidth, bbHeight, aspectRatio) {
        const style = getComputedStyle$1(canvas);
        const margins = getPositionedStyle(style, 'margin');
        const maxWidth = parseMaxStyle(style.maxWidth, canvas, 'clientWidth') || INFINITY;
        const maxHeight = parseMaxStyle(style.maxHeight, canvas, 'clientHeight') || INFINITY;
        const containerSize = getContainerSize(canvas, bbWidth, bbHeight);
        let { width , height  } = containerSize;
        if (style.boxSizing === 'content-box') {
            const borders = getPositionedStyle(style, 'border', 'width');
            const paddings = getPositionedStyle(style, 'padding');
            width -= paddings.width + borders.width;
            height -= paddings.height + borders.height;
        }
        width = Math.max(0, width - margins.width);
        height = Math.max(0, aspectRatio ? width / aspectRatio : height - margins.height);
        width = round1(Math.min(width, maxWidth, containerSize.maxWidth));
        height = round1(Math.min(height, maxHeight, containerSize.maxHeight));
        if (width && !height) {
            // https://github.com/chartjs/Chart.js/issues/4659
            // If the canvas has width, but no height, default to aspectRatio of 2 (canvas default)
            height = round1(width / 2);
        }
        const maintainHeight = bbWidth !== undefined || bbHeight !== undefined;
        if (maintainHeight && aspectRatio && containerSize.height && height > containerSize.height) {
            height = containerSize.height;
            width = round1(Math.floor(height * aspectRatio));
        }
        return {
            width,
            height
        };
    }
    /**
     * @param chart
     * @param forceRatio
     * @param forceStyle
     * @returns True if the canvas context size or transformation has changed.
     */ function retinaScale(chart, forceRatio, forceStyle) {
        const pixelRatio = forceRatio || 1;
        const deviceHeight = round1(chart.height * pixelRatio);
        const deviceWidth = round1(chart.width * pixelRatio);
        chart.height = round1(chart.height);
        chart.width = round1(chart.width);
        const canvas = chart.canvas;
        // If no style has been set on the canvas, the render size is used as display size,
        // making the chart visually bigger, so let's enforce it to the "correct" values.
        // See https://github.com/chartjs/Chart.js/issues/3575
        if (canvas.style && (forceStyle || !canvas.style.height && !canvas.style.width)) {
            canvas.style.height = `${chart.height}px`;
            canvas.style.width = `${chart.width}px`;
        }
        if (chart.currentDevicePixelRatio !== pixelRatio || canvas.height !== deviceHeight || canvas.width !== deviceWidth) {
            chart.currentDevicePixelRatio = pixelRatio;
            canvas.height = deviceHeight;
            canvas.width = deviceWidth;
            chart.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            return true;
        }
        return false;
    }
    /**
     * Detects support for options object argument in addEventListener.
     * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#Safely_detecting_option_support
     * @private
     */ const supportsEventListenerOptions = function() {
        let passiveSupported = false;
        try {
            const options = {
                get passive () {
                    passiveSupported = true;
                    return false;
                }
            };
            if (_isDomSupported()) {
                window.addEventListener('test', null, options);
                window.removeEventListener('test', null, options);
            }
        } catch (e) {
        // continue regardless of error
        }
        return passiveSupported;
    }();
    /**
     * The "used" size is the final value of a dimension property after all calculations have
     * been performed. This method uses the computed style of `element` but returns undefined
     * if the computed style is not expressed in pixels. That can happen in some cases where
     * `element` has a size relative to its parent and this last one is not yet displayed,
     * for example because of `display: none` on a parent node.
     * @see https://developer.mozilla.org/en-US/docs/Web/CSS/used_value
     * @returns Size in pixels or undefined if unknown.
     */ function readUsedSize(element, property) {
        const value = getStyle(element, property);
        const matches = value && value.match(/^(\d+)(\.\d+)?px$/);
        return matches ? +matches[1] : undefined;
    }

    const getRightToLeftAdapter = function(rectX, width) {
        return {
            x (x) {
                return rectX + rectX + width - x;
            },
            setWidth (w) {
                width = w;
            },
            textAlign (align) {
                if (align === 'center') {
                    return align;
                }
                return align === 'right' ? 'left' : 'right';
            },
            xPlus (x, value) {
                return x - value;
            },
            leftForLtr (x, itemWidth) {
                return x - itemWidth;
            }
        };
    };
    const getLeftToRightAdapter = function() {
        return {
            x (x) {
                return x;
            },
            setWidth (w) {},
            textAlign (align) {
                return align;
            },
            xPlus (x, value) {
                return x + value;
            },
            leftForLtr (x, _itemWidth) {
                return x;
            }
        };
    };
    function getRtlAdapter(rtl, rectX, width) {
        return rtl ? getRightToLeftAdapter(rectX, width) : getLeftToRightAdapter();
    }
    function overrideTextDirection(ctx, direction) {
        let style, original;
        if (direction === 'ltr' || direction === 'rtl') {
            style = ctx.canvas.style;
            original = [
                style.getPropertyValue('direction'),
                style.getPropertyPriority('direction')
            ];
            style.setProperty('direction', direction, 'important');
            ctx.prevTextDirection = original;
        }
    }
    function restoreTextDirection(ctx, original) {
        if (original !== undefined) {
            delete ctx.prevTextDirection;
            ctx.canvas.style.setProperty('direction', original[0], original[1]);
        }
    }

    function getSizeForArea(scale, chartArea, field) {
        return scale.options.clip ? scale[field] : chartArea[field];
    }
    function getDatasetArea(meta, chartArea) {
        const { xScale , yScale  } = meta;
        if (xScale && yScale) {
            return {
                left: getSizeForArea(xScale, chartArea, 'left'),
                right: getSizeForArea(xScale, chartArea, 'right'),
                top: getSizeForArea(yScale, chartArea, 'top'),
                bottom: getSizeForArea(yScale, chartArea, 'bottom')
            };
        }
        return chartArea;
    }
    function getDatasetClipArea(chart, meta) {
        const clip = meta._clip;
        if (clip.disabled) {
            return false;
        }
        const area = getDatasetArea(meta, chart.chartArea);
        return {
            left: clip.left === false ? 0 : area.left - (clip.left === true ? 0 : clip.left),
            right: clip.right === false ? chart.width : area.right + (clip.right === true ? 0 : clip.right),
            top: clip.top === false ? 0 : area.top - (clip.top === true ? 0 : clip.top),
            bottom: clip.bottom === false ? chart.height : area.bottom + (clip.bottom === true ? 0 : clip.bottom)
        };
    }

    /*!
     * Chart.js v4.5.1
     * https://www.chartjs.org
     * (c) 2025 Chart.js Contributors
     * Released under the MIT License
     */

    class Animator {
        constructor(){
            this._request = null;
            this._charts = new Map();
            this._running = false;
            this._lastDate = undefined;
        }
     _notify(chart, anims, date, type) {
            const callbacks = anims.listeners[type];
            const numSteps = anims.duration;
            callbacks.forEach((fn)=>fn({
                    chart,
                    initial: anims.initial,
                    numSteps,
                    currentStep: Math.min(date - anims.start, numSteps)
                }));
        }
     _refresh() {
            if (this._request) {
                return;
            }
            this._running = true;
            this._request = requestAnimFrame.call(window, ()=>{
                this._update();
                this._request = null;
                if (this._running) {
                    this._refresh();
                }
            });
        }
     _update(date = Date.now()) {
            let remaining = 0;
            this._charts.forEach((anims, chart)=>{
                if (!anims.running || !anims.items.length) {
                    return;
                }
                const items = anims.items;
                let i = items.length - 1;
                let draw = false;
                let item;
                for(; i >= 0; --i){
                    item = items[i];
                    if (item._active) {
                        if (item._total > anims.duration) {
                            anims.duration = item._total;
                        }
                        item.tick(date);
                        draw = true;
                    } else {
                        items[i] = items[items.length - 1];
                        items.pop();
                    }
                }
                if (draw) {
                    chart.draw();
                    this._notify(chart, anims, date, 'progress');
                }
                if (!items.length) {
                    anims.running = false;
                    this._notify(chart, anims, date, 'complete');
                    anims.initial = false;
                }
                remaining += items.length;
            });
            this._lastDate = date;
            if (remaining === 0) {
                this._running = false;
            }
        }
     _getAnims(chart) {
            const charts = this._charts;
            let anims = charts.get(chart);
            if (!anims) {
                anims = {
                    running: false,
                    initial: true,
                    items: [],
                    listeners: {
                        complete: [],
                        progress: []
                    }
                };
                charts.set(chart, anims);
            }
            return anims;
        }
     listen(chart, event, cb) {
            this._getAnims(chart).listeners[event].push(cb);
        }
     add(chart, items) {
            if (!items || !items.length) {
                return;
            }
            this._getAnims(chart).items.push(...items);
        }
     has(chart) {
            return this._getAnims(chart).items.length > 0;
        }
     start(chart) {
            const anims = this._charts.get(chart);
            if (!anims) {
                return;
            }
            anims.running = true;
            anims.start = Date.now();
            anims.duration = anims.items.reduce((acc, cur)=>Math.max(acc, cur._duration), 0);
            this._refresh();
        }
        running(chart) {
            if (!this._running) {
                return false;
            }
            const anims = this._charts.get(chart);
            if (!anims || !anims.running || !anims.items.length) {
                return false;
            }
            return true;
        }
     stop(chart) {
            const anims = this._charts.get(chart);
            if (!anims || !anims.items.length) {
                return;
            }
            const items = anims.items;
            let i = items.length - 1;
            for(; i >= 0; --i){
                items[i].cancel();
            }
            anims.items = [];
            this._notify(chart, anims, Date.now(), 'complete');
        }
     remove(chart) {
            return this._charts.delete(chart);
        }
    }
    var animator = /* #__PURE__ */ new Animator();

    const transparent = 'transparent';
    const interpolators = {
        boolean (from, to, factor) {
            return factor > 0.5 ? to : from;
        },
     color (from, to, factor) {
            const c0 = color(from || transparent);
            const c1 = c0.valid && color(to || transparent);
            return c1 && c1.valid ? c1.mix(c0, factor).hexString() : to;
        },
        number (from, to, factor) {
            return from + (to - from) * factor;
        }
    };
    class Animation {
        constructor(cfg, target, prop, to){
            const currentValue = target[prop];
            to = resolve([
                cfg.to,
                to,
                currentValue,
                cfg.from
            ]);
            const from = resolve([
                cfg.from,
                currentValue,
                to
            ]);
            this._active = true;
            this._fn = cfg.fn || interpolators[cfg.type || typeof from];
            this._easing = effects[cfg.easing] || effects.linear;
            this._start = Math.floor(Date.now() + (cfg.delay || 0));
            this._duration = this._total = Math.floor(cfg.duration);
            this._loop = !!cfg.loop;
            this._target = target;
            this._prop = prop;
            this._from = from;
            this._to = to;
            this._promises = undefined;
        }
        active() {
            return this._active;
        }
        update(cfg, to, date) {
            if (this._active) {
                this._notify(false);
                const currentValue = this._target[this._prop];
                const elapsed = date - this._start;
                const remain = this._duration - elapsed;
                this._start = date;
                this._duration = Math.floor(Math.max(remain, cfg.duration));
                this._total += elapsed;
                this._loop = !!cfg.loop;
                this._to = resolve([
                    cfg.to,
                    to,
                    currentValue,
                    cfg.from
                ]);
                this._from = resolve([
                    cfg.from,
                    currentValue,
                    to
                ]);
            }
        }
        cancel() {
            if (this._active) {
                this.tick(Date.now());
                this._active = false;
                this._notify(false);
            }
        }
        tick(date) {
            const elapsed = date - this._start;
            const duration = this._duration;
            const prop = this._prop;
            const from = this._from;
            const loop = this._loop;
            const to = this._to;
            let factor;
            this._active = from !== to && (loop || elapsed < duration);
            if (!this._active) {
                this._target[prop] = to;
                this._notify(true);
                return;
            }
            if (elapsed < 0) {
                this._target[prop] = from;
                return;
            }
            factor = elapsed / duration % 2;
            factor = loop && factor > 1 ? 2 - factor : factor;
            factor = this._easing(Math.min(1, Math.max(0, factor)));
            this._target[prop] = this._fn(from, to, factor);
        }
        wait() {
            const promises = this._promises || (this._promises = []);
            return new Promise((res, rej)=>{
                promises.push({
                    res,
                    rej
                });
            });
        }
        _notify(resolved) {
            const method = resolved ? 'res' : 'rej';
            const promises = this._promises || [];
            for(let i = 0; i < promises.length; i++){
                promises[i][method]();
            }
        }
    }

    class Animations {
        constructor(chart, config){
            this._chart = chart;
            this._properties = new Map();
            this.configure(config);
        }
        configure(config) {
            if (!isObject(config)) {
                return;
            }
            const animationOptions = Object.keys(defaults.animation);
            const animatedProps = this._properties;
            Object.getOwnPropertyNames(config).forEach((key)=>{
                const cfg = config[key];
                if (!isObject(cfg)) {
                    return;
                }
                const resolved = {};
                for (const option of animationOptions){
                    resolved[option] = cfg[option];
                }
                (isArray(cfg.properties) && cfg.properties || [
                    key
                ]).forEach((prop)=>{
                    if (prop === key || !animatedProps.has(prop)) {
                        animatedProps.set(prop, resolved);
                    }
                });
            });
        }
     _animateOptions(target, values) {
            const newOptions = values.options;
            const options = resolveTargetOptions(target, newOptions);
            if (!options) {
                return [];
            }
            const animations = this._createAnimations(options, newOptions);
            if (newOptions.$shared) {
                awaitAll(target.options.$animations, newOptions).then(()=>{
                    target.options = newOptions;
                }, ()=>{
                });
            }
            return animations;
        }
     _createAnimations(target, values) {
            const animatedProps = this._properties;
            const animations = [];
            const running = target.$animations || (target.$animations = {});
            const props = Object.keys(values);
            const date = Date.now();
            let i;
            for(i = props.length - 1; i >= 0; --i){
                const prop = props[i];
                if (prop.charAt(0) === '$') {
                    continue;
                }
                if (prop === 'options') {
                    animations.push(...this._animateOptions(target, values));
                    continue;
                }
                const value = values[prop];
                let animation = running[prop];
                const cfg = animatedProps.get(prop);
                if (animation) {
                    if (cfg && animation.active()) {
                        animation.update(cfg, value, date);
                        continue;
                    } else {
                        animation.cancel();
                    }
                }
                if (!cfg || !cfg.duration) {
                    target[prop] = value;
                    continue;
                }
                running[prop] = animation = new Animation(cfg, target, prop, value);
                animations.push(animation);
            }
            return animations;
        }
     update(target, values) {
            if (this._properties.size === 0) {
                Object.assign(target, values);
                return;
            }
            const animations = this._createAnimations(target, values);
            if (animations.length) {
                animator.add(this._chart, animations);
                return true;
            }
        }
    }
    function awaitAll(animations, properties) {
        const running = [];
        const keys = Object.keys(properties);
        for(let i = 0; i < keys.length; i++){
            const anim = animations[keys[i]];
            if (anim && anim.active()) {
                running.push(anim.wait());
            }
        }
        return Promise.all(running);
    }
    function resolveTargetOptions(target, newOptions) {
        if (!newOptions) {
            return;
        }
        let options = target.options;
        if (!options) {
            target.options = newOptions;
            return;
        }
        if (options.$shared) {
            target.options = options = Object.assign({}, options, {
                $shared: false,
                $animations: {}
            });
        }
        return options;
    }

    function scaleClip(scale, allowedOverflow) {
        const opts = scale && scale.options || {};
        const reverse = opts.reverse;
        const min = opts.min === undefined ? allowedOverflow : 0;
        const max = opts.max === undefined ? allowedOverflow : 0;
        return {
            start: reverse ? max : min,
            end: reverse ? min : max
        };
    }
    function defaultClip(xScale, yScale, allowedOverflow) {
        if (allowedOverflow === false) {
            return false;
        }
        const x = scaleClip(xScale, allowedOverflow);
        const y = scaleClip(yScale, allowedOverflow);
        return {
            top: y.end,
            right: x.end,
            bottom: y.start,
            left: x.start
        };
    }
    function toClip(value) {
        let t, r, b, l;
        if (isObject(value)) {
            t = value.top;
            r = value.right;
            b = value.bottom;
            l = value.left;
        } else {
            t = r = b = l = value;
        }
        return {
            top: t,
            right: r,
            bottom: b,
            left: l,
            disabled: value === false
        };
    }
    function getSortedDatasetIndices(chart, filterVisible) {
        const keys = [];
        const metasets = chart._getSortedDatasetMetas(filterVisible);
        let i, ilen;
        for(i = 0, ilen = metasets.length; i < ilen; ++i){
            keys.push(metasets[i].index);
        }
        return keys;
    }
    function applyStack(stack, value, dsIndex, options = {}) {
        const keys = stack.keys;
        const singleMode = options.mode === 'single';
        let i, ilen, datasetIndex, otherValue;
        if (value === null) {
            return;
        }
        let found = false;
        for(i = 0, ilen = keys.length; i < ilen; ++i){
            datasetIndex = +keys[i];
            if (datasetIndex === dsIndex) {
                found = true;
                if (options.all) {
                    continue;
                }
                break;
            }
            otherValue = stack.values[datasetIndex];
            if (isNumberFinite(otherValue) && (singleMode || value === 0 || sign(value) === sign(otherValue))) {
                value += otherValue;
            }
        }
        if (!found && !options.all) {
            return 0;
        }
        return value;
    }
    function convertObjectDataToArray(data, meta) {
        const { iScale , vScale  } = meta;
        const iAxisKey = iScale.axis === 'x' ? 'x' : 'y';
        const vAxisKey = vScale.axis === 'x' ? 'x' : 'y';
        const keys = Object.keys(data);
        const adata = new Array(keys.length);
        let i, ilen, key;
        for(i = 0, ilen = keys.length; i < ilen; ++i){
            key = keys[i];
            adata[i] = {
                [iAxisKey]: key,
                [vAxisKey]: data[key]
            };
        }
        return adata;
    }
    function isStacked(scale, meta) {
        const stacked = scale && scale.options.stacked;
        return stacked || stacked === undefined && meta.stack !== undefined;
    }
    function getStackKey(indexScale, valueScale, meta) {
        return `${indexScale.id}.${valueScale.id}.${meta.stack || meta.type}`;
    }
    function getUserBounds(scale) {
        const { min , max , minDefined , maxDefined  } = scale.getUserBounds();
        return {
            min: minDefined ? min : Number.NEGATIVE_INFINITY,
            max: maxDefined ? max : Number.POSITIVE_INFINITY
        };
    }
    function getOrCreateStack(stacks, stackKey, indexValue) {
        const subStack = stacks[stackKey] || (stacks[stackKey] = {});
        return subStack[indexValue] || (subStack[indexValue] = {});
    }
    function getLastIndexInStack(stack, vScale, positive, type) {
        for (const meta of vScale.getMatchingVisibleMetas(type).reverse()){
            const value = stack[meta.index];
            if (positive && value > 0 || !positive && value < 0) {
                return meta.index;
            }
        }
        return null;
    }
    function updateStacks(controller, parsed) {
        const { chart , _cachedMeta: meta  } = controller;
        const stacks = chart._stacks || (chart._stacks = {});
        const { iScale , vScale , index: datasetIndex  } = meta;
        const iAxis = iScale.axis;
        const vAxis = vScale.axis;
        const key = getStackKey(iScale, vScale, meta);
        const ilen = parsed.length;
        let stack;
        for(let i = 0; i < ilen; ++i){
            const item = parsed[i];
            const { [iAxis]: index , [vAxis]: value  } = item;
            const itemStacks = item._stacks || (item._stacks = {});
            stack = itemStacks[vAxis] = getOrCreateStack(stacks, key, index);
            stack[datasetIndex] = value;
            stack._top = getLastIndexInStack(stack, vScale, true, meta.type);
            stack._bottom = getLastIndexInStack(stack, vScale, false, meta.type);
            const visualValues = stack._visualValues || (stack._visualValues = {});
            visualValues[datasetIndex] = value;
        }
    }
    function getFirstScaleId(chart, axis) {
        const scales = chart.scales;
        return Object.keys(scales).filter((key)=>scales[key].axis === axis).shift();
    }
    function createDatasetContext(parent, index) {
        return createContext(parent, {
            active: false,
            dataset: undefined,
            datasetIndex: index,
            index,
            mode: 'default',
            type: 'dataset'
        });
    }
    function createDataContext(parent, index, element) {
        return createContext(parent, {
            active: false,
            dataIndex: index,
            parsed: undefined,
            raw: undefined,
            element,
            index,
            mode: 'default',
            type: 'data'
        });
    }
    function clearStacks(meta, items) {
        const datasetIndex = meta.controller.index;
        const axis = meta.vScale && meta.vScale.axis;
        if (!axis) {
            return;
        }
        items = items || meta._parsed;
        for (const parsed of items){
            const stacks = parsed._stacks;
            if (!stacks || stacks[axis] === undefined || stacks[axis][datasetIndex] === undefined) {
                return;
            }
            delete stacks[axis][datasetIndex];
            if (stacks[axis]._visualValues !== undefined && stacks[axis]._visualValues[datasetIndex] !== undefined) {
                delete stacks[axis]._visualValues[datasetIndex];
            }
        }
    }
    const isDirectUpdateMode = (mode)=>mode === 'reset' || mode === 'none';
    const cloneIfNotShared = (cached, shared)=>shared ? cached : Object.assign({}, cached);
    const createStack = (canStack, meta, chart)=>canStack && !meta.hidden && meta._stacked && {
            keys: getSortedDatasetIndices(chart, true),
            values: null
        };
    class DatasetController {
     static defaults = {};
     static datasetElementType = null;
     static dataElementType = null;
     constructor(chart, datasetIndex){
            this.chart = chart;
            this._ctx = chart.ctx;
            this.index = datasetIndex;
            this._cachedDataOpts = {};
            this._cachedMeta = this.getMeta();
            this._type = this._cachedMeta.type;
            this.options = undefined;
             this._parsing = false;
            this._data = undefined;
            this._objectData = undefined;
            this._sharedOptions = undefined;
            this._drawStart = undefined;
            this._drawCount = undefined;
            this.enableOptionSharing = false;
            this.supportsDecimation = false;
            this.$context = undefined;
            this._syncList = [];
            this.datasetElementType = new.target.datasetElementType;
            this.dataElementType = new.target.dataElementType;
            this.initialize();
        }
        initialize() {
            const meta = this._cachedMeta;
            this.configure();
            this.linkScales();
            meta._stacked = isStacked(meta.vScale, meta);
            this.addElements();
            if (this.options.fill && !this.chart.isPluginEnabled('filler')) {
                console.warn("Tried to use the 'fill' option without the 'Filler' plugin enabled. Please import and register the 'Filler' plugin and make sure it is not disabled in the options");
            }
        }
        updateIndex(datasetIndex) {
            if (this.index !== datasetIndex) {
                clearStacks(this._cachedMeta);
            }
            this.index = datasetIndex;
        }
        linkScales() {
            const chart = this.chart;
            const meta = this._cachedMeta;
            const dataset = this.getDataset();
            const chooseId = (axis, x, y, r)=>axis === 'x' ? x : axis === 'r' ? r : y;
            const xid = meta.xAxisID = valueOrDefault(dataset.xAxisID, getFirstScaleId(chart, 'x'));
            const yid = meta.yAxisID = valueOrDefault(dataset.yAxisID, getFirstScaleId(chart, 'y'));
            const rid = meta.rAxisID = valueOrDefault(dataset.rAxisID, getFirstScaleId(chart, 'r'));
            const indexAxis = meta.indexAxis;
            const iid = meta.iAxisID = chooseId(indexAxis, xid, yid, rid);
            const vid = meta.vAxisID = chooseId(indexAxis, yid, xid, rid);
            meta.xScale = this.getScaleForId(xid);
            meta.yScale = this.getScaleForId(yid);
            meta.rScale = this.getScaleForId(rid);
            meta.iScale = this.getScaleForId(iid);
            meta.vScale = this.getScaleForId(vid);
        }
        getDataset() {
            return this.chart.data.datasets[this.index];
        }
        getMeta() {
            return this.chart.getDatasetMeta(this.index);
        }
     getScaleForId(scaleID) {
            return this.chart.scales[scaleID];
        }
     _getOtherScale(scale) {
            const meta = this._cachedMeta;
            return scale === meta.iScale ? meta.vScale : meta.iScale;
        }
        reset() {
            this._update('reset');
        }
     _destroy() {
            const meta = this._cachedMeta;
            if (this._data) {
                unlistenArrayEvents(this._data, this);
            }
            if (meta._stacked) {
                clearStacks(meta);
            }
        }
     _dataCheck() {
            const dataset = this.getDataset();
            const data = dataset.data || (dataset.data = []);
            const _data = this._data;
            if (isObject(data)) {
                const meta = this._cachedMeta;
                this._data = convertObjectDataToArray(data, meta);
            } else if (_data !== data) {
                if (_data) {
                    unlistenArrayEvents(_data, this);
                    const meta = this._cachedMeta;
                    clearStacks(meta);
                    meta._parsed = [];
                }
                if (data && Object.isExtensible(data)) {
                    listenArrayEvents(data, this);
                }
                this._syncList = [];
                this._data = data;
            }
        }
        addElements() {
            const meta = this._cachedMeta;
            this._dataCheck();
            if (this.datasetElementType) {
                meta.dataset = new this.datasetElementType();
            }
        }
        buildOrUpdateElements(resetNewElements) {
            const meta = this._cachedMeta;
            const dataset = this.getDataset();
            let stackChanged = false;
            this._dataCheck();
            const oldStacked = meta._stacked;
            meta._stacked = isStacked(meta.vScale, meta);
            if (meta.stack !== dataset.stack) {
                stackChanged = true;
                clearStacks(meta);
                meta.stack = dataset.stack;
            }
            this._resyncElements(resetNewElements);
            if (stackChanged || oldStacked !== meta._stacked) {
                updateStacks(this, meta._parsed);
                meta._stacked = isStacked(meta.vScale, meta);
            }
        }
     configure() {
            const config = this.chart.config;
            const scopeKeys = config.datasetScopeKeys(this._type);
            const scopes = config.getOptionScopes(this.getDataset(), scopeKeys, true);
            this.options = config.createResolver(scopes, this.getContext());
            this._parsing = this.options.parsing;
            this._cachedDataOpts = {};
        }
     parse(start, count) {
            const { _cachedMeta: meta , _data: data  } = this;
            const { iScale , _stacked  } = meta;
            const iAxis = iScale.axis;
            let sorted = start === 0 && count === data.length ? true : meta._sorted;
            let prev = start > 0 && meta._parsed[start - 1];
            let i, cur, parsed;
            if (this._parsing === false) {
                meta._parsed = data;
                meta._sorted = true;
                parsed = data;
            } else {
                if (isArray(data[start])) {
                    parsed = this.parseArrayData(meta, data, start, count);
                } else if (isObject(data[start])) {
                    parsed = this.parseObjectData(meta, data, start, count);
                } else {
                    parsed = this.parsePrimitiveData(meta, data, start, count);
                }
                const isNotInOrderComparedToPrev = ()=>cur[iAxis] === null || prev && cur[iAxis] < prev[iAxis];
                for(i = 0; i < count; ++i){
                    meta._parsed[i + start] = cur = parsed[i];
                    if (sorted) {
                        if (isNotInOrderComparedToPrev()) {
                            sorted = false;
                        }
                        prev = cur;
                    }
                }
                meta._sorted = sorted;
            }
            if (_stacked) {
                updateStacks(this, parsed);
            }
        }
     parsePrimitiveData(meta, data, start, count) {
            const { iScale , vScale  } = meta;
            const iAxis = iScale.axis;
            const vAxis = vScale.axis;
            const labels = iScale.getLabels();
            const singleScale = iScale === vScale;
            const parsed = new Array(count);
            let i, ilen, index;
            for(i = 0, ilen = count; i < ilen; ++i){
                index = i + start;
                parsed[i] = {
                    [iAxis]: singleScale || iScale.parse(labels[index], index),
                    [vAxis]: vScale.parse(data[index], index)
                };
            }
            return parsed;
        }
     parseArrayData(meta, data, start, count) {
            const { xScale , yScale  } = meta;
            const parsed = new Array(count);
            let i, ilen, index, item;
            for(i = 0, ilen = count; i < ilen; ++i){
                index = i + start;
                item = data[index];
                parsed[i] = {
                    x: xScale.parse(item[0], index),
                    y: yScale.parse(item[1], index)
                };
            }
            return parsed;
        }
     parseObjectData(meta, data, start, count) {
            const { xScale , yScale  } = meta;
            const { xAxisKey ='x' , yAxisKey ='y'  } = this._parsing;
            const parsed = new Array(count);
            let i, ilen, index, item;
            for(i = 0, ilen = count; i < ilen; ++i){
                index = i + start;
                item = data[index];
                parsed[i] = {
                    x: xScale.parse(resolveObjectKey(item, xAxisKey), index),
                    y: yScale.parse(resolveObjectKey(item, yAxisKey), index)
                };
            }
            return parsed;
        }
     getParsed(index) {
            return this._cachedMeta._parsed[index];
        }
     getDataElement(index) {
            return this._cachedMeta.data[index];
        }
     applyStack(scale, parsed, mode) {
            const chart = this.chart;
            const meta = this._cachedMeta;
            const value = parsed[scale.axis];
            const stack = {
                keys: getSortedDatasetIndices(chart, true),
                values: parsed._stacks[scale.axis]._visualValues
            };
            return applyStack(stack, value, meta.index, {
                mode
            });
        }
     updateRangeFromParsed(range, scale, parsed, stack) {
            const parsedValue = parsed[scale.axis];
            let value = parsedValue === null ? NaN : parsedValue;
            const values = stack && parsed._stacks[scale.axis];
            if (stack && values) {
                stack.values = values;
                value = applyStack(stack, parsedValue, this._cachedMeta.index);
            }
            range.min = Math.min(range.min, value);
            range.max = Math.max(range.max, value);
        }
     getMinMax(scale, canStack) {
            const meta = this._cachedMeta;
            const _parsed = meta._parsed;
            const sorted = meta._sorted && scale === meta.iScale;
            const ilen = _parsed.length;
            const otherScale = this._getOtherScale(scale);
            const stack = createStack(canStack, meta, this.chart);
            const range = {
                min: Number.POSITIVE_INFINITY,
                max: Number.NEGATIVE_INFINITY
            };
            const { min: otherMin , max: otherMax  } = getUserBounds(otherScale);
            let i, parsed;
            function _skip() {
                parsed = _parsed[i];
                const otherValue = parsed[otherScale.axis];
                return !isNumberFinite(parsed[scale.axis]) || otherMin > otherValue || otherMax < otherValue;
            }
            for(i = 0; i < ilen; ++i){
                if (_skip()) {
                    continue;
                }
                this.updateRangeFromParsed(range, scale, parsed, stack);
                if (sorted) {
                    break;
                }
            }
            if (sorted) {
                for(i = ilen - 1; i >= 0; --i){
                    if (_skip()) {
                        continue;
                    }
                    this.updateRangeFromParsed(range, scale, parsed, stack);
                    break;
                }
            }
            return range;
        }
        getAllParsedValues(scale) {
            const parsed = this._cachedMeta._parsed;
            const values = [];
            let i, ilen, value;
            for(i = 0, ilen = parsed.length; i < ilen; ++i){
                value = parsed[i][scale.axis];
                if (isNumberFinite(value)) {
                    values.push(value);
                }
            }
            return values;
        }
     getMaxOverflow() {
            return false;
        }
     getLabelAndValue(index) {
            const meta = this._cachedMeta;
            const iScale = meta.iScale;
            const vScale = meta.vScale;
            const parsed = this.getParsed(index);
            return {
                label: iScale ? '' + iScale.getLabelForValue(parsed[iScale.axis]) : '',
                value: vScale ? '' + vScale.getLabelForValue(parsed[vScale.axis]) : ''
            };
        }
     _update(mode) {
            const meta = this._cachedMeta;
            this.update(mode || 'default');
            meta._clip = toClip(valueOrDefault(this.options.clip, defaultClip(meta.xScale, meta.yScale, this.getMaxOverflow())));
        }
     update(mode) {}
        draw() {
            const ctx = this._ctx;
            const chart = this.chart;
            const meta = this._cachedMeta;
            const elements = meta.data || [];
            const area = chart.chartArea;
            const active = [];
            const start = this._drawStart || 0;
            const count = this._drawCount || elements.length - start;
            const drawActiveElementsOnTop = this.options.drawActiveElementsOnTop;
            let i;
            if (meta.dataset) {
                meta.dataset.draw(ctx, area, start, count);
            }
            for(i = start; i < start + count; ++i){
                const element = elements[i];
                if (element.hidden) {
                    continue;
                }
                if (element.active && drawActiveElementsOnTop) {
                    active.push(element);
                } else {
                    element.draw(ctx, area);
                }
            }
            for(i = 0; i < active.length; ++i){
                active[i].draw(ctx, area);
            }
        }
     getStyle(index, active) {
            const mode = active ? 'active' : 'default';
            return index === undefined && this._cachedMeta.dataset ? this.resolveDatasetElementOptions(mode) : this.resolveDataElementOptions(index || 0, mode);
        }
     getContext(index, active, mode) {
            const dataset = this.getDataset();
            let context;
            if (index >= 0 && index < this._cachedMeta.data.length) {
                const element = this._cachedMeta.data[index];
                context = element.$context || (element.$context = createDataContext(this.getContext(), index, element));
                context.parsed = this.getParsed(index);
                context.raw = dataset.data[index];
                context.index = context.dataIndex = index;
            } else {
                context = this.$context || (this.$context = createDatasetContext(this.chart.getContext(), this.index));
                context.dataset = dataset;
                context.index = context.datasetIndex = this.index;
            }
            context.active = !!active;
            context.mode = mode;
            return context;
        }
     resolveDatasetElementOptions(mode) {
            return this._resolveElementOptions(this.datasetElementType.id, mode);
        }
     resolveDataElementOptions(index, mode) {
            return this._resolveElementOptions(this.dataElementType.id, mode, index);
        }
     _resolveElementOptions(elementType, mode = 'default', index) {
            const active = mode === 'active';
            const cache = this._cachedDataOpts;
            const cacheKey = elementType + '-' + mode;
            const cached = cache[cacheKey];
            const sharing = this.enableOptionSharing && defined(index);
            if (cached) {
                return cloneIfNotShared(cached, sharing);
            }
            const config = this.chart.config;
            const scopeKeys = config.datasetElementScopeKeys(this._type, elementType);
            const prefixes = active ? [
                `${elementType}Hover`,
                'hover',
                elementType,
                ''
            ] : [
                elementType,
                ''
            ];
            const scopes = config.getOptionScopes(this.getDataset(), scopeKeys);
            const names = Object.keys(defaults.elements[elementType]);
            const context = ()=>this.getContext(index, active, mode);
            const values = config.resolveNamedOptions(scopes, names, context, prefixes);
            if (values.$shared) {
                values.$shared = sharing;
                cache[cacheKey] = Object.freeze(cloneIfNotShared(values, sharing));
            }
            return values;
        }
     _resolveAnimations(index, transition, active) {
            const chart = this.chart;
            const cache = this._cachedDataOpts;
            const cacheKey = `animation-${transition}`;
            const cached = cache[cacheKey];
            if (cached) {
                return cached;
            }
            let options;
            if (chart.options.animation !== false) {
                const config = this.chart.config;
                const scopeKeys = config.datasetAnimationScopeKeys(this._type, transition);
                const scopes = config.getOptionScopes(this.getDataset(), scopeKeys);
                options = config.createResolver(scopes, this.getContext(index, active, transition));
            }
            const animations = new Animations(chart, options && options.animations);
            if (options && options._cacheable) {
                cache[cacheKey] = Object.freeze(animations);
            }
            return animations;
        }
     getSharedOptions(options) {
            if (!options.$shared) {
                return;
            }
            return this._sharedOptions || (this._sharedOptions = Object.assign({}, options));
        }
     includeOptions(mode, sharedOptions) {
            return !sharedOptions || isDirectUpdateMode(mode) || this.chart._animationsDisabled;
        }
     _getSharedOptions(start, mode) {
            const firstOpts = this.resolveDataElementOptions(start, mode);
            const previouslySharedOptions = this._sharedOptions;
            const sharedOptions = this.getSharedOptions(firstOpts);
            const includeOptions = this.includeOptions(mode, sharedOptions) || sharedOptions !== previouslySharedOptions;
            this.updateSharedOptions(sharedOptions, mode, firstOpts);
            return {
                sharedOptions,
                includeOptions
            };
        }
     updateElement(element, index, properties, mode) {
            if (isDirectUpdateMode(mode)) {
                Object.assign(element, properties);
            } else {
                this._resolveAnimations(index, mode).update(element, properties);
            }
        }
     updateSharedOptions(sharedOptions, mode, newOptions) {
            if (sharedOptions && !isDirectUpdateMode(mode)) {
                this._resolveAnimations(undefined, mode).update(sharedOptions, newOptions);
            }
        }
     _setStyle(element, index, mode, active) {
            element.active = active;
            const options = this.getStyle(index, active);
            this._resolveAnimations(index, mode, active).update(element, {
                options: !active && this.getSharedOptions(options) || options
            });
        }
        removeHoverStyle(element, datasetIndex, index) {
            this._setStyle(element, index, 'active', false);
        }
        setHoverStyle(element, datasetIndex, index) {
            this._setStyle(element, index, 'active', true);
        }
     _removeDatasetHoverStyle() {
            const element = this._cachedMeta.dataset;
            if (element) {
                this._setStyle(element, undefined, 'active', false);
            }
        }
     _setDatasetHoverStyle() {
            const element = this._cachedMeta.dataset;
            if (element) {
                this._setStyle(element, undefined, 'active', true);
            }
        }
     _resyncElements(resetNewElements) {
            const data = this._data;
            const elements = this._cachedMeta.data;
            for (const [method, arg1, arg2] of this._syncList){
                this[method](arg1, arg2);
            }
            this._syncList = [];
            const numMeta = elements.length;
            const numData = data.length;
            const count = Math.min(numData, numMeta);
            if (count) {
                this.parse(0, count);
            }
            if (numData > numMeta) {
                this._insertElements(numMeta, numData - numMeta, resetNewElements);
            } else if (numData < numMeta) {
                this._removeElements(numData, numMeta - numData);
            }
        }
     _insertElements(start, count, resetNewElements = true) {
            const meta = this._cachedMeta;
            const data = meta.data;
            const end = start + count;
            let i;
            const move = (arr)=>{
                arr.length += count;
                for(i = arr.length - 1; i >= end; i--){
                    arr[i] = arr[i - count];
                }
            };
            move(data);
            for(i = start; i < end; ++i){
                data[i] = new this.dataElementType();
            }
            if (this._parsing) {
                move(meta._parsed);
            }
            this.parse(start, count);
            if (resetNewElements) {
                this.updateElements(data, start, count, 'reset');
            }
        }
        updateElements(element, start, count, mode) {}
     _removeElements(start, count) {
            const meta = this._cachedMeta;
            if (this._parsing) {
                const removed = meta._parsed.splice(start, count);
                if (meta._stacked) {
                    clearStacks(meta, removed);
                }
            }
            meta.data.splice(start, count);
        }
     _sync(args) {
            if (this._parsing) {
                this._syncList.push(args);
            } else {
                const [method, arg1, arg2] = args;
                this[method](arg1, arg2);
            }
            this.chart._dataChanges.push([
                this.index,
                ...args
            ]);
        }
        _onDataPush() {
            const count = arguments.length;
            this._sync([
                '_insertElements',
                this.getDataset().data.length - count,
                count
            ]);
        }
        _onDataPop() {
            this._sync([
                '_removeElements',
                this._cachedMeta.data.length - 1,
                1
            ]);
        }
        _onDataShift() {
            this._sync([
                '_removeElements',
                0,
                1
            ]);
        }
        _onDataSplice(start, count) {
            if (count) {
                this._sync([
                    '_removeElements',
                    start,
                    count
                ]);
            }
            const newCount = arguments.length - 2;
            if (newCount) {
                this._sync([
                    '_insertElements',
                    start,
                    newCount
                ]);
            }
        }
        _onDataUnshift() {
            this._sync([
                '_insertElements',
                0,
                arguments.length
            ]);
        }
    }

    function getRatioAndOffset(rotation, circumference, cutout) {
        let ratioX = 1;
        let ratioY = 1;
        let offsetX = 0;
        let offsetY = 0;
        if (circumference < TAU) {
            const startAngle = rotation;
            const endAngle = startAngle + circumference;
            const startX = Math.cos(startAngle);
            const startY = Math.sin(startAngle);
            const endX = Math.cos(endAngle);
            const endY = Math.sin(endAngle);
            const calcMax = (angle, a, b)=>_angleBetween(angle, startAngle, endAngle, true) ? 1 : Math.max(a, a * cutout, b, b * cutout);
            const calcMin = (angle, a, b)=>_angleBetween(angle, startAngle, endAngle, true) ? -1 : Math.min(a, a * cutout, b, b * cutout);
            const maxX = calcMax(0, startX, endX);
            const maxY = calcMax(HALF_PI, startY, endY);
            const minX = calcMin(PI, startX, endX);
            const minY = calcMin(PI + HALF_PI, startY, endY);
            ratioX = (maxX - minX) / 2;
            ratioY = (maxY - minY) / 2;
            offsetX = -(maxX + minX) / 2;
            offsetY = -(maxY + minY) / 2;
        }
        return {
            ratioX,
            ratioY,
            offsetX,
            offsetY
        };
    }
    class DoughnutController extends DatasetController {
        static id = 'doughnut';
     static defaults = {
            datasetElementType: false,
            dataElementType: 'arc',
            animation: {
                animateRotate: true,
                animateScale: false
            },
            animations: {
                numbers: {
                    type: 'number',
                    properties: [
                        'circumference',
                        'endAngle',
                        'innerRadius',
                        'outerRadius',
                        'startAngle',
                        'x',
                        'y',
                        'offset',
                        'borderWidth',
                        'spacing'
                    ]
                }
            },
            cutout: '50%',
            rotation: 0,
            circumference: 360,
            radius: '100%',
            spacing: 0,
            indexAxis: 'r'
        };
        static descriptors = {
            _scriptable: (name)=>name !== 'spacing',
            _indexable: (name)=>name !== 'spacing' && !name.startsWith('borderDash') && !name.startsWith('hoverBorderDash')
        };
     static overrides = {
            aspectRatio: 1,
            plugins: {
                legend: {
                    labels: {
                        generateLabels (chart) {
                            const data = chart.data;
                            const { labels: { pointStyle , textAlign , color , useBorderRadius , borderRadius  }  } = chart.legend.options;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i)=>{
                                    const meta = chart.getDatasetMeta(0);
                                    const style = meta.controller.getStyle(i);
                                    return {
                                        text: label,
                                        fillStyle: style.backgroundColor,
                                        fontColor: color,
                                        hidden: !chart.getDataVisibility(i),
                                        lineDash: style.borderDash,
                                        lineDashOffset: style.borderDashOffset,
                                        lineJoin: style.borderJoinStyle,
                                        lineWidth: style.borderWidth,
                                        strokeStyle: style.borderColor,
                                        textAlign: textAlign,
                                        pointStyle: pointStyle,
                                        borderRadius: useBorderRadius && (borderRadius || style.borderRadius),
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    },
                    onClick (e, legendItem, legend) {
                        legend.chart.toggleDataVisibility(legendItem.index);
                        legend.chart.update();
                    }
                }
            }
        };
        constructor(chart, datasetIndex){
            super(chart, datasetIndex);
            this.enableOptionSharing = true;
            this.innerRadius = undefined;
            this.outerRadius = undefined;
            this.offsetX = undefined;
            this.offsetY = undefined;
        }
        linkScales() {}
     parse(start, count) {
            const data = this.getDataset().data;
            const meta = this._cachedMeta;
            if (this._parsing === false) {
                meta._parsed = data;
            } else {
                let getter = (i)=>+data[i];
                if (isObject(data[start])) {
                    const { key ='value'  } = this._parsing;
                    getter = (i)=>+resolveObjectKey(data[i], key);
                }
                let i, ilen;
                for(i = start, ilen = start + count; i < ilen; ++i){
                    meta._parsed[i] = getter(i);
                }
            }
        }
     _getRotation() {
            return toRadians(this.options.rotation - 90);
        }
     _getCircumference() {
            return toRadians(this.options.circumference);
        }
     _getRotationExtents() {
            let min = TAU;
            let max = -TAU;
            for(let i = 0; i < this.chart.data.datasets.length; ++i){
                if (this.chart.isDatasetVisible(i) && this.chart.getDatasetMeta(i).type === this._type) {
                    const controller = this.chart.getDatasetMeta(i).controller;
                    const rotation = controller._getRotation();
                    const circumference = controller._getCircumference();
                    min = Math.min(min, rotation);
                    max = Math.max(max, rotation + circumference);
                }
            }
            return {
                rotation: min,
                circumference: max - min
            };
        }
     update(mode) {
            const chart = this.chart;
            const { chartArea  } = chart;
            const meta = this._cachedMeta;
            const arcs = meta.data;
            const spacing = this.getMaxBorderWidth() + this.getMaxOffset(arcs) + this.options.spacing;
            const maxSize = Math.max((Math.min(chartArea.width, chartArea.height) - spacing) / 2, 0);
            const cutout = Math.min(toPercentage(this.options.cutout, maxSize), 1);
            const chartWeight = this._getRingWeight(this.index);
            const { circumference , rotation  } = this._getRotationExtents();
            const { ratioX , ratioY , offsetX , offsetY  } = getRatioAndOffset(rotation, circumference, cutout);
            const maxWidth = (chartArea.width - spacing) / ratioX;
            const maxHeight = (chartArea.height - spacing) / ratioY;
            const maxRadius = Math.max(Math.min(maxWidth, maxHeight) / 2, 0);
            const outerRadius = toDimension(this.options.radius, maxRadius);
            const innerRadius = Math.max(outerRadius * cutout, 0);
            const radiusLength = (outerRadius - innerRadius) / this._getVisibleDatasetWeightTotal();
            this.offsetX = offsetX * outerRadius;
            this.offsetY = offsetY * outerRadius;
            meta.total = this.calculateTotal();
            this.outerRadius = outerRadius - radiusLength * this._getRingWeightOffset(this.index);
            this.innerRadius = Math.max(this.outerRadius - radiusLength * chartWeight, 0);
            this.updateElements(arcs, 0, arcs.length, mode);
        }
     _circumference(i, reset) {
            const opts = this.options;
            const meta = this._cachedMeta;
            const circumference = this._getCircumference();
            if (reset && opts.animation.animateRotate || !this.chart.getDataVisibility(i) || meta._parsed[i] === null || meta.data[i].hidden) {
                return 0;
            }
            return this.calculateCircumference(meta._parsed[i] * circumference / TAU);
        }
        updateElements(arcs, start, count, mode) {
            const reset = mode === 'reset';
            const chart = this.chart;
            const chartArea = chart.chartArea;
            const opts = chart.options;
            const animationOpts = opts.animation;
            const centerX = (chartArea.left + chartArea.right) / 2;
            const centerY = (chartArea.top + chartArea.bottom) / 2;
            const animateScale = reset && animationOpts.animateScale;
            const innerRadius = animateScale ? 0 : this.innerRadius;
            const outerRadius = animateScale ? 0 : this.outerRadius;
            const { sharedOptions , includeOptions  } = this._getSharedOptions(start, mode);
            let startAngle = this._getRotation();
            let i;
            for(i = 0; i < start; ++i){
                startAngle += this._circumference(i, reset);
            }
            for(i = start; i < start + count; ++i){
                const circumference = this._circumference(i, reset);
                const arc = arcs[i];
                const properties = {
                    x: centerX + this.offsetX,
                    y: centerY + this.offsetY,
                    startAngle,
                    endAngle: startAngle + circumference,
                    circumference,
                    outerRadius,
                    innerRadius
                };
                if (includeOptions) {
                    properties.options = sharedOptions || this.resolveDataElementOptions(i, arc.active ? 'active' : mode);
                }
                startAngle += circumference;
                this.updateElement(arc, i, properties, mode);
            }
        }
        calculateTotal() {
            const meta = this._cachedMeta;
            const metaData = meta.data;
            let total = 0;
            let i;
            for(i = 0; i < metaData.length; i++){
                const value = meta._parsed[i];
                if (value !== null && !isNaN(value) && this.chart.getDataVisibility(i) && !metaData[i].hidden) {
                    total += Math.abs(value);
                }
            }
            return total;
        }
        calculateCircumference(value) {
            const total = this._cachedMeta.total;
            if (total > 0 && !isNaN(value)) {
                return TAU * (Math.abs(value) / total);
            }
            return 0;
        }
        getLabelAndValue(index) {
            const meta = this._cachedMeta;
            const chart = this.chart;
            const labels = chart.data.labels || [];
            const value = formatNumber(meta._parsed[index], chart.options.locale);
            return {
                label: labels[index] || '',
                value
            };
        }
        getMaxBorderWidth(arcs) {
            let max = 0;
            const chart = this.chart;
            let i, ilen, meta, controller, options;
            if (!arcs) {
                for(i = 0, ilen = chart.data.datasets.length; i < ilen; ++i){
                    if (chart.isDatasetVisible(i)) {
                        meta = chart.getDatasetMeta(i);
                        arcs = meta.data;
                        controller = meta.controller;
                        break;
                    }
                }
            }
            if (!arcs) {
                return 0;
            }
            for(i = 0, ilen = arcs.length; i < ilen; ++i){
                options = controller.resolveDataElementOptions(i);
                if (options.borderAlign !== 'inner') {
                    max = Math.max(max, options.borderWidth || 0, options.hoverBorderWidth || 0);
                }
            }
            return max;
        }
        getMaxOffset(arcs) {
            let max = 0;
            for(let i = 0, ilen = arcs.length; i < ilen; ++i){
                const options = this.resolveDataElementOptions(i);
                max = Math.max(max, options.offset || 0, options.hoverOffset || 0);
            }
            return max;
        }
     _getRingWeightOffset(datasetIndex) {
            let ringWeightOffset = 0;
            for(let i = 0; i < datasetIndex; ++i){
                if (this.chart.isDatasetVisible(i)) {
                    ringWeightOffset += this._getRingWeight(i);
                }
            }
            return ringWeightOffset;
        }
     _getRingWeight(datasetIndex) {
            return Math.max(valueOrDefault(this.chart.data.datasets[datasetIndex].weight, 1), 0);
        }
     _getVisibleDatasetWeightTotal() {
            return this._getRingWeightOffset(this.chart.data.datasets.length) || 1;
        }
    }

    /**
     * @namespace Chart._adapters
     * @since 2.8.0
     * @private
     */ function abstract() {
        throw new Error('This method is not implemented: Check that a complete date adapter is provided.');
    }
    /**
     * Date adapter (current used by the time scale)
     * @namespace Chart._adapters._date
     * @memberof Chart._adapters
     * @private
     */ class DateAdapterBase {
        /**
       * Override default date adapter methods.
       * Accepts type parameter to define options type.
       * @example
       * Chart._adapters._date.override<{myAdapterOption: string}>({
       *   init() {
       *     console.log(this.options.myAdapterOption);
       *   }
       * })
       */ static override(members) {
            Object.assign(DateAdapterBase.prototype, members);
        }
        options;
        constructor(options){
            this.options = options || {};
        }
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        init() {}
        formats() {
            return abstract();
        }
        parse() {
            return abstract();
        }
        format() {
            return abstract();
        }
        add() {
            return abstract();
        }
        diff() {
            return abstract();
        }
        startOf() {
            return abstract();
        }
        endOf() {
            return abstract();
        }
    }
    var adapters = {
        _date: DateAdapterBase
    };

    function binarySearch(metaset, axis, value, intersect) {
        const { controller , data , _sorted  } = metaset;
        const iScale = controller._cachedMeta.iScale;
        const spanGaps = metaset.dataset ? metaset.dataset.options ? metaset.dataset.options.spanGaps : null : null;
        if (iScale && axis === iScale.axis && axis !== 'r' && _sorted && data.length) {
            const lookupMethod = iScale._reversePixels ? _rlookupByKey : _lookupByKey;
            if (!intersect) {
                const result = lookupMethod(data, axis, value);
                if (spanGaps) {
                    const { vScale  } = controller._cachedMeta;
                    const { _parsed  } = metaset;
                    const distanceToDefinedLo = _parsed.slice(0, result.lo + 1).reverse().findIndex((point)=>!isNullOrUndef(point[vScale.axis]));
                    result.lo -= Math.max(0, distanceToDefinedLo);
                    const distanceToDefinedHi = _parsed.slice(result.hi).findIndex((point)=>!isNullOrUndef(point[vScale.axis]));
                    result.hi += Math.max(0, distanceToDefinedHi);
                }
                return result;
            } else if (controller._sharedOptions) {
                const el = data[0];
                const range = typeof el.getRange === 'function' && el.getRange(axis);
                if (range) {
                    const start = lookupMethod(data, axis, value - range);
                    const end = lookupMethod(data, axis, value + range);
                    return {
                        lo: start.lo,
                        hi: end.hi
                    };
                }
            }
        }
        return {
            lo: 0,
            hi: data.length - 1
        };
    }
     function evaluateInteractionItems(chart, axis, position, handler, intersect) {
        const metasets = chart.getSortedVisibleDatasetMetas();
        const value = position[axis];
        for(let i = 0, ilen = metasets.length; i < ilen; ++i){
            const { index , data  } = metasets[i];
            const { lo , hi  } = binarySearch(metasets[i], axis, value, intersect);
            for(let j = lo; j <= hi; ++j){
                const element = data[j];
                if (!element.skip) {
                    handler(element, index, j);
                }
            }
        }
    }
     function getDistanceMetricForAxis(axis) {
        const useX = axis.indexOf('x') !== -1;
        const useY = axis.indexOf('y') !== -1;
        return function(pt1, pt2) {
            const deltaX = useX ? Math.abs(pt1.x - pt2.x) : 0;
            const deltaY = useY ? Math.abs(pt1.y - pt2.y) : 0;
            return Math.sqrt(Math.pow(deltaX, 2) + Math.pow(deltaY, 2));
        };
    }
     function getIntersectItems(chart, position, axis, useFinalPosition, includeInvisible) {
        const items = [];
        if (!includeInvisible && !chart.isPointInArea(position)) {
            return items;
        }
        const evaluationFunc = function(element, datasetIndex, index) {
            if (!includeInvisible && !_isPointInArea(element, chart.chartArea, 0)) {
                return;
            }
            if (element.inRange(position.x, position.y, useFinalPosition)) {
                items.push({
                    element,
                    datasetIndex,
                    index
                });
            }
        };
        evaluateInteractionItems(chart, axis, position, evaluationFunc, true);
        return items;
    }
     function getNearestRadialItems(chart, position, axis, useFinalPosition) {
        let items = [];
        function evaluationFunc(element, datasetIndex, index) {
            const { startAngle , endAngle  } = element.getProps([
                'startAngle',
                'endAngle'
            ], useFinalPosition);
            const { angle  } = getAngleFromPoint(element, {
                x: position.x,
                y: position.y
            });
            if (_angleBetween(angle, startAngle, endAngle)) {
                items.push({
                    element,
                    datasetIndex,
                    index
                });
            }
        }
        evaluateInteractionItems(chart, axis, position, evaluationFunc);
        return items;
    }
     function getNearestCartesianItems(chart, position, axis, intersect, useFinalPosition, includeInvisible) {
        let items = [];
        const distanceMetric = getDistanceMetricForAxis(axis);
        let minDistance = Number.POSITIVE_INFINITY;
        function evaluationFunc(element, datasetIndex, index) {
            const inRange = element.inRange(position.x, position.y, useFinalPosition);
            if (intersect && !inRange) {
                return;
            }
            const center = element.getCenterPoint(useFinalPosition);
            const pointInArea = !!includeInvisible || chart.isPointInArea(center);
            if (!pointInArea && !inRange) {
                return;
            }
            const distance = distanceMetric(position, center);
            if (distance < minDistance) {
                items = [
                    {
                        element,
                        datasetIndex,
                        index
                    }
                ];
                minDistance = distance;
            } else if (distance === minDistance) {
                items.push({
                    element,
                    datasetIndex,
                    index
                });
            }
        }
        evaluateInteractionItems(chart, axis, position, evaluationFunc);
        return items;
    }
     function getNearestItems(chart, position, axis, intersect, useFinalPosition, includeInvisible) {
        if (!includeInvisible && !chart.isPointInArea(position)) {
            return [];
        }
        return axis === 'r' && !intersect ? getNearestRadialItems(chart, position, axis, useFinalPosition) : getNearestCartesianItems(chart, position, axis, intersect, useFinalPosition, includeInvisible);
    }
     function getAxisItems(chart, position, axis, intersect, useFinalPosition) {
        const items = [];
        const rangeMethod = axis === 'x' ? 'inXRange' : 'inYRange';
        let intersectsItem = false;
        evaluateInteractionItems(chart, axis, position, (element, datasetIndex, index)=>{
            if (element[rangeMethod] && element[rangeMethod](position[axis], useFinalPosition)) {
                items.push({
                    element,
                    datasetIndex,
                    index
                });
                intersectsItem = intersectsItem || element.inRange(position.x, position.y, useFinalPosition);
            }
        });
        if (intersect && !intersectsItem) {
            return [];
        }
        return items;
    }
     var Interaction = {
        modes: {
     index (chart, e, options, useFinalPosition) {
                const position = getRelativePosition(e, chart);
                const axis = options.axis || 'x';
                const includeInvisible = options.includeInvisible || false;
                const items = options.intersect ? getIntersectItems(chart, position, axis, useFinalPosition, includeInvisible) : getNearestItems(chart, position, axis, false, useFinalPosition, includeInvisible);
                const elements = [];
                if (!items.length) {
                    return [];
                }
                chart.getSortedVisibleDatasetMetas().forEach((meta)=>{
                    const index = items[0].index;
                    const element = meta.data[index];
                    if (element && !element.skip) {
                        elements.push({
                            element,
                            datasetIndex: meta.index,
                            index
                        });
                    }
                });
                return elements;
            },
     dataset (chart, e, options, useFinalPosition) {
                const position = getRelativePosition(e, chart);
                const axis = options.axis || 'xy';
                const includeInvisible = options.includeInvisible || false;
                let items = options.intersect ? getIntersectItems(chart, position, axis, useFinalPosition, includeInvisible) : getNearestItems(chart, position, axis, false, useFinalPosition, includeInvisible);
                if (items.length > 0) {
                    const datasetIndex = items[0].datasetIndex;
                    const data = chart.getDatasetMeta(datasetIndex).data;
                    items = [];
                    for(let i = 0; i < data.length; ++i){
                        items.push({
                            element: data[i],
                            datasetIndex,
                            index: i
                        });
                    }
                }
                return items;
            },
     point (chart, e, options, useFinalPosition) {
                const position = getRelativePosition(e, chart);
                const axis = options.axis || 'xy';
                const includeInvisible = options.includeInvisible || false;
                return getIntersectItems(chart, position, axis, useFinalPosition, includeInvisible);
            },
     nearest (chart, e, options, useFinalPosition) {
                const position = getRelativePosition(e, chart);
                const axis = options.axis || 'xy';
                const includeInvisible = options.includeInvisible || false;
                return getNearestItems(chart, position, axis, options.intersect, useFinalPosition, includeInvisible);
            },
     x (chart, e, options, useFinalPosition) {
                const position = getRelativePosition(e, chart);
                return getAxisItems(chart, position, 'x', options.intersect, useFinalPosition);
            },
     y (chart, e, options, useFinalPosition) {
                const position = getRelativePosition(e, chart);
                return getAxisItems(chart, position, 'y', options.intersect, useFinalPosition);
            }
        }
    };

    const STATIC_POSITIONS = [
        'left',
        'top',
        'right',
        'bottom'
    ];
    function filterByPosition(array, position) {
        return array.filter((v)=>v.pos === position);
    }
    function filterDynamicPositionByAxis(array, axis) {
        return array.filter((v)=>STATIC_POSITIONS.indexOf(v.pos) === -1 && v.box.axis === axis);
    }
    function sortByWeight(array, reverse) {
        return array.sort((a, b)=>{
            const v0 = reverse ? b : a;
            const v1 = reverse ? a : b;
            return v0.weight === v1.weight ? v0.index - v1.index : v0.weight - v1.weight;
        });
    }
    function wrapBoxes(boxes) {
        const layoutBoxes = [];
        let i, ilen, box, pos, stack, stackWeight;
        for(i = 0, ilen = (boxes || []).length; i < ilen; ++i){
            box = boxes[i];
            ({ position: pos , options: { stack , stackWeight =1  }  } = box);
            layoutBoxes.push({
                index: i,
                box,
                pos,
                horizontal: box.isHorizontal(),
                weight: box.weight,
                stack: stack && pos + stack,
                stackWeight
            });
        }
        return layoutBoxes;
    }
    function buildStacks(layouts) {
        const stacks = {};
        for (const wrap of layouts){
            const { stack , pos , stackWeight  } = wrap;
            if (!stack || !STATIC_POSITIONS.includes(pos)) {
                continue;
            }
            const _stack = stacks[stack] || (stacks[stack] = {
                count: 0,
                placed: 0,
                weight: 0,
                size: 0
            });
            _stack.count++;
            _stack.weight += stackWeight;
        }
        return stacks;
    }
     function setLayoutDims(layouts, params) {
        const stacks = buildStacks(layouts);
        const { vBoxMaxWidth , hBoxMaxHeight  } = params;
        let i, ilen, layout;
        for(i = 0, ilen = layouts.length; i < ilen; ++i){
            layout = layouts[i];
            const { fullSize  } = layout.box;
            const stack = stacks[layout.stack];
            const factor = stack && layout.stackWeight / stack.weight;
            if (layout.horizontal) {
                layout.width = factor ? factor * vBoxMaxWidth : fullSize && params.availableWidth;
                layout.height = hBoxMaxHeight;
            } else {
                layout.width = vBoxMaxWidth;
                layout.height = factor ? factor * hBoxMaxHeight : fullSize && params.availableHeight;
            }
        }
        return stacks;
    }
    function buildLayoutBoxes(boxes) {
        const layoutBoxes = wrapBoxes(boxes);
        const fullSize = sortByWeight(layoutBoxes.filter((wrap)=>wrap.box.fullSize), true);
        const left = sortByWeight(filterByPosition(layoutBoxes, 'left'), true);
        const right = sortByWeight(filterByPosition(layoutBoxes, 'right'));
        const top = sortByWeight(filterByPosition(layoutBoxes, 'top'), true);
        const bottom = sortByWeight(filterByPosition(layoutBoxes, 'bottom'));
        const centerHorizontal = filterDynamicPositionByAxis(layoutBoxes, 'x');
        const centerVertical = filterDynamicPositionByAxis(layoutBoxes, 'y');
        return {
            fullSize,
            leftAndTop: left.concat(top),
            rightAndBottom: right.concat(centerVertical).concat(bottom).concat(centerHorizontal),
            chartArea: filterByPosition(layoutBoxes, 'chartArea'),
            vertical: left.concat(right).concat(centerVertical),
            horizontal: top.concat(bottom).concat(centerHorizontal)
        };
    }
    function getCombinedMax(maxPadding, chartArea, a, b) {
        return Math.max(maxPadding[a], chartArea[a]) + Math.max(maxPadding[b], chartArea[b]);
    }
    function updateMaxPadding(maxPadding, boxPadding) {
        maxPadding.top = Math.max(maxPadding.top, boxPadding.top);
        maxPadding.left = Math.max(maxPadding.left, boxPadding.left);
        maxPadding.bottom = Math.max(maxPadding.bottom, boxPadding.bottom);
        maxPadding.right = Math.max(maxPadding.right, boxPadding.right);
    }
    function updateDims(chartArea, params, layout, stacks) {
        const { pos , box  } = layout;
        const maxPadding = chartArea.maxPadding;
        if (!isObject(pos)) {
            if (layout.size) {
                chartArea[pos] -= layout.size;
            }
            const stack = stacks[layout.stack] || {
                size: 0,
                count: 1
            };
            stack.size = Math.max(stack.size, layout.horizontal ? box.height : box.width);
            layout.size = stack.size / stack.count;
            chartArea[pos] += layout.size;
        }
        if (box.getPadding) {
            updateMaxPadding(maxPadding, box.getPadding());
        }
        const newWidth = Math.max(0, params.outerWidth - getCombinedMax(maxPadding, chartArea, 'left', 'right'));
        const newHeight = Math.max(0, params.outerHeight - getCombinedMax(maxPadding, chartArea, 'top', 'bottom'));
        const widthChanged = newWidth !== chartArea.w;
        const heightChanged = newHeight !== chartArea.h;
        chartArea.w = newWidth;
        chartArea.h = newHeight;
        return layout.horizontal ? {
            same: widthChanged,
            other: heightChanged
        } : {
            same: heightChanged,
            other: widthChanged
        };
    }
    function handleMaxPadding(chartArea) {
        const maxPadding = chartArea.maxPadding;
        function updatePos(pos) {
            const change = Math.max(maxPadding[pos] - chartArea[pos], 0);
            chartArea[pos] += change;
            return change;
        }
        chartArea.y += updatePos('top');
        chartArea.x += updatePos('left');
        updatePos('right');
        updatePos('bottom');
    }
    function getMargins(horizontal, chartArea) {
        const maxPadding = chartArea.maxPadding;
        function marginForPositions(positions) {
            const margin = {
                left: 0,
                top: 0,
                right: 0,
                bottom: 0
            };
            positions.forEach((pos)=>{
                margin[pos] = Math.max(chartArea[pos], maxPadding[pos]);
            });
            return margin;
        }
        return horizontal ? marginForPositions([
            'left',
            'right'
        ]) : marginForPositions([
            'top',
            'bottom'
        ]);
    }
    function fitBoxes(boxes, chartArea, params, stacks) {
        const refitBoxes = [];
        let i, ilen, layout, box, refit, changed;
        for(i = 0, ilen = boxes.length, refit = 0; i < ilen; ++i){
            layout = boxes[i];
            box = layout.box;
            box.update(layout.width || chartArea.w, layout.height || chartArea.h, getMargins(layout.horizontal, chartArea));
            const { same , other  } = updateDims(chartArea, params, layout, stacks);
            refit |= same && refitBoxes.length;
            changed = changed || other;
            if (!box.fullSize) {
                refitBoxes.push(layout);
            }
        }
        return refit && fitBoxes(refitBoxes, chartArea, params, stacks) || changed;
    }
    function setBoxDims(box, left, top, width, height) {
        box.top = top;
        box.left = left;
        box.right = left + width;
        box.bottom = top + height;
        box.width = width;
        box.height = height;
    }
    function placeBoxes(boxes, chartArea, params, stacks) {
        const userPadding = params.padding;
        let { x , y  } = chartArea;
        for (const layout of boxes){
            const box = layout.box;
            const stack = stacks[layout.stack] || {
                placed: 0,
                weight: 1
            };
            const weight = layout.stackWeight / stack.weight || 1;
            if (layout.horizontal) {
                const width = chartArea.w * weight;
                const height = stack.size || box.height;
                if (defined(stack.start)) {
                    y = stack.start;
                }
                if (box.fullSize) {
                    setBoxDims(box, userPadding.left, y, params.outerWidth - userPadding.right - userPadding.left, height);
                } else {
                    setBoxDims(box, chartArea.left + stack.placed, y, width, height);
                }
                stack.start = y;
                stack.placed += width;
                y = box.bottom;
            } else {
                const height = chartArea.h * weight;
                const width = stack.size || box.width;
                if (defined(stack.start)) {
                    x = stack.start;
                }
                if (box.fullSize) {
                    setBoxDims(box, x, userPadding.top, width, params.outerHeight - userPadding.bottom - userPadding.top);
                } else {
                    setBoxDims(box, x, chartArea.top + stack.placed, width, height);
                }
                stack.start = x;
                stack.placed += height;
                x = box.right;
            }
        }
        chartArea.x = x;
        chartArea.y = y;
    }
    var layouts = {
     addBox (chart, item) {
            if (!chart.boxes) {
                chart.boxes = [];
            }
            item.fullSize = item.fullSize || false;
            item.position = item.position || 'top';
            item.weight = item.weight || 0;
            item._layers = item._layers || function() {
                return [
                    {
                        z: 0,
                        draw (chartArea) {
                            item.draw(chartArea);
                        }
                    }
                ];
            };
            chart.boxes.push(item);
        },
     removeBox (chart, layoutItem) {
            const index = chart.boxes ? chart.boxes.indexOf(layoutItem) : -1;
            if (index !== -1) {
                chart.boxes.splice(index, 1);
            }
        },
     configure (chart, item, options) {
            item.fullSize = options.fullSize;
            item.position = options.position;
            item.weight = options.weight;
        },
     update (chart, width, height, minPadding) {
            if (!chart) {
                return;
            }
            const padding = toPadding(chart.options.layout.padding);
            const availableWidth = Math.max(width - padding.width, 0);
            const availableHeight = Math.max(height - padding.height, 0);
            const boxes = buildLayoutBoxes(chart.boxes);
            const verticalBoxes = boxes.vertical;
            const horizontalBoxes = boxes.horizontal;
            each(chart.boxes, (box)=>{
                if (typeof box.beforeLayout === 'function') {
                    box.beforeLayout();
                }
            });
            const visibleVerticalBoxCount = verticalBoxes.reduce((total, wrap)=>wrap.box.options && wrap.box.options.display === false ? total : total + 1, 0) || 1;
            const params = Object.freeze({
                outerWidth: width,
                outerHeight: height,
                padding,
                availableWidth,
                availableHeight,
                vBoxMaxWidth: availableWidth / 2 / visibleVerticalBoxCount,
                hBoxMaxHeight: availableHeight / 2
            });
            const maxPadding = Object.assign({}, padding);
            updateMaxPadding(maxPadding, toPadding(minPadding));
            const chartArea = Object.assign({
                maxPadding,
                w: availableWidth,
                h: availableHeight,
                x: padding.left,
                y: padding.top
            }, padding);
            const stacks = setLayoutDims(verticalBoxes.concat(horizontalBoxes), params);
            fitBoxes(boxes.fullSize, chartArea, params, stacks);
            fitBoxes(verticalBoxes, chartArea, params, stacks);
            if (fitBoxes(horizontalBoxes, chartArea, params, stacks)) {
                fitBoxes(verticalBoxes, chartArea, params, stacks);
            }
            handleMaxPadding(chartArea);
            placeBoxes(boxes.leftAndTop, chartArea, params, stacks);
            chartArea.x += chartArea.w;
            chartArea.y += chartArea.h;
            placeBoxes(boxes.rightAndBottom, chartArea, params, stacks);
            chart.chartArea = {
                left: chartArea.left,
                top: chartArea.top,
                right: chartArea.left + chartArea.w,
                bottom: chartArea.top + chartArea.h,
                height: chartArea.h,
                width: chartArea.w
            };
            each(boxes.chartArea, (layout)=>{
                const box = layout.box;
                Object.assign(box, chart.chartArea);
                box.update(chartArea.w, chartArea.h, {
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0
                });
            });
        }
    };

    class BasePlatform {
     acquireContext(canvas, aspectRatio) {}
     releaseContext(context) {
            return false;
        }
     addEventListener(chart, type, listener) {}
     removeEventListener(chart, type, listener) {}
     getDevicePixelRatio() {
            return 1;
        }
     getMaximumSize(element, width, height, aspectRatio) {
            width = Math.max(0, width || element.width);
            height = height || element.height;
            return {
                width,
                height: Math.max(0, aspectRatio ? Math.floor(width / aspectRatio) : height)
            };
        }
     isAttached(canvas) {
            return true;
        }
     updateConfig(config) {
        }
    }

    class BasicPlatform extends BasePlatform {
        acquireContext(item) {
            return item && item.getContext && item.getContext('2d') || null;
        }
        updateConfig(config) {
            config.options.animation = false;
        }
    }

    const EXPANDO_KEY = '$chartjs';
     const EVENT_TYPES = {
        touchstart: 'mousedown',
        touchmove: 'mousemove',
        touchend: 'mouseup',
        pointerenter: 'mouseenter',
        pointerdown: 'mousedown',
        pointermove: 'mousemove',
        pointerup: 'mouseup',
        pointerleave: 'mouseout',
        pointerout: 'mouseout'
    };
    const isNullOrEmpty = (value)=>value === null || value === '';
     function initCanvas(canvas, aspectRatio) {
        const style = canvas.style;
        const renderHeight = canvas.getAttribute('height');
        const renderWidth = canvas.getAttribute('width');
        canvas[EXPANDO_KEY] = {
            initial: {
                height: renderHeight,
                width: renderWidth,
                style: {
                    display: style.display,
                    height: style.height,
                    width: style.width
                }
            }
        };
        style.display = style.display || 'block';
        style.boxSizing = style.boxSizing || 'border-box';
        if (isNullOrEmpty(renderWidth)) {
            const displayWidth = readUsedSize(canvas, 'width');
            if (displayWidth !== undefined) {
                canvas.width = displayWidth;
            }
        }
        if (isNullOrEmpty(renderHeight)) {
            if (canvas.style.height === '') {
                canvas.height = canvas.width / (aspectRatio || 2);
            } else {
                const displayHeight = readUsedSize(canvas, 'height');
                if (displayHeight !== undefined) {
                    canvas.height = displayHeight;
                }
            }
        }
        return canvas;
    }
    const eventListenerOptions = supportsEventListenerOptions ? {
        passive: true
    } : false;
    function addListener(node, type, listener) {
        if (node) {
            node.addEventListener(type, listener, eventListenerOptions);
        }
    }
    function removeListener(chart, type, listener) {
        if (chart && chart.canvas) {
            chart.canvas.removeEventListener(type, listener, eventListenerOptions);
        }
    }
    function fromNativeEvent(event, chart) {
        const type = EVENT_TYPES[event.type] || event.type;
        const { x , y  } = getRelativePosition(event, chart);
        return {
            type,
            chart,
            native: event,
            x: x !== undefined ? x : null,
            y: y !== undefined ? y : null
        };
    }
    function nodeListContains(nodeList, canvas) {
        for (const node of nodeList){
            if (node === canvas || node.contains(canvas)) {
                return true;
            }
        }
    }
    function createAttachObserver(chart, type, listener) {
        const canvas = chart.canvas;
        const observer = new MutationObserver((entries)=>{
            let trigger = false;
            for (const entry of entries){
                trigger = trigger || nodeListContains(entry.addedNodes, canvas);
                trigger = trigger && !nodeListContains(entry.removedNodes, canvas);
            }
            if (trigger) {
                listener();
            }
        });
        observer.observe(document, {
            childList: true,
            subtree: true
        });
        return observer;
    }
    function createDetachObserver(chart, type, listener) {
        const canvas = chart.canvas;
        const observer = new MutationObserver((entries)=>{
            let trigger = false;
            for (const entry of entries){
                trigger = trigger || nodeListContains(entry.removedNodes, canvas);
                trigger = trigger && !nodeListContains(entry.addedNodes, canvas);
            }
            if (trigger) {
                listener();
            }
        });
        observer.observe(document, {
            childList: true,
            subtree: true
        });
        return observer;
    }
    const drpListeningCharts = new Map();
    let oldDevicePixelRatio = 0;
    function onWindowResize() {
        const dpr = window.devicePixelRatio;
        if (dpr === oldDevicePixelRatio) {
            return;
        }
        oldDevicePixelRatio = dpr;
        drpListeningCharts.forEach((resize, chart)=>{
            if (chart.currentDevicePixelRatio !== dpr) {
                resize();
            }
        });
    }
    function listenDevicePixelRatioChanges(chart, resize) {
        if (!drpListeningCharts.size) {
            window.addEventListener('resize', onWindowResize);
        }
        drpListeningCharts.set(chart, resize);
    }
    function unlistenDevicePixelRatioChanges(chart) {
        drpListeningCharts.delete(chart);
        if (!drpListeningCharts.size) {
            window.removeEventListener('resize', onWindowResize);
        }
    }
    function createResizeObserver(chart, type, listener) {
        const canvas = chart.canvas;
        const container = canvas && _getParentNode(canvas);
        if (!container) {
            return;
        }
        const resize = throttled((width, height)=>{
            const w = container.clientWidth;
            listener(width, height);
            if (w < container.clientWidth) {
                listener();
            }
        }, window);
        const observer = new ResizeObserver((entries)=>{
            const entry = entries[0];
            const width = entry.contentRect.width;
            const height = entry.contentRect.height;
            if (width === 0 && height === 0) {
                return;
            }
            resize(width, height);
        });
        observer.observe(container);
        listenDevicePixelRatioChanges(chart, resize);
        return observer;
    }
    function releaseObserver(chart, type, observer) {
        if (observer) {
            observer.disconnect();
        }
        if (type === 'resize') {
            unlistenDevicePixelRatioChanges(chart);
        }
    }
    function createProxyAndListen(chart, type, listener) {
        const canvas = chart.canvas;
        const proxy = throttled((event)=>{
            if (chart.ctx !== null) {
                listener(fromNativeEvent(event, chart));
            }
        }, chart);
        addListener(canvas, type, proxy);
        return proxy;
    }
     class DomPlatform extends BasePlatform {
     acquireContext(canvas, aspectRatio) {
            const context = canvas && canvas.getContext && canvas.getContext('2d');
            if (context && context.canvas === canvas) {
                initCanvas(canvas, aspectRatio);
                return context;
            }
            return null;
        }
     releaseContext(context) {
            const canvas = context.canvas;
            if (!canvas[EXPANDO_KEY]) {
                return false;
            }
            const initial = canvas[EXPANDO_KEY].initial;
            [
                'height',
                'width'
            ].forEach((prop)=>{
                const value = initial[prop];
                if (isNullOrUndef(value)) {
                    canvas.removeAttribute(prop);
                } else {
                    canvas.setAttribute(prop, value);
                }
            });
            const style = initial.style || {};
            Object.keys(style).forEach((key)=>{
                canvas.style[key] = style[key];
            });
            canvas.width = canvas.width;
            delete canvas[EXPANDO_KEY];
            return true;
        }
     addEventListener(chart, type, listener) {
            this.removeEventListener(chart, type);
            const proxies = chart.$proxies || (chart.$proxies = {});
            const handlers = {
                attach: createAttachObserver,
                detach: createDetachObserver,
                resize: createResizeObserver
            };
            const handler = handlers[type] || createProxyAndListen;
            proxies[type] = handler(chart, type, listener);
        }
     removeEventListener(chart, type) {
            const proxies = chart.$proxies || (chart.$proxies = {});
            const proxy = proxies[type];
            if (!proxy) {
                return;
            }
            const handlers = {
                attach: releaseObserver,
                detach: releaseObserver,
                resize: releaseObserver
            };
            const handler = handlers[type] || removeListener;
            handler(chart, type, proxy);
            proxies[type] = undefined;
        }
        getDevicePixelRatio() {
            return window.devicePixelRatio;
        }
     getMaximumSize(canvas, width, height, aspectRatio) {
            return getMaximumSize(canvas, width, height, aspectRatio);
        }
     isAttached(canvas) {
            const container = canvas && _getParentNode(canvas);
            return !!(container && container.isConnected);
        }
    }

    function _detectPlatform(canvas) {
        if (!_isDomSupported() || typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
            return BasicPlatform;
        }
        return DomPlatform;
    }

    class Element {
        static defaults = {};
        static defaultRoutes = undefined;
        x;
        y;
        active = false;
        options;
        $animations;
        tooltipPosition(useFinalPosition) {
            const { x , y  } = this.getProps([
                'x',
                'y'
            ], useFinalPosition);
            return {
                x,
                y
            };
        }
        hasValue() {
            return isNumber(this.x) && isNumber(this.y);
        }
        getProps(props, final) {
            const anims = this.$animations;
            if (!final || !anims) {
                // let's not create an object, if not needed
                return this;
            }
            const ret = {};
            props.forEach((prop)=>{
                ret[prop] = anims[prop] && anims[prop].active() ? anims[prop]._to : this[prop];
            });
            return ret;
        }
    }

    function autoSkip(scale, ticks) {
        const tickOpts = scale.options.ticks;
        const determinedMaxTicks = determineMaxTicks(scale);
        const ticksLimit = Math.min(tickOpts.maxTicksLimit || determinedMaxTicks, determinedMaxTicks);
        const majorIndices = tickOpts.major.enabled ? getMajorIndices(ticks) : [];
        const numMajorIndices = majorIndices.length;
        const first = majorIndices[0];
        const last = majorIndices[numMajorIndices - 1];
        const newTicks = [];
        if (numMajorIndices > ticksLimit) {
            skipMajors(ticks, newTicks, majorIndices, numMajorIndices / ticksLimit);
            return newTicks;
        }
        const spacing = calculateSpacing(majorIndices, ticks, ticksLimit);
        if (numMajorIndices > 0) {
            let i, ilen;
            const avgMajorSpacing = numMajorIndices > 1 ? Math.round((last - first) / (numMajorIndices - 1)) : null;
            skip(ticks, newTicks, spacing, isNullOrUndef(avgMajorSpacing) ? 0 : first - avgMajorSpacing, first);
            for(i = 0, ilen = numMajorIndices - 1; i < ilen; i++){
                skip(ticks, newTicks, spacing, majorIndices[i], majorIndices[i + 1]);
            }
            skip(ticks, newTicks, spacing, last, isNullOrUndef(avgMajorSpacing) ? ticks.length : last + avgMajorSpacing);
            return newTicks;
        }
        skip(ticks, newTicks, spacing);
        return newTicks;
    }
    function determineMaxTicks(scale) {
        const offset = scale.options.offset;
        const tickLength = scale._tickSize();
        const maxScale = scale._length / tickLength + (offset ? 0 : 1);
        const maxChart = scale._maxLength / tickLength;
        return Math.floor(Math.min(maxScale, maxChart));
    }
     function calculateSpacing(majorIndices, ticks, ticksLimit) {
        const evenMajorSpacing = getEvenSpacing(majorIndices);
        const spacing = ticks.length / ticksLimit;
        if (!evenMajorSpacing) {
            return Math.max(spacing, 1);
        }
        const factors = _factorize(evenMajorSpacing);
        for(let i = 0, ilen = factors.length - 1; i < ilen; i++){
            const factor = factors[i];
            if (factor > spacing) {
                return factor;
            }
        }
        return Math.max(spacing, 1);
    }
     function getMajorIndices(ticks) {
        const result = [];
        let i, ilen;
        for(i = 0, ilen = ticks.length; i < ilen; i++){
            if (ticks[i].major) {
                result.push(i);
            }
        }
        return result;
    }
     function skipMajors(ticks, newTicks, majorIndices, spacing) {
        let count = 0;
        let next = majorIndices[0];
        let i;
        spacing = Math.ceil(spacing);
        for(i = 0; i < ticks.length; i++){
            if (i === next) {
                newTicks.push(ticks[i]);
                count++;
                next = majorIndices[count * spacing];
            }
        }
    }
     function skip(ticks, newTicks, spacing, majorStart, majorEnd) {
        const start = valueOrDefault(majorStart, 0);
        const end = Math.min(valueOrDefault(majorEnd, ticks.length), ticks.length);
        let count = 0;
        let length, i, next;
        spacing = Math.ceil(spacing);
        if (majorEnd) {
            length = majorEnd - majorStart;
            spacing = length / Math.floor(length / spacing);
        }
        next = start;
        while(next < 0){
            count++;
            next = Math.round(start + count * spacing);
        }
        for(i = Math.max(start, 0); i < end; i++){
            if (i === next) {
                newTicks.push(ticks[i]);
                count++;
                next = Math.round(start + count * spacing);
            }
        }
    }
     function getEvenSpacing(arr) {
        const len = arr.length;
        let i, diff;
        if (len < 2) {
            return false;
        }
        for(diff = arr[0], i = 1; i < len; ++i){
            if (arr[i] - arr[i - 1] !== diff) {
                return false;
            }
        }
        return diff;
    }

    const reverseAlign = (align)=>align === 'left' ? 'right' : align === 'right' ? 'left' : align;
    const offsetFromEdge = (scale, edge, offset)=>edge === 'top' || edge === 'left' ? scale[edge] + offset : scale[edge] - offset;
    const getTicksLimit = (ticksLength, maxTicksLimit)=>Math.min(maxTicksLimit || ticksLength, ticksLength);
     function sample(arr, numItems) {
        const result = [];
        const increment = arr.length / numItems;
        const len = arr.length;
        let i = 0;
        for(; i < len; i += increment){
            result.push(arr[Math.floor(i)]);
        }
        return result;
    }
     function getPixelForGridLine(scale, index, offsetGridLines) {
        const length = scale.ticks.length;
        const validIndex = Math.min(index, length - 1);
        const start = scale._startPixel;
        const end = scale._endPixel;
        const epsilon = 1e-6;
        let lineValue = scale.getPixelForTick(validIndex);
        let offset;
        if (offsetGridLines) {
            if (length === 1) {
                offset = Math.max(lineValue - start, end - lineValue);
            } else if (index === 0) {
                offset = (scale.getPixelForTick(1) - lineValue) / 2;
            } else {
                offset = (lineValue - scale.getPixelForTick(validIndex - 1)) / 2;
            }
            lineValue += validIndex < index ? offset : -offset;
            if (lineValue < start - epsilon || lineValue > end + epsilon) {
                return;
            }
        }
        return lineValue;
    }
     function garbageCollect(caches, length) {
        each(caches, (cache)=>{
            const gc = cache.gc;
            const gcLen = gc.length / 2;
            let i;
            if (gcLen > length) {
                for(i = 0; i < gcLen; ++i){
                    delete cache.data[gc[i]];
                }
                gc.splice(0, gcLen);
            }
        });
    }
     function getTickMarkLength(options) {
        return options.drawTicks ? options.tickLength : 0;
    }
     function getTitleHeight(options, fallback) {
        if (!options.display) {
            return 0;
        }
        const font = toFont(options.font, fallback);
        const padding = toPadding(options.padding);
        const lines = isArray(options.text) ? options.text.length : 1;
        return lines * font.lineHeight + padding.height;
    }
    function createScaleContext(parent, scale) {
        return createContext(parent, {
            scale,
            type: 'scale'
        });
    }
    function createTickContext(parent, index, tick) {
        return createContext(parent, {
            tick,
            index,
            type: 'tick'
        });
    }
    function titleAlign(align, position, reverse) {
         let ret = _toLeftRightCenter(align);
        if (reverse && position !== 'right' || !reverse && position === 'right') {
            ret = reverseAlign(ret);
        }
        return ret;
    }
    function titleArgs(scale, offset, position, align) {
        const { top , left , bottom , right , chart  } = scale;
        const { chartArea , scales  } = chart;
        let rotation = 0;
        let maxWidth, titleX, titleY;
        const height = bottom - top;
        const width = right - left;
        if (scale.isHorizontal()) {
            titleX = _alignStartEnd(align, left, right);
            if (isObject(position)) {
                const positionAxisID = Object.keys(position)[0];
                const value = position[positionAxisID];
                titleY = scales[positionAxisID].getPixelForValue(value) + height - offset;
            } else if (position === 'center') {
                titleY = (chartArea.bottom + chartArea.top) / 2 + height - offset;
            } else {
                titleY = offsetFromEdge(scale, position, offset);
            }
            maxWidth = right - left;
        } else {
            if (isObject(position)) {
                const positionAxisID = Object.keys(position)[0];
                const value = position[positionAxisID];
                titleX = scales[positionAxisID].getPixelForValue(value) - width + offset;
            } else if (position === 'center') {
                titleX = (chartArea.left + chartArea.right) / 2 - width + offset;
            } else {
                titleX = offsetFromEdge(scale, position, offset);
            }
            titleY = _alignStartEnd(align, bottom, top);
            rotation = position === 'left' ? -HALF_PI : HALF_PI;
        }
        return {
            titleX,
            titleY,
            maxWidth,
            rotation
        };
    }
    class Scale extends Element {
        constructor(cfg){
            super();
             this.id = cfg.id;
             this.type = cfg.type;
             this.options = undefined;
             this.ctx = cfg.ctx;
             this.chart = cfg.chart;
             this.top = undefined;
             this.bottom = undefined;
             this.left = undefined;
             this.right = undefined;
             this.width = undefined;
             this.height = undefined;
            this._margins = {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            };
             this.maxWidth = undefined;
             this.maxHeight = undefined;
             this.paddingTop = undefined;
             this.paddingBottom = undefined;
             this.paddingLeft = undefined;
             this.paddingRight = undefined;
             this.axis = undefined;
             this.labelRotation = undefined;
            this.min = undefined;
            this.max = undefined;
            this._range = undefined;
             this.ticks = [];
             this._gridLineItems = null;
             this._labelItems = null;
             this._labelSizes = null;
            this._length = 0;
            this._maxLength = 0;
            this._longestTextCache = {};
             this._startPixel = undefined;
             this._endPixel = undefined;
            this._reversePixels = false;
            this._userMax = undefined;
            this._userMin = undefined;
            this._suggestedMax = undefined;
            this._suggestedMin = undefined;
            this._ticksLength = 0;
            this._borderValue = 0;
            this._cache = {};
            this._dataLimitsCached = false;
            this.$context = undefined;
        }
     init(options) {
            this.options = options.setContext(this.getContext());
            this.axis = options.axis;
            this._userMin = this.parse(options.min);
            this._userMax = this.parse(options.max);
            this._suggestedMin = this.parse(options.suggestedMin);
            this._suggestedMax = this.parse(options.suggestedMax);
        }
     parse(raw, index) {
            return raw;
        }
     getUserBounds() {
            let { _userMin , _userMax , _suggestedMin , _suggestedMax  } = this;
            _userMin = finiteOrDefault(_userMin, Number.POSITIVE_INFINITY);
            _userMax = finiteOrDefault(_userMax, Number.NEGATIVE_INFINITY);
            _suggestedMin = finiteOrDefault(_suggestedMin, Number.POSITIVE_INFINITY);
            _suggestedMax = finiteOrDefault(_suggestedMax, Number.NEGATIVE_INFINITY);
            return {
                min: finiteOrDefault(_userMin, _suggestedMin),
                max: finiteOrDefault(_userMax, _suggestedMax),
                minDefined: isNumberFinite(_userMin),
                maxDefined: isNumberFinite(_userMax)
            };
        }
     getMinMax(canStack) {
            let { min , max , minDefined , maxDefined  } = this.getUserBounds();
            let range;
            if (minDefined && maxDefined) {
                return {
                    min,
                    max
                };
            }
            const metas = this.getMatchingVisibleMetas();
            for(let i = 0, ilen = metas.length; i < ilen; ++i){
                range = metas[i].controller.getMinMax(this, canStack);
                if (!minDefined) {
                    min = Math.min(min, range.min);
                }
                if (!maxDefined) {
                    max = Math.max(max, range.max);
                }
            }
            min = maxDefined && min > max ? max : min;
            max = minDefined && min > max ? min : max;
            return {
                min: finiteOrDefault(min, finiteOrDefault(max, min)),
                max: finiteOrDefault(max, finiteOrDefault(min, max))
            };
        }
     getPadding() {
            return {
                left: this.paddingLeft || 0,
                top: this.paddingTop || 0,
                right: this.paddingRight || 0,
                bottom: this.paddingBottom || 0
            };
        }
     getTicks() {
            return this.ticks;
        }
     getLabels() {
            const data = this.chart.data;
            return this.options.labels || (this.isHorizontal() ? data.xLabels : data.yLabels) || data.labels || [];
        }
     getLabelItems(chartArea = this.chart.chartArea) {
            const items = this._labelItems || (this._labelItems = this._computeLabelItems(chartArea));
            return items;
        }
        beforeLayout() {
            this._cache = {};
            this._dataLimitsCached = false;
        }
        beforeUpdate() {
            callback(this.options.beforeUpdate, [
                this
            ]);
        }
     update(maxWidth, maxHeight, margins) {
            const { beginAtZero , grace , ticks: tickOpts  } = this.options;
            const sampleSize = tickOpts.sampleSize;
            this.beforeUpdate();
            this.maxWidth = maxWidth;
            this.maxHeight = maxHeight;
            this._margins = margins = Object.assign({
                left: 0,
                right: 0,
                top: 0,
                bottom: 0
            }, margins);
            this.ticks = null;
            this._labelSizes = null;
            this._gridLineItems = null;
            this._labelItems = null;
            this.beforeSetDimensions();
            this.setDimensions();
            this.afterSetDimensions();
            this._maxLength = this.isHorizontal() ? this.width + margins.left + margins.right : this.height + margins.top + margins.bottom;
            if (!this._dataLimitsCached) {
                this.beforeDataLimits();
                this.determineDataLimits();
                this.afterDataLimits();
                this._range = _addGrace(this, grace, beginAtZero);
                this._dataLimitsCached = true;
            }
            this.beforeBuildTicks();
            this.ticks = this.buildTicks() || [];
            this.afterBuildTicks();
            const samplingEnabled = sampleSize < this.ticks.length;
            this._convertTicksToLabels(samplingEnabled ? sample(this.ticks, sampleSize) : this.ticks);
            this.configure();
            this.beforeCalculateLabelRotation();
            this.calculateLabelRotation();
            this.afterCalculateLabelRotation();
            if (tickOpts.display && (tickOpts.autoSkip || tickOpts.source === 'auto')) {
                this.ticks = autoSkip(this, this.ticks);
                this._labelSizes = null;
                this.afterAutoSkip();
            }
            if (samplingEnabled) {
                this._convertTicksToLabels(this.ticks);
            }
            this.beforeFit();
            this.fit();
            this.afterFit();
            this.afterUpdate();
        }
     configure() {
            let reversePixels = this.options.reverse;
            let startPixel, endPixel;
            if (this.isHorizontal()) {
                startPixel = this.left;
                endPixel = this.right;
            } else {
                startPixel = this.top;
                endPixel = this.bottom;
                reversePixels = !reversePixels;
            }
            this._startPixel = startPixel;
            this._endPixel = endPixel;
            this._reversePixels = reversePixels;
            this._length = endPixel - startPixel;
            this._alignToPixels = this.options.alignToPixels;
        }
        afterUpdate() {
            callback(this.options.afterUpdate, [
                this
            ]);
        }
        beforeSetDimensions() {
            callback(this.options.beforeSetDimensions, [
                this
            ]);
        }
        setDimensions() {
            if (this.isHorizontal()) {
                this.width = this.maxWidth;
                this.left = 0;
                this.right = this.width;
            } else {
                this.height = this.maxHeight;
                this.top = 0;
                this.bottom = this.height;
            }
            this.paddingLeft = 0;
            this.paddingTop = 0;
            this.paddingRight = 0;
            this.paddingBottom = 0;
        }
        afterSetDimensions() {
            callback(this.options.afterSetDimensions, [
                this
            ]);
        }
        _callHooks(name) {
            this.chart.notifyPlugins(name, this.getContext());
            callback(this.options[name], [
                this
            ]);
        }
        beforeDataLimits() {
            this._callHooks('beforeDataLimits');
        }
        determineDataLimits() {}
        afterDataLimits() {
            this._callHooks('afterDataLimits');
        }
        beforeBuildTicks() {
            this._callHooks('beforeBuildTicks');
        }
     buildTicks() {
            return [];
        }
        afterBuildTicks() {
            this._callHooks('afterBuildTicks');
        }
        beforeTickToLabelConversion() {
            callback(this.options.beforeTickToLabelConversion, [
                this
            ]);
        }
     generateTickLabels(ticks) {
            const tickOpts = this.options.ticks;
            let i, ilen, tick;
            for(i = 0, ilen = ticks.length; i < ilen; i++){
                tick = ticks[i];
                tick.label = callback(tickOpts.callback, [
                    tick.value,
                    i,
                    ticks
                ], this);
            }
        }
        afterTickToLabelConversion() {
            callback(this.options.afterTickToLabelConversion, [
                this
            ]);
        }
        beforeCalculateLabelRotation() {
            callback(this.options.beforeCalculateLabelRotation, [
                this
            ]);
        }
        calculateLabelRotation() {
            const options = this.options;
            const tickOpts = options.ticks;
            const numTicks = getTicksLimit(this.ticks.length, options.ticks.maxTicksLimit);
            const minRotation = tickOpts.minRotation || 0;
            const maxRotation = tickOpts.maxRotation;
            let labelRotation = minRotation;
            let tickWidth, maxHeight, maxLabelDiagonal;
            if (!this._isVisible() || !tickOpts.display || minRotation >= maxRotation || numTicks <= 1 || !this.isHorizontal()) {
                this.labelRotation = minRotation;
                return;
            }
            const labelSizes = this._getLabelSizes();
            const maxLabelWidth = labelSizes.widest.width;
            const maxLabelHeight = labelSizes.highest.height;
            const maxWidth = _limitValue(this.chart.width - maxLabelWidth, 0, this.maxWidth);
            tickWidth = options.offset ? this.maxWidth / numTicks : maxWidth / (numTicks - 1);
            if (maxLabelWidth + 6 > tickWidth) {
                tickWidth = maxWidth / (numTicks - (options.offset ? 0.5 : 1));
                maxHeight = this.maxHeight - getTickMarkLength(options.grid) - tickOpts.padding - getTitleHeight(options.title, this.chart.options.font);
                maxLabelDiagonal = Math.sqrt(maxLabelWidth * maxLabelWidth + maxLabelHeight * maxLabelHeight);
                labelRotation = toDegrees(Math.min(Math.asin(_limitValue((labelSizes.highest.height + 6) / tickWidth, -1, 1)), Math.asin(_limitValue(maxHeight / maxLabelDiagonal, -1, 1)) - Math.asin(_limitValue(maxLabelHeight / maxLabelDiagonal, -1, 1))));
                labelRotation = Math.max(minRotation, Math.min(maxRotation, labelRotation));
            }
            this.labelRotation = labelRotation;
        }
        afterCalculateLabelRotation() {
            callback(this.options.afterCalculateLabelRotation, [
                this
            ]);
        }
        afterAutoSkip() {}
        beforeFit() {
            callback(this.options.beforeFit, [
                this
            ]);
        }
        fit() {
            const minSize = {
                width: 0,
                height: 0
            };
            const { chart , options: { ticks: tickOpts , title: titleOpts , grid: gridOpts  }  } = this;
            const display = this._isVisible();
            const isHorizontal = this.isHorizontal();
            if (display) {
                const titleHeight = getTitleHeight(titleOpts, chart.options.font);
                if (isHorizontal) {
                    minSize.width = this.maxWidth;
                    minSize.height = getTickMarkLength(gridOpts) + titleHeight;
                } else {
                    minSize.height = this.maxHeight;
                    minSize.width = getTickMarkLength(gridOpts) + titleHeight;
                }
                if (tickOpts.display && this.ticks.length) {
                    const { first , last , widest , highest  } = this._getLabelSizes();
                    const tickPadding = tickOpts.padding * 2;
                    const angleRadians = toRadians(this.labelRotation);
                    const cos = Math.cos(angleRadians);
                    const sin = Math.sin(angleRadians);
                    if (isHorizontal) {
                        const labelHeight = tickOpts.mirror ? 0 : sin * widest.width + cos * highest.height;
                        minSize.height = Math.min(this.maxHeight, minSize.height + labelHeight + tickPadding);
                    } else {
                        const labelWidth = tickOpts.mirror ? 0 : cos * widest.width + sin * highest.height;
                        minSize.width = Math.min(this.maxWidth, minSize.width + labelWidth + tickPadding);
                    }
                    this._calculatePadding(first, last, sin, cos);
                }
            }
            this._handleMargins();
            if (isHorizontal) {
                this.width = this._length = chart.width - this._margins.left - this._margins.right;
                this.height = minSize.height;
            } else {
                this.width = minSize.width;
                this.height = this._length = chart.height - this._margins.top - this._margins.bottom;
            }
        }
        _calculatePadding(first, last, sin, cos) {
            const { ticks: { align , padding  } , position  } = this.options;
            const isRotated = this.labelRotation !== 0;
            const labelsBelowTicks = position !== 'top' && this.axis === 'x';
            if (this.isHorizontal()) {
                const offsetLeft = this.getPixelForTick(0) - this.left;
                const offsetRight = this.right - this.getPixelForTick(this.ticks.length - 1);
                let paddingLeft = 0;
                let paddingRight = 0;
                if (isRotated) {
                    if (labelsBelowTicks) {
                        paddingLeft = cos * first.width;
                        paddingRight = sin * last.height;
                    } else {
                        paddingLeft = sin * first.height;
                        paddingRight = cos * last.width;
                    }
                } else if (align === 'start') {
                    paddingRight = last.width;
                } else if (align === 'end') {
                    paddingLeft = first.width;
                } else if (align !== 'inner') {
                    paddingLeft = first.width / 2;
                    paddingRight = last.width / 2;
                }
                this.paddingLeft = Math.max((paddingLeft - offsetLeft + padding) * this.width / (this.width - offsetLeft), 0);
                this.paddingRight = Math.max((paddingRight - offsetRight + padding) * this.width / (this.width - offsetRight), 0);
            } else {
                let paddingTop = last.height / 2;
                let paddingBottom = first.height / 2;
                if (align === 'start') {
                    paddingTop = 0;
                    paddingBottom = first.height;
                } else if (align === 'end') {
                    paddingTop = last.height;
                    paddingBottom = 0;
                }
                this.paddingTop = paddingTop + padding;
                this.paddingBottom = paddingBottom + padding;
            }
        }
     _handleMargins() {
            if (this._margins) {
                this._margins.left = Math.max(this.paddingLeft, this._margins.left);
                this._margins.top = Math.max(this.paddingTop, this._margins.top);
                this._margins.right = Math.max(this.paddingRight, this._margins.right);
                this._margins.bottom = Math.max(this.paddingBottom, this._margins.bottom);
            }
        }
        afterFit() {
            callback(this.options.afterFit, [
                this
            ]);
        }
     isHorizontal() {
            const { axis , position  } = this.options;
            return position === 'top' || position === 'bottom' || axis === 'x';
        }
     isFullSize() {
            return this.options.fullSize;
        }
     _convertTicksToLabels(ticks) {
            this.beforeTickToLabelConversion();
            this.generateTickLabels(ticks);
            let i, ilen;
            for(i = 0, ilen = ticks.length; i < ilen; i++){
                if (isNullOrUndef(ticks[i].label)) {
                    ticks.splice(i, 1);
                    ilen--;
                    i--;
                }
            }
            this.afterTickToLabelConversion();
        }
     _getLabelSizes() {
            let labelSizes = this._labelSizes;
            if (!labelSizes) {
                const sampleSize = this.options.ticks.sampleSize;
                let ticks = this.ticks;
                if (sampleSize < ticks.length) {
                    ticks = sample(ticks, sampleSize);
                }
                this._labelSizes = labelSizes = this._computeLabelSizes(ticks, ticks.length, this.options.ticks.maxTicksLimit);
            }
            return labelSizes;
        }
     _computeLabelSizes(ticks, length, maxTicksLimit) {
            const { ctx , _longestTextCache: caches  } = this;
            const widths = [];
            const heights = [];
            const increment = Math.floor(length / getTicksLimit(length, maxTicksLimit));
            let widestLabelSize = 0;
            let highestLabelSize = 0;
            let i, j, jlen, label, tickFont, fontString, cache, lineHeight, width, height, nestedLabel;
            for(i = 0; i < length; i += increment){
                label = ticks[i].label;
                tickFont = this._resolveTickFontOptions(i);
                ctx.font = fontString = tickFont.string;
                cache = caches[fontString] = caches[fontString] || {
                    data: {},
                    gc: []
                };
                lineHeight = tickFont.lineHeight;
                width = height = 0;
                if (!isNullOrUndef(label) && !isArray(label)) {
                    width = _measureText(ctx, cache.data, cache.gc, width, label);
                    height = lineHeight;
                } else if (isArray(label)) {
                    for(j = 0, jlen = label.length; j < jlen; ++j){
                        nestedLabel =  label[j];
                        if (!isNullOrUndef(nestedLabel) && !isArray(nestedLabel)) {
                            width = _measureText(ctx, cache.data, cache.gc, width, nestedLabel);
                            height += lineHeight;
                        }
                    }
                }
                widths.push(width);
                heights.push(height);
                widestLabelSize = Math.max(width, widestLabelSize);
                highestLabelSize = Math.max(height, highestLabelSize);
            }
            garbageCollect(caches, length);
            const widest = widths.indexOf(widestLabelSize);
            const highest = heights.indexOf(highestLabelSize);
            const valueAt = (idx)=>({
                    width: widths[idx] || 0,
                    height: heights[idx] || 0
                });
            return {
                first: valueAt(0),
                last: valueAt(length - 1),
                widest: valueAt(widest),
                highest: valueAt(highest),
                widths,
                heights
            };
        }
     getLabelForValue(value) {
            return value;
        }
     getPixelForValue(value, index) {
            return NaN;
        }
     getValueForPixel(pixel) {}
     getPixelForTick(index) {
            const ticks = this.ticks;
            if (index < 0 || index > ticks.length - 1) {
                return null;
            }
            return this.getPixelForValue(ticks[index].value);
        }
     getPixelForDecimal(decimal) {
            if (this._reversePixels) {
                decimal = 1 - decimal;
            }
            const pixel = this._startPixel + decimal * this._length;
            return _int16Range(this._alignToPixels ? _alignPixel(this.chart, pixel, 0) : pixel);
        }
     getDecimalForPixel(pixel) {
            const decimal = (pixel - this._startPixel) / this._length;
            return this._reversePixels ? 1 - decimal : decimal;
        }
     getBasePixel() {
            return this.getPixelForValue(this.getBaseValue());
        }
     getBaseValue() {
            const { min , max  } = this;
            return min < 0 && max < 0 ? max : min > 0 && max > 0 ? min : 0;
        }
     getContext(index) {
            const ticks = this.ticks || [];
            if (index >= 0 && index < ticks.length) {
                const tick = ticks[index];
                return tick.$context || (tick.$context = createTickContext(this.getContext(), index, tick));
            }
            return this.$context || (this.$context = createScaleContext(this.chart.getContext(), this));
        }
     _tickSize() {
            const optionTicks = this.options.ticks;
            const rot = toRadians(this.labelRotation);
            const cos = Math.abs(Math.cos(rot));
            const sin = Math.abs(Math.sin(rot));
            const labelSizes = this._getLabelSizes();
            const padding = optionTicks.autoSkipPadding || 0;
            const w = labelSizes ? labelSizes.widest.width + padding : 0;
            const h = labelSizes ? labelSizes.highest.height + padding : 0;
            return this.isHorizontal() ? h * cos > w * sin ? w / cos : h / sin : h * sin < w * cos ? h / cos : w / sin;
        }
     _isVisible() {
            const display = this.options.display;
            if (display !== 'auto') {
                return !!display;
            }
            return this.getMatchingVisibleMetas().length > 0;
        }
     _computeGridLineItems(chartArea) {
            const axis = this.axis;
            const chart = this.chart;
            const options = this.options;
            const { grid , position , border  } = options;
            const offset = grid.offset;
            const isHorizontal = this.isHorizontal();
            const ticks = this.ticks;
            const ticksLength = ticks.length + (offset ? 1 : 0);
            const tl = getTickMarkLength(grid);
            const items = [];
            const borderOpts = border.setContext(this.getContext());
            const axisWidth = borderOpts.display ? borderOpts.width : 0;
            const axisHalfWidth = axisWidth / 2;
            const alignBorderValue = function(pixel) {
                return _alignPixel(chart, pixel, axisWidth);
            };
            let borderValue, i, lineValue, alignedLineValue;
            let tx1, ty1, tx2, ty2, x1, y1, x2, y2;
            if (position === 'top') {
                borderValue = alignBorderValue(this.bottom);
                ty1 = this.bottom - tl;
                ty2 = borderValue - axisHalfWidth;
                y1 = alignBorderValue(chartArea.top) + axisHalfWidth;
                y2 = chartArea.bottom;
            } else if (position === 'bottom') {
                borderValue = alignBorderValue(this.top);
                y1 = chartArea.top;
                y2 = alignBorderValue(chartArea.bottom) - axisHalfWidth;
                ty1 = borderValue + axisHalfWidth;
                ty2 = this.top + tl;
            } else if (position === 'left') {
                borderValue = alignBorderValue(this.right);
                tx1 = this.right - tl;
                tx2 = borderValue - axisHalfWidth;
                x1 = alignBorderValue(chartArea.left) + axisHalfWidth;
                x2 = chartArea.right;
            } else if (position === 'right') {
                borderValue = alignBorderValue(this.left);
                x1 = chartArea.left;
                x2 = alignBorderValue(chartArea.right) - axisHalfWidth;
                tx1 = borderValue + axisHalfWidth;
                tx2 = this.left + tl;
            } else if (axis === 'x') {
                if (position === 'center') {
                    borderValue = alignBorderValue((chartArea.top + chartArea.bottom) / 2 + 0.5);
                } else if (isObject(position)) {
                    const positionAxisID = Object.keys(position)[0];
                    const value = position[positionAxisID];
                    borderValue = alignBorderValue(this.chart.scales[positionAxisID].getPixelForValue(value));
                }
                y1 = chartArea.top;
                y2 = chartArea.bottom;
                ty1 = borderValue + axisHalfWidth;
                ty2 = ty1 + tl;
            } else if (axis === 'y') {
                if (position === 'center') {
                    borderValue = alignBorderValue((chartArea.left + chartArea.right) / 2);
                } else if (isObject(position)) {
                    const positionAxisID = Object.keys(position)[0];
                    const value = position[positionAxisID];
                    borderValue = alignBorderValue(this.chart.scales[positionAxisID].getPixelForValue(value));
                }
                tx1 = borderValue - axisHalfWidth;
                tx2 = tx1 - tl;
                x1 = chartArea.left;
                x2 = chartArea.right;
            }
            const limit = valueOrDefault(options.ticks.maxTicksLimit, ticksLength);
            const step = Math.max(1, Math.ceil(ticksLength / limit));
            for(i = 0; i < ticksLength; i += step){
                const context = this.getContext(i);
                const optsAtIndex = grid.setContext(context);
                const optsAtIndexBorder = border.setContext(context);
                const lineWidth = optsAtIndex.lineWidth;
                const lineColor = optsAtIndex.color;
                const borderDash = optsAtIndexBorder.dash || [];
                const borderDashOffset = optsAtIndexBorder.dashOffset;
                const tickWidth = optsAtIndex.tickWidth;
                const tickColor = optsAtIndex.tickColor;
                const tickBorderDash = optsAtIndex.tickBorderDash || [];
                const tickBorderDashOffset = optsAtIndex.tickBorderDashOffset;
                lineValue = getPixelForGridLine(this, i, offset);
                if (lineValue === undefined) {
                    continue;
                }
                alignedLineValue = _alignPixel(chart, lineValue, lineWidth);
                if (isHorizontal) {
                    tx1 = tx2 = x1 = x2 = alignedLineValue;
                } else {
                    ty1 = ty2 = y1 = y2 = alignedLineValue;
                }
                items.push({
                    tx1,
                    ty1,
                    tx2,
                    ty2,
                    x1,
                    y1,
                    x2,
                    y2,
                    width: lineWidth,
                    color: lineColor,
                    borderDash,
                    borderDashOffset,
                    tickWidth,
                    tickColor,
                    tickBorderDash,
                    tickBorderDashOffset
                });
            }
            this._ticksLength = ticksLength;
            this._borderValue = borderValue;
            return items;
        }
     _computeLabelItems(chartArea) {
            const axis = this.axis;
            const options = this.options;
            const { position , ticks: optionTicks  } = options;
            const isHorizontal = this.isHorizontal();
            const ticks = this.ticks;
            const { align , crossAlign , padding , mirror  } = optionTicks;
            const tl = getTickMarkLength(options.grid);
            const tickAndPadding = tl + padding;
            const hTickAndPadding = mirror ? -padding : tickAndPadding;
            const rotation = -toRadians(this.labelRotation);
            const items = [];
            let i, ilen, tick, label, x, y, textAlign, pixel, font, lineHeight, lineCount, textOffset;
            let textBaseline = 'middle';
            if (position === 'top') {
                y = this.bottom - hTickAndPadding;
                textAlign = this._getXAxisLabelAlignment();
            } else if (position === 'bottom') {
                y = this.top + hTickAndPadding;
                textAlign = this._getXAxisLabelAlignment();
            } else if (position === 'left') {
                const ret = this._getYAxisLabelAlignment(tl);
                textAlign = ret.textAlign;
                x = ret.x;
            } else if (position === 'right') {
                const ret = this._getYAxisLabelAlignment(tl);
                textAlign = ret.textAlign;
                x = ret.x;
            } else if (axis === 'x') {
                if (position === 'center') {
                    y = (chartArea.top + chartArea.bottom) / 2 + tickAndPadding;
                } else if (isObject(position)) {
                    const positionAxisID = Object.keys(position)[0];
                    const value = position[positionAxisID];
                    y = this.chart.scales[positionAxisID].getPixelForValue(value) + tickAndPadding;
                }
                textAlign = this._getXAxisLabelAlignment();
            } else if (axis === 'y') {
                if (position === 'center') {
                    x = (chartArea.left + chartArea.right) / 2 - tickAndPadding;
                } else if (isObject(position)) {
                    const positionAxisID = Object.keys(position)[0];
                    const value = position[positionAxisID];
                    x = this.chart.scales[positionAxisID].getPixelForValue(value);
                }
                textAlign = this._getYAxisLabelAlignment(tl).textAlign;
            }
            if (axis === 'y') {
                if (align === 'start') {
                    textBaseline = 'top';
                } else if (align === 'end') {
                    textBaseline = 'bottom';
                }
            }
            const labelSizes = this._getLabelSizes();
            for(i = 0, ilen = ticks.length; i < ilen; ++i){
                tick = ticks[i];
                label = tick.label;
                const optsAtIndex = optionTicks.setContext(this.getContext(i));
                pixel = this.getPixelForTick(i) + optionTicks.labelOffset;
                font = this._resolveTickFontOptions(i);
                lineHeight = font.lineHeight;
                lineCount = isArray(label) ? label.length : 1;
                const halfCount = lineCount / 2;
                const color = optsAtIndex.color;
                const strokeColor = optsAtIndex.textStrokeColor;
                const strokeWidth = optsAtIndex.textStrokeWidth;
                let tickTextAlign = textAlign;
                if (isHorizontal) {
                    x = pixel;
                    if (textAlign === 'inner') {
                        if (i === ilen - 1) {
                            tickTextAlign = !this.options.reverse ? 'right' : 'left';
                        } else if (i === 0) {
                            tickTextAlign = !this.options.reverse ? 'left' : 'right';
                        } else {
                            tickTextAlign = 'center';
                        }
                    }
                    if (position === 'top') {
                        if (crossAlign === 'near' || rotation !== 0) {
                            textOffset = -lineCount * lineHeight + lineHeight / 2;
                        } else if (crossAlign === 'center') {
                            textOffset = -labelSizes.highest.height / 2 - halfCount * lineHeight + lineHeight;
                        } else {
                            textOffset = -labelSizes.highest.height + lineHeight / 2;
                        }
                    } else {
                        if (crossAlign === 'near' || rotation !== 0) {
                            textOffset = lineHeight / 2;
                        } else if (crossAlign === 'center') {
                            textOffset = labelSizes.highest.height / 2 - halfCount * lineHeight;
                        } else {
                            textOffset = labelSizes.highest.height - lineCount * lineHeight;
                        }
                    }
                    if (mirror) {
                        textOffset *= -1;
                    }
                    if (rotation !== 0 && !optsAtIndex.showLabelBackdrop) {
                        x += lineHeight / 2 * Math.sin(rotation);
                    }
                } else {
                    y = pixel;
                    textOffset = (1 - lineCount) * lineHeight / 2;
                }
                let backdrop;
                if (optsAtIndex.showLabelBackdrop) {
                    const labelPadding = toPadding(optsAtIndex.backdropPadding);
                    const height = labelSizes.heights[i];
                    const width = labelSizes.widths[i];
                    let top = textOffset - labelPadding.top;
                    let left = 0 - labelPadding.left;
                    switch(textBaseline){
                        case 'middle':
                            top -= height / 2;
                            break;
                        case 'bottom':
                            top -= height;
                            break;
                    }
                    switch(textAlign){
                        case 'center':
                            left -= width / 2;
                            break;
                        case 'right':
                            left -= width;
                            break;
                        case 'inner':
                            if (i === ilen - 1) {
                                left -= width;
                            } else if (i > 0) {
                                left -= width / 2;
                            }
                            break;
                    }
                    backdrop = {
                        left,
                        top,
                        width: width + labelPadding.width,
                        height: height + labelPadding.height,
                        color: optsAtIndex.backdropColor
                    };
                }
                items.push({
                    label,
                    font,
                    textOffset,
                    options: {
                        rotation,
                        color,
                        strokeColor,
                        strokeWidth,
                        textAlign: tickTextAlign,
                        textBaseline,
                        translation: [
                            x,
                            y
                        ],
                        backdrop
                    }
                });
            }
            return items;
        }
        _getXAxisLabelAlignment() {
            const { position , ticks  } = this.options;
            const rotation = -toRadians(this.labelRotation);
            if (rotation) {
                return position === 'top' ? 'left' : 'right';
            }
            let align = 'center';
            if (ticks.align === 'start') {
                align = 'left';
            } else if (ticks.align === 'end') {
                align = 'right';
            } else if (ticks.align === 'inner') {
                align = 'inner';
            }
            return align;
        }
        _getYAxisLabelAlignment(tl) {
            const { position , ticks: { crossAlign , mirror , padding  }  } = this.options;
            const labelSizes = this._getLabelSizes();
            const tickAndPadding = tl + padding;
            const widest = labelSizes.widest.width;
            let textAlign;
            let x;
            if (position === 'left') {
                if (mirror) {
                    x = this.right + padding;
                    if (crossAlign === 'near') {
                        textAlign = 'left';
                    } else if (crossAlign === 'center') {
                        textAlign = 'center';
                        x += widest / 2;
                    } else {
                        textAlign = 'right';
                        x += widest;
                    }
                } else {
                    x = this.right - tickAndPadding;
                    if (crossAlign === 'near') {
                        textAlign = 'right';
                    } else if (crossAlign === 'center') {
                        textAlign = 'center';
                        x -= widest / 2;
                    } else {
                        textAlign = 'left';
                        x = this.left;
                    }
                }
            } else if (position === 'right') {
                if (mirror) {
                    x = this.left + padding;
                    if (crossAlign === 'near') {
                        textAlign = 'right';
                    } else if (crossAlign === 'center') {
                        textAlign = 'center';
                        x -= widest / 2;
                    } else {
                        textAlign = 'left';
                        x -= widest;
                    }
                } else {
                    x = this.left + tickAndPadding;
                    if (crossAlign === 'near') {
                        textAlign = 'left';
                    } else if (crossAlign === 'center') {
                        textAlign = 'center';
                        x += widest / 2;
                    } else {
                        textAlign = 'right';
                        x = this.right;
                    }
                }
            } else {
                textAlign = 'right';
            }
            return {
                textAlign,
                x
            };
        }
     _computeLabelArea() {
            if (this.options.ticks.mirror) {
                return;
            }
            const chart = this.chart;
            const position = this.options.position;
            if (position === 'left' || position === 'right') {
                return {
                    top: 0,
                    left: this.left,
                    bottom: chart.height,
                    right: this.right
                };
            }
            if (position === 'top' || position === 'bottom') {
                return {
                    top: this.top,
                    left: 0,
                    bottom: this.bottom,
                    right: chart.width
                };
            }
        }
     drawBackground() {
            const { ctx , options: { backgroundColor  } , left , top , width , height  } = this;
            if (backgroundColor) {
                ctx.save();
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(left, top, width, height);
                ctx.restore();
            }
        }
        getLineWidthForValue(value) {
            const grid = this.options.grid;
            if (!this._isVisible() || !grid.display) {
                return 0;
            }
            const ticks = this.ticks;
            const index = ticks.findIndex((t)=>t.value === value);
            if (index >= 0) {
                const opts = grid.setContext(this.getContext(index));
                return opts.lineWidth;
            }
            return 0;
        }
     drawGrid(chartArea) {
            const grid = this.options.grid;
            const ctx = this.ctx;
            const items = this._gridLineItems || (this._gridLineItems = this._computeGridLineItems(chartArea));
            let i, ilen;
            const drawLine = (p1, p2, style)=>{
                if (!style.width || !style.color) {
                    return;
                }
                ctx.save();
                ctx.lineWidth = style.width;
                ctx.strokeStyle = style.color;
                ctx.setLineDash(style.borderDash || []);
                ctx.lineDashOffset = style.borderDashOffset;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
                ctx.restore();
            };
            if (grid.display) {
                for(i = 0, ilen = items.length; i < ilen; ++i){
                    const item = items[i];
                    if (grid.drawOnChartArea) {
                        drawLine({
                            x: item.x1,
                            y: item.y1
                        }, {
                            x: item.x2,
                            y: item.y2
                        }, item);
                    }
                    if (grid.drawTicks) {
                        drawLine({
                            x: item.tx1,
                            y: item.ty1
                        }, {
                            x: item.tx2,
                            y: item.ty2
                        }, {
                            color: item.tickColor,
                            width: item.tickWidth,
                            borderDash: item.tickBorderDash,
                            borderDashOffset: item.tickBorderDashOffset
                        });
                    }
                }
            }
        }
     drawBorder() {
            const { chart , ctx , options: { border , grid  }  } = this;
            const borderOpts = border.setContext(this.getContext());
            const axisWidth = border.display ? borderOpts.width : 0;
            if (!axisWidth) {
                return;
            }
            const lastLineWidth = grid.setContext(this.getContext(0)).lineWidth;
            const borderValue = this._borderValue;
            let x1, x2, y1, y2;
            if (this.isHorizontal()) {
                x1 = _alignPixel(chart, this.left, axisWidth) - axisWidth / 2;
                x2 = _alignPixel(chart, this.right, lastLineWidth) + lastLineWidth / 2;
                y1 = y2 = borderValue;
            } else {
                y1 = _alignPixel(chart, this.top, axisWidth) - axisWidth / 2;
                y2 = _alignPixel(chart, this.bottom, lastLineWidth) + lastLineWidth / 2;
                x1 = x2 = borderValue;
            }
            ctx.save();
            ctx.lineWidth = borderOpts.width;
            ctx.strokeStyle = borderOpts.color;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.restore();
        }
     drawLabels(chartArea) {
            const optionTicks = this.options.ticks;
            if (!optionTicks.display) {
                return;
            }
            const ctx = this.ctx;
            const area = this._computeLabelArea();
            if (area) {
                clipArea(ctx, area);
            }
            const items = this.getLabelItems(chartArea);
            for (const item of items){
                const renderTextOptions = item.options;
                const tickFont = item.font;
                const label = item.label;
                const y = item.textOffset;
                renderText(ctx, label, 0, y, tickFont, renderTextOptions);
            }
            if (area) {
                unclipArea(ctx);
            }
        }
     drawTitle() {
            const { ctx , options: { position , title , reverse  }  } = this;
            if (!title.display) {
                return;
            }
            const font = toFont(title.font);
            const padding = toPadding(title.padding);
            const align = title.align;
            let offset = font.lineHeight / 2;
            if (position === 'bottom' || position === 'center' || isObject(position)) {
                offset += padding.bottom;
                if (isArray(title.text)) {
                    offset += font.lineHeight * (title.text.length - 1);
                }
            } else {
                offset += padding.top;
            }
            const { titleX , titleY , maxWidth , rotation  } = titleArgs(this, offset, position, align);
            renderText(ctx, title.text, 0, 0, font, {
                color: title.color,
                maxWidth,
                rotation,
                textAlign: titleAlign(align, position, reverse),
                textBaseline: 'middle',
                translation: [
                    titleX,
                    titleY
                ]
            });
        }
        draw(chartArea) {
            if (!this._isVisible()) {
                return;
            }
            this.drawBackground();
            this.drawGrid(chartArea);
            this.drawBorder();
            this.drawTitle();
            this.drawLabels(chartArea);
        }
     _layers() {
            const opts = this.options;
            const tz = opts.ticks && opts.ticks.z || 0;
            const gz = valueOrDefault(opts.grid && opts.grid.z, -1);
            const bz = valueOrDefault(opts.border && opts.border.z, 0);
            if (!this._isVisible() || this.draw !== Scale.prototype.draw) {
                return [
                    {
                        z: tz,
                        draw: (chartArea)=>{
                            this.draw(chartArea);
                        }
                    }
                ];
            }
            return [
                {
                    z: gz,
                    draw: (chartArea)=>{
                        this.drawBackground();
                        this.drawGrid(chartArea);
                        this.drawTitle();
                    }
                },
                {
                    z: bz,
                    draw: ()=>{
                        this.drawBorder();
                    }
                },
                {
                    z: tz,
                    draw: (chartArea)=>{
                        this.drawLabels(chartArea);
                    }
                }
            ];
        }
     getMatchingVisibleMetas(type) {
            const metas = this.chart.getSortedVisibleDatasetMetas();
            const axisID = this.axis + 'AxisID';
            const result = [];
            let i, ilen;
            for(i = 0, ilen = metas.length; i < ilen; ++i){
                const meta = metas[i];
                if (meta[axisID] === this.id && (!type || meta.type === type)) {
                    result.push(meta);
                }
            }
            return result;
        }
     _resolveTickFontOptions(index) {
            const opts = this.options.ticks.setContext(this.getContext(index));
            return toFont(opts.font);
        }
     _maxDigits() {
            const fontSize = this._resolveTickFontOptions(0).lineHeight;
            return (this.isHorizontal() ? this.width : this.height) / fontSize;
        }
    }

    class TypedRegistry {
        constructor(type, scope, override){
            this.type = type;
            this.scope = scope;
            this.override = override;
            this.items = Object.create(null);
        }
        isForType(type) {
            return Object.prototype.isPrototypeOf.call(this.type.prototype, type.prototype);
        }
     register(item) {
            const proto = Object.getPrototypeOf(item);
            let parentScope;
            if (isIChartComponent(proto)) {
                parentScope = this.register(proto);
            }
            const items = this.items;
            const id = item.id;
            const scope = this.scope + '.' + id;
            if (!id) {
                throw new Error('class does not have id: ' + item);
            }
            if (id in items) {
                return scope;
            }
            items[id] = item;
            registerDefaults(item, scope, parentScope);
            if (this.override) {
                defaults.override(item.id, item.overrides);
            }
            return scope;
        }
     get(id) {
            return this.items[id];
        }
     unregister(item) {
            const items = this.items;
            const id = item.id;
            const scope = this.scope;
            if (id in items) {
                delete items[id];
            }
            if (scope && id in defaults[scope]) {
                delete defaults[scope][id];
                if (this.override) {
                    delete overrides[id];
                }
            }
        }
    }
    function registerDefaults(item, scope, parentScope) {
        const itemDefaults = merge(Object.create(null), [
            parentScope ? defaults.get(parentScope) : {},
            defaults.get(scope),
            item.defaults
        ]);
        defaults.set(scope, itemDefaults);
        if (item.defaultRoutes) {
            routeDefaults(scope, item.defaultRoutes);
        }
        if (item.descriptors) {
            defaults.describe(scope, item.descriptors);
        }
    }
    function routeDefaults(scope, routes) {
        Object.keys(routes).forEach((property)=>{
            const propertyParts = property.split('.');
            const sourceName = propertyParts.pop();
            const sourceScope = [
                scope
            ].concat(propertyParts).join('.');
            const parts = routes[property].split('.');
            const targetName = parts.pop();
            const targetScope = parts.join('.');
            defaults.route(sourceScope, sourceName, targetScope, targetName);
        });
    }
    function isIChartComponent(proto) {
        return 'id' in proto && 'defaults' in proto;
    }

    class Registry {
        constructor(){
            this.controllers = new TypedRegistry(DatasetController, 'datasets', true);
            this.elements = new TypedRegistry(Element, 'elements');
            this.plugins = new TypedRegistry(Object, 'plugins');
            this.scales = new TypedRegistry(Scale, 'scales');
            this._typedRegistries = [
                this.controllers,
                this.scales,
                this.elements
            ];
        }
     add(...args) {
            this._each('register', args);
        }
        remove(...args) {
            this._each('unregister', args);
        }
     addControllers(...args) {
            this._each('register', args, this.controllers);
        }
     addElements(...args) {
            this._each('register', args, this.elements);
        }
     addPlugins(...args) {
            this._each('register', args, this.plugins);
        }
     addScales(...args) {
            this._each('register', args, this.scales);
        }
     getController(id) {
            return this._get(id, this.controllers, 'controller');
        }
     getElement(id) {
            return this._get(id, this.elements, 'element');
        }
     getPlugin(id) {
            return this._get(id, this.plugins, 'plugin');
        }
     getScale(id) {
            return this._get(id, this.scales, 'scale');
        }
     removeControllers(...args) {
            this._each('unregister', args, this.controllers);
        }
     removeElements(...args) {
            this._each('unregister', args, this.elements);
        }
     removePlugins(...args) {
            this._each('unregister', args, this.plugins);
        }
     removeScales(...args) {
            this._each('unregister', args, this.scales);
        }
     _each(method, args, typedRegistry) {
            [
                ...args
            ].forEach((arg)=>{
                const reg = typedRegistry || this._getRegistryForType(arg);
                if (typedRegistry || reg.isForType(arg) || reg === this.plugins && arg.id) {
                    this._exec(method, reg, arg);
                } else {
                    each(arg, (item)=>{
                        const itemReg = typedRegistry || this._getRegistryForType(item);
                        this._exec(method, itemReg, item);
                    });
                }
            });
        }
     _exec(method, registry, component) {
            const camelMethod = _capitalize(method);
            callback(component['before' + camelMethod], [], component);
            registry[method](component);
            callback(component['after' + camelMethod], [], component);
        }
     _getRegistryForType(type) {
            for(let i = 0; i < this._typedRegistries.length; i++){
                const reg = this._typedRegistries[i];
                if (reg.isForType(type)) {
                    return reg;
                }
            }
            return this.plugins;
        }
     _get(id, typedRegistry, type) {
            const item = typedRegistry.get(id);
            if (item === undefined) {
                throw new Error('"' + id + '" is not a registered ' + type + '.');
            }
            return item;
        }
    }
    var registry = /* #__PURE__ */ new Registry();

    class PluginService {
        constructor(){
            this._init = undefined;
        }
     notify(chart, hook, args, filter) {
            if (hook === 'beforeInit') {
                this._init = this._createDescriptors(chart, true);
                this._notify(this._init, chart, 'install');
            }
            if (this._init === undefined) {
                return;
            }
            const descriptors = filter ? this._descriptors(chart).filter(filter) : this._descriptors(chart);
            const result = this._notify(descriptors, chart, hook, args);
            if (hook === 'afterDestroy') {
                this._notify(descriptors, chart, 'stop');
                this._notify(this._init, chart, 'uninstall');
                this._init = undefined;
            }
            return result;
        }
     _notify(descriptors, chart, hook, args) {
            args = args || {};
            for (const descriptor of descriptors){
                const plugin = descriptor.plugin;
                const method = plugin[hook];
                const params = [
                    chart,
                    args,
                    descriptor.options
                ];
                if (callback(method, params, plugin) === false && args.cancelable) {
                    return false;
                }
            }
            return true;
        }
        invalidate() {
            if (!isNullOrUndef(this._cache)) {
                this._oldCache = this._cache;
                this._cache = undefined;
            }
        }
     _descriptors(chart) {
            if (this._cache) {
                return this._cache;
            }
            const descriptors = this._cache = this._createDescriptors(chart);
            this._notifyStateChanges(chart);
            return descriptors;
        }
        _createDescriptors(chart, all) {
            const config = chart && chart.config;
            const options = valueOrDefault(config.options && config.options.plugins, {});
            const plugins = allPlugins(config);
            return options === false && !all ? [] : createDescriptors(chart, plugins, options, all);
        }
     _notifyStateChanges(chart) {
            const previousDescriptors = this._oldCache || [];
            const descriptors = this._cache;
            const diff = (a, b)=>a.filter((x)=>!b.some((y)=>x.plugin.id === y.plugin.id));
            this._notify(diff(previousDescriptors, descriptors), chart, 'stop');
            this._notify(diff(descriptors, previousDescriptors), chart, 'start');
        }
    }
     function allPlugins(config) {
        const localIds = {};
        const plugins = [];
        const keys = Object.keys(registry.plugins.items);
        for(let i = 0; i < keys.length; i++){
            plugins.push(registry.getPlugin(keys[i]));
        }
        const local = config.plugins || [];
        for(let i = 0; i < local.length; i++){
            const plugin = local[i];
            if (plugins.indexOf(plugin) === -1) {
                plugins.push(plugin);
                localIds[plugin.id] = true;
            }
        }
        return {
            plugins,
            localIds
        };
    }
    function getOpts(options, all) {
        if (!all && options === false) {
            return null;
        }
        if (options === true) {
            return {};
        }
        return options;
    }
    function createDescriptors(chart, { plugins , localIds  }, options, all) {
        const result = [];
        const context = chart.getContext();
        for (const plugin of plugins){
            const id = plugin.id;
            const opts = getOpts(options[id], all);
            if (opts === null) {
                continue;
            }
            result.push({
                plugin,
                options: pluginOpts(chart.config, {
                    plugin,
                    local: localIds[id]
                }, opts, context)
            });
        }
        return result;
    }
    function pluginOpts(config, { plugin , local  }, opts, context) {
        const keys = config.pluginScopeKeys(plugin);
        const scopes = config.getOptionScopes(opts, keys);
        if (local && plugin.defaults) {
            scopes.push(plugin.defaults);
        }
        return config.createResolver(scopes, context, [
            ''
        ], {
            scriptable: false,
            indexable: false,
            allKeys: true
        });
    }

    function getIndexAxis(type, options) {
        const datasetDefaults = defaults.datasets[type] || {};
        const datasetOptions = (options.datasets || {})[type] || {};
        return datasetOptions.indexAxis || options.indexAxis || datasetDefaults.indexAxis || 'x';
    }
    function getAxisFromDefaultScaleID(id, indexAxis) {
        let axis = id;
        if (id === '_index_') {
            axis = indexAxis;
        } else if (id === '_value_') {
            axis = indexAxis === 'x' ? 'y' : 'x';
        }
        return axis;
    }
    function getDefaultScaleIDFromAxis(axis, indexAxis) {
        return axis === indexAxis ? '_index_' : '_value_';
    }
    function idMatchesAxis(id) {
        if (id === 'x' || id === 'y' || id === 'r') {
            return id;
        }
    }
    function axisFromPosition(position) {
        if (position === 'top' || position === 'bottom') {
            return 'x';
        }
        if (position === 'left' || position === 'right') {
            return 'y';
        }
    }
    function determineAxis(id, ...scaleOptions) {
        if (idMatchesAxis(id)) {
            return id;
        }
        for (const opts of scaleOptions){
            const axis = opts.axis || axisFromPosition(opts.position) || id.length > 1 && idMatchesAxis(id[0].toLowerCase());
            if (axis) {
                return axis;
            }
        }
        throw new Error(`Cannot determine type of '${id}' axis. Please provide 'axis' or 'position' option.`);
    }
    function getAxisFromDataset(id, axis, dataset) {
        if (dataset[axis + 'AxisID'] === id) {
            return {
                axis
            };
        }
    }
    function retrieveAxisFromDatasets(id, config) {
        if (config.data && config.data.datasets) {
            const boundDs = config.data.datasets.filter((d)=>d.xAxisID === id || d.yAxisID === id);
            if (boundDs.length) {
                return getAxisFromDataset(id, 'x', boundDs[0]) || getAxisFromDataset(id, 'y', boundDs[0]);
            }
        }
        return {};
    }
    function mergeScaleConfig(config, options) {
        const chartDefaults = overrides[config.type] || {
            scales: {}
        };
        const configScales = options.scales || {};
        const chartIndexAxis = getIndexAxis(config.type, options);
        const scales = Object.create(null);
        Object.keys(configScales).forEach((id)=>{
            const scaleConf = configScales[id];
            if (!isObject(scaleConf)) {
                return console.error(`Invalid scale configuration for scale: ${id}`);
            }
            if (scaleConf._proxy) {
                return console.warn(`Ignoring resolver passed as options for scale: ${id}`);
            }
            const axis = determineAxis(id, scaleConf, retrieveAxisFromDatasets(id, config), defaults.scales[scaleConf.type]);
            const defaultId = getDefaultScaleIDFromAxis(axis, chartIndexAxis);
            const defaultScaleOptions = chartDefaults.scales || {};
            scales[id] = mergeIf(Object.create(null), [
                {
                    axis
                },
                scaleConf,
                defaultScaleOptions[axis],
                defaultScaleOptions[defaultId]
            ]);
        });
        config.data.datasets.forEach((dataset)=>{
            const type = dataset.type || config.type;
            const indexAxis = dataset.indexAxis || getIndexAxis(type, options);
            const datasetDefaults = overrides[type] || {};
            const defaultScaleOptions = datasetDefaults.scales || {};
            Object.keys(defaultScaleOptions).forEach((defaultID)=>{
                const axis = getAxisFromDefaultScaleID(defaultID, indexAxis);
                const id = dataset[axis + 'AxisID'] || axis;
                scales[id] = scales[id] || Object.create(null);
                mergeIf(scales[id], [
                    {
                        axis
                    },
                    configScales[id],
                    defaultScaleOptions[defaultID]
                ]);
            });
        });
        Object.keys(scales).forEach((key)=>{
            const scale = scales[key];
            mergeIf(scale, [
                defaults.scales[scale.type],
                defaults.scale
            ]);
        });
        return scales;
    }
    function initOptions(config) {
        const options = config.options || (config.options = {});
        options.plugins = valueOrDefault(options.plugins, {});
        options.scales = mergeScaleConfig(config, options);
    }
    function initData(data) {
        data = data || {};
        data.datasets = data.datasets || [];
        data.labels = data.labels || [];
        return data;
    }
    function initConfig(config) {
        config = config || {};
        config.data = initData(config.data);
        initOptions(config);
        return config;
    }
    const keyCache = new Map();
    const keysCached = new Set();
    function cachedKeys(cacheKey, generate) {
        let keys = keyCache.get(cacheKey);
        if (!keys) {
            keys = generate();
            keyCache.set(cacheKey, keys);
            keysCached.add(keys);
        }
        return keys;
    }
    const addIfFound = (set, obj, key)=>{
        const opts = resolveObjectKey(obj, key);
        if (opts !== undefined) {
            set.add(opts);
        }
    };
    class Config {
        constructor(config){
            this._config = initConfig(config);
            this._scopeCache = new Map();
            this._resolverCache = new Map();
        }
        get platform() {
            return this._config.platform;
        }
        get type() {
            return this._config.type;
        }
        set type(type) {
            this._config.type = type;
        }
        get data() {
            return this._config.data;
        }
        set data(data) {
            this._config.data = initData(data);
        }
        get options() {
            return this._config.options;
        }
        set options(options) {
            this._config.options = options;
        }
        get plugins() {
            return this._config.plugins;
        }
        update() {
            const config = this._config;
            this.clearCache();
            initOptions(config);
        }
        clearCache() {
            this._scopeCache.clear();
            this._resolverCache.clear();
        }
     datasetScopeKeys(datasetType) {
            return cachedKeys(datasetType, ()=>[
                    [
                        `datasets.${datasetType}`,
                        ''
                    ]
                ]);
        }
     datasetAnimationScopeKeys(datasetType, transition) {
            return cachedKeys(`${datasetType}.transition.${transition}`, ()=>[
                    [
                        `datasets.${datasetType}.transitions.${transition}`,
                        `transitions.${transition}`
                    ],
                    [
                        `datasets.${datasetType}`,
                        ''
                    ]
                ]);
        }
     datasetElementScopeKeys(datasetType, elementType) {
            return cachedKeys(`${datasetType}-${elementType}`, ()=>[
                    [
                        `datasets.${datasetType}.elements.${elementType}`,
                        `datasets.${datasetType}`,
                        `elements.${elementType}`,
                        ''
                    ]
                ]);
        }
     pluginScopeKeys(plugin) {
            const id = plugin.id;
            const type = this.type;
            return cachedKeys(`${type}-plugin-${id}`, ()=>[
                    [
                        `plugins.${id}`,
                        ...plugin.additionalOptionScopes || []
                    ]
                ]);
        }
     _cachedScopes(mainScope, resetCache) {
            const _scopeCache = this._scopeCache;
            let cache = _scopeCache.get(mainScope);
            if (!cache || resetCache) {
                cache = new Map();
                _scopeCache.set(mainScope, cache);
            }
            return cache;
        }
     getOptionScopes(mainScope, keyLists, resetCache) {
            const { options , type  } = this;
            const cache = this._cachedScopes(mainScope, resetCache);
            const cached = cache.get(keyLists);
            if (cached) {
                return cached;
            }
            const scopes = new Set();
            keyLists.forEach((keys)=>{
                if (mainScope) {
                    scopes.add(mainScope);
                    keys.forEach((key)=>addIfFound(scopes, mainScope, key));
                }
                keys.forEach((key)=>addIfFound(scopes, options, key));
                keys.forEach((key)=>addIfFound(scopes, overrides[type] || {}, key));
                keys.forEach((key)=>addIfFound(scopes, defaults, key));
                keys.forEach((key)=>addIfFound(scopes, descriptors, key));
            });
            const array = Array.from(scopes);
            if (array.length === 0) {
                array.push(Object.create(null));
            }
            if (keysCached.has(keyLists)) {
                cache.set(keyLists, array);
            }
            return array;
        }
     chartOptionScopes() {
            const { options , type  } = this;
            return [
                options,
                overrides[type] || {},
                defaults.datasets[type] || {},
                {
                    type
                },
                defaults,
                descriptors
            ];
        }
     resolveNamedOptions(scopes, names, context, prefixes = [
            ''
        ]) {
            const result = {
                $shared: true
            };
            const { resolver , subPrefixes  } = getResolver(this._resolverCache, scopes, prefixes);
            let options = resolver;
            if (needContext(resolver, names)) {
                result.$shared = false;
                context = isFunction(context) ? context() : context;
                const subResolver = this.createResolver(scopes, context, subPrefixes);
                options = _attachContext(resolver, context, subResolver);
            }
            for (const prop of names){
                result[prop] = options[prop];
            }
            return result;
        }
     createResolver(scopes, context, prefixes = [
            ''
        ], descriptorDefaults) {
            const { resolver  } = getResolver(this._resolverCache, scopes, prefixes);
            return isObject(context) ? _attachContext(resolver, context, undefined, descriptorDefaults) : resolver;
        }
    }
    function getResolver(resolverCache, scopes, prefixes) {
        let cache = resolverCache.get(scopes);
        if (!cache) {
            cache = new Map();
            resolverCache.set(scopes, cache);
        }
        const cacheKey = prefixes.join();
        let cached = cache.get(cacheKey);
        if (!cached) {
            const resolver = _createResolver(scopes, prefixes);
            cached = {
                resolver,
                subPrefixes: prefixes.filter((p)=>!p.toLowerCase().includes('hover'))
            };
            cache.set(cacheKey, cached);
        }
        return cached;
    }
    const hasFunction = (value)=>isObject(value) && Object.getOwnPropertyNames(value).some((key)=>isFunction(value[key]));
    function needContext(proxy, names) {
        const { isScriptable , isIndexable  } = _descriptors(proxy);
        for (const prop of names){
            const scriptable = isScriptable(prop);
            const indexable = isIndexable(prop);
            const value = (indexable || scriptable) && proxy[prop];
            if (scriptable && (isFunction(value) || hasFunction(value)) || indexable && isArray(value)) {
                return true;
            }
        }
        return false;
    }

    var version = "4.5.1";

    const KNOWN_POSITIONS = [
        'top',
        'bottom',
        'left',
        'right',
        'chartArea'
    ];
    function positionIsHorizontal(position, axis) {
        return position === 'top' || position === 'bottom' || KNOWN_POSITIONS.indexOf(position) === -1 && axis === 'x';
    }
    function compare2Level(l1, l2) {
        return function(a, b) {
            return a[l1] === b[l1] ? a[l2] - b[l2] : a[l1] - b[l1];
        };
    }
    function onAnimationsComplete(context) {
        const chart = context.chart;
        const animationOptions = chart.options.animation;
        chart.notifyPlugins('afterRender');
        callback(animationOptions && animationOptions.onComplete, [
            context
        ], chart);
    }
    function onAnimationProgress(context) {
        const chart = context.chart;
        const animationOptions = chart.options.animation;
        callback(animationOptions && animationOptions.onProgress, [
            context
        ], chart);
    }
     function getCanvas(item) {
        if (_isDomSupported() && typeof item === 'string') {
            item = document.getElementById(item);
        } else if (item && item.length) {
            item = item[0];
        }
        if (item && item.canvas) {
            item = item.canvas;
        }
        return item;
    }
    const instances = {};
    const getChart = (key)=>{
        const canvas = getCanvas(key);
        return Object.values(instances).filter((c)=>c.canvas === canvas).pop();
    };
    function moveNumericKeys(obj, start, move) {
        const keys = Object.keys(obj);
        for (const key of keys){
            const intKey = +key;
            if (intKey >= start) {
                const value = obj[key];
                delete obj[key];
                if (move > 0 || intKey > start) {
                    obj[intKey + move] = value;
                }
            }
        }
    }
     function determineLastEvent(e, lastEvent, inChartArea, isClick) {
        if (!inChartArea || e.type === 'mouseout') {
            return null;
        }
        if (isClick) {
            return lastEvent;
        }
        return e;
    }
    class Chart {
        static defaults = defaults;
        static instances = instances;
        static overrides = overrides;
        static registry = registry;
        static version = version;
        static getChart = getChart;
        static register(...items) {
            registry.add(...items);
            invalidatePlugins();
        }
        static unregister(...items) {
            registry.remove(...items);
            invalidatePlugins();
        }
        constructor(item, userConfig){
            const config = this.config = new Config(userConfig);
            const initialCanvas = getCanvas(item);
            const existingChart = getChart(initialCanvas);
            if (existingChart) {
                throw new Error('Canvas is already in use. Chart with ID \'' + existingChart.id + '\'' + ' must be destroyed before the canvas with ID \'' + existingChart.canvas.id + '\' can be reused.');
            }
            const options = config.createResolver(config.chartOptionScopes(), this.getContext());
            this.platform = new (config.platform || _detectPlatform(initialCanvas))();
            this.platform.updateConfig(config);
            const context = this.platform.acquireContext(initialCanvas, options.aspectRatio);
            const canvas = context && context.canvas;
            const height = canvas && canvas.height;
            const width = canvas && canvas.width;
            this.id = uid();
            this.ctx = context;
            this.canvas = canvas;
            this.width = width;
            this.height = height;
            this._options = options;
            this._aspectRatio = this.aspectRatio;
            this._layers = [];
            this._metasets = [];
            this._stacks = undefined;
            this.boxes = [];
            this.currentDevicePixelRatio = undefined;
            this.chartArea = undefined;
            this._active = [];
            this._lastEvent = undefined;
            this._listeners = {};
             this._responsiveListeners = undefined;
            this._sortedMetasets = [];
            this.scales = {};
            this._plugins = new PluginService();
            this.$proxies = {};
            this._hiddenIndices = {};
            this.attached = false;
            this._animationsDisabled = undefined;
            this.$context = undefined;
            this._doResize = debounce((mode)=>this.update(mode), options.resizeDelay || 0);
            this._dataChanges = [];
            instances[this.id] = this;
            if (!context || !canvas) {
                console.error("Failed to create chart: can't acquire context from the given item");
                return;
            }
            animator.listen(this, 'complete', onAnimationsComplete);
            animator.listen(this, 'progress', onAnimationProgress);
            this._initialize();
            if (this.attached) {
                this.update();
            }
        }
        get aspectRatio() {
            const { options: { aspectRatio , maintainAspectRatio  } , width , height , _aspectRatio  } = this;
            if (!isNullOrUndef(aspectRatio)) {
                return aspectRatio;
            }
            if (maintainAspectRatio && _aspectRatio) {
                return _aspectRatio;
            }
            return height ? width / height : null;
        }
        get data() {
            return this.config.data;
        }
        set data(data) {
            this.config.data = data;
        }
        get options() {
            return this._options;
        }
        set options(options) {
            this.config.options = options;
        }
        get registry() {
            return registry;
        }
     _initialize() {
            this.notifyPlugins('beforeInit');
            if (this.options.responsive) {
                this.resize();
            } else {
                retinaScale(this, this.options.devicePixelRatio);
            }
            this.bindEvents();
            this.notifyPlugins('afterInit');
            return this;
        }
        clear() {
            clearCanvas(this.canvas, this.ctx);
            return this;
        }
        stop() {
            animator.stop(this);
            return this;
        }
     resize(width, height) {
            if (!animator.running(this)) {
                this._resize(width, height);
            } else {
                this._resizeBeforeDraw = {
                    width,
                    height
                };
            }
        }
        _resize(width, height) {
            const options = this.options;
            const canvas = this.canvas;
            const aspectRatio = options.maintainAspectRatio && this.aspectRatio;
            const newSize = this.platform.getMaximumSize(canvas, width, height, aspectRatio);
            const newRatio = options.devicePixelRatio || this.platform.getDevicePixelRatio();
            const mode = this.width ? 'resize' : 'attach';
            this.width = newSize.width;
            this.height = newSize.height;
            this._aspectRatio = this.aspectRatio;
            if (!retinaScale(this, newRatio, true)) {
                return;
            }
            this.notifyPlugins('resize', {
                size: newSize
            });
            callback(options.onResize, [
                this,
                newSize
            ], this);
            if (this.attached) {
                if (this._doResize(mode)) {
                    this.render();
                }
            }
        }
        ensureScalesHaveIDs() {
            const options = this.options;
            const scalesOptions = options.scales || {};
            each(scalesOptions, (axisOptions, axisID)=>{
                axisOptions.id = axisID;
            });
        }
     buildOrUpdateScales() {
            const options = this.options;
            const scaleOpts = options.scales;
            const scales = this.scales;
            const updated = Object.keys(scales).reduce((obj, id)=>{
                obj[id] = false;
                return obj;
            }, {});
            let items = [];
            if (scaleOpts) {
                items = items.concat(Object.keys(scaleOpts).map((id)=>{
                    const scaleOptions = scaleOpts[id];
                    const axis = determineAxis(id, scaleOptions);
                    const isRadial = axis === 'r';
                    const isHorizontal = axis === 'x';
                    return {
                        options: scaleOptions,
                        dposition: isRadial ? 'chartArea' : isHorizontal ? 'bottom' : 'left',
                        dtype: isRadial ? 'radialLinear' : isHorizontal ? 'category' : 'linear'
                    };
                }));
            }
            each(items, (item)=>{
                const scaleOptions = item.options;
                const id = scaleOptions.id;
                const axis = determineAxis(id, scaleOptions);
                const scaleType = valueOrDefault(scaleOptions.type, item.dtype);
                if (scaleOptions.position === undefined || positionIsHorizontal(scaleOptions.position, axis) !== positionIsHorizontal(item.dposition)) {
                    scaleOptions.position = item.dposition;
                }
                updated[id] = true;
                let scale = null;
                if (id in scales && scales[id].type === scaleType) {
                    scale = scales[id];
                } else {
                    const scaleClass = registry.getScale(scaleType);
                    scale = new scaleClass({
                        id,
                        type: scaleType,
                        ctx: this.ctx,
                        chart: this
                    });
                    scales[scale.id] = scale;
                }
                scale.init(scaleOptions, options);
            });
            each(updated, (hasUpdated, id)=>{
                if (!hasUpdated) {
                    delete scales[id];
                }
            });
            each(scales, (scale)=>{
                layouts.configure(this, scale, scale.options);
                layouts.addBox(this, scale);
            });
        }
     _updateMetasets() {
            const metasets = this._metasets;
            const numData = this.data.datasets.length;
            const numMeta = metasets.length;
            metasets.sort((a, b)=>a.index - b.index);
            if (numMeta > numData) {
                for(let i = numData; i < numMeta; ++i){
                    this._destroyDatasetMeta(i);
                }
                metasets.splice(numData, numMeta - numData);
            }
            this._sortedMetasets = metasets.slice(0).sort(compare2Level('order', 'index'));
        }
     _removeUnreferencedMetasets() {
            const { _metasets: metasets , data: { datasets  }  } = this;
            if (metasets.length > datasets.length) {
                delete this._stacks;
            }
            metasets.forEach((meta, index)=>{
                if (datasets.filter((x)=>x === meta._dataset).length === 0) {
                    this._destroyDatasetMeta(index);
                }
            });
        }
        buildOrUpdateControllers() {
            const newControllers = [];
            const datasets = this.data.datasets;
            let i, ilen;
            this._removeUnreferencedMetasets();
            for(i = 0, ilen = datasets.length; i < ilen; i++){
                const dataset = datasets[i];
                let meta = this.getDatasetMeta(i);
                const type = dataset.type || this.config.type;
                if (meta.type && meta.type !== type) {
                    this._destroyDatasetMeta(i);
                    meta = this.getDatasetMeta(i);
                }
                meta.type = type;
                meta.indexAxis = dataset.indexAxis || getIndexAxis(type, this.options);
                meta.order = dataset.order || 0;
                meta.index = i;
                meta.label = '' + dataset.label;
                meta.visible = this.isDatasetVisible(i);
                if (meta.controller) {
                    meta.controller.updateIndex(i);
                    meta.controller.linkScales();
                } else {
                    const ControllerClass = registry.getController(type);
                    const { datasetElementType , dataElementType  } = defaults.datasets[type];
                    Object.assign(ControllerClass, {
                        dataElementType: registry.getElement(dataElementType),
                        datasetElementType: datasetElementType && registry.getElement(datasetElementType)
                    });
                    meta.controller = new ControllerClass(this, i);
                    newControllers.push(meta.controller);
                }
            }
            this._updateMetasets();
            return newControllers;
        }
     _resetElements() {
            each(this.data.datasets, (dataset, datasetIndex)=>{
                this.getDatasetMeta(datasetIndex).controller.reset();
            }, this);
        }
     reset() {
            this._resetElements();
            this.notifyPlugins('reset');
        }
        update(mode) {
            const config = this.config;
            config.update();
            const options = this._options = config.createResolver(config.chartOptionScopes(), this.getContext());
            const animsDisabled = this._animationsDisabled = !options.animation;
            this._updateScales();
            this._checkEventBindings();
            this._updateHiddenIndices();
            this._plugins.invalidate();
            if (this.notifyPlugins('beforeUpdate', {
                mode,
                cancelable: true
            }) === false) {
                return;
            }
            const newControllers = this.buildOrUpdateControllers();
            this.notifyPlugins('beforeElementsUpdate');
            let minPadding = 0;
            for(let i = 0, ilen = this.data.datasets.length; i < ilen; i++){
                const { controller  } = this.getDatasetMeta(i);
                const reset = !animsDisabled && newControllers.indexOf(controller) === -1;
                controller.buildOrUpdateElements(reset);
                minPadding = Math.max(+controller.getMaxOverflow(), minPadding);
            }
            minPadding = this._minPadding = options.layout.autoPadding ? minPadding : 0;
            this._updateLayout(minPadding);
            if (!animsDisabled) {
                each(newControllers, (controller)=>{
                    controller.reset();
                });
            }
            this._updateDatasets(mode);
            this.notifyPlugins('afterUpdate', {
                mode
            });
            this._layers.sort(compare2Level('z', '_idx'));
            const { _active , _lastEvent  } = this;
            if (_lastEvent) {
                this._eventHandler(_lastEvent, true);
            } else if (_active.length) {
                this._updateHoverStyles(_active, _active, true);
            }
            this.render();
        }
     _updateScales() {
            each(this.scales, (scale)=>{
                layouts.removeBox(this, scale);
            });
            this.ensureScalesHaveIDs();
            this.buildOrUpdateScales();
        }
     _checkEventBindings() {
            const options = this.options;
            const existingEvents = new Set(Object.keys(this._listeners));
            const newEvents = new Set(options.events);
            if (!setsEqual(existingEvents, newEvents) || !!this._responsiveListeners !== options.responsive) {
                this.unbindEvents();
                this.bindEvents();
            }
        }
     _updateHiddenIndices() {
            const { _hiddenIndices  } = this;
            const changes = this._getUniformDataChanges() || [];
            for (const { method , start , count  } of changes){
                const move = method === '_removeElements' ? -count : count;
                moveNumericKeys(_hiddenIndices, start, move);
            }
        }
     _getUniformDataChanges() {
            const _dataChanges = this._dataChanges;
            if (!_dataChanges || !_dataChanges.length) {
                return;
            }
            this._dataChanges = [];
            const datasetCount = this.data.datasets.length;
            const makeSet = (idx)=>new Set(_dataChanges.filter((c)=>c[0] === idx).map((c, i)=>i + ',' + c.splice(1).join(',')));
            const changeSet = makeSet(0);
            for(let i = 1; i < datasetCount; i++){
                if (!setsEqual(changeSet, makeSet(i))) {
                    return;
                }
            }
            return Array.from(changeSet).map((c)=>c.split(',')).map((a)=>({
                    method: a[1],
                    start: +a[2],
                    count: +a[3]
                }));
        }
     _updateLayout(minPadding) {
            if (this.notifyPlugins('beforeLayout', {
                cancelable: true
            }) === false) {
                return;
            }
            layouts.update(this, this.width, this.height, minPadding);
            const area = this.chartArea;
            const noArea = area.width <= 0 || area.height <= 0;
            this._layers = [];
            each(this.boxes, (box)=>{
                if (noArea && box.position === 'chartArea') {
                    return;
                }
                if (box.configure) {
                    box.configure();
                }
                this._layers.push(...box._layers());
            }, this);
            this._layers.forEach((item, index)=>{
                item._idx = index;
            });
            this.notifyPlugins('afterLayout');
        }
     _updateDatasets(mode) {
            if (this.notifyPlugins('beforeDatasetsUpdate', {
                mode,
                cancelable: true
            }) === false) {
                return;
            }
            for(let i = 0, ilen = this.data.datasets.length; i < ilen; ++i){
                this.getDatasetMeta(i).controller.configure();
            }
            for(let i = 0, ilen = this.data.datasets.length; i < ilen; ++i){
                this._updateDataset(i, isFunction(mode) ? mode({
                    datasetIndex: i
                }) : mode);
            }
            this.notifyPlugins('afterDatasetsUpdate', {
                mode
            });
        }
     _updateDataset(index, mode) {
            const meta = this.getDatasetMeta(index);
            const args = {
                meta,
                index,
                mode,
                cancelable: true
            };
            if (this.notifyPlugins('beforeDatasetUpdate', args) === false) {
                return;
            }
            meta.controller._update(mode);
            args.cancelable = false;
            this.notifyPlugins('afterDatasetUpdate', args);
        }
        render() {
            if (this.notifyPlugins('beforeRender', {
                cancelable: true
            }) === false) {
                return;
            }
            if (animator.has(this)) {
                if (this.attached && !animator.running(this)) {
                    animator.start(this);
                }
            } else {
                this.draw();
                onAnimationsComplete({
                    chart: this
                });
            }
        }
        draw() {
            let i;
            if (this._resizeBeforeDraw) {
                const { width , height  } = this._resizeBeforeDraw;
                this._resizeBeforeDraw = null;
                this._resize(width, height);
            }
            this.clear();
            if (this.width <= 0 || this.height <= 0) {
                return;
            }
            if (this.notifyPlugins('beforeDraw', {
                cancelable: true
            }) === false) {
                return;
            }
            const layers = this._layers;
            for(i = 0; i < layers.length && layers[i].z <= 0; ++i){
                layers[i].draw(this.chartArea);
            }
            this._drawDatasets();
            for(; i < layers.length; ++i){
                layers[i].draw(this.chartArea);
            }
            this.notifyPlugins('afterDraw');
        }
     _getSortedDatasetMetas(filterVisible) {
            const metasets = this._sortedMetasets;
            const result = [];
            let i, ilen;
            for(i = 0, ilen = metasets.length; i < ilen; ++i){
                const meta = metasets[i];
                if (!filterVisible || meta.visible) {
                    result.push(meta);
                }
            }
            return result;
        }
     getSortedVisibleDatasetMetas() {
            return this._getSortedDatasetMetas(true);
        }
     _drawDatasets() {
            if (this.notifyPlugins('beforeDatasetsDraw', {
                cancelable: true
            }) === false) {
                return;
            }
            const metasets = this.getSortedVisibleDatasetMetas();
            for(let i = metasets.length - 1; i >= 0; --i){
                this._drawDataset(metasets[i]);
            }
            this.notifyPlugins('afterDatasetsDraw');
        }
     _drawDataset(meta) {
            const ctx = this.ctx;
            const args = {
                meta,
                index: meta.index,
                cancelable: true
            };
            const clip = getDatasetClipArea(this, meta);
            if (this.notifyPlugins('beforeDatasetDraw', args) === false) {
                return;
            }
            if (clip) {
                clipArea(ctx, clip);
            }
            meta.controller.draw();
            if (clip) {
                unclipArea(ctx);
            }
            args.cancelable = false;
            this.notifyPlugins('afterDatasetDraw', args);
        }
     isPointInArea(point) {
            return _isPointInArea(point, this.chartArea, this._minPadding);
        }
        getElementsAtEventForMode(e, mode, options, useFinalPosition) {
            const method = Interaction.modes[mode];
            if (typeof method === 'function') {
                return method(this, e, options, useFinalPosition);
            }
            return [];
        }
        getDatasetMeta(datasetIndex) {
            const dataset = this.data.datasets[datasetIndex];
            const metasets = this._metasets;
            let meta = metasets.filter((x)=>x && x._dataset === dataset).pop();
            if (!meta) {
                meta = {
                    type: null,
                    data: [],
                    dataset: null,
                    controller: null,
                    hidden: null,
                    xAxisID: null,
                    yAxisID: null,
                    order: dataset && dataset.order || 0,
                    index: datasetIndex,
                    _dataset: dataset,
                    _parsed: [],
                    _sorted: false
                };
                metasets.push(meta);
            }
            return meta;
        }
        getContext() {
            return this.$context || (this.$context = createContext(null, {
                chart: this,
                type: 'chart'
            }));
        }
        getVisibleDatasetCount() {
            return this.getSortedVisibleDatasetMetas().length;
        }
        isDatasetVisible(datasetIndex) {
            const dataset = this.data.datasets[datasetIndex];
            if (!dataset) {
                return false;
            }
            const meta = this.getDatasetMeta(datasetIndex);
            return typeof meta.hidden === 'boolean' ? !meta.hidden : !dataset.hidden;
        }
        setDatasetVisibility(datasetIndex, visible) {
            const meta = this.getDatasetMeta(datasetIndex);
            meta.hidden = !visible;
        }
        toggleDataVisibility(index) {
            this._hiddenIndices[index] = !this._hiddenIndices[index];
        }
        getDataVisibility(index) {
            return !this._hiddenIndices[index];
        }
     _updateVisibility(datasetIndex, dataIndex, visible) {
            const mode = visible ? 'show' : 'hide';
            const meta = this.getDatasetMeta(datasetIndex);
            const anims = meta.controller._resolveAnimations(undefined, mode);
            if (defined(dataIndex)) {
                meta.data[dataIndex].hidden = !visible;
                this.update();
            } else {
                this.setDatasetVisibility(datasetIndex, visible);
                anims.update(meta, {
                    visible
                });
                this.update((ctx)=>ctx.datasetIndex === datasetIndex ? mode : undefined);
            }
        }
        hide(datasetIndex, dataIndex) {
            this._updateVisibility(datasetIndex, dataIndex, false);
        }
        show(datasetIndex, dataIndex) {
            this._updateVisibility(datasetIndex, dataIndex, true);
        }
     _destroyDatasetMeta(datasetIndex) {
            const meta = this._metasets[datasetIndex];
            if (meta && meta.controller) {
                meta.controller._destroy();
            }
            delete this._metasets[datasetIndex];
        }
        _stop() {
            let i, ilen;
            this.stop();
            animator.remove(this);
            for(i = 0, ilen = this.data.datasets.length; i < ilen; ++i){
                this._destroyDatasetMeta(i);
            }
        }
        destroy() {
            this.notifyPlugins('beforeDestroy');
            const { canvas , ctx  } = this;
            this._stop();
            this.config.clearCache();
            if (canvas) {
                this.unbindEvents();
                clearCanvas(canvas, ctx);
                this.platform.releaseContext(ctx);
                this.canvas = null;
                this.ctx = null;
            }
            delete instances[this.id];
            this.notifyPlugins('afterDestroy');
        }
        toBase64Image(...args) {
            return this.canvas.toDataURL(...args);
        }
     bindEvents() {
            this.bindUserEvents();
            if (this.options.responsive) {
                this.bindResponsiveEvents();
            } else {
                this.attached = true;
            }
        }
     bindUserEvents() {
            const listeners = this._listeners;
            const platform = this.platform;
            const _add = (type, listener)=>{
                platform.addEventListener(this, type, listener);
                listeners[type] = listener;
            };
            const listener = (e, x, y)=>{
                e.offsetX = x;
                e.offsetY = y;
                this._eventHandler(e);
            };
            each(this.options.events, (type)=>_add(type, listener));
        }
     bindResponsiveEvents() {
            if (!this._responsiveListeners) {
                this._responsiveListeners = {};
            }
            const listeners = this._responsiveListeners;
            const platform = this.platform;
            const _add = (type, listener)=>{
                platform.addEventListener(this, type, listener);
                listeners[type] = listener;
            };
            const _remove = (type, listener)=>{
                if (listeners[type]) {
                    platform.removeEventListener(this, type, listener);
                    delete listeners[type];
                }
            };
            const listener = (width, height)=>{
                if (this.canvas) {
                    this.resize(width, height);
                }
            };
            let detached;
            const attached = ()=>{
                _remove('attach', attached);
                this.attached = true;
                this.resize();
                _add('resize', listener);
                _add('detach', detached);
            };
            detached = ()=>{
                this.attached = false;
                _remove('resize', listener);
                this._stop();
                this._resize(0, 0);
                _add('attach', attached);
            };
            if (platform.isAttached(this.canvas)) {
                attached();
            } else {
                detached();
            }
        }
     unbindEvents() {
            each(this._listeners, (listener, type)=>{
                this.platform.removeEventListener(this, type, listener);
            });
            this._listeners = {};
            each(this._responsiveListeners, (listener, type)=>{
                this.platform.removeEventListener(this, type, listener);
            });
            this._responsiveListeners = undefined;
        }
        updateHoverStyle(items, mode, enabled) {
            const prefix = enabled ? 'set' : 'remove';
            let meta, item, i, ilen;
            if (mode === 'dataset') {
                meta = this.getDatasetMeta(items[0].datasetIndex);
                meta.controller['_' + prefix + 'DatasetHoverStyle']();
            }
            for(i = 0, ilen = items.length; i < ilen; ++i){
                item = items[i];
                const controller = item && this.getDatasetMeta(item.datasetIndex).controller;
                if (controller) {
                    controller[prefix + 'HoverStyle'](item.element, item.datasetIndex, item.index);
                }
            }
        }
     getActiveElements() {
            return this._active || [];
        }
     setActiveElements(activeElements) {
            const lastActive = this._active || [];
            const active = activeElements.map(({ datasetIndex , index  })=>{
                const meta = this.getDatasetMeta(datasetIndex);
                if (!meta) {
                    throw new Error('No dataset found at index ' + datasetIndex);
                }
                return {
                    datasetIndex,
                    element: meta.data[index],
                    index
                };
            });
            const changed = !_elementsEqual(active, lastActive);
            if (changed) {
                this._active = active;
                this._lastEvent = null;
                this._updateHoverStyles(active, lastActive);
            }
        }
     notifyPlugins(hook, args, filter) {
            return this._plugins.notify(this, hook, args, filter);
        }
     isPluginEnabled(pluginId) {
            return this._plugins._cache.filter((p)=>p.plugin.id === pluginId).length === 1;
        }
     _updateHoverStyles(active, lastActive, replay) {
            const hoverOptions = this.options.hover;
            const diff = (a, b)=>a.filter((x)=>!b.some((y)=>x.datasetIndex === y.datasetIndex && x.index === y.index));
            const deactivated = diff(lastActive, active);
            const activated = replay ? active : diff(active, lastActive);
            if (deactivated.length) {
                this.updateHoverStyle(deactivated, hoverOptions.mode, false);
            }
            if (activated.length && hoverOptions.mode) {
                this.updateHoverStyle(activated, hoverOptions.mode, true);
            }
        }
     _eventHandler(e, replay) {
            const args = {
                event: e,
                replay,
                cancelable: true,
                inChartArea: this.isPointInArea(e)
            };
            const eventFilter = (plugin)=>(plugin.options.events || this.options.events).includes(e.native.type);
            if (this.notifyPlugins('beforeEvent', args, eventFilter) === false) {
                return;
            }
            const changed = this._handleEvent(e, replay, args.inChartArea);
            args.cancelable = false;
            this.notifyPlugins('afterEvent', args, eventFilter);
            if (changed || args.changed) {
                this.render();
            }
            return this;
        }
     _handleEvent(e, replay, inChartArea) {
            const { _active: lastActive = [] , options  } = this;
            const useFinalPosition = replay;
            const active = this._getActiveElements(e, lastActive, inChartArea, useFinalPosition);
            const isClick = _isClickEvent(e);
            const lastEvent = determineLastEvent(e, this._lastEvent, inChartArea, isClick);
            if (inChartArea) {
                this._lastEvent = null;
                callback(options.onHover, [
                    e,
                    active,
                    this
                ], this);
                if (isClick) {
                    callback(options.onClick, [
                        e,
                        active,
                        this
                    ], this);
                }
            }
            const changed = !_elementsEqual(active, lastActive);
            if (changed || replay) {
                this._active = active;
                this._updateHoverStyles(active, lastActive, replay);
            }
            this._lastEvent = lastEvent;
            return changed;
        }
     _getActiveElements(e, lastActive, inChartArea, useFinalPosition) {
            if (e.type === 'mouseout') {
                return [];
            }
            if (!inChartArea) {
                return lastActive;
            }
            const hoverOptions = this.options.hover;
            return this.getElementsAtEventForMode(e, hoverOptions.mode, hoverOptions, useFinalPosition);
        }
    }
    function invalidatePlugins() {
        return each(Chart.instances, (chart)=>chart._plugins.invalidate());
    }

    function clipSelf(ctx, element, endAngle) {
        const { startAngle , x , y , outerRadius , innerRadius , options  } = element;
        const { borderWidth , borderJoinStyle  } = options;
        const outerAngleClip = Math.min(borderWidth / outerRadius, _normalizeAngle(startAngle - endAngle));
        ctx.beginPath();
        ctx.arc(x, y, outerRadius - borderWidth / 2, startAngle + outerAngleClip / 2, endAngle - outerAngleClip / 2);
        if (innerRadius > 0) {
            const innerAngleClip = Math.min(borderWidth / innerRadius, _normalizeAngle(startAngle - endAngle));
            ctx.arc(x, y, innerRadius + borderWidth / 2, endAngle - innerAngleClip / 2, startAngle + innerAngleClip / 2, true);
        } else {
            const clipWidth = Math.min(borderWidth / 2, outerRadius * _normalizeAngle(startAngle - endAngle));
            if (borderJoinStyle === 'round') {
                ctx.arc(x, y, clipWidth, endAngle - PI / 2, startAngle + PI / 2, true);
            } else if (borderJoinStyle === 'bevel') {
                const r = 2 * clipWidth * clipWidth;
                const endX = -r * Math.cos(endAngle + PI / 2) + x;
                const endY = -r * Math.sin(endAngle + PI / 2) + y;
                const startX = r * Math.cos(startAngle + PI / 2) + x;
                const startY = r * Math.sin(startAngle + PI / 2) + y;
                ctx.lineTo(endX, endY);
                ctx.lineTo(startX, startY);
            }
        }
        ctx.closePath();
        ctx.moveTo(0, 0);
        ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.clip('evenodd');
    }
    function clipArc(ctx, element, endAngle) {
        const { startAngle , pixelMargin , x , y , outerRadius , innerRadius  } = element;
        let angleMargin = pixelMargin / outerRadius;
        // Draw an inner border by clipping the arc and drawing a double-width border
        // Enlarge the clipping arc by 0.33 pixels to eliminate glitches between borders
        ctx.beginPath();
        ctx.arc(x, y, outerRadius, startAngle - angleMargin, endAngle + angleMargin);
        if (innerRadius > pixelMargin) {
            angleMargin = pixelMargin / innerRadius;
            ctx.arc(x, y, innerRadius, endAngle + angleMargin, startAngle - angleMargin, true);
        } else {
            ctx.arc(x, y, pixelMargin, endAngle + HALF_PI, startAngle - HALF_PI);
        }
        ctx.closePath();
        ctx.clip();
    }
    function toRadiusCorners(value) {
        return _readValueToProps(value, [
            'outerStart',
            'outerEnd',
            'innerStart',
            'innerEnd'
        ]);
    }
    /**
     * Parse border radius from the provided options
     */ function parseBorderRadius$1(arc, innerRadius, outerRadius, angleDelta) {
        const o = toRadiusCorners(arc.options.borderRadius);
        const halfThickness = (outerRadius - innerRadius) / 2;
        const innerLimit = Math.min(halfThickness, angleDelta * innerRadius / 2);
        // Outer limits are complicated. We want to compute the available angular distance at
        // a radius of outerRadius - borderRadius because for small angular distances, this term limits.
        // We compute at r = outerRadius - borderRadius because this circle defines the center of the border corners.
        //
        // If the borderRadius is large, that value can become negative.
        // This causes the outer borders to lose their radius entirely, which is rather unexpected. To solve that, if borderRadius > outerRadius
        // we know that the thickness term will dominate and compute the limits at that point
        const computeOuterLimit = (val)=>{
            const outerArcLimit = (outerRadius - Math.min(halfThickness, val)) * angleDelta / 2;
            return _limitValue(val, 0, Math.min(halfThickness, outerArcLimit));
        };
        return {
            outerStart: computeOuterLimit(o.outerStart),
            outerEnd: computeOuterLimit(o.outerEnd),
            innerStart: _limitValue(o.innerStart, 0, innerLimit),
            innerEnd: _limitValue(o.innerEnd, 0, innerLimit)
        };
    }
    /**
     * Convert (r, 𝜃) to (x, y)
     */ function rThetaToXY(r, theta, x, y) {
        return {
            x: x + r * Math.cos(theta),
            y: y + r * Math.sin(theta)
        };
    }
    /**
     * Path the arc, respecting border radius by separating into left and right halves.
     *
     *   Start      End
     *
     *    1--->a--->2    Outer
     *   /           \
     *   8           3
     *   |           |
     *   |           |
     *   7           4
     *   \           /
     *    6<---b<---5    Inner
     */ function pathArc(ctx, element, offset, spacing, end, circular) {
        const { x , y , startAngle: start , pixelMargin , innerRadius: innerR  } = element;
        const outerRadius = Math.max(element.outerRadius + spacing + offset - pixelMargin, 0);
        const innerRadius = innerR > 0 ? innerR + spacing + offset + pixelMargin : 0;
        let spacingOffset = 0;
        const alpha = end - start;
        if (spacing) {
            // When spacing is present, it is the same for all items
            // So we adjust the start and end angle of the arc such that
            // the distance is the same as it would be without the spacing
            const noSpacingInnerRadius = innerR > 0 ? innerR - spacing : 0;
            const noSpacingOuterRadius = outerRadius > 0 ? outerRadius - spacing : 0;
            const avNogSpacingRadius = (noSpacingInnerRadius + noSpacingOuterRadius) / 2;
            const adjustedAngle = avNogSpacingRadius !== 0 ? alpha * avNogSpacingRadius / (avNogSpacingRadius + spacing) : alpha;
            spacingOffset = (alpha - adjustedAngle) / 2;
        }
        const beta = Math.max(0.001, alpha * outerRadius - offset / PI) / outerRadius;
        const angleOffset = (alpha - beta) / 2;
        const startAngle = start + angleOffset + spacingOffset;
        const endAngle = end - angleOffset - spacingOffset;
        const { outerStart , outerEnd , innerStart , innerEnd  } = parseBorderRadius$1(element, innerRadius, outerRadius, endAngle - startAngle);
        const outerStartAdjustedRadius = outerRadius - outerStart;
        const outerEndAdjustedRadius = outerRadius - outerEnd;
        const outerStartAdjustedAngle = startAngle + outerStart / outerStartAdjustedRadius;
        const outerEndAdjustedAngle = endAngle - outerEnd / outerEndAdjustedRadius;
        const innerStartAdjustedRadius = innerRadius + innerStart;
        const innerEndAdjustedRadius = innerRadius + innerEnd;
        const innerStartAdjustedAngle = startAngle + innerStart / innerStartAdjustedRadius;
        const innerEndAdjustedAngle = endAngle - innerEnd / innerEndAdjustedRadius;
        ctx.beginPath();
        if (circular) {
            // The first arc segments from point 1 to point a to point 2
            const outerMidAdjustedAngle = (outerStartAdjustedAngle + outerEndAdjustedAngle) / 2;
            ctx.arc(x, y, outerRadius, outerStartAdjustedAngle, outerMidAdjustedAngle);
            ctx.arc(x, y, outerRadius, outerMidAdjustedAngle, outerEndAdjustedAngle);
            // The corner segment from point 2 to point 3
            if (outerEnd > 0) {
                const pCenter = rThetaToXY(outerEndAdjustedRadius, outerEndAdjustedAngle, x, y);
                ctx.arc(pCenter.x, pCenter.y, outerEnd, outerEndAdjustedAngle, endAngle + HALF_PI);
            }
            // The line from point 3 to point 4
            const p4 = rThetaToXY(innerEndAdjustedRadius, endAngle, x, y);
            ctx.lineTo(p4.x, p4.y);
            // The corner segment from point 4 to point 5
            if (innerEnd > 0) {
                const pCenter = rThetaToXY(innerEndAdjustedRadius, innerEndAdjustedAngle, x, y);
                ctx.arc(pCenter.x, pCenter.y, innerEnd, endAngle + HALF_PI, innerEndAdjustedAngle + Math.PI);
            }
            // The inner arc from point 5 to point b to point 6
            const innerMidAdjustedAngle = (endAngle - innerEnd / innerRadius + (startAngle + innerStart / innerRadius)) / 2;
            ctx.arc(x, y, innerRadius, endAngle - innerEnd / innerRadius, innerMidAdjustedAngle, true);
            ctx.arc(x, y, innerRadius, innerMidAdjustedAngle, startAngle + innerStart / innerRadius, true);
            // The corner segment from point 6 to point 7
            if (innerStart > 0) {
                const pCenter = rThetaToXY(innerStartAdjustedRadius, innerStartAdjustedAngle, x, y);
                ctx.arc(pCenter.x, pCenter.y, innerStart, innerStartAdjustedAngle + Math.PI, startAngle - HALF_PI);
            }
            // The line from point 7 to point 8
            const p8 = rThetaToXY(outerStartAdjustedRadius, startAngle, x, y);
            ctx.lineTo(p8.x, p8.y);
            // The corner segment from point 8 to point 1
            if (outerStart > 0) {
                const pCenter = rThetaToXY(outerStartAdjustedRadius, outerStartAdjustedAngle, x, y);
                ctx.arc(pCenter.x, pCenter.y, outerStart, startAngle - HALF_PI, outerStartAdjustedAngle);
            }
        } else {
            ctx.moveTo(x, y);
            const outerStartX = Math.cos(outerStartAdjustedAngle) * outerRadius + x;
            const outerStartY = Math.sin(outerStartAdjustedAngle) * outerRadius + y;
            ctx.lineTo(outerStartX, outerStartY);
            const outerEndX = Math.cos(outerEndAdjustedAngle) * outerRadius + x;
            const outerEndY = Math.sin(outerEndAdjustedAngle) * outerRadius + y;
            ctx.lineTo(outerEndX, outerEndY);
        }
        ctx.closePath();
    }
    function drawArc(ctx, element, offset, spacing, circular) {
        const { fullCircles , startAngle , circumference  } = element;
        let endAngle = element.endAngle;
        if (fullCircles) {
            pathArc(ctx, element, offset, spacing, endAngle, circular);
            for(let i = 0; i < fullCircles; ++i){
                ctx.fill();
            }
            if (!isNaN(circumference)) {
                endAngle = startAngle + (circumference % TAU || TAU);
            }
        }
        pathArc(ctx, element, offset, spacing, endAngle, circular);
        ctx.fill();
        return endAngle;
    }
    function drawBorder(ctx, element, offset, spacing, circular) {
        const { fullCircles , startAngle , circumference , options  } = element;
        const { borderWidth , borderJoinStyle , borderDash , borderDashOffset , borderRadius  } = options;
        const inner = options.borderAlign === 'inner';
        if (!borderWidth) {
            return;
        }
        ctx.setLineDash(borderDash || []);
        ctx.lineDashOffset = borderDashOffset;
        if (inner) {
            ctx.lineWidth = borderWidth * 2;
            ctx.lineJoin = borderJoinStyle || 'round';
        } else {
            ctx.lineWidth = borderWidth;
            ctx.lineJoin = borderJoinStyle || 'bevel';
        }
        let endAngle = element.endAngle;
        if (fullCircles) {
            pathArc(ctx, element, offset, spacing, endAngle, circular);
            for(let i = 0; i < fullCircles; ++i){
                ctx.stroke();
            }
            if (!isNaN(circumference)) {
                endAngle = startAngle + (circumference % TAU || TAU);
            }
        }
        if (inner) {
            clipArc(ctx, element, endAngle);
        }
        if (options.selfJoin && endAngle - startAngle >= PI && borderRadius === 0 && borderJoinStyle !== 'miter') {
            clipSelf(ctx, element, endAngle);
        }
        if (!fullCircles) {
            pathArc(ctx, element, offset, spacing, endAngle, circular);
            ctx.stroke();
        }
    }
    class ArcElement extends Element {
        static id = 'arc';
        static defaults = {
            borderAlign: 'center',
            borderColor: '#fff',
            borderDash: [],
            borderDashOffset: 0,
            borderJoinStyle: undefined,
            borderRadius: 0,
            borderWidth: 2,
            offset: 0,
            spacing: 0,
            angle: undefined,
            circular: true,
            selfJoin: false
        };
        static defaultRoutes = {
            backgroundColor: 'backgroundColor'
        };
        static descriptors = {
            _scriptable: true,
            _indexable: (name)=>name !== 'borderDash'
        };
        circumference;
        endAngle;
        fullCircles;
        innerRadius;
        outerRadius;
        pixelMargin;
        startAngle;
        constructor(cfg){
            super();
            this.options = undefined;
            this.circumference = undefined;
            this.startAngle = undefined;
            this.endAngle = undefined;
            this.innerRadius = undefined;
            this.outerRadius = undefined;
            this.pixelMargin = 0;
            this.fullCircles = 0;
            if (cfg) {
                Object.assign(this, cfg);
            }
        }
        inRange(chartX, chartY, useFinalPosition) {
            const point = this.getProps([
                'x',
                'y'
            ], useFinalPosition);
            const { angle , distance  } = getAngleFromPoint(point, {
                x: chartX,
                y: chartY
            });
            const { startAngle , endAngle , innerRadius , outerRadius , circumference  } = this.getProps([
                'startAngle',
                'endAngle',
                'innerRadius',
                'outerRadius',
                'circumference'
            ], useFinalPosition);
            const rAdjust = (this.options.spacing + this.options.borderWidth) / 2;
            const _circumference = valueOrDefault(circumference, endAngle - startAngle);
            const nonZeroBetween = _angleBetween(angle, startAngle, endAngle) && startAngle !== endAngle;
            const betweenAngles = _circumference >= TAU || nonZeroBetween;
            const withinRadius = _isBetween(distance, innerRadius + rAdjust, outerRadius + rAdjust);
            return betweenAngles && withinRadius;
        }
        getCenterPoint(useFinalPosition) {
            const { x , y , startAngle , endAngle , innerRadius , outerRadius  } = this.getProps([
                'x',
                'y',
                'startAngle',
                'endAngle',
                'innerRadius',
                'outerRadius'
            ], useFinalPosition);
            const { offset , spacing  } = this.options;
            const halfAngle = (startAngle + endAngle) / 2;
            const halfRadius = (innerRadius + outerRadius + spacing + offset) / 2;
            return {
                x: x + Math.cos(halfAngle) * halfRadius,
                y: y + Math.sin(halfAngle) * halfRadius
            };
        }
        tooltipPosition(useFinalPosition) {
            return this.getCenterPoint(useFinalPosition);
        }
        draw(ctx) {
            const { options , circumference  } = this;
            const offset = (options.offset || 0) / 4;
            const spacing = (options.spacing || 0) / 2;
            const circular = options.circular;
            this.pixelMargin = options.borderAlign === 'inner' ? 0.33 : 0;
            this.fullCircles = circumference > TAU ? Math.floor(circumference / TAU) : 0;
            if (circumference === 0 || this.innerRadius < 0 || this.outerRadius < 0) {
                return;
            }
            ctx.save();
            const halfAngle = (this.startAngle + this.endAngle) / 2;
            ctx.translate(Math.cos(halfAngle) * offset, Math.sin(halfAngle) * offset);
            const fix = 1 - Math.sin(Math.min(PI, circumference || 0));
            const radiusOffset = offset * fix;
            ctx.fillStyle = options.backgroundColor;
            ctx.strokeStyle = options.borderColor;
            drawArc(ctx, this, radiusOffset, spacing, circular);
            drawBorder(ctx, this, radiusOffset, spacing, circular);
            ctx.restore();
        }
    }

    const positioners = {
     average (items) {
            if (!items.length) {
                return false;
            }
            let i, len;
            let xSet = new Set();
            let y = 0;
            let count = 0;
            for(i = 0, len = items.length; i < len; ++i){
                const el = items[i].element;
                if (el && el.hasValue()) {
                    const pos = el.tooltipPosition();
                    xSet.add(pos.x);
                    y += pos.y;
                    ++count;
                }
            }
            if (count === 0 || xSet.size === 0) {
                return false;
            }
            const xAverage = [
                ...xSet
            ].reduce((a, b)=>a + b) / xSet.size;
            return {
                x: xAverage,
                y: y / count
            };
        },
     nearest (items, eventPosition) {
            if (!items.length) {
                return false;
            }
            let x = eventPosition.x;
            let y = eventPosition.y;
            let minDistance = Number.POSITIVE_INFINITY;
            let i, len, nearestElement;
            for(i = 0, len = items.length; i < len; ++i){
                const el = items[i].element;
                if (el && el.hasValue()) {
                    const center = el.getCenterPoint();
                    const d = distanceBetweenPoints(eventPosition, center);
                    if (d < minDistance) {
                        minDistance = d;
                        nearestElement = el;
                    }
                }
            }
            if (nearestElement) {
                const tp = nearestElement.tooltipPosition();
                x = tp.x;
                y = tp.y;
            }
            return {
                x,
                y
            };
        }
    };
    function pushOrConcat(base, toPush) {
        if (toPush) {
            if (isArray(toPush)) {
                Array.prototype.push.apply(base, toPush);
            } else {
                base.push(toPush);
            }
        }
        return base;
    }
     function splitNewlines(str) {
        if ((typeof str === 'string' || str instanceof String) && str.indexOf('\n') > -1) {
            return str.split('\n');
        }
        return str;
    }
     function createTooltipItem(chart, item) {
        const { element , datasetIndex , index  } = item;
        const controller = chart.getDatasetMeta(datasetIndex).controller;
        const { label , value  } = controller.getLabelAndValue(index);
        return {
            chart,
            label,
            parsed: controller.getParsed(index),
            raw: chart.data.datasets[datasetIndex].data[index],
            formattedValue: value,
            dataset: controller.getDataset(),
            dataIndex: index,
            datasetIndex,
            element
        };
    }
     function getTooltipSize(tooltip, options) {
        const ctx = tooltip.chart.ctx;
        const { body , footer , title  } = tooltip;
        const { boxWidth , boxHeight  } = options;
        const bodyFont = toFont(options.bodyFont);
        const titleFont = toFont(options.titleFont);
        const footerFont = toFont(options.footerFont);
        const titleLineCount = title.length;
        const footerLineCount = footer.length;
        const bodyLineItemCount = body.length;
        const padding = toPadding(options.padding);
        let height = padding.height;
        let width = 0;
        let combinedBodyLength = body.reduce((count, bodyItem)=>count + bodyItem.before.length + bodyItem.lines.length + bodyItem.after.length, 0);
        combinedBodyLength += tooltip.beforeBody.length + tooltip.afterBody.length;
        if (titleLineCount) {
            height += titleLineCount * titleFont.lineHeight + (titleLineCount - 1) * options.titleSpacing + options.titleMarginBottom;
        }
        if (combinedBodyLength) {
            const bodyLineHeight = options.displayColors ? Math.max(boxHeight, bodyFont.lineHeight) : bodyFont.lineHeight;
            height += bodyLineItemCount * bodyLineHeight + (combinedBodyLength - bodyLineItemCount) * bodyFont.lineHeight + (combinedBodyLength - 1) * options.bodySpacing;
        }
        if (footerLineCount) {
            height += options.footerMarginTop + footerLineCount * footerFont.lineHeight + (footerLineCount - 1) * options.footerSpacing;
        }
        let widthPadding = 0;
        const maxLineWidth = function(line) {
            width = Math.max(width, ctx.measureText(line).width + widthPadding);
        };
        ctx.save();
        ctx.font = titleFont.string;
        each(tooltip.title, maxLineWidth);
        ctx.font = bodyFont.string;
        each(tooltip.beforeBody.concat(tooltip.afterBody), maxLineWidth);
        widthPadding = options.displayColors ? boxWidth + 2 + options.boxPadding : 0;
        each(body, (bodyItem)=>{
            each(bodyItem.before, maxLineWidth);
            each(bodyItem.lines, maxLineWidth);
            each(bodyItem.after, maxLineWidth);
        });
        widthPadding = 0;
        ctx.font = footerFont.string;
        each(tooltip.footer, maxLineWidth);
        ctx.restore();
        width += padding.width;
        return {
            width,
            height
        };
    }
    function determineYAlign(chart, size) {
        const { y , height  } = size;
        if (y < height / 2) {
            return 'top';
        } else if (y > chart.height - height / 2) {
            return 'bottom';
        }
        return 'center';
    }
    function doesNotFitWithAlign(xAlign, chart, options, size) {
        const { x , width  } = size;
        const caret = options.caretSize + options.caretPadding;
        if (xAlign === 'left' && x + width + caret > chart.width) {
            return true;
        }
        if (xAlign === 'right' && x - width - caret < 0) {
            return true;
        }
    }
    function determineXAlign(chart, options, size, yAlign) {
        const { x , width  } = size;
        const { width: chartWidth , chartArea: { left , right  }  } = chart;
        let xAlign = 'center';
        if (yAlign === 'center') {
            xAlign = x <= (left + right) / 2 ? 'left' : 'right';
        } else if (x <= width / 2) {
            xAlign = 'left';
        } else if (x >= chartWidth - width / 2) {
            xAlign = 'right';
        }
        if (doesNotFitWithAlign(xAlign, chart, options, size)) {
            xAlign = 'center';
        }
        return xAlign;
    }
     function determineAlignment(chart, options, size) {
        const yAlign = size.yAlign || options.yAlign || determineYAlign(chart, size);
        return {
            xAlign: size.xAlign || options.xAlign || determineXAlign(chart, options, size, yAlign),
            yAlign
        };
    }
    function alignX(size, xAlign) {
        let { x , width  } = size;
        if (xAlign === 'right') {
            x -= width;
        } else if (xAlign === 'center') {
            x -= width / 2;
        }
        return x;
    }
    function alignY(size, yAlign, paddingAndSize) {
        let { y , height  } = size;
        if (yAlign === 'top') {
            y += paddingAndSize;
        } else if (yAlign === 'bottom') {
            y -= height + paddingAndSize;
        } else {
            y -= height / 2;
        }
        return y;
    }
     function getBackgroundPoint(options, size, alignment, chart) {
        const { caretSize , caretPadding , cornerRadius  } = options;
        const { xAlign , yAlign  } = alignment;
        const paddingAndSize = caretSize + caretPadding;
        const { topLeft , topRight , bottomLeft , bottomRight  } = toTRBLCorners(cornerRadius);
        let x = alignX(size, xAlign);
        const y = alignY(size, yAlign, paddingAndSize);
        if (yAlign === 'center') {
            if (xAlign === 'left') {
                x += paddingAndSize;
            } else if (xAlign === 'right') {
                x -= paddingAndSize;
            }
        } else if (xAlign === 'left') {
            x -= Math.max(topLeft, bottomLeft) + caretSize;
        } else if (xAlign === 'right') {
            x += Math.max(topRight, bottomRight) + caretSize;
        }
        return {
            x: _limitValue(x, 0, chart.width - size.width),
            y: _limitValue(y, 0, chart.height - size.height)
        };
    }
    function getAlignedX(tooltip, align, options) {
        const padding = toPadding(options.padding);
        return align === 'center' ? tooltip.x + tooltip.width / 2 : align === 'right' ? tooltip.x + tooltip.width - padding.right : tooltip.x + padding.left;
    }
     function getBeforeAfterBodyLines(callback) {
        return pushOrConcat([], splitNewlines(callback));
    }
    function createTooltipContext(parent, tooltip, tooltipItems) {
        return createContext(parent, {
            tooltip,
            tooltipItems,
            type: 'tooltip'
        });
    }
    function overrideCallbacks(callbacks, context) {
        const override = context && context.dataset && context.dataset.tooltip && context.dataset.tooltip.callbacks;
        return override ? callbacks.override(override) : callbacks;
    }
    const defaultCallbacks = {
        beforeTitle: noop,
        title (tooltipItems) {
            if (tooltipItems.length > 0) {
                const item = tooltipItems[0];
                const labels = item.chart.data.labels;
                const labelCount = labels ? labels.length : 0;
                if (this && this.options && this.options.mode === 'dataset') {
                    return item.dataset.label || '';
                } else if (item.label) {
                    return item.label;
                } else if (labelCount > 0 && item.dataIndex < labelCount) {
                    return labels[item.dataIndex];
                }
            }
            return '';
        },
        afterTitle: noop,
        beforeBody: noop,
        beforeLabel: noop,
        label (tooltipItem) {
            if (this && this.options && this.options.mode === 'dataset') {
                return tooltipItem.label + ': ' + tooltipItem.formattedValue || tooltipItem.formattedValue;
            }
            let label = tooltipItem.dataset.label || '';
            if (label) {
                label += ': ';
            }
            const value = tooltipItem.formattedValue;
            if (!isNullOrUndef(value)) {
                label += value;
            }
            return label;
        },
        labelColor (tooltipItem) {
            const meta = tooltipItem.chart.getDatasetMeta(tooltipItem.datasetIndex);
            const options = meta.controller.getStyle(tooltipItem.dataIndex);
            return {
                borderColor: options.borderColor,
                backgroundColor: options.backgroundColor,
                borderWidth: options.borderWidth,
                borderDash: options.borderDash,
                borderDashOffset: options.borderDashOffset,
                borderRadius: 0
            };
        },
        labelTextColor () {
            return this.options.bodyColor;
        },
        labelPointStyle (tooltipItem) {
            const meta = tooltipItem.chart.getDatasetMeta(tooltipItem.datasetIndex);
            const options = meta.controller.getStyle(tooltipItem.dataIndex);
            return {
                pointStyle: options.pointStyle,
                rotation: options.rotation
            };
        },
        afterLabel: noop,
        afterBody: noop,
        beforeFooter: noop,
        footer: noop,
        afterFooter: noop
    };
     function invokeCallbackWithFallback(callbacks, name, ctx, arg) {
        const result = callbacks[name].call(ctx, arg);
        if (typeof result === 'undefined') {
            return defaultCallbacks[name].call(ctx, arg);
        }
        return result;
    }
    class Tooltip extends Element {
     static positioners = positioners;
        constructor(config){
            super();
            this.opacity = 0;
            this._active = [];
            this._eventPosition = undefined;
            this._size = undefined;
            this._cachedAnimations = undefined;
            this._tooltipItems = [];
            this.$animations = undefined;
            this.$context = undefined;
            this.chart = config.chart;
            this.options = config.options;
            this.dataPoints = undefined;
            this.title = undefined;
            this.beforeBody = undefined;
            this.body = undefined;
            this.afterBody = undefined;
            this.footer = undefined;
            this.xAlign = undefined;
            this.yAlign = undefined;
            this.x = undefined;
            this.y = undefined;
            this.height = undefined;
            this.width = undefined;
            this.caretX = undefined;
            this.caretY = undefined;
            this.labelColors = undefined;
            this.labelPointStyles = undefined;
            this.labelTextColors = undefined;
        }
        initialize(options) {
            this.options = options;
            this._cachedAnimations = undefined;
            this.$context = undefined;
        }
     _resolveAnimations() {
            const cached = this._cachedAnimations;
            if (cached) {
                return cached;
            }
            const chart = this.chart;
            const options = this.options.setContext(this.getContext());
            const opts = options.enabled && chart.options.animation && options.animations;
            const animations = new Animations(this.chart, opts);
            if (opts._cacheable) {
                this._cachedAnimations = Object.freeze(animations);
            }
            return animations;
        }
     getContext() {
            return this.$context || (this.$context = createTooltipContext(this.chart.getContext(), this, this._tooltipItems));
        }
        getTitle(context, options) {
            const { callbacks  } = options;
            const beforeTitle = invokeCallbackWithFallback(callbacks, 'beforeTitle', this, context);
            const title = invokeCallbackWithFallback(callbacks, 'title', this, context);
            const afterTitle = invokeCallbackWithFallback(callbacks, 'afterTitle', this, context);
            let lines = [];
            lines = pushOrConcat(lines, splitNewlines(beforeTitle));
            lines = pushOrConcat(lines, splitNewlines(title));
            lines = pushOrConcat(lines, splitNewlines(afterTitle));
            return lines;
        }
        getBeforeBody(tooltipItems, options) {
            return getBeforeAfterBodyLines(invokeCallbackWithFallback(options.callbacks, 'beforeBody', this, tooltipItems));
        }
        getBody(tooltipItems, options) {
            const { callbacks  } = options;
            const bodyItems = [];
            each(tooltipItems, (context)=>{
                const bodyItem = {
                    before: [],
                    lines: [],
                    after: []
                };
                const scoped = overrideCallbacks(callbacks, context);
                pushOrConcat(bodyItem.before, splitNewlines(invokeCallbackWithFallback(scoped, 'beforeLabel', this, context)));
                pushOrConcat(bodyItem.lines, invokeCallbackWithFallback(scoped, 'label', this, context));
                pushOrConcat(bodyItem.after, splitNewlines(invokeCallbackWithFallback(scoped, 'afterLabel', this, context)));
                bodyItems.push(bodyItem);
            });
            return bodyItems;
        }
        getAfterBody(tooltipItems, options) {
            return getBeforeAfterBodyLines(invokeCallbackWithFallback(options.callbacks, 'afterBody', this, tooltipItems));
        }
        getFooter(tooltipItems, options) {
            const { callbacks  } = options;
            const beforeFooter = invokeCallbackWithFallback(callbacks, 'beforeFooter', this, tooltipItems);
            const footer = invokeCallbackWithFallback(callbacks, 'footer', this, tooltipItems);
            const afterFooter = invokeCallbackWithFallback(callbacks, 'afterFooter', this, tooltipItems);
            let lines = [];
            lines = pushOrConcat(lines, splitNewlines(beforeFooter));
            lines = pushOrConcat(lines, splitNewlines(footer));
            lines = pushOrConcat(lines, splitNewlines(afterFooter));
            return lines;
        }
     _createItems(options) {
            const active = this._active;
            const data = this.chart.data;
            const labelColors = [];
            const labelPointStyles = [];
            const labelTextColors = [];
            let tooltipItems = [];
            let i, len;
            for(i = 0, len = active.length; i < len; ++i){
                tooltipItems.push(createTooltipItem(this.chart, active[i]));
            }
            if (options.filter) {
                tooltipItems = tooltipItems.filter((element, index, array)=>options.filter(element, index, array, data));
            }
            if (options.itemSort) {
                tooltipItems = tooltipItems.sort((a, b)=>options.itemSort(a, b, data));
            }
            each(tooltipItems, (context)=>{
                const scoped = overrideCallbacks(options.callbacks, context);
                labelColors.push(invokeCallbackWithFallback(scoped, 'labelColor', this, context));
                labelPointStyles.push(invokeCallbackWithFallback(scoped, 'labelPointStyle', this, context));
                labelTextColors.push(invokeCallbackWithFallback(scoped, 'labelTextColor', this, context));
            });
            this.labelColors = labelColors;
            this.labelPointStyles = labelPointStyles;
            this.labelTextColors = labelTextColors;
            this.dataPoints = tooltipItems;
            return tooltipItems;
        }
        update(changed, replay) {
            const options = this.options.setContext(this.getContext());
            const active = this._active;
            let properties;
            let tooltipItems = [];
            if (!active.length) {
                if (this.opacity !== 0) {
                    properties = {
                        opacity: 0
                    };
                }
            } else {
                const position = positioners[options.position].call(this, active, this._eventPosition);
                tooltipItems = this._createItems(options);
                this.title = this.getTitle(tooltipItems, options);
                this.beforeBody = this.getBeforeBody(tooltipItems, options);
                this.body = this.getBody(tooltipItems, options);
                this.afterBody = this.getAfterBody(tooltipItems, options);
                this.footer = this.getFooter(tooltipItems, options);
                const size = this._size = getTooltipSize(this, options);
                const positionAndSize = Object.assign({}, position, size);
                const alignment = determineAlignment(this.chart, options, positionAndSize);
                const backgroundPoint = getBackgroundPoint(options, positionAndSize, alignment, this.chart);
                this.xAlign = alignment.xAlign;
                this.yAlign = alignment.yAlign;
                properties = {
                    opacity: 1,
                    x: backgroundPoint.x,
                    y: backgroundPoint.y,
                    width: size.width,
                    height: size.height,
                    caretX: position.x,
                    caretY: position.y
                };
            }
            this._tooltipItems = tooltipItems;
            this.$context = undefined;
            if (properties) {
                this._resolveAnimations().update(this, properties);
            }
            if (changed && options.external) {
                options.external.call(this, {
                    chart: this.chart,
                    tooltip: this,
                    replay
                });
            }
        }
        drawCaret(tooltipPoint, ctx, size, options) {
            const caretPosition = this.getCaretPosition(tooltipPoint, size, options);
            ctx.lineTo(caretPosition.x1, caretPosition.y1);
            ctx.lineTo(caretPosition.x2, caretPosition.y2);
            ctx.lineTo(caretPosition.x3, caretPosition.y3);
        }
        getCaretPosition(tooltipPoint, size, options) {
            const { xAlign , yAlign  } = this;
            const { caretSize , cornerRadius  } = options;
            const { topLeft , topRight , bottomLeft , bottomRight  } = toTRBLCorners(cornerRadius);
            const { x: ptX , y: ptY  } = tooltipPoint;
            const { width , height  } = size;
            let x1, x2, x3, y1, y2, y3;
            if (yAlign === 'center') {
                y2 = ptY + height / 2;
                if (xAlign === 'left') {
                    x1 = ptX;
                    x2 = x1 - caretSize;
                    y1 = y2 + caretSize;
                    y3 = y2 - caretSize;
                } else {
                    x1 = ptX + width;
                    x2 = x1 + caretSize;
                    y1 = y2 - caretSize;
                    y3 = y2 + caretSize;
                }
                x3 = x1;
            } else {
                if (xAlign === 'left') {
                    x2 = ptX + Math.max(topLeft, bottomLeft) + caretSize;
                } else if (xAlign === 'right') {
                    x2 = ptX + width - Math.max(topRight, bottomRight) - caretSize;
                } else {
                    x2 = this.caretX;
                }
                if (yAlign === 'top') {
                    y1 = ptY;
                    y2 = y1 - caretSize;
                    x1 = x2 - caretSize;
                    x3 = x2 + caretSize;
                } else {
                    y1 = ptY + height;
                    y2 = y1 + caretSize;
                    x1 = x2 + caretSize;
                    x3 = x2 - caretSize;
                }
                y3 = y1;
            }
            return {
                x1,
                x2,
                x3,
                y1,
                y2,
                y3
            };
        }
        drawTitle(pt, ctx, options) {
            const title = this.title;
            const length = title.length;
            let titleFont, titleSpacing, i;
            if (length) {
                const rtlHelper = getRtlAdapter(options.rtl, this.x, this.width);
                pt.x = getAlignedX(this, options.titleAlign, options);
                ctx.textAlign = rtlHelper.textAlign(options.titleAlign);
                ctx.textBaseline = 'middle';
                titleFont = toFont(options.titleFont);
                titleSpacing = options.titleSpacing;
                ctx.fillStyle = options.titleColor;
                ctx.font = titleFont.string;
                for(i = 0; i < length; ++i){
                    ctx.fillText(title[i], rtlHelper.x(pt.x), pt.y + titleFont.lineHeight / 2);
                    pt.y += titleFont.lineHeight + titleSpacing;
                    if (i + 1 === length) {
                        pt.y += options.titleMarginBottom - titleSpacing;
                    }
                }
            }
        }
     _drawColorBox(ctx, pt, i, rtlHelper, options) {
            const labelColor = this.labelColors[i];
            const labelPointStyle = this.labelPointStyles[i];
            const { boxHeight , boxWidth  } = options;
            const bodyFont = toFont(options.bodyFont);
            const colorX = getAlignedX(this, 'left', options);
            const rtlColorX = rtlHelper.x(colorX);
            const yOffSet = boxHeight < bodyFont.lineHeight ? (bodyFont.lineHeight - boxHeight) / 2 : 0;
            const colorY = pt.y + yOffSet;
            if (options.usePointStyle) {
                const drawOptions = {
                    radius: Math.min(boxWidth, boxHeight) / 2,
                    pointStyle: labelPointStyle.pointStyle,
                    rotation: labelPointStyle.rotation};
                const centerX = rtlHelper.leftForLtr(rtlColorX, boxWidth) + boxWidth / 2;
                const centerY = colorY + boxHeight / 2;
                ctx.strokeStyle = options.multiKeyBackground;
                ctx.fillStyle = options.multiKeyBackground;
                drawPoint(ctx, drawOptions, centerX, centerY);
                ctx.strokeStyle = labelColor.borderColor;
                ctx.fillStyle = labelColor.backgroundColor;
                drawPoint(ctx, drawOptions, centerX, centerY);
            } else {
                ctx.lineWidth = isObject(labelColor.borderWidth) ? Math.max(...Object.values(labelColor.borderWidth)) : labelColor.borderWidth || 1;
                ctx.strokeStyle = labelColor.borderColor;
                ctx.setLineDash(labelColor.borderDash || []);
                ctx.lineDashOffset = labelColor.borderDashOffset || 0;
                const outerX = rtlHelper.leftForLtr(rtlColorX, boxWidth);
                const innerX = rtlHelper.leftForLtr(rtlHelper.xPlus(rtlColorX, 1), boxWidth - 2);
                const borderRadius = toTRBLCorners(labelColor.borderRadius);
                if (Object.values(borderRadius).some((v)=>v !== 0)) {
                    ctx.beginPath();
                    ctx.fillStyle = options.multiKeyBackground;
                    addRoundedRectPath(ctx, {
                        x: outerX,
                        y: colorY,
                        w: boxWidth,
                        h: boxHeight,
                        radius: borderRadius
                    });
                    ctx.fill();
                    ctx.stroke();
                    ctx.fillStyle = labelColor.backgroundColor;
                    ctx.beginPath();
                    addRoundedRectPath(ctx, {
                        x: innerX,
                        y: colorY + 1,
                        w: boxWidth - 2,
                        h: boxHeight - 2,
                        radius: borderRadius
                    });
                    ctx.fill();
                } else {
                    ctx.fillStyle = options.multiKeyBackground;
                    ctx.fillRect(outerX, colorY, boxWidth, boxHeight);
                    ctx.strokeRect(outerX, colorY, boxWidth, boxHeight);
                    ctx.fillStyle = labelColor.backgroundColor;
                    ctx.fillRect(innerX, colorY + 1, boxWidth - 2, boxHeight - 2);
                }
            }
            ctx.fillStyle = this.labelTextColors[i];
        }
        drawBody(pt, ctx, options) {
            const { body  } = this;
            const { bodySpacing , bodyAlign , displayColors , boxHeight , boxWidth , boxPadding  } = options;
            const bodyFont = toFont(options.bodyFont);
            let bodyLineHeight = bodyFont.lineHeight;
            let xLinePadding = 0;
            const rtlHelper = getRtlAdapter(options.rtl, this.x, this.width);
            const fillLineOfText = function(line) {
                ctx.fillText(line, rtlHelper.x(pt.x + xLinePadding), pt.y + bodyLineHeight / 2);
                pt.y += bodyLineHeight + bodySpacing;
            };
            const bodyAlignForCalculation = rtlHelper.textAlign(bodyAlign);
            let bodyItem, textColor, lines, i, j, ilen, jlen;
            ctx.textAlign = bodyAlign;
            ctx.textBaseline = 'middle';
            ctx.font = bodyFont.string;
            pt.x = getAlignedX(this, bodyAlignForCalculation, options);
            ctx.fillStyle = options.bodyColor;
            each(this.beforeBody, fillLineOfText);
            xLinePadding = displayColors && bodyAlignForCalculation !== 'right' ? bodyAlign === 'center' ? boxWidth / 2 + boxPadding : boxWidth + 2 + boxPadding : 0;
            for(i = 0, ilen = body.length; i < ilen; ++i){
                bodyItem = body[i];
                textColor = this.labelTextColors[i];
                ctx.fillStyle = textColor;
                each(bodyItem.before, fillLineOfText);
                lines = bodyItem.lines;
                if (displayColors && lines.length) {
                    this._drawColorBox(ctx, pt, i, rtlHelper, options);
                    bodyLineHeight = Math.max(bodyFont.lineHeight, boxHeight);
                }
                for(j = 0, jlen = lines.length; j < jlen; ++j){
                    fillLineOfText(lines[j]);
                    bodyLineHeight = bodyFont.lineHeight;
                }
                each(bodyItem.after, fillLineOfText);
            }
            xLinePadding = 0;
            bodyLineHeight = bodyFont.lineHeight;
            each(this.afterBody, fillLineOfText);
            pt.y -= bodySpacing;
        }
        drawFooter(pt, ctx, options) {
            const footer = this.footer;
            const length = footer.length;
            let footerFont, i;
            if (length) {
                const rtlHelper = getRtlAdapter(options.rtl, this.x, this.width);
                pt.x = getAlignedX(this, options.footerAlign, options);
                pt.y += options.footerMarginTop;
                ctx.textAlign = rtlHelper.textAlign(options.footerAlign);
                ctx.textBaseline = 'middle';
                footerFont = toFont(options.footerFont);
                ctx.fillStyle = options.footerColor;
                ctx.font = footerFont.string;
                for(i = 0; i < length; ++i){
                    ctx.fillText(footer[i], rtlHelper.x(pt.x), pt.y + footerFont.lineHeight / 2);
                    pt.y += footerFont.lineHeight + options.footerSpacing;
                }
            }
        }
        drawBackground(pt, ctx, tooltipSize, options) {
            const { xAlign , yAlign  } = this;
            const { x , y  } = pt;
            const { width , height  } = tooltipSize;
            const { topLeft , topRight , bottomLeft , bottomRight  } = toTRBLCorners(options.cornerRadius);
            ctx.fillStyle = options.backgroundColor;
            ctx.strokeStyle = options.borderColor;
            ctx.lineWidth = options.borderWidth;
            ctx.beginPath();
            ctx.moveTo(x + topLeft, y);
            if (yAlign === 'top') {
                this.drawCaret(pt, ctx, tooltipSize, options);
            }
            ctx.lineTo(x + width - topRight, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + topRight);
            if (yAlign === 'center' && xAlign === 'right') {
                this.drawCaret(pt, ctx, tooltipSize, options);
            }
            ctx.lineTo(x + width, y + height - bottomRight);
            ctx.quadraticCurveTo(x + width, y + height, x + width - bottomRight, y + height);
            if (yAlign === 'bottom') {
                this.drawCaret(pt, ctx, tooltipSize, options);
            }
            ctx.lineTo(x + bottomLeft, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - bottomLeft);
            if (yAlign === 'center' && xAlign === 'left') {
                this.drawCaret(pt, ctx, tooltipSize, options);
            }
            ctx.lineTo(x, y + topLeft);
            ctx.quadraticCurveTo(x, y, x + topLeft, y);
            ctx.closePath();
            ctx.fill();
            if (options.borderWidth > 0) {
                ctx.stroke();
            }
        }
     _updateAnimationTarget(options) {
            const chart = this.chart;
            const anims = this.$animations;
            const animX = anims && anims.x;
            const animY = anims && anims.y;
            if (animX || animY) {
                const position = positioners[options.position].call(this, this._active, this._eventPosition);
                if (!position) {
                    return;
                }
                const size = this._size = getTooltipSize(this, options);
                const positionAndSize = Object.assign({}, position, this._size);
                const alignment = determineAlignment(chart, options, positionAndSize);
                const point = getBackgroundPoint(options, positionAndSize, alignment, chart);
                if (animX._to !== point.x || animY._to !== point.y) {
                    this.xAlign = alignment.xAlign;
                    this.yAlign = alignment.yAlign;
                    this.width = size.width;
                    this.height = size.height;
                    this.caretX = position.x;
                    this.caretY = position.y;
                    this._resolveAnimations().update(this, point);
                }
            }
        }
     _willRender() {
            return !!this.opacity;
        }
        draw(ctx) {
            const options = this.options.setContext(this.getContext());
            let opacity = this.opacity;
            if (!opacity) {
                return;
            }
            this._updateAnimationTarget(options);
            const tooltipSize = {
                width: this.width,
                height: this.height
            };
            const pt = {
                x: this.x,
                y: this.y
            };
            opacity = Math.abs(opacity) < 1e-3 ? 0 : opacity;
            const padding = toPadding(options.padding);
            const hasTooltipContent = this.title.length || this.beforeBody.length || this.body.length || this.afterBody.length || this.footer.length;
            if (options.enabled && hasTooltipContent) {
                ctx.save();
                ctx.globalAlpha = opacity;
                this.drawBackground(pt, ctx, tooltipSize, options);
                overrideTextDirection(ctx, options.textDirection);
                pt.y += padding.top;
                this.drawTitle(pt, ctx, options);
                this.drawBody(pt, ctx, options);
                this.drawFooter(pt, ctx, options);
                restoreTextDirection(ctx, options.textDirection);
                ctx.restore();
            }
        }
     getActiveElements() {
            return this._active || [];
        }
     setActiveElements(activeElements, eventPosition) {
            const lastActive = this._active;
            const active = activeElements.map(({ datasetIndex , index  })=>{
                const meta = this.chart.getDatasetMeta(datasetIndex);
                if (!meta) {
                    throw new Error('Cannot find a dataset at index ' + datasetIndex);
                }
                return {
                    datasetIndex,
                    element: meta.data[index],
                    index
                };
            });
            const changed = !_elementsEqual(lastActive, active);
            const positionChanged = this._positionChanged(active, eventPosition);
            if (changed || positionChanged) {
                this._active = active;
                this._eventPosition = eventPosition;
                this._ignoreReplayEvents = true;
                this.update(true);
            }
        }
     handleEvent(e, replay, inChartArea = true) {
            if (replay && this._ignoreReplayEvents) {
                return false;
            }
            this._ignoreReplayEvents = false;
            const options = this.options;
            const lastActive = this._active || [];
            const active = this._getActiveElements(e, lastActive, replay, inChartArea);
            const positionChanged = this._positionChanged(active, e);
            const changed = replay || !_elementsEqual(active, lastActive) || positionChanged;
            if (changed) {
                this._active = active;
                if (options.enabled || options.external) {
                    this._eventPosition = {
                        x: e.x,
                        y: e.y
                    };
                    this.update(true, replay);
                }
            }
            return changed;
        }
     _getActiveElements(e, lastActive, replay, inChartArea) {
            const options = this.options;
            if (e.type === 'mouseout') {
                return [];
            }
            if (!inChartArea) {
                return lastActive.filter((i)=>this.chart.data.datasets[i.datasetIndex] && this.chart.getDatasetMeta(i.datasetIndex).controller.getParsed(i.index) !== undefined);
            }
            const active = this.chart.getElementsAtEventForMode(e, options.mode, options, replay);
            if (options.reverse) {
                active.reverse();
            }
            return active;
        }
     _positionChanged(active, e) {
            const { caretX , caretY , options  } = this;
            const position = positioners[options.position].call(this, active, e);
            return position !== false && (caretX !== position.x || caretY !== position.y);
        }
    }
    var plugin_tooltip = {
        id: 'tooltip',
        _element: Tooltip,
        positioners,
        afterInit (chart, _args, options) {
            if (options) {
                chart.tooltip = new Tooltip({
                    chart,
                    options
                });
            }
        },
        beforeUpdate (chart, _args, options) {
            if (chart.tooltip) {
                chart.tooltip.initialize(options);
            }
        },
        reset (chart, _args, options) {
            if (chart.tooltip) {
                chart.tooltip.initialize(options);
            }
        },
        afterDraw (chart) {
            const tooltip = chart.tooltip;
            if (tooltip && tooltip._willRender()) {
                const args = {
                    tooltip
                };
                if (chart.notifyPlugins('beforeTooltipDraw', {
                    ...args,
                    cancelable: true
                }) === false) {
                    return;
                }
                tooltip.draw(chart.ctx);
                chart.notifyPlugins('afterTooltipDraw', args);
            }
        },
        afterEvent (chart, args) {
            if (chart.tooltip) {
                const useFinalPosition = args.replay;
                if (chart.tooltip.handleEvent(args.event, useFinalPosition, args.inChartArea)) {
                    args.changed = true;
                }
            }
        },
        defaults: {
            enabled: true,
            external: null,
            position: 'average',
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            titleFont: {
                weight: 'bold'
            },
            titleSpacing: 2,
            titleMarginBottom: 6,
            titleAlign: 'left',
            bodyColor: '#fff',
            bodySpacing: 2,
            bodyFont: {},
            bodyAlign: 'left',
            footerColor: '#fff',
            footerSpacing: 2,
            footerMarginTop: 6,
            footerFont: {
                weight: 'bold'
            },
            footerAlign: 'left',
            padding: 6,
            caretPadding: 2,
            caretSize: 5,
            cornerRadius: 6,
            boxHeight: (ctx, opts)=>opts.bodyFont.size,
            boxWidth: (ctx, opts)=>opts.bodyFont.size,
            multiKeyBackground: '#fff',
            displayColors: true,
            boxPadding: 0,
            borderColor: 'rgba(0,0,0,0)',
            borderWidth: 0,
            animation: {
                duration: 400,
                easing: 'easeOutQuart'
            },
            animations: {
                numbers: {
                    type: 'number',
                    properties: [
                        'x',
                        'y',
                        'width',
                        'height',
                        'caretX',
                        'caretY'
                    ]
                },
                opacity: {
                    easing: 'linear',
                    duration: 200
                }
            },
            callbacks: defaultCallbacks
        },
        defaultRoutes: {
            bodyFont: 'font',
            footerFont: 'font',
            titleFont: 'font'
        },
        descriptors: {
            _scriptable: (name)=>name !== 'filter' && name !== 'itemSort' && name !== 'external',
            _indexable: false,
            callbacks: {
                _scriptable: false,
                _indexable: false
            },
            animation: {
                _fallback: false
            },
            animations: {
                _fallback: 'animation'
            }
        },
        additionalOptionScopes: [
            'interaction'
        ]
    };

    const INTERVALS = {
        millisecond: {
            common: true,
            size: 1,
            steps: 1000
        },
        second: {
            common: true,
            size: 1000,
            steps: 60
        },
        minute: {
            common: true,
            size: 60000,
            steps: 60
        },
        hour: {
            common: true,
            size: 3600000,
            steps: 24
        },
        day: {
            common: true,
            size: 86400000,
            steps: 30
        },
        week: {
            common: false,
            size: 604800000,
            steps: 4
        },
        month: {
            common: true,
            size: 2.628e9,
            steps: 12
        },
        quarter: {
            common: false,
            size: 7.884e9,
            steps: 4
        },
        year: {
            common: true,
            size: 3.154e10
        }
    };
     const UNITS =  /* #__PURE__ */ Object.keys(INTERVALS);
     function sorter(a, b) {
        return a - b;
    }
     function parse(scale, input) {
        if (isNullOrUndef(input)) {
            return null;
        }
        const adapter = scale._adapter;
        const { parser , round , isoWeekday  } = scale._parseOpts;
        let value = input;
        if (typeof parser === 'function') {
            value = parser(value);
        }
        if (!isNumberFinite(value)) {
            value = typeof parser === 'string' ? adapter.parse(value, parser) : adapter.parse(value);
        }
        if (value === null) {
            return null;
        }
        if (round) {
            value = round === 'week' && (isNumber(isoWeekday) || isoWeekday === true) ? adapter.startOf(value, 'isoWeek', isoWeekday) : adapter.startOf(value, round);
        }
        return +value;
    }
     function determineUnitForAutoTicks(minUnit, min, max, capacity) {
        const ilen = UNITS.length;
        for(let i = UNITS.indexOf(minUnit); i < ilen - 1; ++i){
            const interval = INTERVALS[UNITS[i]];
            const factor = interval.steps ? interval.steps : Number.MAX_SAFE_INTEGER;
            if (interval.common && Math.ceil((max - min) / (factor * interval.size)) <= capacity) {
                return UNITS[i];
            }
        }
        return UNITS[ilen - 1];
    }
     function determineUnitForFormatting(scale, numTicks, minUnit, min, max) {
        for(let i = UNITS.length - 1; i >= UNITS.indexOf(minUnit); i--){
            const unit = UNITS[i];
            if (INTERVALS[unit].common && scale._adapter.diff(max, min, unit) >= numTicks - 1) {
                return unit;
            }
        }
        return UNITS[minUnit ? UNITS.indexOf(minUnit) : 0];
    }
     function determineMajorUnit(unit) {
        for(let i = UNITS.indexOf(unit) + 1, ilen = UNITS.length; i < ilen; ++i){
            if (INTERVALS[UNITS[i]].common) {
                return UNITS[i];
            }
        }
    }
     function addTick(ticks, time, timestamps) {
        if (!timestamps) {
            ticks[time] = true;
        } else if (timestamps.length) {
            const { lo , hi  } = _lookup(timestamps, time);
            const timestamp = timestamps[lo] >= time ? timestamps[lo] : timestamps[hi];
            ticks[timestamp] = true;
        }
    }
     function setMajorTicks(scale, ticks, map, majorUnit) {
        const adapter = scale._adapter;
        const first = +adapter.startOf(ticks[0].value, majorUnit);
        const last = ticks[ticks.length - 1].value;
        let major, index;
        for(major = first; major <= last; major = +adapter.add(major, 1, majorUnit)){
            index = map[major];
            if (index >= 0) {
                ticks[index].major = true;
            }
        }
        return ticks;
    }
     function ticksFromTimestamps(scale, values, majorUnit) {
        const ticks = [];
         const map = {};
        const ilen = values.length;
        let i, value;
        for(i = 0; i < ilen; ++i){
            value = values[i];
            map[value] = i;
            ticks.push({
                value,
                major: false
            });
        }
        return ilen === 0 || !majorUnit ? ticks : setMajorTicks(scale, ticks, map, majorUnit);
    }
    class TimeScale extends Scale {
        static id = 'time';
     static defaults = {
     bounds: 'data',
            adapters: {},
            time: {
                parser: false,
                unit: false,
                round: false,
                isoWeekday: false,
                minUnit: 'millisecond',
                displayFormats: {}
            },
            ticks: {
     source: 'auto',
                callback: false,
                major: {
                    enabled: false
                }
            }
        };
     constructor(props){
            super(props);
             this._cache = {
                data: [],
                labels: [],
                all: []
            };
             this._unit = 'day';
             this._majorUnit = undefined;
            this._offsets = {};
            this._normalized = false;
            this._parseOpts = undefined;
        }
        init(scaleOpts, opts = {}) {
            const time = scaleOpts.time || (scaleOpts.time = {});
             const adapter = this._adapter = new adapters._date(scaleOpts.adapters.date);
            adapter.init(opts);
            mergeIf(time.displayFormats, adapter.formats());
            this._parseOpts = {
                parser: time.parser,
                round: time.round,
                isoWeekday: time.isoWeekday
            };
            super.init(scaleOpts);
            this._normalized = opts.normalized;
        }
     parse(raw, index) {
            if (raw === undefined) {
                return null;
            }
            return parse(this, raw);
        }
        beforeLayout() {
            super.beforeLayout();
            this._cache = {
                data: [],
                labels: [],
                all: []
            };
        }
        determineDataLimits() {
            const options = this.options;
            const adapter = this._adapter;
            const unit = options.time.unit || 'day';
            let { min , max , minDefined , maxDefined  } = this.getUserBounds();
     function _applyBounds(bounds) {
                if (!minDefined && !isNaN(bounds.min)) {
                    min = Math.min(min, bounds.min);
                }
                if (!maxDefined && !isNaN(bounds.max)) {
                    max = Math.max(max, bounds.max);
                }
            }
            if (!minDefined || !maxDefined) {
                _applyBounds(this._getLabelBounds());
                if (options.bounds !== 'ticks' || options.ticks.source !== 'labels') {
                    _applyBounds(this.getMinMax(false));
                }
            }
            min = isNumberFinite(min) && !isNaN(min) ? min : +adapter.startOf(Date.now(), unit);
            max = isNumberFinite(max) && !isNaN(max) ? max : +adapter.endOf(Date.now(), unit) + 1;
            this.min = Math.min(min, max - 1);
            this.max = Math.max(min + 1, max);
        }
     _getLabelBounds() {
            const arr = this.getLabelTimestamps();
            let min = Number.POSITIVE_INFINITY;
            let max = Number.NEGATIVE_INFINITY;
            if (arr.length) {
                min = arr[0];
                max = arr[arr.length - 1];
            }
            return {
                min,
                max
            };
        }
     buildTicks() {
            const options = this.options;
            const timeOpts = options.time;
            const tickOpts = options.ticks;
            const timestamps = tickOpts.source === 'labels' ? this.getLabelTimestamps() : this._generate();
            if (options.bounds === 'ticks' && timestamps.length) {
                this.min = this._userMin || timestamps[0];
                this.max = this._userMax || timestamps[timestamps.length - 1];
            }
            const min = this.min;
            const max = this.max;
            const ticks = _filterBetween(timestamps, min, max);
            this._unit = timeOpts.unit || (tickOpts.autoSkip ? determineUnitForAutoTicks(timeOpts.minUnit, this.min, this.max, this._getLabelCapacity(min)) : determineUnitForFormatting(this, ticks.length, timeOpts.minUnit, this.min, this.max));
            this._majorUnit = !tickOpts.major.enabled || this._unit === 'year' ? undefined : determineMajorUnit(this._unit);
            this.initOffsets(timestamps);
            if (options.reverse) {
                ticks.reverse();
            }
            return ticksFromTimestamps(this, ticks, this._majorUnit);
        }
        afterAutoSkip() {
            if (this.options.offsetAfterAutoskip) {
                this.initOffsets(this.ticks.map((tick)=>+tick.value));
            }
        }
     initOffsets(timestamps = []) {
            let start = 0;
            let end = 0;
            let first, last;
            if (this.options.offset && timestamps.length) {
                first = this.getDecimalForValue(timestamps[0]);
                if (timestamps.length === 1) {
                    start = 1 - first;
                } else {
                    start = (this.getDecimalForValue(timestamps[1]) - first) / 2;
                }
                last = this.getDecimalForValue(timestamps[timestamps.length - 1]);
                if (timestamps.length === 1) {
                    end = last;
                } else {
                    end = (last - this.getDecimalForValue(timestamps[timestamps.length - 2])) / 2;
                }
            }
            const limit = timestamps.length < 3 ? 0.5 : 0.25;
            start = _limitValue(start, 0, limit);
            end = _limitValue(end, 0, limit);
            this._offsets = {
                start,
                end,
                factor: 1 / (start + 1 + end)
            };
        }
     _generate() {
            const adapter = this._adapter;
            const min = this.min;
            const max = this.max;
            const options = this.options;
            const timeOpts = options.time;
            const minor = timeOpts.unit || determineUnitForAutoTicks(timeOpts.minUnit, min, max, this._getLabelCapacity(min));
            const stepSize = valueOrDefault(options.ticks.stepSize, 1);
            const weekday = minor === 'week' ? timeOpts.isoWeekday : false;
            const hasWeekday = isNumber(weekday) || weekday === true;
            const ticks = {};
            let first = min;
            let time, count;
            if (hasWeekday) {
                first = +adapter.startOf(first, 'isoWeek', weekday);
            }
            first = +adapter.startOf(first, hasWeekday ? 'day' : minor);
            if (adapter.diff(max, min, minor) > 100000 * stepSize) {
                throw new Error(min + ' and ' + max + ' are too far apart with stepSize of ' + stepSize + ' ' + minor);
            }
            const timestamps = options.ticks.source === 'data' && this.getDataTimestamps();
            for(time = first, count = 0; time < max; time = +adapter.add(time, stepSize, minor), count++){
                addTick(ticks, time, timestamps);
            }
            if (time === max || options.bounds === 'ticks' || count === 1) {
                addTick(ticks, time, timestamps);
            }
            return Object.keys(ticks).sort(sorter).map((x)=>+x);
        }
     getLabelForValue(value) {
            const adapter = this._adapter;
            const timeOpts = this.options.time;
            if (timeOpts.tooltipFormat) {
                return adapter.format(value, timeOpts.tooltipFormat);
            }
            return adapter.format(value, timeOpts.displayFormats.datetime);
        }
     format(value, format) {
            const options = this.options;
            const formats = options.time.displayFormats;
            const unit = this._unit;
            const fmt = format || formats[unit];
            return this._adapter.format(value, fmt);
        }
     _tickFormatFunction(time, index, ticks, format) {
            const options = this.options;
            const formatter = options.ticks.callback;
            if (formatter) {
                return callback(formatter, [
                    time,
                    index,
                    ticks
                ], this);
            }
            const formats = options.time.displayFormats;
            const unit = this._unit;
            const majorUnit = this._majorUnit;
            const minorFormat = unit && formats[unit];
            const majorFormat = majorUnit && formats[majorUnit];
            const tick = ticks[index];
            const major = majorUnit && majorFormat && tick && tick.major;
            return this._adapter.format(time, format || (major ? majorFormat : minorFormat));
        }
     generateTickLabels(ticks) {
            let i, ilen, tick;
            for(i = 0, ilen = ticks.length; i < ilen; ++i){
                tick = ticks[i];
                tick.label = this._tickFormatFunction(tick.value, i, ticks);
            }
        }
     getDecimalForValue(value) {
            return value === null ? NaN : (value - this.min) / (this.max - this.min);
        }
     getPixelForValue(value) {
            const offsets = this._offsets;
            const pos = this.getDecimalForValue(value);
            return this.getPixelForDecimal((offsets.start + pos) * offsets.factor);
        }
     getValueForPixel(pixel) {
            const offsets = this._offsets;
            const pos = this.getDecimalForPixel(pixel) / offsets.factor - offsets.end;
            return this.min + pos * (this.max - this.min);
        }
     _getLabelSize(label) {
            const ticksOpts = this.options.ticks;
            const tickLabelWidth = this.ctx.measureText(label).width;
            const angle = toRadians(this.isHorizontal() ? ticksOpts.maxRotation : ticksOpts.minRotation);
            const cosRotation = Math.cos(angle);
            const sinRotation = Math.sin(angle);
            const tickFontSize = this._resolveTickFontOptions(0).size;
            return {
                w: tickLabelWidth * cosRotation + tickFontSize * sinRotation,
                h: tickLabelWidth * sinRotation + tickFontSize * cosRotation
            };
        }
     _getLabelCapacity(exampleTime) {
            const timeOpts = this.options.time;
            const displayFormats = timeOpts.displayFormats;
            const format = displayFormats[timeOpts.unit] || displayFormats.millisecond;
            const exampleLabel = this._tickFormatFunction(exampleTime, 0, ticksFromTimestamps(this, [
                exampleTime
            ], this._majorUnit), format);
            const size = this._getLabelSize(exampleLabel);
            const capacity = Math.floor(this.isHorizontal() ? this.width / size.w : this.height / size.h) - 1;
            return capacity > 0 ? capacity : 1;
        }
     getDataTimestamps() {
            let timestamps = this._cache.data || [];
            let i, ilen;
            if (timestamps.length) {
                return timestamps;
            }
            const metas = this.getMatchingVisibleMetas();
            if (this._normalized && metas.length) {
                return this._cache.data = metas[0].controller.getAllParsedValues(this);
            }
            for(i = 0, ilen = metas.length; i < ilen; ++i){
                timestamps = timestamps.concat(metas[i].controller.getAllParsedValues(this));
            }
            return this._cache.data = this.normalize(timestamps);
        }
     getLabelTimestamps() {
            const timestamps = this._cache.labels || [];
            let i, ilen;
            if (timestamps.length) {
                return timestamps;
            }
            const labels = this.getLabels();
            for(i = 0, ilen = labels.length; i < ilen; ++i){
                timestamps.push(parse(this, labels[i]));
            }
            return this._cache.labels = this._normalized ? timestamps : this.normalize(timestamps);
        }
     normalize(values) {
            return _arrayUnique(values.sort(sorter));
        }
    }

    function interpolate(table, val, reverse) {
        let lo = 0;
        let hi = table.length - 1;
        let prevSource, nextSource, prevTarget, nextTarget;
        if (reverse) {
            if (val >= table[lo].pos && val <= table[hi].pos) {
                ({ lo , hi  } = _lookupByKey(table, 'pos', val));
            }
            ({ pos: prevSource , time: prevTarget  } = table[lo]);
            ({ pos: nextSource , time: nextTarget  } = table[hi]);
        } else {
            if (val >= table[lo].time && val <= table[hi].time) {
                ({ lo , hi  } = _lookupByKey(table, 'time', val));
            }
            ({ time: prevSource , pos: prevTarget  } = table[lo]);
            ({ time: nextSource , pos: nextTarget  } = table[hi]);
        }
        const span = nextSource - prevSource;
        return span ? prevTarget + (nextTarget - prevTarget) * (val - prevSource) / span : prevTarget;
    }
    class TimeSeriesScale extends TimeScale {
        static id = 'timeseries';
     static defaults = TimeScale.defaults;
     constructor(props){
            super(props);
             this._table = [];
             this._minPos = undefined;
             this._tableRange = undefined;
        }
     initOffsets() {
            const timestamps = this._getTimestampsForTable();
            const table = this._table = this.buildLookupTable(timestamps);
            this._minPos = interpolate(table, this.min);
            this._tableRange = interpolate(table, this.max) - this._minPos;
            super.initOffsets(timestamps);
        }
     buildLookupTable(timestamps) {
            const { min , max  } = this;
            const items = [];
            const table = [];
            let i, ilen, prev, curr, next;
            for(i = 0, ilen = timestamps.length; i < ilen; ++i){
                curr = timestamps[i];
                if (curr >= min && curr <= max) {
                    items.push(curr);
                }
            }
            if (items.length < 2) {
                return [
                    {
                        time: min,
                        pos: 0
                    },
                    {
                        time: max,
                        pos: 1
                    }
                ];
            }
            for(i = 0, ilen = items.length; i < ilen; ++i){
                next = items[i + 1];
                prev = items[i - 1];
                curr = items[i];
                if (Math.round((next + prev) / 2) !== curr) {
                    table.push({
                        time: curr,
                        pos: i / (ilen - 1)
                    });
                }
            }
            return table;
        }
     _generate() {
            const min = this.min;
            const max = this.max;
            let timestamps = super.getDataTimestamps();
            if (!timestamps.includes(min) || !timestamps.length) {
                timestamps.splice(0, 0, min);
            }
            if (!timestamps.includes(max) || timestamps.length === 1) {
                timestamps.push(max);
            }
            return timestamps.sort((a, b)=>a - b);
        }
     _getTimestampsForTable() {
            let timestamps = this._cache.all || [];
            if (timestamps.length) {
                return timestamps;
            }
            const data = this.getDataTimestamps();
            const label = this.getLabelTimestamps();
            if (data.length && label.length) {
                timestamps = this.normalize(data.concat(label));
            } else {
                timestamps = data.length ? data : label;
            }
            timestamps = this._cache.all = timestamps;
            return timestamps;
        }
     getDecimalForValue(value) {
            return (interpolate(this._table, value) - this._minPos) / this._tableRange;
        }
     getValueForPixel(pixel) {
            const offsets = this._offsets;
            const decimal = this.getDecimalForPixel(pixel) / offsets.factor - offsets.end;
            return interpolate(this._table, decimal * this._tableRange + this._minPos, true);
        }
    }

    /**
     * Imperative Chart.js half-doughnut for the observable token gauge dial.
     * String templates omit canvas logic (ADR-005).
     */
    Chart.register(DoughnutController, ArcElement, plugin_tooltip);
    const chartsByCanvas = new WeakMap();
    function detachUsageDialChart(canvas) {
        const prev = chartsByCanvas.get(canvas);
        if (!prev)
            return;
        prev.destroy();
        chartsByCanvas.delete(canvas);
    }
    /** Call before assigning `innerHTML` on a subtree that contains dial canvases. */
    function detachUsageDialChartsIn(root) {
        for (const node of root.querySelectorAll('canvas[data-gauge-dial="1"]')) {
            if (node instanceof HTMLCanvasElement)
                detachUsageDialChart(node);
        }
    }
    function readCssColor(name, fallbackHex) {
        if (typeof document === "undefined")
            return fallbackHex;
        const v = getComputedStyle(document.documentElement)
            .getPropertyValue(name)
            .trim();
        return v !== "" ? v : fallbackHex;
    }
    function arcBorderHex() {
        return readCssColor("--surface", "#181b24");
    }
    function resolveSegmentColor(seg) {
        if (seg.color && seg.color.trim() !== "")
            return seg.color.trim();
        return readCssColor("--other", "#5c6370");
    }
    /** Mirrors `.bar-fill.*` hues using dashboard CSS variables (theme-aware). */
    function defaultUsageDialSegmentsFromUsage(usage) {
        const tool = usage.toolLifecycleOutputs ?? usage.toolResults;
        return [
            {
                value: Math.max(0, usage.input),
                color: readCssColor("--assistant", "#6c9fff"),
            },
            {
                value: Math.max(0, usage.output),
                color: readCssColor("--bar-output", "#8ab4ff"),
            },
            {
                value: Math.max(0, tool),
                color: readCssColor("--tool", "#e8a23a"),
            },
            {
                value: Math.max(0, usage.shellOutput),
                color: readCssColor("--shell", "#c678f0"),
            },
        ];
    }
    function attachUsageDialChart(canvas, segments) {
        detachUsageDialChart(canvas);
        let data = segments.map((s) => Math.max(0, Number(s.value) || 0));
        let backgroundColor;
        if (segments.length === 0) {
            data = [1];
            backgroundColor = [readCssColor("--muted", "#8b93a7")];
        }
        else if (data.every((v) => v === 0)) {
            data = segments.map(() => 1);
            backgroundColor = segments.map((s) => resolveSegmentColor(s));
        }
        else {
            backgroundColor = segments.map((s) => resolveSegmentColor(s));
        }
        const borderColor = arcBorderHex();
        const ctx = canvas.getContext("2d");
        if (!ctx)
            return null;
        const chart = new Chart(ctx, {
            type: "doughnut",
            data: {
                datasets: [
                    {
                        data,
                        backgroundColor,
                        borderWidth: 2,
                        borderColor,
                        hoverBorderColor: borderColor,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false },
                },
                rotation: -90,
                circumference: 180,
                cutout: "85%",
                animation: { duration: 450 },
                layout: { padding: 0 },
            },
        });
        chartsByCanvas.set(canvas, chart);
        return chart;
    }

    /**
     * Efficiency score + sparkline card view.
     * @see ADR-005
     */
    function efficiencyViewInnerHtml(props) {
        const idAttr = props.svgId != null && props.svgId !== ""
            ? ` id="${escapeHtml(props.svgId)}"`
            : "";
        return `
<div class="score-block">
  <span class="score">${escapeHtml(props.scoreText)}</span>
  <span class="muted small">/ 100</span>
</div>
<div class="sparkline-wrap">
  <svg${idAttr}
    viewBox="0 0 200 48"
    aria-hidden="true"
  >
    <polyline fill="none" points="${escapeHtml(props.sparklinePoints)}" />
  </svg>
</div>
`.trim();
    }
    function efficiencyViewHtml(props) {
        return dashboardCardHtml({
            id: props.id,
            className: props.className,
            title: props.title ?? "Efficiency",
            bodyHtml: efficiencyViewInnerHtml(props),
        });
    }

    /**
     * Configurable dashboard grid wrapper with optional template-area injection.
     * @see ADR-005
     */
    function normalizeTemplateAreas(templateAreas) {
        if (typeof templateAreas === "string") {
            return templateAreas.trim();
        }
        return templateAreas
            .map((row) => `"${row.trim()}"`)
            .join(" ")
            .trim();
    }
    function templateAreaRows(templateAreas) {
        if (typeof templateAreas === "string") {
            const rows = templateAreas
                .split('"')
                .map((part) => part.trim())
                .filter((part) => part.length > 0);
            return rows.length > 0 ? rows : [templateAreas.trim()];
        }
        return templateAreas.map((row) => row.trim()).filter((row) => row.length > 0);
    }
    function templateAreaColumnCount(rows) {
        const first = rows[0];
        if (first == null) {
            return 1;
        }
        const cols = first.split(/\s+/).filter(Boolean).length;
        return cols > 0 ? cols : 1;
    }
    function isTemplateAreaBreakpoints(value) {
        return typeof value === "object" && value != null && !Array.isArray(value);
    }
    function defaultTemplateForBreakpoints(templateAreas) {
        return (templateAreas.maxDesktop ??
            templateAreas.maxLaptop ??
            templateAreas.maxTablet ??
            templateAreas.maxMobile ??
            templateAreas.maxExtraLarge ??
            templateAreas.maxLarge ??
            templateAreas.maxMedium ??
            templateAreas.maxSmall);
    }
    function dashboardGridHtml(props) {
        const componentClass = classHelper("dashboard-grid", props.className ?? "");
        const attrs = [];
        if (props.templateAreas != null) {
            if (isTemplateAreaBreakpoints(props.templateAreas)) {
                const serialized = escapeHtml(JSON.stringify(props.templateAreas));
                attrs.push(` data-dashboard-grid-breakpoints="${serialized}"`);
                const fallback = defaultTemplateForBreakpoints(props.templateAreas);
                if (fallback != null) {
                    attrs.push(` style="grid-template-areas: ${escapeHtml(normalizeTemplateAreas(fallback))};"`);
                }
            }
            else {
                attrs.push(` style="grid-template-areas: ${escapeHtml(normalizeTemplateAreas(props.templateAreas))};"`);
            }
        }
        return `
<main class="${escapeHtml(componentClass)}"${attrs.join("")}>
  ${props.contentHtml}
</main>
`.trim();
    }
    const DEFAULT_CUTOFFS = {
        maxMobile: 480,
        maxTablet: 768,
        maxLaptop: 1024,
    };
    function normalizedCutoffWidths(breakpoints) {
        const maxMobile = breakpoints.cutoffWidths?.maxMobile ?? DEFAULT_CUTOFFS.maxMobile;
        const maxTablet = breakpoints.cutoffWidths?.maxTablet ?? DEFAULT_CUTOFFS.maxTablet;
        const maxLaptop = breakpoints.cutoffWidths?.maxLaptop ?? DEFAULT_CUTOFFS.maxLaptop;
        return {
            maxMobile,
            maxTablet: Math.max(maxTablet, maxMobile),
            maxLaptop: Math.max(maxLaptop, maxTablet),
        };
    }
    function areaFor(breakpoints, tier) {
        if (tier === "mobile") {
            return breakpoints.maxMobile ?? breakpoints.maxSmall;
        }
        if (tier === "tablet") {
            return breakpoints.maxTablet ?? breakpoints.maxMedium;
        }
        if (tier === "laptop") {
            return breakpoints.maxLaptop ?? breakpoints.maxLarge;
        }
        return breakpoints.maxDesktop ?? breakpoints.maxExtraLarge;
    }
    let resizeListenerAttached = false;
    let resizeDebounceTimer = null;
    function parseBreakpointsAttr(value) {
        try {
            const parsed = JSON.parse(value);
            if (typeof parsed !== "object" || parsed == null || Array.isArray(parsed)) {
                return null;
            }
            return parsed;
        }
        catch {
            return null;
        }
    }
    function resolveTemplateAreasForWidth(width, breakpoints) {
        const cutoffs = normalizedCutoffWidths(breakpoints);
        if (width <= cutoffs.maxMobile) {
            return null;
        }
        if (width <= cutoffs.maxTablet) {
            return (areaFor(breakpoints, "tablet") ??
                areaFor(breakpoints, "laptop") ??
                areaFor(breakpoints, "desktop") ??
                null);
        }
        if (width <= cutoffs.maxLaptop) {
            return (areaFor(breakpoints, "laptop") ?? areaFor(breakpoints, "desktop") ?? null);
        }
        return (areaFor(breakpoints, "desktop") ?? areaFor(breakpoints, "laptop") ?? null);
    }
    function currentViewportWidth() {
        if (typeof window === "undefined") {
            return 0;
        }
        const vv = window.visualViewport;
        if (vv != null && Number.isFinite(vv.width) && vv.width > 0) {
            return vv.width;
        }
        return window.innerWidth;
    }
    function applySingleColumnLayout(grid) {
        grid.style.gridTemplateAreas = "none";
        grid.style.gridTemplateColumns = "1fr";
        grid.style.gridTemplateRows = "auto";
        const items = grid.querySelectorAll(":scope > *");
        items.forEach((item) => {
            item.style.gridArea = "auto";
        });
    }
    function clearInlineGridTrackOverrides(grid) {
        grid.style.removeProperty("grid-template-columns");
        grid.style.removeProperty("grid-template-rows");
        const items = grid.querySelectorAll(":scope > *");
        items.forEach((item) => {
            item.style.removeProperty("grid-area");
        });
    }
    function applyResponsiveTemplateAreaToGrid(grid) {
        const raw = grid.getAttribute("data-dashboard-grid-breakpoints");
        if (raw == null || raw.trim() === "") {
            return;
        }
        const breakpoints = parseBreakpointsAttr(raw);
        if (breakpoints == null) {
            return;
        }
        const next = resolveTemplateAreasForWidth(currentViewportWidth(), breakpoints);
        if (next == null) {
            applySingleColumnLayout(grid);
            return;
        }
        clearInlineGridTrackOverrides(grid);
        const rows = templateAreaRows(next);
        const colCount = templateAreaColumnCount(rows);
        grid.style.gridTemplateColumns = `repeat(${colCount}, minmax(0, 1fr))`;
        grid.style.gridTemplateRows = `repeat(${rows.length}, minmax(58px, 1fr))`;
        grid.style.gridTemplateAreas = normalizeTemplateAreas(rows);
    }
    function refreshResponsiveDashboardGrids(root) {
        if (typeof window === "undefined") {
            return;
        }
        const grids = root.querySelectorAll(".dashboard-grid[data-dashboard-grid-breakpoints]");
        grids.forEach((grid) => applyResponsiveTemplateAreaToGrid(grid));
    }
    /**
     * Applies breakpoint-based template areas and subscribes to debounced viewport changes.
     * @see ADR-005
     */
    function attachResponsiveDashboardGrids(root = document) {
        if (typeof window === "undefined") {
            return;
        }
        refreshResponsiveDashboardGrids(root);
        if (resizeListenerAttached) {
            return;
        }
        resizeListenerAttached = true;
        window.addEventListener("resize", () => {
            if (resizeDebounceTimer != null) {
                clearTimeout(resizeDebounceTimer);
            }
            resizeDebounceTimer = setTimeout(() => {
                refreshResponsiveDashboardGrids(document);
            }, 120);
        });
        if (window.visualViewport != null) {
            window.visualViewport.addEventListener("resize", () => {
                if (resizeDebounceTimer != null) {
                    clearTimeout(resizeDebounceTimer);
                }
                resizeDebounceTimer = setTimeout(() => {
                    refreshResponsiveDashboardGrids(document);
                }, 120);
            });
            window.visualViewport.addEventListener("scroll", () => {
                if (resizeDebounceTimer != null) {
                    clearTimeout(resizeDebounceTimer);
                }
                resizeDebounceTimer = setTimeout(() => {
                    refreshResponsiveDashboardGrids(document);
                }, 120);
            });
        }
    }

    /**
     * Observable usage card view (total gauge + breakdown bars).
     * @see ADR-005
     */
    function observableUsageViewHtml(props) {
        const barsIdAttr = props.barsElementId != null && props.barsElementId !== ""
            ? ` id="${escapeHtml(props.barsElementId)}"`
            : "";
        const bodyHtml = `
<div class="gauge-row">
  ${usageTotalGaugeInnerHtml({
        valueText: props.valueText,
        caption: props.caption,
        valueElementId: props.valueElementId,
        showDialChart: props.showDialChart ?? false,
        isAbbreviated: props.isAbbreviated ?? true,
    })}
  <div class="bars"${barsIdAttr}>
    ${props.barsHtml}
  </div>
</div>`.trim();
        return dashboardCardHtml({
            id: props.id,
            className: props.className,
            title: props.title ?? "Observable usage",
            span: props.span ?? "2",
            bodyHtml,
        });
    }

    function usageBarVariant(row) {
        if (row.variant)
            return row.variant;
        if (row.label === "Output")
            return "output";
        if (row.label.includes("Tool"))
            return "tool";
        if (row.label === "Shell")
            return "shell";
        return "input";
    }
    /** Inner HTML for `#usage-bars` (horizontal usage rows only). */
    function usageBarsInnerHtml(rows) {
        return rows
            .map((row) => {
            const w = Math.min(100, Math.max(0, Number(row.widthPct) || 0));
            const cls = usageBarVariant(row);
            return `
          <div class="bar-row">
            <span>${escapeHtml(row.label)}</span>
            <div class="bar-track"><div class="bar-fill ${cls}" style="width:${w}%"></div></div>
            <span class="muted small">${escapeHtml(row.valueText)}</span>
          </div>`;
        })
            .join("");
    }

    /**
     * Horizontal token breakdown rows for observable usage.
     * @see ADR-005
     */
    function tokensFromUsageBarRow(row) {
        const normalized = row.valueText.replace(/,/g, "").trim();
        const n = Number.parseInt(normalized, 10);
        return Number.isFinite(n) ? n : null;
    }
    /** Map numeric breakdown rows + abbreviation flag → horizontal bar HTML */
    function usageBreakdownBarsInnerHtml(props) {
        const abbreviated = props.isAbbreviated === true;
        const mapped = props.rows.map((r) => ({
            label: r.label,
            widthPct: r.widthPct,
            valueText: abbreviated
                ? formatTokenCountAbbreviated(r.tokens)
                : formatTokenCountFull(r.tokens),
            variant: r.variant,
        }));
        return usageBarsInnerHtml(mapped);
    }
    /**
     * Merge optional numeric breakdown with legacy string rows for overview shell.
     */
    function usageRowsToBreakdownInnerHtml(rows, opts) {
        const abbreviated = opts.isAbbreviated === true;
        const mapped = rows.map((row) => {
            const parsed = tokensFromUsageBarRow(row);
            const tokens = parsed ?? 0;
            const valueText = abbreviated
                ? parsed != null
                    ? formatTokenCountAbbreviated(tokens)
                    : row.valueText
                : row.valueText;
            return { ...row, valueText };
        });
        return usageBarsInnerHtml(mapped);
    }

    /**
     * Context audit card view (description + vertical bars slot).
     * @see ADR-005
     */
    function contextAuditViewHtml(props = {}) {
        const barsIdAttr = props.barsElementId != null && props.barsElementId !== ""
            ? ` id="${escapeHtml(props.barsElementId)}"`
            : "";
        const bodyHtml = `
<p class="muted small">${escapeHtml(props.description ?? "Estimated tokens for always-on repo files")}</p>
<div class="bars vertical tall"${barsIdAttr}>${props.barsHtml ?? ""}</div>
`.trim();
        return dashboardCardHtml({
            id: props.id,
            className: props.className,
            title: props.title ?? "Context audit",
            span: props.span ?? "2",
            bodyHtml,
        });
    }

    /**
     * Recommendations card view (ordered list slot).
     * @see ADR-005
     */
    function recommendationsViewHtml(props = {}) {
        const listIdAttr = props.listElementId != null && props.listElementId !== ""
            ? ` id="${escapeHtml(props.listElementId)}"`
            : "";
        const bodyHtml = `<ol class="rec-list"${listIdAttr}>${props.listHtml ?? ""}</ol>`;
        return dashboardCardHtml({
            id: props.id,
            className: props.className,
            title: props.title ?? "Recommendations",
            span: props.span ?? "2",
            bodyHtml,
        });
    }

    /**
     * Red flags card view (unordered list slot).
     * @see ADR-005
     */
    function redFlagsViewHtml(props = {}) {
        const listIdAttr = props.listElementId != null && props.listElementId !== ""
            ? ` id="${escapeHtml(props.listElementId)}"`
            : "";
        const bodyHtml = `<ul class="flag-list"${listIdAttr}>${props.listHtml ?? ""}</ul>`;
        return dashboardCardHtml({
            id: props.id,
            className: props.className,
            title: props.title ?? "Red flags",
            span: props.span,
            bodyHtml,
        });
    }

    /**
     * Tool result histogram view (vertical bars + parity/operation lines).
     * @see ADR-005
     */
    function toolHistogramViewHtml(props = {}) {
        const barsIdAttr = props.barsElementId != null && props.barsElementId !== ""
            ? ` id="${escapeHtml(props.barsElementId)}"`
            : "";
        const parityIdAttr = props.parityLineElementId != null && props.parityLineElementId !== ""
            ? ` id="${escapeHtml(props.parityLineElementId)}"`
            : "";
        const operationIdAttr = props.operationLineElementId != null && props.operationLineElementId !== ""
            ? ` id="${escapeHtml(props.operationLineElementId)}"`
            : "";
        const bodyHtml = `
<div class="bars vertical"${barsIdAttr}>${props.barsHtml ?? ""}</div>
<p class="muted small"${parityIdAttr}>${escapeHtml(props.parityLineText ?? "")}</p>
<p class="muted small"${operationIdAttr}>${escapeHtml(props.operationLineText ?? "")}</p>
`.trim();
        return dashboardCardHtml({
            id: props.id,
            className: props.className,
            title: props.title ?? "Tool result sizes",
            span: props.span,
            bodyHtml,
        });
    }

    /**
     * Timeline card view with meta, track slot, and role legend.
     * @see ADR-005
     */
    function timelineViewHtml(props = {}) {
        const metaIdAttr = props.metaElementId != null && props.metaElementId !== ""
            ? ` id="${escapeHtml(props.metaElementId)}"`
            : "";
        const trackIdAttr = props.trackElementId != null && props.trackElementId !== ""
            ? ` id="${escapeHtml(props.trackElementId)}"`
            : "";
        const bodyHtml = `
<div class="timeline-meta muted small"${metaIdAttr}>${escapeHtml(props.metaLine ?? "")}</div>
<div class="timeline-track"${trackIdAttr}>${props.trackHtml ?? ""}</div>
<div class="timeline-legend">
  <span><i class="dot user"></i> user</span>
  <span><i class="dot assistant"></i> assistant</span>
  <span><i class="dot tool"></i> tool</span>
  <span><i class="dot shell"></i> shell</span>
  <span><i class="dot other"></i> other</span>
</div>
`.trim();
        return dashboardCardHtml({
            id: props.id,
            className: props.className,
            title: props.title ?? "Session timeline",
            span: props.span ?? "3",
            bodyHtml,
        });
    }

    /**
     * Parameterized HTML for the dashboard overview shell (Storybook / live dashboard).
     * @see ADR-005
     */
    const defaultUsageRows = [
        { label: "Input", widthPct: 72, valueText: "41,200", variant: "input" },
        { label: "Output", widthPct: 55, valueText: "31,800", variant: "output" },
        { label: "Tool / MCP", widthPct: 38, valueText: "22,100", variant: "tool" },
        { label: "Shell", widthPct: 12, valueText: "6,900", variant: "shell" },
    ];
    const defaultProps = {
        title: "Agent Profiler Dashboard",
        subtitle: "Storybook preview · session mock",
        sessionOptions: ["latest-session", "older-run"],
        refreshLabel: "Refresh",
        totalTokensValue: "128,400",
        totalTokensCaption: "estimated total tokens",
        usageRows: defaultUsageRows,
        efficiencyScore: "76",
        sparklinePoints: "0,40 40,28 80,34 120,12 160,22 200,8",
        usageAbbreviated: false,
        showDialChart: false,
    };
    function overviewShellHtml(props = {}) {
        const p = {
            ...defaultProps,
            ...props,
            usageRows: props.usageRows ?? defaultProps.usageRows,
            sessionOptions: props.sessionOptions ?? defaultProps.sessionOptions,
            usageAbbreviated: props.usageAbbreviated ?? defaultProps.usageAbbreviated,
            showDialChart: props.showDialChart ?? defaultProps.showDialChart,
            useLiveOverviewSlots: props.useLiveOverviewSlots ?? false,
            additionalMainInnerHtml: props.additionalMainInnerHtml ?? "",
        };
        const sessionOptionsHtml = p.sessionOptions
            .map((opt) => `<option>${escapeHtml(opt)}</option>`)
            .join("\n          ");
        let overviewBlocks;
        if (p.useLiveOverviewSlots) {
            overviewBlocks = `
<div id="slot-overview-usage" class="slot-dashboard-grid"></div>
<div id="slot-overview-efficiency" class="slot-dashboard-grid"></div>`.trim();
        }
        else {
            const usageBarsHtml = props.usageBreakdownRows !== undefined
                ? usageBreakdownBarsInnerHtml({
                    rows: props.usageBreakdownRows,
                    isAbbreviated: p.usageAbbreviated,
                })
                : usageRowsToBreakdownInnerHtml(p.usageRows, {
                    isAbbreviated: p.usageAbbreviated,
                });
            const observableSection = observableUsageViewHtml({
                id: p.options?.observableUsageView?.id,
                className: p.options?.observableUsageView?.className,
                title: p.options?.observableUsageView?.title ?? "Observable usage",
                span: p.options?.observableUsageView?.span ?? "2",
                valueText: p.options?.observableUsageView?.valueText ?? p.totalTokensValue,
                caption: p.options?.observableUsageView?.caption ?? p.totalTokensCaption,
                barsHtml: p.options?.observableUsageView?.barsHtml ?? usageBarsHtml,
                showDialChart: p.options?.observableUsageView?.showDialChart ?? p.showDialChart,
                valueElementId: p.options?.observableUsageView?.valueElementId,
                isAbbreviated: p.options?.observableUsageView?.isAbbreviated ?? true,
                barsElementId: p.options?.observableUsageView?.barsElementId,
            });
            const efficiencySection = efficiencyViewHtml({
                id: p.options?.efficiencyView?.id,
                className: p.options?.efficiencyView?.className,
                title: p.options?.efficiencyView?.title ?? "Efficiency",
                scoreText: p.options?.efficiencyView?.scoreText ?? p.efficiencyScore,
                sparklinePoints: p.options?.efficiencyView?.sparklinePoints ?? p.sparklinePoints,
                svgId: p.options?.efficiencyView?.svgId ?? "score-sparkline",
            });
            overviewBlocks = `${observableSection}\n\n${efficiencySection}`;
        }
        const subtitleIdAttr = props.subtitleElementId != null && props.subtitleElementId !== ""
            ? ` id="${escapeHtml(props.subtitleElementId)}"`
            : "";
        const sessionSelectIdAttr = props.sessionSelectId != null && props.sessionSelectId !== ""
            ? ` id="${escapeHtml(props.sessionSelectId)}"`
            : "";
        const suffix = p.additionalMainInnerHtml.trim() === ""
            ? ""
            : `\n\n${p.additionalMainInnerHtml.trim()}`;
        const lowerViewBlocks = [];
        if (p.options?.timelineView != null) {
            lowerViewBlocks.push(timelineViewHtml({
                id: p.options.timelineView.id,
                className: p.options.timelineView.className,
                title: p.options.timelineView.title ?? "Session timeline",
                span: p.options.timelineView.span ?? "3",
                metaLine: p.options.timelineView.metaLine ?? "",
                metaElementId: p.options.timelineView.metaElementId,
                trackHtml: p.options.timelineView.trackHtml,
                trackElementId: p.options.timelineView.trackElementId,
            }));
        }
        if (p.options?.toolHistogramView != null) {
            lowerViewBlocks.push(toolHistogramViewHtml({
                id: p.options.toolHistogramView.id,
                className: p.options.toolHistogramView.className,
                title: p.options.toolHistogramView.title ?? "Tool result sizes",
                span: p.options.toolHistogramView.span,
                barsElementId: p.options.toolHistogramView.barsElementId,
                barsHtml: p.options.toolHistogramView.barsHtml,
                parityLineElementId: p.options.toolHistogramView.parityLineElementId,
                parityLineText: p.options.toolHistogramView.parityLineText,
                operationLineElementId: p.options.toolHistogramView.operationLineElementId,
                operationLineText: p.options.toolHistogramView.operationLineText,
            }));
        }
        if (p.options?.contextAuditView != null) {
            lowerViewBlocks.push(contextAuditViewHtml({
                id: p.options.contextAuditView.id,
                className: p.options.contextAuditView.className,
                title: p.options.contextAuditView.title ?? "Context audit",
                span: p.options.contextAuditView.span ?? "2",
                description: p.options.contextAuditView.description ??
                    "Estimated tokens for always-on repo files",
                barsElementId: p.options.contextAuditView.barsElementId,
                barsHtml: p.options.contextAuditView.barsHtml,
            }));
        }
        if (p.options?.redFlagsView != null) {
            lowerViewBlocks.push(redFlagsViewHtml({
                id: p.options.redFlagsView.id,
                className: p.options.redFlagsView.className,
                title: p.options.redFlagsView.title ?? "Red flags",
                span: p.options.redFlagsView.span,
                listElementId: p.options.redFlagsView.listElementId,
                listHtml: p.options.redFlagsView.listHtml,
            }));
        }
        if (p.options?.recommendationsView != null) {
            lowerViewBlocks.push(recommendationsViewHtml({
                id: p.options.recommendationsView.id,
                className: p.options.recommendationsView.className,
                title: p.options.recommendationsView.title ?? "Recommendations",
                span: p.options.recommendationsView.span ?? "2",
                listElementId: p.options.recommendationsView.listElementId,
                listHtml: p.options.recommendationsView.listHtml,
            }));
        }
        const lowerViewsSuffix = lowerViewBlocks.length > 0 ? `\n\n${lowerViewBlocks.join("\n\n")}` : "";
        const gridContentHtml = `${overviewBlocks}${suffix}${lowerViewsSuffix}`;
        const dashboardGrid = dashboardGridHtml({
            contentHtml: gridContentHtml,
            templateAreas: p.options?.dashboardGrid?.templateAreas,
            className: p.options?.dashboardGrid?.className,
        });
        return `
<div class="layout">
  <header class="header">
    <div>
      <h1>${escapeHtml(p.title)}</h1>
      <p class="muted"${subtitleIdAttr}>${escapeHtml(p.subtitle)}</p>
    </div>
    <div class="header-actions">
      <label class="session-label">
        Session
        <select aria-label="Session"${sessionSelectIdAttr}>
          ${sessionOptionsHtml}
        </select>
      </label>
      ${dashboardButtonHtml({
        label: p.refreshLabel,
        id: props.refreshButtonId,
        ariaLabel: props.refreshButtonAriaLabel,
    })}
    </div>
  </header>

  ${dashboardGrid}
</div>
`.trim();
    }

    /**
     * Inner HTML for `#timeline-track` using time-proportional widths (production shape).
     */
    function timelineTrackInnerHtml(segments) {
        return segments
            .map((s) => {
            const w = Math.min(100, Math.max(0.15, Number(s.widthPct) || 0));
            const titleAttr = s.title ? ` title="${escapeHtml(s.title)}"` : "";
            return `<div class="timeline-seg ${s.role}" style="width: ${w}%"${titleAttr}></div>`;
        })
            .join("");
    }

    /**
     * Turn API timeline events into width-% segments for `timelineTrackInnerHtml`,
     * matching the legacy dashboard algorithm.
     */
    function computeTimelineTrackSegments(timeline, fmtTokens) {
        if (!timeline || timeline.length === 0)
            return [];
        const t0 = new Date(timeline[0].createdAt).getTime();
        const t1 = new Date(timeline[timeline.length - 1].createdAt).getTime();
        const span = Math.max(1, t1 - t0);
        const out = [];
        for (let i = 0; i < timeline.length; i++) {
            const ev = timeline[i];
            const start = new Date(ev.createdAt).getTime();
            const end = i + 1 < timeline.length
                ? new Date(timeline[i + 1].createdAt).getTime()
                : start + 1;
            const widthPct = Math.max(0.15, ((end - start) / span) * 100);
            const role = eventRoleToTimelineClass(ev.role);
            const title = `${ev.role} · ${fmtTokens(ev.estimatedTotalTokens)} tok`;
            out.push({ role, widthPct, title });
        }
        return out;
    }

    /**
     * Parameterized HTML fragments for vertical tool/context bars (Storybook + runtime inner HTML).
     */
    /** Inner HTML for `.bars.vertical` containers (e.g. `#tool-histogram`, `#context-bars`). */
    function verticalBarsInnerHtml(items) {
        return items
            .map((item) => {
            const h = Math.min(100, Math.max(0, Number(item.heightPct) || 0));
            const val = item.valueText != null && item.valueText !== ""
                ? escapeHtml(item.valueText)
                : "";
            return `
    <div class="vbar-col">
      <div class="vbar-track"><div class="vbar-fill" style="height: ${h}%"></div></div>
      <span>${val}</span>
      <span class="vbar-label">${escapeHtml(item.label)}</span>
    </div>`;
        })
            .join("");
    }

    /** Half-doughnut token dial backed by Chart.js (`usageTotalGauge` + `attachUsageDialChart`). */
    const USAGE_TOTAL_SHOW_DIAL_CHART = true;
    function fmt(n) {
        if (n == null || Number.isNaN(n))
            return "—";
        return formatTokenCountFull(n);
    }
    /** Mount layout + lower sections from `overviewShellHtml` (ADR-005). */
    function mountDashboardShell() {
        const root = document.getElementById("dashboard-mount");
        if (!root)
            throw new Error("missing #dashboard-mount");
        root.innerHTML = overviewShellHtml({
            title: "Agent Profiler Dashboard",
            subtitle: "",
            sessionOptions: [],
            refreshLabel: "Refresh",
            refreshButtonId: "refresh-btn",
            refreshButtonAriaLabel: "Refresh dashboard",
            sessionSelectId: "session-select",
            subtitleElementId: "meta-line",
            useLiveOverviewSlots: true,
            options: {
                timelineView: {
                    metaElementId: "timeline-meta",
                    trackElementId: "timeline-track",
                },
                toolHistogramView: {
                    barsElementId: "tool-histogram",
                    parityLineElementId: "parity-line",
                    operationLineElementId: "operation-line",
                },
                contextAuditView: {
                    barsElementId: "context-bars",
                },
                redFlagsView: {
                    listElementId: "red-flags",
                },
                recommendationsView: {
                    listElementId: "recommendations",
                },
            },
        });
        attachResponsiveDashboardGrids(root);
    }
    function el(id) {
        const n = document.getElementById(id);
        if (!n)
            throw new Error(`missing #${id}`);
        return n;
    }
    function encodeQuery(obj) {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(obj)) {
            if (v !== undefined && v !== null && v !== "")
                p.set(k, String(v));
        }
        return p.toString();
    }
    function usageBreakdownRowsFromUsage(usage) {
        const toolOutput = usage.toolLifecycleOutputs ?? usage.toolResults;
        const max = Math.max(1, usage.input + usage.output + toolOutput + usage.shellOutput);
        return [
            {
                label: "Input",
                widthPct: (usage.input / max) * 100,
                tokens: usage.input,
                variant: "input",
            },
            {
                label: "Output",
                widthPct: (usage.output / max) * 100,
                tokens: usage.output,
                variant: "output",
            },
            {
                label: "Tool / MCP",
                widthPct: (toolOutput / max) * 100,
                tokens: toolOutput,
                variant: "tool",
            },
            {
                label: "Shell",
                widthPct: (usage.shellOutput / max) * 100,
                tokens: usage.shellOutput,
                variant: "shell",
            },
        ];
    }
    /** Observable overview card — mirrors Storybook overview shell markup */
    function setOverviewObservableCard(slot, totalTokens, usage) {
        if (!usage) {
            detachUsageDialChartsIn(slot);
            slot.innerHTML = dashboardCardHtml({
                title: "Observable usage",
                span: "2",
                bodyHtml: '<p class="muted small">No usage data.</p>',
            });
            return;
        }
        const t = totalTokens != null && !Number.isNaN(totalTokens)
            ? fmt(totalTokens)
            : fmt(usage.total);
        detachUsageDialChartsIn(slot);
        slot.innerHTML = observableUsageViewHtml({
            title: "Observable usage",
            span: "2",
            valueText: t,
            caption: "estimated total tokens",
            valueElementId: "total-tokens",
            showDialChart: USAGE_TOTAL_SHOW_DIAL_CHART,
            isAbbreviated: true,
            barsElementId: "usage-bars",
            barsHtml: usageBreakdownBarsInnerHtml({
                rows: usageBreakdownRowsFromUsage(usage),
                isAbbreviated: true,
            }),
        });
        {
            const canvas = slot.querySelector('canvas[data-gauge-dial="1"]');
            if (canvas instanceof HTMLCanvasElement) {
                attachUsageDialChart(canvas, defaultUsageDialSegmentsFromUsage(usage));
            }
        }
    }
    function setOverviewEfficiencyCard(slot, efficiencyScore, sparkPts) {
        const scoreText = efficiencyScore != null && !Number.isNaN(Number(efficiencyScore))
            ? String(efficiencyScore)
            : "—";
        slot.innerHTML = efficiencyViewHtml({
            title: "Efficiency",
            scoreText,
            sparklinePoints: sparkPts,
            svgId: "score-sparkline",
        });
    }
    function setVerticalBars(container, items) {
        if (!items.length) {
            container.textContent = "No data.";
            return;
        }
        const maxVal = Math.max(1, ...items.map((i) => i.value));
        container.innerHTML = verticalBarsInnerHtml(items.map((item) => ({
            label: item.label,
            heightPct: (item.value / maxVal) * 100,
            valueText: fmt(item.value),
        })));
    }
    function setTimelineTrack(container, timeline) {
        if (!timeline.length) {
            container.textContent = "No events.";
            return;
        }
        const segs = computeTimelineTrackSegments(timeline, fmt);
        container.innerHTML = timelineTrackInnerHtml(segs);
    }
    async function fetchJson(path) {
        const res = await fetch(path);
        if (!res.ok)
            throw new Error(`${path} ${res.status}`);
        return res.json();
    }
    mountDashboardShell();
    let selectedSessionKey = "";
    function sessionOptionKey(row) {
        return `${row.source}\t${row.sessionId}`;
    }
    async function loadSessions(selectEl, overviewDesc, preferredValue) {
        const data = (await fetchJson(`/api/sessions?limit=30`));
        const keep = preferredValue ?? selectEl.value;
        selectEl.replaceChildren();
        const optLatest = document.createElement("option");
        optLatest.value = "";
        optLatest.textContent = "Latest activity";
        selectEl.appendChild(optLatest);
        for (const row of data.sessions) {
            const opt = document.createElement("option");
            opt.value = sessionOptionKey(row);
            const shortId = row.sessionId.length > 12
                ? `${row.sessionId.slice(0, 12)}…`
                : row.sessionId;
            opt.textContent = `${row.source} · ${shortId} · ${row.eventCount} events`;
            selectEl.appendChild(opt);
        }
        if (keep && [...selectEl.options].some((o) => o.value === keep)) {
            selectEl.value = keep;
            selectedSessionKey = keep;
            return;
        }
        if (overviewDesc &&
            overviewDesc.sessionId &&
            overviewDesc.sessionId.trim().length > 0) {
            const key = sessionOptionKey({
                source: overviewDesc.source,
                sessionId: overviewDesc.sessionId,
                repoPath: overviewDesc.repoPath});
            if ([...selectEl.options].some((o) => o.value === key)) {
                selectEl.value = key;
                selectedSessionKey = key;
            }
        }
    }
    function parseSelectedSession(selectEl) {
        const v = selectEl.value;
        if (!v)
            return null;
        const [source, sessionId] = v.split("\t");
        return { source, sessionId };
    }
    async function refreshAll() {
        const metaLine = el("meta-line");
        const sessionSelect = el("session-select");
        try {
            const overview = (await fetchJson("/api/overview"));
            metaLine.textContent = overview.databasePath
                ? `Database: ${overview.databasePath}`
                : "";
            await loadSessions(sessionSelect, overview.descriptor ?? undefined, selectedSessionKey);
            const sel = parseSelectedSession(sessionSelect);
            let report = overview.report ?? undefined;
            let timelineQs;
            let histQs;
            if (sel) {
                const payload = (await fetchJson(`/api/session/report?${encodeQuery(sel)}`));
                report = payload.report ?? undefined;
                timelineQs = encodeQuery(sel);
                histQs = encodeQuery(sel);
            }
            else if (overview.descriptor) {
                const d = overview.descriptor;
                if (d.sessionId && d.sessionId.trim().length > 0) {
                    timelineQs = encodeQuery({ source: d.source, sessionId: d.sessionId });
                    histQs = timelineQs;
                }
                else {
                    timelineQs = encodeQuery({
                        source: d.source,
                        legacy: "1",
                        repoPath: d.repoPath ?? "",
                    });
                    histQs = timelineQs;
                }
            }
            setOverviewObservableCard(el("slot-overview-usage"), report?.usage?.total ?? null, report?.usage ?? null);
            const histData = timelineQs
                ? (await fetchJson(`/api/tool-histogram?${histQs}`))
                : { histogram: [] };
            setVerticalBars(el("tool-histogram"), (histData.histogram ?? []).map((h) => ({
                label: h.bucket,
                value: h.count,
            })));
            const parity = report?.parity?.lifecycle;
            el("parity-line").textContent = parity
                ? `Lifecycle parity: ${parity.toolRequests} requests, ${parity.toolSuccesses} successes, ${parity.toolFailures} failures`
                : "";
            const topOps = report?.parity?.operations?.slice(0, 3) ?? [];
            el("operation-line").textContent = topOps.length
                ? `Top operations: ${topOps.map((o) => `${o.name} ${fmt(o.tokens)}`).join(" · ")}`
                : "";
            const audit = (await fetchJson("/api/context-audit"));
            setVerticalBars(el("context-bars"), (audit.files ?? []).map((f) => ({
                label: f.path.replace(/^.*\//, ""),
                value: f.estimatedTokens,
            })));
            const timelineData = timelineQs
                ? (await fetchJson(`/api/session/timeline?${timelineQs}`))
                : { timeline: [] };
            el("timeline-meta").textContent =
                report != null
                    ? `${report.sessionShape.turns} turns · ${report.sessionShape.fileEdits} edits · ${report.sessionShape.shellCalls} shell · ${report.sessionShape.toolCalls} tool calls · ${report.durationMinutes} min`
                    : "";
            setTimelineTrack(el("timeline-track"), timelineData.timeline ?? []);
            const scores = (await fetchJson("/api/score-history?limit=15"));
            const sparkPts = sparklinePolylinePoints(scores.points ?? []) ?? "";
            setOverviewEfficiencyCard(el("slot-overview-efficiency"), report?.efficiencyScore, sparkPts);
            const flagsUl = el("red-flags");
            flagsUl.replaceChildren();
            if (report?.redFlags?.length) {
                for (const f of report.redFlags) {
                    const li = document.createElement("li");
                    const sev = document.createElement("span");
                    sev.className = `sev ${f.severity === "MEDIUM" ? "medium" : ""}`;
                    sev.textContent = f.severity;
                    li.append(sev, document.createTextNode(`${f.title}: ${f.detail}`));
                    flagsUl.appendChild(li);
                }
            }
            else {
                flagsUl.innerHTML = `<li class="muted">None</li>`;
            }
            const recOl = el("recommendations");
            recOl.replaceChildren();
            if (report?.recommendations?.length) {
                for (const r of report.recommendations) {
                    const li = document.createElement("li");
                    li.textContent = r;
                    recOl.appendChild(li);
                }
            }
        }
        catch (e) {
            const err = e;
            metaLine.textContent = String(err.message ?? e);
        }
    }
    el("refresh-btn").addEventListener("click", () => {
        void refreshAll();
    });
    el("session-select").addEventListener("change", () => {
        selectedSessionKey = el("session-select").value;
        void refreshAll();
    });
    void refreshAll();

})();
//# sourceMappingURL=app.iife.js.map
