// ============================================================
// BOLÃO DA COPA 2026 — v2.0 — Google Apps Script Backend
// ============================================================
// Três camadas de pontuação independentes:
//   Camada 1 — Classificação da fase de grupos (1º/2º + 8 terceiros)
//   Camada 2 — Quem avança no mata-mata (trava POR FASE)
//   Camada 3 — Placares do mata-mata (corte por jogo, igual à v1)
// Autenticação: e-mail + senha (SHA-256 com salt por usuário).
//
// COMO PUBLICAR:
// 1. script.google.com → Novo projeto → cole este arquivo.
// 2. Crie uma planilha nova, copie o ID para SPREADSHEET_ID abaixo.
// 3. Rode a função inicializar() uma vez (cria todas as abas).
// 4. Implantar → Nova implantação → Web App
//      Executar como: Eu   ·   Quem tem acesso: Qualquer pessoa (Anyone)
// 5. Copie a URL /exec e cole em config.js (CONFIG.API_URL).
// 6. A cada alteração aqui, publique NOVA VERSÃO da implantação.
// ============================================================

const SPREADSHEET_ID = 'COLE_AQUI_O_ID_DA_PLANILHA'; // ← substitua no editor do Apps Script
const ADMIN_PASSWORD = 'DEFINA_UMA_SENHA_FORTE';     // ← defina no editor (NÃO versionar a senha real)

const VALOR_INSCRICAO = 100;   // R$ — nova taxa da v2 (fase eliminatória)
const ANTECEDENCIA_MS = 5 * 60 * 1000; // palpite trava 5 min antes do apito

// Premiação (sobre o total arrecadado)
const PREMIO_CAMPEAO = 0.60;
const PREMIO_VICE    = 0.30;
const PREMIO_ORG     = 0.10;

// ── Fases do mata-mata: rótulo, pontos da Camada 2, ordem ────
const FASES = {
  '32':      { label: 'Rodada de 32',        pontos: 2,  ordem: 1 },
  'oitavas': { label: 'Oitavas de final',    pontos: 4,  ordem: 2 },
  'quartas': { label: 'Quartas de final',    pontos: 6,  ordem: 3 },
  'semis':   { label: 'Semifinais',          pontos: 10, ordem: 4 },
  '3lugar':  { label: 'Disputa de 3º lugar', pontos: 0,  ordem: 5 },
  'final':   { label: 'Final',               pontos: 15, ordem: 6 },
};

