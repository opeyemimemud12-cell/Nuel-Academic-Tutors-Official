// AUTH
function goLogin(role){
  loginRole=role;
  var labels={admin:'Admin Login',teacher:'Teacher Login',student:'Student Login'};
  var subs={admin:'administrator credentials',teacher:'teacher account',student:'student account'};
  Q('li-role-tag').textContent=labels[role];
  Q('li-sub').textContent='Sign in with your '+subs[role];
  Q('li-email').value='';Q('li-pass').value='';Q('li-err').textContent='';
  showScreen('login-screen');
  setTimeout(function(){if(Q('li-email'))Q('li-email').focus();},80);
}
function doLogin(){
  var email=Q('li-email').value.trim(),pass=Q('li-pass').value,err=Q('li-err');
  err.textContent='';
  if(!email||!pass){err.textContent='Please enter email and password.';return;}
  var role=loginRole;
  loading(true,'Signing in...');
  checkLock(role,email).then(function(mins){
    if(mins>0){loading(false);err.textContent='Too many failed attempts. Try again in '+mins+' minute'+(mins!==1?'s':'')+'.';return;}
    return role==='admin'?adminLogin(email,pass,err):userLogin(role,email,pass,err);
  }).catch(function(e){loading(false);err.textContent='Error: '+e.message;});
}
function failLogin(role,email,err,msg){
  return recordFail(role,email).then(function(left){
    loading(false);
    logAudit('login_failed',role+' login failed for '+email,email);
    err.textContent=left>0?msg+' ('+left+' attempt'+(left!==1?'s':'')+' left)':'Too many failed attempts. This account is locked for 10 minutes.';
  });
}
function adminLogin(email,pass,err){
  var a=ADMINS.find(function(x){return x.email.toLowerCase()===email.toLowerCase();});
  if(a&&hashPassword(pass,a.salt)===a.hash){
    clearFails('admin',email);
    currentRole='admin';currentUser={role:'admin',name:a.name,email:a.email};
    loading(false);logAudit('login','admin login',a.email);enterAdminDash();return;
  }
  return failLogin('admin',email,err,'Invalid admin credentials.');
}
function userLogin(role,email,pass,err){
  return loadUsers().then(function(){
    var user=_users.find(function(u){return u.role===role&&(u.email===email||u.username===email);});
    if(!user||!verifyPassword(user,pass))return failLogin(role,email,err,'Incorrect email or password.');
    if(user.suspended){loading(false);logAudit('login_blocked','Suspended '+role+' tried to sign in: '+email,email);err.textContent='This account has been suspended. Please contact the administrator.';return;}
    var legacy=!user.passHash;
    return (legacy?upgradePassword(user,pass):Promise.resolve(user)).then(function(u){
      user=u;clearFails(role,email);
      currentRole=role;currentUser=user;
      if(role==='teacher'){loading(false);logAudit('login','teacher login',user.email);enterTeacherDash();return;}
      return getConfig('maintenance').then(function(m){
      if(m&&m.on){currentRole=null;currentUser=null;loading(false);err.textContent=m.message||'The site is under maintenance. Please check back soon.';return;}
      return checkOtherDevice(user.id).then(function(other){
        if(other){currentRole=null;currentUser=null;loading(false);err.textContent='This account is currently writing an exam on another device. Try again when it is finished.';return;}
        loading(false);logAudit('login','student login',user.email);
        return getConfig('access_code').then(function(code){if(code)showAccessGate();else enterStudentDash();});
      });
      });
    });
  });
}
function logout(){try{stopEndExamsListener();stopSessionTracking();}catch(e){}currentRole=null;currentUser=null;loginRole=null;clearExamTimer();examSubmitted=false;reviewUnlocked=false;showScreen('landing');}

// ACCESS GATE
function showAccessGate(){Q('gate-user-name').textContent=currentUser.name;Q('gate-code-input').value='';Q('gate-code-error').textContent='';showScreen('access-gate');setTimeout(function(){if(Q('gate-code-input'))Q('gate-code-input').focus();},100);}
function checkAccessCode(){
  var entered=(Q('gate-code-input').value||'').trim();
  getConfig('access_code').then(function(code){
    if(entered===code){Q('gate-code-error').textContent='';enterStudentDash();}
    else{var inp=Q('gate-code-input');inp.classList.remove('shake');void inp.offsetWidth;inp.classList.add('shake');Q('gate-code-error').textContent='Incorrect code. Please try again.';}
  });
}
