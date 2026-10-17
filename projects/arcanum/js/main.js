/* ============================================================
   MAIN — bootstrap
   ============================================================ */

(function () {
  try {
    Game.init();
    var statusEl = document.getElementById('js-status');
    if (statusEl) statusEl.textContent = 'JS: игра запущена';
    setTimeout(function () {
      var s = document.getElementById('js-status');
      if (s) s.style.display = 'none';
    }, 3000);
  } catch (e) {
    var box = document.getElementById('err-box');
    if (box) {
      box.style.display = 'block';
      box.textContent = 'ОШИБКА ЗАПУСКА:\n' + e.message + '\n\n' + (e.stack || '(нет стека)');
    }
    var s2 = document.getElementById('js-status');
    if (s2) s2.textContent = 'JS: ошибка запуска';
  }
})();