// ────────────────────────────────────────────────────────────
// JOGOS DA FASE DE GRUPOS — Copa 2026 (72 jogos, idênticos à v1)
// ────────────────────────────────────────────────────────────
const JOGOS = [
  // Grupo A
  { id: 1,  data: '2026-06-11', hora: '16h',   time1: 'MEX', time2: 'AFS', grupo: 'A' },
  { id: 2,  data: '2026-06-11', hora: '23h',   time1: 'COR', time2: 'TCH', grupo: 'A' },
  { id: 3,  data: '2026-06-18', hora: '13h',   time1: 'TCH', time2: 'AFS', grupo: 'A' },
  { id: 4,  data: '2026-06-18', hora: '22h',   time1: 'MEX', time2: 'COR', grupo: 'A' },
  { id: 5,  data: '2026-06-24', hora: '22h',   time1: 'AFS', time2: 'COR', grupo: 'A' },
  { id: 6,  data: '2026-06-24', hora: '22h',   time1: 'TCH', time2: 'MEX', grupo: 'A' },
  // Grupo B
  { id: 7,  data: '2026-06-12', hora: '16h',   time1: 'CAN', time2: 'BOS', grupo: 'B' },
  { id: 8,  data: '2026-06-13', hora: '16h',   time1: 'QAT', time2: 'SUI', grupo: 'B' },
  { id: 9,  data: '2026-06-18', hora: '16h',   time1: 'SUI', time2: 'BOS', grupo: 'B' },
  { id: 10, data: '2026-06-18', hora: '19h',   time1: 'CAN', time2: 'QAT', grupo: 'B' },
  { id: 11, data: '2026-06-24', hora: '16h',   time1: 'SUI', time2: 'CAN', grupo: 'B' },
  { id: 12, data: '2026-06-24', hora: '16h',   time1: 'BOS', time2: 'QAT', grupo: 'B' },
  // Grupo C
  { id: 13, data: '2026-06-13', hora: '19h',   time1: 'BRA', time2: 'MAR', grupo: 'C' },
  { id: 14, data: '2026-06-13', hora: '22h',   time1: 'HAI', time2: 'ESC', grupo: 'C' },
  { id: 15, data: '2026-06-19', hora: '19h',   time1: 'ESC', time2: 'MAR', grupo: 'C' },
  { id: 16, data: '2026-06-19', hora: '21h30', time1: 'BRA', time2: 'HAI', grupo: 'C' },
  { id: 17, data: '2026-06-24', hora: '19h',   time1: 'MAR', time2: 'HAI', grupo: 'C' },
  { id: 18, data: '2026-06-24', hora: '19h',   time1: 'ESC', time2: 'BRA', grupo: 'C' },
  // Grupo D
  { id: 19, data: '2026-06-12', hora: '22h',   time1: 'EUA', time2: 'PAR', grupo: 'D' },
  { id: 20, data: '2026-06-14', hora: '1h',    time1: 'AUS', time2: 'TUR', grupo: 'D' },
  { id: 21, data: '2026-06-19', hora: '16h',   time1: 'EUA', time2: 'AUS', grupo: 'D' },
  { id: 22, data: '2026-06-20', hora: '1h',    time1: 'TUR', time2: 'PAR', grupo: 'D' },
  { id: 23, data: '2026-06-25', hora: '23h',   time1: 'TUR', time2: 'EUA', grupo: 'D' },
  { id: 24, data: '2026-06-25', hora: '23h',   time1: 'PAR', time2: 'AUS', grupo: 'D' },
  // Grupo E
  { id: 25, data: '2026-06-14', hora: '14h',   time1: 'ALE', time2: 'CUR', grupo: 'E' },
  { id: 26, data: '2026-06-14', hora: '20h',   time1: 'CDM', time2: 'EQU', grupo: 'E' },
  { id: 27, data: '2026-06-20', hora: '17h',   time1: 'ALE', time2: 'CDM', grupo: 'E' },
  { id: 28, data: '2026-06-20', hora: '21h',   time1: 'EQU', time2: 'CUR', grupo: 'E' },
  { id: 29, data: '2026-06-25', hora: '17h',   time1: 'EQU', time2: 'ALE', grupo: 'E' },
  { id: 30, data: '2026-06-25', hora: '17h',   time1: 'CUR', time2: 'CDM', grupo: 'E' },
  // Grupo F
  { id: 31, data: '2026-06-14', hora: '17h',   time1: 'HOL', time2: 'JAP', grupo: 'F' },
  { id: 32, data: '2026-06-14', hora: '23h',   time1: 'SUE', time2: 'TUN', grupo: 'F' },
  { id: 33, data: '2026-06-20', hora: '14h',   time1: 'HOL', time2: 'SUE', grupo: 'F' },
  { id: 34, data: '2026-06-21', hora: '1h',    time1: 'TUN', time2: 'JAP', grupo: 'F' },
  { id: 35, data: '2026-06-25', hora: '20h',   time1: 'TUN', time2: 'HOL', grupo: 'F' },
  { id: 36, data: '2026-06-25', hora: '20h',   time1: 'JAP', time2: 'SUE', grupo: 'F' },
  // Grupo G
  { id: 37, data: '2026-06-15', hora: '16h',   time1: 'BEL', time2: 'EGI', grupo: 'G' },
  { id: 38, data: '2026-06-15', hora: '22h',   time1: 'IRA', time2: 'NZE', grupo: 'G' },
  { id: 39, data: '2026-06-21', hora: '16h',   time1: 'BEL', time2: 'IRA', grupo: 'G' },
  { id: 40, data: '2026-06-21', hora: '22h',   time1: 'NZE', time2: 'EGI', grupo: 'G' },
  { id: 41, data: '2026-06-27', hora: '0h',    time1: 'EGI', time2: 'IRA', grupo: 'G' },
  { id: 42, data: '2026-06-27', hora: '0h',    time1: 'NZE', time2: 'BEL', grupo: 'G' },
  // Grupo H
  { id: 43, data: '2026-06-15', hora: '13h',   time1: 'ESP', time2: 'CAB', grupo: 'H' },
  { id: 44, data: '2026-06-15', hora: '19h',   time1: 'ARS', time2: 'URU', grupo: 'H' },
  { id: 45, data: '2026-06-21', hora: '13h',   time1: 'ESP', time2: 'ARS', grupo: 'H' },
  { id: 46, data: '2026-06-21', hora: '19h',   time1: 'URU', time2: 'CAB', grupo: 'H' },
  { id: 47, data: '2026-06-26', hora: '21h',   time1: 'CAB', time2: 'ARS', grupo: 'H' },
  { id: 48, data: '2026-06-26', hora: '21h',   time1: 'URU', time2: 'ESP', grupo: 'H' },
  // Grupo I
  { id: 49, data: '2026-06-16', hora: '16h',   time1: 'FRA', time2: 'SEN', grupo: 'I' },
  { id: 50, data: '2026-06-16', hora: '19h',   time1: 'IRQ', time2: 'NOR', grupo: 'I' },
  { id: 51, data: '2026-06-22', hora: '18h',   time1: 'FRA', time2: 'IRQ', grupo: 'I' },
  { id: 52, data: '2026-06-22', hora: '21h',   time1: 'NOR', time2: 'SEN', grupo: 'I' },
  { id: 53, data: '2026-06-26', hora: '16h',   time1: 'SEN', time2: 'IRQ', grupo: 'I' },
  { id: 54, data: '2026-06-26', hora: '16h',   time1: 'NOR', time2: 'FRA', grupo: 'I' },
  // Grupo J
  { id: 55, data: '2026-06-16', hora: '22h',   time1: 'ARG', time2: 'AGL', grupo: 'J' },
  { id: 56, data: '2026-06-17', hora: '1h',    time1: 'AUT', time2: 'JOR', grupo: 'J' },
  { id: 57, data: '2026-06-22', hora: '14h',   time1: 'ARG', time2: 'AUT', grupo: 'J' },
  { id: 58, data: '2026-06-23', hora: '0h',    time1: 'JOR', time2: 'AGL', grupo: 'J' },
  { id: 59, data: '2026-06-27', hora: '23h',   time1: 'JOR', time2: 'ARG', grupo: 'J' },
  { id: 60, data: '2026-06-27', hora: '23h',   time1: 'AGL', time2: 'AUT', grupo: 'J' },
  // Grupo K
  { id: 61, data: '2026-06-17', hora: '14h',   time1: 'POR', time2: 'RDC', grupo: 'K' },
  { id: 62, data: '2026-06-17', hora: '23h',   time1: 'UZB', time2: 'COL', grupo: 'K' },
  { id: 63, data: '2026-06-23', hora: '14h',   time1: 'POR', time2: 'UZB', grupo: 'K' },
  { id: 64, data: '2026-06-23', hora: '23h',   time1: 'COL', time2: 'RDC', grupo: 'K' },
  { id: 65, data: '2026-06-27', hora: '20h30', time1: 'RDC', time2: 'UZB', grupo: 'K' },
  { id: 66, data: '2026-06-27', hora: '20h30', time1: 'COL', time2: 'POR', grupo: 'K' },
  // Grupo L
  { id: 67, data: '2026-06-17', hora: '17h',   time1: 'ING', time2: 'CRO', grupo: 'L' },
  { id: 68, data: '2026-06-17', hora: '20h',   time1: 'GAN', time2: 'PAN', grupo: 'L' },
  { id: 69, data: '2026-06-23', hora: '17h',   time1: 'ING', time2: 'GAN', grupo: 'L' },
  { id: 70, data: '2026-06-23', hora: '20h',   time1: 'PAN', time2: 'CRO', grupo: 'L' },
  { id: 71, data: '2026-06-27', hora: '18h',   time1: 'CRO', time2: 'GAN', grupo: 'L' },
  { id: 72, data: '2026-06-27', hora: '18h',   time1: 'PAN', time2: 'ING', grupo: 'L' },
];

// ════════════════════════════════════════════════════════════
// HELPERS DE HORÁRIO / TRAVA
// ════════════════════════════════════════════════════════════
function _kickoff(data, hora) {
  // Aceita '16h', '0h', '20h30', '21h30' (h30 antes de h).
  const partes = String(hora).replace('h30', ':30').replace('h', ':00').split(':');
  const h = parseInt(partes[0], 10) || 0;
  const m = parseInt(partes[1] || '0', 10) || 0;
  const iso = data + 'T' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00-03:00';
  return new Date(iso).getTime();
}
function _encerrado(data, hora) {
  return Date.now() >= _kickoff(data, hora) - ANTECEDENCIA_MS;
}
function palpiteEncerrado(jogo) { return _encerrado(jogo.data, jogo.hora); }

// Camada 1 trava antes do 1º jogo da 3ª rodada (os 2 últimos jogos de cada grupo).
function getTravaCamada1() {
  const porGrupo = {};
  JOGOS.forEach(j => { (porGrupo[j.grupo] = porGrupo[j.grupo] || []).push(j); });
  let menor = Infinity;
  Object.keys(porGrupo).forEach(g => {
    const ordenados = porGrupo[g].slice().sort((a, b) => _kickoff(a.data, a.hora) - _kickoff(b.data, b.hora));
    const rodada3 = ordenados.slice(-2); // 2 últimos = 3ª rodada
    rodada3.forEach(j => { menor = Math.min(menor, _kickoff(j.data, j.hora)); });
  });
  return menor - ANTECEDENCIA_MS;
}
function camada1Encerrada() { return Date.now() >= getTravaCamada1(); }

// ════════════════════════════════════════════════════════════
// PLANILHA — acesso e inicialização
// ════════════════════════════════════════════════════════════
function _ss() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function _aba(nome, cabecalho) {
  const ss = _ss();
  let aba = ss.getSheetByName(nome);
  if (!aba) {
    aba = ss.insertSheet(nome);
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
  }
  return aba;
}

const COLS_PART = ['ID','Nome','Email','Whatsapp','Salt','Hash','Status','DataInscricao','DataPagamento','GolsFinalPalpite','IsAdmin','Token','ResetCode','ResetExpira'];

