import {readFileSync,writeFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const file=new URL('../content.js',import.meta.url);
const source=readFileSync(file,'utf8');
const {ANIMAIS,ARTE,MONUMENTOS,CURATED_MEDIA}=runInNewContext(source+'\n({ANIMAIS,ARTE,MONUMENTOS,CURATED_MEDIA})');
const keys=[...ANIMAIS,...ARTE,...MONUMENTOS].map(item=>(Array.isArray(item.wiki)?item.wiki:[item.wiki]).join('|'));
const catalog=Object.fromEntries(keys.map(key=>[key,CURATED_MEDIA[key]]));
if(Object.values(catalog).some(value=>!value))throw new Error('Há imagens sem estado de curadoria');
const start='// BEGIN CURATED MEDIA',end='// END CURATED MEDIA';
const startIndex=source.indexOf(start),endIndex=source.indexOf(end,startIndex);
if(startIndex<0||endIndex<0)throw new Error('Marcadores de mídia ausentes');
const block=`// BEGIN CURATED MEDIA — gerado por scripts/curate-media.mjs\nconst CURATED_MEDIA=${JSON.stringify(catalog,null,2)};\nfor(const item of [ANIMAIS,ARTE,MONUMENTOS].flat())item.media=CURATED_MEDIA[(Array.isArray(item.wiki)?item.wiki:[item.wiki]).join("|")];\n// END CURATED MEDIA`;
writeFileSync(file,source.slice(0,startIndex)+block+source.slice(endIndex+end.length));
console.log(`${keys.length} registros de mídia mantidos para os quizzes visuais.`);
