import { DEFAULT_ITEMS } from './defaults.js';

export function mountChecklist(root, supabase, userId, isCurrentUser, toast) {
  root.innerHTML = `
    <link rel="stylesheet" href="./matchday/checklist.css">
    <p id="load-status" role="status">Načítám checklist…</p>
    <button type="button" id="retry-load" class="ghost" hidden>Zkusit načíst znovu</button>
    <div id="content" hidden>
    <header class="topbar">
    <div>
    <p class="eyebrow">Předzápasová příprava</p>
    <h1>Matchday Checklist</h1>
    </div>
    </header>
    <nav class="nav-tabs" aria-label="Výběr sportu">
    <button class="active" type="button" data-sport="floorball">🥅 Florbal</button>
    <button type="button" data-sport="football">⚽ Fotbal</button>
    </nav>
    <section class="card setup-card" id="sets-box">
    <div class="heading-row">
    <div>
    <p class="eyebrow">Příprava na turnaj</p>
    <h2>Vyber 2 barevné sety</h2>
    </div>
    <span id="sets-count" class="pill">
    </span>
    </div>
    <div id="set-buttons" class="set-grid">
    </div>
    <p class="muted small">Společné věci se započítají jen jednou. Výběr ovlivňuje pouze aktuální florbalový checklist.</p>
    </section>
    <section class="card progress-card">
    <div class="heading-row">
    <div>
    <p class="eyebrow">Aktuální balení</p>
    <h2 id="sport-heading">Florbal</h2>
    </div>
    <strong id="progress-count">0 / 0</strong>
    </div>
    <div class="progress-track">
    <div id="progress-fill">
    </div>
    </div>
    <p class="muted" id="progress-message">
    </p>
    <div class="toolbar">
    <button type="button" id="reset-btn" class="secondary">↻ Nové balení</button>
    <button type="button" id="edit-mode-btn" class="ghost">✎ Upravit seznam</button>
    <span id="save-status" class="muted small" role="status">
    </span>
    <button type="button" id="retry-save" class="ghost" hidden>Zkusit uložit znovu</button>
    </div>
    </section>
    <div id="checklist">
    </div>
    <section id="editor" class="card hidden">
    <h2>Správa položek</h2>
    <p class="muted small">Přidané položky se vždy zobrazují ve vybrané kategorii. U florbalu jim můžeš přiřadit barevný set.</p>
    <form id="add-form" class="edit-grid">
    <label>Název<input id="new-name" required maxlength="120" placeholder="Nová položka">
    </label>
    <label>Kategorie<select id="new-category">
    </select>
    </label>
    <label id="new-set-label">Set<select id="new-set">
    <option value="always">Vždy</option>
    <option value="white">Bílý</option>
    <option value="black">Černý</option>
    <option value="blue">Modrý</option>
    <option value="white-blue">Bílý i modrý</option>
    </select>
    </label>
    <button type="submit" class="primary">+ Přidat</button>
    </form>
    <div id="editor-items">
    </div>
    </section>
    <footer class="muted small">Matchday Checklist · #33 · Synchronizace se Sportovním deníkem</footer>
    </div>
  `;
  const syncTheme = () => {
    root.host.dataset.theme = document.documentElement.dataset.theme ?? '';
  };
  const themeObserver = new MutationObserver(syncTheme);
  themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  syncTheme();

  const $ = id => root.getElementById(id);
  let data = null, sport = 'floorball', editing = false, revision = null;
  let version = 0, savedVersion = 0, saving = false, debounceId, conflict = false;

  const SETS = [{id:'white',title:'Bílý',css:'white'},{id:'black',title:'Černý',css:'black'},{id:'blue',title:'Modrý',css:'blue'}];
  const clone = value => JSON.parse(JSON.stringify(value));
  const defaults = () => ({items:clone(DEFAULT_ITEMS),packed:{floorball:[],football:[]},selectedSets:['black','blue']});
  const escapeHTML = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function normalize(input){const x=defaults();if(!input || typeof input!=='object')return x;
   for(const k of ['floorball','football']){
    if(Array.isArray(input.items?.[k]))x.items[k]=input.items[k].filter(i=>i&&typeof i.id==='string'&&typeof i.name==='string'&&typeof i.category==='string').map(i=>({...i,sets:Array.isArray(i.sets)?i.sets:[]}));
    if(Array.isArray(input.packed?.[k]))x.packed[k]=input.packed[k].filter(i=>typeof i==='string');
   }
   if(Array.isArray(input.selectedSets)){const valid=[...new Set(input.selectedSets.filter(s=>SETS.some(x=>x.id===s)))];if(valid.length===2)x.selectedSets=valid;}
   return x;
  }
  // Jednorázová oprava starých uložených dat; nepřepisuje uživatelsky upravené položky.
  function repairWristbands(){
   const mapping={f10:['Potítka (bílá)','white'],f11:['Potítka (černá)','black'],f12:['Potítka (modrá)','blue']};
   let changed=false;
   for(const item of data.items.floorball){
    const expected=mapping[item.id];
    if(expected && item.name===expected[0] && Array.isArray(item.sets) && item.sets.length===0){
     item.sets=[expected[1]];
     changed=true;
    }
   }
   return changed;
  }
  function visible(i){return sport==='football'||!i.sets.length||i.sets.some(s=>data.selectedSets.includes(s));}
  const activeItems=()=>data.items[sport].filter(visible);
  function markDirty() {
    version++;
    $('save-status').textContent = 'Neuložené změny…';
    clearTimeout(debounceId);
    debounceId = setTimeout(save, 650);
    render();
  }

  async function save() {
    if (!isCurrentUser() || !data || saving || conflict || savedVersion === version) return;
    saving = true;
    $('retry-save').hidden = true;
    const snapshot = clone(data);
    const target = version;
    const row = {user_id: userId, payload: snapshot, updated_at: new Date().toISOString()};
    if (revision && Date.parse(row.updated_at) <= Date.parse(revision)) {
      row.updated_at = new Date(Date.parse(revision) + 1).toISOString();
    }
    $('save-status').textContent = 'Ukládám…';
    try {
      const table = supabase.from('matchday_checklist');
      const write = revision
        ? table.update(row).eq('user_id', userId).eq('updated_at', revision)
        : table.insert(row);
      const {data: saved, error} = await write.select('updated_at').maybeSingle();
      if (!isCurrentUser()) return;
      conflict = error?.code === '23505' || (!error && !saved);
      if (conflict) {
        $('save-status').textContent = 'Checklist se mezitím změnil na jiném zařízení. Tyto změny nebyly uloženy. Obnov stránku pro aktuální seznam.';
        return;
      }
      if (error) throw error;
      revision = saved.updated_at;
      savedVersion = target;
      $('save-status').textContent = savedVersion === version ? '✓ Uloženo' : 'Další změny čekají…';
      if (savedVersion !== version) {
        clearTimeout(debounceId);
        debounceId = setTimeout(save, 650);
      }
    } catch {
      if (!isCurrentUser()) return;
      clearTimeout(debounceId);
      $('save-status').textContent = 'Uložení selhalo.';
      $('retry-save').hidden = false;
    } finally {
      saving = false;
    }
  }

  function render(){if(!data)return;
   root.querySelectorAll('[data-sport]').forEach(b=>b.classList.toggle('active',b.dataset.sport===sport));
   $('sport-heading').textContent=sport==='floorball'?'Florbal':'Fotbal';$('sets-box').classList.toggle('hidden',sport!=='floorball');
   $('sets-count').textContent=data.selectedSets.length+' / 2';
   $('set-buttons').innerHTML=SETS.map(s=>`<button type="button" class="set-button" data-set="${s.id}" aria-pressed="${data.selectedSets.includes(s.id)}"><span class="swatch ${s.css}"></span>${s.title}</button>`).join('');
   const active=activeItems(),packed=new Set(data.packed[sport]),checked=active.filter(i=>packed.has(i.id)).length;
   $('progress-count').textContent=`${checked} / ${active.length}`;
   $('progress-fill').style.width=(active.length?checked/active.length*100:0)+'%';
   $('progress-message').textContent=active.length&&checked===active.length?'🎉 Všechno sbaleno!':`Zbývá sbalit ${active.length-checked} položek.`;
   const categories=[...new Set(active.map(i=>i.category))];
   $('checklist').innerHTML=categories.map(category=>`<section class="card group-card"><h3>${escapeHTML(category)}</h3>${active.filter(i=>i.category===category).map(i=>`<label class="check-row ${packed.has(i.id)?'done':''}"><input type="checkbox" data-item="${escapeHTML(i.id)}" ${packed.has(i.id)?'checked':''}><span>${escapeHTML(i.name)}</span></label>`).join('')}</section>`).join('')||'<div class="empty">Zatím tu nejsou žádné položky.</div>';
   $('editor').classList.toggle('hidden',!editing);$('edit-mode-btn').textContent=editing?'✓ Dokončit úpravy':'✎ Upravit seznam';
   if(editing)renderEditor();
  }
  function renderEditor(){const all=data.items[sport];const categories=[...new Set(all.map(i=>i.category))];
   for(const c of ['Výstroj','Ostatní','Oblečení','Výstroj a ostatní'])if(!categories.includes(c))categories.push(c);
   const prev=$('new-category').value;$('new-category').innerHTML=categories.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');if(categories.includes(prev))$('new-category').value=prev;
   $('new-set-label').classList.toggle('hidden',sport==='football');
   $('editor-items').innerHTML=all.map(i=>`<div class="editor-row"><div><strong>${escapeHTML(i.name)}</strong><div class="muted">${escapeHTML(i.category)}${sport==='floorball'&&i.sets.length?' · '+i.sets.map(s=>({white:'Bílý',black:'Černý',blue:'Modrý'}[s])).join(' + '):''}</div></div><div><button type="button" data-rename="${escapeHTML(i.id)}" aria-label="Přejmenovat">✎</button><button type="button" data-delete="${escapeHTML(i.id)}" aria-label="Smazat">🗑</button></div></div>`).join('');
  }
  root.querySelectorAll('[data-sport]').forEach(b=>b.addEventListener('click',()=>{sport=b.dataset.sport;render()}));
  $('set-buttons').addEventListener('click',e=>{const b=e.target.closest('[data-set]');if(!b||!data)return;const id=b.dataset.set,old=data.selectedSets;
   if(old.includes(id)){if(old.length<=2){toast('Pro turnaj vyber právě dva sety.');return;}}
   else{data.selectedSets=[old[1],id];markDirty();}
  });
  $('checklist').addEventListener('change',e=>{const el=e.target;if(!data||!el.matches('[data-item]'))return;const set=new Set(data.packed[sport]);el.checked?set.add(el.dataset.item):set.delete(el.dataset.item);data.packed[sport]=[...set];markDirty()});
  $('reset-btn').addEventListener('click',()=>{if(!data||!confirm('Začít nové balení? Odškrtnou se všechny položky aktuálního sportu.'))return;data.packed[sport]=[];markDirty();toast('Připraveno na další balení.');});
  $('edit-mode-btn').addEventListener('click',()=>{if(!data)return;editing=!editing;render()});
  $('add-form').addEventListener('submit',e=>{e.preventDefault();if(!data)return;const name=$('new-name').value.trim();if(!name)return;
   const newSet=$('new-set').value;const sets=sport==='football'||newSet==='always'?[]:newSet==='white-blue'?['white','blue']:[newSet];
   data.items[sport].push({id:crypto.randomUUID(),name,category:$('new-category').value,sets});$('new-name').value='';markDirty();});
  $('editor-items').addEventListener('click',e=>{const del=e.target.closest('[data-delete]'),rename=e.target.closest('[data-rename]');if(!data||(!del&&!rename))return;
   const id=(del||rename).dataset.delete||(del||rename).dataset.rename;const item=data.items[sport].find(x=>x.id===id);if(!item)return;
   if(del){if(!confirm(`Smazat položku „${item.name}“?`))return;data.items[sport]=data.items[sport].filter(x=>x.id!==id);data.packed[sport]=data.packed[sport].filter(x=>x!==id);}
   else{const name=prompt('Nový název položky:',item.name);if(!name?.trim())return;item.name=name.trim().slice(0,120);}
   markDirty();});

  async function load() {
    $('retry-load').hidden = true;
    $('load-status').textContent = 'Načítám checklist…';
    try {
      const {data: record, error} = await supabase.from('matchday_checklist')
        .select('payload, updated_at').eq('user_id', userId).maybeSingle();
      if (!isCurrentUser()) return;
      if (error) throw error;
      data = normalize(record?.payload);
      revision = record?.updated_at ?? null;
      repairWristbands();
      render();
      $('load-status').hidden = true;
      $('content').hidden = false;
      $('save-status').textContent = '✓ Připraveno';
    } catch {
      if (!isCurrentUser()) return;
      $('load-status').textContent = 'Checklist se nepodařilo načíst.';
      $('retry-load').hidden = false;
    }
  }

  $('retry-load').addEventListener('click', load);
  $('retry-save').addEventListener('click', save);
  const warnIfUnsaved = event => {
    if (version === savedVersion) return;
    event.preventDefault();
    event.returnValue = '';
  };
  window.addEventListener('beforeunload', warnIfUnsaved);
  void load();

  return {
    hasUnsavedChanges: () => version !== savedVersion,
    dispose() {
      clearTimeout(debounceId);
      themeObserver.disconnect();
      window.removeEventListener('beforeunload', warnIfUnsaved);
      root.replaceChildren();
    },
  };
}
