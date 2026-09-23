import express from 'express';
import cors from 'cors';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

const app = express();
app.use(cors());
app.use(express.json());

let messages = [];
let sock;
let GROUP_ID = null;

app.get('/api/messages', (req, res) => {
  res.json(messages.slice(-100));
});

app.post('/api/message', async (req, res) => {
  const { pseudo, texte } = req.body;
  if(!texte) return res.status(400).json({error: "vide"});
  const msgObj = { pseudo: pseudo || "anonyme", texte, source: "site", date: new Date() };
  messages.push(msgObj);
  if(sock && GROUP_ID){
    await sock.sendMessage(GROUP_ID, { text: `[${msgObj.pseudo} via site]: ${msgObj.texte}` });
  }
  res.json({ ok: true });
});

app.get('/api/groups', async (req, res) => {
  if(!sock) return res.json({error: "bot pas connecté"});
  const groups = await sock.groupFetchAllParticipating();
  const list = Object.values(groups).map(g => ({ id: g.id, name: g.subject }));
  res.json(list);
});

app.get('/', (req,res) => res.send('Bot pont en ligne!'));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  sock = makeWASocket({ auth: state, printQRInTerminal: false });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if(qr){
      console.log("SCANNE CE QR CODE");
      qrcode.generate(qr, { small: true });
    }
    if(connection === 'close'){
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut;
      if(shouldReconnect) startBot();
    } else if(connection === 'open'){
      console.log("Bot connecté!");
    }
  });
  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if(!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    if(!GROUP_ID && from.endsWith('@g.us')) GROUP_ID = from;
    if(from === GROUP_ID){
      messages.push({ pseudo: msg.pushName || "whatsapp", texte: text, source: "whatsapp", date: new Date() });
    }
  });
}
startBot();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Serveur sur port", PORT));