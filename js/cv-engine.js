// /js/cv-engine.js — public CV engine facade
(function () {
  "use strict";
  const M = window.SeavCvModel;
  const R = window.SeavCvRender;
  if (!M || !R) return;

  window.SeavCvEngine = {
    ...M,
    renderCvHtml: R.renderCvHtml,
    renderSeav: R.renderSeav
  };

  window.SeavCv = window.SeavCvEngine;
})();
