(function(){
  window.DeerCampRoomModal={create(){
    let backdrop=null;
    function close(){backdrop?.remove();backdrop=null;document.removeEventListener('keydown',onKey)}
    function onKey(e){if(e.key==='Escape')close()}
    return {open({heading='Room Detail',html=''}){close();backdrop=document.createElement('div');backdrop.className='room-modal-backdrop';backdrop.innerHTML=`<section class="room-modal" role="dialog" aria-modal="true" aria-label="${heading.replace(/"/g,'')}"><h2>${heading}</h2>${html}</section>`;backdrop.addEventListener('click',e=>{if(e.target===backdrop)close()});document.body.appendChild(backdrop);document.addEventListener('keydown',onKey);backdrop.querySelector('button')?.focus()},close};
  }};
})();
