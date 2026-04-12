// ─── VARIABLES GLOBALES ───────────────────────────────────────────────────────
let videoCapture;
let handPose;
let hands = [];

let scoreJoueur = 0;
let scoreOrdi = 0;
let messageAction = "";
let messageResultat = "";
let ordiDoigts = 0;
let ordiSommeAnnoncee = 0;
let maSommeAnnoncee = 0;

let jeuEnCours = false;
let phaseJeu = "ATTENTE";
let isMobile = false;
let speechSupported = false;
let recognition = null;

let animResultat = 0;
let dernierResultatType = ""; // "win", "lose", "draw", "none"

// boutons numériques fallback
const NUM_BUTTONS = [0,1,2,3,4,5,6,7,8,9,10];
let btnW, btnH;

// keypoints
const fingerTips = ["index_finger_tip","middle_finger_tip","ring_finger_tip","pinky_finger_tip"];
const fingerPips = ["index_finger_pip","middle_finger_pip","ring_finger_pip","pinky_finger_pip"];

// ─── PRELOAD ──────────────────────────────────────────────────────────────────
function preload() {
    handPose = ml5.handPose({ flipped: true });
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
function setup() {
    createCanvas(windowWidth, windowHeight);
    textFont("Arial");

    videoCapture = createCapture(VIDEO, { flipped: true });
    videoCapture.size(640, 480);
    videoCapture.hide();
    handPose.detectStart(videoCapture, gotHands);

    isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    // SpeechRecognition
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
        speechSupported = true;
        recognition = new SR();
        recognition.lang = 'fr-FR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            let parole = event.results[0][0].transcript.toLowerCase();
            let matches = parole.match(/\d+/);
            if (matches) {
                maSommeAnnoncee = parseInt(matches[0]);
                verifierGagnant();
            } else if (parole.includes("zéro") || parole.includes("zero")) {
                maSommeAnnoncee = 0;
                verifierGagnant();
            }
        };

        recognition.onerror = () => {
            phaseJeu = "ATTENTE";
        };

        recognition.onend = () => {
            if (jeuEnCours && phaseJeu === "RESULTAT") {
                setTimeout(lancerManche, 2500);
            }
        };
    }

    // taille boutons fallback
    btnW = min(60, (windowWidth - 40) / NUM_BUTTONS.length - 4);
    btnH = 52;
}

// ─── DRAW ─────────────────────────────────────────────────────────────────────
function draw() {
    background(0);

    // vidéo en fond plein écran
    push();
    tint(200);
    image(videoCapture, 0, 0, width, height);
    pop();

    // vignette sombre sur les bords
    drawVignette();

    let mesDoigts = 0;
    if (hands.length > 0) {
        mesDoigts = countFingers(hands[0]);
        drawHandFeedback(hands[0], mesDoigts);
    }

    // animation résultat
    if (phaseJeu === "RESULTAT") {
        animResultat = min(animResultat + 0.08, 1);
    } else {
        animResultat = 0;
    }

    displayUI(mesDoigts);
}

// ─── VIGNETTE ─────────────────────────────────────────────────────────────────
function drawVignette() {
    noStroke();
    for (let i = 0; i < 80; i++) {
        let alpha = map(i, 0, 80, 120, 0);
        fill(0, alpha);
        rect(i, i, width - i*2, height - i*2);
    }
}

