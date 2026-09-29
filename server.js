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
function rewardForDays(days){
 const rewards=[
  {key:'day1',days:1,name:'Новичок',type:'title',start:'#1688ff',end:'#1688ff'},
  {key:'day10',days:10,name:'Освоился',type:'title',start:'#a855f7',end:'#e9d5ff'},
  {key:'day20',days:20,name:'Местный гангстер',type:'title',start:'#f5c542',end:'#ffd86b'},
  {key:'day45',days:45,name:'Добрый',type:'title',start:'#35c46a',end:'#8bea9d'},
  {key:'day60',days:60,name:'Знаток системы',type:'title',start:'#163b8f',end:'#2856c7'},
  {key:'day70',days:70,name:'Паучиха',type:'title',start:'#ffffff',end:'#d9d9ff'},
  {key:'day100',days:100,name:'Ветеран',type:'title',start:'#3b82f6',end:'#ffffff'},
  {key:'day150',days:150,name:'Со стажем',type:'title',start:'#ec4899',end:'#ffffff'},
  {key:'day200',days:200,name:'Крепкий орешек',type:'title',start:'#14532d',end:'#a3e635'},
  {key:'day356',days:356,name:'легенда не по званию',type:'title',start:'#8b5cf6',end:'#f0abfc'}
 ];
 return rewards;
}
function currentReward(days){
 const all=rewardForDays(days);
 return all.filter(r=>r.type==='title'&&days>=r.days).pop()||null;
}
const publicUser=u=>({id:u.id,username:u.username,name:u.name||u.username,avatar:u.avatar||'',online:!!u.online,lastSeen:u.last_seen||null,customTitle:u.custom_title||'',adminCheck:!!u.admin_check,days:Math.max(0,Math.floor((Date.now()-Number(u.created_at||Date.now()))/86400000)),title:currentReward(Math.max(0,Math.floor((Date.now()-Number(u.created_at||Date.now()))/86400000))) });
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
      last_seen BIGINT,
      custom_title TEXT NOT NULL DEFAULT '',
      admin_check BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS user_awards(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL DEFAULT '',verified BOOLEAN NOT NULL DEFAULT FALSE);
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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_title TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_check BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE TABLE IF NOT EXISTS groups(id TEXT PRIMARY KEY,name TEXT NOT NULL,avatar TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS group_members(group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL DEFAULT 'member',joined_at BIGINT NOT NULL,PRIMARY KEY(group_id,user_id));
    CREATE TABLE IF NOT EXISTS group_messages(id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,"from" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,text TEXT NOT NULL DEFAULT '',type TEXT NOT NULL DEFAULT 'text',media_url TEXT NOT NULL DEFAULT '',created_at BIGINT NOT NULL,edited BOOLEAN NOT NULL DEFAULT FALSE,deleted BOOLEAN NOT NULL DEFAULT FALSE);
    CREATE INDEX IF NOT EXISTS group_messages_idx ON group_messages(group_id,created_at);
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to TEXT;
    CREATE TABLE IF NOT EXISTS pinned_messages(message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,pinned_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS pinned_chats(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,peer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,pinned_at BIGINT NOT NULL,PRIMARY KEY(user_id,peer_id));
    CREATE TABLE IF NOT EXISTS reactions(
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      PRIMARY KEY(message_id,user_id,emoji)
    );
    CREATE INDEX IF NOT EXISTS reactions_message_idx ON reactions(message_id);
    CREATE TABLE IF NOT EXISTS groups(
     id TEXT PRIMARY KEY,name TEXT NOT NULL,avatar TEXT NOT NULL DEFAULT '',
     created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS group_members(
     group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     role TEXT NOT NULL DEFAULT 'member',joined_at BIGINT NOT NULL,
     PRIMARY KEY(group_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS group_messages(
     id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
     "from" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     text TEXT NOT NULL DEFAULT '',type TEXT NOT NULL,media_url TEXT NOT NULL DEFAULT '',
     created_at BIGINT NOT NULL,edited BOOLEAN NOT NULL DEFAULT FALSE,deleted BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE INDEX IF NOT EXISTS group_messages_idx ON group_messages(group_id,created_at);
    CREATE TABLE IF NOT EXISTS hidden_chats(
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      peer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hidden_at BIGINT NOT NULL,
      PRIMARY KEY(user_id,peer_id)
    );
    CREATE TABLE IF NOT EXISTS conversation_reads(
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     peer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     last_read_at BIGINT NOT NULL DEFAULT 0,PRIMARY KEY(user_id,peer_id)
    );
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

app.get('/api/admin/awards',auth,async(req,res)=>{
 const me=await getUser(req.user.id);if(!isAdminUser(me))return res.status(403).json({error:'Доступ только для @dobry'});
 const q=String(req.query.q||'').trim().toLowerCase();
 const r=await pool.query(`SELECT u.id,u.username,u.name,a.title,a.verified FROM users u LEFT JOIN user_awards a ON a.user_id=u.id WHERE u.username ILIKE '%'||$1||'%' OR u.name ILIKE '%'||$1||'%' ORDER BY u.username LIMIT 50`,[q]);
 res.json(r.rows);
});
app.patch('/api/admin/awards/:uid',auth,async(req,res)=>{
 const me=await getUser(req.user.id);if(!isAdminUser(me))return res.status(403).json({error:'Доступ только для @dobry'});
 const target=await getUser(req.params.uid);if(!target)return res.status(404).json({error:'Пользователь не найден'});
 const title=typeof req.body.title==='string'?req.body.title.trim().slice(0,60):'';const verified=!!req.body.verified;
 if(!title&&!verified){await pool.query('DELETE FROM user_awards WHERE user_id=$1',[target.id]);return res.json({ok:true,title:'',verified:false});}
 await pool.query('INSERT INTO user_awards(user_id,title,verified) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET title=EXCLUDED.title,verified=EXCLUDED.verified',[target.id,title,verified]);
 res.json({ok:true,title,verified});
});
app.get('/api/rewards',auth,async(req,res)=>{
 const u=await getUser(req.user.id);
 const days=Math.max(0,Math.floor((Date.now()-Number(u.created_at||Date.now()))/86400000));
 const rewards=rewardForDays(days).map(r=>({...r,unlocked:days>=r.days}));
 const next=rewards.find(r=>!r.unlocked)||null;
 res.json({days,rewards,current:currentReward(days),next,progress:next?Math.min(100,Math.round(days/next.days*100)):100});
});
function isOwnerAdmin(u){return String(u?.username||'').toLowerCase()==='dobry'}
async function requireOwnerAdmin(req,res){const u=await getUser(req.user.id);if(!isOwnerAdmin(u)){res.status(403).json({error:'Доступ только для @dobry'});return null}return u}
app.get('/api/admin/users',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const q=String(req.query.q||'').trim().toLowerCase();const r=await pool.query("SELECT * FROM users WHERE ($1='' OR username ILIKE '%'||$1||'%' OR name ILIKE '%'||$1||'%') ORDER BY username LIMIT 50",[q]);res.json(r.rows.map(publicUser))});
app.patch('/api/admin/users/:id/title',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const title=String(req.body.title||'').trim().slice(0,50);const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});await pool.query('UPDATE users SET custom_title=$1 WHERE id=$2',[title,target.id]);res.json(publicUser(await getUser(target.id)))});
app.patch('/api/admin/users/:id/check',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});const enabled=req.body.enabled!==false;await pool.query('UPDATE users SET admin_check=$1 WHERE id=$2',[enabled,target.id]);res.json(publicUser(await getUser(target.id)))});
app.get('/api/stats',auth,async(req,res)=>{try{const [u,m,g,o]=await Promise.all([pool.query('SELECT COUNT(*)::int count FROM users'),pool.query('SELECT COUNT(*)::int count FROM messages'),pool.query('SELECT COUNT(*)::int count FROM groups'),pool.query('SELECT COUNT(*)::int count FROM users WHERE online=true')]);res.json({users:u.rows[0].count,messages:m.rows[0].count,groups:g.rows[0].count,online:o.rows[0].count})}catch(e){res.status(500).json({error:'Не удалось загрузить статистику'})}});
app.get('/api/users',auth,async(req,res)=>{
  const q=String(req.query.q||'').trim().toLowerCase();
  const r=await pool.query(`SELECT * FROM users WHERE id<>$1 AND ($2='' OR username ILIKE '%'||$2||'%' OR name ILIKE '%'||$2||'%') ORDER BY username LIMIT 50`,[req.user.id,q]);
  const out=[];for(const u of r.rows)out.push(publicUser(u));res.json(out);
});

