// config.js — Bolão da Copa 2026 v2 (configuração compartilhada)
// ⚠️ Cole abaixo a URL /exec do seu Web App do Google Apps Script.

const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwQ_U7ylXlC0FhVL4iJvxx12H7BsOv7SgngcV91nhIotW_s0VLiDYb8zt6wy6asWdHK/exec',
  BOLAO_NOME: 'Bolão da Copa 2026',
  EDICAO: 'v2 · Fase Eliminatória',
  VALOR_INSCRICAO: 100.00,
  PIX_CHAVE: '76889726391',          // CPF sem pontos/traço
  PIX_NOME: 'Bolao Copa 2026',       // sem acentos, máx. 25 chars
  PIX_CIDADE: 'Tabuleiro do Norte',  // sem acentos, máx. 15 chars
};

// ── Fases do mata-mata (espelha FASES do Code.gs) ───────────
const FASES_INFO = {
  '32':      { label: 'Rodada de 32',        curto: '32-avos',  pontos: 2,  ordem: 1 },
  'oitavas': { label: 'Oitavas de final',    curto: 'Oitavas',  pontos: 4,  ordem: 2 },
  'quartas': { label: 'Quartas de final',    curto: 'Quartas',  pontos: 6,  ordem: 3 },
  'semis':   { label: 'Semifinais',          curto: 'Semis',    pontos: 10, ordem: 4 },
  '3lugar':  { label: 'Disputa de 3º lugar', curto: '3º lugar', pontos: 0,  ordem: 5 },
  'final':   { label: 'Final',               curto: 'Final',    pontos: 15, ordem: 6 },
};
const FASES_ORDEM = ['32','oitavas','quartas','semis','3lugar','final'];

// ── Bandeiras por sigla ─────────────────────────────────────
const BANDEIRAS = {
  MEX:'🇲🇽', AFS:'🇿🇦', COR:'🇰🇷', TCH:'🇨🇿', CAN:'🇨🇦', BOS:'🇧🇦',
  QAT:'🇶🇦', SUI:'🇨🇭', BRA:'🇧🇷', MAR:'🇲🇦', HAI:'🇭🇹', ESC:'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  EUA:'🇺🇸', PAR:'🇵🇾', AUS:'🇦🇺', TUR:'🇹🇷', ALE:'🇩🇪', CUR:'🇨🇼',
  CDM:'🇨🇮', EQU:'🇪🇨', HOL:'🇳🇱', JAP:'🇯🇵', SUE:'🇸🇪', TUN:'🇹🇳',
  BEL:'🇧🇪', EGI:'🇪🇬', IRA:'🇮🇷', NZE:'🇳🇿', ESP:'🇪🇸', CAB:'🇨🇻',
  ARS:'🇸🇦', URU:'🇺🇾', FRA:'🇫🇷', SEN:'🇸🇳', IRQ:'🇮🇶', NOR:'🇳🇴',
  ARG:'🇦🇷', AGL:'🇩🇿', AUT:'🇦🇹', JOR:'🇯🇴', POR:'🇵🇹', RDC:'🇨🇩',
  UZB:'🇺🇿', COL:'🇨🇴', ING:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', CRO:'🇭🇷', GAN:'🇬🇭', PAN:'🇵🇦',
};

// ── Nomes por sigla ─────────────────────────────────────────
const NOMES = {
  MEX:'México', AFS:'África do Sul', COR:'Coreia do Sul', TCH:'República Tcheca',
  CAN:'Canadá', BOS:'Bósnia', QAT:'Catar', SUI:'Suíça', BRA:'Brasil',
  MAR:'Marrocos', HAI:'Haiti', ESC:'Escócia', EUA:'EUA', PAR:'Paraguai',
  AUS:'Austrália', TUR:'Turquia', ALE:'Alemanha', CUR:'Curaçao', CDM:'Costa do Marfim',
  EQU:'Equador', HOL:'Holanda', JAP:'Japão', SUE:'Suécia', TUN:'Tunísia',
  BEL:'Bélgica', EGI:'Egito', IRA:'Irã', NZE:'Nova Zelândia', ESP:'Espanha',
  CAB:'Cabo Verde', ARS:'Arábia Saudita', URU:'Uruguai', FRA:'França', SEN:'Senegal',
  IRQ:'Iraque', NOR:'Noruega', ARG:'Argentina', AGL:'Argélia', AUT:'Áustria',
  JOR:'Jordânia', POR:'Portugal', RDC:'Rep. D. Congo', UZB:'Uzbequistão',
  COL:'Colômbia', ING:'Inglaterra', CRO:'Croácia', GAN:'Gana', PAN:'Panamá',
};

