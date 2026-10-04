// Firebase Setup
var FB_CONFIG={
  apiKey:"AIzaSyAWlF83z03HI7hAC5xnuCe1qjljz6l_QbY",
  authDomain:"nuel-academic-tutors.firebaseapp.com",
  projectId:"nuel-academic-tutors",
  storageBucket:"nuel-academic-tutors.firebasestorage.app",
  messagingSenderId:"735329597088",
  appId:"1:735329597088:web:31e8066f0ab45571607bc5"
};
function initFirebaseApp(){
  var app;try{app=firebase.app();}catch(e){app=firebase.initializeApp(FB_CONFIG);}
  db=firebase.firestore();
}
function connectFirebase(){
  var errEl=Q('fb-setup-err');
  if(typeof firebase==='undefined'){if(errEl)errEl.textContent='Firebase SDK not loaded. Please check your internet connection.';return;}
  if(errEl)errEl.textContent='';
  try{
    initFirebaseApp();
    localStorage.setItem('nat_fb_connected','1');
    toast('Connected! Loading...');
    setTimeout(function(){showScreen('role-select');},800);
  }catch(e){if(errEl)errEl.textContent='Connection failed: '+e.message;}
}
function tryAutoConnect(){
  if(!localStorage.getItem('nat_fb_connected'))return false;
  try{
    if(typeof firebase==='undefined')return false;
    initFirebaseApp();
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
