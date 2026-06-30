(function(){
  const categories=[["fuel","⛽ Fuel","gas station convenience store fuel"],["food","🍔 Food / Ice","bar restaurant diner supper club ice"],["hunting","🏹 Hunting Gear","sporting goods hunting supplies bait tackle"],["beer","🥃 Beer & Liquor","liquor store beer wine spirits"],["groceries","🛒 Groceries","grocery store supermarket"],["auto","🚗 Auto Repair","auto repair tire service"],["general","🛍 General Store","department store walmart target general store"],["hardware","🔨 Hardware","hardware store farm fleet tractor supply"],["medical","🚑 Medical","urgent care hospital pharmacy"],["processors","🦌 Deer Processors","deer processing meat processor butcher"],["taxidermists","🏆 Taxidermists","taxidermist deer mounts"],["propane","🔥 Propane","propane firewood"]].map(([id,label,query])=>({id,label,query}));
  let activeCategory=categories[0].id,activeStrategy="sah",didAutoSearch=false,boundRoot=null,campMemberCache=[]; const pack=new Map(); const selectedRecipientEmails=new Set(); let masterStaples=[]; const assignedStaplesByHunter=new Map();
  function esc(v){return String(v??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]));}
  function qs(id){return document.getElementById(id);}
  function setStatus(m){const s=qs("campResourcesStatus");if(s)s.textContent=m;}
  function getSelectedZip(){syncMissionZip();return String(qs("campResourcesZip")?.value||"").trim();}
  function getStartZip(){return String(qs("campResourcesStartZip")?.value||"").trim();}
  function getEndZip(){return String(qs("campResourcesEndZip")?.value||qs("campResourcesZip")?.value||"").trim();}
  function getStrategyLabel(){return activeStrategy==="s2c"?"S2C - Shop to Camp":activeStrategy==="snc"?"SNC - Shop Near Camp":"SAH - Shop at Home";}
  function syncMissionZip(){
    const hidden=qs("campResourcesZip"); if(!hidden)return;
    const start=getStartZip(),end=getEndZip();
    if(activeStrategy==="snc") hidden.value=end;
    else if(activeStrategy==="s2c") hidden.value=start;
    else hidden.value=start||end;
  }
  function setRadiusOptions(options,preferred){
    const radius=qs("campResourcesRadius"); if(!radius) return;
    const current=String(radius.value||"");
    const allowed=options.map(o=>String(o.value));
    radius.innerHTML=options.map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("");
    radius.value=allowed.includes(current)?current:String(preferred||options[0]?.value||"");
  }
  function syncMissionDates(){
    const start=qs("campResourcesMissionStart"), end=qs("campResourcesMissionEnd");
    if(!start||!end) return;
    if(start.value){
      end.min=start.value;
      if(!end.value || end.value<start.value) end.value=start.value;
    }
  }
  function updateStrategyUI(){
    document.querySelectorAll("[data-strategy]").forEach(btn=>btn.classList.toggle("active",btn.dataset.strategy===activeStrategy));
    const note=qs("campResourcesStrategyNote"),label=qs("campResourcesRadiusLabel"),radius=qs("campResourcesRadius");
    if(activeStrategy==="s2c"){
      setRadiusOptions([{value:5,label:"5 miles"},{value:10,label:"10 miles"},{value:15,label:"15 miles"}],5);
      if(note)note.textContent="S2C uses the hunter's Start ZIP and Camp / End ZIP. V2.2 limits route-corridor choices to 5, 10, or 15 miles so stops stay practical on the way to camp.";
      if(label)label.textContent="Route Corridor";
    }else if(activeStrategy==="snc"){
      setRadiusOptions([{value:10,label:"10 miles"},{value:20,label:"20 miles"},{value:30,label:"30 miles"},{value:50,label:"50 miles"}],20);
      if(note)note.textContent="SNC searches a circle around the Camp / End ZIP for near-camp stops.";
      if(label)label.textContent="Search Radius";
    }else{
      setRadiusOptions([{value:10,label:"10 miles"},{value:20,label:"20 miles"},{value:30,label:"30 miles"},{value:50,label:"50 miles"}],20);
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
  function renderCategories(){const w=qs("campResourcesCategories");if(!w)return;w.innerHTML=categories.map(c=>`<button type="button" class="campresources-chip ${c.id===activeCategory?"active":""}" data-campresources-category="${esc(c.id)}">${c.label}</button>`).join("");w.querySelectorAll("[data-campresources-category]").forEach(b=>b.addEventListener("click",()=>{activeCategory=b.getAttribute("data-campresources-category")||activeCategory;renderCategories();loadCampResources();}));}
  function placeKey(p,cid){return String(p.placeId||`${cid}:${p.name}:${p.address}`).toLowerCase();}
  function togglePack(place,cat){const key=placeKey(place,cat.id);if(pack.has(key))pack.delete(key);else pack.set(key,{key,categoryId:cat.id,categoryLabel:cat.label,name:place.name||"Unknown place",address:place.address||"",phone:place.phone||"",website:place.website||"",mapsUrl:place.mapsUrl||"",rating:place.rating||"",distanceMiles:place.distanceMiles});renderPack();}
  function renderPack(){const tray=qs("campResourcesPack"),count=qs("campResourcesPackCount"),list=qs("campResourcesPackList");if(!tray||!count||!list)return;forceRecipientChecklist();tray.hidden=pack.size===0;count.textContent=`${pack.size} selected`;list.innerHTML=Array.from(pack.values()).map(i=>`<span class="campresources-pack-pill"><span>${esc(i.categoryLabel.replace(/^[^A-Za-z0-9]+/,""))}: ${esc(i.name)}</span><button class="campresources-pack-remove" type="button" data-pack-remove="${esc(i.key)}">×</button></span>`).join("");list.querySelectorAll("[data-pack-remove]").forEach(btn=>btn.addEventListener("click",()=>{const key=btn.dataset.packRemove||"";pack.delete(key);renderPack();document.querySelectorAll(".campresources-result-check").forEach(i=>{if(i.value===key)i.checked=false})}));populateMemberChecks();}
  function renderResults(items,radiusMiles,categoryLabel,showAll=false){const list=qs("campResourcesList"),cat=getActiveCategory();if(!list)return;if(!items.length){list.innerHTML="";setStatus(`No matching resources were found within ${radiusMiles} miles of your camp ZIP code. Increase the search radius to expand your results.`);return;}setStatus(`${items.length} ${categoryLabel.replace(/^[^A-Za-z0-9]+/,"")} found within ${radiusMiles} miles.`);const visible=showAll?items:items.slice(0,5);list.innerHTML=visible.map(p=>{const key=placeKey(p,cat.id);return `<article class="campresources-card"><label class="campresources-check"><input class="campresources-result-check" type="checkbox" value="${esc(key)}" ${pack.has(key)?"checked":""}></label><div><strong>${esc(p.name||"Unknown place")}</strong><p class="campresources-muted">${esc(p.address||"")}</p><p class="campresources-muted">${p.distanceMiles?`${Number(p.distanceMiles).toFixed(1)} miles away`:""}${p.openNow===true?" · Open now":p.openNow===false?" · Closed now":""}${p.rating?` · ⭐ ${esc(p.rating)}`:""}</p></div><div class="campresources-actions">${p.phone?`<a href="tel:${esc(p.phone)}">Call</a>`:""}${p.website?`<a href="${esc(p.website)}" target="_blank" rel="noopener">Website</a>`:""}${p.mapsUrl?`<a href="${esc(p.mapsUrl)}" target="_blank" rel="noopener">Directions</a>`:""}</div></article>`}).join("");list.querySelectorAll(".campresources-result-check").forEach((input,idx)=>input.addEventListener("change",()=>togglePack(visible[idx],cat)));if(!showAll&&items.length>5){const more=document.createElement("button");more.type="button";more.className="campresources-more";more.textContent=`See More... (${items.length-5} more)`;more.addEventListener("click",()=>renderResults(items,radiusMiles,categoryLabel,true));list.appendChild(more);}}
  async function loadCampResources(){
    const zip=getSelectedZip(),radiusMiles=getRadiusMiles(),cat=getActiveCategory(),list=qs("campResourcesList");
    if(list)list.innerHTML="";
    if(activeStrategy==="s2c" && (!getStartZip()||!getEndZip())){setStatus("Enter both Start ZIP and Camp / End ZIP for S2C.");return;}
    if(!zip){setStatus(activeStrategy==="snc"?"Enter a Camp / End ZIP, then choose a category.":"Enter a Start ZIP, then choose a category.");return;}
    const searchMode=activeStrategy==="s2c"?"S2C route-corridor preview":"nearby resources";
    setStatus(`Searching ${searchMode}...`);
    try{
      const res=await fetch("/api/campResources",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({zip,radiusMiles,categoryId:cat.id,query:cat.query,strategy:activeStrategy,startZip:getStartZip(),endZip:getEndZip(),corridorMiles:activeStrategy==="s2c"?radiusMiles:null})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(data.error||"Resources could not load yet.");
      const results=(Array.isArray(data.results)?data.results:[]).filter(p=>!p.distanceMiles || Number(p.distanceMiles)<=radiusMiles+0.25);
      renderResults(results,radiusMiles,cat.label,false);
    }catch(e){console.error(e);setStatus("Resources could not load yet.");if(list)list.innerHTML=`<div class="campresources-error">${esc(String(e?.message||"The API needs a Google Places key and Functions deploy."))}</div>`;}
  }
  function recipients(){Array.from(document.querySelectorAll(".campresources-member-recipient")).forEach(i=>{const key=String(i.value||"").toLowerCase(); if(i.checked) selectedRecipientEmails.add(key); else selectedRecipientEmails.delete(key);}); const a=Array.from(document.querySelectorAll(".campresources-member-recipient:checked")).map(i=>({email:i.value,name:i.dataset.name||i.value}));const manual=String(qs("campResourcesManualEmail")?.value||"").trim();if(manual)a.push({email:manual,name:manual});const seen=new Set();return a.filter(r=>r.email&&r.email.includes("@")&&!seen.has(r.email.toLowerCase())&&seen.add(r.email.toLowerCase()));}
  function selectedHunterKey(){const s=qs("campResourcesHunter");return String(s?.value||selectedHunterName()||"selected-hunter").trim().toLowerCase();}
  function selectedHunterName(){const s=qs("campResourcesHunter");const o=s?.selectedOptions?.[0];return (o?.dataset?.name||o?.textContent||"").trim();}
  function normalizeStapleText(line){return String(line||"").trim().replace(/^[-•*\s]+/,"").replace(/\s+/g," ");}
  function parseMasterStaples(){
    const text=String(qs("campResourcesMasterStaples")?.value||"").trim();
    const lines=text.split(/\n+/).map(normalizeStapleText).filter(Boolean);
    const seen=new Set();
    masterStaples=lines.filter(item=>{const key=item.toLowerCase(); if(seen.has(key)) return false; seen.add(key); return true;});
    renderLaborBoard();
  }
  function assignedStapleKeys(){const out=new Set();assignedStaplesByHunter.forEach(items=>items.forEach(item=>out.add(String(item).toLowerCase())));return out;}
  function getHunterAssignedStaples(key=selectedHunterKey()){return assignedStaplesByHunter.get(key)||[];}
  function renderLaborBoard(){
    const remainingWrap=qs("campResourcesRemainingStaples"), orderWrap=qs("campResourcesHunterOrder");
    if(!remainingWrap||!orderWrap) return;
    const assigned=assignedStapleKeys();
    const remaining=masterStaples.filter(item=>!assigned.has(item.toLowerCase()));
    remainingWrap.innerHTML=remaining.length?`<span class="campresources-labor-count">${remaining.length} unassigned</span>`+remaining.map(item=>`<label class="campresources-labor-item"><input type="checkbox" class="campresources-staple-choice" value="${esc(item)}"><span>${esc(item)}</span><span></span></label>`).join(""):'<span class="campresources-muted">All master list items have been assigned.</span>';
    const hunterName=selectedHunterName()||"Selected hunter";
    const hunterItems=getHunterAssignedStaples();
    orderWrap.innerHTML=hunterItems.length?`<span class="campresources-labor-count">${esc(hunterName)}: ${hunterItems.length} assigned</span>`+hunterItems.map(item=>`<div class="campresources-labor-item"><span>✓</span><span>${esc(item)}</span><button class="campresources-labor-remove" type="button" data-remove-staple="${esc(item)}" title="Return to remaining list">×</button></div>`).join(""):`<span class="campresources-muted">No staples/resources assigned to ${esc(hunterName)} yet.</span>`;
    orderWrap.querySelectorAll("[data-remove-staple]").forEach(btn=>btn.addEventListener("click",()=>{removeStapleFromHunter(btn.getAttribute("data-remove-staple")||"");}));
  }
  function assignSelectedStaplesToHunter(){
    const key=selectedHunterKey();
    const choices=Array.from(document.querySelectorAll(".campresources-staple-choice:checked")).map(i=>normalizeStapleText(i.value)).filter(Boolean);
    if(!choices.length) return;
    const current=getHunterAssignedStaples(key).slice();
    const seen=new Set(current.map(x=>String(x).toLowerCase()));
    choices.forEach(item=>{const k=item.toLowerCase(); if(!seen.has(k)){current.push(item);seen.add(k);}});
    assignedStaplesByHunter.set(key,current);
    renderLaborBoard();
  }
  function removeStapleFromHunter(item){
    const key=selectedHunterKey(), target=String(item||"").toLowerCase();
    const next=getHunterAssignedStaples(key).filter(x=>String(x).toLowerCase()!==target);
    assignedStaplesByHunter.set(key,next);
    renderLaborBoard();
  }
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
    const assignedStaples=getHunterAssignedStaples();
    lines.push("Your Assignments");lines.push("----------------");
    if(breakfast)lines.push(`Breakfast: ${breakfast}`);
    if(lunch)lines.push(`Lunch: ${lunch}`);
    if(dinner)lines.push(`Dinner: ${dinner}`);
    if(assignedStaples.length){lines.push("");lines.push("Camp Staples / Resources Assigned to You:");assignedStaples.forEach(x=>lines.push(`- ${x}`));}
    if(staples){lines.push("");lines.push("Additional Order Notes:");staples.split(/\n+/).map(x=>x.trim()).filter(Boolean).forEach(x=>lines.push(`- ${x}`));}
    const remaining=masterStaples.filter(item=>!assignedStapleKeys().has(item.toLowerCase()));
    if(remaining.length){lines.push("");lines.push("Still Unassigned in Master List:");remaining.forEach(x=>lines.push(`- ${x}`));}
    if(notes){lines.push("");lines.push("Steward Notes:");lines.push(notes);}
    lines.push("");
    return lines;
  }
  function emailBody(names){const grouped={};Array.from(pack.values()).forEach(i=>{const label=i.categoryLabel.replace(/^[^A-Za-z0-9]+/,"").trim();(grouped[label]||=[]).push(i)});const lines=missionLines(names);lines.push("Suggested Stops / Resource Pack");lines.push("-------------------------------");if(!pack.size){lines.push("No stops selected yet.");}Object.keys(grouped).sort().forEach(label=>{lines.push("");lines.push(label);lines.push("-".repeat(label.length));grouped[label].forEach(i=>{lines.push(i.name);if(i.address)lines.push(`Address: ${i.address}`);if(i.distanceMiles)lines.push(`Distance: ${Number(i.distanceMiles).toFixed(1)} miles`);if(i.phone)lines.push(`Phone: ${i.phone}`);if(i.website)lines.push(`Website: ${i.website}`);if(i.mapsUrl)lines.push(`Directions: ${i.mapsUrl}`);lines.push("")});});lines.push("");lines.push("Sent from DeerCamp CampResources Mission Center.");return lines.join("\n")}
  function emailResourcePack(){const status=qs("campResourcesPackStatus");const rec=recipients();if(!rec.length){if(status)status.textContent="Choose at least one member or enter an email address.";return}const mission=String(qs("campResourcesMissionName")?.value||"Trip Prep Mission").trim();window.location.href=`mailto:${encodeURIComponent(rec.map(r=>r.email).join(","))}?subject=${encodeURIComponent(`DeerCamp ${mission}`)}&body=${encodeURIComponent(emailBody(rec.map(r=>r.name)))}`;}
  function clearPack(){pack.clear();renderPack();document.querySelectorAll(".campresources-result-check").forEach(i=>i.checked=false)}
  function initCampResources(){const root=document.getElementById("campresources");if(!root)return;forceRecipientChecklist();if(boundRoot===root&&qs("campResourcesCategories")?.children?.length)return;boundRoot=root;renderCategories();populateMemberChecks();renderPack();document.querySelectorAll("[data-strategy]").forEach(btn=>btn.addEventListener("click",()=>{activeStrategy=btn.dataset.strategy||"sah";updateStrategyUI();loadCampResources();}));["campResourcesRadius","campResourcesStartZip","campResourcesEndZip"].forEach(id=>qs(id)?.addEventListener("change",()=>{syncMissionZip();loadCampResources();}));qs("campResourcesMissionStart")?.addEventListener("change",syncMissionDates);qs("campResourcesMissionEnd")?.addEventListener("change",syncMissionDates);qs("campResourcesHunter")?.addEventListener("change",renderLaborBoard);qs("campResourcesLoadStaplesBtn")?.addEventListener("click",parseMasterStaples);qs("campResourcesAssignStapleBtn")?.addEventListener("click",assignSelectedStaplesToHunter);qs("campResourcesMasterStaples")?.addEventListener("blur",()=>{if(!masterStaples.length)parseMasterStaples();});qs("campResourcesEmailBtn")?.addEventListener("click",emailResourcePack);qs("campResourcesClearBtn")?.addEventListener("click",clearPack);const end=qs("campResourcesEndZip"),hidden=qs("campResourcesZip");if(end&&!end.value.trim())end.value=getCampZip();if(hidden&&!hidden.value.trim())hidden.value=end?.value||getCampZip();syncMissionDates();updateStrategyUI();renderLaborBoard();if(hidden?.value&&!didAutoSearch){didAutoSearch=true;setTimeout(loadCampResources,120)}}
  window.initCampResources=initCampResources;window.loadCampResources=loadCampResources;if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initCampResources);else initCampResources(); setInterval(()=>{if(document.getElementById("campresources")){forceRecipientChecklist(); if(!document.querySelector(".campresources-member-recipient")) populateMemberChecks();}},2500);
})();