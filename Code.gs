// ============================================================
// BOLÃO DA COPA 2026 — v2.0 — Google Apps Script Backend
// ============================================================
// Três camadas de pontuação independentes:
//   Camada 1 — Classificação da fase de grupos (1º/2º + 8 terceiros)
//   Camada 2 — Quem avança no mata-mata (trava POR FASE)
//   Camada 3 — Placares do mata-mata (corte por jogo, igual à v1)
// Autenticação: e-mail + senha (SHA-256 com salt por usuário).
//
// COMO PUBLICAR (recomendado: script VINCULADO à planilha):
// 1. Abra a planilha → Extensões → Apps Script → cole este arquivo.
//    (Vinculado, NÃO precisa preencher SPREADSHEET_ID — ele detecta sozinho.)
// 2. Defina ADMIN_PASSWORD abaixo.
// 3. Rode a função inicializar() uma vez (autorize o acesso) — cria todas as abas.
// 4. Implantar → Nova implantação → App da Web
//      Executar como: Eu   ·   Quem tem acesso: Qualquer pessoa (Anyone)
// 5. Copie a URL /exec e cole em config.js (CONFIG.API_URL).
// 6. A cada alteração aqui, publique NOVA VERSÃO da implantação.
//
// Alternativa (projeto separado em script.google.com): preencha SPREADSHEET_ID
// com o ID da planilha (parte da URL entre /d/ e /edit).
// ============================================================

// Deixe como está se o script estiver VINCULADO à planilha (Extensões → Apps Script).
// Só preencha se usar um projeto separado/standalone.
const SPREADSHEET_ID = '';                         // ← vinculado: deixe vazio. Standalone: cole o ID.
const ADMIN_PASSWORD = 'DEFINA_UMA_SENHA_FORTE';   // ← defina no editor (NÃO versionar a senha real)

// URL do Web App da v1 (fase de grupos). A v2 puxa daqui os resultados reais
// dos grupos automaticamente (mesmos IDs 1..72), evitando re-lançar placares.
const V1_API_URL = 'https://script.google.com/macros/s/AKfycbyZEHNn7NmtJk1IMUfiKSVbpMcTie2ZrIG2cygqj6I_MhBWdZjtR8gJibIRL4AMn-FsRg/exec';