function inicializar() {
  _aba('Participantes',      COLS_PART);
  _aba('PalpitesGrupos',     ['ParticipanteID','Dados','DataRegistro']);
  _aba('Bracket',            ['ParticipanteID','Dados','DataRegistro']);
  _aba('PalpitesMataMata',   ['ParticipanteID','JogoID','Gols1','Gols2','DataRegistro']);
  _aba('JogosMataMata',      ['JogoID','Fase','Data','Hora','Time1','Time2','Ordem','DataCriacao']);
  _aba('ResultadosGrupos',   ['JogoID','Gols1','Gols2','DataRegistro']);
  _aba('ResultadosMataMata', ['JogoID','Gols1','Gols2','Vencedor','DataRegistro']);
  return { ok: true, msg: 'Planilha v2 inicializada com sucesso.' };
}

// ════════════════════════════════════════════════════════════
// SEGURANÇA — hash de senha
// ════════════════════════════════════════════════════════════
function _gerarSalt() { return Utilities.getUuid().replace(/-/g, ''); }
function _hash(salt, senha) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + senha, Utilities.Charset.UTF_8);
  return bytes.map(b => ((b & 0xFF) + 0x100).toString(16).slice(1)).join('');
}
function _novoToken() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }

// ════════════════════════════════════════════════════════════
// ROTEADOR
// ════════════════════════════════════════════════════════════
function doPost(e) {
  let resultado;
  try {
    const body = JSON.parse(e.postData.contents);
    const a = body.action;

    // ── Autenticação / sessão ──
    if      (a === 'ping')             resultado = { ok: true, msg: 'pong', versao: 'v2.0' };
    else if (a === 'cadastrar')        resultado = cadastrar(body);
    else if (a === 'login')            resultado = login(body);
    else if (a === 'verificarSessao')  resultado = verificarSessao(body.token);
    else if (a === 'recuperarSenha')   resultado = recuperarSenha(body.email);
    else if (a === 'redefinirSenha')   resultado = redefinirSenha(body);
    // ── Jogos / resultados (público) ──
    else if (a === 'getJogos')                 resultado = { ok: true, jogos: JOGOS, travaCamada1: getTravaCamada1() };
    else if (a === 'getJogosMataMata')         resultado = getJogosMataMata();
    else if (a === 'getResultadosPublico')     resultado = getResultadosPublico();
    else if (a === 'getResultadosMataMataPublico') resultado = getResultadosMataMataPublico();
    else if (a === 'getClassificacaoReal')     resultado = { ok: true, classificacao: calcularClassificacaoReal() };
    // ── Camada 1 ──
    else if (a === 'salvarPalpiteGrupos')      resultado = salvarPalpiteGrupos(body);
    else if (a === 'getPalpiteGrupos')         resultado = getPalpiteGrupos(body.token);
    // ── Camada 2 ──
    else if (a === 'salvarBracket')            resultado = salvarBracket(body);
    else if (a === 'getBracket')               resultado = getBracket(body.token);
    else if (a === 'salvarGolsFinal')          resultado = salvarGolsFinal(body);
    // ── Camada 3 ──
    else if (a === 'salvarPalpitesMataMata')   resultado = salvarPalpitesMataMata(body);
    else if (a === 'getMeusPalpitesMataMata')  resultado = getMeusPalpitesMataMata(body.token);
    // ── Ranking / pontuação ──
    else if (a === 'getRanking')               resultado = getRanking();
    else if (a === 'getMinhaPontuacao')        resultado = getMinhaPontuacao(body.token);
    // ── Admin ──
    else if (a === 'adminLogin')               resultado = adminLogin(body.senha);
    else if (a === 'getParticipantes')         resultado = getParticipantes(body.senha);
    else if (a === 'aprovarParticipante')      resultado = aprovarParticipante(body);
    else if (a === 'criarJogoMataMata')        resultado = criarJogoMataMata(body);
    else if (a === 'excluirJogoMataMata')      resultado = excluirJogoMataMata(body);
    else if (a === 'salvarResultadoGrupo')     resultado = salvarResultadoGrupo(body);
    else if (a === 'salvarResultadoMataMata')  resultado = salvarResultadoMataMata(body);
    else if (a === 'getResultadosGruposAdmin') resultado = getResultadosGruposAdmin(body.senha);
    else if (a === 'getResultadosMataMataAdmin') resultado = getResultadosMataMataAdmin(body.senha);
    else if (a === 'getContagens')             resultado = getContagens(body.senha);
    else if (a === 'inicializar')              resultado = inicializar();
    else resultado = { ok: false, msg: 'Ação desconhecida: ' + a };
  } catch (err) {
    resultado = { ok: false, msg: 'Erro: ' + err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(resultado)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const a = e && e.parameter ? e.parameter.action : null;
  let resultado;
  if (a === 'getRanking')      resultado = getRanking();
  else if (a === 'getJogos')   resultado = { ok: true, jogos: JOGOS };
  else                         resultado = { ok: true, msg: 'Bolão Copa 2026 v2 — use POST.', versao: 'v2.0' };
  return ContentService.createTextOutput(JSON.stringify(resultado)).setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════
// AUTENTICAÇÃO
// ════════════════════════════════════════════════════════════
function _normEmail(e) { return String(e || '').trim().toLowerCase(); }

function _linhaPorEmail(email) {
  const aba = _aba('Participantes', COLS_PART);
  const dados = aba.getDataRange().getValues();
  email = _normEmail(email);
  for (let i = 1; i < dados.length; i++) {
    if (_normEmail(dados[i][2]) === email) return { aba, linha: i + 1, dados: dados[i] };
  }
  return null;
}
function _linhaPorToken(token) {
  if (!token) return null;
  const aba = _aba('Participantes', COLS_PART);
  const dados = aba.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][11] && dados[i][11] === token) return { aba, linha: i + 1, dados: dados[i] };
  }
  return null;
}
function _linhaPorId(id) {
  const aba = _aba('Participantes', COLS_PART);
  const dados = aba.getDataRange().getValues();
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][0] === id) return { aba, linha: i + 1, dados: dados[i] };
  }
  return null;
}
function _perfil(d) {
  return {
    id: d[0], nome: d[1], email: d[2], whatsapp: d[3],
    status: d[6], golsFinalPalpite: d[9], isAdmin: d[10] === true || d[10] === 'TRUE' || d[10] === 'SIM',
    token: d[11]
  };
}

function cadastrar(body) {
  const nome = String(body.nome || '').trim();
  const email = _normEmail(body.email);
  const whatsapp = String(body.whatsapp || '').trim();
  const senha = String(body.senha || '');
  const golsFinal = (body.golsFinal === '' || body.golsFinal == null) ? '' : parseInt(body.golsFinal, 10);

  if (!nome || !email || !whatsapp || !senha) return { ok: false, msg: 'Preencha todos os campos.' };
  if (email.indexOf('@') < 0) return { ok: false, msg: 'E-mail inválido.' };
  if (senha.length < 6) return { ok: false, msg: 'A senha precisa ter no mínimo 6 caracteres.' };
  if (_linhaPorEmail(email)) return { ok: false, msg: 'Este e-mail já está cadastrado. Faça login.' };

  const aba = _aba('Participantes', COLS_PART);
  const id = 'BC' + String(Date.now()).slice(-7);
  const salt = _gerarSalt();
  const hash = _hash(salt, senha);
  const token = _novoToken();
  const agora = new Date().toISOString();
  aba.appendRow([id, nome, email, whatsapp, salt, hash, 'PENDENTE', agora, '', golsFinal === '' || isNaN(golsFinal) ? '' : golsFinal, '', token, '', '']);
  return { ok: true, msg: 'Cadastro realizado! Conclua o pagamento.', token, perfil: { id, nome, email, whatsapp, status: 'PENDENTE', golsFinalPalpite: golsFinal, isAdmin: false } };
}

