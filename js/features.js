// FEATURES: overview dashboard, announcement banner, maintenance mode, suspend/reactivate accounts, extra time per student
// Firestore usage:
//   config/announcement  -> { value: { text, level:'info'|'warning', active, updatedAt } }
//   config/maintenance   -> { value: { on, message, updatedAt, by } }
//   users/{id}.suspended -> true | false
//   exams/{id}.extraTime -> { studentId: extraMinutes }


// ───────── Styles for the new screens (injected here so they work even if styles.css is cached or not uploaded) ─────────
(function(){
  if(document.getElementById('feat-css'))return;
  var st=document.createElement('style');st.id='feat-css';
  st.textContent=[
    '.announce-bar{position:fixed;left:0;right:0;bottom:0;z-index:850;display:flex;align-items:center;gap:10px;padding:10px 14px;font-size:13px;font-weight:600;box-shadow:0 -4px 16px rgba(0,0,0,0.18);}',
    '.announce-bar.info{background:#0a1628;color:#fff;border-top:3px solid #d4a017;}',
    '.announce-bar.warn{background:#b45309;color:#fff;border-top:3px solid #fbbf24;}',
    '.announce-bar .ann-tx{flex:1;min-width:0;line-height:1.4;}',
    '.announce-bar .ann-x{background:none;border:none;color:inherit;font-size:22px;line-height:1;cursor:pointer;opacity:0.75;padding:0 4px;}',
    'body.has-announce{padding-bottom:52px;}',
    '.ov-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;}',
    '.ov-card{background:var(--white);border:1px solid var(--border2);border-radius:var(--radius,14px);box-shadow:var(--shadow);padding:16px 14px;min-width:0;}',
    '.ov-val{font-size:28px;font-weight:800;line-height:1.1;}',
    '.ov-lbl{font-size:12px;font-weight:700;color:var(--text2);margin-top:6px;}',
    '.ov-sub{font-size:11px;color:var(--text3);margin-top:2px;}',
    '.ov-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;}',
    '.ov-chip{background:var(--cream);border:1px solid var(--border2);border-radius:20px;padding:5px 12px;font-size:11px;color:var(--text2);}',
    'body.exam-locked,body.exam-locked *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}'
  ].join('\n');
  document.head.appendChild(st);
})();

var _announce=null,_maint=null,_myDoc=null,_myLoaded=false;
var DEFAULT_MAINT_MSG='We are making improvements to the platform. Please check back soon.';

// ───────── Status line shown on every admin tab ─────────
function paintStatusLine(){
  var line=Q('correction-status-line');if(!line)return;
  var corr=window._corrOn;
  var parts=[];
  parts.push('Corrections: <strong style="color:'+(corr?'var(--success)':'var(--danger)')+'">'+(corr===null||corr===undefined?'...':(corr?'ON':'OFF'))+'</strong>');
  var m=!!(_maint&&_maint.on);
  parts.push('Maintenance: <strong style="color:'+(m?'var(--danger)':'var(--text3)')+'">'+(m?'ON':'OFF')+'</strong>');
  var a=!!(_announce&&_announce.active&&_announce.text);
  parts.push('Announcement: <strong style="color:'+(a?'var(--success)':'var(--text3)')+'">'+(a?'LIVE':'none')+'</strong>');
  line.innerHTML=parts.join(' &nbsp;&middot;&nbsp; ');
}

// ───────── Live watcher: announcement, maintenance, suspension (real-time, no polling) ─────────
var _watch={on:false,unsubs:[],uid:null};
function activeScreenId(){var s=document.querySelector('.screen.active');return s?s.id:'';}
function siteWatchStop(){
  _watch.unsubs.forEach(function(u){try{u();}catch(e){}});
  _watch.unsubs=[];_watch.on=false;_watch.uid=null;_myDoc=null;_myLoaded=false;
  _announce=null;_maint=null;   // forget stale state so the next sign-in starts clean
  renderBanner();
}
function siteWatchStart(){
  if(!db||_watch.on||!currentRole)return;
  _watch.on=true;_watch.uid=(currentUser&&currentUser.id)?String(currentUser.id):null;_myDoc=null;_myLoaded=false;
  _watch.unsubs.push(db.collection('config').doc('announcement').onSnapshot(function(d){
    _announce=d.exists?d.data().value:null;renderBanner();paintStatusLine();paintSiteTab();
  },function(){}));
  _watch.unsubs.push(db.collection('config').doc('maintenance').onSnapshot(function(d){
    _maint=d.exists?d.data().value:null;paintStatusLine();paintSiteTab();enforceAccess();
  },function(){}));
  if(currentRole!=='admin'&&_watch.uid){
    _watch.unsubs.push(db.collection('users').doc(_watch.uid).onSnapshot(function(d){
      _myLoaded=true;_myDoc=d.exists?d.data():null;enforceAccess();
    },function(){}));
  }
}
function siteWatchSync(){
  try{
    if(currentRole&&!_watch.on)siteWatchStart();
    else if(!currentRole&&_watch.on)siteWatchStop();
    else if(currentRole&&_watch.on&&currentRole!=='admin'&&String(currentUser&&currentUser.id)!==_watch.uid){siteWatchStop();siteWatchStart();}
    renderBanner();enforceAccess();
  }catch(e){}
}
// run on every screen change, plus a cheap local check every 3s
(function(){
  var _ss=showScreen;
  showScreen=function(id){_ss(id);siteWatchSync();};
  setInterval(siteWatchSync,3000);
})();

