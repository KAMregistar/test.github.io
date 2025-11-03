<script>
// ---------- Normalizacija teksta za usporedbu ----------
function norm(s){
  return String(s)
    .trim()
    .replace(/^\d+(\.\d+)*\s+/, '')      // makni numeraciju "1.4 "
    .replace(/\s+/g,' ')                 // višestruke razmake
    .toLowerCase();
}

// ---------- Izgradi indeks svojstava iz ontologije ----------
function buildPropertyIndex(onto){
  const byLabel = new Map();

  for (const k of Object.keys(onto)) {
    const node = onto[k];
    const types = node['@type'] || [];
    const isProp = types.includes('http://www.w3.org/2002/07/owl#DatatypeProperty')
                || types.includes('http://www.w3.org/2002/07/owl#ObjectProperty');
    if (!isProp) continue;

    const label = node['http://www.w3.org/2000/01/rdf-schema#label']?.[0]?.['@value'];
    if (!label) continue;

    const iri   = node['@id'];
    const curie = node['http://www.registar.kam.hr/ontologies/ont.owl/ID']?.[0]?.['@value'] || '';
    // doseg može pomoći (npr. C10011 = Mjesto; C10012 = Vrijeme; C10013 = Nomen)
    const rangeId = node['http://www.w3.org/2000/01/rdf-schema#range']?.[0]?.['@id'] || null;

    byLabel.set(norm(label), {
      iri,
      curie,
      isDatatype: types.includes('http://www.w3.org/2002/07/owl#DatatypeProperty'),
      isObject:   types.includes('http://www.w3.org/2002/07/owl#ObjectProperty'),
      rangeId     // npr. .../Element/c/C10013 (Nomen), C10011 (Mjesto), C10012 (Vrijeme)...
    });
  }
  return { byLabel };
}

// ---------- Nađi IRI svojstva za jedan label u DOM-u ----------
function findPropForLabelText(text, propIndex){
  // 1) pokušaj po label-tekstu
  const hit = propIndex.byLabel.get(norm(text));
  if (hit) return hit;
  return null;
}

// ---------- Izvuci (polje → svojstvo) iz DOM-a ----------
function getFormFieldMappings(propIndex){
  // svi label elementi s for=...
  const pairs = [];
  document.querySelectorAll('label[for]').forEach(lbl=>{
    const forId = lbl.getAttribute('for');
    const ctrl  = document.getElementById(forId);
    if (!ctrl) return;

    // 0) override preko data-prop (opcionalno)
    const overrideIri = ctrl.getAttribute('data-prop');
    if (overrideIri) {
      pairs.push({ ctrl, label: lbl.textContent, prop:{ iri: overrideIri, isDatatype:true, isObject:false, rangeId:null } });
      return;
    }

    const hit = findPropForLabelText(lbl.textContent, propIndex);
    if (hit) {
      pairs.push({ ctrl, label: lbl.textContent, prop: hit });
    }
  });
  return pairs;
}

// ---------- Graditelji čvorova (isti kao prije) ----------
function hash32(str){ let h=5381; for(let i=0;i<str.length;i++){ h=((h<<5)+h)+str.charCodeAt(i); h|=0; } return (h>>>0).toString(16).padStart(8,'0'); }
function idFor(nsType, content){ return 'http://www.registar.kam.hr/id/' + hash32(nsType+'|'+(content||'')); }

const C = {
  PojavniOblik:'http://www.registar.kam.hr/Element/c/C10004',
  Nomen:'http://www.registar.kam.hr/Element/c/C10013',
  Mjesto:'http://www.registar.kam.hr/Element/c/C10011',
  Vrijeme:'http://www.registar.kam.hr/Element/c/C10012'
};
const P = {
  nomenskiNiz:'http://www.registar.kam.hr/Elements/n/P13002'
};

function makeNomen(graph, text, lang){
  if(!text) return null;
  const id = idFor(C.Nomen, (lang||'')+'|'+text);
  graph.push({ '@id': id, '@type': C.Nomen, [P.nomenskiNiz]: [{ '@value': text, ...(lang?{'@language':lang}:{}) }] });
  return id;
}
function makeMjesto(graph, naziv){
  if(!naziv) return null;
  const id = idFor(C.Mjesto, naziv);
  const nId = makeNomen(graph, naziv, 'hr');
  graph.push({ '@id': id, '@type': C.Mjesto, 'http://www.registar.kam.hr/Elements/m/P11044': nId?[{ '@id': nId }]:[] });
  return id;
}
function makeVrijeme(graph, raspon){
  if(!raspon) return null;
  const id = idFor(C.Vrijeme, raspon);
  const nId = makeNomen(graph, raspon, '');
  graph.push({ '@id': id, '@type': C.Vrijeme, 'http://www.registar.kam.hr/Elements/vr/P12038': nId?[{ '@id': nId }]:[] });
  return id;
}

// ---------- Pravila po dosegu (range) za object property ----------
function buildObjectValue(graph, rangeId, text){
  if (!text) return null;
  if (rangeId && rangeId.endsWith('/C10011')) return makeMjesto(graph, text);   // Mjesto
  if (rangeId && rangeId.endsWith('/C10012')) return makeVrijeme(graph, text);  // Vrijeme
  // default: Nomen
  return makeNomen(graph, text, 'hr');
}

// ---------- Glavna funkcija: napravi JSON-LD iz SVIH polja ----------
function toKAMJsonLD_Auto(propIndex){
  const graph = [];
  // ID poj. oblika sastavi od nekoliko važnih polja (ili samo generiraj)
  const poId = idFor(C.PojavniOblik, (document.getElementById('e1_4')?.value||'') + '|' + (document.getElementById('e1_23')?.value||''));
  const po = { '@id': poId, '@type': C.PojavniOblik };

  const pairs = getFormFieldMappings(propIndex);
  pairs.forEach(({ctrl, prop})=>{
    // skupi SVE vrijednosti (podržava i “dodatne napomene” klonirane ispod)
    const values = [];
    if (ctrl.tagName === 'TEXTAREA' || ctrl.tagName === 'INPUT') {
      if (ctrl.name && ctrl.name.endsWith('[]')) {
        // polje je array -> sve textarea u istom wrapperu
        const wrapper = ctrl.closest('[id$="_wrapper"]') || ctrl.parentElement;
        wrapper?.querySelectorAll('textarea, input').forEach(x=>{
          const val = (x.value||'').trim();
          if (val) values.push(val);
        });
      } else {
        const v = (ctrl.value||'').trim();
        if (v) values.push(v);
      }
    }
    if (!values.length) return;

    // datatype vs object
    if (prop.isDatatype) {
      // literal vrijednosti
      po[prop.iri] = (po[prop.iri]||[]).concat(values.map(v=>({ '@value': v })));
    } else if (prop.isObject) {
      // napravi čvor(ove) prema dosegu (range)
      const objIds = values.map(v=> buildObjectValue(graph, prop.rangeId, v)).filter(Boolean).map(id=>({ '@id': id }));
      if (objIds.length) po[prop.iri] = (po[prop.iri]||[]).concat(objIds);
    }
  });

  graph.push(po);
  return { '@graph': graph };
}
</script>
