// Quiz Maker: rule-based question generator for the teacher dashboard.
(function(){
const STOP=new Set("a an the and or but if then else of to in on at by for with from as is are was were be been being this that these those it its they them their he she his her we our you your i not no yes can could should would may might will shall do does did have has had which who whom whose what when where why how also than such into over under between about after before during more most other some any each both either many much very there here only just so up out all one two".split(" "));
const rnd=a=>a[Math.floor(Math.random()*a.length)];
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function sentences(t){
 t=t.replace(/\s+/g,' ').replace(/\b(e\.g|i\.e|etc|fig|vs|Dr|Mr|Mrs|Prof)\./gi,'$1');
 const seen=new Set();
 return t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/).map(s=>s.trim()).filter(s=>{
  const w=s.split(' ').length;if(s.length<45||s.length>260||w<7||w>40)return false;
  if(/https?:|www\.|@|©/.test(s))return false;if((s.match(/\d/g)||[]).length>s.length*.25)return false;
  if(!/[a-z]/.test(s)||!/[.!?]$/.test(s))return false;const k=s.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});}
function tokens(s){const r=[],re=/[A-Za-z][A-Za-z\-']*[A-Za-z]|[A-Za-z]|\d+(?:[.,]\d+)?%?/g;let m;
 while((m=re.exec(s)))r.push({w:m[0],i:m.index,l:m[0].toLowerCase()});return r;}
function kind(tk,first){return /^\d/.test(tk.w)?'num':(/^[A-Z]/.test(tk.w)&&!first)?'cap':'low';}
function build(text,n){
 const S=sentences(text);if(!S.length)return[];
 const freq={};S.forEach(s=>tokens(s).forEach(t=>freq[t.l]=(freq[t.l]||0)+1));
 const pool={num:{},cap:{},low:{}};const info=[];
 S.forEach((s,si)=>{const tk=tokens(s);let best=null;
  tk.forEach((t,ti)=>{const k=kind(t,ti===0);if(STOP.has(t.l))return;
   if(k==='low'&&t.l.length<5)return;if(k==='cap'&&t.l.length<3)return;
   const pk=k==='low'?t.l:t.w;pool[k][pk]=(pool[k][pk]||0)+1;
   const f=freq[t.l];const sc=(f>=2&&f<=12?2:1)*Math.min(t.l.length,12)+(k==='num'?4:0)+(k==='cap'?3:0)+Math.random()*3;
   if(ti>0&&ti<tk.length-1||k==='num'){if(!best||sc>best.sc)best={t,k,sc};}});
  if(best)info.push({s,si,best});});
 const defs=[];S.forEach(s=>{const m=s.match(/^([A-Z][\w\- ]{2,40}?) (?:is|are|refers to|means|is defined as) (?:the |a |an )?(.{25,200}?)[.]$/);
  if(m&&m[1].trim().split(' ').length<=3&&!m[1].trim().split(' ').some(x=>STOP.has(x.toLowerCase()))&&!/^(This|That|It|There|These|Those|He|She|They|We|You)\b/.test(m[1]))defs.push({term:m[1].trim(),def:m[2].trim(),s});});
 const defTerms=[...new Set(defs.map(d=>d.term))];
 const used=new Set(),out=[];
 function opts(ans,k,ctx){const a=ans.toLowerCase(),c=ctx.toLowerCase();
  let c1=Object.keys(pool[k]).filter(w=>w.toLowerCase()!==a&&!c.includes(w.toLowerCase()));
  if(c1.length<3&&k!=='low')c1=c1.concat(Object.keys(pool.low).filter(w=>w.toLowerCase()!==a&&!c.includes(w.toLowerCase())));
  if(c1.length<3)return null;
  const suf=x=>(x.toLowerCase().match(/(ing|ed|tion|sion|ment|ly|ity|s)$/)||[''])[0];
  const d=c1.map(w=>({w,sc:Math.abs(w.length-ans.length)+(suf(w)!==suf(ans)?4:0)+Math.random()*3})).sort((x,y)=>x.sc-y.sc).slice(0,8).map(x=>x.w);
  const pick=shuffle(d).slice(0,3);const cap=k==='cap'||/^[A-Z]/.test(ans);
  return pick.map(w=>cap?w[0].toUpperCase()+w.slice(1):w);}
 function finish(text,ans,wrong){const all=shuffle([ans].concat(wrong));return{text,opts:all,correct:'ABCD'[all.indexOf(ans)],image:null};}
 // slots spread evenly over the notes
 const total=Math.min(n,info.length+defs.length);
 const order=shuffle(info.map((x,i)=>i)).slice(0,info.length);
 const slotPick=[];for(let q=0;q<info.length&&slotPick.length<info.length;q++)slotPick.push(q);
 const buckets=Math.max(1,total);const chosen=[];
 for(let b=0;b<buckets;b++){const lo=Math.floor(b*info.length/buckets),hi=Math.max(lo+1,Math.floor((b+1)*info.length/buckets));
  chosen.push(lo+Math.floor(Math.random()*(hi-lo)));}
 let useDef=shuffle(defs.slice());
 for(const idx of chosen){if(out.length>=n)break;const it=info[idx];if(!it||used.has(it.s))continue;
  if(useDef.length&&defTerms.length>=4&&Math.random()<.35){const d=useDef.pop();if(!used.has(d.s)){
    const w=shuffle(defTerms.filter(t=>t!==d.term)).slice(0,3);if(w.length===3){used.add(d.s);out.push(finish('Which term is described as: “'+d.def+'”?',d.term,w));continue;}}}
  const w=opts(it.best.t.w,it.best.k,it.s);if(!w)continue;used.add(it.s);
  const q=it.s.slice(0,it.best.t.i)+'_____'+it.s.slice(it.best.t.i+it.best.t.w.length);
  out.push(finish('Fill in the blank: '+q,it.best.t.w,w));}
 // top up if some slots failed
 for(const it of shuffle(info)){if(out.length>=n)break;if(used.has(it.s))continue;const w=opts(it.best.t.w,it.best.k,it.s);if(!w)continue;used.add(it.s);
  out.push(finish('Fill in the blank: '+it.s.slice(0,it.best.t.i)+'_____'+it.s.slice(it.best.t.i+it.best.t.w.length),it.best.t.w,w));}
 return out.slice(0,n);}


window.qmBuild=build;})();

