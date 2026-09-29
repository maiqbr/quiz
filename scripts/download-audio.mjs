import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {join,resolve,sep} from 'node:path';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const {AUDIO_INSTRUMENTS}=runInNewContext(readFileSync(join(root,'content.js'),'utf8')+'\n({AUDIO_INSTRUMENTS})');
const directory=resolve(root,'audio');
if(!directory.startsWith(root+sep))throw new Error('Destino de áudio fora do projeto');
mkdirSync(directory,{recursive:true});
for(const item of AUDIO_INSTRUMENTS){
  const path=join(directory,item.asset+'.ogg');
  let response;
  for(let attempt=0;attempt<4;attempt++){
    response=await fetch('https://commons.wikimedia.org/wiki/Special:Redirect/file/'+encodeURIComponent(item.file),{headers:{'User-Agent':'QuizArena/1.0 (https://quiz.maiq.dev.br; media attribution)'}});
    if(response.ok)break;
    if(response.status!==429||attempt===3)throw new Error(`${item.file}: HTTP ${response.status}`);
    await new Promise(resolve=>setTimeout(resolve,(attempt+1)*2000));
  }
  const type=response.headers.get('content-type')||'';
  if(!/ogg|octet-stream/.test(type))throw new Error(`${item.file}: tipo inesperado ${type}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<1000||bytes.length>10_000_000||bytes.toString('ascii',0,4)!=='OggS')throw new Error(`${item.file}: áudio inválido`);
  writeFileSync(path,bytes);
  console.log(`${item.asset}.ogg: ${bytes.length} bytes`);
}
