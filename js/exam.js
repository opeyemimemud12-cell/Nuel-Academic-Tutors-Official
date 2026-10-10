// PROCTOR
var MAX_FREE_SWITCHES=1;   // tab switches allowed (with a warning) before the exam is auto-submitted
var MAX_FREE_FS_EXITS=1;   // fullscreen exits allowed (with a warning) before auto-submit
function shuffleArr(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function enterExamFullscreen(){var el=document.documentElement;var f=el.requestFullscreen||el.webkitRequestFullscreen;if(f){try{var p=f.call(el);if(p&&p.catch)p.catch(function(){});}catch(e){}}}
function exitExamFullscreen(){try{if(document.fullscreenElement||document.webkitFullscreenElement){(document.exitFullscreen||document.webkitExitFullscreen).call(document);}}catch(e){}}
function showExamWarning(html,withFsBtn){
  showModal('<div style="text-align:center;margin-bottom:10px;font-size:34px">&#9888;&#65039;</div><div class="modal-title" style="text-align:center">Warning</div><div class="modal-sub" style="text-align:center;margin-bottom:14px">'+html+'</div><div class="modal-btn-row"><button class="modal-btn primary" onclick="'+(withFsBtn?'enterExamFullscreen();':'')+'closeModal()">'+(withFsBtn?'Return to fullscreen':'OK, continue')+'</button></div>');
}
var proctor={active:false,session:null,_iw:null,_requireFs:false,
  start:function(examName,candidate,opts){this.active=true;this._requireFs=!!(opts&&opts.requireFs);this.session={candidate:candidate||'Unknown',examName:examName,startTime:new Date().toISOString(),tabSwitches:0,visibilityChanges:[],clicks:[],keystrokes:0,idlePeriods:[],lastActivity:Date.now(),blockedActions:0,fsExits:0,warnings:0};this._bind();document.body.classList.add('exam-locked');var self=this;this._iw=setInterval(function(){if(!self.active)return;var idle=Date.now()-self.session.lastActivity;if(idle>15000)self.session.idlePeriods.push({idleMs:idle,time:new Date().toISOString()});},5000);},
  stop:function(reason){if(!this.active)return;this.active=false;this._unbind();document.body.classList.remove('exam-locked');exitExamFullscreen();clearInterval(this._iw);this.session.endTime=new Date().toISOString();this.session.endReason=reason;},
  _onVis:function(){
    if(!proctor.active)return;
    var h=document.hidden;proctor.session.visibilityChanges.push({time:new Date().toISOString(),hidden:h});
    if(h){
      proctor.session.tabSwitches++;
      if(proctor.session.tabSwitches>MAX_FREE_SWITCHES&&!examSubmitted){proctor.stop('auto-submit');submitExam(true);}
    }else if(!examSubmitted&&proctor.session.tabSwitches>0&&proctor.session.tabSwitches<=MAX_FREE_SWITCHES){
      proctor.session.warnings++;
      showExamWarning('You left the exam tab. This is your warning &mdash; leaving again will <b>auto-submit</b> your exam.');
    }
  },
  _onClick:function(e){if(!proctor.active)return;proctor.session.lastActivity=Date.now();proctor.session.clicks.push({x:e.clientX,y:e.clientY});},
  _onKey:function(e){
    if(!proctor.active)return;proctor.session.lastActivity=Date.now();proctor.session.keystrokes++;
    var k=(e.key||'').toLowerCase(),mod=e.ctrlKey||e.metaKey;
    if((mod&&['c','v','x','a','p','s','u'].indexOf(k)>-1)||k==='f12'||k==='printscreen'||(mod&&e.shiftKey&&['i','j','c'].indexOf(k)>-1)){e.preventDefault();proctor.session.blockedActions++;}
  },
  _onMove:function(){if(!proctor.active)return;proctor.session.lastActivity=Date.now();},
  _onBlock:function(e){if(!proctor.active)return;e.preventDefault();proctor.session.blockedActions++;},
  _onSel:function(e){if(!proctor.active)return;e.preventDefault();},
  _onFs:function(){
    if(!proctor.active||!proctor._requireFs)return;
    if(document.fullscreenElement||document.webkitFullscreenElement)return;
    proctor.session.fsExits++;
    if(proctor.session.fsExits>MAX_FREE_FS_EXITS&&!examSubmitted){proctor.stop('auto-submit');submitExam(true);}
    else{proctor.session.warnings++;showExamWarning('You left fullscreen. This is your warning &mdash; leaving fullscreen again will <b>auto-submit</b> your exam.',true);}
  },
  _evs:['copy','cut','paste','contextmenu','dragstart'],
  _bind:function(){
    document.addEventListener('visibilitychange',proctor._onVis);document.addEventListener('click',proctor._onClick);document.addEventListener('keydown',proctor._onKey);document.addEventListener('mousemove',proctor._onMove);
    proctor._evs.forEach(function(ev){document.addEventListener(ev,proctor._onBlock);});
    document.addEventListener('selectstart',proctor._onSel);
    document.addEventListener('fullscreenchange',proctor._onFs);document.addEventListener('webkitfullscreenchange',proctor._onFs);
  },
  _unbind:function(){
    document.removeEventListener('visibilitychange',proctor._onVis);document.removeEventListener('click',proctor._onClick);document.removeEventListener('keydown',proctor._onKey);document.removeEventListener('mousemove',proctor._onMove);
    proctor._evs.forEach(function(ev){document.removeEventListener(ev,proctor._onBlock);});
    document.removeEventListener('selectstart',proctor._onSel);
    document.removeEventListener('fullscreenchange',proctor._onFs);document.removeEventListener('webkitfullscreenchange',proctor._onFs);
  }
};
// Shuffling: the student sees a shuffled copy; answers are converted back to the original question/option order on submit
var _examMap=null;
function buildExamView(ex){
  var L=['A','B','C','D'],n=ex.questions.length,shuffle=ex.shuffle!==false,qOrder=[],optMaps=[],i;
  for(i=0;i<n;i++)qOrder.push(i);
  if(shuffle)shuffleArr(qOrder);
  var vq=qOrder.map(function(oi){
    var q=ex.questions[oi],m=[0,1,2,3];
    if(shuffle)shuffleArr(m);
    optMaps.push(m);
    return Object.assign({},q,{opts:m.map(function(k){return q.opts[k];})});
  });
  _examMap={qOrder:qOrder,optMaps:optMaps};
  return Object.assign({},ex,{questions:vq});
}
function toOriginalAnswers(total){
  var L=['A','B','C','D'];
  if(!_examMap||_examMap.qOrder.length!==total||examAnswers.length!==total)return examAnswers.slice();
  var out=Array(total).fill(null);
  for(var v=0;v<total;v++){var a=examAnswers[v];if(a===null||a===undefined)continue;out[_examMap.qOrder[v]]=L[_examMap.optMaps[v][L.indexOf(a)]];}
  return out;
}
function slimSession(s){
  var o=Object.assign({},s);o.clickCount=(s.clicks||[]).length;delete o.clicks;
  var m=0;(s.idlePeriods||[]).forEach(function(p){if(p.idleMs>m)m=p.idleMs;});
  o.maxIdleMs=m;o.idleCount=(s.idlePeriods||[]).length;delete o.idlePeriods;return o;
}

// EXAM FLOW
function startExamFlow(id){
  loadExams().then(function(){
    var ex=_exams.find(function(e){return e.id===id;});if(!ex)return;
    var win=examWindowState(ex);
    if(win.state!=='open'){toast(win.label,'error');return;}
    var rules=['Leaving this tab gives <b>one warning</b>, then the exam is auto-submitted','Copy, paste and right-click are disabled','Clicks &amp; keystrokes are logged','No retake once submitted'];
    if(ex.requireFullscreen)rules.splice(1,0,'This exam runs in <b>fullscreen</b> &mdash; leaving it twice auto-submits');
    var _x=(ex.extraTime&&ex.extraTime[currentUser.id])||0;
    if(ex.timer>0&&_x>0)rules.push('You have <b>+'+_x+' min extra time</b> (total '+(ex.timer+_x)+' min)');
    var codeHtml=ex.startCode?'<div class="field" style="margin-bottom:5px;margin-top:10px"><label>Exam Code</label><input class="modal-input" type="text" id="estartcode" placeholder="Code given by your teacher" autocomplete="off"></div>':'';
    showModal('<div style="text-align:center;margin-bottom:14px;font-size:34px">&#128737;&#65039;</div>'
      +'<div class="modal-title" style="text-align:center">Anti-Cheat Notice</div>'
      +'<div class="modal-sub" style="text-align:center;margin-bottom:14px">This exam is monitored.</div>'
      +'<div style="background:var(--cream);border-radius:var(--radius-sm);padding:12px 14px;font-size:11px;line-height:2;margin-bottom:14px;border-left:3px solid var(--danger);">&#8250; '+rules.join('<br>&#8250; ')+'</div>'
      +'<div class="field" style="margin-bottom:5px"><label>Your Full Name</label>'
      +'<input class="modal-input" type="text" id="ecandname" placeholder="e.g. Chinwe Obi" autocomplete="off"></div>'
      +codeHtml
      +'<div class="modal-error" id="ecanderr"></div>'
      +'<div class="modal-btn-row"><button class="modal-btn" onclick="closeModal()">Cancel</button>'
      +'<button class="modal-btn primary" id="exam-confirm-btn">I Understand &#8212; Start</button></div>');
    setTimeout(function(){
      if(Q('ecandname'))Q('ecandname').focus();
      var btn=Q('exam-confirm-btn');if(btn)btn.addEventListener('click',function(){beginExam(id);});
      ['ecandname','estartcode'].forEach(function(i){if(Q(i))Q(i).addEventListener('keydown',function(e){if(e.key==='Enter')beginExam(id);});});
    },50);
  });
}
function beginExam(id){
  var nameInp=Q('ecandname');var name=nameInp?nameInp.value.trim():'';
  var codeInp=Q('estartcode');var code=codeInp?codeInp.value.trim():'';
  var errEl=Q('ecanderr');
  function fail(msg,el){if(el){el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');}if(errEl)errEl.textContent=msg;}
  if(!name){fail('Please enter your name.',nameInp);return;}
  var pre=_exams.find(function(e){return e.id===id;});
  var wantsFs=!!(pre&&pre.requireFullscreen);
  if(wantsFs)enterExamFullscreen();   // has to happen inside the click that starts the exam
  loadExams().then(function(){
    var ex=_exams.find(function(e){return e.id===id;});if(!ex){exitExamFullscreen();return;}
    var win=examWindowState(ex),al=ex.allowedStudents,prog=(ex.studentProgress||{})[currentUser.id],problem=null,problemEl=null;
    if(win.state!=='open')problem=win.label;
    else if(al&&al.length&&al.indexOf(currentUser.id)<0)problem='You are not assigned to this exam.';
    else if(prog&&prog.completed)problem='You have already taken this exam.';
    else if(ex.startCode&&code!==ex.startCode){problem='Incorrect exam code.';problemEl=codeInp;}
    if(problem){fail(problem,problemEl);exitExamFullscreen();return;}
    return checkOtherDevice(currentUser.id).then(function(other){
      if(other){fail('You are already writing an exam on another device or tab. Close it first, or wait about a minute.');exitExamFullscreen();return;}
      closeModal();
      currentExamId=id;_currentExamCache=buildExamView(ex);examAnswers=Array(ex.questions.length).fill(null);examQIdx=0;examSubmitted=false;reviewUnlocked=false;
      if(Q('taking-exam-name'))Q('taking-exam-name').textContent=ex.name;
      if(Q('exam-q-total'))Q('exam-q-total').textContent=ex.questions.length;
      clearExamTimer();
      var _extra=(ex.extraTime&&ex.extraTime[currentUser.id])||0;
      if(ex.timer>0){startExamTimer((ex.timer+_extra)*60);}
      else if(Q('exam-timer-el'))Q('exam-timer-el').style.display='none';
      showScreen('take-exam-screen');renderExamQ();
      proctor.start(ex.name,name,{requireFs:wantsFs});
      startSessionTracking(ex,name);
    });
  }).catch(function(e){fail('Error: '+e.message);exitExamFullscreen();});
}
var examEndsAt=0;
var examEls=null;
var _lastTimerText='';
var _lastTimerWarn=null;
function getExamEls(){
  if(examEls)return examEls;
  examEls={
    timer:Q('exam-timer-el'),
    qNum:Q('exam-q-num'),
    qTotal:Q('exam-q-total'),
    progFill:Q('exam-prog-fill'),
    qDisplay:Q('exam-question-display'),
    prevBtn:Q('exam-prev-btn'),
    nextBtn:Q('exam-next-btn'),
    submitBtn:Q('exam-submit-btn')
  };
  return examEls;
}
function startExamTimer(totalSeconds){
  clearExamTimer();
  examTimeLeft=totalSeconds;
  examEndsAt=Date.now()+(totalSeconds*1000);
  var els=getExamEls();
  if(els.timer)els.timer.style.display='block';
  _lastTimerText='';
  _lastTimerWarn=null;
  scheduleNextTimerTick();
}
function scheduleNextTimerTick(){
  updateTimerFromNow();
  if(!examEndsAt)return;
  var msLeft=Math.max(0,examEndsAt-Date.now());
  var delay=Math.max(60,msLeft%1000||1000);
  examTimer=setTimeout(scheduleNextTimerTick,delay);
}
function updateTimerFromNow(){
  if(!examEndsAt)return;
  var msLeft=Math.max(0,examEndsAt-Date.now());
  var secondsLeft=Math.ceil(msLeft/1000);
  if(secondsLeft!==examTimeLeft){
    examTimeLeft=secondsLeft;
    updateTimerEl();
  }
  if(msLeft<=0){
    clearExamTimer();
    submitExam(true);
  }
}
function updateTimerEl(){
  var m=Math.floor(examTimeLeft/60).toString().padStart(2,'0');
  var s=(examTimeLeft%60).toString().padStart(2,'0');
  var txt=m+':'+s;
  var warn=examTimeLeft<=60;
  var el=getExamEls().timer;
  if(!el)return;
  if(txt!==_lastTimerText){
    el.textContent=txt;
    _lastTimerText=txt;
  }
  if(warn!==_lastTimerWarn){
    el.className='exam-timer-el'+(warn?' warn':'');
    _lastTimerWarn=warn;
  }
}
function clearExamTimer(){if(examTimer){clearTimeout(examTimer);examTimer=null;}examEndsAt=0;}
var _currentExamCache=null;
var examSubmitInFlight=false;
var examDomInit=false;
function ensureExamDomHandlers(){if(examDomInit)return;examDomInit=true;var disp=getExamEls().qDisplay;if(disp){disp.addEventListener('click',function(e){var ab=e.target.closest('[data-ans]');if(ab&&!examSubmitted){selectAnswer(ab.getAttribute('data-ans'));}});} }
function applySelectedAnswerUI(){
  var disp=getExamEls().qDisplay;
  if(!disp)return;
  var selected=examAnswers[examQIdx];
  disp.querySelectorAll('.opt-btn[data-ans]').forEach(function(btn){
    var isSelected=btn.getAttribute('data-ans')===selected;
    btn.classList.toggle('selected',isSelected);
  });
}
function renderExamQ(){
  ensureExamDomHandlers();
  // Use cached exam to avoid re-fetch on every question nav (preserves image data)
  var useCache=_currentExamCache&&_currentExamCache.id===currentExamId;
  var doRender=function(ex){
    _currentExamCache=ex;
    var q=ex.questions[examQIdx];if(!q)return;
    var total=ex.questions.length;
    var els=getExamEls();
    if(els.qNum)els.qNum.textContent=examQIdx+1;
    if(els.progFill)els.progFill.style.width=((examQIdx+1)/total*100)+'%';
    var optHtml=q.opts.map(function(opt,i){var l=['A','B','C','D'][i];var sel=examAnswers[examQIdx]===l;return '<button class="opt-btn'+(sel?' selected':'')+'" data-ans="'+l+'"><span class="opt-key">'+l+'</span> '+esc(opt)+'</button>';}).join('');
    var imgHtml='';
    if(q.image&&q.image.length>10){imgHtml='<div style="text-align:center;margin-bottom:14px;"><img src="'+q.image+'" style="max-width:100%;max-height:240px;object-fit:contain;border-radius:var(--radius-sm);border:1px solid var(--border2);" id="exam-q-img"></div>';}
    if(els.qDisplay){
      els.qDisplay.innerHTML='<div class="qcard"><div class="qcard-head"><span class="qcard-num">Question '+(examQIdx+1)+' of '+total+'</span></div><div class="qcard-body"><div class="qcard-text">'+esc(q.text)+'</div>'+imgHtml+optHtml+'</div></div>';
      
    }
    if(els.prevBtn)els.prevBtn.disabled=examQIdx===0;
    if(els.nextBtn)els.nextBtn.style.display=examQIdx<total-1?'block':'none';
    if(els.submitBtn)els.submitBtn.style.display=examQIdx===total-1?'block':'none';
  };
  if(useCache){doRender(_currentExamCache);}
}
function selectAnswer(l){
  if(examSubmitted)return;
  if(examAnswers[examQIdx]===l)return;
  examAnswers[examQIdx]=l;
  applySelectedAnswerUI();
}
function examPrev(){if(examQIdx>0){examQIdx--;renderExamQ();}}
function examNext(){var ex=_currentExamCache||_exams.find(function(e){return e.id===currentExamId;});if(ex&&examQIdx<ex.questions.length-1){examQIdx++;renderExamQ();}}
function confirmExamBack(){if(!examSubmitted&&examAnswers.some(function(a){return a!==null;})){if(!confirm('Leave? Progress will be lost.'))return;}clearExamTimer();proctor.stop('back');stopSessionTracking();enterStudentDash();}
function submitExam(auto){
  if(examSubmitted||examSubmitInFlight)return;
  if(!auto){var u=examAnswers.filter(function(a){return a===null;}).length;if(u>0){if(!confirm(u+' question'+(u!==1?'s':'')+' unanswered. Submit anyway?'))return;}}
  examSubmitInFlight=true;
  examSubmitted=true;clearExamTimer();
  loadExams().then(function(){
    var ex=_exams.find(function(e){return e.id===currentExamId;});if(!ex)return;
    var total=ex.questions.length,correct=0;
    var finalAnswers=toOriginalAnswers(total);
    ex.questions.forEach(function(q,i){if(finalAnswers[i]===q.correct)correct++;});
    var score=Math.round((correct/total)*ex.maxScore),passed=score>=ex.passScore,pct=Math.round((correct/total)*100);
    loading(true,'Saving results...');
    var updProg=Object.assign({},ex.studentProgress);
    updProg[currentUser.id]={completed:true,lastAnswers:finalAnswers.slice(),correct:correct,score:score,passed:passed,maxScore:ex.maxScore,submittedAt:new Date().toISOString()};
    saveExamDoc(Object.assign({},ex,{studentProgress:updProg})).then(function(){
      if(proctor.session){
        return loadUsers().then(function(){
          var uDoc=_users.find(function(u){return u.id===currentUser.id;});
          if(uDoc){var sess=(uDoc.sessions||[]).concat([Object.assign({},slimSession(proctor.session),{questionCount:total,examName:ex.name,score:score,maxScore:ex.maxScore,passed:passed,submittedAt:new Date().toISOString()})]);return saveUser(Object.assign({},uDoc,{sessions:sess}));}
        });
      }
    }).then(function(){return getConfig('correction_visibility');}).then(function(vis){
      var showCorr=(vis===true);
      stopSessionTracking();
      logAudit('exam_submitted',currentUser.name+' submitted '+ex.name+' ('+score+'/'+ex.maxScore+')'+(window.__endedByAdmin?' - ended by admin':(auto?' - auto-submitted':'')),currentUser.email);
      proctor.stop(auto?'auto':'manual');
      var deg=Math.round((pct/100)*360),color=passed?'#c9a84c':'#ef4444';
      var v=Q('rh-verdict');if(v){v.textContent=passed?'Passed! &#127881;':'Not Passed';v.className='rh-verdict '+(passed?'pass':'fail');}
      if(Q('rh-sub'))Q('rh-sub').textContent='Score: '+score+'/'+ex.maxScore+' — Pass mark: '+ex.passScore;
      if(Q('rh-ring'))Q('rh-ring').style.background='conic-gradient('+color+' '+deg+'deg, rgba(10,22,40,0.3) '+deg+'deg)';
      if(Q('rh-num')){Q('rh-num').textContent=score;Q('rh-num').style.color=passed?'var(--gold)':'#fca5a5';}
      if(Q('rh-denom'))Q('rh-denom').textContent='/ '+ex.maxScore;
      if(Q('rh-correct'))Q('rh-correct').textContent=correct;
      if(Q('rh-wrong'))Q('rh-wrong').textContent=total-correct;
      if(Q('rh-pct'))Q('rh-pct').textContent=pct+'%';
      var rl=Q('review-list');if(rl){rl.innerHTML=buildReviewHTML(ex,finalAnswers);rl.classList.remove('open');}
      if(Q('review-locked-notice'))Q('review-locked-notice').style.display=showCorr?'none':'flex';
      if(Q('review-toggle-btn'))Q('review-toggle-btn').style.display=showCorr?'flex':'none';
      if(!showCorr&&rl)rl.innerHTML='';
      if(window.__endedByAdmin){toast('Your exam was ended by an administrator and your answers were submitted.','error');window.__endedByAdmin=false;}else if(auto)toast('&#9888;&#65039; Auto-submitted — tab switch detected!','error');
      loading(false);showScreen('results-screen');
      examSubmitInFlight=false;
    });
  }).catch(function(e){toast('Save error: '+e.message,'error');loading(false);examSubmitInFlight=false;stopSessionTracking();});
}
function buildReviewHTML(ex,answers,wrongTag){
  wrongTag=wrongTag||'Yours';
  return ex.questions.map(function(q,i){
    var ua=answers[i],isC=ua===q.correct,isSk=ua===null;
    var sc=isSk?'skipped':isC?'correct':'wrong',sl=isSk?'Skipped':isC?'&#10003; Correct':'&#10005; Wrong';
    var opts=q.opts.map(function(opt,oi){var l=['A','B','C','D'][oi];var isCorr=l===q.correct;var isW=l===ua&&!isC;return '<div class="rc-opt'+(isCorr?' correct':isW?' wrong':'')+'">'+'<span class="rc-opt-key">'+l+'</span><span style="flex:1">'+esc(opt)+'</span>'+(isCorr?'<span class="rc-opt-tag">&#10003; Correct</span>':isW?'<span class="rc-opt-tag">&#10005; '+wrongTag+'</span>':'')+'</div>';}).join('');
    return '<div class="rc"><div class="rc-head"><span style="font-size:10px;font-weight:700;color:var(--gold)">Q'+(i+1)+'</span><span style="flex:1;font-size:12px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:8px">'+(q.text.length>50?q.text.slice(0,50)+'...':q.text)+'</span><span class="rc-status '+sc+'">'+sl+'</span></div><div class="rc-body"><div class="rc-q">'+esc(q.text)+'</div>'+opts+(isSk?'<div style="margin-top:7px;font-size:10px;color:var(--text3)">Not answered — Correct: <strong style="color:var(--success)">'+q.correct+'</strong></div>':'')+'</div></div>';
  }).join('');
}
function goBackAfterResults(){if(examSubmitted&&currentExamId)reviewUnlocked=true;examSubmitted=false;examSubmitInFlight=false;enterStudentDash();stuTab('results');}
function toggleReview(){var l=Q('review-list');var a=Q('review-arrow');l.classList.toggle('open');a.textContent=l.classList.contains('open')?'&#9650;':'&#9660;';if(l.classList.contains('open'))setTimeout(function(){l.scrollIntoView({behavior:'smooth',block:'nearest'});},50);}