function forceSignOut(title,msg){
  logout();
  setTimeout(function(){
    showModal('<div style="text-align:center;font-size:34px;margin-bottom:8px">&#128274;</div><div class="modal-title" style="text-align:center">'+esc(title)+'</div><div class="modal-sub" style="text-align:center">'+esc(msg)+'</div><div class="modal-btn-row"><button class="modal-btn primary" onclick="closeModal()">OK</button></div>');
  },250);
}
// Kicks out suspended / deleted users and (for students) everyone during maintenance.
// Never interrupts a student who is writing an exam or looking at their fresh result.
function enforceAccess(){
  if(!currentRole||currentRole==='admin')return;
  var sid=activeScreenId();
  if(sid==='take-exam-screen'||sid==='results-screen')return;
  if(_myLoaded){
    if(!_myDoc){forceSignOut('Account removed','Your account no longer exists. Please contact the administrator.');return;}
    if(_myDoc.suspended){forceSignOut('Account suspended','Your account has been suspended. Please contact the administrator.');return;}
  }
  if(currentRole==='student'&&_maint&&_maint.on){
    forceSignOut('Under maintenance',_maint.message||DEFAULT_MAINT_MSG);
  }
}

// ───────── Announcement banner ─────────
function annDismissed(){try{return sessionStorage.getItem('nat_ann_dismiss')===String(_announce&&_announce.updatedAt||'');}catch(e){return false;}}
function renderBanner(){
  var bar=Q('announce-bar');
  var show=!!(currentRole&&_announce&&_announce.active&&_announce.text&&activeScreenId()!=='take-exam-screen'&&!annDismissed());
  if(!show){
    if(bar)bar.style.display='none';
    document.body.classList.remove('has-announce');
    return;
  }
  if(!bar){bar=document.createElement('div');bar.id='announce-bar';document.body.appendChild(bar);}
  var key=[_announce.updatedAt,_announce.level,_announce.text].join('|');
  if(bar._key!==key){
    bar._key=key;
    bar.innerHTML='<span class="ann-ic">'+(_announce.level==='warning'?'&#9888;&#65039;':'&#128226;')+'</span><span class="ann-tx">'+esc(_announce.text)+'</span><button class="ann-x" onclick="dismissAnnouncement()" title="Dismiss">&times;</button>';
  }
  bar.className='announce-bar '+(_announce.level==='warning'?'warn':'info');
  bar.style.display='flex';
  document.body.classList.add('has-announce');
}
function dismissAnnouncement(){try{sessionStorage.setItem('nat_ann_dismiss',String(_announce&&_announce.updatedAt||''));}catch(e){}renderBanner();}

