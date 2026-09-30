import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';

const source=readFileSync(new URL('../content.js',import.meta.url),'utf8');
const {QUIZZES}=runInNewContext(source+'\n({QUIZZES})');
const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

function make(id,quiz,text,answer,index,names,{aliases=[],media=null,clue=null,explanation=null,source=null,distractors=null}={}){
  const distinct=[...new Set((distractors||names).filter(name=>normalize(name)!==normalize(answer)))];
  if(distinct.length<3)throw new Error(`${quiz}: alternativas insuficientes`);
  const others=[];
  for(let step=0;others.length<3;step++){
    const candidate=distinct[(index*3+step*7)%distinct.length];
    if(!others.some(name=>normalize(name)===normalize(candidate)))others.push(candidate);
    if(step>distinct.length*3)throw new Error(`${quiz}: alternativas ambíguas`);
  }
  const options=[...others];options.splice(index%4,0,answer);
  return {id,quiz,text,options,correct:index%4,aliases,media,clue,explanation,source};
}
const all=[];
for(const quiz of QUIZZES){
  const pool=quiz.getPool('all');
  const names=pool.map(item=>item.name);
  pool.forEach((item,index)=>{
    const key=JSON.stringify({quiz:quiz.id,name:item.name,question:item.question,phrase:item.phrase,country:item.country,code:item.code,wiki:item.wiki,events:item.events,pairs:item.pairs,lat:item.lat,lon:item.lon});
    const id='v2:'+createHash('sha256').update(key).digest('hex').slice(0,20);
    let text=item.question||quiz.question,answer=item.name,options=names,aliases=item.a||[],media=null,clue=null;
    if(['bandeiras','capitais'].includes(quiz.id)){
      media={type:'image',src:`https://flagcdn.com/w320/${item.code}.png`};
    }else if(quiz.id==='linguas-frases')text=`Qual é o idioma desta frase? ${item.phrase}`;
    else if(quiz.kind==='map'){
      text=`Em qual país fica ${item.name}?`;answer=item.country;options=pool.map(entry=>entry.country);aliases=[];
    }else if(quiz.kind==='timeline'){
      text='Qual destes acontecimentos ocorreu primeiro?';answer=item.events[0].label;options=item.events.map(event=>event.label);aliases=[];
    }else if(quiz.kind==='match'){
      const pair=item.pairs[index%item.pairs.length];text=`Qual é a capital de ${pair.country}?`;answer=pair.capital;options=pool.flatMap(entry=>entry.pairs.map(p=>p.capital));aliases=[];
    }else if(['animais','arte','monumentos'].includes(quiz.id)){
      if(item.media?.status!=='selected')throw new Error(`${quiz.id}: item sem imagem no ranking`);
      media={type:'image',src:item.media.src};
    }
    all.push(make(id,quiz.id,text,answer,index,options,{aliases,media,clue,explanation:item.explanation||null,source:item.source||null,distractors:item.distractors||null}));
  });
}
if(all.length!==new Set(all.map(question=>question.id)).size)throw new Error('ID de pergunta ranqueada repetido');
mkdirSync(new URL('../worker/src/',import.meta.url),{recursive:true});
writeFileSync(new URL('../worker/src/questions.mjs',import.meta.url),'// Gerado por scripts/build-ranked-questions.mjs; não editar manualmente.\nexport const QUESTIONS='+JSON.stringify(all,null,2)+';\n');
console.log(`${all.length} perguntas de ranking preparadas em ${QUIZZES.length} categorias.`);
