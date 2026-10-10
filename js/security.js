// SECURITY: password hashing, login lockout, audit log, idle logout, one-device check, password reset
// Firestore collections used:
//   login_attempts/{role_email}  -> { count, lockedUntil }
//   audit_log/{auto}             -> { at, by, role, action, detail }

// ───────── SHA-256 (pure JS so it also works on non-HTTPS pages) ─────────
function sha256(str){
  function rr(v,a){return(v>>>a)|(v<<(32-a));}
  var msg=unescape(encodeURIComponent(String(str)));
  var maxWord=Math.pow(2,32),i,j,result='',words=[],bitLen=msg.length*8;
  var hash=[],k=[],pc=0,comp={};
  for(var c=2;pc<64;c++){
    if(!comp[c]){
      for(i=0;i<313;i+=c)comp[i]=c;
      hash[pc]=(Math.pow(c,.5)*maxWord)|0;
      k[pc++]=(Math.pow(c,1/3)*maxWord)|0;
    }
  }
  msg+='\x80';
  while(msg.length%64-56)msg+='\x00';
  for(i=0;i<msg.length;i++){j=msg.charCodeAt(i);words[i>>2]|=j<<((3-i)%4)*8;}
  words[words.length]=((bitLen/maxWord)|0);
  words[words.length]=bitLen;
  for(j=0;j<words.length;){
    var w=words.slice(j,j+=16),old=hash;
    hash=hash.slice(0,8);
    for(i=0;i<64;i++){
      var w15=w[i-15],w2=w[i-2],a=hash[0],e=hash[4];
      var t1=hash[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]
        +(w[i]=(i<16)?w[i]:(w[i-16]+(rr(w15,7)^rr(w15,18)^(w15>>>3))+w[i-7]+(rr(w2,17)^rr(w2,19)^(w2>>>10)))|0);
      var t2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(t1+t2)|0].concat(hash);
      hash[4]=(hash[4]+t1)|0;
    }
    for(i=0;i<8;i++)hash[i]=(hash[i]+old[i])|0;
  }
  for(i=0;i<8;i++)for(j=3;j+1;j--){var b=(hash[i]>>(j*8))&255;result+=((b<16)?0:'')+b.toString(16);}
  return result;
}
var HASH_ROUNDS=2000;
function hashPassword(pass,salt){
  var h=sha256(salt+':'+pass);
  for(var i=0;i<HASH_ROUNDS;i++)h=sha256(h+salt);
  return h;
}
function newSalt(){
  var a=[],i;
  try{var u=new Uint8Array(16);crypto.getRandomValues(u);for(i=0;i<16;i++)a.push(('0'+u[i].toString(16)).slice(-2));}
  catch(e){for(i=0;i<16;i++)a.push(('0'+Math.floor(Math.random()*256).toString(16)).slice(-2));}
  return a.join('');
}
// Helper for admins: run  natHash('NewPassword','some-salt')  in the browser console to make a new admin hash for js/ui.js
window.natHash=function(pass,salt){return hashPassword(pass,salt);};
function verifyPassword(user,pass){
  if(user.passHash&&user.salt)return hashPassword(pass,user.salt)===user.passHash;
  return typeof user.password==='string'&&user.password===pass; // legacy plain-text account, upgraded on first login
}
function upgradePassword(user,pass){
  var salt=newSalt(),ph=hashPassword(pass,salt);
  var upd={salt:salt,passHash:ph,password:firebase.firestore.FieldValue.delete()};
  return db.collection('users').doc(String(user.id)).update(upd).then(function(){
    var u=Object.assign({},user,{salt:salt,passHash:ph});delete u.password;return u;
  }).catch(function(){return user;});
}

// ───────── Login lockout ─────────
var LOCK_MAX=5,LOCK_MS=10*60*1000;
function lockKey(role,email){return role+'_'+String(email||'').toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,120);}
function checkLock(role,email){
  return new Promise(function(res){
    if(!db){res(0);return;}
    fbGetDoc('login_attempts',lockKey(role,email),function(d){
      res(d&&d.lockedUntil&&d.lockedUntil>Date.now()?Math.ceil((d.lockedUntil-Date.now())/60000):0);
    });
  });
}
// resolves to number of attempts left (0 = now locked)
function recordFail(role,email){
  return new Promise(function(res){
    if(!db){res(LOCK_MAX);return;}
    var key=lockKey(role,email);
    fbGetDoc('login_attempts',key,function(d){
      var expired=d&&d.lockedUntil&&d.lockedUntil<=Date.now();
      var count=((d&&!expired?d.count:0)||0)+1;
      if(count>=LOCK_MAX){
        fbSet('login_attempts',key,{count:0,lockedUntil:Date.now()+LOCK_MS},function(){
          logAudit('login_locked',role+' account '+email+' locked for 10 minutes after '+LOCK_MAX+' failed attempts',email);
          res(0);
        });
      }else{
        fbSet('login_attempts',key,{count:count,lockedUntil:0},function(){res(LOCK_MAX-count);});
      }
    });
  });
}
function clearFails(role,email){if(db)fbDelete('login_attempts',lockKey(role,email),function(){});}

