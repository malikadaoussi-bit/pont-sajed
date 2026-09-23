import express from 'express';
import qrcode from 'qrcode';
import cors from 'cors';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
const app = express();
app.use(cors()); app.use(express.json());
let qr=null, connected=false, sockRef=null, msgs=[];

app.get('/', async (req,res)=>{
 if(connected) res.send('<h1>Bot pont en ligne ! ✅</h1><a href="/api/groups">Groupes</a> | <a href="/api/messages">Messages</a>');
 else if(qr) res.send(`<h1>Scanne</h1><img src="${qr}"><script>setTimeout(()=>location.reload(),5000)</script>`);
 else res.send('Demarrage...<script>setTimeout(()=>location.reload(),2000)</script>');
});
app.get('/api/messages', (req,res)=> res.json(msgs.slice(-100)));
app.get('/api/groups', async (req,res)=>{
 if(!sockRef) return res.json([]);
 const g = await sockRef.groupFetchAllParticipating();
 res.json(Object.values(g).map(x=>({id:x.id, name:x.subject})));
});
app.post('/api/send', async (req,res)=>{
 const {groupId, text} = req.body;
 await sockRef.sendMessage(groupId, {text});
 res.json({ok:true});
});

async function start(){
 const {state, saveCreds} = await useMultiFileAuthState('auth');
 const sock = makeWASocket({auth:state}); sockRef=sock;
 sock.ev.on('creds.update', saveCreds);
 sock.ev.on('connection.update', async u=>{
  if(u.qr) qr = await qrcode.toDataURL(u.qr);
  if(u.connection==='open'){ connected=true; qr=null; console.log('Connecte !');}
  if(u.connection==='close' && u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) start();
 });
 sock.ev.on('messages.upsert', async ({messages})=>{
  for(let m of messages){
   if(!m.message || m.key.fromMe) continue;
   const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
   if(!text) continue;
   msgs.push({from: m.pushName || 'Inconnu', group: m.key.remoteJid, text, time: new Date().toISOString()});
   if(msgs.length>200) msgs.shift();
  }
 });
}
start(); app.listen(3000, ()=>console.log('Serveur port 3000'));
