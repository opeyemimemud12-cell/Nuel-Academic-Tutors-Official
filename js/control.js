// CONTROL: correction visibility, teacher answer review, live exam tracking + admin "End Exams"
// Firestore usage:
//   config/correction_visibility        -> { value: true | false }   (default OFF when never set)
//   active_sessions/{studentId}         -> one doc per student currently writing an exam

// ───────── Correction visibility (admin) ─────────
function paintCorrectionStatus(on){
  var line=Q('correction-status-line');
  if(line)line.innerHTML='Correction visibility for students: <strong style="color:'+(on?'var(--success)':'var(--danger)')+'">'+(on?'ON':'OFF')+'</strong>';
  var st=Q('correction-tab-status');
  if(st){
    st.innerHTML=on
      ?'<div style="display:flex;align-items:center;gap:10px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:var(--radius-sm);padding:12px 16px;"><span style="font-size:20px;">&#128065;</span><div><div style="font-weight:700;font-size:13px;color:var(--ink);">Corrections are ON</div><div style="font-size:12px;color:var(--text3);">Students can see right and wrong answers.</div></div></div>'
      :'<div style="display:flex;align-items:center;gap:10px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-sm);padding:12px 16px;"><span style="font-size:20px;">&#128683;</span><div><div style="font-weight:700;font-size:13px;color:var(--ink);">Corrections are OFF</div><div style="font-size:12px;color:var(--text3);">Students only see their score.</div></div></div>';
  }
  var btn=Q('correction-toggle-btn');
  if(btn){btn.textContent=on?'Turn Corrections OFF':'Turn Corrections ON';btn.style.background=on?'var(--danger)':'';}
}
function refreshCorrectionStatus(){return getConfig('correction_visibility').then(function(v){paintCorrectionStatus(v===true);return v===true;});}
function renderCorrectionTab(){refreshCorrectionStatus();}
function toggleCorrectionVisibility(){
  loading(true,'Updating...');
  getConfig('correction_visibility').then(function(v){
    var next=!(v===true);
    return setConfig('correction_visibility',next).then(function(){paintCorrectionStatus(next);logAudit('correction_visibility','Corrections turned '+(next?'ON':'OFF'));toast('Corrections turned '+(next?'ON':'OFF')+'.');});
  }).catch(function(e){toast('Error: '+e.message,'error');}).then(function(){loading(false);});
}

// ───────── Teacher: view a student's answers (always allowed) ─────────
function openTeacherReview(examId,stuId){
  Promise.all([loadExams(),loadUsers()]).then(function(){
    var ex=_exams.find(function(e){return e.id===examId;});
    var stu=_users.find(function(u){return u.id===stuId;});
    if(!ex||!stu)return;
    var prog=(ex.studentProgress||{})[stuId];
    if(!prog||!prog.lastAnswers){toast('No saved answers for this attempt.','error');return;}
    showModal('<div style="max-height:72vh;overflow-y:auto"><div class="modal-title">&#128214; '+esc(stu.name)+'</div>'
      +'<div class="modal-sub">'+esc(ex.name)+' &middot; '+prog.score+'/'+ex.maxScore+' &middot; '+(prog.passed?'Passed':'Failed')+'</div>'
      +'<div style="margin-top:12px">'+buildReviewHTML(ex,prog.lastAnswers,"Student's pick")+'</div>'
      +'<button class="modal-btn primary" onclick="closeModal()" style="width:100%;margin-top:14px">Close</button></div>');
  }).catch(function(e){toast('Error: '+e.message,'error');});
}

