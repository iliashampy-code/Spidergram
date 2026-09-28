const express=require('express');
const http=require('http');
const path=require('path');
const {Server}=require('socket.io');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const cors=require('cors');
const crypto=require('crypto');
const {Pool}=require('pg');

const app=express();
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:true,credentials:true}});
app.use(cors({origin:true,credentials:true}));
app.use(express.json({limit:'10mb'}));

const ROOT=__dirname;
const SECRET=process.env.JWT_SECRET||'CHANGE_THIS_SPIDERGRAM_SECRET_2026';
const PORT=Number(process.env.PORT||3000);
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?{rejectUnauthorized:false}:false});

const id=()=>crypto.randomUUID();
const publicUser=u=>({id:u.id,username:u.username,name:u.name||u.username,avatar:u.avatar||'',online:!!u.online,lastSeen:u.last_seen||null});
const makeToken=u=>jwt.sign({id:u.id},SECRET,{expiresIn:'30d'});

async function initDb(){
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL не задан. Добавь PostgreSQL в Railway и подключи его к сервису.');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      online BOOLEAN NOT NULL DEFAULT FALSE,
      last_seen BIGINT
    );
    CREATE TABLE IF NOT EXISTS messages(
      id TEXT PRIMARY KEY,
      "from" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "to" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL,
      media_url TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_pair_idx ON messages("from","to",created_at);
    CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE TABLE IF NOT EXISTS reactions(
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      PRIMARY KEY(message_id,user_id,emoji)
    );
    CREATE INDEX IF NOT EXISTS reactions_message_idx ON reactions(message_id);
  `);
}

async function getUser(uid){
  const r=await pool.query('SELECT * FROM users WHERE id=$1',[uid]);
  return r.rows[0]||null;
}
async function auth(req,res,next){
  try{
    const h=req.headers.authorization||'';
    if(!h.startsWith('Bearer ')) throw 0;
    req.user=jwt.verify(h.slice(7),SECRET);
    next();
  }catch{res.status(401).json({error:'Требуется вход'});}
}

app.get('/api/health',async(req,res)=>{
  try{await pool.query('SELECT 1');res.json({ok:true,app:'SpiderGram',version:'4.0',database:'postgresql'});}
  catch(e){res.status(503).json({ok:false,app:'SpiderGram',error:'Database unavailable'});}
});

app.post('/api/register',async(req,res)=>{
  try{
    const username=String(req.body.username||'').trim().toLowerCase();
    const password=String(req.body.password||'');
    const name=String(req.body.name||username).trim().slice(0,40);
    if(!/^[a-z0-9_]{3,24}$/.test(username))return res.status(400).json({error:'Username: 3–24 латинских символа, цифры или _'});
    if(password.length<6)return res.status(400).json({error:'Пароль должен содержать минимум 6 символов'});
    const exists=await pool.query('SELECT 1 FROM users WHERE username=$1',[username]);
    if(exists.rowCount)return res.status(409).json({error:'Такой пользователь уже существует'});
    const u={id:id(),username,name:name||username,password:await bcrypt.hash(password,12),avatar:'',created_at:Date.now(),online:false,last_seen:null};
    await pool.query('INSERT INTO users(id,username,name,password,avatar,created_at,online,last_seen) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [u.id,u.username,u.name,u.password,u.avatar,u.created_at,u.online,u.last_seen]);
    res.json({token:makeToken(u),user:publicUser(u)});
  }catch(e){res.status(500).json({error:'Ошибка базы данных'});}
});

app.post('/api/login',async(req,res)=>{
  try{
    const username=String(req.body.username||'').trim().toLowerCase(),password=String(req.body.password||'');
    const r=await pool.query('SELECT * FROM users WHERE username=$1',[username]);
    const u=r.rows[0];
    if(!u||!(await bcrypt.compare(password,u.password)))return res.status(401).json({error:'Неверный логин или пароль'});
    res.json({token:makeToken(u),user:publicUser(u)});
  }catch{res.status(500).json({error:'Ошибка базы данных'});}
});

app.get('/api/me',auth,async(req,res)=>{
  const u=await getUser(req.user.id);
  if(!u)return res.status(404).json({error:'Пользователь не найден'});
  res.json(publicUser(u));
});

app.patch('/api/me',auth,async(req,res)=>{
  const u=await getUser(req.user.id);
  if(!u)return res.status(404).json({error:'Пользователь не найден'});
  const name=typeof req.body.name==='string'?(req.body.name.trim().slice(0,40)||u.username):u.name;
  const avatar=typeof req.body.avatar==='string'?req.body.avatar:u.avatar;
  if(avatar.length>2800000)return res.status(413).json({error:'Аватар слишком большой'});
  const r=await pool.query('UPDATE users SET name=$1,avatar=$2 WHERE id=$3 RETURNING *',[name,avatar,u.id]);
  res.json(publicUser(r.rows[0]));
});

app.get('/api/users',auth,async(req,res)=>{
  const q=String(req.query.q||'').trim().toLowerCase();
  const r=await pool.query(`SELECT * FROM users WHERE id<>$1 AND ($2='' OR username ILIKE '%'||$2||'%' OR name ILIKE '%'||$2||'%') ORDER BY username LIMIT 50`,[req.user.id,q]);
  res.json(r.rows.map(publicUser));
});

async function lastMessagesFor(uid){
  const r=await pool.query(`
    SELECT DISTINCT ON (other_id) other_id, id, "from", "to", text, type, media_url, created_at
    FROM (
      SELECT CASE WHEN "from"=$1 THEN "to" ELSE "from" END AS other_id,
             id,"from","to",text,type,media_url,created_at
      FROM messages WHERE "from"=$1 OR "to"=$1
    ) x
    ORDER BY other_id,created_at DESC
  `,[uid]);
  const out=[];
  for(const m of r.rows){
    const u=await getUser(m.other_id);
    if(u)out.push({user:publicUser(u),last:{id:m.id,from:m.from,to:m.to,text:m.text,type:m.type,mediaUrl:m.media_url,createdAt:Number(m.created_at)}});
  }
  return out.sort((a,b)=>b.last.createdAt-a.last.createdAt);
}
app.get('/api/chats',auth,async(req,res)=>res.json(await lastMessagesFor(req.user.id)));

app.get('/api/messages/:uid',auth,async(req,res)=>{
  const other=await getUser(req.params.uid);
  if(!other)return res.status(404).json({error:'Пользователь не найден'});
  const r=await pool.query(`SELECT id,"from","to",text,type,media_url,created_at,edited,deleted FROM messages WHERE ("from"=$1 AND "to"=$2) OR ("from"=$2 AND "to"=$1) ORDER BY created_at DESC LIMIT 300`,[req.user.id,req.params.uid]);
  const ids=r.rows.map(m=>m.id);
  let rx=[];
  if(ids.length){const q=await pool.query('SELECT message_id,user_id,emoji FROM reactions WHERE message_id=ANY($1)',[ids]);rx=q.rows;}
  res.json(r.rows.reverse().map(m=>({id:m.id,from:m.from,to:m.to,text:m.deleted?'Сообщение удалено':m.text,type:m.deleted?'deleted':m.type,mediaUrl:m.deleted?'':m.media_url,createdAt:Number(m.created_at),edited:!!m.edited,deleted:!!m.deleted,reactions:rx.filter(x=>x.message_id===m.id).map(x=>({userId:x.user_id,emoji:x.emoji}))})));
});

app.post('/api/messages/:uid',auth,async(req,res)=>{
  const to=req.params.uid,type=String(req.body.type||'text'),text=String(req.body.text||'').trim(),mediaUrl=String(req.body.mediaUrl||'');
  if(to===req.user.id)return res.status(400).json({error:'Нельзя отправить сообщение самому себе'});
  if(!await getUser(to))return res.status(404).json({error:'Пользователь не найден'});
  if(type==='text'){if(!text||text.length>4000)return res.status(400).json({error:'Сообщение пустое или длиннее 4000 символов'});}
  else if(type==='image'){if(!mediaUrl.startsWith('data:image/'))return res.status(400).json({error:'Некорректное изображение'});if(mediaUrl.length>5600000)return res.status(413).json({error:'Фото слишком большое'});}
  else if(type==='audio'){if(!mediaUrl.startsWith('data:audio/'))return res.status(400).json({error:'Некорректное аудио'});if(mediaUrl.length>7000000)return res.status(413).json({error:'Голосовое слишком большое'});}
  else return res.status(400).json({error:'Неизвестный тип сообщения'});
  const m={id:id(),from:req.user.id,to,text:type==='text'?text:'',type,mediaUrl:type==='text'?'':mediaUrl,createdAt:Date.now(),edited:false,deleted:false,reactions:[]};
  await pool.query('INSERT INTO messages(id,"from","to",text,type,media_url,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[m.id,m.from,m.to,m.text,m.type,m.mediaUrl,m.createdAt]);
  io.to(to).emit('message',m);
  res.json(m);
});

app.patch('/api/messages/:id',auth,async(req,res)=>{
  const text=String(req.body.text||'').trim();
  if(!text||text.length>4000)return res.status(400).json({error:'Сообщение пустое или слишком длинное'});
  const r=await pool.query('UPDATE messages SET text=$1,edited=true WHERE id=$2 AND "from"=$3 AND type=\'text\' AND deleted=false RETURNING id,"from","to",text,type,media_url,created_at,edited,deleted',[text,req.params.id,req.user.id]);
  if(!r.rowCount)return res.status(404).json({error:'Сообщение не найдено или его нельзя изменить'});
  const m=r.rows[0]; const out={id:m.id,from:m.from,to:m.to,text:m.text,type:m.type,mediaUrl:m.media_url,createdAt:Number(m.created_at),edited:true,deleted:false,reactions:[]};
  io.to(m.to).emit('message:update',out); io.to(m.from).emit('message:update',out); res.json(out);
});
app.delete('/api/messages/:id',auth,async(req,res)=>{
  const r=await pool.query('UPDATE messages SET text=\'\',media_url=\'\',type=\'deleted\',deleted=true WHERE id=$1 AND "from"=$2 AND deleted=false RETURNING id,"from","to",created_at');
  if(!r.rowCount)return res.status(404).json({error:'Сообщение не найдено или его нельзя удалить'});
  const m=r.rows[0]; const out={id:m.id,from:m.from,to:m.to,text:'Сообщение удалено',type:'deleted',mediaUrl:'',createdAt:Number(m.created_at),edited:false,deleted:true,reactions:[]};
  io.to(m.to).emit('message:update',out); io.to(m.from).emit('message:update',out); res.json(out);
});
app.post('/api/messages/:id/reactions',auth,async(req,res)=>{
  const emoji=String(req.body.emoji||'').trim(); if(!['❤️','👍','😂','😮','😢','🔥'].includes(emoji))return res.status(400).json({error:'Недопустимая реакция'});
  const m=await pool.query('SELECT "from","to" FROM messages WHERE id=$1',[req.params.id]); if(!m.rowCount)return res.status(404).json({error:'Сообщение не найдено'});
  const old=await pool.query('SELECT 1 FROM reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3',[req.params.id,req.user.id,emoji]);
  if(old.rowCount)await pool.query('DELETE FROM reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3',[req.params.id,req.user.id,emoji]);
  else await pool.query('INSERT INTO reactions(message_id,user_id,emoji) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[req.params.id,req.user.id,emoji]);
  const rr=await pool.query('SELECT user_id,emoji FROM reactions WHERE message_id=$1',[req.params.id]);
  const out={messageId:req.params.id,reactions:rr.rows.map(x=>({userId:x.user_id,emoji:x.emoji}))};
  io.to(m.rows[0].to).emit('reaction',out); io.to(m.rows[0].from).emit('reaction',out); res.json(out);
});
io.use((socket,next)=>{try{socket.user=jwt.verify(socket.handshake.auth?.token||'',SECRET);next();}catch{next(new Error('Unauthorized'));}});
io.on('connection',async socket=>{
  const u=await getUser(socket.user.id);
  if(!u)return socket.disconnect(true);
  await pool.query('UPDATE users SET online=true,last_seen=NULL WHERE id=$1',[u.id]);
  socket.join(u.id);
  io.emit('presence',{userId:u.id,online:true,lastSeen:null});
  socket.on('typing',d=>{if(d?.to)io.to(d.to).emit('typing',{from:u.id,typing:!!d.typing});});
  socket.on('read',d=>{if(d?.to)io.to(d.to).emit('read',{from:u.id});});
  socket.on('disconnect',async()=>{const seen=Date.now();await pool.query('UPDATE users SET online=false,last_seen=$1 WHERE id=$2',[seen,u.id]).catch(()=>{});io.emit('presence',{userId:u.id,online:false,lastSeen:seen});});
});

app.get('/',(req,res)=>res.sendFile(path.join(ROOT,'index.html')));
app.get('/index.html',(req,res)=>res.sendFile(path.join(ROOT,'index.html')));

initDb().then(()=>server.listen(PORT,'0.0.0.0',()=>console.log(`SpiderGram server listening on port ${PORT} with PostgreSQL`)))
.catch(e=>{console.error(e);process.exit(1);});