// ─── UI ───────────────────────────────────────────────────────────────────────
function displayUI(mesDoigts) {
    // ── PANNEAU SCORES ──────────────────────────────────────────────────────
    let panW = min(420, width - 40);
    let panX = 20;
    let panY = 20;

    // fond semi-transparent arrondi
    drawRoundedPanel(panX, panY, panW, 110, 14, 0, 0, 0, 200);

    // titre
    fill(255, 200);
    noStroke();
    textSize(11);
    textAlign(LEFT, TOP);
    text("MORRA — JEU DE DOIGTS", panX + 16, panY + 14);

    // scores
    let scoreY = panY + 36;
    drawScoreBadge("VOUS", scoreJoueur, panX + 16, scoreY, color(30, 180, 100));
    drawScoreBadge("ORDI", scoreOrdi, panX + panW/2, scoreY, color(220, 60, 60));

    // séparateur
    stroke(255, 30);
    strokeWeight(1);
    line(panX + 12, panY + 82, panX + panW - 12, panY + 82);
    noStroke();

    // message action
    let actionColor = color(255);
    if (phaseJeu === "ECOUTE") actionColor = color(0, 210, 255);
    if (phaseJeu === "ATTENTE") actionColor = color(255, 220, 80);
    fill(actionColor);
    textSize(13);
    textAlign(LEFT, TOP);
    text(messageAction !== "" ? messageAction : getMessageAttente(), panX + 16, panY + 90);

    // ── PANNEAU RÉSULTAT ────────────────────────────────────────────────────
    if (phaseJeu === "RESULTAT" && animResultat > 0) {
        let rY = panY + 125;
        let alpha = int(animResultat * 220);
        drawRoundedPanel(panX, rY, panW, 90, 14, 0, 0, 0, alpha);

        // couleur selon résultat
        let rColor = color(255, 255, 0);
        if (dernierResultatType === "win") rColor = color(30, 220, 100);
        else if (dernierResultatType === "lose") rColor = color(220, 60, 60);

        fill(rColor[0] || red(rColor), green(rColor), blue(rColor), int(animResultat * 255));
        textSize(20);
        textAlign(LEFT, TOP);
        text(messageResultat, panX + 16, rY + 14);

        fill(255, int(animResultat * 180));
        textSize(13);
        text(messageAction, panX + 16, rY + 46);

        fill(255, int(animResultat * 120));
        textSize(12);
        text(`Annonces → Moi: ${maSommeAnnoncee}  |  Ordi: ${ordiSommeAnnoncee}`, panX + 16, rY + 68);
    }

    // ── ORDI (doigts affichés en haut à droite) ─────────────────────────────
    if (jeuEnCours && phaseJeu !== "ATTENTE") {
        drawOrdiHand(width - 180, 20);
    }

    // ── BOUTONS NUMÉRIQUES FALLBACK ─────────────────────────────────────────
    if (!speechSupported && jeuEnCours && phaseJeu === "ECOUTE") {
        drawNumberButtons();
    }

    // ── BOUTON START/STOP ───────────────────────────────────────────────────
    drawStartButton();

    // ── INDICATEUR MICRO ────────────────────────────────────────────────────
    if (speechSupported && jeuEnCours && phaseJeu === "ECOUTE") {
        drawMicIndicator();
    }

    // ── DOIGTS DÉTECTÉS ────────────────────────────────────────────────────
    fill(255, 150);
    textSize(12);
    textAlign(LEFT, BOTTOM);
    text("Doigts détectés : " + mesDoigts, 20, height - 16);

    textAlign(LEFT, TOP);
}

// ─── ORDI MAIN VISUELLE ───────────────────────────────────────────────────────
function drawOrdiHand(x, y) {
    let w = 160, h = 100;
    drawRoundedPanel(x, y, w, h, 12, 0, 0, 0, 180);

    fill(255, 150);
    textSize(10);
    textAlign(CENTER, TOP);
    text("ORDI ANNONCE", x + w/2, y + 10);

    // afficher doigts ordi comme icônes
    textSize(22);
    text(fingersEmoji(ordiDoigts), x + w/2, y + 30);

    fill(220, 60, 60);
    textSize(18);
    textAlign(CENTER, TOP);
    text("somme : " + ordiSommeAnnoncee, x + w/2, y + 65);

    textAlign(LEFT, TOP);
}

function fingersEmoji(n) {
    const icons = ["✊","☝","✌","🤌","🖖","🖐","🖐"];
    return icons[min(n, 6)] + " ×" + n;
}

// ─── SCORE BADGE ──────────────────────────────────────────────────────────────
function drawScoreBadge(label, score, x, y, col) {
    fill(red(col), green(col), blue(col), 40);
    noStroke();
    rect(x, y, 160, 40, 8);
    fill(red(col), green(col), blue(col));
    textSize(11);
    textAlign(LEFT, TOP);
    text(label, x + 10, y + 8);
    textSize(22);
    text(score, x + 10, y + 18);
}

// ─── BOUTON START/STOP ────────────────────────────────────────────────────────
function drawStartButton() {
    let bw = 160, bh = 44;
    let bx = width/2 - bw/2;
    let by = height - bh - 20;

    let col = jeuEnCours ? color(180, 40, 40) : color(30, 160, 80);
    fill(red(col), green(col), blue(col), 230);
    noStroke();
    rect(bx, by, bw, bh, 22);

    fill(255);
    textSize(15);
    textAlign(CENTER, CENTER);
    text(jeuEnCours ? "⏹ STOP" : "▶ DÉMARRER", bx + bw/2, by + bh/2);
    textAlign(LEFT, TOP);
}