// ───────── Student side: live session tracking ─────────
var _sessUnsub=null,_sessBeat=null,_sessUid=null;
function startSessionTracking(ex,name){
  stopSessionTracking();
  if(!db||!currentUser)return;
  _sessUid=String(currentUser.id);
  window.__endedByAdmin=false;
  var ref=db.collection('active_sessions').doc(_sessUid);
  ref.set({studentId:_sessUid,studentName:currentUser.name||name,candidate:name,examId:ex.id,examName:ex.name,
    startedAt:new Date().toISOString(),lastSeen:Date.now(),endRequested:false,deviceId:getDeviceId()},{merge:true}).catch(function(){});
  _sessBeat=setInterval(function(){ref.set({lastSeen:Date.now()},{merge:true}).catch(function(){});},15000);
  _sessUnsub=ref.onSnapshot(function(d){
    if(!d.exists)return;
    var data=d.data()||{};
    if(data.endRequested&&!examSubmitted&&!examSubmitInFlight){
      window.__endedByAdmin=true;
      proctor.stop('ended-by-admin');
      submitExam(true);
    }
  },function(){});
}
function stopSessionTracking(){
  if(_sessUnsub){try{_sessUnsub();}catch(e){}_sessUnsub=null;}
  if(_sessBeat){clearInterval(_sessBeat);_sessBeat=null;}
  if(db&&_sessUid){db.collection('active_sessions').doc(_sessUid).delete().catch(function(){});}
  _sessUid=null;
}

// ───────── Admin: End Exams ─────────
var _activeUnsub=null,_activeDocs=[],_activeTick=null;
var ACTIVE_FRESH_MS=45000; // a student counts as "writing" if their heartbeat is newer than this
function stopEndExamsListener(){
  if(_activeUnsub){try{_activeUnsub();}catch(e){}_activeUnsub=null;}
  if(_activeTick){clearInterval(_activeTick);_activeTick=null;}
}
function freshActive(){return _activeDocs.filter(function(s){return Date.now()-(s.lastSeen||0)<ACTIVE_FRESH_MS;});}
function renderEndExamsTab(){
  stopEndExamsListener();
  var cont=Q('active-exams-body');if(!cont)return;
  if(!db){cont.innerHTML='<div class="empty-state"><div class="empty-title">Not connected</div></div>';return;}
  cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">Loading...</div>';
  _activeUnsub=db.collection('active_sessions').onSnapshot(function(snap){
    _activeDocs=snap.docs.map(function(d){return Object.assign({id:d.id},d.data());});
    paintActiveExams();
  },function(e){cont.innerHTML='<div class="empty-state"><div class="empty-title">Error: '+esc(e.message)+'</div></div>';});
  _activeTick=setInterval(paintActiveExams,10000); // re-evaluate staleness
  if(!cont._endBound){cont._endBound=true;cont.addEventListener('click',function(e){var b=e.target.closest('[data-endstu]');if(b)endExamsConfirm(b.getAttribute('data-endstu'));});}
}
function paintActiveExams(){
  var cont=Q('active-exams-body');if(!cont)return;
  var list=freshActive();
  if(!list.length){cont.innerHTML='<div class="empty-state"><div class="empty-icon">&#128564;</div><div class="empty-title">No one is writing an exam right now</div></div>';return;}
  cont.innerHTML=list.map(function(s){
    var mins=Math.max(0,Math.floor((Date.now()-new Date(s.startedAt).getTime())/60000));
    return '<div class="uli"><div class="uli-av student">'+esc(s.studentName||'?').charAt(0).toUpperCase()+'</div>'
      +'<div class="uli-info"><div class="uli-name">'+esc(s.studentName)+(s.endRequested?' <span class="draft-badge">Ending...</span>':'')+'</div>'
      +'<div class="uli-meta">'+esc(s.examName)+' &middot; started '+mins+' min ago</div></div>'
      +'<button class="uli-del" style="width:auto;padding:0 12px;font-size:12px;font-weight:700;" data-endstu="'+esc(s.id)+'"'+(s.endRequested?' disabled':'')+'>End</button></div>';
  }).join('');
}
function endExamsConfirm(stuId){
  var list=freshActive();
  var targets=stuId?list.filter(function(s){return s.id===stuId;}):list;
  if(!targets.length){toast('No active exams to end.','error');return;}
  var msg=stuId?'End the exam for <strong>'+esc(targets[0].studentName)+'</strong>?':'End the exams of <strong>'+targets.length+' student'+(targets.length!==1?'s':'')+'</strong> who are writing right now?';
  showModal('<div class="modal-title">End Exam'+(stuId?'':'s')+'</div><div class="modal-sub">'+msg+'<br>Their answers so far will be submitted and marked.</div>'
    +'<div class="modal-btn-row"><button class="modal-btn" onclick="closeModal()">Cancel</button>'
    +'<button class="modal-btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" id="end-exam-go">Yes, End</button></div>');
  setTimeout(function(){var b=Q('end-exam-go');if(b)b.addEventListener('click',function(){doEndExams(targets.map(function(s){return s.id;}));});},30);
}
function doEndExams(ids){
  closeModal();loading(true,'Ending exams...');
  Promise.all(ids.map(function(id){return db.collection('active_sessions').doc(String(id)).set({endRequested:true,endedAt:new Date().toISOString()},{merge:true});}))
    
    .then(function(){logAudit('end_exams','Ended '+ids.length+' active exam(s)');toast('End signal sent to '+ids.length+' student'+(ids.length!==1?'s':'')+'.');})
    .catch(function(e){toast('Error: '+e.message,'error');})
    .then(function(){loading(false);});
}

