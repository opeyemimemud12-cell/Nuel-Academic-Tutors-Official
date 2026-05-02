// ADMIN
function enterAdminDash(){Q('admin-uname').textContent=currentUser.email;Q('admin-greeting').textContent=currentUser.name;adminTab('add-user');showScreen('admin-dash');}
function adminTab(tab){
  document.querySelectorAll('[id^="atb-"]').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('[id^="admin-panel-"]').forEach(function(p){p.classList.remove('active');});
  if(Q('atb-'+tab))Q('atb-'+tab).classList.add('active');
  if(Q('admin-panel-'+tab))Q('admin-panel-'+tab).classList.add('active');
  if(tab==='user-list')renderAdminUserList();
  if(tab==='reset-exams')renderAdminResetExams();
  if(tab==='session-log')renderAdminSessionLog();
  if(tab==='access-code')renderAccessCodeTab();
}
function addUser(role){
  var p=role==='teacher'?'at':'as';
  var name=Q(p+'-name').value.trim(),email=Q(p+'-email').value.trim(),pass=Q(p+'-pass').value;
  if(!name||!email||!pass){toast('Fill all fields.','error');return;}
  loading(true,'Adding user...');
  loadUsers().then(function(){
    if(_users.find(function(u){return u.email===email||u.username===email;})){toast('Email already exists.','error');loading(false);return;}
    var id=Date.now().toString();
    return saveUser({id:id,role:role,name:name,email:email,username:email,password:pass,sessions:[],createdAt:new Date().toISOString()});
  }).then(function(){Q(p+'-name').value='';Q(p+'-email').value='';Q(p+'-pass').value='';toast((role==='teacher'?'Teacher':'Student')+' added!');loading(false);})
  .catch(function(e){toast('Error: '+e.message,'error');loading(false);});
}

// User list — uses data attributes to avoid quote issues in onclick
function renderAdminUserList(){
  var cont=Q('admin-user-list-body');
  cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">Loading...</div>';
  loadUsers().then(function(){
    if(!_users.length){cont.innerHTML='<div class="empty-state"><div class="empty-icon">&#128101;</div><div class="empty-title">No Users Yet</div></div>';return;}
    var sorted=[].concat(_users).sort(function(a,b){return a.role.localeCompare(b.role);});
    var html=sorted.map(function(u,i){
      var rc=u.role==='teacher'?'var(--gold)':'var(--success)';
      return '<div class="uli">'
        +'<div class="uli-av '+u.role+'">'+esc(u.name||'?').charAt(0).toUpperCase()+'</div>'
        +'<div class="uli-info"><div class="uli-name">'+esc(u.name)+'</div>'
        +'<div class="uli-meta">'+esc(u.email)+'&nbsp;&middot;&nbsp;<span style="color:'+rc+'">'+u.role+'</span></div></div>'
        +'<button class="uli-cred-btn" data-cred="cred'+i+'">&#128273; Credentials</button>'
        +'<button class="uli-del" data-uid="'+u.id+'" data-uname="'+esc(u.name)+'">&#128465;</button>'
        +'</div>'
        +'<div class="cred-panel" id="cred'+i+'">'
        +'<div class="cred-row"><span class="cred-key">Email</span><span class="cred-val">'+esc(u.email)+'</span></div>'
        +'<div class="cred-row"><span class="cred-key">Password</span>'
        +'<span class="cred-val" id="cpw'+i+'">&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;</span>'
        +'<span style="display:none" id="cpwa'+i+'">'+esc(u.password)+'</span>'
        +'<button data-show="cpw'+i+'" data-showa="cpwa'+i+'" style="background:none;border:1px solid var(--border2);border-radius:4px;padding:2px 7px;font-size:10px;cursor:pointer;color:var(--text2);margin-left:8px;">Show</button>'
        +'</div></div>';
    }).join('');
    cont.innerHTML=html;
    cont.addEventListener('click',function(e){
      var cb=e.target.closest('[data-cred]');
      var db2=e.target.closest('[data-uid]');
      var sb=e.target.closest('[data-show]');
      if(cb)toggleEl(cb.getAttribute('data-cred'));
      if(db2)deleteUserConfirm(db2.getAttribute('data-uid'),db2.getAttribute('data-uname'));
      if(sb)togglePw(sb.getAttribute('data-show'),sb.getAttribute('data-showa'),sb);
    });
  }).catch(function(e){cont.innerHTML='<div class="empty-state"><div class="empty-title">Error: '+esc(e.message)+'</div></div>';});
}
function toggleEl(id){var el=Q(id);if(el)el.classList.toggle('open');}
function togglePw(d,a,btn){var dEl=Q(d),aEl=Q(a);if(!dEl||!aEl)return;var shown=aEl.style.display!=='none';dEl.style.display=shown?'inline':'none';aEl.style.display=shown?'none':'inline';btn.textContent=shown?'Show':'Hide';}
function deleteUserConfirm(id,name){
  showModal('<div class="modal-title">Delete User</div>'
    +'<div class="modal-sub">Permanently delete <strong>'+esc(name)+'</strong>?</div>'
    +'<div class="modal-btn-row"><button class="modal-btn" onclick="closeModal()">Cancel</button>'
    +'<button class="modal-btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" data-delid="'+id+'">Yes, Delete</button></div>');
  setTimeout(function(){
    var btn=document.querySelector('[data-delid]');
    if(btn)btn.addEventListener('click',function(){doDeleteUser(id);});
  },30);
}
function doDeleteUser(id){
  closeModal();loading(true,'Deleting...');
  deleteUserById(id).then(function(){toast('User deleted.');loading(false);renderAdminUserList();}).catch(function(e){toast('Error: '+e.message,'error');loading(false);});
}

