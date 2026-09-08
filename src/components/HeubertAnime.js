import { useEffect, useRef, useState } from "react";

const FRAME_COUNT = 100;
const framePath = (i) => `/heubert-anime/frame-${String(i).padStart(3, "0")}.jpg`;

// Most of the app scrolls via `window`, but if some ancestor turns out to be
// its own overflow:auto/scroll box, that's the element actually moving —
// and its "scroll" events never bubble to window, so we have to find it.
const getScrollParent = (el) => {
  let node = el?.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null; // null means window/document is the real scroller
};

export default function HeubertAnime() {
  const sectionRef = useRef(null);
  const canvasRef = useRef(null);
  const imagesRef = useRef([]);
  const currentFrameRef = useRef(-1);
  const rafRef = useRef(null);
  const stuckRef = useRef(false);
  const scrollParentRef = useRef(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState({ index: -1, scrollY: 0, stuck: false });

  const drawFrame = (index) => {
    const canvas = canvasRef.current;
    const img = imagesRef.current[index];
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Cover-fit the frame into the canvas, cropping whichever axis overflows
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = cw / ch;
    let sx, sy, sw, sh;
    if (imgRatio > canvasRatio) {
      sh = img.naturalHeight;
      sw = sh * canvasRatio;
      sy = 0;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sw = img.naturalWidth;
      sh = sw / canvasRatio;
      sx = 0;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
  };

  // Preload every frame up front so scrubbing never shows a blank canvas
  useEffect(() => {
    let cancelled = false;
    let loaded = 0;
    const imgs = [];
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new window.Image();
      const markLoaded = () => {
        loaded++;
        if (cancelled) return;
        setLoadedCount(loaded);
        if (loaded === FRAME_COUNT) setReady(true);
      };
      img.onload = markLoaded;
      img.onerror = markLoaded;
      img.src = framePath(i);
      imgs.push(img);
    }
    imagesRef.current = imgs;
    return () => {
      cancelled = true;
    };
  }, []);

  // Map scroll position within the (tall) section to a frame index
  useEffect(() => {
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const section = sectionRef.current;
        if (!section) return;

        const rect = section.getBoundingClientRect();
        const scrollableDistance = rect.height - window.innerHeight;
        let progress = scrollableDistance > 0 ? -rect.top / scrollableDistance : 0;
        progress = Math.min(1, Math.max(0, progress));

        const index = Math.min(FRAME_COUNT - 1, Math.round(progress * (FRAME_COUNT - 1)));
        if (index !== currentFrameRef.current) {
          currentFrameRef.current = index;
          drawFrame(index);
        }

        // Pinned = the sticky panel is actively covering the viewport, i.e. the
        // section a keyboard user is "inside" for the purposes of frame stepping
        stuckRef.current = scrollableDistance > 0 && rect.top <= 0 && rect.bottom >= window.innerHeight;
        setDebugInfo({ index, scrollY: Math.round(window.scrollY), stuck: stuckRef.current });
      });
    };

    scrollParentRef.current = getScrollParent(sectionRef.current);

    // Listen in the CAPTURE phase: "scroll" events fired by an inner
    // overflow:auto ancestor don't bubble, but capture still sees them on
    // the way down — so this catches the real scroller whichever it is,
    // without having to trust the ancestor-walk alone.
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Keyboard-only users (no mouse/trackpad) get exact per-frame stepping with
  // Arrow Up/Down while the sticky panel is pinned — native Page Down/Space still
  // jump almost a full screen at once, which reads as "not frame by frame".
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!stuckRef.current) return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

      const section = sectionRef.current;
      if (!section) return;
      const scrollableDistance = section.getBoundingClientRect().height - window.innerHeight;
      if (scrollableDistance <= 0) return;

      e.preventDefault();
      const frameStep = scrollableDistance / (FRAME_COUNT - 1);
      const delta = e.key === "ArrowDown" ? frameStep : -frameStep;
      const sp = scrollParentRef.current;
      if (sp) {
        sp.scrollBy({ top: delta, left: 0, behavior: "instant" });
      } else {
        window.scrollBy({ top: delta, left: 0, behavior: "instant" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Once frames finish loading, repaint whichever frame scroll position already landed on
  useEffect(() => {
    if (ready) drawFrame(Math.max(0, currentFrameRef.current));
  }, [ready]);

  const loadPercent = Math.round((loadedCount / FRAME_COUNT) * 100);

  return (
    <section className="heubert-anime-section" ref={sectionRef}>
      <div className="heubert-anime-sticky">
        <div className="heubert-anime-heading">
          <h2>🎬 Heubert Anime</h2>
          <p>Keep scrolling — the story plays frame by frame. (No mouse? Use ↑ / ↓.)</p>
        </div>
        <canvas ref={canvasRef} className="heubert-anime-canvas" />
        {!ready && (
          <div className="heubert-anime-loader">
            <div className="spinner" />
            <span>{loadPercent}%</span>
          </div>
        )}
        {/* TEMP DEBUG */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            zIndex: 5,
            background: "rgba(0,0,0,0.75)",
            color: "#fff",
            fontSize: "13px",
            fontFamily: "monospace",
            padding: "6px 10px",
            borderRadius: "6px",
            pointerEvents: "none",
          }}
        >
          frame {debugInfo.index + 1}/{FRAME_COUNT} · scrollY {debugInfo.scrollY} · stuck {String(debugInfo.stuck)} · loaded {loadPercent}%
        </div>
      </div>
    </section>
  );
}
