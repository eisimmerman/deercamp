(()=>{
const layer=document.querySelector('[data-modal-layer]');
const content=document.querySelector('[data-modal-content]');
const coords='45.19142,-90.99516';
const mapsUrl=`https://www.google.com/maps/dir/?api=1&destination=${coords}`;
const stand={name:'1st Stand',owner:'Eric S',date:'June 18, 2026',type:'Elevated Box Blind',wind:'S',time:'Evening',access:'Excellent',pressure:'Fresh',season:'Bow or rifle',notes:'Access via W. stand trail off clearing. Short walk through woods.',image:'./assets/elevated-box-blind.png',coords:'45.19142, -90.99516'};
function openModal(html){content.innerHTML=html;layer.hidden=false;document.body.style.overflow='hidden';requestAnimationFrame(injectDriveLegend)}
function closeModal(){layer.hidden=true;content.innerHTML='';document.body.style.overflow=''}
function tags(){return [stand.type,`Wind ${stand.wind}`,stand.time,`Access ${stand.access}`,`Pressure ${stand.pressure}`,stand.season].map(v=>`<span class="tag">${v}</span>`).join('')}
function openStandList(){openModal(`<p class="eyebrow">Stand Maps</p><h2>Camp Boddington Deer Stands</h2><article class="stand-list-card"><div class="stand-thumb"><img src="${stand.image}" alt="${stand.type}"></div><div><p class="eyebrow">Deer Stand</p><h3>${stand.name}</h3><p class="meta">${stand.owner} - ${stand.date}</p><p class="description">${stand.notes}</p><div class="tags">${tags()}</div><div class="waypoint"><strong>Stand Waypoint</strong><span>${stand.coords}</span></div><div class="actions"><button class="action primary" type="button" data-open-stand>Open Stand</button><a class="action" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Navigate to Stand</a></div></div></article>`);
content.querySelector('[data-open-stand]')?.addEventListener('click',openStandDetail)}
function openStandDetail(){openModal(`<p class="eyebrow">Deer Stand</p><h2>${stand.name}</h2><p class="meta">${stand.owner}</p><div class="detail-grid"><div class="detail-image"><img src="${stand.image}" alt="${stand.type}"></div><div class="detail-fields"><div class="field"><strong>Type</strong><span>${stand.type}</span></div><div class="field"><strong>Wind</strong><span>${stand.wind}</span></div><div class="field"><strong>Time</strong><span>${stand.time}</span></div><div class="field"><strong>Access</strong><span>${stand.access}</span></div><div class="field"><strong>Pressure</strong><span>${stand.pressure}</span></div><div class="field"><strong>Season</strong><span>${stand.season}</span></div><div class="field"><strong>Stand Notes</strong><span>${stand.notes}</span></div><section class="nav-card"><p class="eyebrow">Stand Waypoint</p><h3>${stand.coords}</h3><p>Open the saved stand destination in Google Maps so Craig can navigate directly to the waypoint.</p><div class="actions"><a class="action primary" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a><button class="action" type="button" data-back-list>Back to Stand List</button></div></section></div></div>`);
content.querySelector('[data-back-list]')?.addEventListener('click',openStandList)}
document.querySelectorAll('[data-action="open-stand-list"]').forEach(button=>button.addEventListener('click',openStandList));

function openDriveMaps(){
  openModal(`
    <p class="eyebrow">Drive Maps</p>
    <h2>Triangle Deer Drive</h2>

    <div class="drive-detail-grid">
      <div class="drive-map-panel">
        <button
          class="drive-map-image-button"
          type="button"
          data-drive-map-enlarge
          aria-label="View Triangle drive map larger">

          <img
            src="./assets/triangle-drive-map.png"
            alt="Triangle deer drive map showing drivers, pushers, standers, blockers, and three drive routes">
        </button>

        <p class="drive-map-helper">
          Tap map to view larger.
        </p>

        <div class="drive-map-legend">
          <strong>Legend</strong>

          <span class="drive-legend-item">
            <span class="drive-legend-dot blue"></span>
            Blue circles = Driver/Pusher
          </span>

          <span class="drive-legend-item">
            <span class="drive-legend-dot yellow"></span>
            Yellow circles = Stander/Blocker
          </span>
        </div>

        <div class="drive-wind-panel">
          <strong>Wind Direction</strong>
          <span>NW to SE</span>
        </div>
      </div>

      <div class="drive-detail-copy">
        <p class="eyebrow">Deer Drive</p>
        <h3>Triangle</h3>

        <p class="meta">
          Eric S - June 19, 2026 - 5:00 AM - NW to SE
        </p>

        <div class="tags">
          <span class="tag">Deer Drive</span>
          <span class="tag">Scout</span>
          <span class="tag">3 routes</span>
        </div>

        <p class="description drive-intro">
          Three coordinated routes with drivers/pushers
          and standers/blockers.
        </p>

        <div class="drive-route-list">
          <article class="field">
            <strong>Driver/Pusher Route 1</strong>
            <span>0.04 mile - NW to SE</span>
          </article>

          <article class="field">
            <strong>Driver/Pusher Route 2</strong>
            <span>0.15 mile - NW to SE</span>
          </article>

          <article class="field">
            <strong>Driver/Pusher Route 3</strong>
            <span>0.07 mile - NW to SE</span>
          </article>

          <article class="field">
            <strong>Drive Notes</strong>
            <span>
              S/B 1 watches swamp ridge and west escape routes;
              S/B 2 and 3 post on the ridge above the swamp;
              S/B 4 watches north escape routes.
            </span>
          </article>
        </div>

        <div class="actions drive-actions">
          <button
            class="action"
            type="button"
            data-drive-return>
            Return to Maps Room
          </button>
        </div>
      </div>
    </div>
  `);

  content
    .querySelector('[data-drive-return]')
    ?.addEventListener('click',closeModal);

  content
    .querySelector('[data-drive-map-enlarge]')
    ?.addEventListener('click',()=>{
      openDriveMapEnlarged();
    });
}

function openDriveMapEnlarged(){
  openModal(`
    <p class="eyebrow">Triangle Deer Drive</p>
    <h2>Drive Map</h2>

    <div class="drive-map-enlarged">
      <img
        src="./assets/triangle-drive-map.png"
        alt="Enlarged Triangle deer drive map">

      <div class="drive-map-legend">
        <strong>Legend</strong>

        <span class="drive-legend-item">
          <span class="drive-legend-dot blue"></span>
          Blue circles = Driver/Pusher
        </span>

        <span class="drive-legend-item">
          <span class="drive-legend-dot yellow"></span>
          Yellow circles = Stander/Blocker
        </span>
      </div>

      <div class="actions">
        <button
          class="action primary"
          type="button"
          data-drive-detail-return>
          Return to Drive Details
        </button>
      </div>
    </div>
  `);

  content
    .querySelector('[data-drive-detail-return]')
    ?.addEventListener('click',openDriveMaps);
}
document
  .querySelectorAll('[data-action="open-drive-list"]')
  .forEach(button=>{
    button.addEventListener('click',openDriveMaps);
  });
document.querySelectorAll('[data-modal-close]').forEach(el=>el.addEventListener('click',closeModal));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!layer.hidden)closeModal()});

