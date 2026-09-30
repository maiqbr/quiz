import {QUESTIONS} from '../worker/src/questions.mjs';

const urls=[...new Set(QUESTIONS.filter(question=>question.media?.type==='image').map(question=>question.media.src))];
const results=[];
let cursor=0;
async function worker(){
  while(cursor<urls.length){
    const url=urls[cursor++];
    let status;
    for(let attempt=0;attempt<3;attempt++){
      try{
        const response=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(12000)});
        status=response.status;
      }catch(error){status=error.message;}
      if(status!==429)break;
      await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));
    }
    results.push({url,status});
  }
}
await Promise.all(Array.from({length:4},worker));
const failed=results.filter(result=>result.status!==200);
console.log(`${results.length} URLs únicas verificadas; ${failed.length} falhas.`);
for(const result of failed)console.log(`${result.status} ${result.url}`);
if(failed.length)process.exitCode=1;