// Reset exams — use data attributes
function renderAdminResetExams(){
  var cont=Q('admin-reset-body');
  cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">Loading...</div>';
  Promise.all([loadUsers(),loadExams()]).then(function(){
    var students=_users.filter(function(u){return u.role==='student';});
    if(!students.length){cont.innerHTML='<div class="empty-state"><div class="empty-icon">&#127891;</div><div class="empty-title">No Students Yet</div></div>';return;}
    cont.innerHTML=students.map(function(stu,si){
      var rows=_exams.map(function(ex){
        var prog=(ex.studentProgress||{})[stu.id];var done=!!(prog&&prog.completed);
        return '<div class="rex-row"><div class="rex-info"><div class="rex-name">'+esc(ex.name)+'</div>'
          +'<div class="rex-status '+(done?'done':'avail')+'">'+(done?'&#10003; Completed':'&#9711; Not taken')+'</div></div>'
          +'<button class="btn-reset" data-examid="'+ex.id+'" data-stuid="'+stu.id+'"'+(done?'':' disabled')+'>Reset</button></div>';
      }).join('')||'<div style="padding:10px;font-size:13px;color:var(--text3)">No exams yet.</div>';
      return '<div class="sc"><div class="sc-header" data-toggle="rst'+si+'"><div class="uli-av student">'+stu.name.charAt(0)+'</div>'
        +'<div style="flex:1"><div style="font-weight:700;font-size:13px;color:var(--navy)">'+esc(stu.name)+'</div>'
        +'<div style="font-size:10px;color:var(--text3)">'+esc(stu.email)+'</div></div>'
        +'<span style="color:var(--text3)">&#9660;</span></div>'
        +'<div class="sc-body" id="rst'+si+'">'+rows+'</div></div>';
    }).join('');
    cont.addEventListener('click',function(e){
      var tog=e.target.closest('[data-toggle]');if(tog)toggleEl(tog.getAttribute('data-toggle'));
      var rb=e.target.closest('[data-examid]');if(rb&&!rb.disabled)adminResetExam(rb.getAttribute('data-examid'),rb.getAttribute('data-stuid'));
    });
  }).catch(function(){cont.innerHTML='<div class="empty-state"><div class="empty-title">Error</div></div>';});
}
function adminResetExam(examId,stuId){
  loading(true,'Resetting...');
  loadExams().then(function(){
    var ex=_exams.find(function(e){return e.id===examId;});if(!ex){loading(false);return;}
    var prog=Object.assign({},ex.studentProgress||{});delete prog[stuId];
    return saveExamDoc(Object.assign({},ex,{studentProgress:prog}));
  }).then(function(){toast('Exam reset.');loading(false);renderAdminResetExams();}).catch(function(e){toast('Error: '+e.message,'error');loading(false);});
}

// Session log — use data attributes
function renderAdminSessionLog(){
  var cont=Q('admin-session-body');
  cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">Loading...</div>';
  loadUsers().then(function(){
    var students=_users.filter(function(u){return u.role==='student';});
    if(!students.length){cont.innerHTML='<div class="empty-state"><div class="empty-icon">&#128203;</div><div class="empty-title">No Students Yet</div></div>';return;}
    cont.innerHTML=students.map(function(stu,si){
      var sessions=stu.sessions||[];
      var sessHtml=sessions.length===0?'<div style="padding:10px;font-size:12px;color:var(--text3)">No sessions yet.</div>'
        :sessions.map(function(s,idx){return '<div class="slog-entry"><span style="color:var(--gold);font-weight:700">Session '+(idx+1)+' &#8212; '+(s.examName||'Unknown')+'</span>\nDate      : '+(s.submittedAt?new Date(s.submittedAt).toLocaleString():'N/A')+'\nCandidate : '+(s.candidate||stu.name)+'\nScore     : '+(s.score!==undefined?s.score+'/'+s.maxScore:'N/A')+'\nPassed    : '+(s.passed===true?'Yes &#10003;':s.passed===false?'No &#10005;':'N/A')+'\n&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;&#9472;\nTab Switches: '+(s.tabSwitches||0)+'\nKeystrokes  : '+(s.keystrokes||0)+'</div>';}).join('');
      return '<div class="sc"><div class="sc-header" data-toggle="slog'+si+'"><div class="uli-av student">'+stu.name.charAt(0)+'</div>'
        +'<div style="flex:1"><div style="font-weight:700;font-size:13px;color:var(--navy)">'+esc(stu.name)+'</div>'
        +'<div style="font-size:10px;color:var(--text3)">'+sessions.length+' session'+(sessions.length!==1?'s':'')+'</div></div>'
        +'<span style="color:var(--text3)">&#9660;</span></div>'
        +'<div class="sc-body" id="slog'+si+'" style="padding-top:4px">'+sessHtml+'</div></div>';
    }).join('');
    cont.addEventListener('click',function(e){var tog=e.target.closest('[data-toggle]');if(tog)toggleEl(tog.getAttribute('data-toggle'));});
  }).catch(function(){cont.innerHTML='<div class="empty-state"><div class="empty-title">Error</div></div>';});
}
function renderAccessCodeTab(){
  getConfig('access_code').then(function(code){
    var statusEl=Q('access-code-status');if(!statusEl)return;
    if(code){statusEl.innerHTML='<div style="display:flex;align-items:center;gap:10px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:var(--radius-sm);padding:12px 16px;"><span style="font-size:20px;">&#128274;</span><div><div style="font-weight:700;font-size:13px;color:var(--navy);">Active</div><div style="font-size:12px;color:var(--text3);">Code: <strong style="color:var(--success);font-family:JetBrains Mono,monospace;">'+esc(code)+'</strong></div></div></div>';}
    else{statusEl.innerHTML='<div style="display:flex;align-items:center;gap:10px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-sm);padding:12px 16px;"><span style="font-size:20px;">&#128275;</span><div><div style="font-weight:700;font-size:13px;color:var(--navy);">No Code Set</div><div style="font-size:12px;color:var(--text3);">Students log in freely.</div></div></div>';}
  });
}
function setAccessCode(){var inp=Q('new-access-code');var code=(inp?inp.value:'').trim();if(!code){toast('Enter a code first.','error');return;}loading(true,'Saving...');setConfig('access_code',code).then(function(){if(inp)inp.value='';toast('Access code set!');loading(false);renderAccessCodeTab();}).catch(function(e){toast('Error: '+e.message,'error');loading(false);});}
function clearAccessCode(){if(!confirm('Remove access code?'))return;loading(true,'Removing...');setConfig('access_code',null).then(function(){toast('Code removed.');loading(false);renderAccessCodeTab();}).catch(function(e){toast('Error: '+e.message,'error');loading(false);});}