function buildDriveLegend(){
  const wrap=document.createElement('div');
  wrap.className='drive-map-legend';
  wrap.innerHTML='<strong>Legend</strong><span class=""dot blue""></span> Blue circles = Driver/Pusher &nbsp;&nbsp; <span class=""dot yellow""></span> Yellow circles = Stander/Blocker';
  return wrap;
}

function injectDriveLegend(){
  if(!content) return;

  content.querySelectorAll('.drive-map-legend').forEach(el=>el.remove());

  const text = content.innerText || '';
  const looksLikeDriveView = /Deer Drive|Open Drive|Drive Notes|Route 1|Route 2|Route 3/i.test(text);
  if(!looksLikeDriveView) return;

  const tapNote = Array.from(content.querySelectorAll('p,div,span'))
    .find(el => /tap image to view larger/i.test((el.textContent || '').trim()));

  if(tapNote){
    tapNote.insertAdjacentElement('afterend', buildDriveLegend());
  }

  const openDriveBtn = Array.from(content.querySelectorAll('button,a'))
    .find(el => /open drive/i.test((el.textContent || '').trim()));

  if(openDriveBtn){
    const host =
      openDriveBtn.closest('.actions, .button-row, .card-actions') ||
      openDriveBtn.parentElement;

    if(host){
      host.insertAdjacentElement('beforebegin', buildDriveLegend());
    }
  }
}

