/* ============================================================
   morra.js  —  Jeu de la Morra (p5.js 1.11.3 + ml5.js 1.2.1)
   ============================================================ */

// ── État global ──────────────────────────────────────────────────────────────
const state = {
  playerFingers:   null,   // doigts détectés par HandPose (0-5)
  selectedAnnounce: null,  // chiffre annoncé par le joueur (0-10)
  playerScore:     0,
  computerScore:   0,
  rounds:          0,
  modelReady:      false,
};

// ── Raccourcis DOM ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Tableau de scores ─────────────────────────────────────────────────────────
function updateScoreboard() {
  $('player-score').textContent   = state.playerScore;
  $('computer-score').textContent = state.computerScore;
  $('round-count').textContent    = state.rounds;
}

// ── Boutons d'annonce (0 à 10) ────────────────────────────────────────────────
function buildAnnounceButtons() {
  const container = $('announce-buttons');
  for (let i = 0; i <= 10; i++) {
    const btn = document.createElement('button');
    btn.className      = 'btn-number';
    btn.textContent    = i;
    btn.dataset.value  = i;
    btn.addEventListener('click', () => selectAnnounce(i));
    container.appendChild(btn);
  }
}

function selectAnnounce(val) {
  state.selectedAnnounce = val;
  document.querySelectorAll('.btn-number').forEach(b => {
    b.classList.toggle('selected', parseInt(b.dataset.value) === val);
  });
  checkCanPlay();
}

// ── Activation du bouton "Jouer" ──────────────────────────────────────────────
function checkCanPlay() {
  $('btn-play').disabled = !(
    state.modelReady &&
    state.playerFingers !== null &&
    state.selectedAnnounce !== null
  );
}

// ── Comptage des doigts (keypoints HandPose) ──────────────────────────────────
//  Landmarks : 0=poignet, 4=pouce tip, 2=pouce mcp,
//              8/6 index, 12/10 majeur, 16/14 annulaire, 20/18 auriculaire
function countFingers(keypoints) {
  if (!keypoints || keypoints.length < 21) return 0;

  let count = 0;

  // Pouce : on compare la distance horizontale vs verticale
  const thumbTip = keypoints[4];
  const thumbMcp = keypoints[2];
  if (thumbTip && thumbMcp) {
    const dx = Math.abs(thumbTip.x - thumbMcp.x);
    const dy = Math.abs(thumbTip.y - thumbMcp.y);
    if (dx > dy ? thumbTip.x > thumbMcp.x : thumbTip.y < thumbMcp.y) count++;
  }

  // 4 autres doigts : tip plus haut (y plus petit) que pip = doigt levé
  const fingerPairs = [[8, 6], [12, 10], [16, 14], [20, 18]];
  fingerPairs.forEach(([tip, pip]) => {
    const tipKp = keypoints[tip];
    const pipKp = keypoints[pip];
    if (tipKp && pipKp && tipKp.y < pipKp.y) count++;
  });

  return count;
}

// ── Logique d'une manche ──────────────────────────────────────────────────────
function playRound() {
  if (state.playerFingers === null || state.selectedAnnounce === null) return;

  const computerFingers  = Math.floor(Math.random() * 6);        // 0-5
  const computerAnnounce = Math.floor(Math.random() * 11);       // 0-10
  const realSum          = state.playerFingers + computerFingers;

  const playerCorrect   = state.selectedAnnounce === realSum;
  const computerCorrect = computerAnnounce       === realSum;

  state.rounds++;

  let outcome, cssClass;
  if (playerCorrect && !computerCorrect) {
    state.playerScore++;
    outcome  = '🎉 Vous gagnez !';
    cssClass = 'win';
  } else if (!playerCorrect && computerCorrect) {
    state.computerScore++;
    outcome  = "💻 L'ordinateur gagne";
    cssClass = 'lose';
  } else if (playerCorrect && computerCorrect) {
    outcome  = '🤝 Égalité parfaite !';
    cssClass = 'draw';
  } else {
    outcome  = '😶 Personne ne gagne';
    cssClass = 'draw';
  }

  updateScoreboard();

  $('disp-player').textContent   = state.playerFingers;
  $('disp-computer').textContent = computerFingers;

  const box = $('result-box');
  box.className = 'result-box ' + cssClass;
  box.innerHTML = `
    <div class="result-title">${outcome}</div>
    <div class="result-detail">
      Somme réelle : <strong>${realSum}</strong> &nbsp;|&nbsp;
      Votre annonce : <strong>${state.selectedAnnounce}</strong> &nbsp;|&nbsp;
      Ordi annonce : <strong>${computerAnnounce}</strong>
    </div>
  `;
}

