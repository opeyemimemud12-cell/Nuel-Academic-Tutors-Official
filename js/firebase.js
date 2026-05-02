// Firebase Setup
function connectFirebase(){
  if(typeof firebase==='undefined'){var errEl=Q('fb-setup-err');if(errEl)errEl.textContent='Firebase SDK not loaded. Please check your internet connection.';return;}
  var raw=(Q('fb-config-input')?Q('fb-config-input').value:'').trim();
  var errEl=Q('fb-setup-err');
  if(errEl)errEl.textContent='';
  if(!raw){if(errEl)errEl.textContent='Paste your Firebase config first.';return;}
  // Step 1: strip "const firebaseConfig = " and trailing semicolons
  var cleaned=raw.replace(/^[\s\S]*?=\s*\{/,'{').replace(/\}\s*;?\s*$/,'}').trim();
  if(cleaned.charAt(0)!=='{') cleaned=raw.trim();
  // Step 2: Convert JS object syntax to JSON
  // Add quotes around unquoted keys (apiKey: -> "apiKey":)
  cleaned=cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,function(m,pre,key){return pre+'"'+key+'":';});
  // Fix single-quoted strings to double-quoted
  cleaned=cleaned.replace(/'([^']*)'/g,'"$1"');
  // Remove trailing commas before } or ]
  cleaned=cleaned.replace(/,(\s*[}\]])/g,'$1');
  var cfg;
  try{cfg=JSON.parse(cleaned);}catch(e){
    if(errEl)errEl.textContent='Could not read config. Try copying again from Firebase — just the { ... } block.';
    return;
  }
  if(!cfg||!cfg.projectId){if(errEl)errEl.textContent='Missing projectId in config. Make sure you copied the full config.';return;}
  try{
    var app;try{app=firebase.app();}catch(e2){app=firebase.initializeApp(cfg);}
    db=firebase.firestore();
    localStorage.setItem('nat_fb_config',JSON.stringify(cfg));
    if(errEl)errEl.textContent='';
    toast('Connected! Loading...');
    setTimeout(function(){showScreen('role-select');},800);
  }catch(e){if(errEl)errEl.textContent='Connection failed: '+e.message;}
}
function tryAutoConnect(){
  var saved=localStorage.getItem('nat_fb_config');
  if(!saved)return false;
  try{
    if(typeof firebase==='undefined')return false;
    var cfg=JSON.parse(saved);
    var app;try{app=firebase.app();}catch(e){app=firebase.initializeApp(cfg);}
    db=firebase.firestore();
    return true;
  }catch(e){return false;}
}

// Firestore
function fbGet(col,cb){if(!db){cb([],null);return;}db.collection(col).get().then(function(snap){cb(snap.docs.map(function(d){return Object.assign({id:d.id},d.data());}),null);}).catch(function(e){cb([],e);});}
function fbSet(col,id,data,cb){if(!db){if(cb)cb(null);return;}db.collection(col).doc(String(id)).set(data,{merge:true}).then(function(){if(cb)cb(null);}).catch(function(e){if(cb)cb(e);});}
function fbDelete(col,id,cb){if(!db){if(cb)cb(null);return;}db.collection(col).doc(String(id)).delete().then(function(){if(cb)cb(null);}).catch(function(e){if(cb)cb(e);});}
function fbGetDoc(col,id,cb){if(!db){cb(null,null);return;}db.collection(col).doc(String(id)).get().then(function(d){cb(d.exists?Object.assign({id:d.id},d.data()):null,null);}).catch(function(e){cb(null,e);});}

function loadUsers(){return new Promise(function(res,rej){fbGet('users',function(d,e){if(e)rej(e);else{_users=d;res(d);}});});}
function loadExams(){return new Promise(function(res,rej){fbGet('exams',function(d,e){if(e)rej(e);else{_exams=d;res(d);}});});}
function loadNotes(){return new Promise(function(res,rej){fbGet('notes',function(d,e){if(e)rej(e);else{_notes=d;res(d);}});});}
function saveUser(u){return new Promise(function(res,rej){var id=u.id;var d=Object.assign({},u);delete d.id;fbSet('users',id,d,function(e){if(e)rej(e);else res();});});}
function deleteUserById(id){return new Promise(function(res,rej){fbDelete('users',id,function(e){if(e)rej(e);else res();});});}
function saveExamDoc(ex){return new Promise(function(res,rej){var id=ex.id;var d=Object.assign({},ex);delete d.id;fbSet('exams',id,d,function(e){if(e)rej(e);else res();});});}
function deleteExamById(id){return new Promise(function(res,rej){fbDelete('exams',id,function(e){if(e)rej(e);else res();});});}
function saveNoteDoc(n){return new Promise(function(res,rej){var id=n.id;var d=Object.assign({},n);delete d.id;fbSet('notes',id,d,function(e){if(e)rej(e);else res();});});}
function deleteNoteById(id){return new Promise(function(res,rej){fbDelete('notes',id,function(e){if(e)rej(e);else res();});});}
function getConfig(key){return new Promise(function(res){fbGetDoc('config',key,function(d){res(d?d.value:null);});});}
function setConfig(key,val){return new Promise(function(res,rej){fbSet('config',key,{value:val},function(e){if(e)rej(e);else res();});});}
