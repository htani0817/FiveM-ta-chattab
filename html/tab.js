// ta-chattab: チャットの入力欄で Tab を押すと / コマンドを補完する
// chat のテーマとして読み込まれ、chat の画面（nui://chat）の中で動く。
// chat はリソースが起動するたびにテーマを読み込み直し、script タグも足し直すので、2回目以降は何もしない
(() => {
  if (window.__taChatTab) return;
  window.__taChatTab = true;

  // 直前の Tab で入れた候補の巡回状態。入力が変わったら捨てる
  let cycle = null; // { list: string[], idx: number, value: string }

  // chat が持っている候補（権限で絞った後のコマンド一覧）を読む。
  // 本番ビルドの Vue 3 でも #app._vnode.component.proxy は残る。読めなければ画面に出ている候補を使う
  function suggestionNames() {
    try {
      const root = document.getElementById('app')._vnode.component.proxy;
      const list = root.suggestions;
      if (Array.isArray(list)) return list.map((s) => s && s.name).filter((n) => typeof n === 'string');
    } catch (e) { /* 読めない時は下へ */ }
    return Array.from(document.querySelectorAll('.suggestions .suggestion p > span:first-child'))
      .map((el) => el.textContent.trim());
  }

  // 大文字と小文字を区別しない共通の頭の部分
  function commonPrefix(list) {
    let p = list[0];
    for (const s of list) {
      let i = 0;
      while (i < p.length && i < s.length && p[i].toLowerCase() === s[i].toLowerCase()) i++;
      p = p.slice(0, i);
    }
    return p;
  }

  function setValue(input, value) {
    input.value = value;
    // v-model（chat の message）に伝える
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.setSelectionRange(value.length, value.length);
  }

  // 次に入れる文字列を返す。何もしない時は null
  function complete(value, back) {
    if (cycle && cycle.value === value) {
      const n = cycle.list.length;
      cycle.idx = (cycle.idx + (back ? n - 1 : 1)) % n;
      cycle.value = cycle.list[cycle.idx];
      return cycle.value;
    }
    cycle = null;
    // コマンド名を打っている途中だけ補完する（空白の後の引数は対象外）
    if (/\s/.test(value)) return null;

    const typed = value.toLowerCase();
    const seen = new Set();
    const list = suggestionNames()
      .filter((name) => name.toLowerCase().startsWith(typed))
      .filter((name) => !seen.has(name.toLowerCase()) && seen.add(name.toLowerCase()))
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    if (list.length === 0) return null;
    if (list.length === 1) return list[0] + ' ';

    const prefix = commonPrefix(list);
    if (prefix.length > value.length) return prefix;

    // これ以上は伸ばせないので、候補を順に入れる。打った文字がそのまま候補の時は次の候補から
    const back0 = back ? list.length - 1 : (list[0].toLowerCase() === typed ? 1 : 0);
    cycle = { list, idx: back0, value: list[back0] };
    return cycle.value;
  }

  // chat の keyDown（Tab はモード切り替え）より先に受けるため、window の capture で拾う
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' && e.keyCode !== 9) return;
    const input = e.target;
    if (!input || input.tagName !== 'TEXTAREA') return;
    if (e.isComposing) return; // 日本語の変換中は触らない
    const value = input.value;
    // / で始まらない時は chat に任せる（モード切り替えがあればそちらが動く）
    if (!value.startsWith('/')) return;

    e.preventDefault();
    e.stopPropagation();
    // 入力欄の末尾で押した時だけ補完する
    if (input.selectionStart !== value.length || input.selectionEnd !== value.length) return;

    const next = complete(value, e.shiftKey);
    if (next !== null && next !== value) setValue(input, next);
  }, true);
})();