async function lastMessagesFor(uid){
  const r=await pool.query(`
    SELECT DISTINCT ON (other_id) other_id, id, "from", "to", text, type, media_url, created_at
    FROM (
      SELECT CASE WHEN "from"=$1 THEN "to" ELSE "from" END AS other_id,
             id,"from","to",text,type,media_url,created_at
      FROM messages WHERE ("from"=$1 OR "to"=$1) AND NOT EXISTS (SELECT 1 FROM hidden_chats h WHERE h.user_id=$1 AND h.peer_id=CASE WHEN "from"=$1 THEN "to" ELSE "from" END)
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
app.get('/api/chats',auth,async(req,res)=>{
 const chats=await lastMessagesFor(req.user.id);
 const p=await pool.query('SELECT peer_id FROM pinned_chats WHERE user_id=$1 ORDER BY pinned_at DESC',[req.user.id]);
 const set=new Set(p.rows.map(x=>x.peer_id)); chats.forEach(c=>c.pinned=set.has(c.user.id));
 chats.sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.last.createdAt-a.last.createdAt);
 res.json(chats);
});
app.delete('/api/chats/:uid',auth,async(req,res)=>{
 const peer=await getUser(req.params.uid); if(!peer)return res.status(404).json({error:'Пользователь не найден'});
 await pool.query('INSERT INTO hidden_chats(user_id,peer_id,hidden_at) VALUES($1,$2,$3) ON CONFLICT(user_id,peer_id) DO UPDATE SET hidden_at=EXCLUDED.hidden_at',[req.user.id,req.params.uid,Date.now()]);
 res.json({ok:true});
});
app.post('/api/chats/:uid/pin',auth,async(req,res)=>{
 const peer=await getUser(req.params.uid); if(!peer)return res.status(404).json({error:'Пользователь не найден'});
 const old=await pool.query('SELECT 1 FROM pinned_chats WHERE user_id=$1 AND peer_id=$2',[req.user.id,req.params.uid]);
 if(old.rowCount) await pool.query('DELETE FROM pinned_chats WHERE user_id=$1 AND peer_id=$2',[req.user.id,req.params.uid]);
 else await pool.query('INSERT INTO pinned_chats(user_id,peer_id,pinned_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[req.user.id,req.params.uid,Date.now()]);
 res.json({pinned:!old.rowCount});
});app.delete('/api/groups/:id',auth,async(req,res)=>{
 const g=await pool.query('SELECT created_by FROM groups WHERE id=$1',[req.params.id]);
 if(!g.rowCount)return res.status(404).json({error:'Группа не найдена'});
 if(g.rows[0].created_by!==req.user.id)return res.status(403).json({error:'Только владелец может удалить группу'});
 await pool.query('DELETE FROM groups WHERE id=$1',[req.params.id]);
 res.json({ok:true});
});
app.get('/api/groups/:id',auth,async(req,res)=>{
 const r=await pool.query(`SELECT g.id,g.name,g.avatar,g.created_by,g.created_at,
 (SELECT COUNT(*) FROM group_members WHERE group_id=g.id)::int members FROM groups g
 JOIN group_members gm ON gm.group_id=g.id WHERE g.id=$1 AND gm.user_id=$2`,[req.params.id,req.user.id]);
 if(!r.rowCount)return res.status(404).json({error:'Группа не найдена'});
 const m=await pool.query(`SELECT u.id,u.username,u.name,u.avatar,u.online,u.last_seen,gm.role FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=$1 ORDER BY gm.role DESC,u.name`,[req.params.id]);
 res.json({...r.rows[0],members:m.rows.map(publicUser).map((u,i)=>({...u,role:m.rows[i].role}))});
});
app.post('/api/groups/:id/members',auth,async(req,res)=>{
 const uid=String(req.body.userId||'');
 const admin=await pool.query('SELECT role FROM group_members WHERE group_id=$1 AND user_id=$2',[req.params.id,req.user.id]);
 if(!admin.rowCount||!['admin','owner'].includes(admin.rows[0].role))return res.status(403).json({error:'Только администратор может добавлять участников'});
 if(!await getUser(uid))return res.status(404).json({error:'Пользователь не найден'});
 await pool.query('INSERT INTO group_members(group_id,user_id,role,joined_at) VALUES($1,$2,\'member\',$3) ON CONFLICT DO NOTHING',[req.params.id,uid,Date.now()]);
 res.json({ok:true});
});
app.delete('/api/groups/:id/members/:uid',auth,async(req,res)=>{
 const admin=await pool.query('SELECT role FROM group_members WHERE group_id=$1 AND user_id=$2',[req.params.id,req.user.id]);
 if(!admin.rowCount||!['admin','owner'].includes(admin.rows[0].role))return res.status(403).json({error:'Только администратор может удалять участников'});
 if(req.params.uid===req.user.id)return res.status(400).json({error:'Нельзя удалить самого себя'});
 await pool.query('DELETE FROM group_members WHERE group_id=$1 AND user_id=$2',[req.params.id,req.params.uid]);
 res.json({ok:true});
});
app.patch('/api/groups/:id',auth,async(req,res)=>{
 const admin=await pool.query('SELECT role FROM group_members WHERE group_id=$1 AND user_id=$2',[req.params.id,req.user.id]);
 if(!admin.rowCount||!['admin','owner'].includes(admin.rows[0].role))return res.status(403).json({error:'Только администратор может менять группу'});
 const name=typeof req.body.name==='string'?req.body.name.trim().slice(0,40):null;
 const avatar=typeof req.body.avatar==='string'?req.body.avatar:null;
 if(avatar&&avatar.length>2800000)return res.status(413).json({error:'Аватар слишком большой'});
 const r=await pool.query('UPDATE groups SET name=COALESCE($1,name),avatar=COALESCE($2,avatar) WHERE id=$3 RETURNING *',[name,avatar,req.params.id]);
 res.json(r.rows[0]);
});
app.get('/api/groups',auth,async(req,res)=>{
 const r=await pool.query(`SELECT g.*,gm.role,(SELECT COUNT(*) FROM group_members x WHERE x.group_id=g.id) members FROM groups g JOIN group_members gm ON gm.group_id=g.id AND gm.user_id=$1 ORDER BY g.created_at DESC`,[req.user.id]);
 res.json(r.rows.map(g=>({id:g.id,name:g.name,avatar:g.avatar,createdBy:g.created_by,createdAt:Number(g.created_at),role:g.role,members:Number(g.members)})));
});
app.post('/api/groups',auth,async(req,res)=>{
 const name=String(req.body.name||'').trim().slice(0,40); if(!name)return res.status(400).json({error:'Введите название группы'});
 const gid=id(),now=Date.now();
 await pool.query('BEGIN'); try{
  await pool.query('INSERT INTO groups(id,name,created_by,created_at) VALUES($1,$2,$3,$4)',[gid,name,req.user.id,now]);
  await pool.query('INSERT INTO group_members(group_id,user_id,role,joined_at) VALUES($1,$2,\'owner\',$3)',[gid,req.user.id,now]);
  await pool.query('COMMIT'); res.json({id:gid,name,createdBy:req.user.id,createdAt:now,role:'owner',members:1});
 }catch(e){await pool.query('ROLLBACK');res.status(500).json({error:'Не удалось создать группу'});}
});
app.post('/api/groups/:id/members',auth,async(req,res)=>{
 const uid=String(req.body.userId||''); const g=await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[req.params.id,req.user.id]);
 if(!g.rowCount)return res.status(403).json({error:'Вы не участник группы'});
 if(!await getUser(uid))return res.status(404).json({error:'Пользователь не найден'});
 await pool.query('INSERT INTO group_members(group_id,user_id,role,joined_at) VALUES($1,$2,\'member\',$3) ON CONFLICT DO NOTHING',[req.params.id,uid,Date.now()]);
 res.json({ok:true});
});
app.get('/api/groups/:id/messages',auth,async(req,res)=>{
 const mem=await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[req.params.id,req.user.id]); if(!mem.rowCount)return res.status(403).json({error:'Нет доступа'});
 const r=await pool.query('SELECT id,"from",text,type,media_url,created_at,edited,deleted FROM group_messages WHERE group_id=$1 ORDER BY created_at ASC LIMIT 500',[req.params.id]);
 res.json(r.rows.map(m=>({id:m.id,from:m.from,text:m.deleted?'Сообщение удалено':m.text,type:m.deleted?'deleted':m.type,mediaUrl:m.deleted?'':m.media_url,createdAt:Number(m.created_at),edited:!!m.edited,deleted:!!m.deleted,reactions:[]})));
});
app.post('/api/groups/:id/messages',auth,async(req,res)=>{
 const mem=await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[req.params.id,req.user.id]); if(!mem.rowCount)return res.status(403).json({error:'Нет доступа'});
 const text=String(req.body.text||'').trim(); if(!text||text.length>4000)return res.status(400).json({error:'Сообщение пустое или слишком длинное'});
 const m={id:id(),groupId:req.params.id,from:req.user.id,text,type:'text',mediaUrl:'',createdAt:Date.now(),edited:false,deleted:false};
 await pool.query('INSERT INTO group_messages(id,group_id,"from",text,type,created_at) VALUES($1,$2,$3,$4,$5,$6)',[m.id,m.groupId,m.from,m.text,m.type,m.createdAt]);
 const members=await pool.query('SELECT user_id FROM group_members WHERE group_id=$1',[req.params.id]); members.rows.forEach(x=>io.to(x.user_id).emit('group:message',m)); res.json(m);
});


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
  await pool.query('DELETE FROM hidden_chats WHERE user_id=$1 AND peer_id=$2',[req.user.id,to]);
  const m={id:id(),from:req.user.id,to,text:type==='text'?text:'',type,mediaUrl:type==='text'?'':mediaUrl,createdAt:Date.now(),edited:false,deleted:false,reactions:[]};
  await pool.query('INSERT INTO messages(id,"from","to",text,type,media_url,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[m.id,m.from,m.to,m.text,m.type,m.mediaUrl,m.createdAt]);
  io.to(to).emit('message',m);
  res.json(m);
});

app.get('/api/messages/:uid/pinned',auth,async(req,res)=>{
 const r=await pool.query(`SELECT m.id,m."from",m."to",m.text,m.type,m.media_url,m.created_at,m.edited,m.deleted FROM pinned_messages p JOIN messages m ON m.id=p.message_id WHERE p.user_id=$1 AND ((m."from"=$1 AND m."to"=$2) OR (m."from"=$2 AND m."to"=$1)) ORDER BY p.pinned_at DESC`,[req.user.id,req.params.uid]);
 res.json(r.rows.map(m=>({id:m.id,from:m.from,to:m.to,text:m.deleted?'Сообщение удалено':m.text,type:m.deleted?'deleted':m.type,mediaUrl:m.deleted?'':m.media_url,createdAt:Number(m.created_at),edited:!!m.edited,deleted:!!m.deleted,pinned:true})));
});
app.post('/api/messages/:id/pin',auth,async(req,res)=>{
 const m=await pool.query('SELECT "from","to" FROM messages WHERE id=$1 AND ("from"=$2 OR "to"=$2)',[req.params.id,req.user.id]); if(!m.rowCount)return res.status(404).json({error:'Сообщение не найдено'});
 const old=await pool.query('SELECT 1 FROM pinned_messages WHERE message_id=$1 AND user_id=$2',[req.params.id,req.user.id]);
 if(old.rowCount) await pool.query('DELETE FROM pinned_messages WHERE message_id=$1 AND user_id=$2',[req.params.id,req.user.id]);
 else await pool.query('INSERT INTO pinned_messages(message_id,user_id,pinned_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[req.params.id,req.user.id,Date.now()]);
 res.json({pinned:!old.rowCount});
});
app.patch('/api/messages/:id',auth,async(req,res)=>{
  const text=String(req.body.text||'').trim();
  if(!text||text.length>4000)return res.status(400).json({error:'Сообщение пустое или слишком длинное'});
  const r=await pool.query("UPDATE messages SET text=$1,edited=true WHERE id=$2 AND \"from\"=$3 AND type='text' AND deleted=false RETURNING id,\"from\",\"to\",text,type,media_url,created_at,edited,deleted",[text,req.params.id,req.user.id]);
  if(!r.rowCount)return res.status(404).json({error:'Сообщение не найдено или его нельзя изменить'});
  const m=r.rows[0]; const out={id:m.id,from:m.from,to:m.to,text:m.text,type:m.type,mediaUrl:m.media_url,createdAt:Number(m.created_at),edited:true,deleted:false,reactions:[]};
  io.to(m.to).emit('message:update',out); io.to(m.from).emit('message:update',out); res.json(out);
});
app.delete('/api/messages/:id',auth,async(req,res)=>{
  const r=await pool.query("UPDATE messages SET text='',media_url='',type='deleted',deleted=true WHERE id=$1 AND \"from\"=$2 AND deleted=false RETURNING id,\"from\",\"to\",created_at",[req.params.id,req.user.id]);
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
app.get('/api/groups',auth,async(req,res)=>{
 const r=await pool.query(`SELECT g.id,g.name,g.avatar,COUNT(gm2.user_id)::int AS members
 FROM groups g JOIN group_members gm ON gm.group_id=g.id
 LEFT JOIN group_members gm2 ON gm2.group_id=g.id WHERE gm.user_id=$1
 GROUP BY g.id ORDER BY g.created_at DESC`,[req.user.id]);
 res.json(r.rows);
});
app.post('/api/groups',auth,async(req,res)=>{
 const name=String(req.body.name||'').trim().slice(0,40),members=Array.isArray(req.body.members)?req.body.members.map(String):[];
 if(!name)return res.status(400).json({error:'Введите название группы'});
 const gid=id(),now=Date.now(),client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('INSERT INTO groups(id,name,created_by,created_at) VALUES($1,$2,$3,$4)',[gid,name,req.user.id,now]);
  for(const uid of [...new Set([req.user.id,...members])]) await client.query('INSERT INTO group_members(group_id,user_id,role,joined_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[gid,uid,uid===req.user.id?'admin':'member',now]);
  await client.query('COMMIT');res.json({id:gid,name,avatar:'',members:[...new Set([req.user.id,...members])].length});
 }catch(e){await client.query('ROLLBACK');res.status(500).json({error:'Не удалось создать группу'});}finally{client.release();}
});
app.get('/api/groups/:id/messages',auth,async(req,res)=>{
 const ok=await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[req.params.id,req.user.id]);
 if(!ok.rowCount)return res.status(403).json({error:'Нет доступа'});
 const r=await pool.query('SELECT id,"from",text,type,media_url,created_at,edited,deleted FROM group_messages WHERE group_id=$1 ORDER BY created_at DESC LIMIT 300',[req.params.id]);
 res.json(r.rows.reverse().map(m=>({id:m.id,from:m.from,text:m.deleted?'Сообщение удалено':m.text,type:m.deleted?'deleted':m.type,mediaUrl:m.deleted?'':m.media_url,createdAt:Number(m.created_at),edited:!!m.edited,deleted:!!m.deleted})));
});
app.post('/api/groups/:id/messages',auth,async(req,res)=>{
 const ok=await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[req.params.id,req.user.id]);
 if(!ok.rowCount)return res.status(403).json({error:'Нет доступа'});
 const type=String(req.body.type||'text'),text=String(req.body.text||'').trim(),mediaUrl=String(req.body.mediaUrl||'');
 if(type==='text'&&(!text||text.length>4000))return res.status(400).json({error:'Сообщение пустое или слишком длинное'});
 if(type==='image'&&!mediaUrl.startsWith('data:image/'))return res.status(400).json({error:'Некорректное изображение'});
 if(type==='audio'&&!mediaUrl.startsWith('data:audio/'))return res.status(400).json({error:'Некорректное аудио'});
 const m={id:id(),groupId:req.params.id,from:req.user.id,text:type==='text'?text:'',type,mediaUrl:type==='text'?'':mediaUrl,createdAt:Date.now(),edited:false,deleted:false};
 await pool.query('INSERT INTO group_messages(id,group_id,"from",text,type,media_url,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[m.id,m.groupId,m.from,m.text,m.type,m.mediaUrl,m.createdAt]);
 const ms=await pool.query('SELECT user_id FROM group_members WHERE group_id=$1',[m.groupId]);
 ms.rows.forEach(x=>io.to(x.user_id).emit('group:message',m));res.json(m);
});
app.get('/api/messages/search',auth,async(req,res)=>{
 const q=String(req.query.q||'').trim();if(q.length<2)return res.json([]);
 const r=await pool.query(`SELECT m.id,m."from",m."to",m.text,m.created_at,u.name,u.username
 FROM messages m JOIN users u ON u.id=m."from"
 WHERE (m."from"=$1 OR m."to"=$1) AND m.deleted=false AND m.text ILIKE '%'||$2||'%' ORDER BY m.created_at DESC LIMIT 100`,[req.user.id,q]);
 res.json(r.rows.map(m=>({id:m.id,from:m.from,to:m.to,text:m.text,createdAt:Number(m.created_at),author:m.name,username:m.username})));
});
app.post('/api/messages/:uid/read',auth,async(req,res)=>{
 const now=Date.now();await pool.query(`INSERT INTO conversation_reads(user_id,peer_id,last_read_at) VALUES($1,$2,$3)
 ON CONFLICT(user_id,peer_id) DO UPDATE SET last_read_at=EXCLUDED.last_read_at`,[req.user.id,req.params.uid,now]);res.json({ok:true});
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