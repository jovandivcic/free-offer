/* =========================================================
   Jovan Divčić — portfolio landing
   1. Recent work: pinned section, page scroll moves the cards sideways
   2. About: pinned, scroll-driven paragraph reel with flying props
      (same mechanism as atulkhola.com "about": sticky pin, the column
      moves at a geared ratio of the scroll, the live paragraph sits at
      the vertical centre, the others dim/blur, props fly in per paragraph)
   ========================================================= */
(function () {
  'use strict';

  var qs = new URLSearchParams(location.search);
  if (qs.has('only')) document.documentElement.setAttribute('data-only', qs.get('only'));

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };          // smoothstep
  var smoother = function (t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }; // smootherstep

  /* ---------------------------------------------------------
     1. RECENT WORK — pinned, scroll-driven horizontal track
        The section is (viewport + travel) tall and its inner block is sticky.
        Scrolling the page moves the cards sideways 1:1, wherever the pointer is;
        when the last cards reach their end position the page continues down.
     --------------------------------------------------------- */
  (function workPin() {
    var section = document.getElementById('work');
    var pin = section && section.querySelector('.work__pin');
    var stage = pin && pin.querySelector('.work__stage');
    var track = document.getElementById('workTrack');
    if (!section || !pin || !stage || !track) return;

    var desktop = window.matchMedia('(min-width: 1101px)');
    var root = document.documentElement;
    var top = 0, travel = 0, vh = 0, cw = 0, ws = 1, lastX = null;
    // preview helper for QA screenshots: ?wp=<0…1> freezes the track at that progress
    var forced = qs.has('wp') ? clamp(parseFloat(qs.get('wp')) || 0, 0, 1) : null;

    function setScale(s) {
      section.style.setProperty('--ws', s.toFixed(4));
      section.style.setProperty('--vw', (cw / s).toFixed(2) + 'px');   // stage width in stage units
    }
    function measure() {
      vh = window.innerHeight;
      cw = root.clientWidth;                                 // viewport width without the scrollbar
      pin.style.height = vh + 'px';

      // Fit: the stage is centred in the pin. Desktop = the 895px Figma block, whose heading
      // (y 88) and cards (y 165–765) stay inside the viewport down to ~784px of height;
      // tablet/phone = the natural height of heading + cards. Below that, scale it down.
      setScale(1);
      // (the heading's line-height is .8, so its glyphs overhang the line box by ~19px)
      var needed = desktop.matches ? 784 : stage.offsetHeight + 48;
      ws = Math.min(1, Math.max(0.5, vh / needed));
      if (ws < 1) setScale(ws);

      travel = Math.max(0, Math.ceil((track.offsetWidth - cw / ws) * ws));   // in page px (1:1 on screen)
      section.style.height = (vh + travel) + 'px';
      top = section.getBoundingClientRect().top + (window.pageYOffset || root.scrollTop);
      lastX = null;
      window.dispatchEvent(new Event('jw:layout'));          // sections below re-measure their offsets
    }
    function render() {
      var y = window.pageYOffset || root.scrollTop;
      var into = forced !== null ? forced * travel : y - top;
      var x = -clamp(into, 0, travel) / ws;                  // stage units
      if (x === lastX) return;
      lastX = x;
      track.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
    }

    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; render(); }); }
    }, { passive: true });

    // Keyboard / assistive focus on a card that is off-screen: bring it on screen by
    // scrolling the page to the matching position (the pin itself never scrolls).
    track.addEventListener('focusin', function (e) {
      var card = e.target.closest ? e.target.closest('.card') : null;
      if (!card) return;
      // one frame later, so it runs after the browser's own scroll-to-focus
      requestAnimationFrame(function () {
        pin.scrollLeft = 0; pin.scrollTop = 0;
        var r = card.getBoundingClientRect();
        if (r.left >= 0 && r.right <= cw) return;            // already fully on screen
        var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
        var into = clamp((card.offsetLeft - pad) * ws, 0, travel);
        root.style.scrollBehavior = 'auto';
        window.scrollTo(0, top + into);
        root.style.scrollBehavior = '';
        render();
      });
    });

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { measure(); render(); }, 80);
    });

    function boot() { measure(); render(); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
    boot();
    window.addEventListener('load', boot);
  })();

  /* ---------------------------------------------------------
     2. ABOUT — pinned paragraph reel
     --------------------------------------------------------- */
  (function aboutReel() {
    var section = document.getElementById('about');
    var pin = section && section.querySelector('.about__pin');
    var col = document.getElementById('aboutCol');
    var stage = document.getElementById('aboutStage');
    if (!section || !pin || !col || !stage) return;

    var P = {
      paraVh: 0.8,        // scroll travel per paragraph, in viewport heights
      dim: 0.2,           // opacity of non-live paragraphs (Figma: 20 %)
      blur: 2.5,          // px — paragraphs two steps away (Figma: 2.5px)
      farScale: 0.75,     // paragraphs two steps away shrink 32 → 24px (Figma)
      gear: 0.65,         // 0 = linear scrub, 1 = hard steps between paragraphs
      snapDelay: 160,     // ms of scroll silence before snapping to a paragraph
      snapDur: 550,       // ms
      propOff: 80,        // px beyond the design edge where props start
      propTilt: 12,       // deg of tilt while a prop flies in
      designW: 1440,
      designH: 900
    };

    var paras = Array.prototype.map.call(col.querySelectorAll('.about__p'), function (el) {
      return { el: el, centre: 0, o: -1, blur: -1, scale: -1 };
    });
    var n = paras.length;

    var props = Array.prototype.map.call(stage.querySelectorAll('.prop'), function (el) {
      var w = parseFloat(el.style.width) || el.width || 282;
      return {
        el: el,
        para: parseInt(el.getAttribute('data-para'), 10),
        x: parseFloat(el.getAttribute('data-x')),
        y: parseFloat(el.getAttribute('data-y')),
        w: w,
        h: parseFloat(el.getAttribute('data-h')) || w * 216 / 282,
        side: el.classList.contains('prop--right') ? 'right' : 'left',
        k: -1,
        curW: w
      };
    });

    var vh = 0, vw = 0, top = 0, step = 0, travel = 0, stageScale = 1, mobile = false;
    var u = 0;                 // eased position in paragraph units (0 … n-1)
    var activeIdx = -1;

    function measure() {
      vh = window.innerHeight;
      step = P.paraVh * vh;
      travel = (n - 1) * step;
      section.style.height = (vh + travel) + 'px';
      pin.style.height = vh + 'px';

      // props stage: design space 1440×900 scaled to the viewport; on phones the
      // stage is the viewport itself and props get corner poses (see poseOf)
      vw = window.innerWidth;
      mobile = vw < 700;
      if (mobile) {
        stageScale = 1;
        stage.style.width = vw + 'px';
        stage.style.height = vh + 'px';
      } else {
        stageScale = Math.min(1, vw / P.designW, vh / P.designH);
        stage.style.width = '';
        stage.style.height = '';
      }
      pin.style.setProperty('--stage-scale', stageScale.toFixed(4)); // stage + column type inherit it
      props.forEach(function (pr) {
        var pose = poseOf(pr);
        if (pose.w !== pr.curW) { pr.curW = pose.w; pr.el.style.width = pose.w + 'px'; }
        pr.k = -1; // force re-render of transforms
      });

      var rect = section.getBoundingClientRect();
      top = rect.top + (window.pageYOffset || document.documentElement.scrollTop);

      // paragraph centres relative to column top
      paras.forEach(function (p) {
        var y = 0, el = p.el;
        while (el && el !== col) { y += el.offsetTop; el = el.offsetParent; }
        p.centre = y + p.el.offsetHeight / 2;
      });
    }

    // final (settled) pose of a prop: Figma position on desktop, corners on phones
    function poseOf(pr) {
      if (!mobile) return { x: pr.x, y: pr.y, w: pr.w };
      var w = Math.round(Math.min(pr.w * 0.5, vw * 0.36));
      var h = w * pr.h / pr.w;
      return pr.side === 'left'
        ? { x: 16, y: 16, w: w }
        : { x: vw - 16 - w, y: vh - 16 - h, w: w };
    }

    // scroll progress (0…1) → eased paragraph position (0 … n-1)
    function eased(progress) {
      var g = clamp(progress, 0, 1) * (n - 1);
      if (n < 2) return 0;
      var i = Math.min(n - 2, Math.floor(g));
      var f = g - i;
      var gear = reduced ? 0 : P.gear;
      return i + (1 - gear) * f + gear * smoother(f);
    }
    function centreAt(pos) {
      var i = clamp(Math.floor(pos), 0, n - 1), j = Math.min(n - 1, i + 1);
      return paras[i].centre + (paras[j].centre - paras[i].centre) * (pos - i);
    }

    var forcedU = null; // debug: ?u=<paragraph position> freezes the reel at that position
    function render() {
      var scrollY = window.pageYOffset || document.documentElement.scrollTop;
      var into = forcedU !== null ? forcedU * step : scrollY - top;
      var progress = travel > 0 ? into / travel : 0;
      u = eased(progress);

      // column: live paragraph centre sits at vh/2
      col.style.transform = 'translate3d(0,' + (vh / 2 - centreAt(u)).toFixed(2) + 'px,0)';

      // paragraphs: opacity / blur / scale by distance from the live one
      for (var i = 0; i < n; i++) {
        var p = paras[i];
        var d = Math.abs(u - i);
        var live = smooth(1 - d);                     // 1 at d=0 → 0 at d>=1
        var far = clamp(d - 1, 0, 1);                 // 0 at d<=1 → 1 at d>=2
        var o = P.dim + (1 - P.dim) * live;
        if (mobile) o = o * (1 - far);                // phones: lines two steps away fade out fully (props live there)
        var b = reduced ? 0 : P.blur * far;
        var s = 1 - (1 - P.farScale) * far;
        if (Math.abs(o - p.o) > 0.002) { p.o = o; p.el.style.opacity = o.toFixed(3); }
        if (Math.abs(b - p.blur) > 0.02) { p.blur = b; p.el.style.filter = b > 0.05 ? 'blur(' + b.toFixed(2) + 'px)' : ''; }
        if (Math.abs(s - p.scale) > 0.002) { p.scale = s; p.el.style.transform = 'scale(' + s.toFixed(4) + ')'; }
      }

      // props: presence k per paragraph, fly in from the side
      for (var j = 0; j < props.length; j++) {
        var pr = props[j];
        var k = smooth(1 - Math.abs(u - pr.para));
        if (Math.abs(k - pr.k) < 0.002) continue;
        pr.k = k;
        var pose = poseOf(pr);
        var stageW = mobile ? vw : P.designW;
        var offX = pr.side === 'left' ? -(pose.w + P.propOff) : (stageW + P.propOff);
        var offRot = pr.side === 'left' ? -P.propTilt : P.propTilt;
        var x = offX + (pose.x - offX) * k;
        var rot = offRot * (1 - k);
        pr.el.style.opacity = k > 0.001 ? '1' : '0';
        pr.el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + pose.y.toFixed(2) + 'px,0) rotate(' + rot.toFixed(2) + 'deg)';
      }

      var idx = clamp(Math.round(u), 0, n - 1);
      if (idx !== activeIdx) {
        activeIdx = idx;
        for (var a = 0; a < n; a++) paras[a].el.classList.toggle('is-live', a === idx);
      }
    }

    // ---- snap to the nearest paragraph once the user stops scrolling ----
    var snapTimer = 0, snapping = false, snapRaf = 0, lastY = -1;
    function cancelSnap() { snapping = false; if (snapRaf) cancelAnimationFrame(snapRaf); snapRaf = 0; document.documentElement.style.scrollBehavior = ''; }
    function snap() {
      if (reduced) return;
      var scrollY = window.pageYOffset || document.documentElement.scrollTop;
      var into = scrollY - top;
      if (into < -2 || into > travel + 2) return;            // not inside the pin
      var target = top + Math.round(into / step) * step;
      if (Math.abs(target - scrollY) < 2) return;
      var from = scrollY, t0 = performance.now();
      var root = document.documentElement;
      snapping = true;
      root.style.scrollBehavior = 'auto';                    // bypass CSS smooth scrolling while we drive it
      (function frame(now) {
        if (!snapping) { root.style.scrollBehavior = ''; return; }
        var t = clamp((now - t0) / P.snapDur, 0, 1);
        var e = 1 - Math.pow(1 - t, 3);                      // easeOutCubic
        var y = from + (target - from) * e;
        lastY = Math.round(y);
        window.scrollTo(0, y);
        if (t < 1) { snapRaf = requestAnimationFrame(frame); }
        else { snapping = false; root.style.scrollBehavior = ''; }
      })(t0);
    }

    var ticking = false;
    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      if (snapping && Math.abs(y - lastY) > 1) cancelSnap();   // user interrupted the snap
      if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; render(); }); }
      if (!snapping) { clearTimeout(snapTimer); snapTimer = setTimeout(snap, P.snapDelay); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', function () { if (snapping) cancelSnap(); }, { passive: true });
    window.addEventListener('touchstart', function () { if (snapping) cancelSnap(); }, { passive: true });

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { measure(); render(); }, 80);
    });

    function boot() { measure(); render(); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot);
    boot();
    window.addEventListener('load', boot);
    window.addEventListener('jw:layout', boot);            // the work section above changed height

    // preview helpers for QA screenshots: ?only=about&u=<paragraph position 0…4>
    var q = new URLSearchParams(location.search);
    if (q.has('u')) { forcedU = parseFloat(q.get('u')) || 0; render(); }
  })();
})();
