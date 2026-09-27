/* 見た目の切り替え（暗め／クリーン）。選んだ見た目はこの端末に記憶する。計算には関係しない */
(function () {
  var KEY = 'strings-look';
  var look = 'clean';
  try { look = localStorage.getItem(KEY) || 'clean'; } catch (e) {}
  document.documentElement.setAttribute('data-look', look);

  function build() {
    if (document.getElementById('lookSwitch')) return;
    var wrap = document.createElement('div');
    wrap.id = 'lookSwitch';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', '画面の見た目');
    [['dark', '暗め'], ['clean', 'クリーン']].forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = o[1]; b.dataset.look = o[0];
      b.addEventListener('click', function () { set(o[0]); });
      wrap.appendChild(b);
    });
    document.body.appendChild(wrap);
    sync();
  }
  function sync() {
    var cur = document.documentElement.getAttribute('data-look');
    document.querySelectorAll('#lookSwitch button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.look === cur ? 'true' : 'false');
    });
  }
  function set(v) {
    document.documentElement.setAttribute('data-look', v);
    try { localStorage.setItem(KEY, v); } catch (e) {}
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