// TEACHER
function enterTeacherDash(){Q('teacher-uname').textContent=currentUser.name;Q('teacher-greeting').textContent=currentUser.name;teacherTab('home');showScreen('teacher-dash');}
function teacherTab(tab){
  document.querySelectorAll('[id^="ttb-"]').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('[id^="teacher-panel-"]').forEach(function(p){p.classList.remove('active');});
  if(Q('ttb-'+tab))Q('ttb-'+tab).classList.add('active');
  if(Q('teacher-panel-'+tab))Q('teacher-panel-'+tab).classList.add('active');
  if(tab==='notes')renderTeacherNotes();
  if(tab==='exams')renderTeacherExams();
  if(tab==='scores')renderTeacherScores();
}
function handleNoteUpload(e){
  var files=Array.from(e.target.files);if(!files.length)return;
  loading(true,'Uploading '+files.length+' file(s)...');
  var chain=Promise.resolve();
  files.forEach(function(f){chain=chain.then(function(){return new Promise(function(res,rej){var reader=new FileReader();reader.onload=function(ev){var id=Date.now().toString()+Math.random().toString(36).slice(2);saveNoteDoc({id:id,name:f.name,size:f.size,type:f.type,data:ev.target.result,uploadedBy:currentUser.name,uploadedAt:new Date().toISOString()}).then(res).catch(rej);};reader.readAsDataURL(f);});});});
  chain.then(function(){toast(files.length+' file'+(files.length!==1?'s':'')+' uploaded!');loading(false);renderTeacherNotes();e.target.value='';}).catch(function(er){toast('Upload error: '+er.message,'error');loading(false);e.target.value='';});
}
function renderTeacherNotes(){
  var cont=Q('notes-list-body');
  cont.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3)">Loading...</div>';
  loadNotes().then(function(){
    if(!_notes.length){cont.innerHTML='<div class="empty-state"><div class="empty-icon">&#128193;</div><div class="empty-title">No Notes Yet</div><div class="empty-sub">Upload files above</div></div>';return;}
    cont.innerHTML=_notes.map(function(n){
      return '<div class="note-item"><div style="font-size:22px;flex-shrink:0">'+fileIcon(n.name)+'</div>'
        +'<div class="item-info"><div class="item-name">'+esc(n.name)+'</div><div class="item-meta">'+fmtSize(n.size)+' &middot; '+(n.uploadedBy||'Teacher')+'</div></div>'
        +'<button class="btn-dl" data-noteid="'+n.id+'">&#11015; Download</button>'
        +'<button class="btn-del" data-delnote="'+n.id+'" data-notename="'+esc(n.name)+'">&#128465;</button></div>';
    }).join('');
    cont.addEventListener('click',function(e){
      var db2=e.target.closest('[data-noteid]');if(db2)downloadNote(db2.getAttribute('data-noteid'));
      var dn=e.target.closest('[data-delnote]');if(dn)deleteNoteConfirm(dn.getAttribute('data-delnote'),dn.getAttribute('data-notename'));
    });
  }).catch(function(){cont.innerHTML='<div class="empty-state"><div class="empty-title">Error</div></div>';});
}
function downloadNote(id){loadNotes().then(function(){var n=_notes.find(function(x){return x.id===id;});if(!n)return;var a=document.createElement('a');a.href=n.data;a.download=n.name;a.click();});}
function deleteNoteConfirm(id,name){
  showModal('<div class="modal-title">Delete Note</div><div class="modal-sub">Delete <strong>'+esc(name)+'</strong>?</div>'
    +'<div class="modal-btn-row"><button class="modal-btn" onclick="closeModal()">Cancel</button>'
    +'<button class="modal-btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" data-delnote2="'+id+'">Delete</button></div>');
  setTimeout(function(){var btn=document.querySelector('[data-delnote2]');if(btn)btn.addEventListener('click',function(){doDeleteNote(id);});},30);
}
function doDeleteNote(id){closeModal();loading(true,'Deleting...');deleteNoteById(id).then(function(){toast('Note deleted.');loading(false);renderTeacherNotes();}).catch(function(e){toast('Error: '+e.message,'error');loading(false);});}