/* ---------- Teacher dashboard: Quiz Maker tab ---------- */
var QM={text:'',qs:[],srcName:''};
var QM_ENGINE=window.qmBuild; // swap point: replace with any function(text,n)->[{text,opts[4],correct,image:null}]
function qmLoadScript(src){return new Promise(function(res,rej){var t=document.createElement('script');t.src=src;t.onload=res;t.onerror=function(){rej(new Error('load '+src));};document.head.appendChild(t);});}
function qmLoadPdfJs(){
  if(window.pdfjsLib)return Promise.resolve();
  return new Promise(function(res,rej){var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=function(){pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';res();};
    s.onerror=function(){rej(new Error('Could not load the PDF reader. Check your internet connection.'));};document.head.appendChild(s);});
}
function qmPdfText(buf){
  return qmLoadPdfJs().then(function(){return pdfjsLib.getDocument({data:buf}).promise;}).then(function(pdf){
    var p=Promise.resolve(''),i;
    for(i=1;i<=pdf.numPages;i++)(function(n){p=p.then(function(acc){return pdf.getPage(n).then(function(pg){return pg.getTextContent();}).then(function(c){return acc+c.items.map(function(x){return x.str;}).join(' ')+'\n';});});})(i);
    return p;});
}
function qmMsg(t,c){var m=Q('qm-msg');m.textContent=t;m.style.color=c==='err'?'var(--danger)':c==='ok'?'var(--success)':'var(--text3)';}
function qmOpen(){
  loadNotes().then(function(){
    var pdfs=_notes.filter(function(n){return /\.pdf$/i.test(n.name);}).sort(function(a,b){return nfCmp(a.name,b.name);});
    Q('qm-note').innerHTML='<option value="">— Choose an uploaded PDF note —</option>'+pdfs.map(function(n){return '<option value="'+nfa(n.id)+'">'+esc((n.folder?n.folder+' / ':'')+n.name)+'</option>';}).join('');
  }).catch(function(){});
}
function qmPickNote(){
  var id=Q('qm-note').value;if(!id)return;var n=_notes.find(function(x){return x.id===id;});if(!n)return;
  qmMsg('Reading '+n.name+'...');
  fetch(n.data).then(function(r){return r.arrayBuffer();}).then(qmPdfText).then(function(t){qmSet(t,n.name);}).catch(function(e){qmMsg('Could not read that note: '+e.message,'err');});
}
function qmPickFile(ev){
  var f=ev.target.files[0];if(!f)return;qmMsg('Reading '+f.name+'...');
  f.arrayBuffer().then(qmPdfText).then(function(t){qmSet(t,f.name);}).catch(function(e){qmMsg('Could not read that PDF: '+e.message,'err');});
}
function qmSet(t,name){
  QM.text=t.trim();QM.srcName=name;
  if(QM.text.length<200){qmMsg('Very little text found (scanned PDF?). Paste the text below instead.','err');return;}
  if(!Q('qm-name').value)Q('qm-name').value=name.replace(/\.pdf$/i,'');qmMsg('Ready: '+name,'ok');
}
function qmGenerate(){
  var src=(Q('qm-paste').value.trim()||QM.text),name=Q('qm-name').value.trim(),n=Math.max(1,Math.min(100,parseInt(Q('qm-count').value)||0)),
      max=parseInt(Q('qm-max').value)||100,pass=parseInt(Q('qm-pass').value)||0;
  if(src.length<200){qmMsg('Choose a PDF note (or paste some text) first.','err');return;}
  if(!name){qmMsg('Enter an exam name.','err');return;}
  if(pass>max){qmMsg('Pass score cannot be higher than max score.','err');return;}
  loading(true,'Quiz AI is reading your notes... (first use downloads ~5 MB)');
  var ai=window.qmAI?Promise.resolve():qmLoadScript('js/qm-ai.js');
  ai.then(function(){return window.qmAI(src,n);})
    .catch(function(){toast('Quiz AI could not load, using the basic engine instead.','error');return QM_ENGINE(src,n);})
    .then(function(qs){
      loading(false);QM.qs=qs||[];
      if(!QM.qs.length){qmMsg('Could not build questions from this text. Try notes written in full sentences.','err');qmDraw();return;}
      qmMsg(QM.qs.length<n?('Only '+QM.qs.length+' good questions could be made. Click Generate again for a different set.'):'Review the questions, remove any you dislike, then save.',QM.qs.length<n?'err':'ok');
      qmDraw();
    });
}
function qmDraw(){
  var box=Q('qm-out');box.style.display=QM.qs.length?'block':'none';
  Q('qm-list').innerHTML=QM.qs.map(function(q,i){
    return '<div style="border-top:1px solid var(--border2);padding:12px 0;"><div style="display:flex;gap:8px;justify-content:space-between;"><b style="font-size:13px;color:var(--ink);">'+(i+1)+'. '+esc(q.text)+'</b><button class="btn-del" data-qmdel="'+i+'" title="Remove">&#10005;</button></div>'
     +q.opts.map(function(o,j){var c='ABCD'[j]===q.correct;return '<div style="font-size:12px;padding:2px 0;color:'+(c?'var(--success)':'var(--text2)')+';'+(c?'font-weight:700;':'')+'">'+'ABCD'[j]+'. '+esc(o)+'</div>';}).join('')+'</div>';}).join('');
  Q('qm-count-lbl').textContent=QM.qs.length+' question'+(QM.qs.length!==1?'s':'');
}
function qmExam(status){
  return {id:Date.now().toString(),name:Q('qm-name').value.trim(),timer:Math.max(0,parseInt(Q('qm-timer').value)||0),maxScore:parseInt(Q('qm-max').value)||100,passScore:parseInt(Q('qm-pass').value)||0,
    editCode:'',createdBy:currentUser.name,createdById:currentUser.id,questions:QM.qs,studentProgress:{},status:status};
}
function qmSave(){
  if(!QM.qs.length)return;loading(true,'Saving exam...');
  saveExamDoc(qmExam('draft')).then(function(){loading(false);toast('Saved as a draft. Review and publish it in Exams.');teacherTab('exams');})
    .catch(function(e){loading(false);toast('Error: '+e.message,'error');});
}
function qmDownload(){
  if(!QM.qs.length)return;var e=qmExam('draft');delete e.id;delete e.editCode;delete e.createdBy;delete e.createdById;delete e.studentProgress;delete e.status;
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(e,null,2)],{type:'application/json'}));
  a.download=(e.name.replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-')||'exam')+'.json';document.body.appendChild(a);a.click();a.remove();
}
document.addEventListener('click',function(e){var b=e.target.closest('[data-qmdel]');if(!b)return;QM.qs.splice(parseInt(b.getAttribute('data-qmdel')),1);qmDraw();});
var _qmTT=teacherTab;teacherTab=function(t){_qmTT(t);if(t==='quiz')qmOpen();};
