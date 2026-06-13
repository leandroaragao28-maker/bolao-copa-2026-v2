# Bolão da Copa 2026 — v2.0 (Fase Eliminatória)

Sistema web do bolão da Copa 2026, **versão 2** — foca na **fase eliminatória** com **3 camadas de pontuação independentes** e **login por e-mail + senha**.

- **Frontend:** HTML/CSS/JS estático (GitHub Pages).
- **Backend:** Google Apps Script (Web App `doPost`) + Google Sheets como banco.
- **Mobile-first**, mesma identidade visual da v1 (azul `#1A237E` / ouro `#F9A825`), `twemoji` para bandeiras.

> A v2 é **independente** da fase de grupos da v1. Os placares dos 72 jogos de grupo já palpitados ficam **apenas** no sistema v1 e **não** entram aqui.

---

## As 3 camadas

| Camada | O que prevê | Trava | Pontos |
|---|---|---|---|
| **1 — Classificação dos grupos** | 1º/2º/3º de cada grupo + 8 melhores terceiros | Antes da 3ª rodada (≈23/jun) | 5 (1º exato), 5 (2º exato), 3 (avança c/ posição errada), 2 (terceiro certo) |
| **2 — Quem avança** | Vencedor de cada confronto do mata-mata | **Por fase** (antes do 1º jogo da fase) | 2 / 4 / 6 / 10 / 15 (campeão) |
| **3 — Placares do mata-mata** | Placar de cada jogo eliminatório | Por jogo (5 min antes do apito) | 15 / 10 / 7,5 / 5 |

**Ranking final = Camada 1 + Camada 2 + Camada 3.** Desempate (em ordem): placares exatos → campeão → fases finais (semis+final) → posições exatas nos grupos → palpite de gols da final → inscrição mais antiga.

---

## Páginas

| Arquivo | Função |
|---|---|
| `login.html` | Login por e-mail/senha + recuperação de senha (código por e-mail) |
| `cadastro.html` | Cadastro com senha + pagamento Pix (R$ 100) |
| `index.html` | Hub: atalhos das 3 camadas + prévia do ranking |
| `classificacao-grupos.html` | **Camada 1** |
| `bracket.html` | **Camada 2** + palpite de gols da final |
| `palpites.html` | **Camada 3** |
| `jogos.html` | Próximos jogos + tabela dos grupos + chaveamento |
| `ranking.html` | Ranking somando as camadas |
| `minha-pontuacao.html` | Detalhamento por camada |
| `regulamento.html` | Regras, desempate e cronograma |
| `admin.html` | Aprovar participantes, resultados dos grupos, **criar confrontos do mata-mata**, lançar resultados (placar + quem avançou), relatórios WhatsApp |

---

## 1. Backend — Google Apps Script

**Recomendado — script vinculado à planilha (não precisa do ID):**

1. Crie uma **planilha** nova no Google Sheets.
2. Nela: **Extensões → Apps Script** → cole o conteúdo de [`Code.gs`](Code.gs). (O script já fica vinculado à planilha; `SPREADSHEET_ID` pode ficar vazio.)
3. No topo do `Code.gs`, defina:
   - `ADMIN_PASSWORD` = uma senha forte de administrador.
   - (opcional) `VALOR_INSCRICAO`, premiação.
   - `SPREADSHEET_ID` = deixe **vazio** (vinculado). Só preencha se usar um projeto standalone em `script.google.com`.
4. Rode a função **`inicializar()`** uma vez (cria todas as abas). Autorize o acesso à planilha e ao envio de e-mail (`MailApp`).
5. **Implantar → Nova implantação → Tipo: App da Web**
   - *Executar como:* **Eu**
   - *Quem tem acesso:* **Qualquer pessoa** (`Anyone` — **não** "Anyone with Google account", senão dá erro de CORS).
6. Copie a **URL `/exec`**.
7. A cada alteração no `Code.gs`, publique **nova versão** da implantação (Implantar → Gerenciar implantações → editar → Nova versão).

### Abas criadas pelo `inicializar()`
`Participantes`, `PalpitesGrupos`, `Bracket`, `PalpitesMataMata`, `JogosMataMata`, `ResultadosGrupos`, `ResultadosMataMata`.

> **Segurança:** senhas nunca são salvas em texto. Guardamos apenas `salt` (aleatório por usuário) e `hash` SHA-256 de `salt|senha`.

---

## 2. Frontend — `config.js`

Abra [`config.js`](config.js) e cole a URL do Web App em `CONFIG.API_URL`. Confira `PIX_CHAVE`, `PIX_NOME`, `PIX_CIDADE` e `VALOR_INSCRICAO`.

---

## 3. GitHub Pages

```powershell
cd "G:\Meu Drive\Sistemas\Bolao-Copa-2026-v2\_repo"
git init
git add -A
git commit -m "v2.0 - estrutura inicial"
git branch -M main
git remote add origin https://github.com/leandroaragao28-maker/bolao-copa-2026-v2.git
git push -u origin main
```

Depois: **Settings → Pages → Source: Deploy from a branch → Branch `main` / `/(root)` → Save**.
URL pública: `https://leandroaragao28-maker.github.io/bolao-copa-2026-v2/`

### Deploy do dia a dia
Rode **`DEPLOY - Bolao Copa 2026 v2.bat`** (chama `deploy_Bolao-Copa-2026-v2.ps1`): faz `git pull` → `add` → `commit` → `push`. O GitHub Pages publica sozinho.

---

## 4. Operação durante o torneio (admin)

1. **Antes de 23/jun:** participantes preenchem a Camada 1. Você lança os resultados dos grupos na aba **🏟️ Grupos** conforme os jogos acontecem.
2. **Saiu o chaveamento (≈28/jun):** na aba **🗺️ Mata-mata**, crie os 16 confrontos da Rodada de 32 (fase, data, hora, seleções). Isso abre a Camada 2 (32-avos) e a Camada 3 desses jogos.
3. **A cada jogo do mata-mata:** lance o placar **e quem avançou** (obrigatório informar o vencedor em caso de empate por pênaltis).
4. **Nova fase:** quando os classificados estiverem definidos, crie os confrontos da fase seguinte (oitavas, quartas, …). Cada fase trava sozinha antes do seu 1º jogo.
5. **Pagamentos:** aprove na aba **👥 Participantes**. Só aprovados pontuam no ranking.

O ranking e as pontuações são **calculados ao vivo** a partir dos palpites e resultados — não há "recalcular".
