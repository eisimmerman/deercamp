(function(){
  const categories = [
    ["fuel","⛽ Fuel","gas station convenience store fuel"],
    ["food","🍔 Food / Ice","bar restaurant diner supper club ice"],
    ["hunting","🏹 Hunting Gear","sporting goods hunting supplies bait tackle"],
    ["beer","🥃 Beer & Liquor","liquor store beer wine spirits"],
    ["groceries","🛒 Groceries","grocery store supermarket"],
    ["auto","🚗 Auto Repair","auto repair tire service"],
    ["general","🛍 General Store","department store walmart target general store"],
    ["hardware","🔨 Hardware","hardware store farm fleet tractor supply"],
    ["medical","🚑 Medical","urgent care hospital pharmacy"],
    ["processors","🦌 Deer Processors","deer processing meat processor butcher"],
    ["taxidermists","🏆 Taxidermists","taxidermist deer mounts"],
    ["propane","🔥 Propane","propane firewood"]
  ].map(([id,label,query])=>({id,label,query}));

  let activeCategory = categories[0].id;
  let didAutoSearch = false;
  let boundRoot = null;

  function esc(value){return String(value ?? "").replace(/[&<>"']/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]));}
  function qs(id){return document.getElementById(id);}
  function readCampZipFromPageText(){const meta=document.querySelector(".camp-meta")?.textContent||""; const match=meta.match(/\b\d{5}(?:-\d{4})?\b/); return match?match[0]:"";}
  function getCampZipFromKnownSources(){
    const candidates=[window.currentCamp?.zip,window.currentCamp?.zipCode,window.currentCamp?.campZip,window.campZip,window.activeCampZip,window.campData?.zip,window.campData?.zipCode,window.camp?.zip,window.camp?.zipCode,readCampZipFromPageText()];
    for(const value of candidates){const clean=String(value||"").trim(); if(clean) return clean;}
    return "";
  }
  function getSelectedZip(){return String(qs("campResourcesZip")?.value||"").trim();}
  function getRadiusMiles(){return Number(qs("campResourcesRadius")?.value||25);}
  function getActiveCategory(){return categories.find(c=>c.id===activeCategory)||categories[0];}
  function setStatus(message){const status=qs("campResourcesStatus"); if(status) status.textContent=message;}

  function renderCategories(){
    const wrap=qs("campResourcesCategories");
    if(!wrap) return;
    wrap.innerHTML=categories.map(cat=>`<button type="button" class="campresources-chip ${cat.id===activeCategory?"active":""}" data-campresources-category="${esc(cat.id)}" title="${esc(cat.label.replace(/^[^A-Za-z0-9]+\\s*/,""))}">${cat.label}</button>`).join("");
    wrap.querySelectorAll("[data-campresources-category]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        activeCategory=btn.getAttribute("data-campresources-category")||activeCategory;
        renderCategories();
        loadCampResources();
      });
    });
  }

  function renderResults(items,radiusMiles,categoryLabel){
    const list=qs("campResourcesList");
    if(!list) return;
    if(!items.length){
      list.innerHTML="";
      setStatus(`No matching resources were found within ${radiusMiles} miles of your camp ZIP code. Increase the search radius to expand your results.`);
      return;
    }
    setStatus(`${items.length} ${categoryLabel.replace(/^[^A-Za-z0-9]+/,"")} found within ${radiusMiles} miles.`);
    list.innerHTML=items.map(place=>`
      <article class="campresources-card">
        <div>
          <strong>${esc(place.name||"Unknown place")}</strong>
          <p class="campresources-muted">${esc(place.address||"")}</p>
          <p class="campresources-muted">${place.distanceMiles?`${Number(place.distanceMiles).toFixed(1)} miles away`:""}${place.openNow===true?" · Open now":place.openNow===false?" · Closed now":""}${place.rating?` · ⭐ ${esc(place.rating)}`:""}</p>
        </div>
        <div class="campresources-actions">
          ${place.phone?`<a href="tel:${esc(place.phone)}">Call</a>`:""}
          ${place.website?`<a href="${esc(place.website)}" target="_blank" rel="noopener">Website</a>`:""}
          ${place.mapsUrl?`<a href="${esc(place.mapsUrl)}" target="_blank" rel="noopener">Directions</a>`:""}
        </div>
      </article>`).join("");
  }

  async function loadCampResources(){
    const zip=getSelectedZip(), radiusMiles=getRadiusMiles(), category=getActiveCategory(), list=qs("campResourcesList");
    if(list) list.innerHTML="";
    if(!zip){setStatus("Enter a camp ZIP code, then choose a category."); return;}
    setStatus("Searching nearby resources...");
    try{
      const response=await fetch("/api/campResources",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({zip,radiusMiles,categoryId:category.id,query:category.query})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.error||"Resources could not load yet.");
      renderResults(Array.isArray(data.results)?data.results:[],radiusMiles,category.label);
    }catch(error){
      console.error("CampResources search failed",error);
      setStatus("Resources could not load yet.");
      if(list) list.innerHTML=`<div class="campresources-error">${esc(String(error?.message||"The API needs a Google Places key and Functions deploy."))}</div>`;
    }
  }

  function prefillCampZip(){
    const input=qs("campResourcesZip");
    if(!input) return "";
    const zip=getCampZipFromKnownSources();
    if(zip && !input.value.trim()) input.value=zip;
    return input.value.trim();
  }

  function initCampResources(){
    const root=document.getElementById("campresources");
    if(!root) return;
    if(boundRoot === root && qs("campResourcesCategories")?.children?.length) return;
    boundRoot = root;
    renderCategories();
    qs("campResourcesRadius")?.addEventListener("change",loadCampResources);
    qs("campResourcesZip")?.addEventListener("change",loadCampResources);
    const zip=prefillCampZip();
    if(zip && !didAutoSearch){didAutoSearch=true; window.setTimeout(loadCampResources,120);}
    else if(!zip){setStatus("Enter a camp ZIP code, then choose a category.");}
  }

  window.initCampResources=initCampResources;
  window.loadCampResources=loadCampResources;
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",initCampResources);
  else initCampResources();
})();