// ── Réinitialisation des scores ───────────────────────────────────────────────
function resetGame() {
  state.playerScore      = 0;
  state.computerScore    = 0;
  state.rounds           = 0;
  state.selectedAnnounce = null;

  updateScoreboard();
  document.querySelectorAll('.btn-number').forEach(b => b.classList.remove('selected'));
  $('disp-player').textContent   = '–';
  $('disp-computer').textContent = '–';

  const box = $('result-box');
  box.className = 'result-box waiting';
  box.innerHTML = `
    <div class="result-title">–</div>
    <div class="result-detail">Choisissez votre annonce et jouez</div>
  `;
  $('btn-play').disabled = true;
}

// ── Sketch p5.js ──────────────────────────────────────────────────────────────
const sketch = (p) => {
  let capture;
  let handpose;
  let keypointsToRender = [];

  const statusEl   = $('status-bar');
  const detectedEl = $('detected-fingers');

  // Connexions du squelette de la main (paires d'indices)
  const CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],       // pouce
    [0,5],[5,6],[6,7],[7,8],       // index
    [5,9],[9,10],[10,11],[11,12],  // majeur
    [9,13],[13,14],[14,15],[15,16],// annulaire
    [13,17],[17,18],[18,19],[19,20],[0,17] // auriculaire
  ];

  const TIP_INDICES = new Set([4, 8, 12, 16, 20]);

  p.setup = () => {
    const container = $('canvas-container');
    const w = container.offsetWidth || 480;
    const h = Math.round(w * 0.75);

    const cnv = p.createCanvas(w, h);
    cnv.parent('canvas-container');

    // On attend que la caméra soit prête avant de charger le modèle
    capture = p.createCapture(p.VIDEO, () => { initHandpose(); });
    capture.size(w, h);
    capture.hide();

    statusEl.textContent = 'Initialisation de la caméra…';
  };

  // async : await garantit que TensorFlow a fini de charger les poids
  // avant d'appeler detectLoop, évitant "this.model is null"
  async function initHandpose() {
    statusEl.textContent = 'Chargement du modèle HandPose…';
    try {
      handpose = await ml5.handPose({ maxHands: 1 });

      statusEl.textContent = '✅ Modèle prêt — montrez votre main !';
      state.modelReady = true;
      checkCanPlay();

      handpose.detectLoop(capture, (results) => {
        if (results && results.length > 0) {
          const hand = results[0];
          keypointsToRender = hand.keypoints || hand.landmarks || [];
          const fingers = countFingers(keypointsToRender);
          state.playerFingers = fingers;
          detectedEl.textContent = fingers;
        } else {
          keypointsToRender      = [];
          state.playerFingers    = null;
          detectedEl.textContent = '–';
        }
        checkCanPlay();
      });

    } catch (err) {
      statusEl.textContent = '❌ Erreur : ' + err.message;
      console.error('HandPose init error:', err);
    }
  }

  p.draw = () => {
    p.background(20, 20, 40);

    // Image caméra en miroir
    if (capture.width > 0) {
      p.push();
      p.translate(p.width, 0);
      p.scale(-1, 1);
      p.image(capture, 0, 0, p.width, p.height);
      p.pop();
    }

    // Squelette de la main
    if (keypointsToRender.length > 0) {
      // Lignes
      p.stroke(91, 200, 245, 180);
      p.strokeWeight(2);
      CONNECTIONS.forEach(([a, b]) => {
        const ka = keypointsToRender[a];
        const kb = keypointsToRender[b];
        if (ka && kb) {
          p.line(p.width - ka.x, ka.y, p.width - kb.x, kb.y);
        }
      });

      // Points
      keypointsToRender.forEach((kp, i) => {
        if (!kp) return;
        const x = p.width - kp.x;
        const isTip = TIP_INDICES.has(i);
        p.noStroke();
        p.fill(isTip ? '#e0c96e' : '#5bc8f5');
        p.circle(x, kp.y, isTip ? 10 : 6);
      });

      // Badge "nombre de doigts" en haut à droite
      if (state.playerFingers !== null) {
        p.noStroke();
        p.fill(0, 0, 0, 150);
        p.rect(p.width - 76, 10, 66, 44, 10);
        p.fill('#e0c96e');
        p.textSize(28);
        p.textAlign(p.CENTER, p.CENTER);
        p.text(state.playerFingers, p.width - 43, 32);
      }
    }

    // Message de chargement
    if (!state.modelReady) {
      p.noStroke();
      p.fill(255, 255, 255, 200);
      p.textSize(14);
      p.textAlign(p.CENTER, p.CENTER);
      p.text('Chargement…', p.width / 2, p.height / 2);
    }
  };

  p.windowResized = () => {
    const container = $('canvas-container');
    const w = container.offsetWidth;
    const h = Math.round(w * 0.75);
    p.resizeCanvas(w, h);
    capture.size(w, h);
  };
};

// ── Initialisation ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildAnnounceButtons();
  updateScoreboard();
  $('btn-play').addEventListener('click', playRound);
  $('btn-reset').addEventListener('click', resetGame);
  new p5(sketch);
});