// ───────── Admin: Site Controls tab (announcement + maintenance) ─────────
function renderSiteTab(){
  siteWatchSync();
  var t=Q('ann-text');if(t&&!t.value&&_announce&&_announce.text)t.value=_announce.text;
  var l=Q('ann-level');if(l&&_announce&&_announce.level)l.value=_announce.level;
  var m=Q('maint-msg');if(m&&!m.value)m.value=(_maint&&_maint.message)||'';
  paintSiteTab();
}
function paintSiteTab(){
  var as=Q('ann-status');
  if(as){
    var live=!!(_announce&&_announce.active&&_announce.text);
    as.innerHTML=live?'<span style="color:var(--success);font-weight:700">&#9679; Live</span> &mdash; everyone currently sees this banner.':'<span style="color:var(--text3)">&#9679; No announcement is showing.</span>';
  }
  var ms=Q('maint-status'),mb=Q('maint-btn');
  var on=!!(_maint&&_maint.on);
  if(ms)ms.innerHTML=on?'<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:var(--radius-sm);padding:10px 14px;font-size:13px;"><strong style="color:var(--danger)">Maintenance is ON.</strong> Students cannot sign in and idle students are signed out. Teachers and admins are not affected.</div>'
    :'<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:var(--radius-sm);padding:10px 14px;font-size:13px;"><strong style="color:var(--success)">Maintenance is OFF.</strong> The site is open to everyone.</div>';
  if(mb){mb.textContent=on?'Turn Maintenance OFF':'Turn Maintenance ON';mb.style.background=on?'':'var(--danger)';}
}
function publishAnnouncement(){
  var text=(Q('ann-text').value||'').trim();
  if(!text){toast('Type a message first.','error');return;}
  loading(true,'Publishing...');
  setConfig('announcement',{text:text.slice(0,300),level:Q('ann-level').value==='warning'?'warning':'info',active:true,updatedAt:new Date().toISOString()})
    .then(function(){logAudit('announcement_published',text.slice(0,120));toast('Announcement is live.');})
    .catch(function(e){toast('Error: '+e.message,'error');}).then(function(){loading(false);});
}
function removeAnnouncement(){
  loading(true,'Removing...');
  setConfig('announcement',{text:'',active:false,updatedAt:new Date().toISOString()})
    .then(function(){if(Q('ann-text'))Q('ann-text').value='';logAudit('announcement_removed','Announcement removed');toast('Announcement removed.');})
    .catch(function(e){toast('Error: '+e.message,'error');}).then(function(){loading(false);});
}
function toggleMaintenance(){
  var turnOn=!(_maint&&_maint.on);
  function go(){
    closeModal();loading(true,'Updating...');
    var msg=(Q('maint-msg').value||'').trim()||DEFAULT_MAINT_MSG;
    setConfig('maintenance',{on:turnOn,message:msg.slice(0,300),updatedAt:new Date().toISOString(),by:(currentUser&&currentUser.email)||''})
      .then(function(){logAudit('maintenance',turnOn?'Maintenance ON: '+msg.slice(0,100):'Maintenance OFF');toast('Maintenance turned '+(turnOn?'ON':'OFF')+'.');})
      .catch(function(e){toast('Error: '+e.message,'error');}).then(function(){loading(false);});
  }
  if(!turnOn){go();return;}
  showModal('<div class="modal-title">Turn on maintenance?</div><div class="modal-sub">Students will be blocked from signing in and idle students will be signed out. Students <strong>currently writing an exam</strong> are not interrupted (use End Exams if you need to stop them). Teachers and admins are not affected.</div>'
    +'<div class="modal-btn-row"><button class="modal-btn" onclick="closeModal()">Cancel</button><button class="modal-btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" id="maint-go">Yes, turn ON</button></div>');
  setTimeout(function(){var b=Q('maint-go');if(b)b.addEventListener('click',go);},30);
}

// ───────── Admin: suspend / reactivate accounts ─────────
function toggleSuspend(id,name,isSuspended){
  function go(){
    closeModal();loading(true,'Updating...');
    var next=!isSuspended;
    new Promise(function(res,rej){fbSet('users',id,{suspended:next,suspendedAt:next?new Date().toISOString():''},function(e){e?rej(e):res();});})
      .then(function(){
        if(!next)return;
        // if they are mid-exam, end it so their answers are submitted before they are signed out
        var ref=db.collection('active_sessions').doc(String(id));
        return ref.get().then(function(d){if(d.exists)return ref.update({endRequested:true});});
      })
      .then(function(){logAudit(next?'suspend_user':'reactivate_user',(next?'Suspended ':'Reactivated ')+name);toast(name+(next?' suspended.':' reactivated.'));renderAdminUserList();})
      .catch(function(e){toast('Error: '+e.message,'error');}).then(function(){loading(false);});
  }
  if(isSuspended){go();return;}
  showModal('<div class="modal-title">Suspend account</div><div class="modal-sub"><strong>'+esc(name)+'</strong> will be signed out and cannot log in until you reactivate them. If they are writing an exam right now, it is ended and their answers so far are submitted. Their data is kept.</div>'
    +'<div class="modal-btn-row"><button class="modal-btn" onclick="closeModal()">Cancel</button><button class="modal-btn" style="background:var(--danger);color:#fff;border-color:var(--danger);" id="susp-go">Suspend</button></div>');
  setTimeout(function(){var b=Q('susp-go');if(b)b.addEventListener('click',go);},30);
}