// ───────── Audit log ─────────
function logAudit(action,detail,who){
  if(!db)return;
  var by=who||(currentUser?(currentUser.email||currentUser.name):'system');
  try{db.collection('audit_log').add({at:new Date().toISOString(),by:by,role:currentRole||'',action:action,detail:detail||''}).catch(function(){});}catch(e){}
}
function renderAuditTab(){
  var cont=Q('admin-audit-body');if(!cont)return;
  if(!db){cont.innerHTML='<div class="empty-state"><div class="empty-title">Not connected to the database</div></div>';return;}
  cont.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3)">Loading...</div>';
  db.collection('audit_log').orderBy('at','desc').limit(150).get().then(function(snap){
    if(snap.empty){cont.innerHTML='<div class="empty-state"><div class="empty-icon">&#128220;</div><div class="empty-title">No activity logged yet</div></div>';return;}
    cont.innerHTML='<div style="overflow-x:auto;background:var(--white);border-radius:var(--radius);box-shadow:var(--shadow);border:1px solid var(--border2)"><table class="scores-table"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead><tbody>'
      +snap.docs.map(function(d){var x=d.data();
        return '<tr><td style="font-size:11px;white-space:nowrap">'+esc(new Date(x.at).toLocaleString())+'</td><td style="font-size:11px">'+esc(x.by)+'</td><td style="font-weight:700;font-size:12px">'+esc(x.action)+'</td><td style="font-size:11px;color:var(--text3)">'+esc(x.detail)+'</td></tr>';}).join('')
      +'</tbody></table></div>';
  }).catch(function(e){cont.innerHTML='<div class="empty-state"><div class="empty-title">Error: '+esc(e.message)+'</div></div>';});
}

// ───────── Idle auto-logout (20 min, not during an exam) ─────────
var IDLE_MS=20*60*1000,_lastAct=Date.now();
['click','keydown','mousemove','touchstart','scroll'].forEach(function(ev){document.addEventListener(ev,function(){_lastAct=Date.now();},{passive:true});});
setInterval(function(){
  if(!currentRole)return;
  var scr=document.querySelector('.screen.active');
  if(scr&&scr.id==='take-exam-screen'){_lastAct=Date.now();return;}
  if(Date.now()-_lastAct>IDLE_MS){
    var who=currentUser?(currentUser.email||currentUser.name):'';
    logAudit('idle_logout','Signed out after 20 minutes of inactivity',who);
    logout();toast('Signed out after 20 minutes of inactivity.','error');
  }
},30000);

// ───────── One device / tab at a time while writing an exam ─────────
function getDeviceId(){
  try{var v=sessionStorage.getItem('nat_device');if(!v){v=newSalt();sessionStorage.setItem('nat_device',v);}return v;}
  catch(e){if(!window.__devId)window.__devId=newSalt();return window.__devId;}
}
// resolves true if this student is actively writing an exam from a DIFFERENT device/tab
function checkOtherDevice(uid){
  return new Promise(function(res){
    if(!db){res(false);return;}
    fbGetDoc('active_sessions',String(uid),function(d){
      res(!!(d&&d.deviceId&&d.deviceId!==getDeviceId()&&Date.now()-(d.lastSeen||0)<45000));
    });
  });
}

// ───────── Admin: reset a user's password (passwords can no longer be viewed) ─────────
function resetPasswordModal(id,name){
  showModal('<div class="modal-title">Reset Password</div><div class="modal-sub">Set a new password for <strong>'+esc(name)+'</strong>. Passwords are stored as one-way hashes, so existing ones cannot be viewed.</div>'
    +'<input class="modal-input" type="text" id="newpw-inp" placeholder="New password (min 6 characters)" autocomplete="off">'
    +'<div class="modal-error" id="newpw-err"></div>'
    +'<div class="modal-btn-row"><button class="modal-btn" onclick="closeModal()">Cancel</button><button class="modal-btn primary" id="newpw-go">Save Password</button></div>');
  setTimeout(function(){var b=Q('newpw-go');if(b)b.addEventListener('click',function(){
    var v=(Q('newpw-inp').value||'');
    if(v.length<6){Q('newpw-err').textContent='Use at least 6 characters.';return;}
    var salt=newSalt();
    db.collection('users').doc(String(id)).update({salt:salt,passHash:hashPassword(v,salt),password:firebase.firestore.FieldValue.delete()})
      .then(function(){closeModal();toast('Password updated.');logAudit('reset_password','Password reset for '+name);})
      .catch(function(e){Q('newpw-err').textContent='Error: '+e.message;});
  });},30);
}
