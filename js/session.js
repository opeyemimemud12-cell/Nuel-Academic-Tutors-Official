// Persistent login: stay signed in on this device until the user taps Sign Out.
// Stores only: role, user id, a hash of the password (to detect password changes), last tab, and the access code that was passed.
// Loaded LAST, so it can wrap the enter*/logout/tab functions defined in app.js and auth.js.
(function(){
  var KEY='nat_session';
  function hash(s){var h=5381,i;s=String(s);for(i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return String(h>>>0);}
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch(e){return null;}}
  function write(o){try{localStorage.setItem(KEY,JSON.stringify(o));}catch(e){}}
  function clear(){try{localStorage.removeItem(KEY);}catch(e){}}
  function done(){document.documentElement.classList.remove('restoring');try{loading(false);}catch(e){}}

  function save(){
    if(!currentUser||!currentRole)return;
    var old=read()||{},sig='';
    if(currentRole==='admin'){var a=ADMINS.find(function(x){return x.email===currentUser.email;});sig=a?hash(a.hash):'';}
    else sig=hash(currentUser.passHash||currentUser.password||'');
    var same=old.role===currentRole&&old.id===(currentUser.id||'')&&old.email===(currentUser.email||'');
    write({role:currentRole,id:currentUser.id||'',email:currentUser.email||'',sig:sig,tab:same?old.tab||'':'',gate:same?old.gate||'':''});
    if(currentRole==='student'){
      getConfig('access_code').then(function(c){var s=read();if(s&&s.role==='student'){s.gate=c||'';write(s);}}).catch(function(){});
    }
  }
  function saveTab(t){var s=read();if(s&&currentUser){s.tab=t;write(s);}}
  function gotoTab(fn,prefix,tab){if(tab&&Q(prefix+tab))fn(tab);}

  // wrap the functions that run after a successful sign-in / tab change / sign-out
  var _a=enterAdminDash,_t=enterTeacherDash,_s=enterStudentDash,_lo=logout,_at=adminTab,_tt=teacherTab,_st=stuTab;
  enterAdminDash=function(){_a();save();};
  enterTeacherDash=function(){_t();save();};
  enterStudentDash=function(){_s();save();};
  adminTab=function(t){_at(t);saveTab(t);};
  teacherTab=function(t){_tt(t);saveTab(t);};
  stuTab=function(t){_st(t);saveTab(t);};
  logout=function(){clear();_lo();};

  function restore(){
    var s=read();
    if(!s||!s.role){done();return;}
    if(typeof db==='undefined'||!db){done();return;}   // offline / not connected: keep the session, show normal screen
    var tab=s.tab;
    if(s.role==='admin'){
      var a=ADMINS.find(function(x){return x.email===s.email&&hash(x.hash)===s.sig;});
      if(!a){clear();done();return;}
      currentRole='admin';currentUser={role:'admin',name:a.name,email:a.email};
      enterAdminDash();gotoTab(adminTab,'atb-',tab);done();return;
    }
    loadUsers().then(function(){
      var u=_users.find(function(x){return x.id===s.id&&x.role===s.role;});
      if(!u||u.suspended||hash(u.passHash||u.password||'')!==s.sig){clear();done();return;}   // account removed or password changed
      currentRole=s.role;currentUser=u;
      if(s.role==='teacher'){enterTeacherDash();gotoTab(teacherTab,'ttb-',tab);done();return;}
      return getConfig('access_code').then(function(code){
        if(code&&s.gate!==code)showAccessGate();                 // access code changed since this student passed it
        else{enterStudentDash();gotoTab(stuTab,'stb-',tab);}
        done();
      });
    }).catch(function(){done();});
  }

  if(document.documentElement.classList.contains('restoring')){try{loading(true,'Welcome back...');}catch(e){}}
  setTimeout(done,12000);   // safety: never leave the splash up
  restore();
})();