// ───────── Admin: Overview dashboard ─────────
var _ovTimer=null,_ovUnsub=null,_ovWriting=0;
function stopOverview(){
  if(_ovTimer){clearInterval(_ovTimer);_ovTimer=null;}
  if(_ovUnsub){try{_ovUnsub();}catch(e){}_ovUnsub=null;}
}
function renderOverviewTab(){
  stopOverview();
  var cont=Q('admin-overview-body');if(!cont)return;
  if(!db){cont.innerHTML='<div class="empty-state"><div class="empty-title">Not connected to the database</div></div>';return;}
  cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">Loading...</div>';
  loadOverview();
  _ovTimer=setInterval(loadOverview,60000);
  _ovUnsub=db.collection('active_sessions').onSnapshot(function(snap){
    _ovWriting=snap.docs.filter(function(d){return Date.now()-((d.data()||{}).lastSeen||0)<45000;}).length;
    var el=Q('ov-writing');if(el)el.textContent=_ovWriting;
  },function(){});
}
function ovCard(label,value,sub,color,id,onclick){
  return '<div class="ov-card"'+(onclick?' style="cursor:pointer" onclick="'+onclick+'"':'')+'><div class="ov-val" '+(id?'id="'+id+'" ':'')+'style="color:'+(color||'var(--ink)')+'">'+value+'</div><div class="ov-lbl">'+label+'</div>'+(sub?'<div class="ov-sub">'+sub+'</div>':'')+'</div>';
}
function loadOverview(){
  var cont=Q('admin-overview-body');if(!cont||!db)return;
  Promise.all([loadUsers(),loadExams(),db.collection('audit_log').orderBy('at','desc').limit(8).get().catch(function(){return null;})]).then(function(r){
    var audit=r[2];
    var students=_users.filter(function(u){return u.role==='student';});
    var teachers=_users.filter(function(u){return u.role==='teacher';});
    var suspended=_users.filter(function(u){return u.suspended;}).length;
    var drafts=_exams.filter(function(e){return !e.status||e.status==='draft';}).length;
    var published=_exams.length-drafts;
    var attempts=0,passed=0,pctSum=0,last24=0,dayAgo=Date.now()-86400000;
    var perExam=_exams.map(function(ex){
      var n=0,p=0,sum=0;
      Object.keys(ex.studentProgress||{}).forEach(function(k){
        var pr=ex.studentProgress[k];if(!pr||!pr.completed)return;
        n++;if(pr.passed)p++;
        var pct=ex.maxScore?(pr.score/ex.maxScore)*100:0;sum+=pct;
        if(pr.submittedAt&&new Date(pr.submittedAt).getTime()>dayAgo)last24++;
      });
      attempts+=n;passed+=p;pctSum+=sum;
      return{name:ex.name,draft:(!ex.status||ex.status==='draft'),n:n,pass:n?Math.round(p/n*100):null,avg:n?Math.round(sum/n):null};
    });
    var flagged=0;
    students.forEach(function(s){(s.sessions||[]).forEach(function(x){if(sessionFlags(x).length)flagged++;});});
    var avg=attempts?Math.round(pctSum/attempts):null,passRate=attempts?Math.round(passed/attempts*100):null;
    var corrOn=window._corrOn,maintOn=!!(_maint&&_maint.on),annOn=!!(_announce&&_announce.active&&_announce.text);

    var html='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px;flex-wrap:wrap;"><div style="font-size:11px;color:var(--text3)">Live stats &middot; updated '+new Date().toLocaleTimeString()+'</div><button class="btn-sm primary" onclick="loadOverview()">&#8635; Refresh</button></div>'
      +'<div class="ov-grid">'
      +ovCard('Writing exams now',_ovWriting,'live','var(--gold)','ov-writing','adminTab(\'end-exams\')')
      +ovCard('Students',students.length,suspended?suspended+' suspended (all users)':'')
      +ovCard('Teachers',teachers.length,'')
      +ovCard('Exams',_exams.length,published+' published &middot; '+drafts+' draft')
      +ovCard('Submissions',attempts,last24+' in the last 24h')
      +ovCard('Average score',avg===null?'&mdash;':avg+'%','')
      +ovCard('Pass rate',passRate===null?'&mdash;':passRate+'%','',passRate===null?'':(passRate>=50?'var(--success)':'var(--danger)'))
      +ovCard('Flagged attempts',flagged,'open Session Log',flagged?'var(--danger)':'var(--ink)','','adminTab(\'session-log\')')
      +'</div>'
      +'<div class="ov-chips">'
      +'<span class="ov-chip">Corrections: <b style="color:'+(corrOn?'var(--success)':'var(--danger)')+'">'+(corrOn?'ON':'OFF')+'</b></span>'
      +'<span class="ov-chip">Maintenance: <b style="color:'+(maintOn?'var(--danger)':'var(--text3)')+'">'+(maintOn?'ON':'OFF')+'</b></span>'
      +'<span class="ov-chip">Announcement: <b style="color:'+(annOn?'var(--success)':'var(--text3)')+'">'+(annOn?'LIVE':'none')+'</b></span>'
      +'</div>';

    perExam.sort(function(a,b){return b.n-a.n;});
    html+='<div class="section-title" style="margin-top:22px">Exams at a glance</div>';
    html+=perExam.length?'<div style="overflow-x:auto;background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);border:1px solid var(--border2)"><table class="scores-table"><thead><tr><th>Exam</th><th>Status</th><th>Submissions</th><th>Avg score</th><th>Pass rate</th></tr></thead><tbody>'
      +perExam.slice(0,10).map(function(e){return '<tr><td style="font-weight:600">'+esc(e.name)+'</td><td style="font-size:11px">'+(e.draft?'Draft':'Published')+'</td><td>'+e.n+'</td><td>'+(e.avg===null?'&mdash;':e.avg+'%')+'</td><td>'+(e.pass===null?'&mdash;':e.pass+'%')+'</td></tr>';}).join('')
      +'</tbody></table></div>':'<div class="empty-state"><div class="empty-title">No exams yet</div></div>';

    html+='<div class="section-title" style="margin-top:22px">Recent activity</div>';
    if(audit&&!audit.empty){
      html+='<div style="background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);border:1px solid var(--border2);padding:6px 14px;">'
        +audit.docs.map(function(d){var x=d.data();return '<div style="padding:8px 0;border-bottom:1px solid var(--border2);font-size:12px;"><span style="font-weight:700;color:var(--ink)">'+esc(x.action)+'</span> <span style="color:var(--text3)">&middot; '+esc(x.by)+' &middot; '+esc(new Date(x.at).toLocaleString())+'</span><div style="color:var(--text3);font-size:11px;margin-top:2px">'+esc(x.detail)+'</div></div>';}).join('')+'</div>';
    }else html+='<div class="empty-state"><div class="empty-title">No activity logged yet</div></div>';
    cont.innerHTML=html;
  }).catch(function(e){cont.innerHTML='<div class="empty-state"><div class="empty-title">Error: '+esc(e.message)+'</div></div>';});
}

