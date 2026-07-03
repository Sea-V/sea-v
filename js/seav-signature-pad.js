// /js/seav-signature-pad.js — reusable canvas signature pad (touch + mouse)
(function () {
  "use strict";

  function getPoint(canvas, event, previousTouch) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (event.touches?.length) {
      const touch = event.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    }

    if (previousTouch && event.changedTouches?.length) {
      const touch = event.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    }

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function mount(container, options = {}) {
    if (!container) throw new Error("Signature pad container required");

    const penColor = options.penColor || "#ffffff";
    const penWidth = options.penWidth || 2.4;
    const background = options.background || "transparent";
    const height = options.height || 160;

    container.innerHTML = "";
    container.classList.add("seav-signature-pad");

    const canvas = document.createElement("canvas");
    canvas.className = "seav-signature-pad-canvas";
    canvas.setAttribute("aria-label", options.ariaLabel || "Draw your signature");
    canvas.height = height;

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
    let hasStroke = false;
    let resizeObserver = null;

    function resizeCanvas() {
      const width = Math.max(container.clientWidth, 280);
      const image = hasStroke ? canvas.toDataURL("image/png") : null;
      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (image) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = image;
      }
    }

    function startStroke(point) {
      drawing = true;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }

    function extendStroke(point) {
      if (!drawing) return;
      hasStroke = true;
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    function endStroke() {
      drawing = false;
    }

    function onPointerDown(event) {
      event.preventDefault();
      startStroke(getPoint(canvas, event));
    }

    function onPointerMove(event) {
      if (!drawing) return;
      event.preventDefault();
      extendStroke(getPoint(canvas, event));
    }

    canvas.addEventListener("mousedown", onPointerDown);
    canvas.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", endStroke);

    canvas.addEventListener("touchstart", onPointerDown, { passive: false });
    canvas.addEventListener("touchmove", onPointerMove, { passive: false });
    canvas.addEventListener("touchend", (event) => {
      if (drawing) {
        extendStroke(getPoint(canvas, event, true));
      }
      endStroke();
    });

    clearBtn.addEventListener("click", () => {
      hasStroke = false;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = penColor;
    });

    resizeCanvas();

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => resizeCanvas());
      resizeObserver.observe(container);
    } else {
      window.addEventListener("resize", resizeCanvas);
    }

    return {
      canvas,
      isEmpty() {
        return !hasStroke;
      },
      clear() {
        clearBtn.click();
      },
      toBlob(type = "image/png", quality) {
        return new Promise((resolve) => {
          if (!hasStroke) {
            resolve(null);
            return;
          }
          canvas.toBlob((blob) => resolve(blob), type, quality);
        });
      },
      toDataUrl(type = "image/png") {
        if (!hasStroke) return "";
        return canvas.toDataURL(type);
      },
      destroy() {
        resizeObserver?.disconnect();
        window.removeEventListener("mouseup", endStroke);
        window.removeEventListener("resize", resizeCanvas);
        container.innerHTML = "";
        container.classList.remove("seav-signature-pad");
      }
    };
  }

  window.SeavSignaturePad = { mount };
})();
