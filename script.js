// --- Elements HTML ---
const video = document.getElementById('webcam');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

// --- Variables d'etat ---
let filter = 'llama'; // filtre actif : 'llama', 'kuzco', ou 'none'
let smooth = null;    // les points lisses du visage
const S = 0.4;        // facteur de lissage (entre 0 et 1)

// --- Boutons de controle ---
document.querySelectorAll('#controls button').forEach(b => {
  b.addEventListener('click', () => {
    filter = b.dataset.f;
    document.querySelectorAll('#controls button').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
  });
});

// --- MediaPipe Face Mesh ---
const fm = new FaceMesh({
  locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
});

fm.setOptions({
  maxNumFaces: 4,
  refineLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// --- Callback onResults ---
fm.onResults(results => {
  // 1. Dessiner la webcam sur le canvas (en miroir)
  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(results.image, -canvas.width, 0, canvas.width, canvas.height);
  ctx.restore();

  // 2. Si aucun visage detecte, on s'arrete
  if (!results.multiFaceLandmarks) return;

  // 3. Pour chaque visage detecte...
  for (const face of results.multiFaceLandmarks) {
    // Convertir les coordonnees normalisees en pixels
    const lm = face.map(p => ({
      x: (1 - p.x) * canvas.width,
      y: p.y * canvas.height,
      z: p.z
    }));

    // Lissage des points
    if (!smooth || smooth.length !== lm.length) {
      smooth = lm.map(p => ({ ...p }));
    } else {
      for (let i = 0; i < lm.length; i++) {
        smooth[i].x += (lm[i].x - smooth[i].x) * S;
        smooth[i].y += (lm[i].y - smooth[i].y) * S;
      }
    }

    // Dessiner le filtre si actif
    if (filter !== 'none') draw(smooth);
  }
});

// --- Fonctions utilitaires ---
function pt(lm, i) {
  return lm[i];
}

function mid(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// --- Fonction de dessin principale ---
function draw(lm) {
  const top       = pt(lm, 10);
  const chin      = pt(lm, 152);
  const lCheek    = pt(lm, 234);
  const rCheek    = pt(lm, 454);
  const nose      = pt(lm, 1);
  const noseBridge = pt(lm, 6);
  const upperLip  = pt(lm, 0);
  const lowerLip  = pt(lm, 17);
  const fhL       = pt(lm, 70);
  const fhR       = pt(lm, 300);
  const lEyeIn    = pt(lm, 133);
  const lEyeOut   = pt(lm, 33);
  const rEyeIn    = pt(lm, 362);
  const rEyeOut   = pt(lm, 263);
  const lIris     = lm[468] || pt(lm, 159);
  const rIris     = lm[473] || pt(lm, 386);
  const mouthL    = pt(lm, 61);
  const mouthR    = pt(lm, 291);

  const fw = dist(lCheek, rCheek);
  const fh = dist(top, chin);

  drawFur(lm, fw, fh);
  drawEars(lm, top, fhL, fhR, fw, fh);
  drawSnout(lm, nose, upperLip, lowerLip, chin, fw, fh);
  drawBigNose(nose, fw);
  drawMouth(upperLip, lowerLip, mouthL, mouthR, fw);
  drawEyes(lIris, rIris, lEyeIn, lEyeOut, rEyeIn, rEyeOut, fw);
  drawEyebrows(lm, fw);
  drawFurTuft(top, fw);

  if (filter === 'kuzco') {
    drawCrown(top, fhL, fhR, fw, fh);
    drawEarring(lm, lCheek, fw);
    drawEarring(lm, rCheek, fw, true);
  }
}

// --- Fourrure ---
function drawFur(lm, fw, fh) {
  const outline = [
    10, 338, 297, 332, 284, 251, 389, 356, 454,
    323, 361, 288, 397, 365, 379, 378, 400, 377,
    152, 148, 176, 149, 150, 136, 172, 58, 132,
    93, 234, 127, 162, 21, 54, 103, 67, 109, 10
  ];

  ctx.beginPath();
  ctx.moveTo(lm[outline[0]].x, lm[outline[0]].y);
  for (let i = 1; i < outline.length; i++) {
    const curr = lm[outline[i]];
    const prev = lm[outline[i - 1]];
    const cpx = (prev.x + curr.x) / 2;
    const cpy = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, cpx, cpy);
  }
  ctx.closePath();

  const cx = (lm[234].x + lm[454].x) / 2;
  const cy = (lm[10].y + lm[152].y) / 2;
  const grad = ctx.createRadialGradient(
    cx, cy - fh * 0.15, fw * 0.05,
    cx, cy, fw * 0.7
  );
  grad.addColorStop(0, 'rgba(222, 195, 150, 0.55)');
  grad.addColorStop(0.5, 'rgba(196, 164, 106, 0.5)');
  grad.addColorStop(1, 'rgba(170, 135, 80, 0.45)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(150, 120, 70, 0.25)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

// --- Oreilles ---
function drawEars(lm, top, fhL, fhR, fw, fh) {
  const earH = fw * 0.75;
  const earW = fw * 0.22;

  [{ base: fhL, dir: -1 }, { base: fhR, dir: 1 }].forEach(({ base, dir }) => {
    const bx = base.x + dir * fw * 0.05;
    const by = top.y - fh * 0.02;

    // Oreille exterieure
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.bezierCurveTo(
      bx + dir * earW * 0.3, by - earH * 0.3,
      bx + dir * earW * 1.3, by - earH * 0.95,
      bx + dir * earW * 0.4, by - earH
    );
    ctx.bezierCurveTo(
      bx - dir * earW * 0.2, by - earH * 0.7,
      bx - dir * earW * 0.1, by - earH * 0.3,
      bx, by
    );
    ctx.fillStyle = '#b08850';
    ctx.fill();
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Interieur de l'oreille
    ctx.beginPath();
    ctx.moveTo(bx + dir * earW * 0.05, by - fh * 0.06);
    ctx.bezierCurveTo(
      bx + dir * earW * 0.3,  by - earH * 0.35,
      bx + dir * earW * 1.05, by - earH * 0.85,
      bx + dir * earW * 0.35, by - earH * 0.9
    );
    ctx.bezierCurveTo(
      bx - dir * earW * 0.05, by - earH * 0.65,
      bx - dir * earW * 0.0,  by - earH * 0.3,
      bx + dir * earW * 0.05, by - fh * 0.06
    );
    ctx.fillStyle = '#deb89a';
    ctx.fill();

    // Reflet lumineux
    ctx.beginPath();
    ctx.moveTo(bx + dir * earW * 0.15, by - fh * 0.12);
    ctx.bezierCurveTo(
      bx + dir * earW * 0.35, by - earH * 0.45,
      bx + dir * earW * 0.8,  by - earH * 0.75,
      bx + dir * earW * 0.3,  by - earH * 0.8
    );
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

// --- Museau ---
function drawSnout(lm, nose, upperLip, lowerLip, chin, fw, fh) {
  const cx   = (nose.x + upperLip.x) / 2;
  const topY = nose.y - fw * 0.02;
  const botY = lowerLip.y + fw * 0.12;
  const sw   = fw * 0.38;
  const sh   = (botY - topY) / 2;

  ctx.beginPath();
  ctx.moveTo(cx - sw, topY + sh * 0.3);
  ctx.quadraticCurveTo(cx - sw, topY - sh * 0.1, cx - sw * 0.5, topY - sh * 0.05);
  ctx.quadraticCurveTo(cx, topY - sh * 0.15, cx + sw * 0.5, topY - sh * 0.05);
  ctx.quadraticCurveTo(cx + sw, topY - sh * 0.1, cx + sw, topY + sh * 0.3);
  ctx.quadraticCurveTo(cx + sw, botY, cx + sw * 0.6, botY + sh * 0.1);
  ctx.quadraticCurveTo(cx, botY + sh * 0.2, cx - sw * 0.6, botY + sh * 0.1);
  ctx.quadraticCurveTo(cx - sw, botY, cx - sw, topY + sh * 0.3);
  ctx.closePath();

  const grad = ctx.createLinearGradient(cx, topY, cx, botY + sh * 0.2);
  grad.addColorStop(0, 'rgba(210, 185, 145, 0.75)');
  grad.addColorStop(0.4, 'rgba(225, 200, 165, 0.7)');
  grad.addColorStop(1, 'rgba(235, 215, 180, 0.65)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 130, 80, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Ligne de la bouche
  const mouthY = (upperLip.y + lowerLip.y) / 2 + fw * 0.02;
  ctx.beginPath();
  ctx.moveTo(cx - sw * 0.5, mouthY);
  ctx.quadraticCurveTo(cx, mouthY + fw * 0.04, cx + sw * 0.5, mouthY);
  ctx.strokeStyle = 'rgba(100, 70, 40, 0.6)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Coins releves
  ctx.beginPath();
  ctx.moveTo(cx - sw * 0.5, mouthY);
  ctx.quadraticCurveTo(cx - sw * 0.6, mouthY - fw * 0.015, cx - sw * 0.65, mouthY - fw * 0.025);
  ctx.strokeStyle = 'rgba(100, 70, 40, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + sw * 0.5, mouthY);
  ctx.quadraticCurveTo(cx + sw * 0.6, mouthY - fw * 0.015, cx + sw * 0.65, mouthY - fw * 0.025);
  ctx.stroke();
}

// --- Gros nez ---
function drawBigNose(nose, fw) {
  const r  = fw * 0.1;
  const ny = nose.y + r * 0.1;

  // Ombre
  ctx.beginPath();
  ctx.ellipse(nose.x, ny + 3, r * 1.5, r * 1.05, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(40, 20, 10, 0.3)';
  ctx.fill();

  // Forme principale
  ctx.beginPath();
  ctx.ellipse(nose.x, ny, r * 1.45, r * 0.95, 0, 0, Math.PI * 2);
  const nGrad = ctx.createRadialGradient(
    nose.x - r * 0.2, ny - r * 0.2, r * 0.1,
    nose.x, ny, r * 1.4
  );
  nGrad.addColorStop(0, '#6b4430');
  nGrad.addColorStop(0.6, '#4a2e1c');
  nGrad.addColorStop(1, '#3a2010');
  ctx.fillStyle = nGrad;
  ctx.fill();
  ctx.strokeStyle = '#2a1508';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Narines
  [[-0.45, -0.15], [0.45, 0.15]].forEach(([ox, rot]) => {
    ctx.beginPath();
    ctx.ellipse(nose.x + r * ox, ny + r * 0.05, r * 0.38, r * 0.28, rot, 0, Math.PI * 2);
    ctx.fillStyle = '#1a0d05';
    ctx.fill();
  });

  // Reflet
  ctx.beginPath();
  ctx.ellipse(nose.x - r * 0.25, ny - r * 0.3, r * 0.2, r * 0.12, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fill();
}

// --- Bouche et dents ---
function drawMouth(upperLip, lowerLip, mouthL, mouthR, fw) {
  const cx      = upperLip.x;
  const lipGap  = lowerLip.y - upperLip.y;
  const isOpen  = lipGap > fw * 0.06;

  if (isOpen) {
    const mw = dist(mouthL, mouthR) * 0.6;
    ctx.beginPath();
    ctx.ellipse(cx, (upperLip.y + lowerLip.y) / 2, mw * 0.5, lipGap * 0.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2a0a0a';
    ctx.fill();
  }

  const tw  = fw * 0.055;
  const th  = fw * 0.08 + (isOpen ? lipGap * 0.3 : 0);
  const gap = fw * 0.01;
  const ty  = upperLip.y + fw * 0.01;

  // Ombres
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.beginPath();
  ctx.roundRect(cx - gap - tw + 2, ty + 2, tw, th, [0, 0, 4, 4]);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + gap + 2, ty + 2, tw, th, [0, 0, 4, 4]);
  ctx.fill();

  const tGrad = ctx.createLinearGradient(0, ty, 0, ty + th);
  tGrad.addColorStop(0, '#fffff5');
  tGrad.addColorStop(1, '#e8e0d0');

  // Dent gauche
  ctx.beginPath();
  ctx.roundRect(cx - gap - tw, ty, tw, th, [0, 0, 4, 4]);
  ctx.fillStyle = tGrad;
  ctx.fill();
  ctx.strokeStyle = '#c8c0b0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Dent droite
  ctx.beginPath();
  ctx.roundRect(cx + gap, ty, tw, th, [0, 0, 4, 4]);
  ctx.fillStyle = tGrad;
  ctx.fill();
  ctx.stroke();

  // Separation
  ctx.beginPath();
  ctx.moveTo(cx, ty);
  ctx.lineTo(cx, ty + th);
  ctx.strokeStyle = 'rgba(180, 170, 150, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// --- Yeux cartoon ---
function drawEyes(lI, rI, lIn, lOut, rIn, rOut, fw) {
  const r = fw * 0.075;

  [
    { iris: lI, inner: lIn, outer: lOut },
    { iris: rI, inner: rIn, outer: rOut }
  ].forEach(({ iris }) => {
    const cx = iris.x;
    const cy = iris.y;

    // Blanc
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.6, r * 1.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Iris
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
    const iGrad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 0.8);
    iGrad.addColorStop(0, '#5a3010');
    iGrad.addColorStop(0.7, '#3a1e0a');
    iGrad.addColorStop(1, '#2a1205');
    ctx.fillStyle = iGrad;
    ctx.fill();

    // Pupille
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // Grand reflet
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.22, cy - r * 0.25, r * 0.22, r * 0.18, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();

    // Petit reflet
    ctx.beginPath();
    ctx.arc(cx - r * 0.15, cy + r * 0.2, r * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();

    // Ombre paupiere
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.4, r * 1.4, r * 0.5, 0, 0, Math.PI);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fill();
  });
}

// --- Sourcils ---
function drawEyebrows(lm, fw) {
  const lBrow = [lm[70], lm[63], lm[105], lm[66], lm[107]];
  const rBrow = [lm[300], lm[293], lm[334], lm[296], lm[336]];

  [lBrow, rBrow].forEach(brow => {
    ctx.beginPath();
    ctx.moveTo(brow[0].x, brow[0].y - fw * 0.03);
    for (let i = 1; i < brow.length; i++) {
      ctx.lineTo(brow[i].x, brow[i].y - fw * 0.03);
    }
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = fw * 0.035;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  });
}

// --- Touffe de poils ---
function drawFurTuft(top, fw) {
  const cx    = top.x;
  const cy    = top.y;
  const tuftH = fw * 0.2;

  ctx.strokeStyle = '#b08850';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  for (let i = -3; i <= 3; i++) {
    const angle = -Math.PI / 2 + i * 0.15;
    const len   = tuftH * (1 - Math.abs(i) * 0.1);
    ctx.beginPath();
    ctx.moveTo(cx + i * fw * 0.02, cy);
    ctx.quadraticCurveTo(
      cx + i * fw * 0.04 + Math.cos(angle) * len * 0.5,
      cy + Math.sin(angle) * len * 0.5,
      cx + i * fw * 0.03 + Math.cos(angle) * len,
      cy + Math.sin(angle) * len
    );
    ctx.stroke();
  }
}

// --- Couronne ---
function drawCrown(top, fhL, fhR, fw, fh) {
  const cx = top.x;
  const cy = top.y - fh * 0.12;
  const cw = fw * 0.65;
  const ch = fw * 0.35;

  // Ombre
  ctx.beginPath();
  ctx.moveTo(cx - cw / 2 + 3, cy + ch * 0.4 + 3);
  ctx.lineTo(cx - cw / 2 + 3, cy + 3);
  ctx.lineTo(cx - cw * 0.2 + 3, cy + ch * 0.22 + 3);
  ctx.lineTo(cx + 3, cy - ch * 0.15 + 3);
  ctx.lineTo(cx + cw * 0.2 + 3, cy + ch * 0.22 + 3);
  ctx.lineTo(cx + cw / 2 + 3, cy + 3);
  ctx.lineTo(cx + cw / 2 + 3, cy + ch * 0.4 + 3);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fill();

  // Corps
  ctx.beginPath();
  ctx.moveTo(cx - cw / 2, cy + ch * 0.4);
  ctx.lineTo(cx - cw / 2, cy);
  ctx.lineTo(cx - cw * 0.2, cy + ch * 0.22);
  ctx.lineTo(cx, cy - ch * 0.15);
  ctx.lineTo(cx + cw * 0.2, cy + ch * 0.22);
  ctx.lineTo(cx + cw / 2, cy);
  ctx.lineTo(cx + cw / 2, cy + ch * 0.4);
  ctx.closePath();

  const cGrad = ctx.createLinearGradient(cx, cy - ch * 0.15, cx, cy + ch * 0.4);
  cGrad.addColorStop(0, '#ffe44d');
  cGrad.addColorStop(0.3, '#ffd700');
  cGrad.addColorStop(0.7, '#daa520');
  cGrad.addColorStop(1, '#b8860b');
  ctx.fillStyle = cGrad;
  ctx.fill();
  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Bandeau bas
  ctx.beginPath();
  ctx.moveTo(cx - cw / 2, cy + ch * 0.25);
  ctx.lineTo(cx + cw / 2, cy + ch * 0.25);
  ctx.lineTo(cx + cw / 2, cy + ch * 0.4);
  ctx.lineTo(cx - cw / 2, cy + ch * 0.4);
  ctx.closePath();
  ctx.fillStyle = '#c9a227';
  ctx.fill();
  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Rubis central
  const jy = cy + ch * 0.12;
  ctx.beginPath();
  ctx.arc(cx, jy, fw * 0.04, 0, Math.PI * 2);
  const jGrad = ctx.createRadialGradient(cx - fw * 0.01, jy - fw * 0.01, 0, cx, jy, fw * 0.04);
  jGrad.addColorStop(0, '#ff6b6b');
  jGrad.addColorStop(0.5, '#e74c3c');
  jGrad.addColorStop(1, '#a81010');
  ctx.fillStyle = jGrad;
  ctx.fill();
  ctx.strokeStyle = '#8b0000';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Reflet rubis
  ctx.beginPath();
  ctx.ellipse(cx - fw * 0.012, jy - fw * 0.015, fw * 0.012, fw * 0.008, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fill();

  // Emeraudes
  [cx - cw / 2, cx + cw / 2].forEach(jx => {
    ctx.beginPath();
    ctx.arc(jx, cy + fw * 0.01, fw * 0.022, 0, Math.PI * 2);
    ctx.fillStyle = '#2ecc71';
    ctx.fill();
    ctx.strokeStyle = '#1a8a4a';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Saphir haut
  ctx.beginPath();
  ctx.arc(cx, cy - ch * 0.15 + fw * 0.01, fw * 0.025, 0, Math.PI * 2);
  ctx.fillStyle = '#3498db';
  ctx.fill();
  ctx.strokeStyle = '#2070a0';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// --- Boucles d'oreilles ---
function drawEarring(lm, cheek, fw, right = false) {
  const x = cheek.x + (right ? fw * 0.08 : -fw * 0.08);
  const y = cheek.y + fw * 0.05;
  const r = fw * 0.04;

  // Anneau
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Pendant
  ctx.beginPath();
  ctx.arc(x, y + r * 1.5, r * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd700';
  ctx.fill();
}

// --- Demarrage ---
async function start() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 1280,
        height: 720,
        facingMode: 'user'
      }
    });

    video.srcObject = stream;
    await video.play();

    const cam = new Camera(video, {
      onFrame: async () => {
        await fm.send({ image: video });
      },
      width: 1280,
      height: 720
    });

    await cam.start();

    document.getElementById('loading').classList.add('hidden');

  } catch (e) {
    document.getElementById('loading').innerHTML =
      '<div style="color:#ff4757;font-size:1.5rem">Webcam necessaire !</div>';
  }
}

start();