// ===== utils.js =====
// カナ変換ユーティリティ（「ぱん」で検索しても「パン」がヒットするように）

function toHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function toKatakana(str) {
  return str.replace(/[\u3041-\u3096]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

function normalizeQuery(str) {
  return toHiragana(str).toLowerCase().trim();
}
