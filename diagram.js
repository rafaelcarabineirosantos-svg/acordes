// Renderização do diagrama de acorde em SVG.
// Um acorde é { name, frets[6], fingers[6], baseFret, barres[] }
//   frets:  -1 = corda muda (X), 0 = solta (O), 1..n = traste relativo ao baseFret
//   fingers: 0 = sem dedo, 1..4
//   barres: trastes (relativos) onde há pestana

const DIAGRAM = {
  W: 800,
  H: 1200,
  gridLeft: 160,
  gridTop: 255,
  stringGap: 96,
  fretGap: 169,
  minFrets: 5,
  lineWidth: 6,
  dotRadius: 32,
  markerY: 190,
  markerRadius: 28,
  markerStroke: 7,
  titleY: 120,
  titleSize: 96,
  font: "'Helvetica Neue', Helvetica, Arial, sans-serif",
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Devolve o SVG (string) do acorde.
 * opts.theme: 'black' | 'white' | 'transparent'
 * opts.ink: cor das linhas quando theme === 'transparent' ('white' | 'black')
 * opts.showFingers: mostra números dos dedos dentro das bolas
 * opts.showTitle: mostra o nome do acorde
 */
function renderChordSVG(chord, opts = {}) {
  const D = DIAGRAM;
  const theme = opts.theme || 'black';
  const ink = theme === 'black' ? '#ffffff' : theme === 'white' ? '#000000' : (opts.ink === 'black' ? '#000000' : '#ffffff');
  const paper = theme === 'black' ? '#000000' : theme === 'white' ? '#ffffff' : null;
  // cor do número do dedo dentro da bola: contraste com a tinta
  const dotText = ink === '#ffffff' ? '#000000' : '#ffffff';
  const showFingers = opts.showFingers !== false;
  const showTitle = opts.showTitle !== false;

  const frets = chord.frets;
  const fingers = chord.fingers || [0, 0, 0, 0, 0, 0];
  const baseFret = chord.baseFret || 1;
  const maxFret = Math.max(0, ...frets);
  const nFrets = Math.max(chord.nFrets || D.minFrets, maxFret);
  // com mais de 5 trastes, comprime a grelha para caber na imagem
  const fretGap = Math.min(D.fretGap, (D.H - 100 - D.gridTop) / nFrets);
  const gridRight = D.gridLeft + D.stringGap * 5;
  const gridBottom = D.gridTop + fretGap * nFrets;
  const sx = (i) => D.gridLeft + i * D.stringGap;
  const fy = (f) => D.gridTop + (f - 0.5) * fretGap;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${D.W} ${D.H}" width="${D.W}" height="${D.H}" font-family="${D.font}">`);
  if (paper) parts.push(`<rect width="${D.W}" height="${D.H}" fill="${paper}"/>`);

  // Título
  if (showTitle && chord.name) {
    const name = chord.name;
    const size = name.length <= 6 ? D.titleSize : Math.max(48, Math.round(D.titleSize * 6 / name.length));
    parts.push(`<text x="${D.W / 2}" y="${D.titleY}" text-anchor="middle" font-size="${size}" fill="${ink}">${esc(name)}</text>`);
  }

  // Marcadores X / O
  for (let i = 0; i < 6; i++) {
    const x = sx(i);
    if (frets[i] === -1) {
      const r = D.markerRadius - 2;
      parts.push(`<path d="M${x - r} ${D.markerY - r} L${x + r} ${D.markerY + r} M${x + r} ${D.markerY - r} L${x - r} ${D.markerY + r}" stroke="${ink}" stroke-width="${D.markerStroke}" stroke-linecap="round" fill="none"/>`);
    } else if (frets[i] === 0) {
      parts.push(`<circle cx="${x}" cy="${D.markerY}" r="${D.markerRadius}" stroke="${ink}" stroke-width="${D.markerStroke}" fill="none"/>`);
    }
  }

  // Pestana superior (nut) ou linha fina + número do traste
  if (baseFret === 1) {
    parts.push(`<rect x="${D.gridLeft - D.lineWidth / 2}" y="${D.gridTop - 16}" width="${gridRight - D.gridLeft + D.lineWidth}" height="18" fill="${ink}"/>`);
  } else {
    parts.push(`<line x1="${D.gridLeft}" y1="${D.gridTop}" x2="${gridRight}" y2="${D.gridTop}" stroke="${ink}" stroke-width="${D.lineWidth}"/>`);
    parts.push(`<text x="${gridRight + D.dotRadius + 14}" y="${fy(1) + 15}" font-size="42" fill="${ink}">${baseFret}fr</text>`);
  }

  // Grelha
  for (let f = 1; f <= nFrets; f++) {
    const y = D.gridTop + f * fretGap;
    parts.push(`<line x1="${D.gridLeft}" y1="${y}" x2="${gridRight}" y2="${y}" stroke="${ink}" stroke-width="${D.lineWidth}"/>`);
  }
  for (let i = 0; i < 6; i++) {
    parts.push(`<line x1="${sx(i)}" y1="${D.gridTop}" x2="${sx(i)}" y2="${gridBottom}" stroke="${ink}" stroke-width="${D.lineWidth}"/>`);
  }

  // Pestanas (barres)
  const barres = chord.barres || [];
  const barreLabelDone = new Set();
  for (const f of barres) {
    const strings = [];
    for (let i = 0; i < 6; i++) if (frets[i] === f) strings.push(i);
    if (strings.length < 2) continue;
    const x1 = sx(strings[0]);
    const x2 = sx(strings[strings.length - 1]);
    parts.push(`<rect x="${x1 - D.dotRadius}" y="${fy(f) - D.dotRadius}" width="${x2 - x1 + D.dotRadius * 2}" height="${D.dotRadius * 2}" rx="${D.dotRadius}" fill="${ink}"/>`);
    barreLabelDone.add(f);
  }

  // Bolas
  for (let i = 0; i < 6; i++) {
    const f = frets[i];
    if (f <= 0) continue;
    const x = sx(i), y = fy(f);
    const inBarre = barres.includes(f);
    if (!inBarre) parts.push(`<circle cx="${x}" cy="${y}" r="${D.dotRadius}" fill="${ink}"/>`);
    if (showFingers && fingers[i] > 0) {
      // numa pestana, só escreve o número na primeira corda
      if (inBarre) {
        const first = frets.indexOf(f);
        if (first !== i) continue;
      }
      parts.push(`<text x="${x}" y="${y + 14}" text-anchor="middle" font-size="40" font-weight="bold" fill="${dotText}">${fingers[i]}</text>`);
    }
  }

  parts.push('</svg>');
  return parts.join('');
}

/**
 * Converte o SVG numa imagem (Blob). format: 'png' | 'jpeg'. scale: multiplicador de resolução.
 * Para JPEG, o fundo é sempre preenchido (JPEG não suporta transparência).
 */
function svgToImageBlob(svg, { format = 'png', scale = 2, theme = 'black', ink = 'white' } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = DIAGRAM.W * scale;
      canvas.height = DIAGRAM.H * scale;
      const ctx = canvas.getContext('2d');
      if (format === 'jpeg' && theme === 'transparent') {
        // sem transparência em JPEG: usa fundo oposto à tinta
        ctx.fillStyle = ink === 'black' ? '#ffffff' : '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem')), format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.95);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao carregar SVG')); };
    img.src = url;
  });
}
