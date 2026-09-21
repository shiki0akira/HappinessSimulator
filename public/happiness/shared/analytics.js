// GA4。跟 Web100 系列（首頁與其他專案）共用同一個資源 G-S7PE5687BG，
// 自訂事件一律加 happy_ 前綴——沒有前綴就分不出是哪個專案的。
//
// 漏斗：
//   happy_room_created   主持人大螢幕拿到一個新房號        （大螢幕送）
//   happy_player_joined  一個組員輸入名字進場              （那支手機送）
//   happy_game_started   大螢幕從入場頁翻到第一個流程頁    （大螢幕送）
//   happy_level_finished 大螢幕翻到這一關的最後一頁        （大螢幕送）
// 每個事件都帶 week（第幾關）。**只在做那個動作的那台裝置送**：狀態是廣播給全場的，
// 照著狀態送的話，一場十個人會把同一件事記十次。
(function () {
  'use strict';

  var ID = 'G-S7PE5687BG';
  // 只在正式網域送。本機 wrangler dev、區網、直接開 workers.dev 的測試不要混進報表。
  var ON = /(^|\.)vibeweb100\.com$/.test(location.hostname);
  var PENDING = 'happy-ga-pending';

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function send(name, params) {
    if (ON) gtag('event', name, params || {});
  }

  if (ON) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', ID, { send_page_view: false });
    // page_view 手動送，網址上的 ?room=XXXX 拿掉——不然每一間房在報表裡都是一個不同的網頁。
    send('page_view', { page_location: location.origin + location.pathname, page_title: document.title });

    // 上一頁留下來、還沒送出去的事件（見 later）
    try {
      var q = JSON.parse(sessionStorage.getItem(PENDING) || '[]');
      sessionStorage.removeItem(PENDING);
      q.forEach(function (e) { send(e[0], e[1]); });
    } catch (e) {}
  }

  function room() {
    return (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  }

  // 同一間房、同一個動作只記一次：主持人重整頁面、從後面翻回入場頁再翻過去都不會重複。
  function first(key) {
    try {
      var k = 'happy-ga:' + room() + ':' + key;
      if (sessionStorage.getItem(k)) return false;
      sessionStorage.setItem(k, '1');
    } catch (e) {}
    return true;
  }

  window.HappyGA = {
    event: function (name, params) { send('happy_' + name, params); },

    // 送出之後頁面馬上就要換掉的時候用（拿到房號就 location.replace 的那幾關）：
    // 那一刻 gtag.js 多半還沒載完，直接送會跟著頁面一起消失，所以先存起來，下一頁載入時補送。
    later: function (name, params) {
      if (!ON) return;
      try {
        var q = JSON.parse(sessionStorage.getItem(PENDING) || '[]');
        q.push(['happy_' + name, params || {}]);
        sessionStorage.setItem(PENDING, JSON.stringify(q));
      } catch (e) {}
    },

    joined: function (week) {
      if (first('w' + week + ':join')) send('happy_player_joined', { week: week });
    },

    // 大螢幕每次畫面更新都呼叫，自己判斷是不是「剛開始」或「走到最後一頁」。
    phase: function (week, idx, total) {
      if (idx >= 1 && first('w' + week + ':start')) send('happy_game_started', { week: week });
      if (total > 1 && idx === total - 1 && first('w' + week + ':end')) send('happy_level_finished', { week: week });
    },
  };
})();