function nomeTime(s) { return NOMES[s] || s || '?'; }
function bandeira(s) { return BANDEIRAS[s] || '🏳'; }

// ── Loading overlay ─────────────────────────────────────────
let _loadingCount = 0;
function _mostrarLoading() {
  if (++_loadingCount === 1) {
    let el = document.getElementById('loading-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-overlay';
      el.innerHTML = '<div class="loading-spinner"></div><span class="loading-texto">Carregando…</span>';
      document.body.appendChild(el);
    }
    el.classList.add('visivel');
  }
}
function _esconderLoading() {
  if (--_loadingCount <= 0) {
    _loadingCount = 0;
    const el = document.getElementById('loading-overlay');
    if (el) el.classList.remove('visivel');
  }
}

// ── API helpers ─────────────────────────────────────────────
async function api(body) {
  _mostrarLoading();
  try {
    const r = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' });
    return await r.json();
  } finally { _esconderLoading(); }
}
// Sem overlay (auto-refresh silencioso)
async function apiSilent(body) {
  const r = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(body), redirect: 'follow' });
  return r.json();
}

// ── Sessão (token + perfil em localStorage) ─────────────────
function salvarSessao(token, perfil) {
  if (token) localStorage.setItem('bc_token', token);
  if (perfil) localStorage.setItem('bc_perfil', JSON.stringify(perfil));
}
function getToken()  { return localStorage.getItem('bc_token'); }
function getPerfil() { try { return JSON.parse(localStorage.getItem('bc_perfil') || 'null'); } catch (e) { return null; } }
function logout() {
  localStorage.removeItem('bc_token');
  localStorage.removeItem('bc_perfil');
  window.location.href = 'login.html';
}
// Garante login válido; redireciona para login.html se não houver sessão.
async function exigirLogin(redirecionar) {
  const token = getToken();
  if (!token) { if (redirecionar !== false) window.location.href = 'login.html'; return null; }
  const res = await api({ action: 'verificarSessao', token });
  if (!res.ok) { if (redirecionar !== false) { localStorage.removeItem('bc_token'); window.location.href = 'login.html'; } return null; }
  salvarSessao(token, res.perfil);
  if (res.perfil && res.perfil.isAdmin) _injetarLinkAdmin();
  return res.perfil;
}

// Mostra o link da área restrita só para participantes marcados como isAdmin.
function _injetarLinkAdmin() {
  const ativo = /admin\.html$/.test(location.pathname);
  document.querySelectorAll('header nav').forEach(nav => {
    if (nav.querySelector('.nav-admin')) return;
    const a = document.createElement('a');
    a.href = 'admin.html'; a.className = 'nav-admin' + (ativo ? ' ativo' : ''); a.textContent = '⚙️ Admin';
    const sair = Array.from(nav.querySelectorAll('a')).find(x => /sair/i.test(x.textContent));
    if (sair) nav.insertBefore(a, sair); else nav.appendChild(a);
  });
  document.querySelectorAll('.bottom-nav').forEach(bn => {
    if (bn.querySelector('.bnav-admin')) return;
    const a = document.createElement('a');
    a.href = 'admin.html'; a.className = 'bnav-admin' + (ativo ? ' ativo' : '');
    a.innerHTML = '<span class="bnav-icon">⚙️</span>Admin';
    bn.appendChild(a);
  });
}

// ── Datas / horário (fuso de Brasília, igual à v1) ──────────
const ANTECEDENCIA_MS = 5 * 60 * 1000; // trava 5 min antes do apito
function soData(d) { return String(d).slice(0, 10); } // aceita '2026-06-28' ou ISO completo do Sheets
// O Sheets pode devolver a fase '32' como número e a data como datetime — normaliza tudo.
function normJogosMM(arr) {
  return (arr || []).map(j => Object.assign({}, j, { id: String(j.id), fase: String(j.fase), data: soData(j.data) }));
}
function horarioJogo(j) {
  const partes = String(j.hora).replace('h30', ':30').replace('h', ':00').split(':');
  const h = String(parseInt(partes[0], 10) || 0).padStart(2, '0');
  const m = (partes[1] || '00');
  return new Date(soData(j.data) + 'T' + h + ':' + m + ':00-03:00');
}
function prazoLimite(j) { return horarioJogo(j).getTime() - ANTECEDENCIA_MS; }
function palpiteEncerrado(j) { return Date.now() >= prazoLimite(j); }

