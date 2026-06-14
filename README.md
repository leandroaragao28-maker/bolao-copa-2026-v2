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
| **1 — Classificação dos grupos** | 1º/2º de cada grupo + 8 melhores terceiros | Antes da 3ª rodada (24/06 15:55) | 5 (1º exato), 5 (2º exato), 3 (avança c/ posição errada), 2 (terceiro certo) |
| **2 — Quem avança** | Vencedor de cada jogo do mata-mata (sai do placar; empate = você escolhe) | Por jogo (5 min antes do apito) | 2 / 4 / 6 / 10 / 15 (campeão) |
| **3 — Placares do mata-mata** | Placar de cada jogo eliminatório | Por jogo (5 min antes do apito) | 15 / 10 / 7,5 / 5 |

> No mata-mata, as Camadas 2 e 3 são palpitadas **juntas, num único input por jogo**: você dá o placar e o vencedor sai dele (empate → você escolhe quem avança).

**Ranking final = Camada 1 + Camada 2 + Camada 3.** Desempate (em ordem): placares exatos → campeão → fases finais (semis+final) → posições exatas nos grupos → palpite de gols da final → inscrição mais antiga.

---

## Páginas

| Arquivo | Função |
|---|---|
| `login.html` | Login por e-mail/senha + recuperação de senha (código por e-mail) |
| `cadastro.html` | Cadastro com senha + pagamento Pix (R$ 100) |
| `index.html` | Hub: atalhos das 3 camadas + prévia do ranking |
| `classificacao-grupos.html` | **Camada 1** (1º/2º + 8 terceiros) |
| `palpites.html` | **Mata-mata** (Camadas 2+3 juntas: placar → vencedor automático; empate → escolher) + gols da final |
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

O sistema é **fortemente automatizado**:

1. **Resultados dos grupos** → você lança **só no sistema v1** (como já faz). A v2 puxa automaticamente (mesmos IDs) e calcula a classificação real da Camada 1. Confira na aba **🏟️ Grupos** (botão **🔄 Atualizar do v1**).
2. **Pagamentos** → aprove na aba **👥 Participantes**. Só aprovados pontuam.
3. **Quando os 12 grupos terminarem (≈27/jun)** → aba **🗺️ Mata-mata → ⚙️ Chaveamento automático**: aloque os **8 melhores terceiros** (8 menus, já filtrados pelos grupos válidos) e clique **💾 Salvar terceiros e gerar 32-avos**. Os 16 jogos dos 32-avos são criados sozinhos, com data/hora/seleções corretas. Isso abre as Camadas 2 e 3.
4. **A cada jogo do mata-mata** → lance o placar **e quem avançou** (obrigatório em empate por pênaltis). O vencedor **avança automaticamente** — os confrontos de oitavas → quartas → semis → 3º lugar → final vão sendo criados sozinhos conforme os resultados saem.
5. O botão **🔄 Gerar/atualizar** recompõe o chaveamento a qualquer momento. O formulário **Criar confronto manualmente** é só fallback.

A estrutura oficial do chaveamento 2026 (datas, horários de Brasília e progressão) já está embutida no `Code.gs`. O ranking e as pontuações são **calculados ao vivo** — não há "recalcular".

> ⚠️ **Ao republicar o `Code.gs`:** como a v2 agora acessa um serviço externo (o Web App do v1), o Google pedirá uma **nova autorização** na 1ª execução (permissão de "conectar a um serviço externo"). Rode qualquer função uma vez para autorizar e publique uma **nova versão** da implantação.
