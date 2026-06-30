(function(){
  const categories=[["fuel","⛽ Fuel","gas station convenience store fuel"],["food","🍔 Food / Ice","bar restaurant diner supper club ice"],["hunting","🏹 Hunting Gear","sporting goods hunting supplies bait tackle"],["beer","🥃 Beer & Liquor","liquor store beer wine spirits"],["groceries","🛒 Groceries","grocery store supermarket"],["auto","🚗 Auto Repair","auto repair tire service"],["general","🛍 General Store","department store walmart target general store"],["hardware","🔨 Hardware","hardware store farm fleet tractor supply"],["medical","🚑 Medical","urgent care hospital pharmacy"],["processors","🦌 Deer Processors","deer processing meat processor butcher"],["taxidermists","🏆 Taxidermists","taxidermist deer mounts"],["propane","🔥 Propane","propane firewood"]].map(([id,label,query])=>({id,label,query}));
  let activeCategory=categories[0].id,activeStrategy="sah",didAutoSearch=false,boundRoot=null,campMemberCache=[]; const pack=new Map(); const selectedRecipientEmails=new Set();
  let masterStaples=[], assignedStaplesByHunter={}, laborLoaded=false;
  function esc(v){return String(v??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]));}
  function qs(id){return document.getElementById(id);}
  function setStatus(m){const s=qs("campResourcesStatus");if(s)s.textContent=m;}
  function getSelectedZip(){syncMissionZip();return String(qs("campResourcesZip")?.value||"").trim();}
  function getStartZip(){return String(qs("campResourcesStartZip")?.value||"").trim();}
  function getEndZip(){return String(qs("campResourcesEndZip")?.value||qs("campResourcesZip")?.value||"").trim();}
  function getStrategyLabel(){return activeStrategy==="s2c"?"S2C - Shop to Camp":activeStrategy==="snc"?"SNC - Shop Near Camp":"SAH - Shop at Home";}
  function syncMissionZip(){const hidden=qs("campResourcesZip"); if(!hidden)return; const start=getStartZip(),end=getEndZip(); hidden.value=activeStrategy==="snc"?end:(start||end);}
  function setRadiusOptions(options,selected){
    const radius=qs("campResourcesRadius"); if(!radius)return;
    const current=String(radius.value||"");
    const keep=options.some(o=>String(o[0])===current);
    radius.innerHTML=options.map(([v,l])=>`<option value="${esc(v)}" ${String(keep?current:selected)===String(v)?"selected":""}>${esc(l)}</option>`).join("");
  }
  function updateStrategyUI(){
    document.querySelectorAll("[data-strategy]").forEach(btn=>btn.classList.toggle("active",btn.dataset.strategy===activeStrategy));
    const note=qs("campResourcesStrategyNote"),label=qs("campResourcesRadiusLabel");
    if(activeStrategy==="s2c"){
      setRadiusOptions([["5","5 miles"],["10","10 miles"],["15","15 miles"]],"5");
      if(note)note.textContent="S2C searches the hunter's route from Start ZIP to Camp ZIP. Results should be treated as a travel corridor and sorted by convenience/off-route distance.";
      if(label)label.textContent="Route Corridor";
    }else if(activeStrategy==="snc"){
      setRadiusOptions([["10","10 miles"],["20","20 miles"],["30","30 miles"],["50","50 miles"]],"20");
      if(note)note.textContent="SNC searches a circle around the Camp / End ZIP for near-camp stops.";
      if(label)label.textContent="Search Radius";
    }else{
      setRadiusOptions([["10","10 miles"],["20","20 miles"],["30","30 miles"],["50","50 miles"]],"20");
      if(note)note.textContent="SAH searches a circle around the hunter's starting ZIP.";
      if(label)label.textContent="Search Radius";
    }
    syncMissionZip();
  }
  function getRadiusMiles(){return Number(qs("campResourcesRadius")?.value||25);}
  function getActiveCategory(){return categories.find(c=>c.id===activeCategory)||categories[0];}
  function getCampId(){const p=new URLSearchParams(location.search);return p.get("campId")||p.get("camp")||window.activeCampId||window.currentCampId||"camp-swede-cornell-wi-54732";}
  function getCampZip(){const txt=document.querySelector(".camp-meta")?.textContent||document.body?.innerText||"";const m=txt.match(/\b\d{5}(?:-\d{4})?\b/);return m?m[0]:"";}
  function addMembers(src,out,seenObjs=new WeakSet()){
    if(!src)return;
    if(typeof src==="object"){if(seenObjs.has(src))return;seenObjs.add(src)}
    if(Array.isArray(src)){src.forEach(x=>addMembers(x,out,seenObjs));return;}
    if(typeof src==="object"){
      const name=String(src.name||src.displayName||src.memberName||src.firstName||src.nickname||"").trim();
      const email=String(src.email||src.memberEmail||src.contactEmail||"").trim();
      if(((name&&name!=="[object Object]")||email)&&email.includes("@"))out.push({name:name||email,email});
      ["members","campMembers","memberProfiles","dashboardMembers","dashboardPeople"].forEach(k=>addMembers(src[k],out,seenObjs));
    }
  }
  function collectLocalMembers(){
    const out=[];
    ["currentCamp","campData","camp","activeCamp","loadedCamp","currentCampDoc","campDoc","members","campMembers","memberProfiles","dashboardMembers","dashboardPeople"].forEach(k=>addMembers(window[k],out));
    return out;
  }
  function dedupeMembers(items){
    const seen=new Set(),ded=[];
    items.forEach(m=>{const email=String(m.email||"").trim();const name=String(m.name||email||"").trim();const key=email.toLowerCase();if(!email.includes("@")||seen.has(key))return;seen.add(key);ded.push({name:name||email,email});});
    return ded;
  }
  function renderHunterOptions(members){
    const select=qs("campResourcesHunter"); if(!select) return;
    const current=select.value;
    const ded=dedupeMembers(members||campMemberCache||[]);
    select.innerHTML='<option value="">Select hunter</option>'+ded.map(m=>`<option value="${esc(m.email)}" data-name="${esc(m.name||m.email)}">${esc(m.name||m.email)}</option>`).join("");
    if(current) select.value=current;
    const selected=ded.find(m=>m.email===select.value)||ded[0];
    if(!select.value && selected) select.value=selected.email;
  }
  function getFirebaseApiKey(){
    try{
      const apps = window.firebase?.apps || [];
      const opts = apps[0]?.options || {};
      if(opts.apiKey) return opts.apiKey;
    }catch(_){}
    try{
      const txt=[...document.scripts].map(s=>s.textContent||"").join("\n");
      const m=txt.match(/apiKey\s*:\s*["']([^"']+)["']/);
      return m?m[1]:"";
    }catch(_){return "";}
  }
  function parseFirestoreValue(v){
    if(!v) return undefined;
    if("stringValue" in v) return v.stringValue;
    if("integerValue" in v) return Number(v.integerValue);
    if("doubleValue" in v) return Number(v.doubleValue);
    if("booleanValue" in v) return !!v.booleanValue;
    if("timestampValue" in v) return v.timestampValue;
    if("arrayValue" in v) return (v.arrayValue.values||[]).map(parseFirestoreValue);
    if("mapValue" in v){const o={};Object.entries(v.mapValue.fields||{}).forEach(([k,val])=>o[k]=parseFirestoreValue(val));return o;}
    return undefined;
  }
  async function fetchCampMembersFromFirestore(){
    const campId=getCampId();
    if(!campId) return [];
    try{
      if(window.firebase?.firestore){
        const snap=await window.firebase.firestore().doc(`camps/${campId}`).get();
        const data=snap.exists?snap.data():null;
        const out=[]; addMembers(data,out); return dedupeMembers(out);
      }
    }catch(error){console.warn("CampResources compat Firestore member lookup failed",error);}
    try{
      const key=getFirebaseApiKey();
      if(!key) return [];
      const project=(location.hostname.includes("staging")?"deercamp-staging":"deercamp-47c12");
      const url=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/camps/${encodeURIComponent(campId)}?key=${encodeURIComponent(key)}`;
      const res=await fetch(url);
      if(!res.ok) return [];
      const raw=await res.json();
      const data={}; Object.entries(raw.fields||{}).forEach(([k,v])=>data[k]=parseFirestoreValue(v));
      const out=[]; addMembers(data,out); return dedupeMembers(out);
    }catch(error){console.warn("CampResources REST member lookup failed",error);}
    return [];
  }
  function syncRecipientSelections(){
    document.querySelectorAll(".campresources-member-recipient").forEach(input=>{
      input.addEventListener("change",()=>{
        const key=String(input.value||"").toLowerCase();
        if(!key) return;
        if(input.checked) selectedRecipientEmails.add(key);
        else selectedRecipientEmails.delete(key);
      });
    });
  }
  function renderMemberChecks(members){
    const wrap=qs("campResourcesMemberChecks");if(!wrap)return;
    const ded=dedupeMembers(members||[]);
    campMemberCache=ded;
    renderHunterOptions(ded);
    const currentChecked=Array.from(document.querySelectorAll(".campresources-member-recipient:checked")).map(i=>String(i.value||"").toLowerCase());
    currentChecked.forEach(v=>{ if(v) selectedRecipientEmails.add(v); });
    if(!ded.length){wrap.innerHTML='<span class="campresources-muted">No camp member emails found yet. Use manual email.</span>';return;}
    wrap.innerHTML=ded.map(m=>{
      const email=String(m.email||"");
      const checked=selectedRecipientEmails.has(email.toLowerCase()) ? "checked" : "";
      return `<label class="campresources-member-check"><input type="checkbox" class="campresources-member-recipient" value="${esc(email)}" data-name="${esc(m.name||email)}" ${checked}><span>${esc(m.name||email)}</span></label>`;
    }).join("");
    syncRecipientSelections();
  }
  async function populateMemberChecks(){
    const local=dedupeMembers(collectLocalMembers());
    if(local.length){renderMemberChecks(local);return;}
    if(campMemberCache.length){renderMemberChecks(campMemberCache);return;}
    renderMemberChecks([]);
    const fetched=await fetchCampMembersFromFirestore();
    if(fetched.length) renderMemberChecks(fetched);
  }
  function forceRecipientChecklist(){
    const packEl=qs("campResourcesPack"); if(!packEl) return;
    if(!qs("campResourcesMemberChecks")){
      const actions=packEl.querySelector(".campresources-pack-actions"); 
      if(actions){
        actions.innerHTML=`<button id="campResourcesEmailBtn" class="btn" type="button">Email Resource Pack</button><button id="campResourcesClearBtn" class="btn btn-secondary" type="button">Clear Pack</button>`;
        const recip=document.createElement("div"); recip.className="campresources-pack-recipients"; 
        recip.innerHTML=`<div><span class="label">Send to camp member(s)</span><div id="campResourcesMemberChecks" class="campresources-member-checks"><span class="campresources-muted">Loading camp members...</span></div></div><label class="campresources-pack-manual"><span class="label">Or email</span><input id="campResourcesManualEmail" class="input" type="email" placeholder="name@example.com"></label>`;
        actions.parentNode.insertBefore(recip,actions);
      }
    }
    qs("campResourcesEmailBtn")?.addEventListener("click",emailResourcePack);
    qs("campResourcesClearBtn")?.addEventListener("click",clearPack);
  }
  function currentHunterKey(){const s=qs("campResourcesHunter");return String(s?.value||selectedHunterName()||"default").trim()||"default";}
  function stapleSlug(text){return String(text||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"item";}
  function parseStaplesText(text){
    return String(text||"").split(/\n+/).map(x=>x.trim()).filter(Boolean).map((text,idx)=>({id:`staple-${idx}-${stapleSlug(text)}`,text}));
  }
  function pruneAssignedStaples(){
    const valid=new Set(masterStaples.map(i=>i.id));
    Object.keys(assignedStaplesByHunter).forEach(key=>{assignedStaplesByHunter[key]=(assignedStaplesByHunter[key]||[]).filter(i=>valid.has(i.id));});
  }
  function loadMasterStaples(){
    masterStaples=parseStaplesText(qs("campResourcesMasterStaples")?.value||"");
    laborLoaded=true;
    pruneAssignedStaples();
    renderLaborBoard();
  }
  function assignedIds(){const ids=new Set();Object.values(assignedStaplesByHunter).forEach(list=>(list||[]).forEach(i=>ids.add(i.id)));return ids;}
  function getHunterAssignedStaples(){return assignedStaplesByHunter[currentHunterKey()]||[];}
  function updateLaborCounters(remaining,assigned,total){
    const remCount=qs("campResourcesRemainingCount"), hunterCount=qs("campResourcesHunterOrderCount"), loaded=qs("campResourcesLoadedStatus");
    if(remCount) remCount.textContent=laborLoaded?`${remaining.length} remaining of ${total}`:"Not loaded";
    if(hunterCount) hunterCount.textContent=`${assigned.length} assigned`;
    if(loaded) loaded.textContent=laborLoaded?`Master list loaded: ${total} item${total===1?"":"s"}`:"Paste list, then tap Load Master List";
  }
  function renderLaborBoard(){
    const rem=qs("campResourcesRemainingStaples"),order=qs("campResourcesHunterOrder");
    if(!rem||!order)return;
    if(!laborLoaded){
      const raw=String(qs("campResourcesMasterStaples")?.value||"").trim();
      if(raw){ masterStaples=parseStaplesText(raw); laborLoaded=true; pruneAssignedStaples(); }
    }
    const used=assignedIds();
    const remaining=masterStaples.filter(i=>!used.has(i.id));
    const assigned=getHunterAssignedStaples();
    updateLaborCounters(remaining,assigned,masterStaples.length);
    if(!laborLoaded){
      rem.innerHTML='<span class="campresources-muted">Paste the master camp shopping list, then tap Load Master List.</span>';
    }else if(!masterStaples.length){
      rem.innerHTML='<span class="campresources-muted">No camp staples loaded yet. Add one item per line above.</span>';
    }else if(remaining.length){
      rem.innerHTML=remaining.map(i=>`<label class="campresources-labor-item campresources-labor-pick"><input type="checkbox" class="campresources-staple-pick" value="${esc(i.id)}"><span>${esc(i.text)}</span></label>`).join("");
    }else{
      rem.innerHTML='<span class="campresources-complete">✅ 0 items remaining. All camp staples have been assigned.</span>';
    }
    rem.querySelectorAll(".campresources-staple-pick").forEach(input=>{
      input.addEventListener("change",()=>input.closest(".campresources-labor-item")?.classList.toggle("is-selected",input.checked));
    });
    order.innerHTML=assigned.length?assigned.map(i=>`<div class="campresources-labor-item is-assigned"><span>${esc(i.text)}<small>Assigned to ${esc(selectedHunterName()||"selected hunter")}</small></span><button class="campresources-labor-remove" type="button" data-staple-remove="${esc(i.id)}" aria-label="Return ${esc(i.text)} to available staples">↩</button></div>`).join(""):'<span class="campresources-muted">No staples/resources assigned to this hunter yet. Check items on the left, then tap Assign Checked Items.</span>';
    order.querySelectorAll("[data-staple-remove]").forEach(btn=>btn.addEventListener("click",()=>removeAssignedStaple(btn.dataset.stapleRemove||"")));
  }
  function assignSelectedStaples(){
    if(!laborLoaded) loadMasterStaples();
    const picks=Array.from(document.querySelectorAll(".campresources-staple-pick:checked")).map(i=>i.value);
    const status=qs("campResourcesLaborStatus")||qs("campResourcesPackStatus")||qs("campResourcesStatus");
    if(!picks.length){ if(status) status.textContent="Check one or more Available Camp Staples, then tap Assign Checked Items."; return; }
    const key=currentHunterKey();
    const existing=assignedStaplesByHunter[key]||[];
    const add=masterStaples.filter(i=>picks.includes(i.id));
    const seen=new Set(existing.map(i=>i.id));
    assignedStaplesByHunter[key]=existing.concat(add.filter(i=>!seen.has(i.id)));
    if(status) status.textContent=`Assigned ${add.length} item${add.length===1?"":"s"} to ${selectedHunterName()||"the selected hunter"}.`;
    renderLaborBoard();
  }
  function removeAssignedStaple(id){
    const key=currentHunterKey();
    assignedStaplesByHunter[key]=(assignedStaplesByHunter[key]||[]).filter(i=>i.id!==id);
    const status=qs("campResourcesLaborStatus")||qs("campResourcesPackStatus")||qs("campResourcesStatus");
    if(status) status.textContent=`Returned item to Available Camp Staples.`;
    renderLaborBoard();
  }
  function bindLaborControls(){
    qs("campResourcesLoadStaplesBtn")?.addEventListener("click",loadMasterStaples);
    qs("campResourcesAssignStapleBtn")?.addEventListener("click",assignSelectedStaples);
    qs("campResourcesMasterStaples")?.addEventListener("input",()=>{ laborLoaded=false; masterStaples=[]; renderLaborBoard(); });
    qs("campResourcesHunter")?.addEventListener("change",()=>{renderLaborBoard();populateMemberChecks();});
  }
  function bindMissionDateControls(){
    const start=qs("campResourcesMissionStart"), end=qs("campResourcesMissionEnd");
    if(!start||!end||start.dataset.missionDateBound==="1") return;
    start.dataset.missionDateBound="1";
    start.addEventListener("change",()=>{
      if(!start.value) return;
      end.min=start.value;
      if(!end.value || end.value < start.value) end.value=start.value;
      try{ end.showPicker?.(); }catch(_){}
    });
    end.addEventListener("focus",()=>{
      if(start.value){ end.min=start.value; if(!end.value || end.value < start.value) end.value=start.value; }
    });
  }
  function renderCategories(){
    const w=qs("campResourcesCategories");
    if(!w)return;
    w.innerHTML=categories.map(c=>`<button type="button" class="campresources-chip ${c.id===activeCategory?"active":""}" data-campresources-category="${esc(c.id)}">${c.label}</button>`).join("");
    w.querySelectorAll("[data-campresources-category]").forEach(b=>b.addEventListener("click",()=>{
      activeCategory=b.getAttribute("data-campresources-category")||activeCategory;
      renderCategories();
      loadCampResources();
    }));
  }
  function placeKey(p,cid){
    return String(p.placeId||`${cid}:${p.name}:${p.address}`).toLowerCase();
  }
  function togglePack(place,cat){
    const key=placeKey(place,cat.id);
    if(pack.has(key)) pack.delete(key);
    else pack.set(key,{key,categoryId:cat.id,categoryLabel:cat.label,name:place.name||"Unknown place",address:place.address||"",phone:place.phone||"",website:place.website||"",mapsUrl:place.mapsUrl||"",rating:place.rating||"",distanceMiles:place.distanceMiles});
    renderPack();
  }
  function renderPack(){
    const tray=qs("campResourcesPack"),count=qs("campResourcesPackCount"),list=qs("campResourcesPackList");
    if(!tray||!count||!list)return;
    forceRecipientChecklist();
    tray.hidden=pack.size===0;
    count.textContent=`${pack.size} selected`;
    list.innerHTML=Array.from(pack.values()).map(i=>`<span class="campresources-pack-pill"><span>${esc(i.categoryLabel.replace(/^[^A-Za-z0-9]+/,""))}: ${esc(i.name)}</span><button class="campresources-pack-remove" type="button" data-pack-remove="${esc(i.key)}">×</button></span>`).join("");
    list.querySelectorAll("[data-pack-remove]").forEach(btn=>btn.addEventListener("click",()=>{
      const key=btn.dataset.packRemove||"";
      pack.delete(key);
      renderPack();
      document.querySelectorAll(".campresources-result-check").forEach(i=>{if(i.value===key)i.checked=false;});
    }));
    populateMemberChecks();
  }
  function renderResults(items,radiusMiles,categoryLabel,showAll=false){
    const list=qs("campResourcesList"),cat=getActiveCategory();
    if(!list)return;
    if(!items.length){
      list.innerHTML="";
      setStatus(`No matching resources were found within ${radiusMiles} miles. Increase the search radius or choose another strategy.`);
      return;
    }
    setStatus(`${items.length} ${categoryLabel.replace(/^[^A-Za-z0-9]+/,"")} found within ${radiusMiles} miles.`);
    const visible=showAll?items:items.slice(0,5);
    list.innerHTML=visible.map(p=>{
      const key=placeKey(p,cat.id);
      return `<article class="campresources-card"><label class="campresources-check"><input class="campresources-result-check" type="checkbox" value="${esc(key)}" ${pack.has(key)?"checked":""}></label><div><strong>${esc(p.name||"Unknown place")}</strong><p class="campresources-muted">${esc(p.address||"")}</p><p class="campresources-muted">${p.distanceMiles?`${Number(p.distanceMiles).toFixed(1)} miles away`:""}${p.openNow===true?" · Open now":p.openNow===false?" · Closed now":""}${p.rating?` · ⭐ ${esc(p.rating)}`:""}</p></div><div class="campresources-actions">${p.phone?`<a href="tel:${esc(p.phone)}">Call</a>`:""}${p.website?`<a href="${esc(p.website)}" target="_blank" rel="noopener">Website</a>`:""}${p.mapsUrl?`<a href="${esc(p.mapsUrl)}" target="_blank" rel="noopener">Directions</a>`:""}</div></article>`;
    }).join("");
    list.querySelectorAll(".campresources-result-check").forEach((input,idx)=>input.addEventListener("change",()=>togglePack(visible[idx],cat)));
    if(!showAll&&items.length>5){
      const more=document.createElement("button");
      more.type="button";
      more.className="campresources-more";
      more.textContent=`See More... (${items.length-5} more)`;
      more.addEventListener("click",()=>renderResults(items,radiusMiles,categoryLabel,true));
      list.appendChild(more);
    }
  }
  async function loadCampResources(){
    syncMissionZip();
    const zip=getSelectedZip(),radiusMiles=getRadiusMiles(),cat=getActiveCategory(),list=qs("campResourcesList");
    if(list)list.innerHTML="";
    if(activeStrategy==="s2c"&&(!getStartZip()||!getEndZip())){setStatus("Enter both Start ZIP and Camp / End ZIP for S2C.");return;}
    if(!zip){setStatus("Enter a ZIP code, then choose a category.");return;}
    setStatus(`Searching ${cat.label.replace(/^[^A-Za-z0-9]+/,"")} near ${activeStrategy==="s2c"?"the route start ZIP":activeStrategy==="snc"?"camp":"home"}...`);
    try{
      const res=await fetch("/api/campResources",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({zip,radiusMiles,categoryId:cat.id,query:cat.query,strategy:activeStrategy,startZip:getStartZip(),endZip:getEndZip()})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||"Resources could not load yet.");
      const results=(Array.isArray(data.results)?data.results:[]).filter(p=>!p.distanceMiles || Number(p.distanceMiles)<=radiusMiles+0.25);
      renderResults(results,radiusMiles,cat.label,false);
    }catch(e){
      console.error(e);
      setStatus("Resources could not load yet.");
      if(list)list.innerHTML=`<div class="campresources-error">${esc(String(e?.message||"The API needs a Google Places key and Functions deploy."))}</div>`;
    }
  }
  function recipients(){Array.from(document.querySelectorAll(".campresources-member-recipient")).forEach(i=>{const key=String(i.value||"").toLowerCase(); if(i.checked) selectedRecipientEmails.add(key); else selectedRecipientEmails.delete(key);}); const a=Array.from(document.querySelectorAll(".campresources-member-recipient:checked")).map(i=>({email:i.value,name:i.dataset.name||i.value}));const manual=String(qs("campResourcesManualEmail")?.value||"").trim();if(manual)a.push({email:manual,name:manual});const seen=new Set();return a.filter(r=>r.email&&r.email.includes("@")&&!seen.has(r.email.toLowerCase())&&seen.add(r.email.toLowerCase()));}
  function selectedHunterName(){const s=qs("campResourcesHunter");const o=s?.selectedOptions?.[0];return (o?.dataset?.name||o?.textContent||"").trim();}
  function missionLines(names){
    const lines=[];
    const mission=String(qs("campResourcesMissionName")?.value||"Trip Prep Mission").trim();
    const startDate=String(qs("campResourcesMissionStart")?.value||"").trim();
    const endDate=String(qs("campResourcesMissionEnd")?.value||"").trim();
    const hunter=selectedHunterName();
    lines.push(mission);lines.push("=".repeat(mission.length));
    if(startDate||endDate)lines.push(`Dates: ${startDate||"TBD"}${endDate?` to ${endDate}`:""}`);
    if(hunter)lines.push(`Hunter: ${hunter}`);
    if(names.length)lines.push(`Recipients: ${names.join(", ")}`);
    lines.push(`Shopping Strategy: ${getStrategyLabel()}`);
    if(getStartZip())lines.push(`Start ZIP: ${getStartZip()}`);
    if(getEndZip())lines.push(`Camp / End ZIP: ${getEndZip()}`);
    lines.push(activeStrategy==="s2c"?`Search Corridor: ${getRadiusMiles()} miles from route centerline each side`:`Search Radius: ${getRadiusMiles()} miles`);
    lines.push("");
    const breakfast=String(qs("campResourcesBreakfast")?.value||"").trim();
    const lunch=String(qs("campResourcesLunch")?.value||"").trim();
    const dinner=String(qs("campResourcesDinner")?.value||"").trim();
    const staples=String(qs("campResourcesStaples")?.value||"").trim();
    const notes=String(qs("campResourcesStewardNotes")?.value||"").trim();
    const assigned=getHunterAssignedStaples();
    lines.push("Your Assignments");lines.push("----------------");
    if(breakfast)lines.push(`Breakfast: ${breakfast}`);
    if(lunch)lines.push(`Lunch: ${lunch}`);
    if(dinner)lines.push(`Dinner: ${dinner}`);
    if(assigned.length||staples){
      lines.push("");lines.push("Camp Staples / Resources:");
      assigned.forEach(i=>lines.push(`- ${i.text}`));
      staples.split(/\n+/).map(x=>x.trim()).filter(Boolean).forEach(x=>lines.push(`- ${x}`));
    }
    if(notes){lines.push("");lines.push("Steward Notes:");lines.push(notes);}
    lines.push("");
    return lines;
  }
  function emailBody(names){const grouped={};Array.from(pack.values()).forEach(i=>{const label=i.categoryLabel.replace(/^[^A-Za-z0-9]+/,"").trim();(grouped[label]||=[]).push(i)});const lines=missionLines(names);lines.push("Suggested Stops / Resource Pack");lines.push("-------------------------------");if(!pack.size){lines.push("No stops selected yet.");}Object.keys(grouped).sort().forEach(label=>{lines.push("");lines.push(label);lines.push("-".repeat(label.length));grouped[label].forEach(i=>{lines.push(i.name);if(i.address)lines.push(`Address: ${i.address}`);if(i.distanceMiles)lines.push(`Distance: ${Number(i.distanceMiles).toFixed(1)} miles`);if(i.phone)lines.push(`Phone: ${i.phone}`);if(i.website)lines.push(`Website: ${i.website}`);if(i.mapsUrl)lines.push(`Directions: ${i.mapsUrl}`);lines.push("")});});lines.push("");lines.push("Sent from DeerCamp CampResources Mission Center.");return lines.join("\n")}
  function emailResourcePack(){const status=qs("campResourcesPackStatus");const rec=recipients();if(!rec.length){if(status)status.textContent="Choose at least one member or enter an email address.";return}const mission=String(qs("campResourcesMissionName")?.value||"Trip Prep Mission").trim();window.location.href=`mailto:${encodeURIComponent(rec.map(r=>r.email).join(","))}?subject=${encodeURIComponent(`DeerCamp ${mission}`)}&body=${encodeURIComponent(emailBody(rec.map(r=>r.name)))}`;}
  function clearPack(){pack.clear();renderPack();document.querySelectorAll(".campresources-result-check").forEach(i=>i.checked=false)}
  function initCampResources(){const root=document.getElementById("campresources");if(!root)return;forceRecipientChecklist();if(boundRoot===root&&qs("campResourcesCategories")?.children?.length)return;boundRoot=root;renderCategories();populateMemberChecks();renderPack();bindLaborControls();bindMissionDateControls();loadMasterStaples();renderLaborBoard();document.querySelectorAll("[data-strategy]").forEach(btn=>btn.addEventListener("click",()=>{activeStrategy=btn.dataset.strategy||"sah";updateStrategyUI();loadCampResources();}));["campResourcesRadius","campResourcesStartZip","campResourcesEndZip"].forEach(id=>qs(id)?.addEventListener("change",()=>{syncMissionZip();loadCampResources();}));qs("campResourcesEmailBtn")?.addEventListener("click",emailResourcePack);qs("campResourcesClearBtn")?.addEventListener("click",clearPack);const end=qs("campResourcesEndZip"),hidden=qs("campResourcesZip");if(end&&!end.value.trim())end.value=getCampZip();if(hidden&&!hidden.value.trim())hidden.value=end?.value||getCampZip();updateStrategyUI();if(hidden?.value&&!didAutoSearch){didAutoSearch=true;setTimeout(loadCampResources,120)}}
  window.initCampResources=initCampResources;window.loadCampResources=loadCampResources;if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initCampResources);else initCampResources(); setInterval(()=>{if(document.getElementById("campresources")){forceRecipientChecklist(); if(!document.querySelector(".campresources-member-recipient")) populateMemberChecks();}},2500);
})();