// Pontos do placar (espelho de calcularPontos do Code.gs): 15/10/7,5/5/0.
function calcPlacar(p1, p2, r1, r2) {
  p1 = parseInt(p1); p2 = parseInt(p2); r1 = parseInt(r1); r2 = parseInt(r2);
  if ([p1, p2, r1, r2].some(isNaN)) return 0;
  const a1 = p1 === r1, a2 = p2 === r2;
  if (a1 && a2) return 15;
  if (r1 === r2 && (a1 || a2)) return 7.5;
  if (r1 > r2 && a1) return 10;
  if (r2 > r1 && a2) return 10;
  if (r1 > r2 && a2) return 5;
  if (r2 > r1 && a1) return 5;
  return 0;
}

function formatarTempo(ms) {
  const t = Math.floor(ms / 1000);
  const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (d > 0) return `fecha em ${d}d ${h}h`;
  if (h > 0) return `fecha em ${h}h ${String(m).padStart(2, '0')}min`;
  if (m > 0) return `fecha em ${m}min ${String(s).padStart(2, '0')}s`;
  return `fecha em ${s}s`;
}
// Contagem regressiva completa e sempre com segundos (ex.: "10d 08h 26m 26s").
function fmtCountdown(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = n => String(n).padStart(2, '0');
  if (d > 0) return d + 'd ' + p(h) + 'h ' + p(m) + 'm ' + p(s) + 's';
  if (h > 0) return p(h) + 'h ' + p(m) + 'm ' + p(s) + 's';
  return p(m) + 'm ' + p(s) + 's';
}
function formatarData(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function fmtDiaMes(isoData) {
  return new Date(soData(isoData) + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// ── Toast ───────────────────────────────────────────────────
function toast(msg, tipo = 'info') {
  const t = document.createElement('div');
  t.className = 'toast toast-' + tipo;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
}

// ── Pix copia-e-cola (EMV estático) ─────────────────────────
function gerarPixCopiaECola(chave, nome, cidade, valor, txid) {
  chave = chave.replace(/[.\-\/]/g, '').trim();
  function campo(id, val) { return id + String(val.length).padStart(2, '0') + val; }
  function crc16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  }
  const gui = campo('00', 'BR.GOV.BCB.PIX');
  const pixKey = campo('01', chave);
  const merchantAccInfo = campo('26', gui + pixKey);
  const txidLimpo = txid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25);
  const addData = campo('62', campo('05', txidLimpo));
  const nomeLimpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 25);
  const cidadeLimpa = cidade.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 15);
  let payload = campo('00', '01') + merchantAccInfo + campo('52', '0000') + campo('53', '986') +
    campo('54', valor.toFixed(2)) + campo('58', 'BR') + campo('59', nomeLimpo) + campo('60', cidadeLimpa) + addData + '6304';
  return payload + crc16(payload);
}

// ── Twemoji (Windows não renderiza bandeiras emoji) ─────────
(function carregarTwemoji() {
  if (window.twemoji) return;
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@twemoji/api@latest/dist/twemoji.min.js';
  s.crossOrigin = 'anonymous';
  s.async = true;
  s.onload = () => aplicarTwemoji();
  document.head.appendChild(s);
})();
function aplicarTwemoji(raiz) {
  if (!window.twemoji) return;
  const alvo = raiz || document.body;
  if (!alvo) return;
  window.twemoji.parse(alvo, {
    folder: 'svg', ext: '.svg',
    base: 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/',
    className: 'emoji-tw'
  });
}

