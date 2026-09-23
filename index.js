const express = require('express');
const qrcode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const app = express();
let qrCodeData = null;
let isConnected = false;

app.get('/', (req,res) => {
  if(isConnected) res.send('<h1>Bot pont en ligne ! ✅ Connecté à WhatsApp</h1><a href="/qr">Voir QR</a>');
  else if(qrCodeData) res.send(`<h1>Scanne ce QR avec WhatsApp</h1><img src="${qrCodeData}"><br><p>Va sur WhatsApp > Appareils connectés > Connecter un appareil</p><script>setTimeout(()=>location.reload(),5000)</script>`);
  else res.send('<h1>Bot pont en ligne ! Démarrage...</h1><p>Attends 10 sec et actualise</p><script>setTimeout(()=>location.reload(),5000)</script>');
});

app.get('/qr', (req,res) => {
  if(qrCodeData) res.send(`<img src="${qrCodeData}" style="width:300px"><script>setTimeout(()=>location.reload(),3000)</script>`);
  else res.send('Pas de QR pour le moment, actualise dans 5s');
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state, printQRInTerminal: true });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if(qr) {
      qrCodeData = await qrcode.toDataURL(qr);
      console.log('QR généré');
    }
    if(connection === 'open') { isConnected = true; qrCodeData = null; console.log('Connecté !'); }
    if(connection === 'close') {
      isConnected = false;
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if(shouldReconnect) startBot();
    }
  });
}
startBot();
app.listen(3000, () => console.log('Serveur sur port 3000'));
