import {readFileSync,writeFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const path=new URL('../content.js',import.meta.url);
let source=readFileSync(path,'utf8');
const names=['ANIMAIS','ARTE','MONUMENTOS'];
const pools=runInNewContext(source+'\n({'+names.join(',')+'})');
const entries=Object.values(pools).flat();
const candidates=[...new Set(entries.flatMap(item=>Array.isArray(item.wiki)?item.wiki:[item.wiki]))];
const reviewed=new Date().toISOString().slice(0,10);
const headers={'Api-User-Agent':'QuizArena/3.0 (curadoria editorial; https://quiz.maiq.dev.br)'};

async function query(params){
  const url=new URL('https://en.wikipedia.org/w/api.php');
  Object.entries({action:'query',format:'json',formatversion:'2',maxlag:'5',...params}).forEach(([key,value])=>url.searchParams.set(key,value));
  for(let attempt=0;attempt<8;attempt++){
    try{
      const response=await fetch(url,{headers});
      if(response.status===429||response.status===503){
        const wait=Number(response.headers.get('retry-after'));
        await new Promise(resolve=>setTimeout(resolve,Math.min(60000,Math.max(5000,Number.isFinite(wait)?wait*1000:0))));
        continue;
      }
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const body=await response.json();
      if(body.error)throw new Error(body.error.info);
      return body.query;
    }catch(error){
      if(attempt===7)throw error;
      await new Promise(resolve=>setTimeout(resolve,5000*(attempt+1)));
    }
  }
  throw new Error('API indisponível após várias tentativas');
}
function batches(list,size){const result=[];for(let i=0;i<list.length;i+=size)result.push(list.slice(i,i+size));return result;}
function plain(value){
  return String(value?.value||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&#039;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
}
function validUrl(value,stripQuery=false){try{const url=new URL(value);if(stripQuery)url.search='';return url.protocol==='https:'?url.href:null}catch{return null}}
function stableImageUrl(value){
  const src=validUrl(value,true);
  if(!src)return null;
  const url=new URL(src);
  if(url.hostname!=='upload.wikimedia.org')return src;
  const path=url.pathname.split('/wikipedia/commons/')[1];
  if(!path)return src;
  return 'https://thumb.wikimedia.org/wikipedia/commons/thumb/'+(path.startsWith('thumb/')?path.slice(6):path+'/960px-'+path.split('/').at(-1));
}
function licenseOkay(value){return /^(CC\s*BY(?:-SA)?(?:\s|$)|CC0\b|Public domain\b|PD(?:[-\s]|$))/i.test(value)}

const pageByTitle=new Map();
for(const group of batches(candidates,40)){
  const result=await query({prop:'pageimages',piprop:'thumbnail|name',pithumbsize:'600',pilicense:'free',titles:group.join('|'),redirects:'1'});
  const aliases=new Map();
  for(const entry of [...result.normalized||[],...result.redirects||[]])aliases.set(entry.from.replaceAll('_',' '),entry.to.replaceAll('_',' '));
  const pages=new Map((result.pages||[]).map(page=>[page.title,page]));
  for(const title of group){let key=title.replaceAll('_',' ');for(let i=0;i<4&&aliases.has(key);i++)key=aliases.get(key);pageByTitle.set(title,pages.get(key)||null);}
  await new Promise(resolve=>setTimeout(resolve,1700));
}
const fileNames=[...new Set([...pageByTitle.values()].filter(page=>page?.pageimage&&page?.thumbnail?.source).map(page=>'File:'+page.pageimage))];
const fileByTitle=new Map();
for(const group of batches(fileNames,40)){
  const result=await query({prop:'imageinfo',iiprop:'url|user|extmetadata|timestamp|sha1',iiextmetadatafilter:'Artist|Credit|LicenseShortName|LicenseUrl|AttributionRequired',titles:group.join('|'),redirects:'1'});
  const aliases=new Map();
  for(const entry of [...result.normalized||[],...result.redirects||[]])aliases.set(entry.from.replaceAll('_',' '),entry.to.replaceAll('_',' '));
  const pages=new Map((result.pages||[]).map(page=>[page.title,page]));
  for(const title of group){let key=title.replaceAll('_',' ');for(let i=0;i<4&&aliases.has(key);i++)key=aliases.get(key);fileByTitle.set(title,pages.get(key)?.imageinfo?.[0]||null);}
  await new Promise(resolve=>setTimeout(resolve,1700));
}

function select(item){
  for(const title of Array.isArray(item.wiki)?item.wiki:[item.wiki]){
    const page=pageByTitle.get(title),info=fileByTitle.get('File:'+page?.pageimage);
    if(!page?.thumbnail?.source||!info)continue;
    const ext=info.extmetadata||{},license=plain(ext.LicenseShortName),author=plain(ext.Artist)||plain(ext.Credit);
    const src=stableImageUrl(page.thumbnail.source),fileUrl=validUrl(info.descriptionurl),licenseUrl=validUrl(ext.LicenseUrl?.value);
    if(!licenseOkay(license)||!src||!new URL(src).hostname.endsWith('wikimedia.org')||!fileUrl||(!author&&!/^(CC0|Public domain|PD)/i.test(license)))continue;
    return {file:'File:'+page.pageimage,src,author:author||'Domínio público',license,licenseUrl,fileUrl,reviewed,fileVersion:info.timestamp||null,sha1:info.sha1||null,status:'selected'};
  }
  return {reviewed,status:'no-free-image'};
}
const catalog={};
for(const item of entries){
  const key=(Array.isArray(item.wiki)?item.wiki:[item.wiki]).join('|');
  catalog[key]=select(item);
}
const start='// BEGIN CURATED MEDIA — gerado por scripts/curate-media.mjs';
const end='// END CURATED MEDIA';
const block=start+'\nconst CURATED_MEDIA='+JSON.stringify(catalog,null,2)+';\n'+
  'for(const item of [ANIMAIS,ARTE,MONUMENTOS].flat())item.media=CURATED_MEDIA[(Array.isArray(item.wiki)?item.wiki:[item.wiki]).join("|")];\n'+end;
const startIndex=source.indexOf(start),endIndex=source.indexOf(end);
if(startIndex>=0&&endIndex>startIndex)source=source.slice(0,startIndex)+source.slice(endIndex+end.length);
const marker=/\/\* ═+\r?\n   QUIZ DEFINITIONS/;
if(!marker.test(source))throw new Error('Marcador do catálogo não encontrado');
source=source.replace(marker,match=>block+'\n\n'+match);
writeFileSync(path,source);
console.log(`${entries.length} itens revisados; ${Object.values(catalog).filter(item=>item.status==='selected').length} imagens fixadas; ${Object.values(catalog).filter(item=>item.status!=='selected').length} pistas textuais.`);