// ─── BOUTONS NUMÉRIQUES ───────────────────────────────────────────────────────
function drawNumberButtons() {
    let totalW = NUM_BUTTONS.length * (btnW + 4) - 4;
    let startX = width/2 - totalW/2;
    let startY = height - btnH - 80;

    drawRoundedPanel(startX - 10, startY - 10, totalW + 20, btnH + 28, 10, 0, 0, 0, 180);

    fill(255, 180);
    textSize(11);
    textAlign(CENTER, TOP);
    text("Tapez votre somme", width/2, startY - 6);

    for (let i = 0; i < NUM_BUTTONS.length; i++) {
        let x = startX + i * (btnW + 4);
        fill(40, 100, 200, 200);
        noStroke();
        rect(x, startY, btnW, btnH, 8);
        fill(255);
        textSize(16);
        textAlign(CENTER, CENTER);
        text(NUM_BUTTONS[i], x + btnW/2, startY + btnH/2);
    }
    textAlign(LEFT, TOP);
}

// ─── INDICATEUR MICRO ─────────────────────────────────────────────────────────
function drawMicIndicator() {
    let pulse = 0.5 + 0.5 * sin(frameCount * 0.15);
    fill(255, 0, 0, int(180 + pulse * 75));
    noStroke();
    ellipse(width - 30, 30, 14, 14);
    fill(255, int(150 + pulse * 100));
    textSize(11);
    textAlign(RIGHT, CENTER);
    text("ÉCOUTE...", width - 44, 30);
    textAlign(LEFT, TOP);
}

// ─── HAND FEEDBACK ────────────────────────────────────────────────────────────
function drawHandFeedback(hand, count) {
    // dessiner les connexions entre keypoints
    let connections = [
        ["wrist","thumb_cmc"],["thumb_cmc","thumb_mcp"],["thumb_mcp","thumb_ip"],["thumb_ip","thumb_tip"],
        ["wrist","index_finger_mcp"],["index_finger_mcp","index_finger_pip"],["index_finger_pip","index_finger_dip"],["index_finger_dip","index_finger_tip"],
        ["wrist","middle_finger_mcp"],["middle_finger_mcp","middle_finger_pip"],["middle_finger_pip","middle_finger_dip"],["middle_finger_dip","middle_finger_tip"],
        ["wrist","ring_finger_mcp"],["ring_finger_mcp","ring_finger_pip"],["ring_finger_pip","ring_finger_dip"],["ring_finger_dip","ring_finger_tip"],
        ["wrist","pinky_finger_mcp"],["pinky_finger_mcp","pinky_finger_pip"],["pinky_finger_pip","pinky_finger_dip"],["pinky_finger_dip","pinky_finger_tip"],
    ];

    stroke(0, 255, 140, 160);
    strokeWeight(2);
    for (let c of connections) {
        let a = getKeypointsByName(hand, c[0]);
        let b = getKeypointsByName(hand, c[1]);
        if (a && b) {
            let ax = map(a.x, 0, 640, 0, width);
            let ay = map(a.y, 0, 480, 0, height);
            let bx = map(b.x, 0, 640, 0, width);
            let by = map(b.y, 0, 480, 0, height);
            line(ax, ay, bx, by);
        }
    }

    // points
    noStroke();
    for (let kp of hand.keypoints) {
        let kx = map(kp.x, 0, 640, 0, width);
        let ky = map(kp.y, 0, 480, 0, height);
        fill(0, 255, 140, 200);
        ellipse(kx, ky, 8, 8);
    }

    // compteur sur poignet
    let wrist = getKeypointsByName(hand, "wrist");
    if (wrist) {
        let wx = map(wrist.x, 0, 640, 0, width);
        let wy = map(wrist.y, 0, 480, 0, height);
        fill(0, 220);
        noStroke();
        rect(wx + 12, wy - 18, 32, 24, 6);
        fill(0, 255, 140);
        textSize(16);
        textAlign(CENTER, CENTER);
        text(count, wx + 28, wy - 6);
        textAlign(LEFT, TOP);
    }
    noStroke();
}

// ─── PANNEAU ARRONDI ─────────────────────────────────────────────────────────
function drawRoundedPanel(x, y, w, h, r, red_, green_, blue_, alpha_) {
    fill(red_, green_, blue_, alpha_);
    noStroke();
    rect(x, y, w, h, r);
}

// ─── MESSAGE ATTENTE ─────────────────────────────────────────────────────────
function getMessageAttente() {
    let ctrl = isMobile ? "Touchez le bouton" : "Appuyez ESPACE";
    return ctrl + " pour DÉMARRER";
}

// ─── LOGIQUE JEU ─────────────────────────────────────────────────────────────
function lancerManche() {
    if (!jeuEnCours) return;

    ordiDoigts = floor(random(0, 6));
    ordiSommeAnnoncee = floor(random(0, 11));

    if (speechSupported) {
        phaseJeu = "ECOUTE";
        messageAction = "Dites votre somme...";
        try { recognition.start(); } catch(e) {}
    } else {
        phaseJeu = "ECOUTE";
        messageAction = "Choisissez votre somme ci-dessous";
    }
}

