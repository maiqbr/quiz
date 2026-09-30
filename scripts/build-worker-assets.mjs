import {copyFileSync,mkdirSync,rmSync,existsSync,realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,resolve,sep} from 'node:path';
import './build-ranked-questions.mjs';
import './build-credits.mjs';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const target=resolve(root,'worker','public');
if(!target.startsWith(root+sep))throw new Error('Destino de build fora do projeto');
if(existsSync(target)){
  if(!realpathSync(target).startsWith(root+sep))throw new Error('Destino de build aponta para fora do projeto');
  rmSync(target,{recursive:true,force:true});
}
mkdirSync(target,{recursive:true});
for(const name of ['index.html','ranking.html','ranking.js','visual.css','content.js','manifest.json','sw.js','favicon.png','icon-192.png','icon-512.png','icon-maskable-512.png'])copyFileSync(join(root,name),join(target,name));
copyFileSync(join(root,'creditos.html'),join(target,'creditos-data.txt'));
mkdirSync(join(target,'maps'),{recursive:true});copyFileSync(join(root,'maps','world-land.js'),join(target,'maps','world-land.js'));
mkdirSync(join(target,'category-icons'),{recursive:true});
for(const name of ['bandeiras','capitais','lingua-paises','linguas-frases','animais','arte','monumentos','comidas','instrumentos','anime','super-herois','mapa','linha-do-tempo','associacoes','ciencias','historia-geral','conhecimentos-gerais'])copyFileSync(join(root,'category-icons',name+'.png'),join(target,'category-icons',name+'.png'));
console.log('Arquivos públicos preparados em worker/public.');
