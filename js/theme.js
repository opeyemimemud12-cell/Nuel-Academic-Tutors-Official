// Dark / light mode. The saved choice (nat_theme) is applied early by a tiny script in <head>.
(function(){
  function cur(){return document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light';}
  function paint(){var b=document.getElementById('theme-toggle');if(!b)return;var d=cur()==='dark';
    b.innerHTML=d?'&#9728;&#65039;':'&#127769;';b.title=d?'Switch to light mode':'Switch to dark mode';b.setAttribute('aria-label',b.title);}
  window.toggleTheme=function(){var n=cur()==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',n);
    try{localStorage.setItem('nat_theme',n);}catch(e){}paint();};
  paint();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',paint);
  window.addEventListener('load',paint);
  try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(e){
    if(!localStorage.getItem('nat_theme')){document.documentElement.setAttribute('data-theme',e.matches?'dark':'light');paint();}});}catch(e){}
})();
