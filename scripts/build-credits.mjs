import {readFileSync,writeFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../content.js',import.meta.url),'utf8');
const {QUIZZES}=runInNewContext(source+'\n({QUIZZES})');
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const categories=['animais','arte','monumentos'];
const licenseLink=media=>{
  if(media.licenseUrl)return media.licenseUrl;
  const match=/^CC (BY(?:-SA)?) ([0-9.]+)$/.exec(media.license);
  return match?`https://creativecommons.org/licenses/${match[1].toLowerCase()}/${match[2]}/`:null;
};
let count=0;
const sections=categories.map(id=>{
  const quiz=QUIZZES.find(item=>item.id===id);
  if(!quiz)throw new Error(`Categoria ausente: ${id}`);
  const items=quiz.getPool('all').sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const rows=items.map(item=>{
    const media=item.media;
    if(media?.status!=='selected'||!media.author||!media.license||!media.fileUrl||!media.file||!media.reviewed)throw new Error(`Crédito incompleto: ${id}/${item.name}`);
    if(!media.fileUrl.startsWith('https://commons.wikimedia.org/wiki/File:'))throw new Error(`Origem inválida: ${id}/${item.name}`);
    count++;
    const license=licenseLink(media);
    const licenseHtml=license?`<a href="${escape(license)}" target="_blank" rel="noopener noreferrer">${escape(media.license)}</a>`:escape(media.license);
    const fileTitle=decodeURIComponent(media.file.replace(/^File:/,'')).replaceAll('_',' ');
    return `<li><strong>${escape(item.name)}</strong><span>${escape(fileTitle)}</span><small>Autoria: ${escape(media.author)} · ${licenseHtml} · <a href="${escape(media.fileUrl)}" target="_blank" rel="noopener noreferrer">Página do arquivo no Wikimedia Commons</a> · Revisado em ${escape(media.reviewed)}</small></li>`;
  }).join('\n');
  return `<section><h2>${escape(quiz.title)} <span>${items.length}</span></h2><ol>${rows}</ol></section>`;
}).join('\n');

const html=`<!DOCTYPE html>
<html lang="pt-BR" data-theme="dark">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Créditos das imagens · QuizArena</title>
<link rel="icon" type="image/png" href="/favicon.png"><link rel="stylesheet" href="/visual.css">
<script>try{document.documentElement.dataset.theme=localStorage.getItem('quizTheme')==='light'?'light':'dark'}catch{}</script>
<style>
html,body{height:auto;min-height:100%;overflow:auto}body{display:block;padding:0 24px 60px;background:var(--bg);color:var(--text)}
.credits-shell{max-width:1080px;margin:auto}.credits-top{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:28px 0;border-bottom:1px solid var(--border)}
.credits-brand{display:flex;align-items:center;gap:12px;color:var(--text);font-weight:900;letter-spacing:.08em;text-decoration:none}.credits-brand img{width:40px;height:40px;object-fit:contain}
.credits-back{padding:10px 16px;border:1px solid var(--border);border-radius:9px;color:var(--gold);font-weight:700;text-decoration:none}.credits-back:hover{border-color:var(--gold)}
.credits-intro{padding:52px 0 32px}.credits-intro small{color:var(--gold);font-weight:800;letter-spacing:.15em}.credits-intro h1{margin:12px 0;font-size:clamp(36px,6vw,62px);line-height:1.05}.credits-intro p{max-width:700px;color:var(--muted);line-height:1.6}
section{margin-top:36px}section h2{display:flex;justify-content:space-between;align-items:center;padding:0 0 16px;border-bottom:1px solid var(--border);font-size:24px}section h2 span{color:var(--gold);font-size:14px}
ol{list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0 0;padding:0}li{display:flex;flex-direction:column;gap:8px;min-width:0;padding:18px;border:1px solid var(--border);border-radius:14px;background:var(--panel)}li strong{font-size:17px}li span{overflow-wrap:anywhere;color:var(--muted);font-size:12px}li small{color:var(--muted);font-size:12px;line-height:1.6}li a{color:var(--gold);text-underline-offset:2px}li a:hover{color:var(--text)}
.credits-footer{margin-top:44px;padding-top:18px;border-top:1px solid var(--border);color:var(--muted);font-size:12px;line-height:1.6}
@media(max-width:700px){body{padding:0 16px 40px}.credits-intro{padding:38px 0 24px}ol{grid-template-columns:1fr}}
</style>
</head>
<body><main class="credits-shell"><header class="credits-top"><a class="credits-brand" href="/"><img src="/favicon.png" alt="">QUIZARENA</a><a class="credits-back" href="/">Voltar ao quiz</a></header>
<div class="credits-intro"><small>TRANSPARÊNCIA DE MÍDIA</small><h1>Créditos das imagens</h1><p>Autoria, licença e página de origem das ${count} imagens usadas nas perguntas de animais, arte e monumentos. Os créditos ficam aqui para que a imagem da pergunta não revele a resposta durante a partida.</p></div>
${sections}
<footer class="credits-footer">Bandeiras fornecidas por <a href="https://flagpedia.net/" target="_blank" rel="noopener noreferrer">Flagpedia / FlagCDN</a>. Mapa baseado em dados de domínio público da <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a>. Consulte também o <a href="https://github.com/maiqbr/quiz/blob/main/NOTICE.md" target="_blank" rel="noopener noreferrer">aviso de mídia</a> do projeto.</footer></main></body></html>`;
writeFileSync(new URL('../creditos.html',import.meta.url),html);
console.log(`${count} créditos de imagens preparados em creditos.html.`);
