import express from 'express';
import qrcode from 'qrcode';
import cors from 'cors';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

const app = express();
app.use(cors());
app.use(express.json());
let qr=null, connected=false, sockRef=null;
let msgs=[];

app.get('/', (req,res)=>{
  if(connected) res.send('<h1>Connecte</h1>');
  else if(qr) res.send('<img src="'+qr+'">');
  else res.send('Demarrage...');
});
app.get('/api/groups', async (req,res)=>{
  if(!sockRef) return res.json([]);
  const g = await sockRef.groupFetchAllParticipating();
  res.json(Object.values(g).map(x=>({id:x.id, name:x.subject})));
});

async function start(){
  const {state, saveCreds} = await useMultiFileAuthState('auth');
  const sock = makeWASocket({auth:state});
  sockRef=sock;
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async u=>{
    if(u.qr) qr = await qrcode.toDataURL(u.qr);
    if(u.connection==='open'){ connected=true; qr=null; }
    if(u.connection==='close' && u.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) start();
  });
}
start();
app.listen(3000);