function login(body) {
  const email = _normEmail(body.email);
  const senha = String(body.senha || '');
  if (!email || !senha) return { ok: false, msg: 'Informe e-mail e senha.' };
  const r = _linhaPorEmail(email);
  if (!r) return { ok: false, msg: 'E-mail não encontrado.' };
  const salt = r.dados[4], hash = r.dados[5];
  if (!hash || _hash(salt, senha) !== hash) return { ok: false, msg: 'Senha incorreta.' };
  const token = _novoToken();
  r.aba.getRange(r.linha, 12).setValue(token); // coluna Token
  const perfil = _perfil(r.dados); perfil.token = token;
  return { ok: true, msg: 'Bem-vindo, ' + perfil.nome + '!', token, perfil };
}

function verificarSessao(token) {
  const r = _linhaPorToken(token);
  if (!r) return { ok: false, msg: 'Sessão expirada. Faça login novamente.' };
  return { ok: true, perfil: _perfil(r.dados) };
}

function recuperarSenha(email) {
  email = _normEmail(email);
  const r = _linhaPorEmail(email);
  // Resposta genérica para não revelar quais e-mails existem.
  const generico = { ok: true, msg: 'Se o e-mail estiver cadastrado, você receberá um código de redefinição.' };
  if (!r) return generico;
  const codigo = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
  const expira = Date.now() + 30 * 60 * 1000; // 30 min
  r.aba.getRange(r.linha, 13, 1, 2).setValues([[codigo, expira]]);
  try {
    MailApp.sendEmail({
      to: r.dados[2],
      subject: 'Bolão Copa 2026 — Código de redefinição de senha',
      htmlBody:
        '<p>Olá <b>' + r.dados[1] + '</b>,</p>' +
        '<p>Seu código para redefinir a senha do Bolão da Copa 2026 é:</p>' +
        '<p style="font-size:24px;font-weight:bold;letter-spacing:4px;color:#1A237E;">' + codigo + '</p>' +
        '<p>O código é válido por 30 minutos. Se você não solicitou, ignore este e-mail.</p>'
    });
  } catch (err) {
    return { ok: false, msg: 'Não foi possível enviar o e-mail: ' + err.message };
  }
  return generico;
}

function redefinirSenha(body) {
  const email = _normEmail(body.email);
  const codigo = String(body.codigo || '').trim();
  const novaSenha = String(body.novaSenha || '');
  if (novaSenha.length < 6) return { ok: false, msg: 'A nova senha precisa ter no mínimo 6 caracteres.' };
  const r = _linhaPorEmail(email);
  if (!r) return { ok: false, msg: 'E-mail não encontrado.' };
  const codSalvo = String(r.dados[12] || '');
  const expira = Number(r.dados[13] || 0);
  if (!codSalvo || codigo !== codSalvo) return { ok: false, msg: 'Código inválido.' };
  if (Date.now() > expira) return { ok: false, msg: 'Código expirado. Solicite um novo.' };
  const salt = _gerarSalt();
  const hash = _hash(salt, novaSenha);
  r.aba.getRange(r.linha, 5, 1, 2).setValues([[salt, hash]]); // Salt, Hash
  r.aba.getRange(r.linha, 13, 1, 2).setValues([['', '']]);     // limpa código
  return { ok: true, msg: 'Senha redefinida com sucesso! Faça login.' };
}

// ════════════════════════════════════════════════════════════
// CAMADA 1 — Classificação dos grupos
// ════════════════════════════════════════════════════════════
function salvarPalpiteGrupos(body) {
  const r = _linhaPorToken(body.token);
  if (!r) return { ok: false, msg: 'Sessão expirada.' };
  if (camada1Encerrada()) return { ok: false, msg: 'Os palpites da fase de grupos já estão encerrados (trava 23/jun).' };
  const dados = body.dados;
  if (!dados || !dados.grupos) return { ok: false, msg: 'Dados inválidos.' };

  const aba = _aba('PalpitesGrupos', ['ParticipanteID','Dados','DataRegistro']);
  const vals = aba.getDataRange().getValues();
  const agora = new Date().toISOString();
  const json = JSON.stringify(dados);
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === r.dados[0]) {
      aba.getRange(i + 1, 2, 1, 2).setValues([[json, agora]]);
      return { ok: true, msg: 'Palpite da fase de grupos salvo!' };
    }
  }
  aba.appendRow([r.dados[0], json, agora]);
  return { ok: true, msg: 'Palpite da fase de grupos salvo!' };
}

function getPalpiteGrupos(token) {
  const r = _linhaPorToken(token);
  if (!r) return { ok: false, msg: 'Sessão expirada.' };
  const aba = _aba('PalpitesGrupos', ['ParticipanteID','Dados','DataRegistro']);
  const vals = aba.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === r.dados[0]) {
      let d = {};
      try { d = JSON.parse(vals[i][1]); } catch (e) {}
      return { ok: true, dados: d, encerrado: camada1Encerrada(), trava: getTravaCamada1() };
    }
  }
  return { ok: true, dados: null, encerrado: camada1Encerrada(), trava: getTravaCamada1() };
}

