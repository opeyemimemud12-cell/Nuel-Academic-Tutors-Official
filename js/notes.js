// Notes: folders, subfolders, selection mode (long-press), move & bulk download.
// Loaded AFTER app.js, so these functions replace the old note renderers/uploader.
var NF={t:{path:'',q:'',sel:{},mode:false,folders:[],saved:[]},s:{path:'',q:'',sel:{},mode:false,folders:[],saved:[]}};
function nfa(s){return esc(s).replace(/"/g,'&quot;');}
function nfCmp(a,b){return String(a).localeCompare(String(b),undefined,{sensitivity:'base',numeric:true});}
function nfBase(p){return p.split('/').pop();}
function nfParent(p){var i=p.lastIndexOf('/');return i<0?'':p.slice(0,i);}
function nfIn(n,p){var f=n.folder||'';return f===p||f.indexOf(p+'/')===0;}
function nfK(el){return el.closest('#stu-notes-list')?'s':'t';}

function nfAll(saved){
  var set={};
  function add(p){var c='';String(p||'').split('/').forEach(function(x){if(!x)return;c=c?c+'/'+x:x;set[c]=1;});}
  saved.forEach(add);_notes.forEach(function(n){add(n.folder);});
  return Object.keys(set).sort(nfCmp);
}

function nfShell(cont){
  if(!cont._shell){
    cont.innerHTML='<div class="nf-search-wrap"><span class="nf-search-ico">&#128269;</span><input class="nf-search" type="search" placeholder="Search notes... (any letters or symbols)" autocomplete="off" spellcheck="false"><button class="nf-search-x" type="button" title="Clear search" style="display:none">&#10005;</button></div><div class="nf-body"></div>';
    cont._shell=1;
  }
  return cont.querySelector('.nf-body');
}
function nfMatch(s,q){return String(s||'').toLowerCase().indexOf(q.toLowerCase())>=0;}
function nfHl(text,q){
  text=String(text);if(!q)return esc(text);
  var lt=text.toLowerCase(),lq=q.toLowerCase(),out='',i=0,j;
  while((j=lt.indexOf(lq,i))>=0){out+=esc(text.slice(i,j))+'<mark>'+esc(text.slice(j,j+q.length))+'</mark>';i=j+q.length;}
  return out+esc(text.slice(i));
}
function nfVisible(k){
  var S=NF[k],q=S.q.trim(),list;
  if(q)list=_notes.filter(function(n){return nfMatch(n.name,q)||nfMatch(n.folder,q);});
  else list=_notes.filter(function(n){return (n.folder||'')===S.path;});
  return list.sort(function(a,b){return nfCmp(a.name,b.name);});
}
function nfRender(k){
  var cont=Q(k==='t'?'notes-list-body':'stu-notes-list'),S=NF[k];
  nfShell(cont).innerHTML='<div style="padding:12px;text-align:center;color:var(--text3)">Loading...</div>';
  Promise.all([loadNotes(),getConfig('note_folders').catch(function(){return null;})]).then(function(r){
    S.saved=Array.isArray(r[1])?r[1]:[];S.folders=nfAll(S.saved);
    if(S.path&&S.folders.indexOf(S.path)<0)S.path='';
    nfDraw(k);
  }).catch(function(){nfShell(cont).innerHTML='<div class="empty-state"><div class="empty-title">Error</div></div>';});
}
function nfDraw(k){
  var S=NF[k],T=k==='t',cont=Q(T?'notes-list-body':'stu-notes-list'),body=nfShell(cont),q=S.q.trim(),cur=S.path;
  var inp=cont.querySelector('.nf-search'),clr=cont.querySelector('.nf-search-x');
  if(inp&&inp.value!==S.q)inp.value=S.q;if(clr)clr.style.display=S.q?'block':'none';
  var subs=q?S.folders.filter(function(p){return nfMatch(nfBase(p),q);}).sort(nfCmp)
           :S.folders.filter(function(p){return nfParent(p)===cur;}).sort(function(a,b){return nfCmp(nfBase(a),nfBase(b));});
  var notes=nfVisible(k),nSel=Object.keys(S.sel).length,h='',crumbs;
  if(q){
    crumbs='<span>&#128269; '+notes.length+' note'+(notes.length!==1?'s':'')+(subs.length?' &amp; '+subs.length+' folder'+(subs.length!==1?'s':''):'')+' for &ldquo;'+esc(q)+'&rdquo;</span>';
  }else{
    crumbs='<span class="nf-crumb" data-go="">&#128193; All Notes</span>';var acc='';
    cur.split('/').filter(Boolean).forEach(function(x){acc=acc?acc+'/'+x:x;crumbs+=' <span style="color:var(--text3)">&rsaquo;</span> <span class="nf-crumb" data-go="'+nfa(acc)+'">'+esc(x)+'</span>';});
  }
  h+='<div class="nf-bar"><div class="nf-path">'+crumbs+'</div><div class="nf-actions">';
  if(T)h+='<button class="btn-dl" data-act="newfolder">&#10133; New Folder</button>';
  h+='<button class="btn-dl" data-act="selmode">'+(S.mode?'Done':'&#9745; Select')+'</button></div></div>';
  if(T)h+='<div class="nf-hint">New uploads go into: <strong>'+esc(cur||'All Notes')+'</strong></div>';
  if(S.mode){
    h+='<div class="nf-selbar"><strong>'+nSel+' selected</strong><button class="btn-dl" data-act="selall">Select all '+(q?'results':'here')+'</button>'
      +(T?'<button class="btn-dl" data-act="move"'+(nSel?'':' disabled')+'>&#128194; Move</button>':'')
      +'<button class="btn-dl" data-act="dl"'+(nSel?'':' disabled')+'>&#11015; Download</button>'
      +'<button class="btn-dl" data-act="cancel">Cancel</button></div>';
  }else h+='<div class="nf-hint">Tip: press and hold a note to select several.</div>';
  if(!subs.length&&!notes.length)h+='<div class="empty-state"><div class="empty-icon">'+(q?'&#128269;':'&#128193;')+'</div><div class="empty-title">'+(q?'No matches':(cur?'This folder is empty':'No Notes Yet'))+'</div><div class="empty-sub">'+(q?'Nothing found for &ldquo;'+esc(q)+'&rdquo;':(T?'Upload files above or create a folder':'Nothing here yet'))+'</div></div>';
  subs.forEach(function(p){
    var c=_notes.filter(function(n){return nfIn(n,p);}).length,par=nfParent(p);
    h+='<div class="note-item nf-row nf-folder" data-open="'+nfa(p)+'"><div style="font-size:24px">&#128193;</div><div class="item-info"><div class="item-name">'+nfHl(nfBase(p),q)+'</div><div class="item-meta">'+c+' note'+(c!==1?'s':'')+(q&&par?' &middot; in '+esc(par):'')+'</div></div><span style="color:var(--text3)">&rsaquo;</span></div>';
  });
  notes.forEach(function(n){
    var on=!!S.sel[n.id];
    h+='<div class="'+(T?'note-item':'note-card-stu')+' nf-row'+(on?' nf-on':'')+'" data-nrow="'+nfa(n.id)+'">'
      +(S.mode?'<div class="nf-check">'+(on?'&#10003;':'')+'</div>':'')
      +'<div style="font-size:22px;flex-shrink:0">'+fileIcon(n.name)+'</div>'
      +'<div class="item-info" style="flex:1;min-width:80px"><div class="item-name">'+nfHl(n.name,q)+'</div><div class="item-meta">'+(q&&n.folder?'&#128193; '+nfHl(n.folder,q)+' &middot; ':'')+fmtSize(n.size)+' &middot; '+esc(n.uploadedBy||'Teacher')+'</div></div>';
    if(!S.mode){h+='<button class="btn-dl" data-noteid="'+nfa(n.id)+'">&#11015; Download</button>';
      if(T)h+='<button class="btn-del" data-delnote="'+nfa(n.id)+'" data-notename="'+nfa(n.name)+'">&#128465;</button>';}
    h+='</div>';
  });
  body.innerHTML=h;
  if(!cont._nf)nfBind(cont);
}
function nfBind(cont){
  cont._nf=1;var timer=null;
  function stop(){clearTimeout(timer);}
  cont.addEventListener('input',function(e){if(!e.target.classList.contains('nf-search'))return;var k=nfK(cont);NF[k].q=e.target.value;nfDraw(k);});
  cont.addEventListener('keydown',function(e){if(e.key==='Escape'&&e.target.classList.contains('nf-search')){var k=nfK(cont);NF[k].q='';nfDraw(k);}});
  cont.addEventListener('contextmenu',function(e){if(e.target.closest('.nf-row'))e.preventDefault();});
  cont.addEventListener('pointerdown',function(e){
    var row=e.target.closest('[data-nrow]');if(!row||e.target.closest('button'))return;
    var k=nfK(cont),S=NF[k],id=row.getAttribute('data-nrow');stop();
    timer=setTimeout(function(){S.mode=true;S.sel[id]=1;S.lp=true;if(navigator.vibrate)navigator.vibrate(30);nfDraw(k);},500);
  });
  ['pointerup','pointerleave','pointercancel','pointermove'].forEach(function(ev){cont.addEventListener(ev,stop);});
  cont.addEventListener('click',function(e){
    var k=nfK(cont),S=NF[k],t=e.target;
    if(S.lp){S.lp=false;return;}
    var b;
    if((b=t.closest('.nf-search-x'))){S.q='';nfDraw(k);var i2=cont.querySelector('.nf-search');if(i2)i2.focus();return;}
    if((b=t.closest('[data-noteid]'))){downloadNote(b.getAttribute('data-noteid'));return;}
    if((b=t.closest('[data-delnote]'))){deleteNoteConfirm(b.getAttribute('data-delnote'),b.getAttribute('data-notename'));return;}
    if((b=t.closest('[data-act]'))){nfAct(k,b.getAttribute('data-act'));return;}
    if((b=t.closest('[data-go]'))){S.q='';S.path=b.getAttribute('data-go');nfDraw(k);return;}
    if((b=t.closest('[data-open]'))){S.q='';S.path=b.getAttribute('data-open');nfDraw(k);return;}
    if((b=t.closest('[data-nrow]'))&&S.mode){var id=b.getAttribute('data-nrow');if(S.sel[id])delete S.sel[id];else S.sel[id]=1;nfDraw(k);}
  });
}
function nfAct(k,a){
  var S=NF[k];
  if(a==='newfolder')nfNewModal();
  else if(a==='selmode'){S.mode=!S.mode;if(!S.mode)S.sel={};nfDraw(k);}
  else if(a==='cancel'){S.mode=false;S.sel={};nfDraw(k);}
  else if(a==='selall'){nfVisible(k).forEach(function(n){S.sel[n.id]=1;});nfDraw(k);}
  else if(a==='move')nfMoveModal();
  else if(a==='dl')nfDlModal(k);
}
function nfSelIds(k){return Object.keys(NF[k].sel);}

// ---- create folder ----
function nfNewModal(){
  var cur=NF.t.path;
  showModal('<div class="modal-title">New Folder</div><div class="modal-sub">'+(cur?'Inside <strong>'+esc(cur)+'</strong>':'Create a folder in All Notes')+'</div>'
    +'<div class="field"><input id="nf-name" type="text" maxlength="50" placeholder="Folder name"></div>'
    +'<div class="modal-btn-row"><button class="modal-btn" onclick="closeModal()">Cancel</button><button class="modal-btn" onclick="nfCreate()">Create</button></div>');
  setTimeout(function(){var i=Q('nf-name');if(i)i.focus();},50);
}
function nfCreate(){
  var S=NF.t,name=(Q('nf-name').value||'').replace(/[\/\\]/g,'').trim();
  if(!name){toast('Enter a folder name.','error');return;}
  var path=S.path?S.path+'/'+name:name;
  if(S.folders.some(function(p){return p.toLowerCase()===path.toLowerCase();})){toast('That folder already exists.','error');return;}
  closeModal();loading(true,'Creating folder...');
  var list=S.saved.concat([path]);
  setConfig('note_folders',list).then(function(){S.saved=list;S.folders=nfAll(list);loading(false);toast('Folder created.');nfDraw('t');})
    .catch(function(e){loading(false);toast('Error: '+e.message,'error');});
}

// ---- move (with confirmation) ----
function nfMoveModal(){
  var S=NF.t,ids=nfSelIds('t');if(!ids.length)return;
  var opts='<option value="">All Notes (top level)</option>'+S.folders.map(function(p){return '<option value="'+nfa(p)+'">'+esc(p.split('/').join(' / '))+'</option>';}).join('');
  showModal('<div class="modal-title">Move Notes</div><div class="modal-sub">Move <strong>'+ids.length+'</strong> note'+(ids.length!==1?'s':'')+' to:</div>'
    +'<div class="field"><select id="nf-dest">'+opts+'</select></div>'
    +'<div class="modal-btn-row"><button class="modal-btn" onclick="closeModal()">Cancel</button><button class="modal-btn" onclick="nfMoveConfirm()">Review</button></div>');
}
function nfMoveConfirm(){
  var ids=nfSelIds('t'),dest=Q('nf-dest').value;
  showModal('<div class="modal-title">Confirm Move</div><div class="modal-sub">Move <strong>'+ids.length+'</strong> note'+(ids.length!==1?'s':'')+' to <strong>'+esc(dest?dest.split('/').join(' / '):'All Notes')+'</strong>?</div>'
    +'<div class="modal-btn-row"><button class="modal-btn" onclick="closeModal()">Cancel</button><button class="modal-btn" style="background:var(--gold);color:var(--ink);" data-dest="'+nfa(dest)+'" id="nf-go-move">Yes, move</button></div>');
  Q('nf-go-move').addEventListener('click',function(){nfDoMove(dest);});
}
function nfDoMove(dest){
  var S=NF.t,ids=nfSelIds('t');closeModal();loading(true,'Moving...');
  Promise.all(ids.map(function(id){return new Promise(function(res){fbSet('notes',id,{folder:dest},function(e){if(!e){var n=_notes.find(function(x){return x.id===id;});if(n)n.folder=dest;}res(e);});});}))
    .then(function(r){loading(false);var bad=r.filter(Boolean).length;S.sel={};S.mode=false;toast(bad?bad+' failed to move.':'Moved '+ids.length+' note'+(ids.length!==1?'s':'')+'.',bad?'error':'success');S.folders=nfAll(S.saved);nfDraw('t');});
}

// ---- bulk download (with confirmation) ----
function nfDlModal(k){
  var ids=nfSelIds(k);if(!ids.length)return;
  var names=ids.slice(0,5).map(function(id){var n=_notes.find(function(x){return x.id===id;});return '&bull; '+esc(n?n.name:'');}).join('<br>')+(ids.length>5?'<br>&hellip; and '+(ids.length-5)+' more':'');
  showModal('<div class="modal-title">Download Notes</div><div class="modal-sub">Download <strong>'+ids.length+'</strong> note'+(ids.length!==1?'s':'')+(ids.length>1?' as one ZIP file':'')+'?</div>'
    +'<div style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:14px;">'+names+'</div>'
    +'<div class="modal-btn-row"><button class="modal-btn" onclick="closeModal()">Cancel</button><button class="modal-btn" style="background:var(--gold);color:var(--ink);" id="nf-go-dl">Download</button></div>');
  Q('nf-go-dl').addEventListener('click',function(){nfDoDl(k);});
}
function nfSave(href,name){var a=document.createElement('a');a.href=href;a.download=name;document.body.appendChild(a);a.click();a.remove();}
function nfDoDl(k){
  var S=NF[k],list=nfSelIds(k).map(function(id){return _notes.find(function(x){return x.id===id;});}).filter(Boolean);
  closeModal();
  if(list.length===1){nfSave(list[0].data,list[0].name);}
  else if(typeof JSZip!=='undefined'){
    loading(true,'Preparing ZIP...');var z=new JSZip();
    list.forEach(function(n){z.file((n.folder?n.folder+'/':'')+n.name,String(n.data).split(',')[1]||'',{base64:true});});
    z.generateAsync({type:'blob'}).then(function(b){var u=URL.createObjectURL(b);nfSave(u,'Notes-'+new Date().toISOString().slice(0,10)+'.zip');setTimeout(function(){URL.revokeObjectURL(u);},4000);loading(false);})
      .catch(function(e){loading(false);toast('ZIP failed: '+e.message,'error');});
  }else list.forEach(function(n,i){setTimeout(function(){nfSave(n.data,n.name);},i*400);});
  S.sel={};S.mode=false;nfDraw(k);
}

// ---- overrides of the old functions ----
function renderTeacherNotes(){nfRender('t');}
function renderStuNotes(){nfRender('s');}
function handleNoteUpload(e){
  var files=Array.from(e.target.files),input=e.target;if(!files.length)return;
  var folder=NF.t.path;loading(true,'Uploading '+files.length+' file(s)...');
  var chain=Promise.resolve();
  files.forEach(function(f){chain=chain.then(function(){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(ev){
    saveNoteDoc({id:Date.now().toString()+Math.random().toString(36).slice(2),name:f.name,size:f.size,type:f.type,data:ev.target.result,folder:folder,uploadedBy:currentUser.name,uploadedAt:new Date().toISOString()}).then(res).catch(rej);};r.readAsDataURL(f);});});});
  chain.then(function(){toast(files.length+' file'+(files.length!==1?'s':'')+' uploaded!');loading(false);renderTeacherNotes();input.value='';})
    .catch(function(er){toast('Upload error: '+er.message,'error');loading(false);input.value='';});
}
