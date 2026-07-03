// /js/seav-signature-pad.js — reusable canvas signature pad (pointer events)
(function () {
  "use strict";

  const DEFAULT_BACKGROUND = "#0b121c";

  function getPointerPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
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

    return { r: 11, g: 18, b: 28 };
  }

  function mount(container, options = {}) {
    if (!container) throw new Error("Signature pad container required");

    const penColor = options.penColor || "#ffffff";
    const penWidth = options.penWidth || 2.6;
    const background = options.background || DEFAULT_BACKGROUND;
    const height = options.height || 168;

    container.innerHTML = "";
    container.classList.add("seav-signature-pad");

    const canvas = document.createElement("canvas");
    canvas.className = "seav-signature-pad-canvas";
    canvas.setAttribute("aria-label", options.ariaLabel || "Draw your signature");

    const actions = document.createElement("div");
    actions.className = "seav-signature-pad-actions";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn-ghost2 seav-signature-pad-clear";
    clearBtn.textContent = options.clearLabel || "Clear signature";

    actions.appendChild(clearBtn);
    container.appendChild(canvas);
    container.appendChild(actions);

    const ctx = canvas.getContext("2d");
    let drawing = false;
    let activePointerId = null;
    let hasStroke = false;
    let resizeObserver = null;
    let lastCanvasWidth = 0;
    let resizeFrame = 0;

    function applyBrushSettings() {
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }

    function paintBackground() {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      applyBrushSettings();
    }

    function resizeCanvas() {
      const width = Math.max(Math.floor(container.clientWidth), 280);
      if (width === lastCanvasWidth && canvas.width > 0) return;

      const snapshot = hasStroke || canvasHasInk(ctx, canvas.width, canvas.height, background)
        ? canvas.toDataURL("image/png")
        : null;

      lastCanvasWidth = width;
      canvas.width = width;
      canvas.height = height;
      paintBackground();

      if (snapshot) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
      resizeObserver.observe(container);
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