// ── Classificação real dos grupos (FIFA) a partir dos resultados ──
function _statsGrupo(codes, jogosG, mapRes) {
  const st = {};
  codes.forEach(c => st[c] = { code: c, pts: 0, j: 0, v: 0, e: 0, d: 0, gf: 0, ga: 0, sg: 0 });
  jogosG.forEach(j => {
    const r = mapRes[j.id];
    if (!r) return;
    const g1 = parseInt(r.gols1), g2 = parseInt(r.gols2);
    if (isNaN(g1) || isNaN(g2)) return;
    const a = st[j.time1], b = st[j.time2];
    if (!a || !b) return;
    a.j++; b.j++; a.gf += g1; a.ga += g2; b.gf += g2; b.ga += g1;
    if (g1 > g2) { a.v++; a.pts += 3; b.d++; }
    else if (g2 > g1) { b.v++; b.pts += 3; a.d++; }
    else { a.e++; b.e++; a.pts++; b.pts++; }
  });
  Object.keys(st).forEach(k => st[k].sg = st[k].gf - st[k].ga);
  return st;
}
function _ordenarGrupo(arr, jogosG, mapRes) {
  const cmp = (a, b) => b.pts - a.pts || b.sg - a.sg || b.gf - a.gf;
  arr = arr.slice().sort(cmp);
  const out = [];
  let i = 0;
  while (i < arr.length) {
    let k = i + 1;
    while (k < arr.length && arr[k].pts === arr[i].pts && arr[k].sg === arr[i].sg && arr[k].gf === arr[i].gf) k++;
    const emp = arr.slice(i, k);
    if (emp.length > 1) {
      const codes = emp.map(t => t.code);
      const jogosH2H = jogosG.filter(g => codes.indexOf(g.time1) >= 0 && codes.indexOf(g.time2) >= 0);
      const h2h = _statsGrupo(codes, jogosH2H, mapRes);
      emp.sort((a, b) => {
        const ha = h2h[a.code], hb = h2h[b.code];
        return hb.pts - ha.pts || hb.sg - ha.sg || hb.gf - ha.gf || a.code.localeCompare(b.code);
      });
    }
    out.push.apply(out, emp);
    i = k;
  }
  return out;
}
function calcularClassificacaoReal() {
  const mapRes = _mapResultadosGrupos();
  const grupos = {};
  JOGOS.forEach(j => {
    if (!grupos[j.grupo]) grupos[j.grupo] = { codes: [], jogos: [] };
    [j.time1, j.time2].forEach(t => { if (grupos[j.grupo].codes.indexOf(t) < 0) grupos[j.grupo].codes.push(t); });
    grupos[j.grupo].jogos.push(j);
  });

  const porGrupo = {};
  const terceiros = [];
  Object.keys(grupos).sort().forEach(g => {
    const st = _statsGrupo(grupos[g].codes, grupos[g].jogos, mapRes);
    const ord = _ordenarGrupo(Object.keys(st).map(k => st[k]), grupos[g].jogos, mapRes);
    const completo = grupos[g].jogos.every(j => mapRes[j.id]);
    porGrupo[g] = {
      completo,
      pos1: ord[0] ? ord[0].code : null,
      pos2: ord[1] ? ord[1].code : null,
      pos3: ord[2] ? ord[2].code : null,
      tabela: ord
    };
    if (completo && ord[2]) terceiros.push({ grupo: g, code: ord[2].code, pts: ord[2].pts, sg: ord[2].sg, gf: ord[2].gf, ga: ord[2].ga });
  });

  // 8 melhores terceiros (todos os grupos precisam estar completos para fechar)
  const todosCompletos = Object.keys(porGrupo).every(g => porGrupo[g].completo);
  terceiros.sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.gf - a.gf || a.code.localeCompare(b.code));
  const melhoresTerceiros = (todosCompletos ? terceiros.slice(0, 8) : []).map(t => t.code);

  return { porGrupo, melhoresTerceiros, todosCompletos };
}

function _pontosCamada1(palp, classif) {
  // palp = { grupos: {A:{pos1,pos2,pos3},...}, terceiros:[...] }
  let pontos = 0, posExatas = 0;
  const det = { porGrupo: {}, terceiros: [] };
  if (!palp || !palp.grupos) return { pontos: 0, posExatas: 0, det };

  Object.keys(classif.porGrupo).forEach(g => {
    const real = classif.porGrupo[g];
    const meu = palp.grupos[g] || {};
    if (!real.completo) { det.porGrupo[g] = null; return; }
    const avancaram = [real.pos1, real.pos2];
    let p = 0;
    // pos1
    if (meu.pos1) {
      if (meu.pos1 === real.pos1) { p += 5; posExatas++; }
      else if (avancaram.indexOf(meu.pos1) >= 0) p += 3;
    }
    // pos2
    if (meu.pos2) {
      if (meu.pos2 === real.pos2) { p += 5; posExatas++; }
      else if (avancaram.indexOf(meu.pos2) >= 0) p += 3;
    }
    det.porGrupo[g] = { pontos: p, real };
    pontos += p;
  });

  // 8 terceiros
  if (classif.todosCompletos && palp.terceiros) {
    const reais = classif.melhoresTerceiros;
    palp.terceiros.forEach(code => {
      const acerto = reais.indexOf(code) >= 0;
      if (acerto) { pontos += 2; det.terceiros.push({ code, acerto: true }); }
      else det.terceiros.push({ code, acerto: false });
    });
  }
  return { pontos, posExatas, det };
}

// ════════════════════════════════════════════════════════════
// CAMADA 2 — Bracket (quem avança) + gols da final
// ════════════════════════════════════════════════════════════
function _jogosMataMata() {
  const aba = _aba('JogosMataMata', ['JogoID','Fase','Data','Hora','Time1','Time2','Ordem','DataCriacao']);
  const vals = aba.getDataRange().getValues();
  const lista = [];
  for (let i = 1; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    lista.push({ id: String(vals[i][0]), fase: vals[i][1], data: vals[i][2], hora: vals[i][3], time1: vals[i][4], time2: vals[i][5], ordem: vals[i][6] });
  }
  lista.sort((a, b) => (FASES[a.fase] ? FASES[a.fase].ordem : 9) - (FASES[b.fase] ? FASES[b.fase].ordem : 9) || _kickoff(a.data, a.hora) - _kickoff(b.data, b.hora));
  return lista;
}
// Trava de cada fase = 1º jogo da fase - antecedência. {fase: timestampTrava}
function _travasPorFase(jogos) {
  const travas = {};
  jogos.forEach(j => {
    const k = _kickoff(j.data, j.hora) - ANTECEDENCIA_MS;
    if (travas[j.fase] == null || k < travas[j.fase]) travas[j.fase] = k;
  });
  return travas;
}
function getJogosMataMata() {
  const jogos = _jogosMataMata();
  const travas = _travasPorFase(jogos);
  const agora = Date.now();
  const fasesEncerradas = {};
  Object.keys(travas).forEach(f => fasesEncerradas[f] = agora >= travas[f]);
  return { ok: true, jogos, travas, fasesEncerradas, resultados: _mapResultadosMataMata(), fases: FASES };
}

// Trava dos gols da final = 1º jogo do mata-mata - antecedência (≈28/jun).
function getTravaGolsFinal() {
  const jogos = _jogosMataMata();
  if (!jogos.length) return Infinity;
  let menor = Infinity;
  jogos.forEach(j => { menor = Math.min(menor, _kickoff(j.data, j.hora)); });
  return menor - ANTECEDENCIA_MS;
}

function salvarBracket(body) {
  const r = _linhaPorToken(body.token);
  if (!r) return { ok: false, msg: 'Sessão expirada.' };
  const picks = body.picks || {}; // { jogoId: sigla }
  const jogos = _jogosMataMata();
  const travas = _travasPorFase(jogos);
  const agora = Date.now();
  const faseDoJogo = {};
  jogos.forEach(j => faseDoJogo[j.id] = j.fase);

  const aba = _aba('Bracket', ['ParticipanteID','Dados','DataRegistro']);
  const vals = aba.getDataRange().getValues();
  let atual = {};
  let linhaExistente = -1;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === r.dados[0]) { try { atual = JSON.parse(vals[i][1]) || {}; } catch (e) {} linhaExistente = i + 1; break; }
  }

  let aceitos = 0, recusados = 0;
  Object.keys(picks).forEach(jid => {
    const fase = faseDoJogo[jid];
    if (!fase) { recusados++; return; }
    const travada = travas[fase] != null && agora >= travas[fase];
    if (travada) { recusados++; return; }
    atual[jid] = picks[jid];
    aceitos++;
  });

  const agoraIso = new Date().toISOString();
  const json = JSON.stringify(atual);
  if (linhaExistente > 0) aba.getRange(linhaExistente, 2, 1, 2).setValues([[json, agoraIso]]);
  else aba.appendRow([r.dados[0], json, agoraIso]);

  let msg = aceitos + ' palpite(s) salvos.';
  if (recusados > 0) msg += ' ' + recusados + ' ignorado(s) (fase já travada).';
  return { ok: true, msg };
}

