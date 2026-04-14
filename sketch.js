/* ============================================================
   morra.js  -  Jeu de la Morra (p5.js 1.11.3 + ml5.js 1.2.1)
   API ml5 v1.x : handPose() dans preload(), detectStart() dans setup()
   ============================================================ */

// ── Etat global ───────────────────────────────────────────────────────────────
const state = {
  playerFingers:    null,
  selectedAnnounce: null,
  playerScore:      0,
  computerScore:    0,
  rounds:           0,
  modelReady:       false,
};

const $ = id => document.getElementById(id);

function updateScoreboard() {
  $('player-score').textContent   = state.playerScore;
  $('computer-score').textContent = state.computerScore;
  $('round-count').textContent    = state.rounds;
}

function buildAnnounceButtons() {
  const container = $('announce-buttons');
  for (let i = 0; i <= 10; i++) {
    const btn = document.createElement('button');
    btn.className     = 'btn-number';
    btn.textContent   = i;
    btn.dataset.value = i;
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

function checkCanPlay() {
  $('btn-play').disabled = !(
    state.modelReady &&
    state.playerFingers !== null &&
    state.selectedAnnounce !== null
  );
}

function countFingers(keypoints) {
  if (!keypoints || keypoints.length < 21) return 0;
  let count = 0;
  const thumbTip = keypoints[4];
  const thumbMcp = keypoints[2];
  if (thumbTip && thumbMcp) {
    const dx = Math.abs(thumbTip.x - thumbMcp.x);
    const dy = Math.abs(thumbTip.y - thumbMcp.y);
    if (dx > dy ? thumbTip.x > thumbMcp.x : thumbTip.y < thumbMcp.y) count++;
  }
  [[8,6],[12,10],[16,14],[20,18]].forEach(([tip, pip]) => {
    const t = keypoints[tip], pi = keypoints[pip];
    if (t && pi && t.y < pi.y) count++;
  });
  return count;
}

function playRound() {
  if (state.playerFingers === null || state.selectedAnnounce === null) return;
  const computerFingers  = Math.floor(Math.random() * 6);
  const computerAnnounce = Math.floor(Math.random() * 11);
  const realSum          = state.playerFingers + computerFingers;
  const playerCorrect    = state.selectedAnnounce === realSum;
  const computerCorrect  = computerAnnounce === realSum;
  state.rounds++;
  let outcome, cssClass;
  if (playerCorrect && !computerCorrect) {
    state.playerScore++;
    outcome = 'Vous gagnez !'; cssClass = 'win';
  } else if (!playerCorrect && computerCorrect) {
    state.computerScore++;
    outcome = "L'ordinateur gagne"; cssClass = 'lose';
  } else if (playerCorrect && computerCorrect) {
    outcome = 'Egalite parfaite !'; cssClass = 'draw';
  } else {
    outcome = 'Personne ne gagne'; cssClass = 'draw';
  }
  updateScoreboard();
  $('disp-player').textContent   = state.playerFingers;
  $('disp-computer').textContent = computerFingers;
  const box = $('result-box');
  box.className = 'result-box ' + cssClass;
  box.innerHTML =
    '<div class="result-title">' + outcome + '</div>' +
    '<div class="result-detail">Somme reelle : <strong>' + realSum +
    '</strong> | Votre annonce : <strong>' + state.selectedAnnounce +
    '</strong> | Ordi annonce : <strong>' + computerAnnounce + '</strong></div>';
}

function resetGame() {
  state.playerScore = 0; state.computerScore = 0;
  state.rounds = 0; state.selectedAnnounce = null;
  updateScoreboard();
  document.querySelectorAll('.btn-number').forEach(b => b.classList.remove('selected'));
  $('disp-player').textContent   = '-';
  $('disp-computer').textContent = '-';
  const box = $('result-box');
  box.className = 'result-box waiting';
  box.innerHTML = '<div class="result-title">-</div>' +
    '<div class="result-detail">Choisissez votre annonce et jouez</div>';
  $('btn-play').disabled = true;
}

// ── Sketch p5.js ──────────────────────────────────────────────────────────────
const sketch = function(p) {
  let capture, handpose, hands = [];

  const statusEl   = $('status-bar');
  const detectedEl = $('detected-fingers');

  const CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],[0,17]
  ];
  const TIPS = [4, 8, 12, 16, 20];

  // preload() : ml5 v1.x recommande de creer le modele ici
  p.preload = function() {
    handpose = ml5.handPose({ maxHands: 1 });
  };

  p.setup = function() {
    const container = $('canvas-container');
    const w = container.offsetWidth || 480;
    const h = Math.round(w * 0.75);
    p.createCanvas(w, h).parent('canvas-container');

    capture = p.createCapture(p.VIDEO);
    capture.size(w, h);
    capture.hide();

    statusEl.textContent = 'Demarrage de la detection...';

    // detectStart() = la bonne methode ml5 v1.x pour une boucle continue
    handpose.detectStart(capture, function(results) {
      hands = results;

      if (!state.modelReady) {
        statusEl.textContent = 'Modele pret - montrez votre main !';
        state.modelReady = true;
        checkCanPlay();
      }

      if (hands && hands.length > 0) {
        const kps = hands[0].keypoints;
        const fingers = countFingers(kps);
        state.playerFingers = fingers;
        detectedEl.textContent = fingers;
      } else {
        state.playerFingers    = null;
        detectedEl.textContent = '-';
      }
      checkCanPlay();
    });
  };

  p.draw = function() {
    p.background(20, 20, 40);
    if (capture && capture.width > 0) {
      p.push(); p.translate(p.width, 0); p.scale(-1, 1);
      p.image(capture, 0, 0, p.width, p.height);
      p.pop();
    }
    if (hands && hands.length > 0) {
      const kps = hands[0].keypoints;
      if (kps && kps.length > 0) {
        // Lignes du squelette
        p.stroke(91, 200, 245, 180); p.strokeWeight(2);
        CONNECTIONS.forEach(([a, b]) => {
          const ka = kps[a], kb = kps[b];
          if (ka && kb) p.line(p.width - ka.x, ka.y, p.width - kb.x, kb.y);
        });
        // Points
        kps.forEach((kp, i) => {
          if (!kp) return;
          p.noStroke();
          p.fill(TIPS.includes(i) ? '#e0c96e' : '#5bc8f5');
          p.circle(p.width - kp.x, kp.y, TIPS.includes(i) ? 10 : 6);
        });
        // Badge nombre de doigts
        if (state.playerFingers !== null) {
          p.noStroke(); p.fill(0, 0, 0, 150);
          p.rect(p.width - 76, 10, 66, 44, 10);
          p.fill('#e0c96e'); p.textSize(28);
          p.textAlign(p.CENTER, p.CENTER);
          p.text(state.playerFingers, p.width - 43, 32);
        }
      }
    }
    if (!state.modelReady) {
      p.noStroke(); p.fill(255, 255, 255, 200);
      p.textSize(14); p.textAlign(p.CENTER, p.CENTER);
      p.text('Chargement...', p.width / 2, p.height / 2);
    }
  };

  p.windowResized = function() {
    const container = $('canvas-container');
    const w = container.offsetWidth;
    const h = Math.round(w * 0.75);
    p.resizeCanvas(w, h);
    if (capture) capture.size(w, h);
  };
};

document.addEventListener('DOMContentLoaded', function() {
  buildAnnounceButtons();
  updateScoreboard();
  $('btn-play').addEventListener('click', playRound);
  $('btn-reset').addEventListener('click', resetGame);
  new p5(sketch);
});