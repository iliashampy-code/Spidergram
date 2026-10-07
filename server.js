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
app.use(express.json({limit:'20mb'}));

const ROOT=__dirname;
const SECRET=process.env.JWT_SECRET||'CHANGE_THIS_SPIDERGRAM_SECRET_2026';
const PORT=Number(process.env.PORT||3000);
const PIONEER_GRANT_CUTOFF=Date.parse('2026-10-03T08:13:58Z');
const FOUNDER_TITLE={key:'founder',name:'Первопроходец',type:'task',start:'#111111',end:'#22c55e',animated:true,description:'Выдан всем пользователям, зарегистрированным до запуска этой награды'};
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
 {key:'collector',name:'Коллекционер',start:'#67e8f9',end:'#ffffff',animated:true,description:'Выполнить 10 достижений'},
 {key:'unstoppable',name:'Без остановки',start:'#ff2d00',end:'#ffd000',animated:true,description:'Заходить в SpiderGram 7 дней подряд'},
 {key:'night_spider',name:'night spider',start:'#102a72',end:'#ffffff',animated:true,description:'Использовать SpiderGram ночью в 7 разных дней'},
 {key:'big_boss',name:'Big boss',start:'#111111',end:'#ef4444',animated:true,description:'Создать 10 групп'},
 {key:'friendly',name:'дружелюбный',start:'#a3e635',end:'#a3e635',animated:false,description:'Отправить сообщения 10 разным людям'},
 {key:'nightnik',name:'ночник',start:'#111111',end:'#fff1a8',animated:true,description:'Использовать мессенджер после 00:00 в 10 разных дней'},
 {key:'batman',name:'batman',start:'#111111',end:'#facc15',animated:true,description:'Отправить сообщения в 3:00–4:00 ночи в 5 разных дней'},
 {key:'living_legend',name:'живая легенда',start:'#facc15',end:'#ffffff',animated:true,description:'Отправить 500 сообщений'},
 {key:'love',name:'Love',start:'#111111',end:'#ec4899',animated:true,description:'Написать 25 разным людям'},
 {key:'emperor',name:'Император',start:'#111111',end:'#facc15',animated:true,description:'Создать 20 групп и отправить 500 сообщений'},
 {key:'sweet_dreams',name:'Sweet dreams',start:'#e11d48',end:'#ffffff',animated:true,description:'Зайти в SpiderGram 7 раз с 21:00 до 22:00'}
];
const taskTitleNames=taskTitleRewards.map(x=>x.name);
const shopItems=[
 {id:'color_slate',type:'color',name:'Тёмно-серый',price:20,value:'#64748b',description:'Сдержанный тёмно-серый цвет интерфейса'},
 {id:'color_graphite',type:'color',name:'Графитовый',price:20,value:'#7c8796',description:'Контрастный графитовый цвет интерфейса'},
 {id:'color_red',type:'color',name:'Красный',price:20,value:'#ef4444',description:'Яркий красный цвет интерфейса'},
 {id:'color_orange',type:'color',name:'Оранжевый',price:20,value:'#f97316',description:'Тёплый оранжевый цвет интерфейса'},
 {id:'color_amber',type:'color',name:'Янтарный',price:20,value:'#f59e0b',description:'Янтарный цвет интерфейса'},
 {id:'color_teal',type:'color',name:'Бирюзовый',price:20,value:'#14b8a6',description:'Контрастный бирюзовый цвет интерфейса'},
 {id:'color_pink',type:'color',name:'Розовый',price:20,value:'#ec4899',description:'Яркий розовый цвет интерфейса'},
 {id:'color_indigo',type:'color',name:'Индиго',price:20,value:'#6366f1',description:'Насыщенный индиго-цвет интерфейса'},
 {id:'color_cyan',type:'color',name:'Неоновый голубой',price:20,value:'#00d9ff',description:'Цвет интерфейса'},
 {id:'color_purple',type:'color',name:'Неоновый фиолетовый',price:20,value:'#a855f7',description:'Цвет интерфейса'},
 {id:'color_lime',type:'color',name:'Салатовый',price:20,value:'#a3e635',description:'Цвет интерфейса'},
 {id:'gradient_aurora',type:'gradient',name:'Aurora',price:120,value:'linear-gradient(135deg,#0ea5e9,#8b5cf6,#ec4899)',start:'#0ea5e9',end:'#ec4899',description:'Градиент интерфейса'},
 {id:'gradient_sunset',type:'gradient',name:'Sunset',price:140,value:'linear-gradient(135deg,#f97316,#ec4899,#8b5cf6)',start:'#f97316',end:'#8b5cf6',description:'Градиент интерфейса'},
 {id:'gradient_ocean',type:'gradient',name:'Ocean',price:130,value:'linear-gradient(135deg,#06b6d4,#2563eb,#312e81)',start:'#06b6d4',end:'#312e81',description:'Голубой-синий градиент'},
 {id:'gradient_fire',type:'gradient',name:'Fire',price:150,value:'linear-gradient(135deg,#facc15,#f97316,#ef4444)',start:'#facc15',end:'#ef4444',description:'Жёлто-оранжево-красный градиент'},
 {id:'gradient_candy',type:'gradient',name:'Candy',price:160,value:'linear-gradient(135deg,#f9a8d4,#c084fc,#818cf8)',start:'#f9a8d4',end:'#818cf8',description:'Розово-фиолетовый градиент'},
 {id:'gradient_emerald',type:'gradient',name:'Emerald',price:145,value:'linear-gradient(135deg,#34d399,#10b981,#065f46)',start:'#34d399',end:'#065f46',description:'Изумрудный градиент'},
 {id:'gradient_midnight',type:'gradient',name:'Midnight',price:180,value:'linear-gradient(135deg,#111827,#312e81,#581c87)',start:'#111827',end:'#581c87',description:'Тёмный фиолетово-синий градиент'},
 {id:'gradient_cotton',type:'gradient',name:'Cotton Candy',price:170,value:'linear-gradient(135deg,#fbcfe8,#f0abfc,#93c5fd)',start:'#fbcfe8',end:'#93c5fd',description:'Нежный розово-голубой градиент'},
 {id:'bg_grid',type:'background',name:'Техно-сетка',price:80,value:'grid',description:'Особый фон сообщений'},
 {id:'bg_stars',type:'background',name:'Звёзды',price:100,value:'stars',description:'Особый фон сообщений'},
 {id:'bg_aurora',type:'animated_background',name:'Живая Aurora',price:250,value:'aurora',description:'Анимированный фон сообщений'},
 {id:'msg_glass',type:'message_style',name:'Glass',price:150,value:'glass',description:'Новый стиль сообщений'},
 {id:'frame_neon',type:'avatar_frame',name:'Неоновая рамка',price:180,value:'neon',description:'Рамка вокруг аватара'},
 {id:'frame_gold',type:'avatar_frame',name:'Золотая рамка',price:220,value:'gold',description:'Рамка вокруг аватара'},
 {id:'effect_glow',type:'profile_effect',name:'Glow',price:250,value:'glow',description:'Эффект профиля'},
 {id:'effect_pulse',type:'profile_effect',name:'Pulse',price:300,value:'pulse',description:'Анимированный эффект профиля'},
 
 {id:'bg_sunset',type:'background',name:'Закат',price:110,value:'sunset',description:'Тёплый особый фон сообщений'},
 {id:'bg_ocean',type:'background',name:'Глубокий океан',price:120,value:'ocean',description:'Сине-голубой особый фон сообщений'},
 {id:'bg_neon',type:'animated_background',name:'Neon Flow',price:260,value:'neon',description:'Анимированный неоновый фон'},
 {id:'bg_sunset_anim',type:'animated_background',name:'Живой закат',price:290,value:'sunset_anim',description:'Плавный анимированный закат'},
 {id:'bg_cosmos',type:'background',name:'Космос',price:135,value:'cosmos',description:'Глубокий космический фон'},
 {id:'bg_lavender',type:'background',name:'Лаванда',price:115,value:'lavender',description:'Мягкий фиолетовый фон'},
 {id:'bg_void',type:'background',name:'Void',price:145,value:'void',description:'Тёмный минималистичный фон'},
 {id:'bg_matrix2',type:'animated_background',name:'Digital Rain',price:300,value:'digital_rain',description:'Анимированный цифровой дождь'},
 {id:'bg_cosmos_anim',type:'animated_background',name:'Живой космос',price:310,value:'cosmos_anim',description:'Плавно движущийся космический фон'},
 {id:'bg_wave',type:'animated_background',name:'Neon Waves',price:499,value:'waves',description:'Анимированные неоновые волны'},
 {id:'bg_spider_web',type:'background',name:'Паучья сеть',price:180,value:'spider_web',description:'Тёмная паутина с красным свечением'},
 {id:'bg_spider_night',type:'background',name:'Паучья ночь',price:210,value:'spider_night',description:'Чёрно-фиолетовая тема SpiderGram'},
 {id:'bg_spider_venom',type:'background',name:'Яд паука',price:240,value:'spider_venom',description:'Тёмная зелёная паучья тема'},
 {id:'bg_spider_neon',type:'animated_background',name:'Neon Spider',price:330,value:'spider_neon',description:'Анимированная красно-синяя паучья тема'},
 {id:'bg_spider_web_anim',type:'animated_background',name:'Живая паутина',price:360,value:'spider_web_anim',description:'Анимированная паутина с пульсацией'},
 {id:'msg_neon',type:'message_style',name:'Neon',price:170,value:'neon',description:'Неоновый стиль сообщений'},
 {id:'msg_soft',type:'message_style',name:'Soft',price:130,value:'soft',description:'Мягкий стиль сообщений'},
 {id:'msg_outline',type:'message_style',name:'Outline',price:160,value:'outline',description:'Контурный стиль сообщений'},
 {id:'msg_bubble',type:'message_style',name:'Bubble',price:155,value:'bubble',description:'Мягкие объёмные сообщения'},
 {id:'msg_terminal',type:'message_style',name:'Terminal',price:175,value:'terminal',description:'Стиль терминала'},
 {id:'msg_gradient',type:'message_style',name:'Gradient',price:190,value:'gradient',description:'Градиентные сообщения'},
 {id:'frame_ice',type:'avatar_frame',name:'Ледяная рамка',price:200,value:'ice',description:'Голубая сияющая рамка'},
 {id:'frame_fire',type:'avatar_frame',name:'Огненная рамка',price:230,value:'fire',description:'Красно-оранжевая рамка'},
 {id:'frame_purple',type:'avatar_frame',name:'Фиолетовая рамка',price:210,value:'purple',description:'Фиолетовое свечение'},
 {id:'frame_diamond',type:'avatar_frame',name:'Алмазная рамка',price:260,value:'diamond',description:'Переливающаяся рамка'},
 {id:'frame_rainbow',type:'avatar_frame',name:'Радужная рамка',price:290,value:'rainbow',description:'Переливающаяся радужная рамка'},
 {id:'frame_aurora',type:'avatar_frame',name:'Aurora Frame',price:280,value:'aurora',description:'Анимированная северная рамка'},
 {id:'frame_blackgold',type:'avatar_frame',name:'Чёрное золото',price:275,value:'blackgold',description:'Чёрно-золотая рамка'},
 {id:'effect_ring',type:'profile_effect',name:'Energy Ring',price:280,value:'ring',description:'Энергетическое кольцо вокруг профиля'},
 {id:'effect_shadow',type:'profile_effect',name:'Shadow',price:190,value:'shadow',description:'Глубокая тень профиля'},
 {id:'effect_spark',type:'profile_effect',name:'Spark',price:320,value:'spark',description:'Анимированное свечение профиля'},
 {id:'effect_orbit',type:'profile_effect',name:'Orbit',price:340,value:'orbit',description:'Движущееся энергетическое кольцо'},
 {id:'effect_flame',type:'profile_effect',name:'Flame',price:330,value:'flame',description:'Пульсирующее пламя профиля'},
 {id:'effect_aurora',type:'profile_effect',name:'Aurora Glow',price:360,value:'aurora',description:'Анимированное северное сияние'},
 {id:'title_weakling',type:'title',name:'Доходяга',price:550,value:'Доходяга',start:'#111111',end:'#38bdf8',animated:true,description:'Чёрно-голубой титул'},
 {id:'title_error404',type:'title',name:'Error 404',price:550,value:'Error 404',start:'#38bdf8',end:'#ffffff',animated:true,description:'Голубой-белый анимированный титул'},
 {id:'title_starstruck',type:'title',name:'Звезданутый',price:619,value:'Звезданутый',start:'#facc15',end:'#ffffff',animated:true,description:'Жёлто-белый анимированный титул'},
 {id:'title_kotik',type:'title',name:'Котик',price:250,value:'Котик',start:'#22c55e',end:'#ffffff',animated:true,description:'Зелёно-белый анимированный титул'},
 {id:'title_seal',type:'title',name:'Тюлень',price:550,value:'Тюлень',start:'#38bdf8',end:'#ffffff',animated:true,description:'Голубой-белый анимированный титул'},
 {id:'title_ghost',type:'title',name:'Ghost',price:799,value:'Ghost',start:'#6b7280',end:'#050505',animated:true,description:'Серый-чёрный анимированный градиент'},
 {id:'bg_cloudy_sky',type:'animated_background',name:'Cloudy Sky',price:499,value:'cloudy_sky',description:'Плавно переливающиеся оттенки пасмурного неба без отдельных облаков'},
 {id:'bg_night_city',type:'animated_background',name:'Night City',price:499,value:'night_city',description:'Стилизованный ночной город с медленным движением неоновых огней'},
 {id:'bg_northern_lights',type:'animated_background',name:'Northern Lights',price:499,value:'northern_lights',description:'Мягкое анимированное северное сияние в графическом стиле'},
 {id:'bg_blood_moon',type:'animated_background',name:'Blood Moon',price:499,value:'blood_moon',description:'Тёмный фон с пульсирующим красным лунным свечением'},
 {id:'bg_black_sand',type:'animated_background',name:'Black Sand',price:499,value:'black_sand',description:'Абстрактные тёмные волны чёрного песка'},
 {id:'bg_deep_ocean_anim',type:'animated_background',name:'Deep Ocean',price:499,value:'deep_ocean_anim',description:'Стилизованные движущиеся волны глубокого океана'},
 {id:'bg_galaxy_anim',type:'animated_background',name:'Galaxy',price:499,value:'galaxy_anim',description:'Абстрактная галактика с медленно движущимися световыми пятнами'}
];
function parseJson(value,fallback){try{return JSON.parse(value||'')}catch{return fallback}}
function currentReward(days){
 const all=rewardForDays(days);
 return all.filter(r=>r.type==='title'&&days>=r.days).pop()||null;
}
const publicUser=u=>({id:u.id,username:u.username,name:u.name||u.username,avatar:u.avatar||'',online:!!u.online,lastSeen:u.last_seen||null,customTitle:u.custom_title||'',adminCheck:!!u.admin_check,selectedTitle:u.selected_title||'',titleAwards:(()=>{try{return JSON.parse(u.title_awards||'[]')}catch{return[]}})(),customColorEnabled:!!u.custom_color_enabled,days:Math.max(0,Math.floor((Date.now()-Number(u.created_at||Date.now()))/86400000)),title:currentReward(Math.max(0,Math.floor((Date.now()-Number(u.created_at||Date.now()))/86400000))) });
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
    CREATE TABLE IF NOT EXISTS media_reservations(
      id TEXT PRIMARY KEY,
      object_key TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_type TEXT NOT NULL,
      size_bytes BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      expires_at BIGINT
    );
    CREATE INDEX IF NOT EXISTS media_reservations_expiry_idx ON media_reservations(expires_at);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_title TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_check BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_title TEXT NOT NULL DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS title_awards TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS currency INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS task_state TEXT NOT NULL DEFAULT '{}';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_color_enabled BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_owned TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS shop_equipped TEXT NOT NULL DEFAULT '{}';
    UPDATE users SET shop_owned = COALESCE((SELECT json_agg(x) FROM json_array_elements_text(COALESCE(NULLIF(users.shop_owned,''),'[]')::json) x WHERE x <> 'msg_minimal'),'[]'), shop_equipped = CASE WHEN shop_equipped::json->>'message_style' = 'msg_minimal' THEN (shop_equipped::jsonb - 'message_style')::text ELSE shop_equipped END WHERE shop_owned LIKE '%msg_minimal%' OR shop_equipped LIKE '%msg_minimal%';
    CREATE TABLE IF NOT EXISTS groups(id TEXT PRIMARY KEY,name TEXT NOT NULL,avatar TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at BIGINT NOT NULL);
    CREATE TABLE IF NOT EXISTS group_members(group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL DEFAULT 'member',joined_at BIGINT NOT NULL,PRIMARY KEY(group_id,user_id));
    CREATE TABLE IF NOT EXISTS group_messages(id TEXT PRIMARY KEY,group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,"from" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,text TEXT NOT NULL DEFAULT '',type TEXT NOT NULL DEFAULT 'text',media_url TEXT NOT NULL DEFAULT '',created_at BIGINT NOT NULL,edited BOOLEAN NOT NULL DEFAULT FALSE,deleted BOOLEAN NOT NULL DEFAULT FALSE);
    CREATE INDEX IF NOT EXISTS group_messages_idx ON group_messages(group_id,created_at);
    CREATE TABLE IF NOT EXISTS poll_votes(
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      option_index INTEGER NOT NULL,
      voted_at BIGINT NOT NULL,
      PRIMARY KEY(message_id,user_id,option_index)
    );
    CREATE INDEX IF NOT EXISTS poll_votes_message_idx ON poll_votes(message_id);
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to TEXT;
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
    CREATE TABLE IF NOT EXISTS saved_messages(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_message_id TEXT NOT NULL,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'text',
      media_url TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      saved_at BIGINT NOT NULL,
      UNIQUE(user_id,original_message_id)
    );
    CREATE INDEX IF NOT EXISTS saved_messages_user_idx ON saved_messages(user_id,saved_at);
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
    CREATE TABLE IF NOT EXISTS promo_codes(
      code TEXT PRIMARY KEY,
      reward_sp INTEGER NOT NULL DEFAULT 0,
      reward_title TEXT NOT NULL DEFAULT '',
      max_uses INTEGER NOT NULL DEFAULT 0,
      uses INTEGER NOT NULL DEFAULT 0,
      created_at BIGINT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS promo_redemptions(
      code TEXT NOT NULL REFERENCES promo_codes(code) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      redeemed_at BIGINT NOT NULL,
      PRIMARY KEY(code,user_id)
    );
    CREATE TABLE IF NOT EXISTS system_meta(
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS call_notifications(
      id TEXT PRIMARY KEY,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at BIGINT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE INDEX IF NOT EXISTS call_notifications_to_idx ON call_notifications(to_user_id,read,created_at);
  `);
  const pioneerUsers=await pool.query('SELECT id,created_at,title_awards,currency,task_state FROM users WHERE created_at>0 AND created_at<=$1',[PIONEER_GRANT_CUTOFF]);
  for(const pioneer of pioneerUsers.rows){
    const state=parseJson(pioneer.task_state,{});
    if(!state||typeof state!=='object'||Array.isArray(state))continue;
    const awards=parseJson(pioneer.title_awards,[]);
    const hasPioneer=awards.includes(FOUNDER_TITLE.name);
    if(!hasPioneer){
      awards.push(FOUNDER_TITLE.name);
      state.pioneerGrant=true;
      state.pioneerNoticeShown=false;
      await pool.query('UPDATE users SET title_awards=$1,currency=COALESCE(currency,0)+450,task_state=$2 WHERE id=$3',[JSON.stringify(awards),JSON.stringify(state),pioneer.id]);
    }else if(state.pioneerNoticeShown===undefined){
      state.pioneerNoticeShown=false;
      await pool.query('UPDATE users SET task_state=$1 WHERE id=$2',[JSON.stringify(state),pioneer.id]);
    }
  }
  const titleResetVersion='titles_reset_v1';
  const titleResetMarker=await pool.query('SELECT value FROM system_meta WHERE key=$1',[titleResetVersion]);
  if(!titleResetMarker.rowCount){
    const earnedNames=new Set([...rewardForDays(356).filter(x=>x.type==='title').map(x=>x.name),...taskTitleNames,FOUNDER_TITLE.name]);
    const existingUsers=await pool.query('SELECT id,title_awards,selected_title FROM users');
    for(const u of existingUsers.rows){
      const awards=parseJson(u.title_awards,[]).filter(x=>!earnedNames.has(String(x||'')));
      const selected=earnedNames.has(String(u.selected_title||''))?'':(u.selected_title||'');
      const resetState={nightDates:[],midnightDates:[],batmanDates:[],groups:0,messages:0,photos:0,voices:0,people:[],sweetDreamVisits:0,claimed:{},titles:[],dailyDate:'',dailyTasks:[],dailyProgress:{},pioneerNoticeVersion:2,titleResetNoticeVersion:1};
      await pool.query('UPDATE users SET title_awards=$1,selected_title=$2,task_state=$3,currency=COALESCE(currency,0)+500 WHERE id=$4',[JSON.stringify(awards),selected,JSON.stringify(resetState),u.id]);
    }
    await pool.query('INSERT INTO system_meta(key,value) VALUES($1,$2)',[titleResetVersion,'completed']);
    console.log('Title system reset v1 completed: old earned titles cleared, +500 SP compensation granted.');
  }

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

function taskStateFor(u){const x=parseJson(u.task_state,{});return {nightDates:Array.isArray(x.nightDates)?x.nightDates:[],midnightDates:Array.isArray(x.midnightDates)?x.midnightDates:[],batmanDates:Array.isArray(x.batmanDates)?x.batmanDates:[],groups:Number(x.groups||0),messages:Number(x.messages||0),photos:Number(x.photos||0),voices:Number(x.voices||0),people:Array.isArray(x.people)?x.people:[],sweetDreamVisits:Number(x.sweetDreamVisits||0),claimed:x.claimed&&typeof x.claimed==='object'?x.claimed:{},titles:Array.isArray(x.titles)?x.titles:[],dailyDate:String(x.dailyDate||''),dailyTasks:Array.isArray(x.dailyTasks)?x.dailyTasks:[],dailyProgress:x.dailyProgress&&typeof x.dailyProgress==='object'?x.dailyProgress:{},pioneerNoticeVersion:Number(x.pioneerNoticeVersion||0),titleResetNoticeVersion:Number(x.titleResetNoticeVersion||0)};}
const DAILY_CURRENCY_TASK_POOL=[
 {id:'daily_messages10',name:'Отправить 10 сообщений',event:'message',target:10,reward:20},
 {id:'daily_people3',name:'Написать 3 разным людям',event:'people',target:3,reward:30},
 {id:'daily_photos3',name:'Отправить 3 фотографии',event:'photo',target:3,reward:25},
 {id:'daily_voices2',name:'Отправить 2 голосовых',event:'voice',target:2,reward:25},
 {id:'daily_group1',name:'Создать 1 группу',event:'group',target:1,reward:30},
 {id:'daily_favorite2',name:'Сохранить 2 сообщения в избранное',event:'favorite',target:2,reward:20}
];
function dailyTasksForDate(date){let seed=0;for(const ch of String(date))seed=(seed*31+ch.charCodeAt(0))>>>0;const a=[...DAILY_CURRENCY_TASK_POOL];for(let i=a.length-1;i>0;i--){seed=(seed*1664525+1013904223)>>>0;const j=seed%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a.slice(0,3);}

async function applyActivity(uid,event,localDate,localHour,extra={}){
 const u=await getUser(uid); if(!u)return {newTitles:[],currencyEarned:0};
 const st=taskStateFor(u); const hour=Math.max(0,Math.min(23,Number(localHour)||0)); const date=String(localDate||new Date().toISOString().slice(0,10)); let changed=false; let currencyEarned=0;
 if(st.dailyDate!==date){st.dailyDate=date;st.dailyTasks=dailyTasksForDate(date).map(x=>x.id);st.dailyProgress={};changed=true;}
 if(event==='visit'){
   if(hour===21){st.sweetDreamVisits=Math.min(7,st.sweetDreamVisits+1);changed=true}
   if(!st.claimed['daily_login_'+date]){st.claimed['daily_login_'+date]=true;currencyEarned+=10;changed=true}
   if((hour>=22||hour<5)&&!st.nightDates.includes(date)){st.nightDates.push(date);st.nightDates=st.nightDates.slice(-60);changed=true}
   if(hour<5&&!st.midnightDates.includes(date)){st.midnightDates.push(date);st.midnightDates=st.midnightDates.slice(-60);changed=true}
 }else if(event==='group'){st.groups++;changed=true}
 else if(event==='photo'){st.photos++;changed=true}
 else if(event==='voice'){st.voices++;changed=true}
 else if(event==='message'){st.messages++;changed=true}
 else if(event==='message_time'){changed=true}

 const pioneerNoticeVersion=2;
 const pioneerNotice=(parseJson(u.title_awards,[]).includes(FOUNDER_TITLE.name)&&Number(st.pioneerNoticeVersion||0)<pioneerNoticeVersion);
 if(pioneerNotice){st.pioneerNoticeVersion=pioneerNoticeVersion;st.pioneerNoticeShown=true;changed=true;}
 const newTitles=[]; const addTitle=(key)=>{if(!st.titles.includes(key)){st.titles.push(key);newTitles.push(taskTitleRewards.find(x=>x.key===key));changed=true}};
 // Сначала фиксируем нового собеседника, чтобы достижения за количество людей
 // срабатывали в тот же момент, когда достигнут порог.
 if(extra.peerId&&event==='message'){
   const pid=String(extra.peerId);
   if(pid&&pid!==uid&&!st.people.includes(pid)){st.people.push(pid);st.people=st.people.slice(-200);changed=true;}
 }
 const previousVisitDates=st.claimed._visitDates&&Array.isArray(st.claimed._visitDates)?st.claimed._visitDates:[];
 if(event==='visit'&&!previousVisitDates.includes(date)){previousVisitDates.push(date);st.claimed._visitDates=previousVisitDates.slice(-60);changed=true;}
 let consecutive=0;if(previousVisitDates.length){const ds=[...previousVisitDates].sort().reverse();consecutive=1;for(let i=1;i<ds.length;i++){const a=new Date(ds[i-1]+'T12:00:00'),b=new Date(ds[i]+'T12:00:00');if(Math.round((a-b)/86400000)===1)consecutive++;else break;}}
 if((event==='message'||event==='message_time')&&hour>=3&&hour<4&&!st.batmanDates.includes(date)){st.batmanDates.push(date);st.batmanDates=st.batmanDates.slice(-60);changed=true;}
 if(consecutive>=7)addTitle('unstoppable');
 if(st.sweetDreamVisits>=7)addTitle('sweet_dreams');
 if(st.nightDates.length>=7)addTitle('night_spider');
 if(st.groups>=10)addTitle('big_boss');
 if(st.people.length>=10)addTitle('friendly');
 if(st.midnightDates.length>=10)addTitle('nightnik');
 if(st.batmanDates.length>=5)addTitle('batman');
 if(st.messages>=500)addTitle('living_legend');
 if(st.people.length>=25)addTitle('love');
 if(st.groups>=20&&st.messages>=500)addTitle('emperor');

 // «Коллекционер» считает все полученные достижения/титулы, кроме валютных заданий.
 // В том числе считаются титулы за дни и все task-title achievements.
 const days=Math.max(0,Math.floor((Date.now()-Number(u.created_at||Date.now()))/86400000));
 let awards=parseJson(u.title_awards,[]);
 const unlockedDayTitles=rewardForDays(days).filter(r=>r.type==='title'&&days>=r.days);
 for(const r of unlockedDayTitles){if(!awards.includes(r.name)){awards.push(r.name);newTitles.push(r);changed=true;}}
 const timeAchievements=rewardForDays(days).filter(r=>r.type==='title'&&days>=r.days).length;
 const taskAchievements=st.titles.filter(x=>!['collector'].includes(x)).length;
 const collectorCount=timeAchievements+taskAchievements;
 if(collectorCount>=10)addTitle('collector');

 const reward=(key,condition,amount)=>{if(condition&&!st.claimed[key]){st.claimed[key]=true;currencyEarned+=amount;changed=true}};
 reward('messages25',st.messages>=25,30);
 reward('group1',st.groups>=1,25);
 reward('photos3',st.photos>=3,40);
 reward('voices3',st.voices>=3,40);
 reward('people5',st.people.length>=5,50);
 reward('messages50',st.messages>=50,60);
 reward('groups3',st.groups>=3,50);
 reward('photos10',st.photos>=10,80);
 reward('voices10',st.voices>=10,80);
 reward('people15',st.people.length>=15,100);
 const dailyEvent=event==='message'?'message':event==='photo'?'photo':event==='voice'?'voice':event==='group'?'group':event==='favorite'?'favorite':null;
 if(dailyEvent){for(const taskId of st.dailyTasks){const task=DAILY_CURRENCY_TASK_POOL.find(x=>x.id===taskId);if(!task)continue;let inc=task.event===dailyEvent?1:0;if(task.event==='people'&&event==='message'&&extra.peerId)inc=st.people.includes(String(extra.peerId))?1:0;if(!inc)continue;st.dailyProgress[taskId]=Math.min(task.target,Number(st.dailyProgress[taskId]||0)+inc);changed=true;if(st.dailyProgress[taskId]>=task.target&&!st.claimed['daily_'+date+'_'+taskId]){st.claimed['daily_'+date+'_'+taskId]=true;currencyEarned+=task.reward;}}}
 let currencyBalance=Number(u.currency||0);
 if(currencyEarned){
   const cr=await pool.query('UPDATE users SET currency=COALESCE(currency,0)+$1 WHERE id=$2 RETURNING currency',[currencyEarned,uid]);
   currencyBalance=Number(cr.rows[0]?.currency||0);
   try{io.to(String(uid)).emit('currency:notify',{amount:currencyEarned,balance:currencyBalance})}catch{}
 }else{
   currencyBalance=Number(u.currency||0);
 }
 if(newTitles.length){for(const t of newTitles){if(t&&!awards.includes(t.name))awards.push(t.name)}await pool.query('UPDATE users SET title_awards=$1 WHERE id=$2',[JSON.stringify(awards),uid]);}
 if(changed)await pool.query('UPDATE users SET task_state=$1 WHERE id=$2',[JSON.stringify(st),uid]);
 const titleResetNotice=Number(st.titleResetNoticeVersion||0)===1;
 if(titleResetNotice){st.titleResetNoticeVersion=2;await pool.query('UPDATE users SET task_state=$1 WHERE id=$2',[JSON.stringify(st),uid]);}
 return {newTitles:newTitles.filter(Boolean),currencyEarned,currency:currencyBalance,pioneerNotice,titleResetNotice};
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
  if(!['visit','message','group','photo','voice','message_time'].includes(event))return res.status(400).json({error:'Неизвестное действие'});
  const result=await applyActivity(req.user.id,event,localDate,localHour,{peerId:req.body.peerId||''});
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
 const equipped=parseJson(u.shop_equipped,{});
 if(equipped[item.type]===item.id) delete equipped[item.type];
 else equipped[item.type]=item.id;
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
    const allowed=rewardForDays(days).find(x=>x.type==='title'&&x.name===title);
    const awards=parseJson(u.title_awards,[]);
    const owned=parseJson(u.shop_owned,[]);
    const shopTitle=shopItems.find(x=>x.type==='title'&&x.value===title&&owned.includes(x.id));
    if(!allowed&&!awards.includes(title)&&!shopTitle)return res.status(400).json({error:'Этот титул ещё не открыт'});
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
 const taskTitles=taskTitleRewards.map(r=>{let progress=0,target=1,progressText='';switch(r.key){case'collector':{const days=Math.max(0,Math.floor((Date.now()-Number(u.created_at||Date.now()))/86400000));const timeAchievements=rewardForDays(days).filter(x=>x.type==='title'&&days>=x.days).length;const taskAchievements=st.titles.filter(x=>x!=='collector').length;progress=Math.min(10,timeAchievements+taskAchievements);target=10;break;}case'unstoppable':{const ds=(st.claimed._visitDates&&Array.isArray(st.claimed._visitDates)?st.claimed._visitDates:[]).slice().sort().reverse();progress=ds.length?1:0;for(let i=1;i<ds.length;i++){const a=new Date(ds[i-1]+'T12:00:00'),b=new Date(ds[i]+'T12:00:00');if(Math.round((a-b)/86400000)===1)progress++;else break;}progress=Math.min(7,progress);target=7;break}case'night_spider':progress=Math.min(7,st.nightDates.length);target=7;break;case'big_boss':progress=Math.min(10,st.groups);target=10;break;case'friendly':progress=Math.min(10,st.people.length);target=10;break;case'nightnik':progress=Math.min(10,st.midnightDates.length);target=10;break;case'batman':progress=Math.min(5,st.batmanDates.length);target=5;break;case'living_legend':progress=Math.min(500,st.messages);target=500;break;case'love':progress=Math.min(25,st.people.length);target=25;break;case'emperor':{const g=Math.min(20,st.groups)/20,m=Math.min(500,st.messages)/500;progress=Math.round(Math.min(g,m)*100);target=100;progressText='Группы '+Math.min(10,st.groups)+'/10 · сообщения '+Math.min(100,st.messages)+'/100';break}case'sweet_dreams':{progress=Math.min(7,st.sweetDreamVisits);target=7;break}}return {...r,type:'task',progress,target,progressPercent:target?Math.min(100,Math.round(progress/target*100)):0,progressText,unlocked:st.titles.includes(r.key)}});
 const pioneerAwarded=parseJson(u.title_awards,[]).includes(FOUNDER_TITLE.name);
 if(pioneerAwarded)taskTitles.unshift({...FOUNDER_TITLE,unlocked:true,progress:1,target:1,progressPercent:100,progressText:''});
 const next=rewards.find(r=>!r.unlocked)||null;
 const currencyTasks=[{id:'messages25',name:'Отправить 25 сообщений',reward:30,progress:Math.min(25,st.messages),target:25},{id:'group1',name:'Создать первую группу',reward:25,progress:Math.min(1,st.groups),target:1},{id:'photos3',name:'Отправить 3 фото',reward:40,progress:Math.min(3,st.photos),target:3},{id:'voices3',name:'Отправить 3 голосовых',reward:40,progress:Math.min(3,st.voices),target:3},{id:'people5',name:'Написать 5 разным людям',reward:50,progress:Math.min(5,st.people.length),target:5},{id:'messages50',name:'Отправить 50 сообщений',reward:60,progress:Math.min(50,st.messages),target:50},{id:'groups3',name:'Создать 3 группы',reward:50,progress:Math.min(3,st.groups),target:3},{id:'photos10',name:'Отправить 10 фото',reward:80,progress:Math.min(10,st.photos),target:10},{id:'voices10',name:'Отправить 10 голосовых',reward:80,progress:Math.min(10,st.voices),target:10},{id:'people15',name:'Написать 15 разным людям',reward:100,progress:Math.min(15,st.people.length),target:15}].map(x=>({...x,claimed:!!st.claimed[x.id]})); const dailyTasks=st.dailyTasks.map(id=>DAILY_CURRENCY_TASK_POOL.find(x=>x.id===id)).filter(Boolean).map(x=>({...x,progress:Math.min(x.target,Number(st.dailyProgress[x.id]||0)),claimed:!!st.claimed['daily_'+st.dailyDate+'_'+x.id]})); const shopTitles=shopItems.filter(x=>x.type==='title').map(x=>({key:x.id,name:x.name,type:'shop',start:x.start,end:x.end,animated:!!x.animated,unlocked:parseJson(u.shop_owned,[]).includes(x.id)})); res.json({days,rewards,current:currentReward(days),next,progress:next?Math.min(100,Math.round(days/next.days*100)):100,taskTitles,shopTitles,currencyTasks,dailyTasks,dailyDate:st.dailyDate});
});
function isOwnerAdmin(u){return String(u?.username||'').toLowerCase()==='dobry'}
async function requireOwnerAdmin(req,res){const u=await getUser(req.user.id);if(!isOwnerAdmin(u)){res.status(403).json({error:'Доступ только для @dobry'});return null}return u}
app.get('/api/admin/users',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const q=String(req.query.q||'').trim().toLowerCase();const r=await pool.query("SELECT * FROM users WHERE ($1='' OR username ILIKE '%'||$1||'%' OR name ILIKE '%'||$1||'%') ORDER BY username LIMIT 50",[q]);res.json(r.rows.map(x=>({...publicUser(x),currency:Number(x.currency||0)})))});
app.post('/api/promo/redeem',auth,async(req,res)=>{
 const code=String(req.body.code||'').trim().toUpperCase();
 if(!code)return res.status(400).json({error:'Введите промокод'});
 const c=await pool.query('SELECT * FROM promo_codes WHERE code=$1',[code]);
 if(!c.rowCount)return res.status(404).json({error:'Промокод не найден'});
 const promo=c.rows[0];
 if(Number(promo.max_uses)>0&&Number(promo.uses)>=Number(promo.max_uses))return res.status(400).json({error:'Лимит использований промокода исчерпан'});
 const used=await pool.query('SELECT 1 FROM promo_redemptions WHERE code=$1 AND user_id=$2',[code,req.user.id]);
 if(used.rowCount)return res.status(400).json({error:'Ты уже использовал этот промокод'});
 await pool.query('BEGIN');
 try{
   await pool.query('INSERT INTO promo_redemptions(code,user_id,redeemed_at) VALUES($1,$2,$3)',[code,req.user.id,Date.now()]);
   await pool.query('UPDATE promo_codes SET uses=uses+1 WHERE code=$1',[code]);
   if(Number(promo.reward_sp)>0)await pool.query('UPDATE users SET currency=currency+$1 WHERE id=$2',[Number(promo.reward_sp),req.user.id]);
   if(promo.reward_title){
     const u=await getUser(req.user.id); let awards=parseJson(u.title_awards,[]);
     awards=Array.from(new Set([...awards,promo.reward_title]));
     await pool.query('UPDATE users SET title_awards=$1 WHERE id=$2',[JSON.stringify(awards),req.user.id]);
   }
   await pool.query('COMMIT');
   res.json({ok:true,sp:Number(promo.reward_sp||0),title:promo.reward_title||''});
 }catch(e){await pool.query('ROLLBACK');throw e}
});
app.patch('/api/admin/users/:id/custom-color',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});const enabled=req.body.enabled!==false;const r=await pool.query('UPDATE users SET custom_color_enabled=$1 WHERE id=$2 RETURNING *',[enabled,target.id]);res.json(publicUser(r.rows[0]));});
app.patch('/api/admin/users/:id/currency',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});const amount=Math.floor(Number(req.body.amount));if(!Number.isSafeInteger(amount)||amount<=0||amount>1000000)return res.status(400).json({error:'Введите сумму от 1 до 1 000 000 SP'});const r=await pool.query('UPDATE users SET currency=COALESCE(currency,0)+$1 WHERE id=$2 RETURNING currency',[amount,target.id]);const balance=Number(r.rows[0].currency||0);io.to(target.id).emit('currency:notify',{amount,balance});res.json({ok:true,amount,currency:balance});});
app.patch('/api/admin/users/:id/currency/reset',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});const r=await pool.query('UPDATE users SET currency=0 WHERE id=$1 RETURNING currency',[target.id]);res.json({ok:true,currency:Number(r.rows[0].currency||0)});});
app.patch('/api/admin/users/:id/shop/reset',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});const paidTitleValues=shopItems.filter(x=>x.type==='title').map(x=>x.value);let awards=parseJson(target.title_awards,[]);awards=awards.filter(x=>!paidTitleValues.includes(x));let selected=String(target.selected_title||'');if(paidTitleValues.includes(selected))selected='';await pool.query('UPDATE users SET shop_owned=$1,shop_equipped=$2,title_awards=$3,selected_title=$4 WHERE id=$5',['[]','{}',JSON.stringify(awards),selected,target.id]);io.to(target.id).emit('shop:reset');res.json({ok:true});});

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
app.patch('/api/admin/users/:id/custom-title',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});const title=String(req.body.title||'').trim().slice(0,60);await pool.query('UPDATE users SET selected_title=$1,custom_title=$2 WHERE id=$3',['',title,target.id]);res.json(publicUser(await getUser(target.id)));});
app.patch('/api/admin/users/:id/title',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});const title=String(req.body.title||'').trim().slice(0,50);const selectedTitle=String(req.body.selectedTitle||'').trim().slice(0,60);if(selectedTitle){let awards=[];try{awards=JSON.parse(target.title_awards||'[]')}catch{}awards=Array.from(new Set([...awards,selectedTitle]));await pool.query('UPDATE users SET selected_title=$1,custom_title=$2,title_awards=$3 WHERE id=$4',[selectedTitle,'',JSON.stringify(awards),target.id]);}else{let awards=[];try{awards=JSON.parse(target.title_awards||'[]')}catch{}if(title){awards=Array.from(new Set([...awards,title]));await pool.query('UPDATE users SET selected_title=$1,custom_title=$2,title_awards=$3 WHERE id=$4',[title,'',JSON.stringify(awards),target.id]);}else{await pool.query('UPDATE users SET selected_title=$1,custom_title=$2 WHERE id=$3',['','',target.id]);}}res.json(publicUser(await getUser(target.id)))});
app.delete('/api/admin/users/:id/title',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});let awards=[];try{awards=JSON.parse(target.title_awards||'[]')}catch{}if(target.selected_title)awards=awards.filter(x=>x!==target.selected_title);await pool.query('UPDATE users SET selected_title=$1,custom_title=$2,title_awards=$3 WHERE id=$4',['','',JSON.stringify(awards),target.id]);res.json(publicUser(await getUser(target.id)))});

app.patch('/api/admin/tasks/reset-all',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const users=await pool.query('SELECT id,title_awards,selected_title FROM users');const emptyTaskState=JSON.stringify({nightDates:[],midnightDates:[],groups:0,messages:0,photos:0,voices:0,people:[],claimed:{},titles:[]});for(const u of users.rows){const awards=parseJson(u.title_awards,[]);const keptAwards=Array.from(new Set(awards.filter(x=>!taskTitleNames.includes(String(x||'')))));const selected=taskTitleNames.includes(String(u.selected_title||''))?'':(u.selected_title||'');await pool.query('UPDATE users SET task_state=$1,title_awards=$2,selected_title=$3 WHERE id=$4',[emptyTaskState,JSON.stringify(keptAwards),selected,u.id]);}res.json({ok:true,users:users.rowCount,reset:'tasks-only'});});
app.delete('/api/admin/users/:id/shop-titles',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});const shopTitleIds=shopItems.filter(x=>x.type==='title').map(x=>x.id);const shopTitleNames=shopItems.filter(x=>x.type==='title').map(x=>x.value);let owned=parseJson(target.shop_owned,[]).filter(x=>!shopTitleIds.includes(x));let equipped=parseJson(target.shop_equipped,{});if(equipped.title&&shopTitleIds.includes(equipped.title))delete equipped.title;let awards=parseJson(target.title_awards,[]).filter(x=>!shopTitleNames.includes(x));let selected=target.selected_title||'';if(shopTitleNames.includes(selected))selected='';await pool.query('UPDATE users SET shop_owned=$1,shop_equipped=$2,title_awards=$3,selected_title=$4 WHERE id=$5',[JSON.stringify(owned),JSON.stringify(equipped),JSON.stringify(awards),selected,target.id]);res.json({ok:true,removed:shopTitleNames});});
app.patch('/api/admin/users/:id/titles/all',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});const all=rewardForDays(356).filter(x=>x.type==='title').map(x=>x.name);let awards=[];try{awards=JSON.parse(target.title_awards||'[]')}catch{}awards=Array.from(new Set([...awards,...all]));await pool.query('UPDATE users SET title_awards=$1 WHERE id=$2',[JSON.stringify(awards),target.id]);res.json(publicUser(await getUser(target.id)))});
app.delete('/api/admin/users/:id/titles/all',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});await pool.query('UPDATE users SET selected_title=$1,custom_title=$2,title_awards=$3 WHERE id=$4',['','',JSON.stringify([]),target.id]);res.json(publicUser(await getUser(target.id)))});app.patch('/api/admin/users/:id/check',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const target=await getUser(req.params.id);if(!target)return res.status(404).json({error:'Пользователь не найден'});const enabled=req.body.enabled!==false;await pool.query('UPDATE users SET admin_check=$1 WHERE id=$2',[enabled,target.id]);res.json(publicUser(await getUser(target.id)))});
app.get('/api/admin/promos',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const r=await pool.query('SELECT code,reward_sp,reward_title,max_uses,uses,created_at FROM promo_codes ORDER BY created_at DESC');res.json(r.rows.map(x=>({...x,rewardSp:Number(x.reward_sp),maxUses:Number(x.max_uses),uses:Number(x.uses)})))});
app.post('/api/admin/promos',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;const code=String(req.body.code||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,40);const rewardSp=Math.floor(Number(req.body.rewardSp||0));const rewardTitle=String(req.body.rewardTitle||'').trim().slice(0,60);const maxUses=Math.floor(Number(req.body.maxUses||0));if(!code)return res.status(400).json({error:'Введите код'});if(rewardSp<0||rewardSp>1000000)return res.status(400).json({error:'SP: от 0 до 1 000 000'});if(!rewardSp&&!rewardTitle)return res.status(400).json({error:'Укажите награду'});if(maxUses<0||maxUses>1000000)return res.status(400).json({error:'Лимит: от 0 до 1 000 000'});try{await pool.query('INSERT INTO promo_codes(code,reward_sp,reward_title,max_uses,uses,created_at) VALUES($1,$2,$3,$4,0,$5)',[code,rewardSp,rewardTitle,maxUses,Date.now()]);res.json({ok:true})}catch(e){if(e.code==='23505')return res.status(400).json({error:'Такой промокод уже существует'});throw e}});
app.delete('/api/admin/promos/:code',auth,async(req,res)=>{const admin=await requireOwnerAdmin(req,res);if(!admin)return;await pool.query('DELETE FROM promo_codes WHERE code=$1',[String(req.params.code||'').toUpperCase()]);res.json({ok:true})});
app.get('/api/stats',auth,async(req,res)=>{try{const [u,m,g,o]=await Promise.all([pool.query('SELECT COUNT(*)::int count FROM users'),pool.query('SELECT COUNT(*)::int count FROM messages'),pool.query('SELECT COUNT(*)::int count FROM groups'),pool.query('SELECT COUNT(*)::int count FROM users WHERE online=true')]);res.json({users:u.rows[0].count,messages:m.rows[0].count,groups:g.rows[0].count,online:o.rows[0].count})}catch(e){res.status(500).json({error:'Не удалось загрузить статистику'})}});
app.get('/api/saved-messages',auth,async(req,res)=>{
 const r=await pool.query('SELECT s.*,u.username,u.name,u.avatar FROM saved_messages s JOIN users u ON u.id=s.sender_id WHERE s.user_id=$1 ORDER BY s.saved_at ASC',[req.user.id]);
 res.json(r.rows.map(x=>({id:x.id,originalMessageId:x.original_message_id,text:x.text,type:x.type,mediaUrl:x.media_url,createdAt:Number(x.created_at),savedAt:Number(x.saved_at),sender:{id:x.sender_id,username:x.username,name:x.name,avatar:x.avatar||''}})));
});
app.post('/api/saved-messages/:id',auth,async(req,res)=>{
 const m=await pool.query('SELECT * FROM messages WHERE id=$1 AND ("from"=$2 OR "to"=$2)',[req.params.id,req.user.id]);
 if(!m.rowCount)return res.status(404).json({error:'Сообщение не найдено'});
 const x=m.rows[0], id='saved_'+crypto.randomUUID();
 await pool.query('INSERT INTO saved_messages(id,user_id,original_message_id,sender_id,text,type,media_url,created_at,saved_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id,original_message_id) DO NOTHING',[id,req.user.id,x.id,x.from,x.text||'',x.type||'text',x.media_url||'',x.created_at,Date.now()]);
 res.json({ok:true});
});
app.delete('/api/saved-messages/:id',auth,async(req,res)=>{
 await pool.query('DELETE FROM saved_messages WHERE user_id=$1 AND (id=$2 OR original_message_id=$2)',[req.user.id,req.params.id]);
 res.json({ok:true});
});
app.post('/api/currency/transfer',auth,async(req,res)=>{
  const fromId=req.user.id;
  const toId=String(req.body.userId||'').trim();
  const amount=Math.floor(Number(req.body.amount||0));
  if(!toId)return res.status(400).json({error:'Выберите пользователя'});
  if(String(toId)===String(fromId))return res.status(400).json({error:'Нельзя переводить валюту самому себе'});
  if(!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:'Введите положительное количество SP'});
  if(amount>100000000)return res.status(400).json({error:'Слишком большая сумма'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const sender=(await client.query('SELECT id,currency FROM users WHERE id=$1 FOR UPDATE',[fromId])).rows[0];
    const recipient=(await client.query('SELECT id,username,name FROM users WHERE id=$1 FOR UPDATE',[toId])).rows[0];
    if(!recipient){await client.query('ROLLBACK');return res.status(404).json({error:'Пользователь не найден'});}
    const balance=Number(sender?.currency||0);
    if(balance<amount){await client.query('ROLLBACK');return res.status(400).json({error:'Недостаточно SP'});}
    await client.query('UPDATE users SET currency=COALESCE(currency,0)-$1 WHERE id=$2',[amount,fromId]);
    await client.query('UPDATE users SET currency=COALESCE(currency,0)+$1 WHERE id=$2',[amount,toId]);
    await client.query('COMMIT');
    res.json({ok:true,amount,balance:balance-amount,recipient:{id:recipient.id,username:recipient.username,name:recipient.name}});
  }catch(e){try{await client.query('ROLLBACK')}catch{};res.status(500).json({error:'Не удалось выполнить перевод'});}
  finally{client.release();}
});

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

async function pollForMessage(messageId, pollRaw, viewerId){
 try{
  const p=typeof pollRaw==='string'?JSON.parse(pollRaw):pollRaw;
  if(!p||p.kind!=='poll'||!Array.isArray(p.options)||p.options.length<2)return null;
  const votes=await pool.query('SELECT user_id,option_index FROM poll_votes WHERE message_id=$1',[messageId]);
  const counts=p.options.map(()=>0);
  const mine=[];
  for(const v of votes.rows){
    const oi=Number(v.option_index);
    if(oi>=0&&oi<p.options.length){counts[oi]++;if(v.user_id===viewerId)mine.push(oi);}
  }
  return {...p,counts,voters:votes.rowCount,mine:[...new Set(mine)]};
 }catch{return null}
}
app.get('/api/polls/:id',auth,async(req,res)=>{
 let r=await pool.query('SELECT id,"from",to,text,type,created_at FROM messages WHERE id=$1',[req.params.id]);
 let isGroup=false, groupId='';
 if(!r.rowCount){r=await pool.query('SELECT id,group_id,"from",text,type,created_at FROM group_messages WHERE id=$1',[req.params.id]);isGroup=!!r.rowCount;groupId=r.rows[0]?.group_id||'';}
 if(!r.rowCount||r.rows[0].type!=='poll')return res.status(404).json({error:'Опрос не найден'});
 const m=r.rows[0];
 if(isGroup){const ok=await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[groupId,req.user.id]);if(!ok.rowCount)return res.status(403).json({error:'Нет доступа'});}
 else if(m.from!==req.user.id&&m.to!==req.user.id)return res.status(403).json({error:'Нет доступа'});
 const p=await pollForMessage(m.id,m.text,req.user.id);
 if(!p)return res.status(400).json({error:'Некорректный опрос'});
 res.json(p);
});
app.post('/api/polls/:id/vote',auth,async(req,res)=>{
 let r=await pool.query('SELECT id,"from",to,text,type FROM messages WHERE id=$1',[req.params.id]);
 let isGroup=false,groupId='';
 if(!r.rowCount){r=await pool.query('SELECT id,group_id,"from",text,type FROM group_messages WHERE id=$1',[req.params.id]);isGroup=!!r.rowCount;groupId=r.rows[0]?.group_id||'';}
 if(!r.rowCount||r.rows[0].type!=='poll')return res.status(404).json({error:'Опрос не найден'});
 const m=r.rows[0];
 if(isGroup){const ok=await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[groupId,req.user.id]);if(!ok.rowCount)return res.status(403).json({error:'Нет доступа'});}
 else if(m.from!==req.user.id&&m.to!==req.user.id)return res.status(403).json({error:'Нет доступа'});
 let p;try{p=JSON.parse(m.text)}catch{return res.status(400).json({error:'Некорректный опрос'})}
 if(p.endsAt&&Date.now()>=Number(p.endsAt))return res.status(400).json({error:'Опрос уже завершён'});
 let selected=Array.isArray(req.body.optionIndexes)?req.body.optionIndexes.map(Number):[Number(req.body.optionIndex)];
 selected=[...new Set(selected.filter(x=>Number.isInteger(x)&&x>=0&&x<p.options.length))];
 if(!selected.length)return res.status(400).json({error:'Выбери вариант'});
 if(p.multiple!==true&&selected.length>1)selected=selected.slice(0,1);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('DELETE FROM poll_votes WHERE message_id=$1 AND user_id=$2',[m.id,req.user.id]);
  for(const oi of selected)await client.query('INSERT INTO poll_votes(message_id,user_id,option_index,voted_at) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[m.id,req.user.id,oi,Date.now()]);
  await client.query('COMMIT');
 }catch(err){
  try{await client.query('ROLLBACK')}catch{}
  console.error('Poll vote failed:',err?.message||err);
  return res.status(500).json({error:'Не удалось сохранить голос. Попробуйте ещё раз.'});
 }finally{client.release()}
 res.json(await pollForMessage(m.id,p,req.user.id));
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
  const peerRead=await pool.query('SELECT last_read_at FROM conversation_reads WHERE user_id=$1 AND peer_id=$2',[req.params.uid,req.user.id]);
  const peerLastRead=Number(peerRead.rows[0]?.last_read_at||0);
  const ids=r.rows.map(m=>m.id);
  let rx=[];
  if(ids.length){const q=await pool.query('SELECT message_id,user_id,emoji FROM reactions WHERE message_id=ANY($1)',[ids]);rx=q.rows;}
  const out=[];for(const m of r.rows.reverse()){let media=m.deleted?'':m.media_url;const item={id:m.id,from:m.from,to:m.to,text:m.deleted?'Сообщение удалено':m.text,type:m.deleted?'deleted':m.type,mediaUrl:media,createdAt:Number(m.created_at),edited:!!m.edited,deleted:!!m.deleted,read:m.from===req.user.id&&peerLastRead>=Number(m.created_at),reactions:rx.filter(x=>x.message_id===m.id).map(x=>({userId:x.user_id,emoji:x.emoji}))};if(!m.deleted&&m.type==='poll')item.poll=await pollForMessage(m.id,m.text,req.user.id);out.push(item)}res.json(out);
});

app.post('/api/messages/:uid',auth,async(req,res)=>{
  const to=req.params.uid,type=String(req.body.type||'text'),text=String(req.body.text||'').trim(),mediaUrl=String(req.body.mediaUrl||'');
  if(to===req.user.id)return res.status(400).json({error:'Нельзя отправить сообщение самому себе'});
  if(!await getUser(to))return res.status(404).json({error:'Пользователь не найден'});
  if(type==='text'){if(!text||text.length>4000)return res.status(400).json({error:'Сообщение пустое или длиннее 4000 символов'});}
  else if(type==='image'||type==='video'){const prefix=type==='image'?'data:image/':'data:video/';if(!mediaUrl.startsWith(prefix))return res.status(400).json({error:type==='image'?'Некорректное изображение':'Некорректное видео'});if(mediaUrl.length>16800000)return res.status(413).json({error:(type==='image'?'Фото':'Видео')+' слишком большое. Лимит: 12 МБ'});}
  else if(type==='audio'){if(!mediaUrl.startsWith('data:audio/'))return res.status(400).json({error:'Некорректное аудио'});else if(mediaUrl.length>7000000)return res.status(413).json({error:'Голосовое слишком большое'});}
  else if(type==='poll'){let p;try{p=JSON.parse(text)}catch{return res.status(400).json({error:'Некорректный опрос'})}if(p?.kind!=='poll'||!Array.isArray(p.options)||p.options.length<2||p.options.length>10||p.options.some(x=>String(x).trim().length<1||String(x).length>120))return res.status(400).json({error:'Некорректные варианты опроса'});if(String(p.question||'').trim().length<1||String(p.question).length>240)return res.status(400).json({error:'Некорректный вопрос'});if(p.endsAt&&Number(p.endsAt)<=Date.now())return res.status(400).json({error:'Некорректный срок опроса'});}
  else return res.status(400).json({error:'Неизвестный тип сообщения'});
  await pool.query('DELETE FROM hidden_chats WHERE user_id=$1 AND peer_id=$2',[req.user.id,to]);
  const sender=await getUser(req.user.id);const storedMedia=mediaUrl;const m={id:id(),from:req.user.id,to,text:(type==='text'||type==='poll')?text:'',type,mediaUrl:type==='text'?'':storedMedia,createdAt:Date.now(),edited:false,deleted:false,reactions:[],sender:sender?{id:sender.id,name:sender.name,username:sender.username,avatar:sender.avatar}:null};
  await pool.query('INSERT INTO messages(id,"from","to",text,type,media_url,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[m.id,m.from,m.to,m.text,m.type,m.mediaUrl,m.createdAt]);
  const socketMedia=m.mediaUrl;io.to(to).emit('message',{...m,mediaUrl:socketMedia});m.mediaUrl=socketMedia;
  const local=new Date();const activityEvent=type==='image'?'photo':type==='audio'?'voice':'message';const activityResult=await applyActivity(req.user.id,activityEvent,local.getFullYear()+"-"+String(local.getMonth()+1).padStart(2,"0")+"-"+String(local.getDate()).padStart(2,"0"),local.getHours(),{peerId:to});
  if(m.type==='poll')m.poll=await pollForMessage(m.id,m.text,req.user.id);res.json({...m,...activityResult});
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
 const out=[];for(const m of r.rows.reverse()){let media=m.deleted?'':m.media_url;const item={id:m.id,from:m.from,text:m.deleted?'Сообщение удалено':m.text,type:m.deleted?'deleted':m.type,mediaUrl:media,createdAt:Number(m.created_at),edited:!!m.edited,deleted:!!m.deleted};if(!m.deleted&&m.type==='poll')item.poll=await pollForMessage(m.id,m.text,req.user.id);out.push(item)}res.json(out);
});
app.post('/api/groups/:id/messages',auth,async(req,res)=>{
 const ok=await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[req.params.id,req.user.id]);
 if(!ok.rowCount)return res.status(403).json({error:'Нет доступа'});
 const type=String(req.body.type||'text'),text=String(req.body.text||'').trim(),mediaUrl=String(req.body.mediaUrl||'');
 if(type==='text'&&(!text||text.length>4000))return res.status(400).json({error:'Сообщение пустое или слишком длинное'});
 if(type==='image'||type==='video'){const prefix=type==='image'?'data:image/':'data:video/';if(!mediaUrl.startsWith(prefix))return res.status(400).json({error:type==='image'?'Некорректное изображение':'Некорректное видео'});if(mediaUrl.length>16800000)return res.status(413).json({error:(type==='image'?'Фото':'Видео')+' слишком большое. Лимит: 12 МБ'});}
 if(type==='audio'&&!mediaUrl.startsWith('data:audio/'))return res.status(400).json({error:'Некорректное аудио'});
 if(type==='poll'){let p;try{p=JSON.parse(text)}catch{return res.status(400).json({error:'Некорректный опрос'})}if(p?.kind!=='poll'||!Array.isArray(p.options)||p.options.length<2||p.options.length>10||p.options.some(x=>String(x).trim().length<1||String(x).length>120))return res.status(400).json({error:'Некорректные варианты опроса'});if(String(p.question||'').trim().length<1||String(p.question).length>240)return res.status(400).json({error:'Некорректный вопрос'});if(p.endsAt&&Number(p.endsAt)<=Date.now())return res.status(400).json({error:'Некорректный срок опроса'});}
 const m={id:id(),groupId:req.params.id,from:req.user.id,text:(type==='text'||type==='poll')?text:'',type,mediaUrl:type==='text'?'':mediaUrl,createdAt:Date.now(),edited:false,deleted:false};
 await pool.query('INSERT INTO group_messages(id,group_id,"from",text,type,media_url,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[m.id,m.groupId,m.from,m.text,m.type,m.mediaUrl,m.createdAt]);
 const ms=await pool.query('SELECT user_id FROM group_members WHERE group_id=$1',[m.groupId]);
 for(const x of ms.rows)io.to(x.user_id).emit('group:message',{...m,mediaUrl:m.mediaUrl});if(m.type==='poll')m.poll=await pollForMessage(m.id,m.text,req.user.id);res.json({...m,mediaUrl:m.mediaUrl});
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
 ON CONFLICT(user_id,peer_id) DO UPDATE SET last_read_at=EXCLUDED.last_read_at`,[req.user.id,req.params.uid,now]);
 io.to(req.params.uid).emit('read',{from:req.user.id,readAt:now});
 res.json({ok:true,readAt:now});
});
io.use((socket,next)=>{try{socket.user=jwt.verify(socket.handshake.auth?.token||'',SECRET);next();}catch{next(new Error('Unauthorized'));}});
io.on('connection',async socket=>{
  const u=await getUser(socket.user.id);
  if(!u)return socket.disconnect(true);
  await pool.query('UPDATE users SET online=true,last_seen=NULL WHERE id=$1',[u.id]);
  socket.join(u.id);
  io.emit('presence',{userId:u.id,online:true,lastSeen:null});
  socket.on('call:offer',d=>{
    if(!d?.to||!d?.offer)return;
    io.to(String(d.to)).emit('call:offer',{from:u.id,fromUser:publicUser(u),offer:d.offer});
    sendPushToUser(String(d.to),{
      type:'incoming_call',
      title:'📞 Входящий звонок',
      body:(u.name||u.username||'Пользователь')+' звонит вам',
      from:{id:u.id,name:u.name,username:u.username}
    }).catch(e=>console.warn('Call push failed:',e?.message||e));
  });
  socket.on('call:answer',d=>{if(d?.to&&d?.answer)io.to(String(d.to)).emit('call:answer',{from:u.id,answer:d.answer});});
  socket.on('call:ice',d=>{if(d?.to&&d?.candidate)io.to(String(d.to)).emit('call:ice',{from:u.id,candidate:d.candidate});});
  socket.on('call:end',d=>{if(d?.to)io.to(String(d.to)).emit('call:end',{from:u.id});});

  socket.on('group-call:join',async d=>{
    const groupId=String(d?.groupId||'');
    if(!groupId)return;
    const member=await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[groupId,u.id]);
    if(!member.rowCount)return;
    const room='groupcall:'+groupId;
    const existing=[...io.sockets.adapter.rooms.get(room)||[]]
      .map(sid=>io.sockets.sockets.get(sid)?.user?.id)
      .filter(Boolean)
      .filter(id=>id!==u.id);
    socket.join(room);
    socket.emit('group-call:participants',{groupId,participants:[...new Set(existing)]});
    if(existing.length){
      socket.to(room).emit('group-call:joined',{groupId,userId:u.id,user:publicUser(u)});
    }else{
      const members=await pool.query('SELECT user_id FROM group_members WHERE group_id=$1',[groupId]);
      for(const m of members.rows)if(m.user_id!==u.id)io.to(m.user_id).emit('group-call:started',{groupId,userId:u.id,user:publicUser(u)});
    }
  });
  socket.on('group-call:offer',async d=>{
    const groupId=String(d?.groupId||''),to=String(d?.to||'');
    if(!groupId||!to||!d?.offer)return;
    const member=await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[groupId,u.id]);
    const target=await pool.query('SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',[groupId,to]);
    if(!member.rowCount||!target.rowCount)return;
    io.to(to).emit('group-call:offer',{groupId,from:u.id,offer:d.offer});
  });
  socket.on('group-call:answer',d=>{
    if(d?.to&&d?.answer)io.to(String(d.to)).emit('group-call:answer',{groupId:String(d.groupId||''),from:u.id,answer:d.answer});
  });
  socket.on('group-call:ice',d=>{
    if(d?.to&&d?.candidate)io.to(String(d.to)).emit('group-call:ice',{groupId:String(d.groupId||''),from:u.id,candidate:d.candidate});
  });
  socket.on('group-call:leave',d=>{
    const groupId=String(d?.groupId||'');
    if(groupId){socket.leave('groupcall:'+groupId);socket.to('groupcall:'+groupId).emit('group-call:left',{groupId,userId:u.id});}
  });
  socket.on('typing',d=>{if(d?.to)io.to(d.to).emit('typing',{from:u.id,typing:!!d.typing});});
  socket.on('read',d=>{if(d?.to)io.to(d.to).emit('read',{from:u.id});});
  socket.on('disconnect',async()=>{const seen=Date.now();await pool.query('UPDATE users SET online=false,last_seen=$1 WHERE id=$2',[seen,u.id]).catch(()=>{});io.emit('presence',{userId:u.id,online:false,lastSeen:seen});});
});

app.get('/',(req,res)=>{res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.set('Pragma','no-cache');res.set('Expires','0');res.sendFile(path.join(ROOT,'index.html'));});
app.get('/index.html',(req,res)=>{res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.set('Pragma','no-cache');res.set('Expires','0');res.sendFile(path.join(ROOT,'index.html'));});

app.get('/download',(req,res)=>res.sendFile(path.join(ROOT,'download.html')));
app.get('/downloads/SpiderGram.apk',(req,res)=>res.download(path.join(ROOT,'downloads','SpiderGram.apk'),'SpiderGram.apk',err=>{if(err&&!res.headersSent)res.status(404).send('APK пока не собран. Попробуйте немного позже.');}));

initDb().then(()=>server.listen(PORT,'0.0.0.0',()=>{
  console.log(`SpiderGram server listening on port ${PORT} with PostgreSQL`);
  
}))
.catch(e=>{console.error(e);process.exit(1);});