const VALOR_INSCRICAO = 50;   // R$ — nova taxa da v2 (fase eliminatória)
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
// CHAVEAMENTO OFICIAL — Copa 2026 (estrutura FIFA, horários de Brasília)
// Cada lado: {t:'W',g}=1º grupo · {t:'R',g}=2º grupo · {t:'3',slot,grupos}=melhor 3º
//            {t:'V',m}=vencedor do jogo m · {t:'L',m}=perdedor do jogo m
// ────────────────────────────────────────────────────────────
const BRACKET = [
  // Rodada de 32 (jogos 73–88)
  { n:73, fase:'32', data:'2026-06-28', hora:'16h',   l1:{t:'R',g:'A'}, l2:{t:'R',g:'B'} },
  { n:74, fase:'32', data:'2026-06-29', hora:'17h30', l1:{t:'W',g:'E'}, l2:{t:'3',slot:74,grupos:['A','B','C','D','F']} },
  { n:75, fase:'32', data:'2026-06-29', hora:'22h',   l1:{t:'W',g:'F'}, l2:{t:'R',g:'C'} },
  { n:76, fase:'32', data:'2026-06-29', hora:'14h',   l1:{t:'W',g:'C'}, l2:{t:'R',g:'F'} },
  { n:77, fase:'32', data:'2026-06-30', hora:'18h',   l1:{t:'W',g:'I'}, l2:{t:'3',slot:77,grupos:['C','D','F','G','H']} },
  { n:78, fase:'32', data:'2026-06-30', hora:'14h',   l1:{t:'R',g:'E'}, l2:{t:'R',g:'I'} },
  { n:79, fase:'32', data:'2026-06-30', hora:'22h',   l1:{t:'W',g:'A'}, l2:{t:'3',slot:79,grupos:['C','E','F','H','I']} },
  { n:80, fase:'32', data:'2026-07-01', hora:'13h',   l1:{t:'W',g:'L'}, l2:{t:'3',slot:80,grupos:['E','H','I','J','K']} },
  { n:81, fase:'32', data:'2026-07-01', hora:'21h',   l1:{t:'W',g:'D'}, l2:{t:'3',slot:81,grupos:['B','E','F','I','J']} },
  { n:82, fase:'32', data:'2026-07-01', hora:'17h',   l1:{t:'W',g:'G'}, l2:{t:'3',slot:82,grupos:['A','E','H','I','J']} },
  { n:83, fase:'32', data:'2026-07-02', hora:'20h',   l1:{t:'R',g:'K'}, l2:{t:'R',g:'L'} },
  { n:84, fase:'32', data:'2026-07-02', hora:'16h',   l1:{t:'W',g:'H'}, l2:{t:'R',g:'J'} },
  { n:85, fase:'32', data:'2026-07-03', hora:'0h',    l1:{t:'W',g:'B'}, l2:{t:'3',slot:85,grupos:['E','F','G','I','J']} },
  { n:86, fase:'32', data:'2026-07-03', hora:'19h',   l1:{t:'W',g:'J'}, l2:{t:'R',g:'H'} },
  { n:87, fase:'32', data:'2026-07-03', hora:'22h30', l1:{t:'W',g:'K'}, l2:{t:'3',slot:87,grupos:['D','E','I','J','L']} },
  { n:88, fase:'32', data:'2026-07-03', hora:'15h',   l1:{t:'R',g:'D'}, l2:{t:'R',g:'G'} },
  // Oitavas (89–96)
  { n:89, fase:'oitavas', data:'2026-07-04', hora:'18h', l1:{t:'V',m:74}, l2:{t:'V',m:77} },
  { n:90, fase:'oitavas', data:'2026-07-04', hora:'14h', l1:{t:'V',m:73}, l2:{t:'V',m:75} },
  { n:91, fase:'oitavas', data:'2026-07-05', hora:'17h', l1:{t:'V',m:76}, l2:{t:'V',m:78} },
  { n:92, fase:'oitavas', data:'2026-07-05', hora:'21h', l1:{t:'V',m:79}, l2:{t:'V',m:80} },
  { n:93, fase:'oitavas', data:'2026-07-06', hora:'16h', l1:{t:'V',m:83}, l2:{t:'V',m:84} },
  { n:94, fase:'oitavas', data:'2026-07-06', hora:'21h', l1:{t:'V',m:81}, l2:{t:'V',m:82} },
  { n:95, fase:'oitavas', data:'2026-07-07', hora:'13h', l1:{t:'V',m:86}, l2:{t:'V',m:88} },
  { n:96, fase:'oitavas', data:'2026-07-07', hora:'17h', l1:{t:'V',m:85}, l2:{t:'V',m:87} },
  // Quartas (97–100)
  { n:97,  fase:'quartas', data:'2026-07-09', hora:'17h', l1:{t:'V',m:89}, l2:{t:'V',m:90} },
  { n:98,  fase:'quartas', data:'2026-07-10', hora:'16h', l1:{t:'V',m:93}, l2:{t:'V',m:94} },
  { n:99,  fase:'quartas', data:'2026-07-11', hora:'18h', l1:{t:'V',m:91}, l2:{t:'V',m:92} },
  { n:100, fase:'quartas', data:'2026-07-11', hora:'22h', l1:{t:'V',m:95}, l2:{t:'V',m:96} },
  // Semifinais (101–102)
  { n:101, fase:'semis', data:'2026-07-14', hora:'16h', l1:{t:'V',m:97}, l2:{t:'V',m:98} },
  { n:102, fase:'semis', data:'2026-07-15', hora:'16h', l1:{t:'V',m:99}, l2:{t:'V',m:100} },
  // 3º lugar (103) e Final (104)
  { n:103, fase:'3lugar', data:'2026-07-18', hora:'18h', l1:{t:'L',m:101}, l2:{t:'L',m:102} },
  { n:104, fase:'final',  data:'2026-07-19', hora:'16h', l1:{t:'V',m:101}, l2:{t:'V',m:102} },
];
// Os 8 jogos dos 32-avos que recebem um "melhor terceiro" (admin aloca).
const THIRD_SLOTS = BRACKET.filter(b => b.l2.t === '3').map(b => ({ slot: b.l2.slot, jogo: b.n, vencedorGrupo: b.l1.g, grupos: b.l2.grupos }));
function _jogoIdK(n) { return 'K' + n; }

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
function _ss() {
  // Vinculado à planilha (Extensões → Apps Script): usa a planilha ativa.
  // Standalone: usa o SPREADSHEET_ID informado.
  if (SPREADSHEET_ID && SPREADSHEET_ID.indexOf('COLE') < 0) return SpreadsheetApp.openById(SPREADSHEET_ID);
  const ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (ativa) return ativa;
  throw new Error('Sem planilha: vincule o script a uma planilha (Extensões → Apps Script) ou preencha SPREADSHEET_ID.');
}

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
// Palpites do mata-mata: placar + vencedor (Camadas 2 e 3 unificadas num input por jogo)
const COLS_PMM = ['ParticipanteID','JogoID','Gols1','Gols2','Vencedor','DataRegistro'];

