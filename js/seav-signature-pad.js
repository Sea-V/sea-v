// /js/seav-signature-pad.js — reusable canvas signature pad (pointer events)
(function () {
  "use strict";

  const DEFAULT_BACKGROUND = "#ffffff";

  function getPointerPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return { x: 0, y: 0 };
    }

    // Return CSS pixel coordinates — ctx.setTransform(devicePixelRatio) handles sharpness.
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    return {
      x: Math.max(0, Math.min(rect.width, x)),
      y: Math.max(0, Math.min(rect.height, y))
    };
  }

  function canvasHasInk(ctx, width, height, backgroundColor) {
    if (!width || !height) return false;

    const sample = ctx.getImageData(0, 0, width, height).data;
    const bg = parseBackgroundColor(backgroundColor);
    const threshold = 28;

    for (let i = 0; i < sample.length; i += 16) {
      const r = sample[i];
      const g = sample[i + 1];
      const b = sample[i + 2];
      const a = sample[i + 3];

      if (a < 8) continue;

      if (
        Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b) >
        threshold
      ) {
        return true;
      }
    }

    return false;
  }

  function parseBackgroundColor(color) {
    const value = String(color || DEFAULT_BACKGROUND).trim();

    if (value.startsWith("#")) {
      const hex = value.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16)
        };
      }
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }

    return { r: 255, g: 255, b: 255 };
  }

  function mount(container, options = {}) {
    if (!container) throw new Error("Signature pad container required");

    const penColor = options.penColor || "#0b121c";
    const penWidth = options.penWidth || 2.6;
    const background = options.background || DEFAULT_BACKGROUND;
    const height = options.height || 168;

    container.innerHTML = "";
    container.classList.add("seav-signature-pad");

    const surface = document.createElement("div");
    surface.className = "seav-signature-pad-surface";
    surface.style.height = `${height}px`;

    const canvas = document.createElement("canvas");
    canvas.className = "seav-signature-pad-canvas";
    canvas.setAttribute("aria-label", options.ariaLabel || "Draw your signature");

    surface.appendChild(canvas);

    const actions = document.createElement("div");
    actions.className = "seav-signature-pad-actions";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn-ghost2 seav-signature-pad-clear";
    clearBtn.textContent = options.clearLabel || "Clear signature";

    actions.appendChild(clearBtn);
    container.appendChild(surface);
    container.appendChild(actions);

    const ctx = canvas.getContext("2d");
    let drawing = false;
    let activePointerId = null;
    let hasStroke = false;
    let resizeObserver = null;
    let lastCanvasWidth = 0;
    let resizeFrame = 0;

    let pixelRatio = 1;

    function applyBrushSettings() {
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    function paintBackground() {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      applyBrushSettings();
    }

    function resizeCanvas() {
      const displayWidth = Math.max(Math.floor(surface.clientWidth), 1);
      const displayHeight = height;
      if (displayWidth <= 1) return;
      if (displayWidth === lastCanvasWidth && canvas.width > 0) return;

      const snapshot = hasStroke || canvasHasInk(ctx, canvas.width, canvas.height, background)
        ? canvas.toDataURL("image/png")
        : null;

      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      lastCanvasWidth = displayWidth;
      canvas.width = Math.floor(displayWidth * pixelRatio);
      canvas.height = Math.floor(displayHeight * pixelRatio);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      paintBackground();

      if (snapshot) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
          applyBrushSettings();
          hasStroke = canvasHasInk(ctx, canvas.width, canvas.height, background);
        };
        img.src = snapshot;
      }
    }

    function scheduleResize() {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        resizeCanvas();
      });
    }

    function startStroke(point) {
      drawing = true;
      applyBrushSettings();
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineTo(point.x + 0.01, point.y + 0.01);
      ctx.stroke();
      hasStroke = true;
    }

    function extendStroke(point) {
      if (!drawing) return;
      hasStroke = true;
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    function endStroke(event) {
      if (
        event?.pointerId != null &&
        activePointerId != null &&
        event.pointerId !== activePointerId
      ) {
        return;
      }

      if (event?.pointerId != null && canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      drawing = false;
      activePointerId = null;
      hasStroke = canvasHasInk(ctx, canvas.width, canvas.height, background);
    }

    function clearCanvas() {
      hasStroke = false;
      paintBackground();
    }

    function onPointerDown(event) {
      if (drawing && activePointerId != null && event.pointerId !== activePointerId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      activePointerId = event.pointerId;
      canvas.setPointerCapture?.(event.pointerId);
      startStroke(getPointerPoint(canvas, event));
    }

    function onPointerMove(event) {
      if (!drawing || event.pointerId !== activePointerId) return;
      event.preventDefault();
      extendStroke(getPointerPoint(canvas, event));
    }

    clearBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearCanvas();
    });

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endStroke);
    canvas.addEventListener("pointercancel", endStroke);
    canvas.addEventListener("lostpointercapture", endStroke);

    scheduleResize();

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => scheduleResize());
      resizeObserver.observe(surface);
    } else {
      window.addEventListener("resize", scheduleResize);
    }

    return {
      canvas,
      isEmpty() {
        if (hasStroke) return false;
        return !canvasHasInk(ctx, canvas.width, canvas.height, background);
      },
      clear() {
        clearCanvas();
      },
      toBlob(type = "image/png", quality) {
        return new Promise((resolve) => {
          if (this.isEmpty()) {
            resolve(null);
            return;
          }
          canvas.toBlob((blob) => resolve(blob), type, quality);
        });
      },
      toDataUrl(type = "image/png") {
        if (this.isEmpty()) return "";
        return canvas.toDataURL(type);
      },
      refreshLayout() {
        scheduleResize();
      },
      destroy() {
        if (resizeFrame) cancelAnimationFrame(resizeFrame);
        resizeObserver?.disconnect();
        window.removeEventListener("resize", scheduleResize);
        canvas.replaceWith(canvas.cloneNode(false));
        container.innerHTML = "";
        container.classList.remove("seav-signature-pad");
      }
    };
  }

  window.SeavSignaturePad = { mount };
})();