// ── PWA: manifest, ícones e service worker ──────────────────
(function pwaSetup() {
  try {
    const head = document.head || document.getElementsByTagName('head')[0];
    function addOnce(sel, tag, attrs) {
      if (document.querySelector(sel)) return;
      const el = document.createElement(tag);
      for (const k in attrs) el.setAttribute(k, attrs[k]);
      head.appendChild(el);
    }
    addOnce('link[rel="manifest"]', 'link', { rel: 'manifest', href: 'manifest.json' });
    addOnce('link[rel="icon"]', 'link', { rel: 'icon', type: 'image/png', href: 'favicon-32.png' });
    addOnce('link[rel="apple-touch-icon"]', 'link', { rel: 'apple-touch-icon', href: 'apple-touch-icon.png' });
    addOnce('meta[name="apple-mobile-web-app-capable"]', 'meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
    addOnce('meta[name="mobile-web-app-capable"]', 'meta', { name: 'mobile-web-app-capable', content: 'yes' });
    addOnce('meta[name="apple-mobile-web-app-status-bar-style"]', 'meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' });
    addOnce('meta[name="apple-mobile-web-app-title"]', 'meta', { name: 'apple-mobile-web-app-title', content: 'Bolão Copa' });
  } catch (e) {}

  if ('serviceWorker' in navigator) {
    let atualizando = false;

    const mostrarBannerUpdate = function (sw) {
      if (document.getElementById('pwa-update-banner') || !document.body) return;
      const bar = document.createElement('div');
      bar.id = 'pwa-update-banner';
      bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9500;display:flex;align-items:center;gap:.6rem;justify-content:center;flex-wrap:wrap;background:#1A237E;color:#fff;font-size:.85rem;font-weight:700;box-shadow:0 3px 12px rgba(0,0,0,.3);padding:calc(env(safe-area-inset-top,0px) + .55rem) .8rem .55rem;';
      const txt = document.createElement('span');
      txt.textContent = '🔄 Nova versão disponível';
      const btn = document.createElement('button');
      btn.textContent = 'Atualizar';
      btn.style.cssText = 'background:#F9A825;color:#1A237E;border:none;border-radius:999px;padding:.35rem .9rem;font-weight:800;font-size:.82rem;cursor:pointer;';
      btn.onclick = function () {
        atualizando = true;
        btn.textContent = 'Atualizando…'; btn.disabled = true;
        try { sw.postMessage({ type: 'SKIP_WAITING' }); } catch (e) { window.location.reload(); }
      };
      const fechar = document.createElement('button');
      fechar.setAttribute('aria-label', 'Dispensar');
      fechar.textContent = '✕';
      fechar.style.cssText = 'background:transparent;color:#fff;border:none;font-size:1rem;line-height:1;cursor:pointer;opacity:.8;';
      fechar.onclick = function () { bar.remove(); };
      bar.appendChild(txt); bar.appendChild(btn); bar.appendChild(fechar);
      document.body.appendChild(bar);
    };

    // recarrega só quando o usuário aceitou atualizar (evita reload no 1º controle)
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (atualizando) window.location.reload();
    });

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        const acompanhar = function (sw) {
          if (!sw) return;
          if (sw.state === 'installed' && navigator.serviceWorker.controller) { mostrarBannerUpdate(sw); return; }
          sw.addEventListener('statechange', function () {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) mostrarBannerUpdate(sw);
          });
        };
        if (reg.waiting && navigator.serviceWorker.controller) mostrarBannerUpdate(reg.waiting);
        if (reg.installing) acompanhar(reg.installing);          // corrige a corrida (já instalando)
        reg.addEventListener('updatefound', function () { acompanhar(reg.installing); });
        // procura atualização ao reabrir/voltar pro app
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') reg.update().catch(function () {});
        });
      }).catch(function () {});
    });
  }

  // Botão flutuante "Instalar app" (Android / Chrome desktop)
  const jaInstalado = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
  if (jaInstalado) return;
  let promptDiferido = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    promptDiferido = e;
    mostrarBotaoInstalar();
  });
  window.addEventListener('appinstalled', function () {
    const b = document.getElementById('pwa-install-btn'); if (b) b.remove();
  });
  function mostrarBotaoInstalar() {
    if (document.getElementById('pwa-install-btn') || !document.body) return;
    const b = document.createElement('button');
    b.id = 'pwa-install-btn';
    b.textContent = '📲 Instalar app';
    b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 76px);z-index:9000;background:#F9A825;color:#1A237E;border:none;border-radius:999px;padding:.6rem 1.1rem;font-weight:800;font-size:.85rem;box-shadow:0 4px 14px rgba(0,0,0,.28);cursor:pointer;';
    b.onclick = function () {
      if (!promptDiferido) { b.remove(); return; }
      promptDiferido.prompt();
      promptDiferido.userChoice.finally(function () { promptDiferido = null; b.remove(); });
    };
    document.body.appendChild(b);
  }
})();