function inicializar() {
  _aba('Participantes',      COLS_PART);
  _aba('PalpitesGrupos',     ['ParticipanteID','Dados','DataRegistro']);
  _aba('PalpitesMataMata',   COLS_PMM);
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
    else if (a === 'getChaveamento')           resultado = getChaveamento();
    else if (a === 'getResultadosPublico')     resultado = getResultadosPublico();
    else if (a === 'getResultadosMataMataPublico') resultado = getResultadosMataMataPublico();
    else if (a === 'getClassificacaoReal')     resultado = { ok: true, classificacao: calcularClassificacaoReal() };
    // ── Camada 1 ──
    else if (a === 'salvarPalpiteGrupos')      resultado = salvarPalpiteGrupos(body);
    else if (a === 'getPalpiteGrupos')         resultado = getPalpiteGrupos(body.token);
    // ── Camada 2 ──
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
    else if (a === 'sincronizarGruposV1')      resultado = sincronizarGruposV1(body.senha);
    else if (a === 'getChaveamentoAdmin')      resultado = getChaveamentoAdmin(body.senha);
    else if (a === 'gerarChaveamento')         resultado = gerarChaveamento(body);
    else if (a === 'definirTerceiros')         resultado = definirTerceiros(body);
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
  if (camada1Encerrada()) return { ok: false, msg: 'Os palpites da fase de grupos já estão encerrados (trava 24/06 15:55).' };
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
  const melhoresTerceirosTop = (todosCompletos ? terceiros.slice(0, 8) : []);
  const melhoresTerceiros = melhoresTerceirosTop.map(t => t.code);
  const melhoresTerceirosDet = melhoresTerceirosTop.map(t => ({ grupo: t.grupo, code: t.code }));

  return { porGrupo, melhoresTerceiros, melhoresTerceirosDet, todosCompletos };
}

// ════════════════════════════════════════════════════════════
// CHAVEAMENTO AUTOMÁTICO
// ════════════════════════════════════════════════════════════
function _props() { return PropertiesService.getScriptProperties(); }
function _getTerceiros() { try { return JSON.parse(_props().getProperty('terceiros') || '{}'); } catch (e) { return {}; } }
function _autoBracketLigado() { return _props().getProperty('autoBracket') === '1'; }

// Resolve W/R/3 (não depende de resultados do mata-mata)
function _resolverLadoBase(lado, classif, thirds) {
  if (lado.t === 'W') { const g = classif.porGrupo[lado.g]; return (g && g.completo) ? (g.pos1 || '') : ''; }
  if (lado.t === 'R') { const g = classif.porGrupo[lado.g]; return (g && g.completo) ? (g.pos2 || '') : ''; }
  if (lado.t === '3') { return thirds[String(lado.slot)] || ''; }
  return ''; // V / L resolvidos depois
}

// Resolve os times de cada jogo do BRACKET (W/R/3 da classificação + V/L dos resultados).
function _resolverBracketTeams(classif, mapResMM, thirds) {
  const teamsByN = {};
  BRACKET.forEach(b => { teamsByN[b.n] = { t1: _resolverLadoBase(b.l1, classif, thirds), t2: _resolverLadoBase(b.l2, classif, thirds) }; });
  for (let pass = 0; pass < 6; pass++) {
    BRACKET.forEach(b => {
      [['l1', 't1'], ['l2', 't2']].forEach(par => {
        const lado = b[par[0]], campo = par[1];
        if (lado.t !== 'V' && lado.t !== 'L') return;
        const res = mapResMM[_jogoIdK(lado.m)];
        if (!res || !res.vencedor) return;
        if (lado.t === 'V') { teamsByN[b.n][campo] = res.vencedor; }
        else { const f = teamsByN[lado.m]; if (f && f.t1 && f.t2) teamsByN[b.n][campo] = (res.vencedor === f.t1 ? f.t2 : f.t1); }
      });
    });
  }
  return teamsByN;
}

