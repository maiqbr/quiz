import {QUESTIONS} from './questions.mjs';

const BY_ID=new Map(QUESTIONS.map(question=>[question.id,question]));
const CATEGORY_COUNTS=Object.fromEntries([...new Set(QUESTIONS.map(question=>question.quiz))].map(id=>[id,QUESTIONS.filter(question=>question.quiz===id).length]));
CATEGORY_COUNTS.misto=QUESTIONS.length;
const CATEGORY_IDS=Object.keys(CATEGORY_COUNTS);
const VALID_RUNS_SQL=[...Object.entries(CATEGORY_COUNTS),['idiomas',CATEGORY_COUNTS['linguas-frases']]].map(([id,total])=>{if(!/^[a-z-]+$/.test(id))throw new Error('ID de categoria inválido');return `(quiz_id='${id}' AND total=${total})`}).join(' OR ');
const SESSION_MS=7*24*60*60*1000;
const QUESTION_MS=45_000;
const RUN_MS=24*60*60*1000;
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
async function digest(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')}
function cookie(request,name){return (request.headers.get('cookie')||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(name+'='))?.slice(name.length+1)||''}
function setCookie(name,value,age,origin){return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(origin).hostname==='localhost'?'':'; Secure'}`}
function cleanName(value){return String(value||'Jogador').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,40)||'Jogador'}
function originFor(request,env){return env.APP_ORIGIN||new URL(request.url).origin}
function questionView(question,position,total,startedAt,difficulty){return {id:question.id,category:question.quiz,text:question.text,media:question.media,clue:question.clue,options:difficulty==='easy'?question.options:undefined,number:position+1,total,difficulty,secondsLeft:Math.max(0,Math.ceil((QUESTION_MS-(Date.now()-startedAt))/1000))}}
const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function shuffle(list){const array=[...list];for(let i=array.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[array[i],array[j]]=[array[j],array[i]]}return array}
async function userFor(request,env){
  const token=cookie(request,'qa_session');if(!/^[a-f0-9]{64}$/.test(token))return null;
  return env.DB.prepare('SELECT users.id,users.name,users.avatar FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').bind(await digest(token),Date.now()).first();
}
async function readJson(request){try{const text=await request.text();return text.length<=1024?JSON.parse(text):null}catch{return null}}
function invalidOrigin(request){return request.headers.get('origin')!==new URL(request.url).origin}

export default {async fetch(request,env){
  const url=new URL(request.url),path=url.pathname,origin=originFor(request,env);
  if(path==='/index.html'&&request.method==='GET')return Response.redirect(origin+'/'+url.search,308);
  if(!env.DB)return json({error:'Banco indisponível'},503);
  try{
    if(path==='/auth/discord/start'&&request.method==='GET'){
      if(!env.DISCORD_CLIENT_ID||!env.DISCORD_CLIENT_SECRET)return json({error:'Login ainda não configurado'},503);
      const state=randomToken(),authorize=new URL('https://discord.com/oauth2/authorize');
      Object.entries({response_type:'code',client_id:env.DISCORD_CLIENT_ID,scope:'identify',redirect_uri:origin+'/auth/discord/callback',state}).forEach(([key,value])=>authorize.searchParams.set(key,value));
      return new Response(null,{status:302,headers:{Location:authorize.href,'Set-Cookie':setCookie('qa_oauth',state,600,origin),'Cache-Control':'no-store'}});
    }
    if(path==='/auth/discord/callback'&&request.method==='GET'){
      const state=url.searchParams.get('state'),code=url.searchParams.get('code');
      if(!state||!code||state!==cookie(request,'qa_oauth'))return json({error:'Estado do login inválido'},400);
      const body=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:origin+'/auth/discord/callback',client_id:env.DISCORD_CLIENT_ID,client_secret:env.DISCORD_CLIENT_SECRET});
      const tokenResponse=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
      if(!tokenResponse.ok)return json({error:'Falha ao autenticar com Discord'},502);
      const token=await tokenResponse.json();
      const profileResponse=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+token.access_token}});
      if(!profileResponse.ok)return json({error:'Falha ao obter perfil do Discord'},502);
      const profile=await profileResponse.json();
      if(!/^\d+$/.test(profile.id))return json({error:'Perfil inválido'},502);
      const name=cleanName(profile.global_name||profile.username),avatar=profile.avatar&&/^[a-f0-9_]+$/.test(profile.avatar)?`https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=64`:null;
      await env.DB.prepare('INSERT INTO users(id,name,avatar,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,avatar=excluded.avatar,updated_at=excluded.updated_at').bind(profile.id,name,avatar,Date.now()).run();
      const session=randomToken();await env.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await digest(session),profile.id,Date.now()+SESSION_MS).run();
      return new Response(null,{status:302,headers:{Location:origin+'/','Set-Cookie':setCookie('qa_session',session,Math.floor(SESSION_MS/1000),origin),'Cache-Control':'no-store'}});
    }
    if(path==='/api/me'&&request.method==='GET')return json({user:await userFor(request,env)});
    if(path==='/api/run/current'&&request.method==='GET'){
      const user=await userFor(request,env);if(!user)return json({run:null});
      const run=await env.DB.prepare('SELECT * FROM runs WHERE user_id=? AND finished_at IS NULL AND abandoned_at IS NULL AND started_at>? ORDER BY started_at DESC LIMIT 1').bind(user.id,Date.now()-RUN_MS).first();
      if(!run)return json({run:null});
      const ids=JSON.parse(run.question_ids),question=BY_ID.get(ids[run.position]);
      if(!question||ids.some(id=>!BY_ID.has(id))){await env.DB.prepare('UPDATE runs SET abandoned_at=? WHERE id=?').bind(Date.now(),run.id).run();return json({run:null})}
      return json({run:{runId:run.id,quiz:run.quiz_id,difficulty:run.difficulty,hits:run.hits,question:questionView(question,run.position,ids.length,run.question_started_at,run.difficulty)}});
    }
    if(path==='/api/rankings'&&request.method==='GET'){
      const quiz=CATEGORY_IDS.includes(url.searchParams.get('quiz'))?url.searchParams.get('quiz'):'misto',difficulty=url.searchParams.get('difficulty')==='hard'?'hard':'easy';
      const {results}=await env.DB.prepare("WITH best AS (SELECT runs.*,ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY hits DESC,elapsed_ms ASC) AS row_num FROM runs WHERE (quiz_id=? OR (quiz_id='idiomas' AND ?='linguas-frases')) AND difficulty=? AND total=? AND finished_at IS NOT NULL) SELECT users.name,best.hits,best.total,best.elapsed_ms,best.finished_at FROM best JOIN users ON users.id=best.user_id WHERE row_num=1 ORDER BY best.hits DESC,best.elapsed_ms ASC LIMIT 50").bind(quiz,quiz,difficulty,CATEGORY_COUNTS[quiz]).all();
      return json({quiz,difficulty,total:CATEGORY_COUNTS[quiz],rows:results});
    }
    if(path.startsWith('/api/')&&request.method==='POST'&&invalidOrigin(request))return json({error:'Origem inválida'},403);
    if(path==='/api/logout'&&request.method==='POST'){
      const token=cookie(request,'qa_session');if(/^[a-f0-9]{64}$/.test(token))await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
      return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Set-Cookie':setCookie('qa_session','',0,origin),'Cache-Control':'no-store'}});
    }
    if(path==='/api/run/start'&&request.method==='POST'){
      const user=await userFor(request,env);if(!user)return json({error:'Entre com Discord para jogar no ranking'},401);
      const body=await readJson(request),quiz=body?.quiz,difficulty=body?.difficulty;
      if(!CATEGORY_IDS.includes(quiz)||!['easy','hard'].includes(difficulty))return json({error:'Categoria ou dificuldade inválida'},400);
      await env.DB.prepare('UPDATE runs SET abandoned_at=? WHERE user_id=? AND finished_at IS NULL AND abandoned_at IS NULL AND started_at<?').bind(Date.now(),user.id,Date.now()-RUN_MS).run();
      const active=await env.DB.prepare('SELECT * FROM runs WHERE user_id=? AND finished_at IS NULL AND abandoned_at IS NULL ORDER BY started_at DESC LIMIT 1').bind(user.id).first();
      if(active){const ids=JSON.parse(active.question_ids),question=BY_ID.get(ids[active.position]);if(question&&ids.every(id=>BY_ID.has(id)))return json({runId:active.id,question:questionView(question,active.position,ids.length,active.question_started_at,active.difficulty),hits:active.hits,resumed:true});await env.DB.prepare('UPDATE runs SET abandoned_at=? WHERE id=?').bind(Date.now(),active.id).run()}
      const recent=await env.DB.prepare('SELECT COUNT(*) AS count,MAX(started_at) AS latest FROM runs WHERE user_id=? AND started_at>?').bind(user.id,Date.now()-86_400_000).first();
      if(recent.count>=20||recent.latest>Date.now()-60_000)return json({error:'Aguarde antes de iniciar outra partida'},429);
      const pool=QUESTIONS.filter(question=>quiz==='misto'||question.quiz===quiz),selected=shuffle(pool),id=crypto.randomUUID(),now=Date.now();
      if(!selected.length)return json({error:'Tema sem perguntas'},400);
      await env.DB.prepare('INSERT INTO runs(id,user_id,quiz_id,difficulty,total,question_ids,started_at,question_started_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,user.id,quiz,difficulty,selected.length,JSON.stringify(selected.map(question=>question.id)),now,now).run();
      return json({runId:id,question:questionView(selected[0],0,selected.length,now,difficulty),hits:0});
    }
    if(path==='/api/run/answer'&&request.method==='POST'){
      const user=await userFor(request,env);if(!user)return json({error:'Sessão expirada'},401);
      const body=await readJson(request);
      if(!body||!/^[-a-f0-9]{36}$/.test(body.runId||''))return json({error:'Resposta inválida'},400);
      const run=await env.DB.prepare('SELECT * FROM runs WHERE id=? AND user_id=?').bind(body.runId,user.id).first();
      if(!run||run.finished_at!==null||run.abandoned_at!==null||run.started_at<Date.now()-RUN_MS)return json({error:'Partida encerrada ou inexistente'},404);
      const ids=JSON.parse(run.question_ids);if(run.position>=ids.length)return json({error:'Partida encerrada'},404);
      const question=BY_ID.get(ids[run.position]);if(!question||ids.some(id=>!BY_ID.has(id))){await env.DB.prepare('UPDATE runs SET abandoned_at=? WHERE id=?').bind(Date.now(),run.id).run();return json({error:'O catálogo mudou. Comece uma nova partida.'},410)}
      if(run.difficulty==='easy'&&(!Number.isInteger(body.choice)||body.choice< -1||body.choice>3)||run.difficulty==='hard'&&(typeof body.choice!=='string'||body.choice.length>120))return json({error:'Resposta inválida'},400);
      const now=Date.now(),elapsed=Math.max(0,now-run.question_started_at),correct=elapsed<=QUESTION_MS&&(run.difficulty==='easy'?body.choice===question.correct:[question.options[question.correct],...(question.aliases||[])].some(answer=>normalize(answer)===normalize(body.choice)))?1:0,nextPosition=run.position+1,finished=nextPosition===ids.length;
      const update=await env.DB.prepare('UPDATE runs SET position=?,hits=hits+?,question_started_at=?,finished_at=?,elapsed_ms=? WHERE id=? AND position=? AND finished_at IS NULL').bind(nextPosition,correct,now,finished?now:null,finished?now-run.started_at:null,run.id,run.position).run();
      if(update.meta.changes!==1)return json({error:'Resposta já registrada'},409);
      await env.DB.prepare('INSERT INTO run_answers(run_id,position,question_id,chosen,correct,elapsed_ms) VALUES(?,?,?,?,?,?)').bind(run.id,run.position,question.id,String(run.difficulty==='easy'?(question.options[body.choice]||''):body.choice).slice(0,120),correct,elapsed).run();
      return json({correct:Boolean(correct),answer:question.options[question.correct],explanation:question.explanation,source:question.source,hits:run.hits+correct,finished,total:ids.length,elapsedMs:finished?now-run.started_at:null,question:finished?null:questionView(BY_ID.get(ids[nextPosition]),nextPosition,ids.length,now,run.difficulty)});
    }
    if(path==='/api/history'&&request.method==='GET'){
      const user=await userFor(request,env);if(!user)return json({error:'Entre com Discord'},401);
      const {results}=await env.DB.prepare('SELECT quiz_id,difficulty,hits,total,elapsed_ms,finished_at FROM runs WHERE user_id=? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 20').bind(user.id).all();
      return json({runs:results});
    }
    if(path==='/api/profile'&&request.method==='GET'){
      const user=await userFor(request,env);if(!user)return json({error:'Entre com Discord'},401);
      const offset=Math.min(1_000_000,Math.max(0,Number.parseInt(url.searchParams.get('offset')||'0',10)||0));
      const summary=await env.DB.prepare('SELECT COUNT(*) AS completed,COALESCE(SUM(hits),0) AS hits,COALESCE(SUM(total),0) AS questions FROM runs WHERE user_id=? AND finished_at IS NOT NULL').bind(user.id).first();
      const {results:records}=await env.DB.prepare(`WITH eligible AS (SELECT user_id,CASE WHEN quiz_id='idiomas' THEN 'linguas-frases' ELSE quiz_id END AS quiz_id,difficulty,hits,total,elapsed_ms,finished_at FROM runs WHERE finished_at IS NOT NULL AND (${VALID_RUNS_SQL})), best AS (SELECT *,ROW_NUMBER() OVER (PARTITION BY user_id,quiz_id,difficulty ORDER BY hits DESC,elapsed_ms ASC,finished_at ASC) AS own_order FROM eligible), ranked AS (SELECT *,ROW_NUMBER() OVER (PARTITION BY quiz_id,difficulty ORDER BY hits DESC,elapsed_ms ASC,finished_at ASC) AS position FROM best WHERE own_order=1) SELECT quiz_id,difficulty,hits,total,elapsed_ms,finished_at,position FROM ranked WHERE user_id=? ORDER BY quiz_id,difficulty`).bind(user.id).all();
      const {results:history}=await env.DB.prepare('SELECT quiz_id,difficulty,hits,total,elapsed_ms,finished_at FROM runs WHERE user_id=? AND finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 21 OFFSET ?').bind(user.id,offset).all();
      return json({user,summary,records,history:history.slice(0,20),nextOffset:history.length>20?offset+20:null});
    }
    if(path.startsWith('/api/')||path.startsWith('/auth/'))return json({error:'Rota não encontrada'},404);
    return env.ASSETS.fetch(request);
  }catch(error){console.error('QuizArena Worker:',error);return json({error:'Não foi possível concluir a operação'},500)}
}};
