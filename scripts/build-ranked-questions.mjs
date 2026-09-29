import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../content.js',import.meta.url),'utf8');
const {CAPITAIS,LINGUAS_FRASES}=runInNewContext(source+'\n({CAPITAIS,LINGUAS_FRASES})');
function make(id,quiz,text,answer,index,names,aliases=[]){
  const others=[];
  for(let step=1;others.length<3;step++){const name=names[(index+step*7)%names.length];if(name!==answer&&!others.includes(name))others.push(name)}
  const options=[...others];options.splice(index%4,0,answer);
  return {id,quiz,text,options,correct:index%4,aliases};
}
const capitals=CAPITAIS.map((item,index)=>make('c:'+item.code,'capitais',`Qual é a capital de ${item.hint}?`,item.name,index,CAPITAIS.map(x=>x.name),item.a||[]));
const languages=LINGUAS_FRASES.map((item,index)=>make('l:'+index,'idiomas',`Qual é o idioma desta frase? ${item.phrase}`,item.name,index,[...new Set(LINGUAS_FRASES.map(x=>x.name))],item.a||[]));
mkdirSync(new URL('../worker/src/',import.meta.url),{recursive:true});
writeFileSync(new URL('../worker/src/questions.mjs',import.meta.url),'// Gerado por scripts/build-ranked-questions.mjs; não editar manualmente.\nexport const QUESTIONS='+JSON.stringify([...capitals,...languages],null,2)+';\n');
console.log(`${capitals.length+languages.length} perguntas de ranking preparadas.`);
