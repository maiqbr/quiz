(()=>{
  const el=id=>document.getElementById(id);
  const title=Object.fromEntries(QUIZZES.map(quiz=>[quiz.id,quiz.title]));title.misto='Misto';title.idiomas='Línguas do Mundo';title['audio-instrumentos']='Som dos Instrumentos (antigo)';
  const difficulty={easy:'Fácil',hard:'Difícil'};
  let user=null,runId=null,current=null,hits=0,deadline=0,tick=null,busy=false,profileOffset=0,boardDifficulty='easy';
  const categories=[{id:'misto',title:'Misto',count:QUIZZES.reduce((sum,quiz)=>sum+quiz.getPool('all').length,0)},...QUIZZES.map(quiz=>({id:quiz.id,title:quiz.title,count:quiz.getPool('all').length}))];
  for(const [id,includeCount] of [['rank-category',true],['board-category',false]]){
    const select=el(id);select.replaceChildren();
    categories.forEach(category=>{const option=document.createElement('option');option.value=category.id;option.textContent=includeCount?`${category.title} · ${category.count}`:category.title;select.append(option)});
    select.value=id==='rank-category'?'capitais':'misto';
  }
  function setBoardDifficulty(value){boardDifficulty=value;document.querySelectorAll('[data-board-difficulty]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.boardDifficulty===value)));board()}
  const duration=ms=>`${Math.floor(ms/60000)}m ${String(Math.floor(ms/1000)%60).padStart(2,'0')}s`;
  const date=stamp=>new Date(stamp).toLocaleDateString('pt-BR');
  async function api(path,options={}){
    const response=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...options});
    let data;try{data=await response.json()}catch{throw new Error('Ranking online indisponível neste endereço.')}
    if(!response.ok)throw new Error(data.error||'Falha na requisição');return data;
  }
  function show(id){for(const screen of document.querySelectorAll('.screen'))screen.classList.toggle('active',screen.id===id);window.scrollTo(0,0)}
  function status(message){el('rank-status').textContent=message}
  function gameStatus(message){el('rank-game-status').textContent=message}
  function avatar(target,account){target.replaceChildren();if(account.avatar){const img=document.createElement('img');img.src=account.avatar;img.alt='';img.referrerPolicy='no-referrer';target.append(img)}else target.textContent=(account.name||'?').slice(0,1).toUpperCase()}
  async function board(){
    const rows=el('rank-rows');rows.replaceChildren();
    try{const data=await api(`/api/rankings?quiz=${el('board-category').value}&difficulty=${boardDifficulty}`);
      el('rank-board-count').textContent=`${data.rows.length} jogadores`;
      if(!data.rows.length){const row=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=4;cell.textContent='Seja o primeiro neste ranking.';row.append(cell);rows.append(row)}
      data.rows.forEach((item,index)=>{const row=document.createElement('tr');[index+1,item.name,`${item.hits}/${item.total}`,duration(item.elapsed_ms)].forEach(value=>{const cell=document.createElement('td');cell.textContent=value;row.append(cell)});rows.append(row)})
    }catch(error){const row=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=4;cell.textContent=error.message;row.append(cell);rows.append(row)}
  }
  function renderQuestion(question){
    current=question;deadline=Date.now()+question.secondsLeft*1000;show('ranked');
    el('rank-game').hidden=false;el('rank-finish').hidden=true;el('rank-flow-title').textContent=title[question.category]||'Desafio';
    el('rank-position').textContent=`${question.number} / ${question.total}`;el('rank-hits').textContent=hits;
    el('rank-progress-bar').style.width=`${(question.number-1)/question.total*100}%`;el('rank-prompt').textContent=question.text;
    gameStatus('');const media=el('rank-media');media.replaceChildren();media.hidden=!question.media&&!question.clue;
    if(question.media?.type==='image'){const img=document.createElement('img');img.src=question.media.src;img.alt='Imagem da pergunta';img.referrerPolicy='no-referrer';img.onerror=()=>{media.replaceChildren();media.textContent=question.clue||'Imagem indisponível.'};media.append(img)}
    else if(question.clue)media.textContent=question.clue;
    if(question.media?.source){const source=document.createElement('a');source.href=question.media.source;source.target='_blank';source.rel='noopener noreferrer';source.textContent=question.media.attribution||'Fonte: Wikimedia Commons';media.append(source)}
    const choices=el('rank-options');choices.replaceChildren();choices.hidden=question.difficulty==='hard';el('rank-answer').hidden=question.difficulty!=='hard';
    if(question.difficulty==='easy')question.options.forEach((name,index)=>{const button=document.createElement('button');button.type='button';button.textContent=name;button.addEventListener('click',()=>answer(index));choices.append(button)});
    else{el('rank-input').value='';el('rank-input').disabled=false;el('rank-input').focus()}
    clearInterval(tick);function update(){const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));el('rank-time').textContent=`${left}s`;if(!left&&!busy){clearInterval(tick);answer(question.difficulty==='hard'?'':-1)}}update();tick=setInterval(update,250)
  }
  async function answer(choice){
    if(busy||!current)return;busy=true;clearInterval(tick);el('rank-options').querySelectorAll('button').forEach(button=>button.disabled=true);el('rank-input').disabled=true;
    try{const result=await api('/api/run/answer',{method:'POST',body:JSON.stringify({runId,choice})});hits=result.hits;gameStatus((result.correct?'Resposta correta.':`Resposta: ${result.answer}.`)+(result.explanation?' '+result.explanation:''));
      if(result.finished){current=null;runId=null;el('rank-game').hidden=true;el('rank-finish').hidden=false;el('rank-result').textContent=`${hits} de ${result.total} acertos em ${duration(result.elapsedMs)}.`;await board()}
      else{await new Promise(resolve=>setTimeout(resolve,900));renderQuestion(result.question)}
    }catch(error){gameStatus(error.message);el('rank-input').disabled=false;el('rank-options').querySelectorAll('button').forEach(button=>button.disabled=false);if(/registrada|encerrada/.test(error.message))await resume().catch(()=>{})}
    finally{busy=false}
  }
  async function resume(){const data=await api('/api/run/current');if(data.run){runId=data.run.runId;hits=data.run.hits;renderQuestion(data.run.question);return true}return false}
  async function start(){
    if(!user){location.href='/auth/discord/start';return}if(busy)return;busy=true;status('Preparando desafio...');
    try{const data=await api('/api/run/start',{method:'POST',body:JSON.stringify({quiz:el('rank-category').value,difficulty:el('rank-difficulty').value})});runId=data.runId;hits=data.hits;renderQuestion(data.question);status(data.resumed?'Partida em andamento retomada.':'')}
    catch(error){status(error.message)}finally{busy=false}
  }
  const profileText=(tag,className,value)=>{const element=document.createElement(tag);element.className=className;element.textContent=value;return element};
  function profileIcon(id){const image=document.createElement('img');image.className='profile-theme-icon';image.src=categories.some(category=>category.id===id)&&id!=='misto'?`category-icons/${id}.png`:'icon-192.png';image.alt='';image.loading='lazy';return image}
  function recordCard(target,item){
    const card=profileText('article','profile-record','');
    const top=profileText('div','profile-record-top','');
    const theme=profileText('div','profile-record-theme','');theme.append(profileIcon(item.quiz_id),profileText('strong','',title[item.quiz_id]||item.quiz_id));
    top.append(theme,profileText('span',`profile-difficulty ${item.difficulty}`,difficulty[item.difficulty]||item.difficulty));
    const result=profileText('div','profile-record-result','');
    const score=profileText('div','profile-record-score','');score.append(profileText('strong','',String(item.hits)),profileText('span','',`/ ${item.total} acertos`));
    result.append(score,profileText('span','profile-record-position',`#${item.position} no ranking`));
    const track=profileText('div','profile-record-track','');const fill=document.createElement('span');fill.style.width=`${Math.min(100,Math.max(0,item.hits/item.total*100))}%`;track.append(fill);
    const foot=profileText('div','profile-record-foot','');foot.append(profileText('span','',`Tempo ${duration(item.elapsed_ms)}`),profileText('span','',date(item.finished_at)));
    card.append(top,result,track,foot);target.append(card);
  }
  function historyRow(target,{id,name,mode,hits,total,elapsed,at}){
    const row=profileText('div','profile-entry','');row.append(profileIcon(id));
    const main=profileText('div','profile-entry-main','');main.append(profileText('strong','',name),profileText('span','',mode));
    const result=profileText('div','profile-entry-result','');result.append(profileText('strong','',`${hits}/${total}`),profileText('span','',`${duration(elapsed)} · ${date(at)}`));
    row.append(main,result);target.append(row);
  }
  function emptyProfile(target,message){target.append(profileText('p','profile-empty',message))}
  async function profile(reset=true){
    if(!user){location.href='/auth/discord/start';return}show('profile');
    try{const data=await api(`/api/profile?offset=${reset?0:profileOffset}`);if(reset){el('profile-name').textContent=data.user.name;avatar(el('profile-avatar'),data.user);el('profile-stats').replaceChildren();
        for(const [label,value] of [['Partidas completas',data.summary.completed],['Acertos acumulados',data.summary.hits],['Perguntas respondidas',data.summary.questions]]){const card=profileText('div','profile-stat','');card.append(profileText('strong','',Number(value).toLocaleString('pt-BR')),profileText('span','',label));el('profile-stats').append(card)}
        const records=el('profile-records');records.replaceChildren();if(!data.records.length)emptyProfile(records,'Conclua uma partida ranqueada para começar sua coleção de recordes.');else data.records.forEach(item=>recordCard(records,item));
        el('profile-history').replaceChildren();const local=el('profile-local');local.replaceChildren();let saved=[];try{saved=JSON.parse(localStorage.getItem('quizHistory')||'[]')}catch{}if(!Array.isArray(saved))saved=[];if(!saved.length)emptyProfile(local,'Suas partidas solo e apresentações neste navegador aparecerão aqui.');else saved.forEach(item=>historyRow(local,{id:item.quizId,name:item.quiz,mode:item.mode==='host'?'Apresentação com placar':`Solo · ${item.length==='quick'?'Rápida':'Completa'}`,hits:item.hits,total:item.rounds,elapsed:item.seconds*1000,at:item.at}))}
      if(!data.history.length&&reset)emptyProfile(el('profile-history'),'Sua primeira partida ranqueada aparecerá aqui.');else data.history.forEach(item=>historyRow(el('profile-history'),{id:item.quiz_id,name:title[item.quiz_id]||item.quiz_id,mode:`Ranqueada · ${difficulty[item.difficulty]||item.difficulty}`,hits:item.hits,total:item.total,elapsed:item.elapsed_ms,at:item.finished_at}));
      profileOffset=data.nextOffset;el('profile-more').hidden=data.nextOffset===null;
    }catch(error){el('profile-history').textContent=error.message}
  }
  async function logout(){try{await api('/api/logout',{method:'POST',body:'{}'});location.href='/'}catch(error){status(error.message)}}
  el('rank-begin').addEventListener('click',start);el('rank-answer').addEventListener('submit',event=>{event.preventDefault();answer(el('rank-input').value)});
  el('rank-back').addEventListener('click',()=>{clearInterval(tick);current=null;show('home')});el('rank-restart').addEventListener('click',()=>{show('home');location.hash='ranking'});
  el('board-category').addEventListener('change',board);document.querySelectorAll('[data-board-difficulty]').forEach(button=>button.addEventListener('click',()=>setBoardDifficulty(button.dataset.boardDifficulty)));setBoardDifficulty(boardDifficulty);
  el('header-profile').addEventListener('click',()=>profile());el('profile-back').addEventListener('click',()=>show('home'));
  el('profile-more').addEventListener('click',()=>profile(false));el('rank-logout').addEventListener('click',logout);el('profile-logout').addEventListener('click',logout);
  (async()=>{try{const data=await api('/api/me');user=data.user;if(user){el('header-discord-login').hidden=true;el('header-profile').hidden=false;el('header-name').textContent=user.name;avatar(el('header-avatar'),user);el('rank-connect').hidden=true;el('rank-signed').hidden=false;el('rank-user').textContent=user.name;if(await resume())status('Partida em andamento retomada.')}await board()}catch(error){status(error.message);await board()}})();
})();
