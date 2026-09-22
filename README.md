# Biblioteca de Acordes

Aplicação web (PWA) para escolher, criar e descarregar diagramas de acordes de guitarra.
Funciona no Mac e no telemóvel, offline, sem instalação.

## Como abrir

- **No Mac**: duplo clique em `index.html`.
- **No telemóvel**: a pasta `app/` tem de estar alojada num site HTTPS (GitHub Pages, Netlify, Hostinger…).
  Abre o URL no Safari/Chrome → Partilhar → **Adicionar ao ecrã principal**. Fica com ícone próprio e abre a ecrã inteiro.

## Funcionalidades

- 529 acordes × ~2000 posições (base de dados [chords-db](https://github.com/tombatossals/chords-db), licença MIT)
- Pesquisa (ex: `Am7`, `G/B`), nomes com ♯ ou ♭
- Fundo preto, branco ou transparente (com diagrama branco ou preto)
- PNG ou JPEG em 800×1200, 1600×2400 ou 2400×3600
- **Seleção múltipla**: o botão `+` em cada acorde junta-o ao cesto no fundo do ecrã
- **Guardar nas Fotos** (telemóvel): abre a folha de partilha com todas as imagens → "Guardar X imagens"
- Copiar imagem; descarregar todas as posições de um acorde
- Editor para criar acordes próprios (guardados no browser; exportar/importar em JSON)

## Ficheiros

- `index.html`, `style.css`, `app.js` — interface
- `diagram.js` — desenho do diagrama em SVG e conversão para PNG/JPEG
- `chords-db.js` — base de dados de acordes
- `manifest.webmanifest`, `sw.js`, `icons/` — instalação como app e funcionamento offline

## Atualizar a app no telemóvel

Depois de alterar ficheiros, muda a `VERSION` em `sw.js` (ex: `acordes-v2`) e volta a publicar a pasta.
