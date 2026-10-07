// Quiz AI: pretrained POS tagger + pretrained word embeddings (pruned) -> multiple-choice questions.
(function(){
var NLP=null,VEC=null,IDX={};
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('Could not load '+src));};document.head.appendChild(s);});}
function initVec(){
  var q=window.QM_VEC,words=q.w.split(' '),bin=atob(q.b),d=q.d,n=words.length,M=new Float32Array(n*d),i,j,v,nr;
  for(i=0;i<n;i++){nr=0;for(j=0;j<d;j++){v=bin.charCodeAt(i*d+j);if(v>127)v-=256;M[i*d+j]=v;nr+=v*v;}nr=Math.sqrt(nr)||1;for(j=0;j<d;j++)M[i*d+j]/=nr;}
  VEC={M:M,d:d,words:words,n:n};IDX={};for(i=0;i<n;i++)IDX[words[i]]=i;NLP=window.QM_NLP;
}
function ready(){
  if(NLP&&VEC)return Promise.resolve();
  var p=Promise.resolve();
  if(!window.QM_VEC)p=p.then(function(){return loadScript('js/qm-vectors.js');});
  if(!window.QM_NLP)p=p.then(function(){return loadScript('js/qm-nlp.js');});
  return p.then(initVec);
}
var rnd=function(a){return a[Math.floor(Math.random()*a.length)];};
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function vec(phrase){
  var ws=phrase.toLowerCase().split(/[\s\-]+/),acc=new Float32Array(VEC.d),c=0,j,nr=0;
  ws.forEach(function(w){var i=IDX[w];if(i===undefined)return;for(j=0;j<VEC.d;j++)acc[j]+=VEC.M[i*VEC.d+j];c++;});
  if(!c)return null;for(j=0;j<VEC.d;j++)nr+=acc[j]*acc[j];nr=Math.sqrt(nr)||1;for(j=0;j<VEC.d;j++)acc[j]/=nr;return acc;
}
function cos(a,b){var s=0;for(var j=0;j<a.length;j++)s+=a[j]*b[j];return s;}
function neighbours(v,k,ok){
  var sc=[],i,j,s;
  for(i=0;i<VEC.n;i++){var w=VEC.words[i];if(!ok(w))continue;s=0;for(j=0;j<VEC.d;j++)s+=v[j]*VEC.M[i*VEC.d+j];sc.push([s,w]);}
  sc.sort(function(a,b){return b[0]-a[0];});return sc.slice(0,k);
}
var pl=function(x){return /s$/i.test(x)&&!/(ss|us|is)$/i.test(x);};
var cap=function(x){return x.charAt(0).toUpperCase()+x.slice(1);};

