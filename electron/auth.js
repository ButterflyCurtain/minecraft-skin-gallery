// 【実験的・任意】Microsoftアカウントでログインして、Minecraftプロフィールへスキンを直接アップロードする。
// デバイスコードフロー（リダイレクトサーバ不要）。トークンはローカルに保存して使い回す。
//
// 必要なもの: Azure ADで登録した「パブリッククライアント」アプリのクライアントID。
//   portal.azure.com → アプリの登録 → 新規登録（対応アカウント=「個人のMicrosoftアカウント」）
//   → 認証 → 「パブリック クライアント フローを許可する」= はい
//   取得したIDを 環境変数 MS_CLIENT_ID か、このフォルダの auth-config.json {"clientId":"..."} に設定。
// 公開クライアントIDを同梱しないのは、規約・悪用防止のため（各自のアプリ登録が安全）。
'use strict';
const fs = require('fs');
const path = require('path');

const DEVICECODE = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode';
const TOKEN = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
const SCOPE = 'XboxLive.signin offline_access';

function getClientId(appDir) {
  if (process.env.MS_CLIENT_ID) return process.env.MS_CLIENT_ID;
  try { return JSON.parse(fs.readFileSync(path.join(appDir, 'auth-config.json'), 'utf-8')).clientId || null; }
  catch (_) { return null; }
}

function tokenStore(appDir) { return path.join(appDir, 'auth-tokens.json'); }
function loadTokens(appDir) { try { return JSON.parse(fs.readFileSync(tokenStore(appDir), 'utf-8')); } catch (_) { return {}; } }
function saveTokens(appDir, t) { try { fs.writeFileSync(tokenStore(appDir), JSON.stringify(t, null, 2)); } catch (_) {} }

async function jpost(url, body, headers) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${url} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
}

// 1) デバイスコード取得 → onPrompt({verification_uri,user_code}) で利用者に提示
async function beginDeviceLogin(clientId, onPrompt) {
  const form = new URLSearchParams({ client_id: clientId, scope: SCOPE });
  const r = await fetch(DEVICECODE, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
  const dc = await r.json();
  if (!r.ok) throw new Error('デバイスコード取得失敗: ' + JSON.stringify(dc));
  onPrompt({ verification_uri: dc.verification_uri, user_code: dc.user_code, message: dc.message });
  // 2) ポーリングでMSトークン取得
  const interval = (dc.interval || 5) * 1000;
  const deadline = Date.now() + (dc.expires_in || 900) * 1000;
  while (Date.now() < deadline) {
    await new Promise(res => setTimeout(res, interval));
    const pf = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: clientId, device_code: dc.device_code,
    });
    const pr = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: pf });
    const pj = await pr.json();
    if (pr.ok) return pj; // {access_token, refresh_token, ...}
    if (pj.error === 'authorization_pending' || pj.error === 'slow_down') continue;
    throw new Error('認証失敗: ' + (pj.error_description || pj.error));
  }
  throw new Error('認証がタイムアウトしました');
}

async function refresh(clientId, refreshToken) {
  const form = new URLSearchParams({
    client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken, scope: SCOPE,
  });
  const r = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
  const j = await r.json();
  if (!r.ok) throw new Error('リフレッシュ失敗: ' + JSON.stringify(j));
  return j;
}

// MSトークン → Xbox → XSTS → Minecraft アクセストークン
async function msToMinecraft(msAccessToken) {
  const xbl = await jpost('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: 'd=' + msAccessToken },
    RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT',
  });
  const xblToken = xbl.Token, uhs = xbl.DisplayClaims.xui[0].uhs;
  const xsts = await jpost('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
    RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT',
  });
  const xstsToken = xsts.Token;
  const mc = await jpost('https://api.minecraftservices.com/authentication/login_with_xbox', {
    identityToken: `XBL3.0 x=${uhs};${xstsToken}`,
  });
  return mc.access_token; // Minecraftアクセストークン
}

// 全体: ログイン済みなら使い回し、なければデバイスコードでログインしてMCトークンを返す
async function getMinecraftToken(appDir, onPrompt) {
  const clientId = getClientId(appDir);
  if (!clientId) throw new Error('NO_CLIENT_ID');
  const store = loadTokens(appDir);
  let ms;
  if (store.refresh_token) {
    try { ms = await refresh(clientId, store.refresh_token); } catch (_) { ms = null; }
  }
  if (!ms) ms = await beginDeviceLogin(clientId, onPrompt);
  saveTokens(appDir, { refresh_token: ms.refresh_token, obtained: Date.now() });
  return await msToMinecraft(ms.access_token);
}

// スキンアップロード: pngBuf(Buffer), variant 'classic'|'slim'
async function uploadSkin(appDir, pngBuf, slim, onPrompt) {
  const mcToken = await getMinecraftToken(appDir, onPrompt);
  const fd = new FormData();
  fd.append('variant', slim ? 'slim' : 'classic');
  fd.append('file', new Blob([pngBuf], { type: 'image/png' }), 'skin.png');
  const r = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
    method: 'POST', headers: { Authorization: 'Bearer ' + mcToken }, body: fd,
  });
  if (!r.ok) throw new Error('アップロード失敗: ' + r.status + ' ' + (await r.text().catch(() => '')));
  return await r.json().catch(() => ({ ok: true }));
}

function hasClientId(appDir) { return !!getClientId(appDir); }

module.exports = { getMinecraftToken, uploadSkin, hasClientId };
