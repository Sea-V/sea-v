/* =========================================================
   SEA-V — row action menu (v588)

   One "Actions" button per table row instead of a pile of buttons.
   Markup, per row:

     <button type="button" class="seav-row-menu-btn" data-row-menu
             aria-haspopup="menu" aria-expanded="false">Actions</button>
     <template class="seav-row-menu-items">
       <button type="button" class="seav-row-menu-item" data-edit-x-id="…">Edit</button>
       …
     </template>

   The items are copied into ONE shared panel on <body>, placed with
   position: fixed. A panel inside the row would be clipped by the table's
   overflow wrapper. Each item keeps the data-* attributes the page already
   listens for (document-level click handlers), so a page only changes its
   markup and none of its handlers.
========================================================= */
(function () {
  let panel = null;
  let trigger = null;

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.className = "seav-row-menu";
    panel.setAttribute("role", "menu");
    panel.hidden = true;
    document.body.appendChild(panel);
    panel.addEventListener("keydown", onPanelKey);
    return panel;
  }

  function items() {
    return panel ? [...panel.querySelectorAll(".seav-row-menu-item")] : [];
  }

  function close(returnFocus) {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    panel.innerHTML = "";
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
      if (returnFocus) trigger.focus();
    }
    trigger = null;
  }

  function place(btn) {
    const r = btn.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const gap = 6;
    let left = r.right - w;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + gap;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - gap);
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  function open(btn, viaKeyboard) {
    const source = btn.parentElement?.querySelector("template.seav-row-menu-items");
    if (!source) return;
    ensurePanel();
    if (trigger && trigger !== btn) trigger.setAttribute("aria-expanded", "false");
    panel.innerHTML = source.innerHTML;
    items().forEach((el) => {
      el.setAttribute("role", "menuitem");
      el.tabIndex = -1;
    });
    if (btn.id) panel.setAttribute("aria-labelledby", btn.id);
    panel.hidden = false;
    trigger = btn;
    btn.setAttribute("aria-expanded", "true");
    place(btn);
    if (viaKeyboard) items()[0]?.focus();
  }

  function onPanelKey(e) {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-row-menu]");
    if (btn) {
      e.preventDefault();
      if (trigger === btn && panel && !panel.hidden) close(false);
      else open(btn, e.detail === 0);
      return;
    }
    // A chosen item runs the page's own handler (it bubbles to document
    // first, as this listener is added later); close once it has.
    if (panel && !panel.hidden) setTimeout(() => close(false), 0);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel && !panel.hidden) close(true);
  });
  window.addEventListener("resize", () => close(false));
  window.addEventListener("scroll", () => close(false), true);

  window.SeavRowMenu = { close };
})();