function initializeMapsGuidance(){
  const standButtons = Array.from(
    document.querySelectorAll(
      '.hs-stand-maps, .hs-view-stand-maps'
    )
  );

  const driveButtons = Array.from(
    document.querySelectorAll(
      '.hs-drive-maps, .hs-view-drive-maps'
    )
  );

  const modalLayer =
    document.querySelector('[data-modal-layer]');

  let currentExperience = '';
  let standViewed = false;
  let driveViewed = false;
  let modalWasOpen = false;

  function clearGuidance(){
    document
      .querySelectorAll('.map-guidance-active')
      .forEach(button=>{
        button.classList.remove('map-guidance-active');
      });
  }

  function guideStandMaps(){
    clearGuidance();

    standButtons.forEach(button=>{
      button.classList.add('map-guidance-active');
    });
  }

  function guideDriveMaps(){
    clearGuidance();

    driveButtons.forEach(button=>{
      button.classList.add('map-guidance-active');
    });
  }

  function completeGuidance(){
    clearGuidance();
  }

  standButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      currentExperience = 'stand';
      clearGuidance();
    });
  });

  driveButtons.forEach(button=>{
    button.addEventListener('click',()=>{
      currentExperience = 'drive';
      clearGuidance();
    });
  });

  if(modalLayer){
    const observer = new MutationObserver(()=>{
      const modalIsOpen = !modalLayer.hidden;

      if(modalWasOpen && !modalIsOpen){
        if(currentExperience === 'stand'){
          standViewed = true;
          currentExperience = '';

          if(!driveViewed){
            window.setTimeout(guideDriveMaps,250);
          }
        }
        else if(currentExperience === 'drive'){
          driveViewed = true;
          currentExperience = '';
          completeGuidance();
        }
      }

      modalWasOpen = modalIsOpen;

      if(modalIsOpen){
        ensureDriveRoleLegend();
      }
    });

    observer.observe(modalLayer,{
      attributes:true,
      attributeFilter:['hidden']
    });
  }

  guideStandMaps();
}

function ensureDriveRoleLegend(){
  const modalContent =
    document.querySelector('[data-modal-content]');

  if(!modalContent) return;

  const modalText = modalContent.textContent || '';

  if(!/Triangle Deer Drive|Driver\/Pusher Route/i.test(modalText)){
    return;
  }

  const existing =
    modalContent.querySelector('.drive-map-legend');

  if(existing){
    existing.innerHTML = `
      <strong>Legend</strong>

      <span class="drive-legend-item">
        <span class="drive-legend-dot blue"></span>
        Blue circle = Driver/Pusher
      </span>

      <span class="drive-legend-item">
        <span class="drive-legend-dot yellow"></span>
        Yellow circle = Stander/Blocker
      </span>
    `;

    return;
  }

  const legend = document.createElement('div');
  legend.className = 'drive-map-legend';

  legend.innerHTML = `
    <strong>Legend</strong>

    <span class="drive-legend-item">
      <span class="drive-legend-dot blue"></span>
      Blue circle = Driver/Pusher
    </span>

    <span class="drive-legend-item">
      <span class="drive-legend-dot yellow"></span>
      Yellow circle = Stander/Blocker
    </span>
  `;

  const helper =
    modalContent.querySelector('.drive-map-helper');

  const mapButton =
    modalContent.querySelector('.drive-map-image-button');

  if(helper){
    helper.insertAdjacentElement('afterend',legend);
  }
  else if(mapButton){
    mapButton.insertAdjacentElement('afterend',legend);
  }
}

window.setTimeout(initializeMapsGuidance,0);

})();