import express from 'express';
import qrcode from 'qrcode';
import { default as makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

const app = express();
let qrCodeData = null;
let isConnected = false;

app.get('/', (req,res) => {
  if(isConnected) res.send('<h1>Bot pont en ligne ! ✅ Connecté</h1>');
  else if(qrCodeData) res.send(`<h1>Scanne ce QR</h1><img src="${qrCodeData}" style="width:300px"><br><p>WhatsApp > Appareils connectés</p><script>setTimeout(()=>location.reload(),5000)</script>`);
  else res.send('<h1>Démarrage... actualise dans 5s</h1><script>setTimeout(()=>location.reload(),3000)</script>');
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if(qr) { qrCodeData = await qrcode.toDataURL(qr); console.log('QR prêt'); }
    if(connection === 'open') { isConnected=true; qrCodeData=null; console.log('Connecté !'); }
    if(connection === 'close') {
      isConnected=false;
      if(lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
    }
  });
}
startBot();
app.listen(3000, () => console.log('Serveur port 3000'));