function getBracket(token) {
  const r = _linhaPorToken(token);
  if (!r) return { ok: false, msg: 'Sessão expirada.' };
  const aba = _aba('Bracket', ['ParticipanteID','Dados','DataRegistro']);
  const vals = aba.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === r.dados[0]) {
      let d = {}; try { d = JSON.parse(vals[i][1]) || {}; } catch (e) {}
      return { ok: true, picks: d, golsFinalPalpite: r.dados[9] };
    }
  }
  return { ok: true, picks: {}, golsFinalPalpite: r.dados[9] };
}

function salvarGolsFinal(body) {
  const r = _linhaPorToken(body.token);
  if (!r) return { ok: false, msg: 'Sessão expirada.' };
  if (Date.now() >= getTravaGolsFinal()) return { ok: false, msg: 'O palpite de gols da final já está travado (início do mata-mata).' };
  const gols = parseInt(body.gols, 10);
  if (isNaN(gols) || gols < 0) return { ok: false, msg: 'Informe um número de gols válido.' };
  r.aba.getRange(r.linha, 10).setValue(gols); // GolsFinalPalpite
  return { ok: true, msg: 'Palpite de gols da final salvo!' };
}

// ════════════════════════════════════════════════════════════
// CAMADA 3 — Placares do mata-mata
// ════════════════════════════════════════════════════════════
function calcularPontos(palp1, palp2, real1, real2) {
  palp1 = parseInt(palp1); palp2 = parseInt(palp2);
  real1 = parseInt(real1); real2 = parseInt(real2);
  if (isNaN(palp1) || isNaN(palp2) || isNaN(real1) || isNaN(real2)) return 0;
  const a1 = palp1 === real1, a2 = palp2 === real2;
  if (a1 && a2) return 15;
  if (real1 === real2 && (a1 || a2)) return 7.5;
  if (real1 > real2 && a1) return 10;
  if (real2 > real1 && a2) return 10;
  if (real1 > real2 && a2) return 5;
  if (real2 > real1 && a1) return 5;
  return 0;
}

function salvarPalpitesMataMata(body) {
  const r = _linhaPorToken(body.token);
  if (!r) return { ok: false, msg: 'Sessão expirada.' };
  const palpites = body.palpites || [];
  const jogos = _jogosMataMata();
  const mapJogos = {}; jogos.forEach(j => mapJogos[j.id] = j);
  const abertos = new Set();
  jogos.forEach(j => { if (!_encerrado(j.data, j.hora)) abertos.add(j.id); });

  const validos = palpites.filter(p => abertos.has(String(p.jogoId)));
  const recusados = palpites.length - validos.length;

  const aba = _aba('PalpitesMataMata', ['ParticipanteID','JogoID','Gols1','Gols2','DataRegistro']);
  const vals = aba.getDataRange().getValues();
  for (let i = vals.length - 1; i >= 1; i--) {
    if (vals[i][0] === r.dados[0] && abertos.has(String(vals[i][1]))) aba.deleteRow(i + 1);
  }
  const agora = new Date().toISOString();
  validos.forEach(p => aba.appendRow([r.dados[0], String(p.jogoId), p.gols1, p.gols2, agora]));

  let msg = 'Palpites salvos com sucesso!';
  if (recusados > 0) msg = 'Palpites salvos. ' + recusados + ' ignorado(s) (jogo já iniciado).';
  return { ok: true, msg };
}

function getMeusPalpitesMataMata(token) {
  const r = _linhaPorToken(token);
  if (!r) return { ok: false, msg: 'Sessão expirada.' };
  const aba = _aba('PalpitesMataMata', ['ParticipanteID','JogoID','Gols1','Gols2','DataRegistro']);
  const vals = aba.getDataRange().getValues();
  const lista = [];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === r.dados[0]) lista.push({ jogoId: String(vals[i][1]), gols1: vals[i][2], gols2: vals[i][3] });
  }
  return { ok: true, palpites: lista };
}

// ════════════════════════════════════════════════════════════
// RESULTADOS
// ════════════════════════════════════════════════════════════
function _mapResultadosGrupos() {
  const aba = _aba('ResultadosGrupos', ['JogoID','Gols1','Gols2','DataRegistro']);
  const vals = aba.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === '' || vals[i][0] == null) continue;
    map[vals[i][0]] = { gols1: vals[i][1], gols2: vals[i][2] };
  }
  return map;
}
function _mapResultadosMataMata() {
  const aba = _aba('ResultadosMataMata', ['JogoID','Gols1','Gols2','Vencedor','DataRegistro']);
  const vals = aba.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === '' || vals[i][0] == null) continue;
    map[String(vals[i][0])] = { gols1: vals[i][1], gols2: vals[i][2], vencedor: vals[i][3] };
  }
  return map;
}
function getResultadosPublico() { return { ok: true, resultados: _mapResultadosGrupos() }; }
function getResultadosMataMataPublico() { return { ok: true, resultados: _mapResultadosMataMata() }; }

// ════════════════════════════════════════════════════════════
// RANKING — soma das 3 camadas + desempates
// ════════════════════════════════════════════════════════════
function _pontuarParticipante(pid, classif, jogosMM, mapResMM, bracket, palpMM, golsFinalPalpite, golsFinalReal) {
  // Camada 1
  const c1 = _pontosCamada1(classif._palpitesPorPid ? classif._palpitesPorPid[pid] : null, classif);

  // Camada 2 — quem avança
  let c2 = 0, c2FasesFinais = 0, acertouCampeao = false;
  const meuBracket = bracket || {};
  jogosMM.forEach(j => {
    const res = mapResMM[j.id];
    if (!res || !res.vencedor) return;
    const pick = meuBracket[j.id];
    if (!pick) return;
    if (pick === res.vencedor) {
      const pts = FASES[j.fase] ? FASES[j.fase].pontos : 0;
      c2 += pts;
      if (j.fase === 'semis' || j.fase === 'final') c2FasesFinais += pts;
      if (j.fase === 'final') acertouCampeao = true;
    }
  });

  // Camada 3 — placares
  let c3 = 0, placaresExatos = 0;
  const meusPalp = palpMM || {};
  jogosMM.forEach(j => {
    const res = mapResMM[j.id];
    const p = meusPalp[j.id];
    if (!res || !p) return;
    const pts = calcularPontos(p.gols1, p.gols2, res.gols1, res.gols2);
    c3 += pts;
    if (pts === 15) placaresExatos++;
  });

  // Desempate 5 — proximidade do total de gols da final
  let difGolsFinal = null;
  if (golsFinalReal != null && golsFinalPalpite !== '' && golsFinalPalpite != null && !isNaN(parseInt(golsFinalPalpite))) {
    difGolsFinal = Math.abs(parseInt(golsFinalPalpite) - golsFinalReal);
  }

  return {
    c1: c1.pontos, c2, c3, total: c1.pontos + c2 + c3,
    placaresExatos, acertouCampeao, c2FasesFinais, posExatasGrupos: c1.posExatas, difGolsFinal
  };
}

