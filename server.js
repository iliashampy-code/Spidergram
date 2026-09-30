const express=require('express');
const http=require('http');
const path=require('path');
const {Server}=require('socket.io');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const cors=require('cors');
const crypto=require('crypto');
const {Pool}=require('pg');
const webpush=require('web-push');

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
const taskTitleRewards=[
 {key:'night_spider',name:'night spider',start:'#102a72',end:'#ffffff',animated:true,description:'Использовать SpiderGram ночью'},
 {key:'big_boss',name:'Big boss',start:'#111111',end:'#ef4444',animated:true,description:'Создать 5 групп'},
 {key:'friendly',name:'дружелюбный',start:'#a3e635',end:'#a3e635',animated:false,description:'Отправить сообщение 10 разным людям'},
 {key:'nightnik',name:'ночник',start:'#111111',end:'#fff1a8',animated:true,description:'Использовать мессенджер после 00:00 5 раз'},
 {key:'batman',name:'batman',start:'#111111',end:'#facc15',animated:true,description:'Отправить сообщение в 3:00–4:00 ночи'}
];
const shopItems=[
 {id:'color_cyan',type:'color',name:'Неоновый голубой',price:60,value:'#00d9ff',description:'Цвет интерфейса'},
 {id:'color_purple',type:'color',name:'Неоновый фиолетовый',price:70,value:'#a855f7',description:'Цвет интерфейса'},
 {id:'color_lime',type:'color',name:'Салатовый',price:70,value:'#a3e635',description:'Цвет интерфейса'},
 {id:'gradient_aurora',type:'gradient',name:'Aurora',price:120,value:'linear-gradient(135deg,#0ea5e9,#8b5cf6,#ec4899)',description:'Градиент интерфейса'},
 {id:'gradient_sunset',type:'gradient',name:'Sunset',price:140,value:'linear-gradient(135deg,#f97316,#ec4899,#8b5cf6)',description:'Градиент интерфейса'},
 {id:'bg_grid',type:'background',name:'Техно-сетка',price:80,value:'grid',description:'Особый фон сообщений'},
 {id:'bg_stars',type:'background',name:'Звёзды',price:100,value:'stars',description:'Особый фон сообщений'},
 {id:'bg_aurora',type:'animated_background',name:'Живая Aurora',price:250,value:'aurora',description:'Анимированный фон сообщений'},
 {id:'bg_matrix',type:'animated_background',name:'Matrix',price:300,value:'matrix',description:'Анимированный фон сообщений'},
 {id:'msg_glass',type:'message_style',name:'Glass',price:150,value:'glass',description:'Новый стиль сообщений'},
 {id:'msg_minimal',type:'message_style',name:'Minimal',price:100,value:'minimal',description:'Новый стиль сообщений'},
 {id:'frame_neon',type:'avatar_frame',name:'Неоновая рамка',price:180,value:'neon',description:'Рамка вокруг аватара'},
 {id:'frame_gold',type:'avatar_frame',name:'Золотая рамка',price:220,value:'gold',description:'Рамка вокруг аватара'},
 {id:'effect_glow',type:'profile_effect',name:'Glow',price:250,value:'glow',description:'Эффект профиля'},
 {id:'effect_pulse',type:'profile_effect',name:'Pulse',price:300,value:'pulse',description:'Анимированный эффект профиля'},
 {id:'title_weakling',type:'title',name:'Доходяга',price:250,value:'Доходяга',start:'#111111',end:'#38bdf8',animated:false,description:'Чёрно-голубой титул'},
 {id:'title_error404',type:'title',name:'Error 404',price:350,value:'Error 404',start:'#38bdf8',end:'#ffffff',animated:true,description:'Голубой-белый анимированный титул'}
];
function parseJson(value,fallback){try{return JSON.parse(value||'')}catch{return fallback}}
function currentReward(days){
 const all=rewardForDays(days);
 return all.filter(r=>r.type==='title'&&days>=r.days).pop()||null;
}
const publicUser=u=>({id:u.id,username:u.username,name:u.name||u.username,avatar:u.avatar||'',online:!!u.online,lastSeen:u.last_seen||null,customTitle:u.custom_title||'',adminCheck:!!u.admin_check,selectedTitle:u.selected_title||'',titleAwards:(()=>{try{return JSON.parse(u.title_awards||'[]')}catch{return[]}})(),days:Math.max(0,Math.floor((Date.now()-Number(u.created_at||Date.now()))/86400000)),title:currentReward(Math.max(0,Math.floor((Date.now()-Number(u.created_at||Date.now()))/86400000))) });
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
      admin_check BOOLEAN NOT NULL DEFAULT FALSE,
      selected_title TEXT NOT NULL DEFAULT ''
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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_title TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS title_awards TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS currency INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS task_state TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_owned TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_equipped TEXT NOT NULL DEFAULT '{}';
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
    CREATE TABLE IF NOT EXISTS push_config(
      id INTEGER PRIMARY KEY,
      public_key TEXT NOT NULL,
      private_key TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions(
      endpoint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);
    CREATE TABLE IF NOT EXISTS call_notifications(
      id TEXT PRIMARY KEY,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at BIGINT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE INDEX IF NOT EXISTS call_notifications_to_idx ON call_notifications(to_user_id,read,created_at);
  `);
  const pushCfg=await pool.query('SELECT * FROM push_config WHERE id=1');
  if(!pushCfg.rowCount){
    const keys=webpush.generateVAPIDKeys();
    await pool.query('INSERT INTO push_config(id,public_key,private_key) VALUES(1,$1,$2)',[keys.publicKey,keys.privateKey]);
  }
  const savedPush=await pool.query('SELECT * FROM push_config WHERE id=1');
  const vapid=savedPush.rows[0];
  webpush.setVapidDetails(process.env.VAPID_SUBJECT||'mailto:spidergram@localhost',vapid.public_key,vapid.private_key);

  const resetPassword=String(process.env.DOBRY_RESET_PASSWORD||'');
  if(resetPassword){
    if(resetPassword.length<6) throw new Error('DOBRY_RESET_PASSWORD должен содержать минимум 6 символов');
    const hashed=await bcrypt.hash(resetPassword,12);
    const reset=await pool.query('UPDATE users SET password=$1 WHERE username=$2 RETURNING id',[hashed,'dobry']);
    if(!reset.rowCount) throw new Error('Пользователь @dobry не найден');
    console.log('Пароль @dobry обновлён через DOBRY_RESET_PASSWORD');
  }
}

function taskStateFor(u){const x=parseJson(u.task_state,{});return {nightDates:Array.isArray(x.nightDates)?x.nightDates:[],midnightDates:Array.isArray(x.midnightDates)?x.midnightDates:[],groups:Number(x.groups||0),messages:Number(x.messages||0),photos:Number(x.photos||0),voices:Number(x.voices||0),people:Array.isArray(x.people)?x.people:[],claimed:x.claimed&&typeof x.claimed==='object'?x.claimed:{},titles:Array.isArray(x.titles)?x.titles:[]};}
async function applyActivity(uid,event,localDate,localHour){
 const u=await getUser(uid); if(!u)return {newTitles:[],currencyEarned:0};
 const st=taskStateFor(u); const hour=Math.max(0,Math.min(23,Number(localHour)||0)); const date=String(localDate||new Date().toISOString().slice(0,10)); let changed=false;
 if(event==='visit'){
   if((hour>=22||hour<5)&&!st.nightDates.includes(date)){st.nightDates.push(date);st.nightDates=st.nightDates.slice(-60);changed=true}
   if(hour<5&&!st.midnightDates.includes(date)){st.midnightDates.push(date);st.midnightDates=st.midnightDates.slice(-60);changed=true}
 }else if(event==='group'){const gr=await pool.query('SELECT COUNT(*)::int AS count FROM groups WHERE created_by=$1',[uid]);st.groups=Math.max(st.groups,Number(gr.rows[0]?.count||0));changed=true}
 else if(event==='photo'){st.photos++;changed=true}
 else if(event==='voice'){st.voices++;changed=true}
 else if(event==='message'){st.messages++;changed=true}

 const newTitles=[]; const addTitle=(key)=>{if(!st.titles.includes(key)){st.titles.push(key);newTitles.push(taskTitleRewards.find(x=>x.key===key));changed=true}};
 if(st.nightDates.length>=1)addTitle('night_spider');
 if(st.groups>=5)addTitle('big_boss');
 if(st.people.length>=10)addTitle('friendly');
 if(st.midnightDates.length>=5)addTitle('nightnik');
 if(event==='message'&&hour>=3&&hour<4)addTitle('batman');

 let currencyEarned=0; const reward=(key,condition,amount)=>{if(condition&&!st.claimed[key]){st.claimed[key]=true;currencyEarned+=amount;changed=true}};
 reward('messages25',st.messages>=25,30);
 reward('group1',st.groups>=1,25);
 reward('photos3',st.photos>=3,40);
 reward('voices3',st.voices>=3,40);
 reward('people5',st.people.length>=5,50);
 if(currencyEarned)await pool.query('UPDATE users SET currency=currency+$1 WHERE id=$2',[currencyEarned,uid]);
 if(newTitles.length){let awards=parseJson(u.title_awards,[]);for(const t of newTitles){if(t&&!awards.includes(t.name))awards.push(t.name)}await pool.query('UPDATE users SET title_awards=$1 WHERE id=$2',[JSON.stringify(awards),uid]);}
 if(changed)await pool.query('UPDATE users SET task_state=$1 WHERE id=$2',[JSON.stringify(st),uid]);
 return {newTitles:newTitles.filter(Boolean),currencyEarned};
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

app.post('/api/activity',auth,async(req,res)=>{
 try{
  const event=String(req.body.event||'visit');
  const localDate=String(req.body.localDate||'').slice(0,10);
  const localHour=Number(req.body.localHour);
  if(!['visit','message','group','photo','voice'].includes(event))return res.status(400).json({error:'Неизвестное действие'});
  if(event==='message'&&req.body.peerId){
    const u=await getUser(req.user.id); const st=taskStateFor(u); const peerId=String(req.body.peerId);
    if(peerId&&peerId!==req.user.id&&!st.people.includes(peerId)){st.people.push(peerId);st.people=st.people.slice(-200);await pool.query('UPDATE users SET task_state=$1 WHERE id=$2',[JSON.stringify(st),req.user.id]);}
  }
  const result=await applyActivity(req.user.id,event,localDate,localHour);
  res.json(result);
 }catch(e){res.status(500).json({error:'Не удалось обновить задания'})}
});
app.get('/api/shop',auth,async(req,res)=>{
 const u=await getUser(req.user.id); if(!u)return res.status(404).json({error:'Пользователь не найден'});
 const owned=parseJson(u.shop_owned,[]),equipped=parseJson(u.shop_equipped,{});
 const st=taskStateFor(u); const tasks=[{id:'messages25',name:'Отправить 25 сообщений',reward:30,progress:Math.min(25,st.messages),target:25},{id:'group1',name:'Создать первую группу',reward:25,progress:Math.min(1,st.groups),target:1},{id:'photos3',name:'Отправить 3 фото',reward:40,progress:Math.min(3,st.photos),target:3},{id:'voices3',name:'Отправить 3 голосовых',reward:40,progress:Math.min(3,st.voices),target:3},{id:'people5',name:'Написать 5 разным людям',reward:50,progress:Math.min(5,st.people.length),target:5}].map(x=>({...x,claimed:!!st.claimed[x.id]})); res.json({currency:Number(u.currency||0),items:shopItems.map(x=>({...x,owned:owned.includes(x.id),equipped:equipped[x.type]===x.id})),equipped,tasks});
});
app.post('/api/shop/buy',auth,async(req,res)=>{
 const idv=String(req.body.id||''); const item=shopItems.find(x=>x.id===idv); if(!item)return res.status(404).json({error:'Товар не найден'});
 const u=await getUser(req.user.id); let owned=parseJson(u.shop_owned,[]);
 if(owned.includes(item.id))return res.json({ok:true,already:true,currency:Number(u.currency||0)});
 if(Number(u.currency||0)<item.price)return res.status(400).json({error:'Недостаточно валюты'});
 owned.push(item.id);
 if(item.type==='title'){
   let awards=parseJson(u.title_awards,[]);
   if(!awards.includes(item.value))awards.push(item.value);
   await pool.query('UPDATE users SET currency=currency-$1,shop_owned=$2,title_awards=$3 WHERE id=$4',[item.price,JSON.stringify(owned),JSON.stringify(awards),u.id]);
 }else{
   await pool.query('UPDATE users SET currency=currency-$1,shop_owned=$2 WHERE id=$3',[item.price,JSON.stringify(owned),u.id]);
 }
 res.json({ok:true,currency:Number(u.currency||0)-item.price,item});
});
app.post('/api/shop/equip',auth,async(req,res)=>{
 const item=shopItems.find(x=>x.id===String(req.body.id||'')); if(!item)return res.status(404).json({error:'Товар не найден'});
 const u=await getUser(req.user.id); const owned=parseJson(u.shop_owned,[]); if(!owned.includes(item.id))return res.status(403).json({error:'Сначала купите товар'});
 const equipped=parseJson(u.shop_equipped,{}); equipped[item.type]=item.id;
 await pool.query('UPDATE users SET shop_equipped=$1 WHERE id=$2',[JSON.stringify(equipped),u.id]); res.json({ok:true,equipped});
});
app.get('/api/me',auth,async(req,res)=>{
  const u=await getUser(req.user.id);
  if(!u)return res.status(404).json({error:'Пользователь не найден'});
  res.json(publicUser(u));
});

app.patch('/api/me',auth,async(req,res)=>{
  const u=await getUser(req.user.id);
  if(!u)return res.status(404).json({error:'Пользователь не найден'});
  const name=typeof req.body.name==='string'?(req.body.name.trim().slice(0,40)||u.name||u.username):u.name;
  const username=typeof req.body.username==='string'?req.body.username.trim().toLowerCase():u.username;
  const avatar=typeof req.body.avatar==='string'?req.body.avatar:u.avatar;
  if(!/^[a-z0-9_]{3,24}$/.test(username))return res.status(400).json({error:'Ник: 3–24 латинских символа, цифры или _'});
  if(username!==u.username){
    const exists=await pool.query('SELECT 1 FROM users WHERE username=$1 AND id<>$2',[username,u.id]);
    if(exists.rowCount)return res.status(409).json({error:'Такой ник уже занят'});
  }
  if(avatar.length>2800000)return res.status(413).json({error:'Аватар слишком большой'});
  try{
    const r=await pool.query('UPDATE users SET username=$1,name=$2,avatar=$3 WHERE id=$4 RETURNING *',[username,name,avatar,u.id]);
    res.json(publicUser(r.rows[0]));
  }catch(e){
    if(e?.code==='23505')return res.status(409).json({error:'Такой ник уже занят'});
    res.status(500).json({error:'Не удалось сохранить профиль'});
  }
});
app.patch('/api/me/title',auth,async(req,res)=>{
  const u=await getUser(req.user.id);if(!u)return res.status(404).json({error:'Пользователь не найден'});
  const title=String(req.body.title||'').trim().slice(0,60);
  if(title){
    const days=Math.max(0,Math.floor((Date.now()-Number(u.created_at||Date.now()))/86400000));
    const allowed=rewardForDays(days).find(x=>x.type==='title'&&x.name===title);let awards=[];try{awards=JSON.parse(u.title_awards||'[]')}catch{}
    if(!allowed&&!awards.includes(title))return res.status(400).json({error:'Этот титул ещё не открыт'});
  }
  const r=await pool.query('UPDATE users SET selected_title=$1 WHERE id=$2 RETURNING *',[title,u.id]);
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
 const st=taskStateFor(u);
 const taskTitles=taskTitleRewards.map(r=>({...r,type:'task',unlocked:st.titles.includes(r.key)}));
 const next=rewards.find(r=>!r.unlocked)||null;
 const shopTitles=shopItems.filter(x=>x.type==='title').map(x=>({key:x.id,name:x.name,type:'shop',start:x.start,end:x.end,animated:!!x.animated,unlocked:parseJson(u.shop_owned,[]).includes(x.id)})); res.json({days,rewards,current:currentReward(days),next,progress:next?Math.min(100,Math.round(days/next.days*100)):100,taskTitles,shopTitles});
});
function isOwnerAdmin(u){return String(u?.username||'').toLowerCase()==='dobry'}
async function requireOwnerAdmin(req,res){const u=await getUser(req.user.id);if(!isOwnerAdmin(u)){res.status(403).json({error:'Доступ только для @dobry'});return null}return u}
app.get('/api/admin/users',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const q=String(req.query.q||'').trim().toLowerCase();const r=await pool.query("SELECT * FROM users WHERE ($1='' OR username ILIKE '%'||$1||'%' OR name ILIKE '%'||$1||'%') ORDER BY username LIMIT 50",[q]);res.json(r.rows.map(x=>({...publicUser(x),currency:Number(x.currency||0)})))});
app.patch('/api/admin/users/:id/currency',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});const amount=Math.floor(Number(req.body.amount));if(!Number.isFinite(amount)||amount<=0||amount>1000000)return res.status(400).json({error:'Введите сумму от 1 до 1 000 000 SP'});const r=await pool.query('UPDATE users SET currency=currency+$1 WHERE id=$2 RETURNING currency',[amount,target.id]);res.json({ok:true,currency:Number(r.rows[0].currency||0)});});
app.get('/api/push/public-key',auth,async(req,res)=>{
  const r=await pool.query('SELECT public_key FROM push_config WHERE id=1');
  res.json({publicKey:r.rows[0]?.public_key||''});
});
app.post('/api/push/subscribe',auth,async(req,res)=>{
  try{
    const s=req.body?.subscription||{};
    const endpoint=String(s.endpoint||'');
    const p256dh=String(s.keys?.p256dh||'');
    const authKey=String(s.keys?.auth||'');
    if(!endpoint||!p256dh||!authKey)return res.status(400).json({error:'Некорректная push-подписка'});
    await pool.query('INSERT INTO push_subscriptions(endpoint,user_id,p256dh,auth,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(endpoint) DO UPDATE SET user_id=EXCLUDED.user_id,p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth',[endpoint,req.user.id,p256dh,authKey,Date.now()]);
    res.json({ok:true});
  }catch(e){res.status(500).json({error:'Не удалось сохранить push-подписку'});}
});
app.delete('/api/push/subscribe',auth,async(req,res)=>{
  const endpoint=String(req.body?.endpoint||'');
  if(endpoint)await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2',[endpoint,req.user.id]);
  res.json({ok:true});
});
async function sendPushToUser(userId,payload){
  const r=await pool.query('SELECT endpoint,p256dh,auth FROM push_subscriptions WHERE user_id=$1',[userId]);
  for(const s of r.rows){
    try{
      await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify(payload),{TTL:60});
    }catch(e){
      if(e?.statusCode===404||e?.statusCode===410)await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1',[s.endpoint]);
      else console.warn('Push notification error:',e?.message||e);
    }
  }
}

app.post('/api/users/:id/call',auth,async(req,res)=>{
  if(req.params.id===req.user.id)return res.status(400).json({error:'Нельзя позвать самого себя'});
  const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});
  const me=await getUser(req.user.id);
  const recent=await pool.query('SELECT 1 FROM call_notifications WHERE to_user_id=$1 AND from_user_id=$2 AND created_at>$3 LIMIT 1',[target.id,me.id,Date.now()-60000]);
  if(recent.rowCount)return res.status(429).json({error:'Можно отправлять приглашение этому пользователю не чаще одного раза в минуту'});
  const n={id:id(),to_user_id:target.id,from_user_id:me.id,created_at:Date.now()};
  await pool.query('INSERT INTO call_notifications(id,to_user_id,from_user_id,created_at,read) VALUES($1,$2,$3,$4,false)',[n.id,n.to_user_id,n.from_user_id,n.created_at]);
  io.to(target.id).emit('call:notify',{id:n.id,from:publicUser(me),createdAt:n.created_at});
  sendPushToUser(target.id,{type:'call',title:'SpiderGram',body:(me.name||me.username)+' хочет с вами поговорить',from:publicUser(me)}).catch(e=>console.warn('Push send failed:',e?.message||e));
  res.json({ok:true});
});
app.get('/api/notifications',auth,async(req,res)=>{
  const r=await pool.query('SELECT n.id,n.created_at,u.id AS from_id,u.username,u.name,u.avatar FROM call_notifications n JOIN users u ON u.id=n.from_user_id WHERE n.to_user_id=$1 AND n.read=false ORDER BY n.created_at DESC LIMIT 20',[req.user.id]);
  await pool.query('UPDATE call_notifications SET read=true WHERE to_user_id=$1 AND read=false',[req.user.id]);
  res.json(r.rows.map(x=>({id:x.id,type:'call',from:{id:x.from_id,username:x.username,name:x.name,avatar:x.avatar||''},createdAt:Number(x.created_at)})));
});
app.patch('/api/admin/users/:id/title',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});const title=String(req.body.title||'').trim().slice(0,50);const selectedTitle=String(req.body.selectedTitle||'').trim().slice(0,60);if(selectedTitle){const reward=rewardForDays(356).find(x=>x.type==='title'&&x.name===selectedTitle);if(!reward)return res.status(400).json({error:'Такого титула за достижение нет'});let awards=[];try{awards=JSON.parse(target.title_awards||'[]')}catch{}awards=Array.from(new Set([...awards,selectedTitle]));await pool.query('UPDATE users SET selected_title=$1,custom_title=$2,title_awards=$3 WHERE id=$4',[selectedTitle,'',JSON.stringify(awards),target.id]);}else{await pool.query('UPDATE users SET selected_title=$1,custom_title=$2 WHERE id=$3',['',title,target.id]);}res.json(publicUser(await getUser(target.id)))});
app.delete('/api/admin/users/:id/title',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});let awards=[];try{awards=JSON.parse(target.title_awards||'[]')}catch{}if(target.selected_title)awards=awards.filter(x=>x!==target.selected_title);await pool.query('UPDATE users SET selected_title=$1,custom_title=$2,title_awards=$3 WHERE id=$4',['','',JSON.stringify(awards),target.id]);res.json(publicUser(await getUser(target.id)))});

app.patch('/api/admin/users/:id/titles/all',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});const all=rewardForDays(356).filter(x=>x.type==='title').map(x=>x.name);let awards=[];try{awards=JSON.parse(target.title_awards||'[]')}catch{}awards=Array.from(new Set([...awards,...all]));await pool.query('UPDATE users SET title_awards=$1 WHERE id=$2',[JSON.stringify(awards),target.id]);res.json(publicUser(await getUser(target.id)))});
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
  await pool.query('COMMIT'); const local=new Date(); const activityResult=await applyActivity(req.user.id,'group',local.getFullYear()+"-"+String(local.getMonth()+1).padStart(2,"0")+"-"+String(local.getDate()).padStart(2,"0"),local.getHours()); res.json({id:gid,name,createdBy:req.user.id,createdAt:now,role:'owner',members:1,...activityResult});
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
  const local=new Date();const activityEvent=type==='image'?'photo':type==='audio'?'voice':'message';const activityResult=await applyActivity(req.user.id,activityEvent,local.getFullYear()+"-"+String(local.getMonth()+1).padStart(2,"0")+"-"+String(local.getDate()).padStart(2,"0"),local.getHours());
  res.json({...m,...activityResult});
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
  await client.query('COMMIT');const local=new Date();const activityResult=await applyActivity(req.user.id,'group',local.getFullYear()+"-"+String(local.getMonth()+1).padStart(2,"0")+"-"+String(local.getDate()).padStart(2,"0"),local.getHours());res.json({id:gid,name,avatar:'',members:[...new Set([req.user.id,...members])].length,...activityResult});
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