function verifierGagnant() {
    let mesDoigts = hands.length > 0 ? countFingers(hands[0]) : 0;
    let totalReel = mesDoigts + ordiDoigts;

    let joueurGagne = (maSommeAnnoncee === totalReel);
    let ordiGagne = (ordiSommeAnnoncee === totalReel);

    if (joueurGagne && ordiGagne) {
        scoreJoueur++; scoreOrdi++;
        messageResultat = "ÉGALITÉ PARFAITE !";
        dernierResultatType = "draw";
    } else if (joueurGagne) {
        scoreJoueur++;
        messageResultat = "VOUS MARQUEZ UN POINT !";
        dernierResultatType = "win";
    } else if (ordiGagne) {
        scoreOrdi++;
        messageResultat = "L'ORDI MARQUE UN POINT !";
        dernierResultatType = "lose";
    } else {
        messageResultat = "PERSONNE N'A TROUVÉ !";
        dernierResultatType = "none";
    }

    messageAction = `Moi: ${mesDoigts} + Ordi: ${ordiDoigts} = ${totalReel}`;
    phaseJeu = "RESULTAT";
    animResultat = 0;

    // si pas de speechRecognition, on relance manuellement après délai
    if (!speechSupported) {
        setTimeout(lancerManche, 2800);
    }
}

// ─── START / STOP ─────────────────────────────────────────────────────────────
function handleStartStop() {
    jeuEnCours = !jeuEnCours;

    if (jeuEnCours) {
        messageAction = "";
        lancerManche();
    } else {
        phaseJeu = "ATTENTE";
        messageAction = "";
        messageResultat = "";
        if (recognition) try { recognition.stop(); } catch(e) {}
    }
}

// ─── INPUTS ──────────────────────────────────────────────────────────────────
function keyPressed() {
    if (!isMobile && key === ' ') {
        handleStartStop();
    }
}

function touchStarted() {
    // boutons numériques
    if (!speechSupported && jeuEnCours && phaseJeu === "ECOUTE") {
        let totalW = NUM_BUTTONS.length * (btnW + 4) - 4;
        let startX = width/2 - totalW/2;
        let startY = height - btnH - 80;

        for (let i = 0; i < NUM_BUTTONS.length; i++) {
            let bx = startX + i * (btnW + 4);
            if (mouseX > bx && mouseX < bx + btnW && mouseY > startY && mouseY < startY + btnH) {
                maSommeAnnoncee = NUM_BUTTONS[i];
                verifierGagnant();
                return false;
            }
        }
    }

    // bouton start/stop
    let bw = 160, bh = 44;
    let bx = width/2 - bw/2;
    let by = height - bh - 20;
    if (mouseX > bx && mouseX < bx + bw && mouseY > by && mouseY < by + bh) {
        handleStartStop();
        return false;
    }

    return false;
}

function mousePressed() {
    // boutons numériques (desktop)
    if (!speechSupported && jeuEnCours && phaseJeu === "ECOUTE") {
        let totalW = NUM_BUTTONS.length * (btnW + 4) - 4;
        let startX = width/2 - totalW/2;
        let startY = height - btnH - 80;

        for (let i = 0; i < NUM_BUTTONS.length; i++) {
            let bx = startX + i * (btnW + 4);
            if (mouseX > bx && mouseX < bx + btnW && mouseY > startY && mouseY < startY + btnH) {
                maSommeAnnoncee = NUM_BUTTONS[i];
                verifierGagnant();
                return;
            }
        }
    }

    // bouton start/stop
    let bw = 160, bh = 44;
    let bx = width/2 - bw/2;
    let by = height - bh - 20;
    if (mouseX > bx && mouseX < bx + bw && mouseY > by && mouseY < by + bh) {
        handleStartStop();
    }
}

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────
function countFingers(hand) {
    let count = 0;
    for (let i = 0; i < fingerTips.length; i++) {
        let tip = getKeypointsByName(hand, fingerTips[i]);
        let pip = getKeypointsByName(hand, fingerPips[i]);
        if (tip && pip && tip.y < pip.y) count++;
    }
    let thumbTip = getKeypointsByName(hand, "thumb_tip");
    let thumbIp  = getKeypointsByName(hand, "thumb_ip");
    let pinkyMcp = getKeypointsByName(hand, "pinky_finger_mcp");
    if (thumbTip && thumbIp && pinkyMcp) {
        if (dist(thumbTip.x, thumbTip.y, pinkyMcp.x, pinkyMcp.y) > 80) count++;
    }
    return count;
}

function gotHands(results) { hands = results; }
function getKeypointsByName(hand, name) { return hand.keypoints.find(kp => kp.name === name); }
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    btnW = min(60, (windowWidth - 40) / NUM_BUTTONS.length - 4);
}