function getRanking() {
  const abaPart = _aba('Participantes', COLS_PART);
  const partVals = abaPart.getDataRange().getValues();

  const classif = calcularClassificacaoReal();
  // palpites de grupos por participante
  const abaPG = _aba('PalpitesGrupos', ['ParticipanteID','Dados','DataRegistro']);
  const pgVals = abaPG.getDataRange().getValues();
  classif._palpitesPorPid = {};
  for (let i = 1; i < pgVals.length; i++) {
    try { classif._palpitesPorPid[pgVals[i][0]] = JSON.parse(pgVals[i][1]); } catch (e) {}
  }

  const jogosMM = _jogosMataMata();
  const mapResMM = _mapResultadosMataMata();

  // brackets por pid
  const abaBr = _aba('Bracket', ['ParticipanteID','Dados','DataRegistro']);
  const brVals = abaBr.getDataRange().getValues();
  const bracketPorPid = {};
  for (let i = 1; i < brVals.length; i++) {
    try { bracketPorPid[brVals[i][0]] = JSON.parse(brVals[i][1]); } catch (e) {}
  }

  // palpites mata-mata por pid
  const abaPM = _aba('PalpitesMataMata', ['ParticipanteID','JogoID','Gols1','Gols2','DataRegistro']);
  const pmVals = abaPM.getDataRange().getValues();
  const palpMMPorPid = {};
  for (let i = 1; i < pmVals.length; i++) {
    const pid = pmVals[i][0];
    if (!pid) continue;
    if (!palpMMPorPid[pid]) palpMMPorPid[pid] = {};
    palpMMPorPid[pid][String(pmVals[i][1])] = { gols1: pmVals[i][2], gols2: pmVals[i][3] };
  }

  // gols reais da final
  const jogoFinal = jogosMM.filter(j => j.fase === 'final')[0];
  let golsFinalReal = null;
  if (jogoFinal && mapResMM[jogoFinal.id]) {
    const f = mapResMM[jogoFinal.id];
    const g1 = parseInt(f.gols1), g2 = parseInt(f.gols2);
    if (!isNaN(g1) && !isNaN(g2)) golsFinalReal = g1 + g2;
  }

  const ranking = [];
  let totalArrecadado = 0;
  for (let i = 1; i < partVals.length; i++) {
    const d = partVals[i];
    const pid = d[0], nome = d[1], status = d[6], dataInscricao = d[7], golsFinalPalpite = d[9];
    if (status === 'APROVADO') totalArrecadado += VALOR_INSCRICAO;
    if (status !== 'APROVADO') continue;

    const p = _pontuarParticipante(pid, classif, jogosMM, mapResMM, bracketPorPid[pid], palpMMPorPid[pid], golsFinalPalpite, golsFinalReal);
    ranking.push({
      id: pid, nome, dataInscricao,
      c1: p.c1, c2: p.c2, c3: p.c3, pontos: p.total,
      placaresExatos: p.placaresExatos, acertouCampeao: p.acertouCampeao,
      c2FasesFinais: p.c2FasesFinais, posExatasGrupos: p.posExatasGrupos,
      difGolsFinal: p.difGolsFinal
    });
  }

  // Desempate (seção 6): exatos → campeão → fases finais → pos exatas grupos → gols final → inscrição
  ranking.sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    if (b.placaresExatos !== a.placaresExatos) return b.placaresExatos - a.placaresExatos;
    if ((b.acertouCampeao ? 1 : 0) !== (a.acertouCampeao ? 1 : 0)) return (b.acertouCampeao ? 1 : 0) - (a.acertouCampeao ? 1 : 0);
    if (b.c2FasesFinais !== a.c2FasesFinais) return b.c2FasesFinais - a.c2FasesFinais;
    if (b.posExatasGrupos !== a.posExatasGrupos) return b.posExatasGrupos - a.posExatasGrupos;
    const da = a.difGolsFinal == null ? Infinity : a.difGolsFinal;
    const db = b.difGolsFinal == null ? Infinity : b.difGolsFinal;
    if (da !== db) return da - db;
    return new Date(a.dataInscricao) - new Date(b.dataInscricao);
  });
  ranking.forEach((r, idx) => r.posicao = idx + 1);

  return {
    ok: true, ranking,
    totalParticipantes: ranking.length,
    totalArrecadado,
    premiacao: {
      campeao: totalArrecadado * PREMIO_CAMPEAO,
      vice: totalArrecadado * PREMIO_VICE,
      organizacao: totalArrecadado * PREMIO_ORG
    },
    jogosMataMataApurados: Object.keys(mapResMM).length,
    totalJogosMataMata: jogosMM.length,
    valorInscricao: VALOR_INSCRICAO
  };
}

// ════════════════════════════════════════════════════════════
// MINHA PONTUAÇÃO — detalhamento por camada
// ════════════════════════════════════════════════════════════
function getMinhaPontuacao(token) {
  const r = _linhaPorToken(token);
  if (!r) return { ok: false, msg: 'Sessão expirada.' };
  const pid = r.dados[0];
  const aprovado = r.dados[6] === 'APROVADO';

  const classif = calcularClassificacaoReal();
  let palpGrupos = null;
  const abaPG = _aba('PalpitesGrupos', ['ParticipanteID','Dados','DataRegistro']);
  const pgVals = abaPG.getDataRange().getValues();
  for (let i = 1; i < pgVals.length; i++) if (pgVals[i][0] === pid) { try { palpGrupos = JSON.parse(pgVals[i][1]); } catch (e) {} }

  const c1 = _pontosCamada1(palpGrupos, classif);

  const jogosMM = _jogosMataMata();
  const mapResMM = _mapResultadosMataMata();
  const br = getBracket(token);
  const meuBracket = br.ok ? br.picks : {};
  const palpMMres = getMeusPalpitesMataMata(token);
  const meusPalpMM = {};
  if (palpMMres.ok) palpMMres.palpites.forEach(p => meusPalpMM[p.jogoId] = { gols1: p.gols1, gols2: p.gols2 });

  let c2 = 0, c3 = 0;
  const mmDetalhe = jogosMM.map(j => {
    const res = mapResMM[j.id];
    const pick = meuBracket[j.id] || null;
    const palp = meusPalpMM[j.id] || null;
    let ptsAvanca = null, ptsPlacar = null;
    if (res && res.vencedor && pick) { ptsAvanca = (pick === res.vencedor) ? (FASES[j.fase] ? FASES[j.fase].pontos : 0) : 0; if (aprovado) c2 += ptsAvanca; }
    if (res && palp) { ptsPlacar = calcularPontos(palp.gols1, palp.gols2, res.gols1, res.gols2); if (aprovado) c3 += ptsPlacar; }
    return { id: j.id, fase: j.fase, faseLabel: FASES[j.fase] ? FASES[j.fase].label : j.fase, data: j.data, hora: j.hora, time1: j.time1, time2: j.time2, pick, palp, real: res || null, ptsAvanca, ptsPlacar };
  });

  const c1pts = aprovado ? c1.pontos : 0;
  const total = c1pts + c2 + c3;

  // posição no ranking
  let posicao = null, totalParticipantes = 0;
  if (aprovado) {
    const rk = getRanking();
    if (rk.ok) { totalParticipantes = rk.totalParticipantes; const e = rk.ranking.filter(x => x.id === pid)[0]; if (e) posicao = e.posicao; }
  }

  return {
    ok: true,
    participante: { id: pid, nome: r.dados[1], status: r.dados[6] },
    aprovado,
    camada1: { pontos: c1pts, detalhe: c1.det, posExatas: c1.posExatas, encerrada: camada1Encerrada() },
    camada2: { pontos: c2 },
    camada3: { pontos: c3 },
    totalPontos: total,
    mataMata: mmDetalhe,
    classificacaoReal: classif,
    posicao, totalParticipantes
  };
}