// Público: estrutura completa do chaveamento (para a árvore na tela Jogos).
function _rotuloSlot(lado) {
  if (lado.t === 'W') return '1º ' + lado.g;
  if (lado.t === 'R') return '2º ' + lado.g;
  if (lado.t === '3') return 'Melhor 3º';
  if (lado.t === 'V') return 'Venc. J' + lado.m;
  if (lado.t === 'L') return 'Perd. J' + lado.m;
  return '?';
}
function getChaveamento() {
  const classif = calcularClassificacaoReal();
  const mapResMM = _mapResultadosMataMata();
  const teamsByN = _resolverBracketTeams(classif, mapResMM, _getTerceiros());
  const jogos = BRACKET.map(b => {
    const t = teamsByN[b.n] || {};
    const res = mapResMM[_jogoIdK(b.n)];
    return {
      n: b.n, fase: b.fase, data: b.data, hora: b.hora,
      slot1: _rotuloSlot(b.l1), slot2: _rotuloSlot(b.l2),
      time1: t.t1 || '', time2: t.t2 || '',
      gols1: res ? res.gols1 : null, gols2: res ? res.gols2 : null, vencedor: res ? res.vencedor : ''
    };
  });
  return { ok: true, jogos };
}

// Motor idempotente: cria/atualiza os jogos cujos DOIS times já são conhecidos.
function atualizarChaveamento() {
  const classif = calcularClassificacaoReal();
  const mapResMM = _mapResultadosMataMata();
  const thirds = _getTerceiros();
  const teamsByN = _resolverBracketTeams(classif, mapResMM, thirds);

  const aba = _aba('JogosMataMata', ['JogoID','Fase','Data','Hora','Time1','Time2','Ordem','DataCriacao']);
  const vals = aba.getDataRange().getValues();
  const rowById = {};
  for (let i = 1; i < vals.length; i++) if (vals[i][0]) rowById[String(vals[i][0])] = i + 1;

  let criados = 0, atualizados = 0;
  BRACKET.forEach(b => {
    const t1 = teamsByN[b.n].t1, t2 = teamsByN[b.n].t2;
    if (!t1 || !t2) return; // só materializa quando os dois lados são conhecidos
    const id = _jogoIdK(b.n);
    const ordem = (FASES[b.fase].ordem * 100) + b.n;
    if (rowById[id]) {
      const r = rowById[id];
      const atual = vals[r - 1];
      if (String(atual[4]) !== String(t1) || String(atual[5]) !== String(t2) || atual[1] !== b.fase || _normData(atual[2]) !== b.data || String(atual[3]) !== String(b.hora)) {
        aba.getRange(r, 2, 1, 5).setValues([[b.fase, b.data, b.hora, t1, t2]]);
        atualizados++;
      }
    } else {
      aba.appendRow([id, b.fase, b.data, b.hora, t1, t2, ordem, new Date().toISOString()]);
      criados++;
    }
  });
  return { criados, atualizados };
}

// Admin: dados para a tela de geração do chaveamento
function getChaveamentoAdmin(senha) {
  if (!_adminOk(senha)) return { ok: false, msg: 'Acesso negado.' };
  const classif = calcularClassificacaoReal();
  return {
    ok: true,
    todosCompletos: classif.todosCompletos,
    porGrupo: classif.porGrupo,
    melhoresTerceiros: classif.melhoresTerceirosDet,   // [{grupo,code}]
    slots: THIRD_SLOTS,                                 // [{slot,jogo,vencedorGrupo,grupos}]
    terceirosAtribuidos: _getTerceiros(),               // {slot: code}
    autoBracket: _autoBracketLigado()
  };
}

// Admin: salvar a alocação dos 8 terceiros e (re)gerar o chaveamento
function definirTerceiros(body) {
  if (!_adminOk(body.senha)) return { ok: false, msg: 'Acesso negado.' };
  const atrib = body.atribuicoes || {};
  _props().setProperty('terceiros', JSON.stringify(atrib));
  _props().setProperty('autoBracket', '1');
  const r = atualizarChaveamento();
  return { ok: true, msg: 'Terceiros salvos. Chaveamento: ' + r.criados + ' criado(s), ' + r.atualizados + ' atualizado(s).' };
}

// Admin: ligar o chaveamento automático e gerar o que já dá
function gerarChaveamento(body) {
  if (!_adminOk(body.senha)) return { ok: false, msg: 'Acesso negado.' };
  _props().setProperty('autoBracket', '1');
  const r = atualizarChaveamento();
  return { ok: true, msg: 'Chaveamento gerado: ' + r.criados + ' jogo(s) criado(s), ' + r.atualizados + ' atualizado(s).', criados: r.criados, atualizados: r.atualizados };
}