function toggleExamStatus(examId){
  loading(true,'Updating...');
  loadExams().then(function(){
    var ex=_exams.find(function(e){return e.id===examId;});if(!ex){loading(false);return;}
    if(ex.createdById&&ex.createdById!==currentUser.id){toast('Only the creator can publish/unpublish this exam.','error');loading(false);return;}
    var newStatus=ex.status==='published'?'draft':'published';
    return saveExamDoc(Object.assign({},ex,{status:newStatus}));
  }).then(function(){loading(false);renderTeacherExams();toast('Exam status updated!');}).catch(function(e){toast('Error: '+e.message,'error');loading(false);});
}
function renderTeacherExams(){
  var cont=Q('teacher-exam-list');
  cont.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3)">Loading...</div>';
  loadExams().then(function(){
    if(!_exams.length){cont.innerHTML='<div class="empty-state"><div class="empty-icon">&#9997;</div><div class="empty-title">No Exams Yet</div></div>';return;}
    // Only show exams created by this teacher
    var myExams=_exams.filter(function(e){return !e.createdById||e.createdById===currentUser.id||e.createdBy===currentUser.name;});
    if(!myExams.length){cont.innerHTML='<div class="empty-state"><div class="empty-icon">&#9997;</div><div class="empty-title">No Exams Yet</div><div class="empty-sub">Create your first exam above</div></div>';return;}
    cont.innerHTML=myExams.map(function(e){
      var isDraft=!e.status||e.status==='draft';
      var statusBadge=isDraft?'<span class="draft-badge">&#128190; Draft</span>':'<span class="published-badge">&#9989; Published</span>';
      var toggleBtn=isDraft
        ?'<button class="btn-publish" data-toggle="'+e.id+'">&#128275; Publish</button>'
        :'<button class="btn-unpublish" data-toggle="'+e.id+'">&#128274; Unpublish</button>';
      return '<div class="exam-item" style="flex-wrap:wrap;gap:8px;"><div style="font-size:22px">&#128221;</div>'
        +'<div class="item-info"><div class="item-name">'+esc(e.name)+' '+statusBadge+'</div>'
        +'<div class="item-meta">'+e.questions.length+' Q &middot; Max: '+e.maxScore+' &middot; Pass: '+e.passScore+(e.timer?' &middot; &#9201; '+e.timer+'m':'')+'</div></div>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">'
        +toggleBtn
        +'<button class="btn-sm" data-edit="'+e.id+'">&#9998; Edit</button>'
        +'<button class="btn-sm" data-export="'+e.id+'">&#11015;</button>'
        +'<button class="btn-sm danger" data-delexam="'+e.id+'" data-examname="'+esc(e.name)+'">&#128465;</button>'
        +'</div></div>';
    }).join('');
    cont.addEventListener('click',function(e2){
      var tb=e2.target.closest('[data-toggle]');if(tb)toggleExamStatus(tb.getAttribute('data-toggle'));
      var eb=e2.target.closest('[data-edit]');if(eb)editExam(eb.getAttribute('data-edit'));
      var xb=e2.target.closest('[data-export]');if(xb)exportExam(xb.getAttribute('data-export'));
      var db2=e2.target.closest('[data-delexam]');if(db2)deleteExamConfirm(db2.getAttribute('data-delexam'),db2.getAttribute('data-examname'));
    });
  }).catch(function(){cont.innerHTML='<div class="empty-state"><div class="empty-title">Error</div></div>';});
}
function showCreateExam(){editingExamId=null;qCount=0;['ex-name','ex-editcode'].forEach(function(id){if(Q(id))Q(id).value='';});if(Q('ex-timer'))Q('ex-timer').value='0';if(Q('ex-max'))Q('ex-max').value='100';if(Q('ex-pass'))Q('ex-pass').value='50';if(Q('questions-container'))Q('questions-container').innerHTML='';if(Q('ces-title'))Q('ces-title').textContent='Create Exam';addQuestion();showScreen('create-exam-screen');}
function editExam(id){
  loadExams().then(function(){
    var ex=_exams.find(function(e){return e.id===id;});if(!ex)return;
    if(ex.editCode){
      showModal('<div class="modal-title">Edit Exam</div><div class="modal-sub">Enter the edit code for this exam.</div>'
        +'<input class="modal-input" id="ecodeinp" type="password" placeholder="Edit code...">'
        +'<div class="modal-error" id="ecodeerr"></div>'
        +'<div class="modal-btn-row"><button class="modal-btn" onclick="closeModal()">Cancel</button>'
        +'<button class="modal-btn primary" data-confirmid="'+id+'">Unlock</button></div>');
      setTimeout(function(){
        if(Q('ecodeinp'))Q('ecodeinp').focus();
        var cb=document.querySelector('[data-confirmid]');
        if(cb)cb.addEventListener('click',function(){confirmEditExam(id);});
        if(Q('ecodeinp'))Q('ecodeinp').addEventListener('keydown',function(e){if(e.key==='Enter')confirmEditExam(id);});
      },30);
    }else loadExamForEdit(ex);
  });
}
function confirmEditExam(id){var inp=Q('ecodeinp');loadExams().then(function(){var ex=_exams.find(function(e){return e.id===id;});if(!ex)return;if(!inp||inp.value!==ex.editCode){if(inp){inp.classList.remove('shake');void inp.offsetWidth;inp.classList.add('shake');}if(Q('ecodeerr'))Q('ecodeerr').textContent='Incorrect code.';return;}closeModal();loadExamForEdit(ex);});}
function loadExamForEdit(ex){editingExamId=ex.id;if(Q('ex-name'))Q('ex-name').value=ex.name;if(Q('ex-timer'))Q('ex-timer').value=ex.timer||0;if(Q('ex-max'))Q('ex-max').value=ex.maxScore||100;if(Q('ex-pass'))Q('ex-pass').value=ex.passScore||50;if(Q('ex-editcode'))Q('ex-editcode').value=ex.editCode||'';qCount=0;if(Q('questions-container'))Q('questions-container').innerHTML='';if(Q('ces-title'))Q('ces-title').textContent='Edit Exam';ex.questions.forEach(function(q){addQuestion(q);});showScreen('create-exam-screen');}
function backFromCreateExam(){editingExamId=null;showScreen('teacher-dash');teacherTab('exams');}
function compressImage(file,cb){
  var reader=new FileReader();
  reader.onload=function(ev){
    var img=new Image();
    img.onload=function(){
      var canvas=document.createElement('canvas');
      var MAX=600;
      var w=img.width,h=img.height;
      if(w>h){if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}}else{if(h>MAX){w=Math.round(w*MAX/h);h=MAX;}}
      canvas.width=w;canvas.height=h;
      var ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      var compressed=canvas.toDataURL('image/jpeg',0.55);
      cb(compressed,w,h);
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}
function handleQImage(event,idx){
  var file=event.target.files[0];if(!file)return;
  if(!file.type.startsWith('image/')){toast('Please select an image file.','error');return;}
  var l=Q('qimg-label-'+idx);
  if(l)l.innerHTML='&#8987; Compressing...';
  compressImage(file,function(dataUrl,w,h){
    var p=Q('qimg-preview-'+idx);
    if(p){p.src=dataUrl;p.style.display='block';p.setAttribute('data-has-img','1');}
    var kb=Math.round(dataUrl.length*0.75/1024);
    if(l)l.innerHTML='&#10003; Image ready ('+kb+'KB, '+w+'x'+h+'px)';
    toast('Image attached and compressed!');
  });
}
function addQuestion(q){
  qCount++;var idx=qCount;
  var text=q?q.text:'',opts=q?q.opts:['','','',''],correct=q?q.correct:'',imgSrc=q&&q.image?q.image:'';
  var div=document.createElement('div');div.className='card';div.id='qcard-'+idx;div.style.marginBottom='14px';
  var optHtml=['A','B','C','D'].map(function(l,li){return '<div class="field" style="margin:0;"><label>Option '+l+'</label><input type="text" id="qopt-'+idx+'-'+l+'" value="'+esc(opts[li]||'')+'" placeholder="Option '+l+'..."></div>';}).join('');
  var selHtml=['A','B','C','D'].map(function(l){return '<option value="'+l+'"'+(correct===l?' selected':'')+'>'+l+'</option>';}).join('');
  div.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'
    +'<span style="font-size:11px;color:var(--gold);font-weight:700;">Q'+idx+'</span>'
    +'<button class="btn-del" data-removeq="qcard-'+idx+'">&#10005; Remove</button></div>'
    +'<div class="field" style="margin-bottom:8px;"><label>Question Text</label>'
    +'<textarea style="background:var(--cream);border:1.5px solid var(--border2);border-radius:var(--radius-sm);color:var(--text);font-size:14px;padding:10px;width:100%;resize:vertical;min-height:65px;outline:none;font-family:Plus Jakarta Sans,sans-serif;" id="qtxt-'+idx+'" placeholder="Type the question here...">'+esc(text)+'</textarea></div>'
    +'<div style="margin-bottom:10px;"><label style="font-size:10px;font-weight:700;color:var(--text2);letter-spacing:0.08em;text-transform:uppercase;display:block;margin-bottom:6px;">Image (optional)</label>'
    +'<label for="qimg-file-'+idx+'" style="display:inline-flex;align-items:center;gap:8px;background:var(--cream);border:1.5px dashed rgba(201,168,76,0.35);border-radius:var(--radius-sm);padding:9px 14px;cursor:pointer;font-size:12px;color:var(--gold);">&#128247; Attach Image</label>'
    +'<input type="file" id="qimg-file-'+idx+'" accept="image/*" style="display:none;" onchange="handleQImage(event,'+idx+')">'
    +'<span id="qimg-label-'+idx+'" style="font-size:11px;color:var(--success);margin-left:8px;">'+(imgSrc?'&#10003; Image attached':'')+'</span>'
    +'<br><img id="qimg-preview-'+idx+'" src="'+(imgSrc||'')+'" style="display:'+(imgSrc?'block':'none')+';max-width:100%;max-height:120px;object-fit:contain;border-radius:var(--radius-sm);margin-top:8px;border:1px solid var(--border2);"></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">'+optHtml+'</div>'
    +'<div class="field" style="margin:0;"><label>Correct Answer</label>'
    +'<select id="qcorrect-'+idx+'" style="background:var(--cream);border:1.5px solid var(--border2);border-radius:var(--radius-sm);color:var(--text);font-size:14px;padding:10px;width:100%;outline:none;">'
    +'<option value="">&#8212; Select correct answer &#8212;</option>'+selHtml+'</select></div>';
  div.addEventListener('click',function(e){var rb=e.target.closest('[data-removeq]');if(rb){var el=Q(rb.getAttribute('data-removeq'));if(el)el.remove();}});
  if(Q('questions-container'))Q('questions-container').appendChild(div);
  // If editing and has image, set data-has-img so save picks it up
  if(imgSrc){var prevEl=Q('qimg-preview-'+idx);if(prevEl)prevEl.setAttribute('data-has-img','1');}
  if(!q)div.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function doSaveExam(publish){
  var name=Q('ex-name').value.trim();if(!name){toast('Enter exam name.','error');return;}
  var cards=document.querySelectorAll('[id^="qcard-"]');if(!cards.length){toast('Add at least one question.','error');return;}
  var questions=[],valid=true;
  cards.forEach(function(card){
    var idx=card.id.split('-')[1];
    var text=Q('qtxt-'+idx)?Q('qtxt-'+idx).value.trim():'';
    var opts=['A','B','C','D'].map(function(l){return Q('qopt-'+idx+'-'+l)?Q('qopt-'+idx+'-'+l).value.trim():'';});
    var correct=Q('qcorrect-'+idx)?Q('qcorrect-'+idx).value:'';
    var imgPrev=Q('qimg-preview-'+idx);
    var imgData=(imgPrev&&imgPrev.getAttribute('data-has-img')==='1'&&imgPrev.src&&imgPrev.src.startsWith('data:'))?imgPrev.src:null;
    if(!text){toast('Q'+idx+': Enter question text.','error');valid=false;return;}
    if(opts.some(function(o){return!o;})){toast('Q'+idx+': Fill all 4 options.','error');valid=false;return;}
    if(!correct){toast('Q'+idx+': Select correct answer.','error');valid=false;return;}
    questions.push({text:text,opts:opts,correct:correct,image:imgData||null});
  });
  if(!valid)return;
  loading(true,'Saving exam...');
  loadExams().then(function(){
    var oldProg={};if(editingExamId){var old=_exams.find(function(e){return e.id===editingExamId;});if(old)oldProg=old.studentProgress||{};}
    var id=editingExamId||Date.now().toString();
    var status=publish?'published':'draft';if(editingExamId&&publish===undefined){var oldEx=_exams.find(function(e){return e.id===editingExamId;});if(oldEx)status=oldEx.status||'draft';}return saveExamDoc({id:id,name:name,timer:parseInt(Q('ex-timer').value)||0,maxScore:parseInt(Q('ex-max').value)||100,passScore:parseInt(Q('ex-pass').value)||50,editCode:Q('ex-editcode').value.trim(),createdBy:currentUser.name,createdById:currentUser.id,questions:questions,studentProgress:oldProg,status:status});
  }).then(function(){editingExamId=null;toast(publish?'Exam published! Students can now see it.':'Draft saved! Publish when ready.');loading(false);showScreen('teacher-dash');teacherTab('exams');}).catch(function(e){toast('Error: '+e.message,'error');loading(false);});
}
function importExamJSON(event){
  var file = event.target.files[0];
  if(!file){ return; }
  if(!file.name.endsWith('.json')){ toast('Please select a .json file.','error'); return; }
  var reader = new FileReader();
  reader.onload = function(ev){
    var data;
    try{ data = JSON.parse(ev.target.result); }
    catch(e){ toast('Invalid JSON file. Make sure it is a valid exam file.','error'); event.target.value=''; return; }
    // Validate it has the right structure
    if(!data.name || !data.questions || !Array.isArray(data.questions)){
      toast('This file does not look like a valid exam. It needs name and questions fields.','error');
      event.target.value=''; return;
    }
    if(data.questions.length === 0){ toast('Exam has no questions.','error'); event.target.value=''; return; }
    // Validate questions have required fields
    var valid = data.questions.every(function(q){ return q.text && q.opts && q.correct && q.opts.length >= 4; });
    if(!valid){ toast('Some questions are missing text, options, or correct answer.','error'); event.target.value=''; return; }
    // Show confirmation modal
    showModal(
      '<div class="modal-title">&#128229; Import Exam</div>'
      +'<div class="modal-sub">Ready to import <strong>'+esc(data.name)+'</strong><br>'
      +data.questions.length+' questions &middot; Max score: '+(data.maxScore||100)+' &middot; Pass: '+(data.passScore||50)+'</div>'
      +'<div style="background:var(--cream);border-radius:var(--radius-sm);padding:12px 14px;font-size:12px;color:var(--text2);margin-bottom:14px;">'
      +'<strong style="color:var(--navy);">Import as:</strong><br>'
      +'<label style="display:flex;align-items:center;gap:8px;margin-top:8px;cursor:pointer;"><input type="radio" name="import-status" value="draft" checked> &#128190; Draft (students cannot see it yet)</label>'
      +'<label style="display:flex;align-items:center;gap:8px;margin-top:6px;cursor:pointer;"><input type="radio" name="import-status" value="published"> &#9989; Published (students can take it immediately)</label>'
      +'</div>'
      +'<div class="modal-btn-row">'
      +'<button class="modal-btn" onclick="closeModal()">Cancel</button>'
      +'<button class="modal-btn primary" id="confirm-import-btn">&#128229; Import Exam</button>'
      +'</div>'
    );
    // Attach confirm handler
    setTimeout(function(){
      var btn = Q('confirm-import-btn');
      if(btn) btn.addEventListener('click', function(){
        var statusEl = document.querySelector('input[name="import-status"]:checked');
        var status = statusEl ? statusEl.value : 'draft';
        doImportExam(data, status);
      });
    }, 30);
    event.target.value='';
  };
  reader.onerror = function(){ toast('Could not read file.','error'); event.target.value=''; };
  reader.readAsText(file);
}

function doImportExam(data, status){
  closeModal();
  loading(true,'Importing exam...');
  var id = Date.now().toString();
  var exam = {
    id: id,
    name: data.name,
    timer: data.timer||0,
    maxScore: data.maxScore||100,
    passScore: data.passScore||50,
    editCode: data.editCode||'',
    createdBy: currentUser.name,
    createdById: currentUser.id,
    questions: data.questions.map(function(q){
      return {
        text: q.text,
        opts: q.opts.slice(0,4),
        correct: q.correct.toUpperCase(),
        image: q.image||null
      };
    }),
    studentProgress: {},
    status: status
  };
  saveExamDoc(exam).then(function(){
    toast('Exam imported successfully as '+status+'!');
    loading(false);
    renderTeacherExams();
  }).catch(function(e){ toast('Import failed: '+e.message,'error'); loading(false); });
}

function deleteExamConfirm(id,name){
  showModal('<div class="modal-title">Delete Exam</div><div class="modal-sub">Delete <strong>'+esc(name)+'</strong>?</div>'
    +'<div class="modal-btn-row"><button class="modal-btn" onclick="closeModal()">Cancel</button>'
    +'<button class="modal-btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" data-delexam2="'+id+'">Delete</button></div>');
  setTimeout(function(){var btn=document.querySelector('[data-delexam2]');if(btn)btn.addEventListener('click',function(){doDeleteExam(id);});},30);
}
function doDeleteExam(id){closeModal();loading(true,'Deleting...');deleteExamById(id).then(function(){toast('Exam deleted.');loading(false);renderTeacherExams();}).catch(function(e){toast('Error: '+e.message,'error');loading(false);});}
function exportExam(id){loadExams().then(function(){var ex=_exams.find(function(e){return e.id===id;});if(!ex)return;var blob=new Blob([JSON.stringify(ex,null,2)],{type:'application/json'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=ex.name.replace(/[^a-z0-9]/gi,'_')+'.json';a.click();toast('Exported!');});}
function renderTeacherScores(){
  var cont=Q('teacher-scores-body');
  cont.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3)">Loading...</div>';
  Promise.all([loadUsers(),loadExams()]).then(function(){
    var students=_users.filter(function(u){return u.role==='student';});
    var rows='';
    students.forEach(function(stu){_exams.forEach(function(ex){var prog=(ex.studentProgress||{})[stu.id];if(prog){var pct=ex.questions.length>0?Math.round((prog.correct/ex.questions.length)*100):0;rows+='<tr><td>'+esc(stu.name)+'</td><td>'+esc(ex.name)+'</td><td style="font-weight:700;color:'+(prog.passed?'var(--success)':'var(--danger)')+'">'+prog.score+'/'+ex.maxScore+'</td><td>'+pct+'%</td><td><span class="chip-pass '+(prog.passed?'pass':'fail')+'">'+(prog.passed?'&#10003; Pass':'&#10005; Fail')+'</span></td><td style="font-size:11px;color:var(--text3)">'+(prog.submittedAt?new Date(prog.submittedAt).toLocaleDateString():'-')+'</td></tr>';}});});
    cont.innerHTML=rows?'<div style="overflow-x:auto;background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);border:1px solid var(--border2)"><table class="scores-table"><thead><tr><th>Student</th><th>Exam</th><th>Score</th><th>%</th><th>Result</th><th>Date</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
      :'<div class="empty-state"><div class="empty-icon">&#128202;</div><div class="empty-title">No Scores Yet</div></div>';
  }).catch(function(){cont.innerHTML='<div class="empty-state"><div class="empty-title">Error</div></div>';});
}

// STUDENT
function enterStudentDash(){Q('student-uname').textContent=currentUser.name;Q('stu-greeting').textContent='Welcome, '+currentUser.name+' &#127891;';stuTab('home');showScreen('student-dash');}
function stuTab(tab){
  document.querySelectorAll('[id^="stb-"]').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.stu-panel').forEach(function(p){p.classList.remove('active');});
  if(Q('stb-'+tab))Q('stb-'+tab).classList.add('active');
  if(Q('stu-panel-'+tab))Q('stu-panel-'+tab).classList.add('active');
  if(tab==='exams')renderStuExams();
  if(tab==='notes')renderStuNotes();
  if(tab==='results')renderStuResults();
}
function renderStuExams(){
  var cont=Q('stu-exam-list');
  cont.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3)">Loading...</div>';
  loadExams().then(function(){
    if(!_exams.length){cont.innerHTML='<div class="empty-state"><div class="empty-icon">&#9997;</div><div class="empty-title">No Exams Available</div></div>';return;}
    // Show ALL exams (published + draft), but drafts are locked
    var html=_exams.map(function(ex){
      var isDraft=!ex.status||ex.status==='draft';
      var prog=(ex.studentProgress||{})[currentUser.id];var done=!!(prog&&prog.completed);
      if(isDraft){
        // Draft — grayed out, unavailable
        return '<div class="exam-card-stu draft" data-examclick="'+ex.id+'" data-draft="true" style="cursor:not-allowed;">'
          +'<div><div class="ecs-name">'+esc(ex.name)+'</div>'
          +'<div class="ecs-chips"><span class="chip navy">'+ex.questions.length+' Q</span><span class="chip navy">Max '+ex.maxScore+'</span>'
          +'<span class="draft-badge">&#128274; Not Available</span></div></div>'
          +'<span style="font-size:11px;color:var(--text3);">Coming soon</span>'
          +'</div>';
      }
      var timerChip=ex.timer?'<span class="chip gold">&#9201; '+ex.timer+'m</span>':'';
      var doneChip=done?'<span class="chip done">&#10003; Completed</span>':'';
      var passSpan=done?'<span style="font-size:11px;font-weight:700;color:'+(prog.passed?'var(--success)':'var(--danger)')+';">'+(prog.passed?'&#10003; Passed':'&#10005; Failed')+'</span>':'';
      var startBtn=done?'':'<button class="btn-gold" data-startexam="'+ex.id+'" style="flex-shrink:0;padding:9px 18px;font-size:12px;">Start &#8594;</button>';
      return '<div class="exam-card-stu'+(done?' done':'')+'" data-examclick="'+ex.id+'" data-done="'+done+'" style="cursor:'+(done?'default':'pointer')+';">'
        +'<div><div class="ecs-name">'+esc(ex.name)+'</div>'
        +'<div class="ecs-chips"><span class="chip navy">'+ex.questions.length+' Q</span><span class="chip navy">Max '+ex.maxScore+'</span>'+timerChip+doneChip+'</div></div>'
        +(done?passSpan:startBtn)+'</div>';
    }).join('');
    if(!html.trim()){cont.innerHTML='<div class="empty-state"><div class="empty-icon">&#9997;</div><div class="empty-title">No Exams Available</div></div>';return;}
    cont.innerHTML=html;
    cont.addEventListener('click',function(e){
      var card=e.target.closest('[data-examclick]');if(!card)return;
      if(card.getAttribute('data-draft')==='true'){
        showModal('<div style="text-align:center"><div style="font-size:38px;margin-bottom:10px">&#128274;</div><div class="modal-title" style="text-align:center">Not Available Yet</div><div class="modal-sub" style="text-align:center">This exam has not been published by your teacher yet.<br>Please check back later.</div><button class="modal-btn primary" onclick="closeModal()">OK</button></div>');
        return;
      }
      var sb=e.target.closest('[data-startexam]');
      if(sb){e.stopPropagation();startExamFlow(sb.getAttribute('data-startexam'));return;}
      if(card.getAttribute('data-done')==='true')showUnavailableStu(card.getAttribute('data-examclick'));
      else startExamFlow(card.getAttribute('data-examclick'));
    });
  }).catch(function(){cont.innerHTML='<div class="empty-state"><div class="empty-title">Error</div></div>';});
}
function showUnavailableStu(id){loadExams().then(function(){var ex=_exams.find(function(e){return e.id===id;});if(!ex)return;showModal('<div style="text-align:center"><div style="font-size:38px;margin-bottom:10px">&#128274;</div><div class="modal-title" style="text-align:center">Exam Completed</div><div class="modal-sub" style="text-align:center">'+esc(ex.name)+' has already been submitted. Contact your teacher or admin to reset.</div><button class="modal-btn primary" onclick="closeModal()">Got it</button></div>');});}
function renderStuNotes(){
  var cont=Q('stu-notes-list');
  cont.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3)">Loading...</div>';
  loadNotes().then(function(){
    if(!_notes.length){cont.innerHTML='<div class="empty-state"><div class="empty-icon">&#128196;</div><div class="empty-title">No Notes Available</div></div>';return;}
    cont.innerHTML=_notes.map(function(n){return '<div class="note-card-stu"><div style="font-size:26px">'+fileIcon(n.name)+'</div><div style="flex:1;min-width:80px"><div style="font-weight:700;font-size:13px;color:var(--navy)">'+esc(n.name)+'</div><div style="font-size:10px;color:var(--text3)">'+fmtSize(n.size)+' &middot; '+(n.uploadedBy||'Teacher')+'</div></div><button class="btn-dl" data-noteid="'+n.id+'">&#11015; Download</button></div>';}).join('');
    cont.addEventListener('click',function(e){var db2=e.target.closest('[data-noteid]');if(db2)downloadNote(db2.getAttribute('data-noteid'));});
  }).catch(function(){cont.innerHTML='<div class="empty-state"><div class="empty-title">Error</div></div>';});
}
function renderStuResults(){
  var cont=Q('stu-results-list');
  cont.innerHTML='<div style="padding:12px;text-align:center;color:var(--text3)">Loading...</div>';
  loadExams().then(function(){
    var completed=_exams.filter(function(e){return (e.studentProgress||{})[currentUser.id]&&(e.studentProgress||{})[currentUser.id].completed;});
    if(!completed.length){cont.innerHTML='<div class="empty-state"><div class="empty-icon">&#128202;</div><div class="empty-title">No Results Yet</div></div>';return;}
    cont.innerHTML=completed.map(function(ex){
      var prog=(ex.studentProgress||{})[currentUser.id];var pct=ex.questions.length>0?Math.round((prog.correct/ex.questions.length)*100):0;
      var reviewBtn=(reviewUnlocked&&prog.lastAnswers)?'<button class="btn-sm primary" data-review="'+ex.id+'" style="margin-top:12px">&#128214; View Corrections</button>':'';
      return '<div class="rcs"><div class="rcs-top"><div><div class="rcs-name">'+esc(ex.name)+'</div><div style="font-size:10px;color:var(--text3)">'+(prog.submittedAt?new Date(prog.submittedAt).toLocaleString():'')+'</div></div>'
        +'<div style="text-align:right"><div class="rcs-score" style="color:'+(prog.passed?'var(--success)':'var(--danger)')+'">'+prog.score+'/'+ex.maxScore+'</div>'
        +'<span class="chip-pass '+(prog.passed?'pass':'fail')+'">'+(prog.passed?'&#10003; Passed':'&#10005; Failed')+'</span></div></div>'
        +'<div class="rcs-bars"><div class="rcs-bar"><div class="rcs-val">'+prog.correct+'</div><div class="rcs-lbl">Correct</div></div>'
        +'<div class="rcs-bar"><div class="rcs-val">'+(ex.questions.length-prog.correct)+'</div><div class="rcs-lbl">Wrong</div></div>'
        +'<div class="rcs-bar"><div class="rcs-val">'+pct+'%</div><div class="rcs-lbl">Accuracy</div></div></div>'
        +reviewBtn+'</div>';
    }).join('');
    cont.addEventListener('click',function(e){var rb=e.target.closest('[data-review]');if(rb)openReviewModal(rb.getAttribute('data-review'));});
  }).catch(function(){cont.innerHTML='<div class="empty-state"><div class="empty-title">Error</div></div>';});
}
function openReviewModal(examId){loadExams().then(function(){var ex=_exams.find(function(e){return e.id===examId;});if(!ex)return;var prog=(ex.studentProgress||{})[currentUser.id];if(!prog||!prog.lastAnswers)return;showModal('<div style="max-height:72vh;overflow-y:auto"><div class="modal-title">&#128214; '+esc(ex.name)+'</div><div style="margin-top:12px">'+buildReviewHTML(ex,prog.lastAnswers)+'</div><button class="modal-btn primary" onclick="closeModal()" style="width:100%;margin-top:14px">Close</button></div>');});}


// INIT
(function(){
  var style=document.createElement('style');
  style.textContent='@keyframes spin{to{transform:rotate(360deg);}}';
  document.head.appendChild(style);
  var ok=tryAutoConnect();
  initBanner();
  var params=new URLSearchParams(window.location.search);
  var requestedScreen=params.get('screen');
  if(requestedScreen&&Q(requestedScreen)){
    showScreen(requestedScreen);
  }else{
    showScreen(ok?'role-select':'landing');
  }
})();