// ════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════
function _adminOk(senha) { return senha === ADMIN_PASSWORD; }
function adminLogin(senha) { return _adminOk(senha) ? { ok: true } : { ok: false, msg: 'Senha incorreta.' }; }

function getParticipantes(senha) {
  if (!_adminOk(senha)) return { ok: false, msg: 'Acesso negado.' };
  const aba = _aba('Participantes', COLS_PART);
  const d = aba.getDataRange().getValues();
  const lista = [];
  for (let i = 1; i < d.length; i++) {
    if (!d[i][0]) continue;
    lista.push({ id: d[i][0], nome: d[i][1], email: d[i][2], whatsapp: d[i][3], status: d[i][6], dataInscricao: d[i][7], dataPagamento: d[i][8], golsFinalPalpite: d[i][9] });
  }
  return { ok: true, participantes: lista };
}

function aprovarParticipante(body) {
  if (!_adminOk(body.senha)) return { ok: false, msg: 'Acesso negado.' };
  const r = _linhaPorId(body.id);
  if (!r) return { ok: false, msg: 'Participante não encontrado.' };
  r.aba.getRange(r.linha, 7).setValue(body.status); // Status
  if (body.status === 'APROVADO') r.aba.getRange(r.linha, 9).setValue(new Date().toISOString());
  return { ok: true, msg: 'Participante ' + body.status + '.' };
}

function criarJogoMataMata(body) {
  if (!_adminOk(body.senha)) return { ok: false, msg: 'Acesso negado.' };
  const { fase, data, hora, time1, time2 } = body;
  if (!fase || !FASES[fase]) return { ok: false, msg: 'Fase inválida.' };
  if (!data || !hora || !time1 || !time2) return { ok: false, msg: 'Preencha fase, data, hora e as duas seleções.' };
  const aba = _aba('JogosMataMata', ['JogoID','Fase','Data','Hora','Time1','Time2','Ordem','DataCriacao']);
  const id = body.id || ('MM' + String(Date.now()).slice(-8));
  // edição: se já existe id, atualiza
  const vals = aba.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(id)) {
      aba.getRange(i + 1, 2, 1, 5).setValues([[fase, data, hora, time1, time2]]);
      return { ok: true, msg: 'Confronto atualizado.', id };
    }
  }
  const ordem = (FASES[fase].ordem * 100) + (vals.length);
  aba.appendRow([id, fase, data, hora, time1, time2, ordem, new Date().toISOString()]);
  return { ok: true, msg: 'Confronto criado.', id };
}

function excluirJogoMataMata(body) {
  if (!_adminOk(body.senha)) return { ok: false, msg: 'Acesso negado.' };
  const aba = _aba('JogosMataMata', ['JogoID','Fase','Data','Hora','Time1','Time2','Ordem','DataCriacao']);
  const vals = aba.getDataRange().getValues();
  for (let i = vals.length - 1; i >= 1; i--) {
    if (String(vals[i][0]) === String(body.id)) { aba.deleteRow(i + 1); return { ok: true, msg: 'Confronto excluído.' }; }
  }
  return { ok: false, msg: 'Confronto não encontrado.' };
}

function salvarResultadoGrupo(body) {
  if (!_adminOk(body.senha)) return { ok: false, msg: 'Acesso negado.' };
  const aba = _aba('ResultadosGrupos', ['JogoID','Gols1','Gols2','DataRegistro']);
  const vals = aba.getDataRange().getValues();
  const agora = new Date().toISOString();
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === body.jogoId) { aba.getRange(i + 1, 2, 1, 3).setValues([[body.gols1, body.gols2, agora]]); return { ok: true, msg: 'Resultado atualizado.' }; }
  }
  aba.appendRow([body.jogoId, body.gols1, body.gols2, agora]);
  return { ok: true, msg: 'Resultado registrado.' };
}

function salvarResultadoMataMata(body) {
  if (!_adminOk(body.senha)) return { ok: false, msg: 'Acesso negado.' };
  const g1 = parseInt(body.gols1), g2 = parseInt(body.gols2);
  let vencedor = body.vencedor || '';
  if (!vencedor) {
    if (g1 > g2) vencedor = body.time1;
    else if (g2 > g1) vencedor = body.time2;
  }
  if (g1 === g2 && !vencedor) return { ok: false, msg: 'Empate: informe quem avançou (pênaltis/prorrogação).' };
  const aba = _aba('ResultadosMataMata', ['JogoID','Gols1','Gols2','Vencedor','DataRegistro']);
  const vals = aba.getDataRange().getValues();
  const agora = new Date().toISOString();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(body.jogoId)) { aba.getRange(i + 1, 2, 1, 4).setValues([[body.gols1, body.gols2, vencedor, agora]]); return { ok: true, msg: 'Resultado atualizado.' }; }
  }
  aba.appendRow([String(body.jogoId), body.gols1, body.gols2, vencedor, agora]);
  return { ok: true, msg: 'Resultado registrado.' };
}

function getResultadosGruposAdmin(senha) {
  if (!_adminOk(senha)) return { ok: false, msg: 'Acesso negado.' };
  return { ok: true, resultados: _mapResultadosGrupos() };
}
function getResultadosMataMataAdmin(senha) {
  if (!_adminOk(senha)) return { ok: false, msg: 'Acesso negado.' };
  return { ok: true, resultados: _mapResultadosMataMata() };
}

// Contagens p/ relatórios do admin (quantos preencheram cada camada)
function getContagens(senha) {
  if (!_adminOk(senha)) return { ok: false, msg: 'Acesso negado.' };
  const cont = { grupos: {}, bracket: {}, mataMata: {} };
  const pg = _aba('PalpitesGrupos', ['ParticipanteID','Dados','DataRegistro']).getDataRange().getValues();
  for (let i = 1; i < pg.length; i++) if (pg[i][0]) cont.grupos[pg[i][0]] = 1;
  const br = _aba('Bracket', ['ParticipanteID','Dados','DataRegistro']).getDataRange().getValues();
  for (let i = 1; i < br.length; i++) {
    if (!br[i][0]) continue;
    let d = {}; try { d = JSON.parse(br[i][1]) || {}; } catch (e) {}
    cont.bracket[br[i][0]] = Object.keys(d).length;
  }
  const pm = _aba('PalpitesMataMata', ['ParticipanteID','JogoID','Gols1','Gols2','DataRegistro']).getDataRange().getValues();
  for (let i = 1; i < pm.length; i++) { const pid = pm[i][0]; if (!pid) continue; cont.mataMata[pid] = (cont.mataMata[pid] || 0) + 1; }
  return { ok: true, contagens: cont };
}
