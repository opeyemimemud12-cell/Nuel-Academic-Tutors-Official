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
  if(loginRole==='admin'){
    var a=ADMINS.find(function(x){return x.email===email&&x.pass===pass;});
    if(a){currentRole='admin';currentUser={role:'admin',name:a.name,email:a.email};enterAdminDash();}
    else err.textContent='Invalid admin credentials.';
    return;
  }
  loading(true,'Signing in...');
  loadUsers().then(function(){
    var user=_users.find(function(u){return u.role===loginRole&&(u.email===email||u.username===email);});
    if(!user){err.textContent='No '+loginRole+' account found.';loading(false);return;}
    if(user.password!==pass){err.textContent='Incorrect password.';loading(false);return;}
    currentRole=loginRole;currentUser=user;loading(false);
    if(currentRole==='teacher'){enterTeacherDash();return;}
    getConfig('access_code').then(function(code){if(code)showAccessGate();else enterStudentDash();});
  }).catch(function(e){loading(false);err.textContent='Error: '+e.message;});
}
function logout(){currentRole=null;currentUser=null;loginRole=null;clearExamTimer();examSubmitted=false;reviewUnlocked=false;showScreen('landing');}

// ACCESS GATE
function showAccessGate(){Q('gate-user-name').textContent=currentUser.name;Q('gate-code-input').value='';Q('gate-code-error').textContent='';showScreen('access-gate');setTimeout(function(){if(Q('gate-code-input'))Q('gate-code-input').focus();},100);}
function checkAccessCode(){
  var entered=(Q('gate-code-input').value||'').trim();
  getConfig('access_code').then(function(code){
    if(entered===code){Q('gate-code-error').textContent='';enterStudentDash();}
    else{var inp=Q('gate-code-input');inp.classList.remove('shake');void inp.offsetWidth;inp.classList.add('shake');Q('gate-code-error').textContent='Incorrect code. Please try again.';}
  });
}
