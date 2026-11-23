/* Builds a clean, pre-filled valuation email. No data leaves the page except through the visitor's own mail app. */
(function(){
  var f=document.getElementById('val-form'); if(!f) return;
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var v=function(n){return (f.elements[n].value||'').trim();};
    if(!v('address')){f.elements.address.focus();return;}
    var body='Please prepare a valuation for:\n'+v('address')+'\n\nName: '+v('name')+'\nPhone: '+v('phone')+'\n\nSent from dsteamps.com';
    window.location.href='mailto:stuartteamps@gmail.com?subject='+encodeURIComponent('Home valuation request: '+v('address'))+'&body='+encodeURIComponent(body);
  });
})();