// ───────── Teacher: extra time per student (exam form) ─────────
window._extraPending=null;
function renderExtraTime(map){
  var box=Q('ex-extra-list');if(!box)return;
  window._extraPending=Object.assign({},map||{});
  box.innerHTML='<span style="color:var(--text3)">Loading students...</span>';
  loadUsers().then(function(){
    var stu=_users.filter(function(u){return u.role==='student';});
    if(!stu.length){box.innerHTML='<span style="color:var(--text3)">No students yet.</span>';window._extraPending=null;return;}
    box.innerHTML=stu.map(function(u){
      return '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;"><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(u.name)+'</span>'
        +'<input type="number" min="0" max="600" class="ex-extra-inp" data-id="'+esc(u.id)+'" value="'+((window._extraPending&&window._extraPending[u.id])||0)+'" style="width:76px;padding:5px 8px;border:1.5px solid var(--border2);border-radius:6px;font-family:inherit;"> <span style="font-size:11px;color:var(--text3)">min</span></div>';
    }).join('');
    window._extraPending=null;
  }).catch(function(){box.innerHTML='<span style="color:var(--danger)">Could not load students.</span>';});
}
// Returns { studentId: minutes } for every listed student (0 = none), so that clearing a value really overwrites the old one
function collectExtraTime(){
  var inps=document.querySelectorAll('.ex-extra-inp');
  if(!inps.length&&window._extraPending)return Object.assign({},window._extraPending);
  var out={};
  inps.forEach(function(i){out[i.getAttribute('data-id')]=Math.max(0,Math.min(600,parseInt(i.value,10)||0));});
  return out;
}
