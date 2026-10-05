# Meu Caminho 🚶 — versão 2.0

Novidades: painel renovado, modo caminhada, celebrações, níveis, conquistas extras, hábitos e check-in diário, calendário com caminhada parcial, modo claro/escuro/automático. Os dados da versão 1 continuam compatíveis.

Aplicativo pessoal (PWA) para caminhada, controle de peso, hábitos e acompanhamento de evolução.
Tudo funciona no aparelho: sem servidor, sem conta, sem envio de dados.

## Arquivos (todos na raiz do repositório)

| Arquivo | Função |
|---|---|
| `index.html` | Estrutura da página |
| `style.css` | Visual do aplicativo |
| `app.js` | Toda a lógica (telas, cronômetro, GPS, gráficos, backup) |
| `manifest.json` | Configuração de instalação do PWA |
| `service-worker.js` | Funcionamento offline |
| `icone-192.png` / `icone-512.png` | Ícones do aplicativo |
| `README.md` | Este guia |

Não existem pastas. Todos os caminhos são relativos à raiz (`./app.js`, `./icone-192.png`, etc.).

## Publicar no GitHub Pages

1. Crie um repositório e envie os 8 arquivos para a raiz (sem pastas).
2. Vá em **Settings → Pages**.
3. Em **Source**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
4. Aguarde alguns minutos e abra o endereço `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

## Instalar no celular

- **Android (Chrome):** menu ⋮ → *Instalar aplicativo* (ou use o botão em Perfil → Meus dados).
- **iPhone (Safari):** botão Compartilhar → *Adicionar à Tela de Início*.

## Observações

- **Dados:** ficam no `localStorage` do navegador. Use *Perfil → Exportar meus dados* para gerar um backup `.json` e *Importar meus dados* para restaurar. Limpar os dados do navegador apaga o histórico, então faça backups.
- **GPS:** a localização só é pedida ao iniciar uma caminhada. Se for negada, o cronômetro funciona normalmente e a distância pode ser informada ao final. Para medir a distância, mantenha o app aberto durante a caminhada.
- **Lembrete das 17:00:** usa a Notification API quando o navegador permite e o app está aberto ou em segundo plano. Sem servidor, não há como garantir notificações com o app totalmente fechado. A contagem regressiva sempre funciona.
- **Calorias:** são sempre estimativas, calculadas a partir de peso, tempo e velocidade média. Podem variar conforme terreno, condicionamento, frequência cardíaca e características individuais.
- **Atualizações:** ao alterar qualquer arquivo, mude o número em `CACHE` no `service-worker.js` (por exemplo, `meu-caminho-v3`) para que os aparelhos recebam a nova versão.

> Para emagrecimento, atividade física é apenas uma parte do processo. Alimentação, sono, descanso e acompanhamento profissional também podem ser importantes.
