(function(){
  function preserveContext(root=document){
    const currentParams=new URLSearchParams(window.location.search);
    const campId=currentParams.get('campId');
    const useStagingFirebase=currentParams.get('useStagingFirebase');

    root.querySelectorAll('a[data-v2-room-link], a.maps-nav').forEach(link=>{
      const href=link.getAttribute('href');
      if(!href)return;

      const url=new URL(href,window.location.href);

      if(campId)url.searchParams.set('campId',campId);
      if(useStagingFirebase)url.searchParams.set('useStagingFirebase',useStagingFirebase);

      link.href=url.href;
    });
  }

  window.DeerCampRoomNavigation={
    init(root=document,routes={}){
      preserveContext(root);

      root.querySelectorAll('[data-room-nav]').forEach(el=>{
        const key=el.dataset.roomNav;
        if(el.getAttribute('aria-current')==='page')return;
        el.addEventListener('click',()=>{
          const url=routes[key];
          if(url)location.href=url;
          else window.DeerCampRoomToast?.show(`${el.getAttribute('aria-label')||'This room'} is a future DeerCamp room.`);
        });
      });
    },
    preserveContext
  };

  preserveContext(document);
})();