function parse(text){
  var its=NLP.its,doc=NLP.nlp.readDoc(text),out=[],seen={};
  doc.sentences().each(function(s){
    var tk=s.tokens(),w=tk.out(),p=tk.out(its.pos),sp=tk.out(its.precedingSpaces);
    var str=w.map(function(x,i){return (i?sp[i]:'')+x;}).join('');
    if(str.length<45||str.length>260||w.length<8||w.length>45)return;
    if(!/^[A-Z0-9“"]/.test(str)||!/[.!]$/.test(str))return;
    if(p.indexOf('VERB')<0&&p.indexOf('AUX')<0)return;
    if(/https?:|www\.|@|©/.test(str)||(str.match(/\d/g)||[]).length>str.length*.25)return;
    var k=str.toLowerCase();if(seen[k])return;seen[k]=1;
    out.push({str:str,w:w,p:p,sp:sp});
  });
  return out;
}
function runs(S){
  var r=[],i=0,w=S.w,p=S.p;
  while(i<w.length){
    var t=p[i];
    if(t==='PROPN'||t==='NOUN'||t==='NUM'){
      var j=i;
      if(t!=='NUM'){while(j+1<w.length&&(p[j+1]==='PROPN'||p[j+1]==='NOUN')&&j-i<2)j++;}
      var txt=w.slice(i,j+1).map(function(x,k){return (k?S.sp[i+k]:'')+x;}).join('');
      var kind=t==='NUM'?'num':(p[i]==='PROPN'?'prop':'noun');
      if(i>0&&txt.length>=3&&!/^\W/.test(txt))r.push({a:i,b:j,text:txt,kind:kind,nt:j-i+1,head:w[j].toLowerCase()});
      i=j+1;
    }else i++;
  }
  return r;
}
function fmtNum(v,dec){return dec?v.toFixed(dec):String(Math.round(v));}
function numDistractors(ans,sentLower,pool){
  var raw=ans.text.replace(/,/g,'').replace(/%$/,''),v=parseFloat(raw);if(isNaN(v)||!/^\d/.test(raw))return[];
  var dec=(raw.split('.')[1]||'').length,pct=/%$/.test(ans.text),step=Math.max(dec?Math.pow(10,-dec):1,Math.pow(10,Math.floor(Math.log10(Math.max(Math.abs(v),1)))-1));
  var c={},add=function(x){if(x<0||!isFinite(x))return;var s=fmtNum(x,dec)+(pct?'%':'');if(s!==ans.text&&sentLower.indexOf(s.toLowerCase())<0)c[s]=1;};
  [-10,-5,-3,-2,-1,1,2,3,5,10].forEach(function(m){add(v+m*step);});add(v*2);add(v/2);
  pool.filter(function(x){return x.kind==='num'&&/%$/.test(x.text)===pct;}).forEach(function(x){if(x.text!==ans.text)c[x.text]=1;});
  var keys=Object.keys(c);
  keys.sort(function(a,b){return Math.abs(parseFloat(a)-v)-Math.abs(parseFloat(b)-v)+(Math.random()-.5)*step*4;});
  return keys.slice(0,3);
}
function distractors(ans,S,pool){
  if(ans.kind==='num')return numDistractors(ans,S.str.toLowerCase(),pool);
  var sl=S.str.toLowerCase(),akey=ans.text.toLowerCase(),av=vec(ans.text),seen={},cands=[];
  pool.forEach(function(c){
    if(c.kind!==ans.kind||c.nt!==ans.nt||c.key===akey||seen[c.key]||sl.indexOf(c.key)>=0)return;
    if(ans.kind!=='num'&&IDX[c.head]<1800)return;
    if(pl(c.head)!==pl(ans.head))return;seen[c.key]=1;
    var cv=vec(c.text),s=(av&&cv)?cos(av,cv):-Math.abs(c.text.length-ans.text.length)/20;
    cands.push({t:c.text,s:s});
  });
  cands=cands.filter(function(x){return x.s<0.93;}).sort(function(a,b){return b.s-a.s;}).slice(0,9);
  var out=shuffle(cands).slice(0,3).map(function(x){return x.t;});
  if(out.length<3&&av&&ans.nt===1){
    var have={};out.forEach(function(o){have[o.toLowerCase()]=1;});
    var nb=neighbours(av,14,function(w){return IDX[w]>=1800&&w.length>=4&&w!==akey&&sl.indexOf(w)<0&&!have[w]&&pl(w)===pl(ans.head)&&!/(ing|ly)$/.test(w)===!/(ing|ly)$/.test(akey);});
    shuffle(nb.filter(function(x){return x[0]<0.93;}).slice(0,10)).forEach(function(x){if(out.length<3)out.push(ans.kind==='prop'||/^[A-Z]/.test(ans.text)?cap(x[1]):x[1]);});
  }
  return out.length>=3?out:[];
}
function finish(text,ans,wrong){var all=shuffle([ans].concat(wrong));return{text:text,opts:all,correct:'ABCD'[all.indexOf(ans)],image:null};}

function build(text,n){
  var S=parse(text),i;if(!S.length)return[];
  var df={};S.forEach(function(s){var u={};s.w.forEach(function(x){u[x.toLowerCase()]=1;});for(var k in u)df[k]=(df[k]||0)+1;});
  var pool=[],pseen={};
  S.forEach(function(s){s.runs=runs(s);s.runs.forEach(function(r){r.key=r.text.toLowerCase();if(!pseen[r.key]){pseen[r.key]=1;pool.push(r);}});});
  var items=[];
  S.forEach(function(s,si){
    var best=null;
    s.runs.forEach(function(r){
      var rank=IDX[r.head],spec=rank===undefined?1:Math.min(rank,20000)/20000,common=rank!==undefined&&rank<700,d=df[r.head]||1;
      var occ=s.str.toLowerCase().split(r.key).length-1;if(occ!==1)return;
      var sc=(common?-6:0)+3*spec+(d>=2&&d<=12?2:0)+(r.kind==='prop'?1.5:0)+(r.kind==='num'?2:0)+Math.min(r.text.length,14)/7+Math.random()*2;
      if(!best||sc>best.sc)best={r:r,sc:sc};
    });
    if(best)items.push({si:si,s:s,type:'cloze',r:best.r,sc:best.sc});
    var m=s.str.match(/^([A-Z][\w\-]*(?: [\w\-]+){0,2}?) (?:is|are|refers to|means|is defined as) (?:the |a |an )?(.{25,200}?)[.]$/);
    if(m){var tc=m[1].split(' ').length;
      if(s.p.slice(0,tc).every(function(x){return x==='NOUN'||x==='PROPN'||x==='ADJ';})&&!/^(This|That|It|There|These|Those)\b/.test(m[1]))
        items.push({si:si,s:s,type:'def',term:m[1],def:m[2],r:{text:m[1],kind:s.p[0]==='PROPN'?'prop':'noun',nt:tc,head:m[1].split(' ').pop().toLowerCase(),key:m[1].toLowerCase()},sc:6+Math.random()*2});}
  });
  items.sort(function(a,b){return a.si-b.si;});
  var used={},out=[];
  function make(it){
    if(used[it.si])return null;var w=distractors(it.r,it.s,pool);if(w.length<3)return null;used[it.si]=1;
    if(it.type==='def')return finish('Which term is described as: “'+it.def+'”?',it.term,w);
    var q=it.s.w.map(function(x,k){if(k===it.r.a)return (k?it.s.sp[k]:'')+'_____';if(k>it.r.a&&k<=it.r.b)return '';return (k?it.s.sp[k]:'')+x;}).join('');
    return finish('Fill in the blank: '+q,it.r.text,w);
  }
  var B=Math.max(1,Math.min(n,items.length));
  for(var b=0;b<B&&out.length<n;b++){
    var lo=Math.floor(b*items.length/B),hi=Math.max(lo+1,Math.floor((b+1)*items.length/B));
    items.slice(lo,hi).sort(function(x,y){return y.sc-x.sc;}).some(function(it){var q=make(it);if(q){out.push(q);return true;}return false;});
  }
  items.slice().sort(function(x,y){return y.sc-x.sc;}).forEach(function(it){if(out.length>=n)return;var q=make(it);if(q)out.push(q);});
  return shuffle(out).slice(0,n);
}
window.qmAI=function(text,n){return ready().then(function(){return build(text,n);});};
})();
