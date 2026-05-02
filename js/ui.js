// ════════════════════════════════════════════
//  NUEL ACADEMIC TUTORS - Firebase Edition
// ════════════════════════════════════════════
var ADMIN1={email:'opeyemimemud12@gmail.com',pass:'Admin@NAT2025',name:'Administrator'};
var ADMIN2={email:'Immaben98@gmail.com',pass:'08101610170',name:'Immaben'};
var ADMINS=[ADMIN1,ADMIN2];
var db=null,currentRole=null,currentUser=null,loginRole=null;
var currentExamId=null,examAnswers=[],examQIdx=0;
var examTimer=null,examTimeLeft=0,examSubmitted=false,reviewUnlocked=false,editingExamId=null,qCount=0;
var _users=[],_exams=[],_notes=[];

function Q(id){return document.getElementById(id);}
function showScreen(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');s.style.display='';});var el=Q(id);if(el){el.classList.add('active');el.style.display='';}}
function toast(msg,type){type=type||'success';document.querySelectorAll('.toast').forEach(function(t){t.remove();});var t=document.createElement('div');t.className='toast '+type;t.innerHTML='<span>'+(type==='success'?'&#10003;':'&#10005;')+'</span> '+msg;document.body.appendChild(t);setTimeout(function(){t.remove();},3200);}
function showModal(html){closeModal();var o=document.createElement('div');o.className='modal-overlay';o.id='modal-overlay';o.innerHTML='<div class="modal-box">'+html+'</div>';o.addEventListener('click',function(e){if(e.target===o)closeModal();});document.body.appendChild(o);}
function closeModal(){var m=Q('modal-overlay');if(m)m.remove();}
function fileIcon(n){var e=(n||'').split('.').pop().toLowerCase();if(e==='pdf')return'&#128213;';if(e==='doc'||e==='docx')return'&#128216;';if(e==='ppt'||e==='pptx')return'&#128202;';if(e==='png'||e==='jpg'||e==='jpeg')return'&#128247;';if(e==='mp3'||e==='wav')return'&#127925;';return'&#128196;';}
function fmtSize(b){if(!b)return'';if(b<1024)return b+'B';if(b<1048576)return(b/1024).toFixed(1)+'KB';return(b/1048576).toFixed(1)+'MB';}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function togglePwVis(inputId,btn){
  var inp=Q(inputId);if(!inp)return;
  var isHidden=inp.type==='password';
  inp.type=isHidden?'text':'password';
  // Closed book = password hidden, Open book = password visible
  btn.innerHTML=isHidden?'&#128214;':'&#128213;';
  btn.title=isHidden?'Hide password':'Show password';
}
function loading(show,msg){var el=Q('global-loading');if(!el){el=document.createElement('div');el.id='global-loading';el.style.cssText='position:fixed;inset:0;background:rgba(10,22,40,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;';el.innerHTML='<div style="width:44px;height:44px;border:3px solid rgba(201,168,76,0.3);border-top-color:var(--gold);border-radius:50%;animation:spin 0.8s linear infinite;"></div><div style="color:#fff;font-size:14px;font-weight:600;" id="loading-msg">Loading...</div>';document.body.appendChild(el);}if(show){el.style.display='flex';var lm=Q('loading-msg');if(lm)lm.textContent=msg||'Loading...';}else el.style.display='none';}


window.__examModeActive=false;
function isExamModeActive(){return !!window.__examModeActive;}
function openCustomizer(){var p=Q('customizer-panel');if(p)p.classList.add('open');}
function closeCustomizer(){var p=Q('customizer-panel');if(p)p.classList.remove('open');}
function livePreview(){}
function saveCustomLayout(){toast('Layout settings saved.');closeCustomizer();}
function resetCustomLayout(){toast('Layout reset.');}
function handleBannerUpload(event){var file=event.target.files&&event.target.files[0];if(!file)return;var r=new FileReader();r.onload=function(ev){var img=Q('hero-banner-img');var p=Q('banner-preview');var pi=Q('banner-preview-img');if(img){img.src=ev.target.result;img.classList.add('visible');}if(pi){pi.src=ev.target.result;}if(p){p.style.display='block';}localStorage.setItem('nat_banner_img',ev.target.result);};r.readAsDataURL(file);}
function removeBanner(){localStorage.removeItem('nat_banner_img');var img=Q('hero-banner-img');var p=Q('banner-preview');if(img){img.src='';img.classList.remove('visible');}if(p){p.style.display='none';}}
function initBanner(){var b=localStorage.getItem('nat_banner_img');if(!b)return;var img=Q('hero-banner-img');var p=Q('banner-preview');var pi=Q('banner-preview-img');if(img){img.src=b;img.classList.add('visible');}if(pi){pi.src=b;}if(p){p.style.display='block';}}
