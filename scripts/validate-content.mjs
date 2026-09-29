import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../content.js',import.meta.url),'utf8');
const {QUIZZES,MAPA_CAPITAIS,HERO_CLUES,TIMELINE_ROUNDS,MATCH_ROUNDS,AUDIO_INSTRUMENTS}=runInNewContext(source+'\n({QUIZZES,MAPA_CAPITAIS,HERO_CLUES,TIMELINE_ROUNDS,MATCH_ROUNDS,AUDIO_INSTRUMENTS})');
const errors=[];
const ids=new Set();
for(const quiz of QUIZZES){
  if(ids.has(quiz.id))errors.push(`ID repetido: ${quiz.id}`);
  ids.add(quiz.id);
  const pool=quiz.getPool('all');
  if(!Array.isArray(pool)||pool.length<4){errors.push(`${quiz.id}: poucas perguntas`);continue;}
  const displayedCount=Number(quiz.tags[0]?.t.match(/^\d+/)?.[0]);
  if(displayedCount!==pool.length)errors.push(`${quiz.id}: cartão diz ${displayedCount}, conjunto tem ${pool.length}`);
  const answers=new Map();
  for(const [index,item] of pool.entries()){
    const label=`${quiz.id}[${index}]`;
    if(!item.name?.trim())errors.push(`${label}: resposta vazia`);
    if(quiz.kind==='map'){
      if(!Number.isFinite(item.lat)||!Number.isFinite(item.lon)||Math.abs(item.lat)>90||Math.abs(item.lon)>180)errors.push(`${label}: coordenada inválida`);
    }else if(!Array.isArray(item.a)||!item.a.length)errors.push(`${label}: sem respostas alternativas`);
    if(['bandeiras','capitais','lingua-paises'].includes(quiz.id)&&!/^[a-z]{2}$/.test(item.code||''))errors.push(`${label}: código de país inválido`);
    if(['animais','arte','monumentos','comidas','instrumentos','anime','super-herois'].includes(quiz.id)){
      const titles=Array.isArray(item.wiki)?item.wiki:[item.wiki];
      if(titles.some(title=>!title||/%[0-9a-f]{2}/i.test(title)))errors.push(`${label}: título wiki ausente ou já codificado`);
      if(!item.media||!/^\d{4}-\d\d-\d\d$/.test(item.media.reviewed||''))errors.push(`${label}: curadoria sem data`);
      if(item.media?.status==='selected'){
        if(!item.media.file?.startsWith('File:')||!item.media.author||!item.media.license||!item.media.fileUrl?.startsWith('https://')||!item.media.src?.startsWith('https://'))errors.push(`${label}: imagem sem arquivo ou crédito completo`);
      }else if(item.media?.status!=='no-free-image')errors.push(`${label}: situação de mídia desconhecida`);
    }
    if(quiz.id==='linguas-frases'&&!item.phrase?.trim())errors.push(`${label}: frase ausente`);
    if(quiz.kind==='audio'&&(!item.fileUrl?.startsWith('https://commons.wikimedia.org/wiki/File:')||!item.src?.startsWith('https://commons.wikimedia.org/wiki/Special:Redirect/file/')||!item.author||!item.license||!item.licenseUrl||!item.reviewed))errors.push(`${label}: áudio sem fonte ou licença`);
    if(quiz.kind==='timeline'&&(item.events.length!==4||item.events.some((event,i)=>i>0&&item.events[i-1].year>=event.year)))errors.push(`${label}: sequência histórica inválida`);
    if(quiz.kind==='match'&&(item.pairs.length!==4||new Set(item.pairs.map(pair=>pair.country)).size!==4||new Set(item.pairs.map(pair=>pair.capital)).size!==4))errors.push(`${label}: pares inválidos`);
    if(quiz.id==='super-herois'&&!HERO_CLUES[item.name])errors.push(`${label}: pista textual ausente`);
    for(const answer of [item.name,...item.a||[]]){
      const key=answer.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      if(answers.has(key)&&answers.get(key)!==item.name)errors.push(`${quiz.id}: resposta ambígua "${answer}" para ${answers.get(key)} e ${item.name}`);
      answers.set(key,item.name);
    }
  }
  console.log(`${quiz.id}: ${pool.length} itens`);
}
if(MAPA_CAPITAIS.length!==new Set(MAPA_CAPITAIS.map(item=>item.name)).size)errors.push('Mapa: capital repetida');
if(TIMELINE_ROUNDS.length!==new Set(TIMELINE_ROUNDS.map(item=>item.events.map(event=>event.year).join(','))).size)errors.push('Linha do tempo: rodada repetida');
if(AUDIO_INSTRUMENTS.length!==new Set(AUDIO_INSTRUMENTS.map(item=>item.file)).size)errors.push('Áudio: arquivo repetido');
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log('Catálogo válido.');