// ───────── Per-exam settings helpers (schedule, allowed students, start code, shuffle, fullscreen) ─────────
function examWindowState(ex){
  var now=Date.now(),o=ex.opensAt?new Date(ex.opensAt).getTime():0,cl=ex.closesAt?new Date(ex.closesAt).getTime():0;
  if(o&&now<o)return{state:'upcoming',label:'Opens '+new Date(o).toLocaleString()};
  if(cl&&now>cl)return{state:'closed',label:'Closed '+new Date(cl).toLocaleString()};
  return{state:'open',label:''};
}
function readDT(id){var el=Q(id);return el&&el.value?new Date(el.value).toISOString():'';}
function writeDT(id,iso){
  var el=Q(id);if(!el)return;
  if(!iso){el.value='';return;}
  var d=new Date(iso),p=function(n){return String(n).padStart(2,'0');};
  el.value=d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());
}
window._allowedPending=null;
function renderAllowedStudents(selected){
  var box=Q('ex-allowed-list');if(!box)return;
  window._allowedPending=selected||[];
  box.innerHTML='<span style="color:var(--text3)">Loading students...</span>';
  loadUsers().then(function(){
    var stu=_users.filter(function(u){return u.role==='student';});
    if(!stu.length){box.innerHTML='<span style="color:var(--text3)">No students yet.</span>';window._allowedPending=null;return;}
    box.innerHTML=stu.map(function(u){
      return '<label style="display:flex;align-items:center;gap:8px;padding:3px 0;cursor:pointer;"><input type="checkbox" class="ex-allow-cb" value="'+esc(u.id)+'"'+(window._allowedPending.indexOf(u.id)>-1?' checked':'')+'> '+esc(u.name)+' <span style="color:var(--text3);font-size:11px;">'+esc(u.email)+'</span></label>';
    }).join('');
    window._allowedPending=null;
  }).catch(function(){box.innerHTML='<span style="color:var(--danger)">Could not load students.</span>';});
}
function collectAllowed(){
  var boxes=document.querySelectorAll('.ex-allow-cb');
  if(!boxes.length&&window._allowedPending)return window._allowedPending.slice();
  var out=[];boxes.forEach(function(b){if(b.checked)out.push(b.value);});return out;
}
function resetExamExtras(){
  writeDT('ex-opens','');writeDT('ex-closes','');
  if(Q('ex-startcode'))Q('ex-startcode').value='';
  if(Q('ex-shuffle'))Q('ex-shuffle').checked=true;
  if(Q('ex-fullscreen'))Q('ex-fullscreen').checked=false;
  renderAllowedStudents([]);
}
function fillExamExtras(ex){
  writeDT('ex-opens',ex.opensAt);writeDT('ex-closes',ex.closesAt);
  if(Q('ex-startcode'))Q('ex-startcode').value=ex.startCode||'';
  if(Q('ex-shuffle'))Q('ex-shuffle').checked=ex.shuffle!==false;
  if(Q('ex-fullscreen'))Q('ex-fullscreen').checked=!!ex.requireFullscreen;
  renderAllowedStudents(ex.allowedStudents||[]);
}
