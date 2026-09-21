export { Room } from './room.js';

// 房號用不會看錯的字：沒有 0/O、1/I
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;

function newCode() {
  let c = '';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  for (let i = 0; i < 4; i++) c += ALPHABET[bytes[i] % ALPHABET.length];
  return c;
}

// 正式網址是 www.vibeweb100.com/happiness/*，由首頁的 vercel.json 代理到這個 Worker。
// 代理進來的請求 url 是 workers.dev，用 Response.redirect 組絕對網址會把人踢出主網域，
// 所以轉址一律只給路徑，讓瀏覽器對著它現在所在的網域解析。
function go(path, week, code) {
  let to = '/happiness/w' + week + '/zh-TW/' + path;
  if (CODE_RE.test(code)) to += '?room=' + code;
  return new Response(null, { status: 302, headers: { Location: to } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // 路由都掛在 /happiness 底下（跟系列其他專案一樣，遊戲代號在前）。
    // 舊的根目錄短網址（/1、/h1、/ws……）留著，直接開 workers.dev 的時候還能用。
    const p = url.pathname.startsWith('/happiness/') ? url.pathname.slice('/happiness'.length) : url.pathname;
    const code = (url.searchParams.get('room') || '').toUpperCase();

    // 開新房：主持人畫面載入時跟 Worker 要一個房號
    if (p === '/api/new-room') {
      return Response.json({ room: newCode() });
    }

    // 房間連線。room 決定連到哪一個 Durable Object，week 讓七關共用同一個 class。
    // 在 vibeweb100.com 上時，這條不走代理，瀏覽器直接連 workers.dev（見 room-client.js）。
    if (p === '/ws') {
      const week = url.searchParams.get('week') || '1';
      if (!CODE_RE.test(code)) return new Response('bad room code', { status: 400 });
      const stub = env.ROOM.getByName('w' + week + ':' + code);
      return stub.fetch(request);
    }

    // 最短的入場網址：/happiness/1 到 /happiness/7。大螢幕上印的、QR 編的就是這個 ——
    // 問號和等號在手機鍵盤上很難打，所以連 ?w= 都不要。
    //   /happiness/2            → 第二關的玩家頁，讓他輸入四碼房號
    //   /happiness/2?room=XXXX  → 直接進那一間
    if (/^\/[1-7]$/.test(p)) return go('p/', p.slice(1), code);

    // 更早的入場網址 /j?w=2&room=XXXX
    if (p === '/j') {
      const w = url.searchParams.get('w') || '';
      return go('p/', /^[1-7]$/.test(w) ? w : '1', code);
    }

    // 主持人備忘錄的短網址。入場頁上那個小 QR 編的就是這個，
    // 掃不到的時候也打得出來（/happiness/h2 就是第二關）。
    if (/^\/h[1-7]$/.test(p)) return go('h/', p.slice(2), code);
    if (p === '/h') {
      const w = url.searchParams.get('w') || '';
      return go('h/', /^[1-7]$/.test(w) ? w : '1', code);
    }

    if (url.pathname === '/' || url.pathname === '/happiness' || url.pathname === '/happiness/') {
      return new Response(null, { status: 302, headers: { Location: '/happiness/zh-TW/' } });
    }

    return env.ASSETS.fetch(request);
  },
};