function _pontosCamada1(palp, classif) {
  // palp = { grupos: {A:{pos1,pos2},...}, terceiros:[...] }
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
// MATA-MATA — jogos, travas e gols da final
// (Camadas 2 e 3 são palpitadas juntas: ver salvarPalpitesMataMata)
// ════════════════════════════════════════════════════════════
// O Sheets pode converter '2026-06-28' em objeto Date; normaliza de volta p/ 'yyyy-MM-dd'.
function _normData(v) {
  if (v instanceof Date) return Utilities.formatDate(v, _ss().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}
function _jogosMataMata() {
  const aba = _aba('JogosMataMata', ['JogoID','Fase','Data','Hora','Time1','Time2','Ordem','DataCriacao']);
  const vals = aba.getDataRange().getValues();
  const lista = [];
  for (let i = 1; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    lista.push({ id: String(vals[i][0]), fase: String(vals[i][1]), data: _normData(vals[i][2]), hora: String(vals[i][3]), time1: vals[i][4], time2: vals[i][5], ordem: vals[i][6] });
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

  const aba = _aba('PalpitesMataMata', COLS_PMM);
  const vals = aba.getDataRange().getValues();
  for (let i = vals.length - 1; i >= 1; i--) {
    if (vals[i][0] === r.dados[0] && abertos.has(String(vals[i][1]))) aba.deleteRow(i + 1);
  }
  const agora = new Date().toISOString();
  validos.forEach(p => {
    const j = mapJogos[String(p.jogoId)];
    const g1 = parseInt(p.gols1), g2 = parseInt(p.gols2);
    let venc = p.vencedor || '';
    // Vencedor automático pelo placar; empate sem escolha fica vazio (Camada 2 não pontua, Camada 3 sim)
    if (!venc && j) { if (g1 > g2) venc = j.time1; else if (g2 > g1) venc = j.time2; }
    aba.appendRow([r.dados[0], String(p.jogoId), p.gols1, p.gols2, venc, agora]);
  });

  let msg = 'Palpites salvos com sucesso!';
  if (recusados > 0) msg = 'Palpites salvos. ' + recusados + ' ignorado(s) (jogo já iniciado).';
  return { ok: true, msg };
}

function getMeusPalpitesMataMata(token) {
  const r = _linhaPorToken(token);
  if (!r) return { ok: false, msg: 'Sessão expirada.' };
  const aba = _aba('PalpitesMataMata', COLS_PMM);
  const vals = aba.getDataRange().getValues();
  const lista = [];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === r.dados[0]) lista.push({ jogoId: String(vals[i][1]), gols1: vals[i][2], gols2: vals[i][3], vencedor: vals[i][4] });
  }
  return { ok: true, palpites: lista, golsFinalPalpite: r.dados[9] };
}

// ════════════════════════════════════════════════════════════
// RESULTADOS
// ════════════════════════════════════════════════════════════
// Resultados dos grupos vindos do v1 (com cache + fallback de backup).
function _resultadosGruposV1() {
  if (!V1_API_URL || V1_API_URL.indexOf('script.google.com') < 0) return null;
  const cache = CacheService.getScriptCache();
  const cached = cache.get('v1grupos');
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  try {
    const resp = UrlFetchApp.fetch(V1_API_URL, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ action: 'getResultadosPublico' }),
      muteHttpExceptions: true, followRedirects: true
    });
    const data = JSON.parse(resp.getContentText());
    if (data && data.ok && data.resultados) {
      const json = JSON.stringify(data.resultados);
      cache.put('v1grupos', json, 90);           // fresco por 90s
      cache.put('v1grupos_backup', json, 21600); // backup 6h
      return data.resultados;
    }
  } catch (e) {}
  const bk = cache.get('v1grupos_backup');       // fallback se o v1 cair
  if (bk) { try { return JSON.parse(bk); } catch (e) {} }
  return null;
}

// Resultados manuais lançados na própria v2 (override/fallback).
function _mapResultadosGruposLocal() {
  const aba = _aba('ResultadosGrupos', ['JogoID','Gols1','Gols2','DataRegistro']);
  const vals = aba.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === '' || vals[i][0] == null) continue;
    map[vals[i][0]] = { gols1: vals[i][1], gols2: vals[i][2] };
  }
  return map;
}

