import express from 'express';
import qrcode from 'qrcode';
import cors from 'cors';
import { default as makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

const app = express();
app.use(cors());
app.use(express.json());

let qrCodeData = null;
let isConnected = false;
let sockGlobal = null;
let messages = []; // stockage temporaire

// Page d'état
app.get('/', (req,res) => {
  if(isConnected) res.send(`<h1>Bot pont en ligne ! ✅ Connecté</h1><p>${messages.length} messages reçus</p><a href="/api/groups">Voir mes groupes</a>`);
  else if(qrCodeData) res.send(`<h1>Scanne ce QR</h1><img src="${qrCodeData}" style="width:300px"><script>setTimeout(()=>location.reload(),5000)</script>`);
  else res.send('<h1>Démarrage...</h1><script>setTimeout(()=>location.reload(),3000)</script>');
});

// API pour ton site web
app.get('/api/messages', (req,res) => res.json(messages.slice(-100)));
app.get('/api/groups', async (req,res) => {
  if(!sockGlobal) return res.json([]);
  const groups = await sockGlobal.groupFetchAllParticipating();
  res.json(Object.values(groups).map(g=>({id:g.id, name:g.subject})));
});
app.post('/api/send', async (req,res) => {
  const { groupId, text } = req.body;
  if(!sockGlobal || !groupId || !text) return res.status(400).json({error:'manque groupId ou text'});
  await sockGlobal.sendMessage(groupId, {text});
  res.json({ok:true});
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({ auth: state });
  sockGlobal = sock;
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if(qr) qrCodeData = await qrcode.toDataURL(qr);
    if(connection === 'open') { isConnected=true; qrCodeData=null; }
    if(connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
  });
  sock.ev.on('messages.upsert', async ({messages: newMsgs}) => {
    for(let m of newMsgs){
      if(!m.message || m.key.fromMe) continue;
      const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
      const entry = { from: m.pushName, group: m.key.remoteJid, text, time: new Date().toISOString() };
      console.log('MSG:', entry);
      messages.push(entry);
      if(messages.length>500) messages.shift();
    }
  });
}
startBot();
app.listen(3000);
