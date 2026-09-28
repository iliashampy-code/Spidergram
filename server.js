const express=require('express');
const http=require('http');
const path=require('path');
const {Server}=require('socket.io');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const cors=require('cors');
const fs=require('fs');
const crypto=require('crypto');
const app=express();const server=http.createServer(app);
const io=new Server(server,{cors:{origin:true,credentials:true}});
app.use(cors({origin:true,credentials:true}));app.use(express.json({limit:'10mb'}));
const ROOT=__dirname,DB=path.join(ROOT,'db.json');
const SECRET=process.env.JWT_SECRET||'CHANGE_THIS_SPIDERGRAM_SECRET_2026';const PORT=Number(process.env.PORT||3000);
let db;try{db=fs.existsSync(DB)?JSON.parse(fs.readFileSync(DB,'utf8')):{users:[],messages:[]};}catch{db={users:[],messages:[]};}
db.users ||= [];db.messages ||= [];function save(){fs.writeFileSync(DB,JSON.stringify(db,null,2));}
const id=()=>crypto.randomUUID();const publicUser=u=>({id:u.id,username:u.username,name:u.name||u.username,avatar:u.avatar||'',online:!!u.online,lastSeen:u.lastSeen||null});
const makeToken=u=>jwt.sign({id:u.id},SECRET,{expiresIn:'30d'});
function auth(req,res,next){try{const h=req.headers.authorization||'';if(!h.startsWith('Bearer '))throw 0;req.user=jwt.verify(h.slice(7),SECRET);next();}catch{res.status(401).json({error:'Требуется вход'});}}
app.get('/api/health',(req,res)=>res.json({ok:true,app:'SpiderGram',version:'3.0'}));
app.post('/api/register',async(req,res)=>{const username=String(req.body.username||'').trim().toLowerCase(),password=String(req.body.password||''),name=String(req.body.name||username).trim().slice(0,40);if(!/^[a-z0-9_]{3,24}$/.test(username))return res.status(400).json({error:'Username: 3–24 латинских символа, цифры или _'});if(password.length<6)return res.status(400).json({error:'Пароль должен содержать минимум 6 символов'});if(db.users.some(u=>u.username===username))return res.status(409).json({error:'Такой пользователь уже существует'});const u={id:id(),username,name:name||username,password:await bcrypt.hash(password,12),avatar:'',createdAt:Date.now(),online:false,lastSeen:null};db.users.push(u);save();res.json({token:makeToken(u),user:publicUser(u)});});
app.post('/api/login',async(req,res)=>{const username=String(req.body.username||'').trim().toLowerCase(),password=String(req.body.password||'');const u=db.users.find(x=>x.username===username);if(!u||!(await bcrypt.compare(password,u.password)))return res.status(401).json({error:'Неверный логин или пароль'});res.json({token:makeToken(u),user:publicUser(u)});});
app.get('/api/me',auth,(req,res)=>{const u=db.users.find(x=>x.id===req.user.id);if(!u)return res.status(404).json({error:'Пользователь не найден'});res.json(publicUser(u));});
app.patch('/api/me',auth,(req,res)=>{const u=db.users.find(x=>x.id===req.user.id);if(!u)return res.status(404).json({error:'Пользователь не найден'});if(typeof req.body.name==='string')u.name=req.body.name.trim().slice(0,40)||u.username;if(typeof req.body.avatar==='string'){if(req.body.avatar.length>2800000)return res.status(413).json({error:'Аватар слишком большой'});u.avatar=req.body.avatar;}save();res.json(publicUser(u));});
app.get('/api/users',auth,(req,res)=>{const q=String(req.query.q||'').trim().toLowerCase();res.json(db.users.filter(u=>u.id!==req.user.id&&(!q||u.username.includes(q)||String(u.name||'').toLowerCase().includes(q))).slice(0,50).map(publicUser));});
function lastMessagesFor(uid){const map=new Map();for(const m of db.messages){if(m.from!==uid&&m.to!==uid)continue;const other=m.from===uid?m.to:m.from;const old=map.get(other);if(!old||m.createdAt>old.createdAt)map.set(other,m);}return [...map.entries()].map(([id,last])=>{const u=db.users.find(x=>x.id===id);return u?{user:publicUser(u),last}:null}).filter(Boolean).sort((a,b)=>b.last.createdAt-a.last.createdAt);}
app.get('/api/chats',auth,(req,res)=>res.json(lastMessagesFor(req.user.id)));
app.get('/api/messages/:uid',auth,(req,res)=>{const other=db.users.find(u=>u.id===req.params.uid);if(!other)return res.status(404).json({error:'Пользователь не найден'});const a=req.user.id,b=req.params.uid;res.json(db.messages.filter(m=>(m.from===a&&m.to===b)||(m.from===b&&m.to===a)).slice(-300));});
app.post('/api/messages/:uid',auth,(req,res)=>{const to=req.params.uid,type=String(req.body.type||'text'),text=String(req.body.text||'').trim(),mediaUrl=String(req.body.mediaUrl||'');if(to===req.user.id)return res.status(400).json({error:'Нельзя отправить сообщение самому себе'});if(!db.users.some(u=>u.id===to))return res.status(404).json({error:'Пользователь не найден'});if(type==='text'){if(!text||text.length>4000)return res.status(400).json({error:'Сообщение пустое или длиннее 4000 символов'});}else if(type==='image'){if(!mediaUrl.startsWith('data:image/'))return res.status(400).json({error:'Некорректное изображение'});if(mediaUrl.length>5600000)return res.status(413).json({error:'Фото слишком большое'});}else if(type==='audio'){if(!mediaUrl.startsWith('data:audio/'))return res.status(400).json({error:'Некорректное аудио'});if(mediaUrl.length>7000000)return res.status(413).json({error:'Голосовое слишком большое'});}else return res.status(400).json({error:'Неизвестный тип сообщения'});const m={id:id(),from:req.user.id,to,text:type==='text'?text:'',type,mediaUrl:type==='text'?'':mediaUrl,createdAt:Date.now()};db.messages.push(m);save();io.to(to).emit('message',m);res.json(m);});
io.use((socket,next)=>{try{socket.user=jwt.verify(socket.handshake.auth?.token||'',SECRET);next()}catch{next(new Error('Unauthorized'))}});
io.on('connection',socket=>{const u=db.users.find(x=>x.id===socket.user.id);if(!u)return socket.disconnect(true);u.online=true;u.lastSeen=null;save();socket.join(u.id);io.emit('presence',{userId:u.id,online:true,lastSeen:null});socket.on('typing',d=>{if(d?.to)io.to(d.to).emit('typing',{from:u.id,typing:!!d.typing})});socket.on('read',d=>{if(d?.to)io.to(d.to).emit('read',{from:u.id})});socket.on('disconnect',()=>{u.online=false;u.lastSeen=Date.now();save();io.emit('presence',{userId:u.id,online:false,lastSeen:u.lastSeen})})});
app.get('/',(req,res)=>res.sendFile(path.join(ROOT,'index.html')));app.get('/index.html',(req,res)=>res.sendFile(path.join(ROOT,'index.html')));
server.listen(PORT,'0.0.0.0',()=>console.log(`SpiderGram server listening on port ${PORT}`));