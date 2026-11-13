// FXServer 同梱の chat の画面（dist/ui.html）をヘッドレス Chromium で開き、
// テーマとして tab.js を読み込ませてから実際にキーを押して確かめる（追加の部品なし、Node 22 以降）
// node tests/tab-test.js [chat フォルダ] [出力フォルダ]
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');

const chatDir = process.argv[2] || 'Z:/server/citizen/system_resources/chat';
const outDir = process.argv[3];
const resDir = path.resolve(__dirname, '..');
const SHELL = path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium_headless_shell-1148/chrome-win/headless_shell.exe');
const port = 9334;
const proc = spawn(SHELL, ['--headless', '--disable-gpu', `--remote-debugging-port=${port}`, '--window-size=1280,720',
  '--allow-file-access-from-files', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function check(name, got, want) {
  if (got === want) { pass++; console.log('OK  ', name); }
  else { fail++; console.log('NG  ', name, '期待:', JSON.stringify(want), '実際:', JSON.stringify(got)); }
}

(async () => {
  let ws;
  for (let i = 0; i < 50; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const pg = list.find((t) => t.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break; } } catch (e) {}
    await sleep(200);
  }
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result.result.value;
  const post = (msg) => evalJs(`window.postMessage(${JSON.stringify(msg)}, '*'); true`);
  const key = async (k, shift) => {
    const map = { Tab: ['Tab', 9], a: ['KeyA', 65] };
    const [code, kc] = map[k];
    const modifiers = shift ? 8 : 0;
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: kc, modifiers, text: k.length === 1 ? k : undefined });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: kc, modifiers });
    await sleep(60);
  };
  // 入力欄を空にしてから文字を打つ（Vue の message も揃える）
  const type = async (text) => {
    await evalJs(`(() => { const t = document.querySelector('#app textarea'); t.focus(); t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); return true })()`);
    await send('Input.insertText', { text });
    await sleep(60);
  };
  const value = () => evalJs(`document.querySelector('#app textarea').value`);
  const vueMessage = () => evalJs(`document.getElementById('app')._vnode.component.proxy.message`);
  const modeIdx = () => evalJs(`document.getElementById('app')._vnode.component.proxy.modeIdx`);

  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url: pathToFileURL(path.join(chatDir, 'dist/ui.html')).href });
  await sleep(1200);

  // chat が受け取る形のまま送る
  await post({ type: 'ON_SUGGESTION_ADD', suggestion: [
    { name: '/car', help: '' }, { name: '/cardel', help: '' }, { name: '/carry', help: '' },
    { name: '/me', help: '' }, { name: '/dv', help: '' }, { name: '/arcadeadmin', help: '' }, { name: '/Admin', help: '' },
    { name: '/hidden', help: '' },
  ] });
  await post({ type: 'ON_SUGGESTION_REMOVE', name: '/hidden' });
  const theme = { ta_chattab: { baseUrl: pathToFileURL(resDir).href + '/', script: 'html/tab.js' } };
  // リソースが起動するたびに chat はテーマを読み直すので、2回送って二重に動かないことも見る
  await post({ type: 'ON_UPDATE_THEMES', themes: theme });
  await sleep(300);
  await post({ type: 'ON_UPDATE_THEMES', themes: theme });
  await sleep(300);
  await post({ type: 'ON_OPEN' });
  await sleep(400);

  check('tab.js が読み込まれた', await evalJs('window.__taChatTab === true'), true);
  check('script タグは2つ（読み直しで足される）', await evalJs(`document.querySelectorAll('script[src$="html/tab.js"]').length`), 2);

  await type('/m'); await key('Tab');
  check('候補が1つなら空白付きで補完', await value(), '/me ');
  check('chat 側の message にも入る', await vueMessage(), '/me ');

  await type('/c'); await key('Tab');
  check('共通の頭まで伸ばす', await value(), '/car');
  await key('Tab');
  check('伸ばせなければ次の候補（打った /car は飛ばす）', await value(), '/cardel');
  await key('Tab');
  check('もう一度で次の候補', await value(), '/carry');
  await key('Tab');
  check('最後まで行くと最初に戻る', await value(), '/car');
  await key('Tab', true);
  check('Shift+Tab で前の候補', await value(), '/carry');

  await type('/car'); await key('a');
  check('文字を打つと巡回をやめる（下準備）', await value(), '/cara');
  await key('Tab');
  check('合う候補が無ければそのまま', await value(), '/cara');

  await type('/ad'); await key('Tab');
  check('大文字と小文字を区別しない', await value(), '/Admin ');

  await type('/hi'); await key('Tab');
  check('消された候補は使わない', await value(), '/hi');

  await type('/car 1'); await key('Tab');
  check('引数の所では補完しない', await value(), '/car 1');

  await type('/me hello'); await key('Tab');
  check('空白の後は補完しない', await value(), '/me hello');

  // / で始まらない時は chat の Tab（モード切り替え）がそのまま動く
  await post({ type: 'ON_MODE_ADD', mode: { name: 'ooc', displayName: 'OOC', color: '#aaa' } });
  await sleep(100);
  const before = await modeIdx();
  await type('hello'); await key('Tab');
  check('普通の文字ではモード切り替えが動く', (await modeIdx()) !== before, true);
  const mid = await modeIdx();
  await type('/c'); await key('Tab');
  check('/ の時はモードを変えない', await modeIdx(), mid);
  check('入力欄にフォーカスが残る', await evalJs(`document.activeElement === document.querySelector('#app textarea')`), true);

  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    await type('/ca'); await key('Tab');
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'chat-tab.png'), Buffer.from(r.result.data, 'base64'));
    console.log('shot', path.join(outDir, 'chat-tab.png'));
  }

  console.log(`\n${pass} OK / ${fail} NG`);
  ws.close(); proc.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); proc.kill(); process.exit(1); });
