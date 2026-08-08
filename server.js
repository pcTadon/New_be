require('dotenv').config();
const express = require('express');
const fs = require('fs-extra');
const path = require('path');

// Récupération de la clé Stripe depuis les variables d'environnement (SÉCURISÉ)
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error("❌ ERREUR : La variable STRIPE_SECRET_KEY n'est pas définie dans l'environnement !");
}
const stripe = require('stripe')(stripeKey ? stripeKey.trim() : '');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const DATA_FILE = path.join(__dirname, 'scanned_tickets.json');

// Lecture des billets scannés
function getScannedTickets() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeJsonSync(DATA_FILE, []);
  }
  return fs.readJsonSync(DATA_FILE);
}

// Marquer un billet comme scanné
function markTicketAsScanned(sessionId) {
  const scanned = getScannedTickets();
  if (!scanned.includes(sessionId)) {
    scanned.push(sessionId);
    fs.writeJsonSync(DATA_FILE, scanned, { spaces: 2 });
  }
}

// Route 1 : Infos billet
app.get('/api/ticket-info/:sessionId', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    const scannedList = getScannedTickets();

    res.json({
      valid: true,
      customerName: session.customer_details?.name || 'Participant',
      email: session.customer_details?.email || 'Non renseigné',
      sessionId: session.id,
      isScanned: scannedList.includes(session.id)
    });
  } catch (err) {
    // Mode test/secours si la session n'existe pas sur l'API Stripe active
    const scannedList = getScannedTickets();
    res.json({
      valid: true,
      customerName: 'Participant (Test)',
      email: 'test@example.com',
      sessionId: req.params.sessionId,
      isScanned: scannedList.includes(req.params.sessionId)
    });
  }
});

// Route 2 : Scanner le billet
app.post('/api/scan-ticket', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.json({ status: 'ERROR', message: '❌ Code manquant' });

  const scannedList = getScannedTickets();

  if (scannedList.includes(sessionId)) {
    return res.json({ status: 'ALREADY_USED', message: '⚠️ ATTENTION : Billet DÉJÀ UTILISÉ !' });
  }

  markTicketAsScanned(sessionId);
  return res.json({ 
    status: 'OK', 
    message: '✅ BILLET VALIDE - Accès Autorisé !',
    name: 'Participant'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));