// Fonte oficial de resultados dos grupos na v2: v1 (auto) + override manual local.
function _mapResultadosGrupos() {
  const v1 = _resultadosGruposV1();              // automático da v1
  const local = _mapResultadosGruposLocal();     // overrides manuais (se houver)
  const out = {};
  if (v1) Object.keys(v1).forEach(k => { out[k] = { gols1: v1[k].gols1, gols2: v1[k].gols2 }; });
  Object.keys(local).forEach(k => { out[k] = local[k]; }); // manual vence
  return out;
}

function _limparCacheGruposV1() {
  CacheService.getScriptCache().remove('v1grupos');
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
function _pontuarParticipante(pid, classif, jogosMM, mapResMM, palpMM, golsFinalPalpite, golsFinalReal) {
  // Camada 1
  const c1 = _pontosCamada1(classif._palpitesPorPid ? classif._palpitesPorPid[pid] : null, classif);

  const meusPalp = palpMM || {};

  // Camada 2 — quem avança (vencedor vem do próprio palpite do jogo)
  let c2 = 0, c2FasesFinais = 0, acertouCampeao = false;
  jogosMM.forEach(j => {
    const res = mapResMM[j.id];
    if (!res || !res.vencedor) return;
    const p = meusPalp[j.id];
    const pick = p ? p.vencedor : null;
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

  // palpites mata-mata por pid (placar + vencedor)
  const abaPM = _aba('PalpitesMataMata', COLS_PMM);
  const pmVals = abaPM.getDataRange().getValues();
  const palpMMPorPid = {};
  for (let i = 1; i < pmVals.length; i++) {
    const pid = pmVals[i][0];
    if (!pid) continue;
    if (!palpMMPorPid[pid]) palpMMPorPid[pid] = {};
    palpMMPorPid[pid][String(pmVals[i][1])] = { gols1: pmVals[i][2], gols2: pmVals[i][3], vencedor: pmVals[i][4] };
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

    const p = _pontuarParticipante(pid, classif, jogosMM, mapResMM, palpMMPorPid[pid], golsFinalPalpite, golsFinalReal);
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
  const palpMMres = getMeusPalpitesMataMata(token);
  const meusPalpMM = {};
  if (palpMMres.ok) palpMMres.palpites.forEach(p => meusPalpMM[p.jogoId] = { gols1: p.gols1, gols2: p.gols2, vencedor: p.vencedor });

  let c2 = 0, c3 = 0;
  const mmDetalhe = jogosMM.map(j => {
    const res = mapResMM[j.id];
    const palp = meusPalpMM[j.id] || null;
    const pick = palp ? (palp.vencedor || null) : null;
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
  let achou = false;
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(body.jogoId)) { aba.getRange(i + 1, 2, 1, 4).setValues([[body.gols1, body.gols2, vencedor, agora]]); achou = true; break; }
  }
  if (!achou) aba.appendRow([String(body.jogoId), body.gols1, body.gols2, vencedor, agora]);
  // Avanço automático do vencedor para a próxima fase
  let extra = '';
  if (_autoBracketLigado()) {
    try { const r = atualizarChaveamento(); if (r.criados) extra = ' ' + r.criados + ' confronto(s) da próxima fase liberado(s).'; } catch (e) {}
  }
  return { ok: true, msg: (achou ? 'Resultado atualizado.' : 'Resultado registrado.') + extra };
}

function getResultadosGruposAdmin(senha) {
  if (!_adminOk(senha)) return { ok: false, msg: 'Acesso negado.' };
  const v1 = _resultadosGruposV1();
  return { ok: true, resultados: _mapResultadosGrupos(), fonteV1: !!v1, qtdV1: v1 ? Object.keys(v1).length : 0 };
}

function sincronizarGruposV1(senha) {
  if (!_adminOk(senha)) return { ok: false, msg: 'Acesso negado.' };
  _limparCacheGruposV1();
  const r = _resultadosGruposV1();
  const n = r ? Object.keys(r).length : 0;
  return { ok: true, msg: 'Sincronizado com o v1: ' + n + ' resultado(s) de grupo.', total: n, disponivel: !!r };
}
function getResultadosMataMataAdmin(senha) {
  if (!_adminOk(senha)) return { ok: false, msg: 'Acesso negado.' };
  return { ok: true, resultados: _mapResultadosMataMata() };
}

// Contagens p/ relatórios do admin (quantos preencheram cada camada)
function getContagens(senha) {
  if (!_adminOk(senha)) return { ok: false, msg: 'Acesso negado.' };
  const cont = { grupos: {}, mataMata: {} };
  const pg = _aba('PalpitesGrupos', ['ParticipanteID','Dados','DataRegistro']).getDataRange().getValues();
  for (let i = 1; i < pg.length; i++) if (pg[i][0]) cont.grupos[pg[i][0]] = 1;
  const pm = _aba('PalpitesMataMata', COLS_PMM).getDataRange().getValues();
  for (let i = 1; i < pm.length; i++) { const pid = pm[i][0]; if (!pid) continue; cont.mataMata[pid] = (cont.mataMata[pid] || 0) + 1; }
  return { ok: true, contagens: cont };
}

// ════════════════════════════════════════════════════════════
// FERRAMENTAS DE TESTE  (rodar no editor do Apps Script — ▶ Run)
// Não ficam expostas na web. Use para simular e depois ZERAR.
// ════════════════════════════════════════════════════════════
function _embaralhar(arr) {
  arr = arr.slice();
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}

// Cria 6 participantes de teste (APROVADO, senha "123456") com palpites aleatórios
// nas 3 camadas (a Camada 2/3 só se já houver jogos do mata-mata criados).
function TESTE_semear() {
  const N = 6;
  const abaP  = _aba('Participantes', COLS_PART);
  const abaPG = _aba('PalpitesGrupos', ['ParticipanteID','Dados','DataRegistro']);
  const abaPM = _aba('PalpitesMataMata', COLS_PMM);

  const grupos = {};
  JOGOS.forEach(j => { if (!grupos[j.grupo]) grupos[j.grupo] = []; [j.time1, j.time2].forEach(t => { if (grupos[j.grupo].indexOf(t) < 0) grupos[j.grupo].push(t); }); });
  const gkeys = Object.keys(grupos).sort();
  const jogosMM = _jogosMataMata();
  const agora = new Date().toISOString();

  let criados = 0;
  for (let k = 1; k <= N; k++) {
    const id = 'TESTE' + String(Date.now()).slice(-5) + k;
    const email = 'teste' + k + '_' + String(Date.now()).slice(-4) + '@teste.com';
    const salt = _gerarSalt(), hash = _hash(salt, '123456');
    const golsFinal = Math.floor(Math.random() * 5);
    abaP.appendRow([id, 'Teste ' + k, email, '8899999000' + k, salt, hash, 'APROVADO', agora, agora, golsFinal, '', _novoToken(), '', '']);

    // Camada 1 — só 1º e 2º por grupo; 8 terceiros dentre os times restantes
    const palpG = { grupos: {}, terceiros: [] };
    const restantes = [];
    gkeys.forEach(g => { const ord = _embaralhar(grupos[g]); palpG.grupos[g] = { pos1: ord[0], pos2: ord[1] }; restantes.push(ord[2], ord[3]); });
    palpG.terceiros = _embaralhar(restantes).slice(0, 8);
    abaPG.appendRow([id, JSON.stringify(palpG), agora]);

    // Mata-mata (placar + vencedor), se já houver confrontos
    if (jogosMM.length) {
      jogosMM.forEach(j => {
        const g1 = Math.floor(Math.random() * 4), g2 = Math.floor(Math.random() * 4);
        const venc = g1 > g2 ? j.time1 : (g2 > g1 ? j.time2 : (Math.random() < 0.5 ? j.time1 : j.time2));
        abaPM.appendRow([id, j.id, g1, g2, venc, agora]);
      });
    }
    criados++;
  }
  Logger.log('Semeados ' + criados + ' participantes de teste (senha 123456).');
  return { ok: true, msg: 'Semeados ' + criados + ' participantes de teste (senha 123456).' };
}

// Passo 1 do reset (proteção contra apagar sem querer).
function TESTE_armarReset() {
  _props().setProperty('resetArmado', String(Date.now()));
  Logger.log('Reset ARMADO. Rode TESTE_limparTudo() em até 10 minutos.');
  return { ok: true, msg: 'Reset armado. Rode TESTE_limparTudo() em até 10 min.' };
}

// Passo 2: apaga TODOS os dados (participantes, palpites, jogos, resultados) e zera o sistema.
// Requer TESTE_armarReset() nos últimos 10 min.
function TESTE_limparTudo() {
  const armado = Number(_props().getProperty('resetArmado') || 0);
  if (Date.now() - armado > 10 * 60 * 1000) {
    Logger.log('BLOQUEADO: rode TESTE_armarReset() primeiro.');
    return { ok: false, msg: 'Rode TESTE_armarReset() primeiro (proteção contra apagar sem querer).' };
  }
  const ss = _ss();
  ['Participantes','PalpitesGrupos','Bracket','PalpitesMataMata','JogosMataMata','ResultadosGrupos','ResultadosMataMata'].forEach(nome => {
    const aba = ss.getSheetByName(nome);
    if (aba) { const last = aba.getLastRow(); if (last > 1) aba.deleteRows(2, last - 1); }
  });
  ['terceiros','autoBracket','resetArmado'].forEach(p => _props().deleteProperty(p));
  const c = CacheService.getScriptCache(); c.remove('v1grupos'); c.remove('v1grupos_backup');
  Logger.log('TUDO limpo. Sistema zerado.');
  return { ok: true, msg: 'Tudo limpo. Sistema zerado para o lançamento real.' };
}

// Preenche resultados ALEATÓRIOS para os 72 jogos de grupo (na própria v2, como override
// local), fechando a classificação — permite testar o mata-mata sem esperar a Copa real.
function TESTE_resultadosGrupos() {
  const aba = _aba('ResultadosGrupos', ['JogoID','Gols1','Gols2','DataRegistro']);
  const last = aba.getLastRow(); if (last > 1) aba.deleteRows(2, last - 1);
  const agora = new Date().toISOString();
  JOGOS.forEach(j => aba.appendRow([j.id, Math.floor(Math.random() * 4), Math.floor(Math.random() * 4), agora]));
  Logger.log('72 resultados de grupo simulados.');
  return { ok: true, msg: '72 resultados de grupo simulados (local). Classificação fechada.' };
}

// Aloca os 8 terceiros automaticamente (qualquer combinação válida) — só para TESTE.
function _autoAtribuirTerceiros(classif) {
  const thirds = classif.melhoresTerceirosDet || [];
  if (thirds.length < 8) return null;
  const byGroup = {}; thirds.forEach(t => byGroup[t.grupo] = t.code);
  const slots = THIRD_SLOTS, assign = {}, used = {};
  function bt(i) {
    if (i >= slots.length) return true;
    const s = slots[i];
    for (let x = 0; x < s.grupos.length; x++) {
      const g = s.grupos[x];
      if (byGroup[g] && !used[g]) {
        used[g] = true; assign[s.slot] = byGroup[g];
        if (bt(i + 1)) return true;
        used[g] = false; delete assign[s.slot];
      }
    }
    return false;
  }
  return bt(0) ? assign : null;
}

function _appendResMM(jogoId, g1, g2, venc) {
  _aba('ResultadosMataMata', ['JogoID','Gols1','Gols2','Vencedor','DataRegistro']).appendRow([String(jogoId), g1, g2, venc, new Date().toISOString()]);
}

// Aloca terceiros automaticamente, gera os 32-avos e SIMULA todo o mata-mata até a final.
// Pré-requisito: TESTE_resultadosGrupos() (grupos completos).
function TESTE_simularMataMata() {
  const classif = calcularClassificacaoReal();
  if (!classif.todosCompletos) return { ok: false, msg: 'Rode TESTE_resultadosGrupos() antes (grupos incompletos).' };
  const atrib = _autoAtribuirTerceiros(classif);
  if (!atrib) return { ok: false, msg: 'Não consegui alocar os terceiros automaticamente.' };
  _props().setProperty('terceiros', JSON.stringify(atrib));
  _props().setProperty('autoBracket', '1');
  atualizarChaveamento();
  let total = 0;
  for (let round = 0; round < 8; round++) {
    const jogos = _jogosMataMata();
    const resMap = _mapResultadosMataMata();
    let novos = 0;
    jogos.forEach(j => {
      if (resMap[j.id]) return;
      const g1 = Math.floor(Math.random() * 4), g2 = Math.floor(Math.random() * 4);
      const venc = g1 > g2 ? j.time1 : (g2 > g1 ? j.time2 : (Math.random() < 0.5 ? j.time1 : j.time2));
      _appendResMM(j.id, g1, g2, venc); novos++; total++;
    });
    atualizarChaveamento();
    if (!novos) break;
  }
  Logger.log('Mata-mata simulado: ' + total + ' jogos.');
  return { ok: true, msg: 'Mata-mata simulado: ' + total + ' jogos (terceiros alocados automaticamente).' };
}
