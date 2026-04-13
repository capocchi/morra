let videoCapture;
let handPose;
let hands = [];

let scoreJoueur = 0;
let scoreOrdi = 0;
let messageAction = "Appuyez sur ESPACE pour DEMARRER";
let messageResultat = "";
let ordiDoigts = 0;
let ordiSommeAnnoncee = 0;
let maSommeAnnoncee = 0;

let jeuEnCours = false;
let phaseJeu = "ATTENTE";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'fr-FR';
recognition.continuous = false;
recognition.interimResults = false;

const fingerTips = ["index_finger_tip", "middle_finger_tip", "ring_finger_tip", "pinky_finger_tip"];
const fingerPips = ["index_finger_pip", "middle_finger_pip", "ring_finger_pip", "pinky_finger_pip"];

// ✅ PLUS de preload() — on utilise async setup() pour p5.js 2.x
async function setup() {
    createCanvas(windowWidth, windowHeight);
    
    videoCapture = createCapture(VIDEO, { flipped: true });
    videoCapture.size(640, 480);
    videoCapture.hide();

    // ✅ await obligatoire avec p5.js 2.x
    handPose = await ml5.handPose({ flipped: true });
    handPose.detectStart(videoCapture, gotHands);

    recognition.onresult = (event) => {
        let parole = event.results[0][0].transcript;
        let matches = parole.match(/\d+/);
        if (matches) {
            maSommeAnnoncee = parseInt(matches[0]);
            verifierGagnant();
        } else if (parole.toLowerCase().includes("zéro")) {
            maSommeAnnoncee = 0;
            verifierGagnant();
        }
    };

    recognition.onerror = () => { phaseJeu = "ATTENTE"; };

    recognition.onend = () => {
        if (jeuEnCours && phaseJeu === "RESULTAT") {
            setTimeout(lancerManche, 2000);
        }
    };
}

function draw() {
    background(0);
    image(videoCapture, 0, 0, width, height);

    let mesDoigts = 0;
    if (hands.length > 0) {
        mesDoigts = countFingers(hands[0]);
        drawHandFeedback(hands[0], mesDoigts);
    }

    displayUI(mesDoigts);
}

function keyPressed() {
    if (key === ' ') {
        jeuEnCours = !jeuEnCours;
        if (jeuEnCours) {
            lancerManche();
        } else {
            phaseJeu = "ATTENTE";
            messageAction = "JEU ARRÊTÉ. Espace pour reprendre.";
            messageResultat = "";
            try { recognition.stop(); } catch(e) {}
        }
    }
}

function lancerManche() {
    if (!jeuEnCours) return;
    phaseJeu = "ECOUTE";
    messageAction = "DITES VOTRE SOMME...";
    ordiDoigts = floor(random(0, 6));
    ordiSommeAnnoncee = floor(random(0, 11));
    try { recognition.start(); } catch(e) {}
}

function verifierGagnant() {
    let mesDoigts = hands.length > 0 ? countFingers(hands[0]) : 0;
    let totalReel = mesDoigts + ordiDoigts;

    let joueurGagne = (maSommeAnnoncee === totalReel);
    let ordiGagne = (ordiSommeAnnoncee === totalReel);

    if (joueurGagne && ordiGagne) {
        scoreJoueur++; scoreOrdi++;
        messageResultat = "ÉGALITÉ PARFAITE !";
    } else if (joueurGagne) {
        scoreJoueur++;
        messageResultat = "VOUS MARQUEZ 1 POINT !";
    } else if (ordiGagne) {
        scoreOrdi++;
        messageResultat = "L'ORDI MARQUE 1 POINT !";
    } else {
        messageResultat = "PERSONNE N'A TROUVÉ !";
    }

    messageAction = `Moi: ${mesDoigts} + Ordi: ${ordiDoigts} = ${totalReel}`;
    phaseJeu = "RESULTAT";
}

function displayUI(mesDoigts) {
    fill(0, 180);
    noStroke();
    rect(20, 20, 450, 200, 15);

    fill(255);
    textSize(22);
    text("SCORES", 40, 55);
    fill("#00ff88"); text("VOUS : " + scoreJoueur, 40, 90);
    fill("#ff4444"); text("ORDI : " + scoreOrdi, 250, 90);

    stroke(255, 50); line(40, 110, 430, 110); noStroke();

    fill(255);
    textSize(16);
    if (phaseJeu === "ECOUTE") fill("#00CCFF");
    text(messageAction, 40, 140);

    if (phaseJeu === "RESULTAT") {
        fill(255);
        textSize(14);
        text(`Annonces -> Moi: ${maSommeAnnoncee} | Ordi: ${ordiSommeAnnoncee}`, 40, 165);
        textSize(24);
        fill("#ffff00");
        text(messageResultat, 40, 195);
        fill(255, 100);
        rect(40, 205, 100, 5);
    }

    fill(255, 150);
    textSize(14);
    text("Doigts : " + mesDoigts + " | Espace pour ON/OFF", 40, height - 30);

    if (jeuEnCours && phaseJeu === "ECOUTE") {
        fill("#ff0000");
        ellipse(width - 40, 40, 20, 20);
    }
}

function countFingers(hand) {
    let count = 0;
    for (let i = 0; i < fingerTips.length; i++) {
        let tip = getKeypointsByName(hand, fingerTips[i]);
        let pip = getKeypointsByName(hand, fingerPips[i]);
        if (tip && pip && tip.y < pip.y) count++;
    }
    let thumbTip = getKeypointsByName(hand, "thumb_tip");
    let thumbIp = getKeypointsByName(hand, "thumb_ip");
    let pinkyMcp = getKeypointsByName(hand, "pinky_finger_mcp");
    if (thumbTip && thumbIp && pinkyMcp) {
        if (dist(thumbTip.x, thumbTip.y, pinkyMcp.x, pinkyMcp.y) > 80) count++;
    }
    return count;
}

function drawHandFeedback(hand, count) {
    let wrist = getKeypointsByName(hand, "wrist");
    if (wrist) {
        fill(0, 255, 0);
        ellipse(wrist.x, wrist.y, 20);
        textSize(20);
        fill(255);
        text(count, wrist.x + 15, wrist.y);
    }
}

function gotHands(results) { hands = results; }
function getKeypointsByName(hand, name) { return hand.keypoints.find(kp => kp.name === name); }
function windowResized() { resizeCanvas(windowWidth, windowHeight); }