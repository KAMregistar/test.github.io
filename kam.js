(function () {
  // ====== KONFIGURACIJA S STRANICE (index.html ili Elements/.../index.html) ======
  const cfg = window.KAM_CONFIG || {};
  const pageType = cfg.pageType || "root";
  const jsonPath = cfg.jsonPath || "KAMOntologija_v12.jsonld";
  const groupPrefix = cfg.groupPrefix || null;   // npr. "kamjo"
  const domainLabel = cfg.domainLabel || null;   // npr. "Jedinica opisa"

  let RAW_DATA = null;
  let GRAPH = [];

  // ====== OPĆE POMOĆNE FUNKCIJE =====================================

  function displayLastModified() {
    const el = document.getElementById("last-modified");
    if (!el) return;
    const lastModified = document.lastModified;
    el.innerHTML = `<p>Posljednja izmjena: ${lastModified}</p>`;
  }

function getHashIdGeneric() {
  const h = window.location.hash;
  if (!h || !h.startsWith("#")) return null;
  return h.substring(1).trim();
}

  // data može biti array, { "@graph": [...] } ili običan objekt
  function getGraph(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data["@graph"])) return data["@graph"];
    // fallback – ako je običan objekt s numeričkim ključevima
    return Object.values(data || {});
  }

  // RDA-style linkovi:
  //  - klase:  /Elements/c/#C10001
  //  - svojstva: /Elements/jo/#P10001, /Elements/a/#P100xx, ...
function createCurieLink(curieValue) {
    if (!curieValue) return "";

    const parts = curieValue.split(":");
    if (parts.length !== 2) return curieValue;

    const prefix = parts[0];   // npr. "kamka" ili "kamkt"
    const localId = parts[1];  // npr. "P80002" ili "C10001"

    let folder = "";

    // Sve klase idu u Elements/c/
    if (localId.startsWith("C")) {
        folder = "c";
    } else if (localId.startsWith("P")) {
        // Svojstva: folder je sufiks iza "kam"
        // kamka -> "ka", kamkt -> "kt", kamjo -> "jo" ...
        if (prefix.startsWith("kam")) {
            folder = prefix.substring(3);
        }
    } else {
        // fallback – ako jednom imaš neke druge ID-eve
        if (prefix.startsWith("kam")) {
            folder = prefix.substring(3);
        }
    }

    // Ako iz nekog razloga ne znamo u koji folder, vrati plain tekst
    if (!folder) {
        return curieValue;
    }

    const href = `/Elements/${folder}/#${localId}`;
    return `<a href="${href}">${curieValue}</a>`;
}


  // helper: iz @id (URI-ja) izvuci CURIE iz ontologije
  function getCurieForProperty(propertyField) {
    if (!propertyField || !propertyField[0] || !propertyField[0]["@id"]) return "";
    const idValue = propertyField[0]["@id"];
    const foundElement = GRAPH.find((item) => item["@id"] === idValue);
    if (
      foundElement &&
      foundElement["http://www.registar.kam.hr/ontologies/ont.owl/ID"] &&
      foundElement["http://www.registar.kam.hr/ontologies/ont.owl/ID"][0]
    ) {
      return foundElement["http://www.registar.kam.hr/ontologies/ont.owl/ID"][0]["@value"];
    }
    return "";
  }

  function getHrLabel(element) {
    const labels = element["http://www.w3.org/2000/01/rdf-schema#label"] || [];
    if (!labels.length) return (element["@id"] || "").split("/").pop() || "Bez naziva";
    const hr = labels.find((l) => l["@language"] === "hr");
    return (hr && hr["@value"]) || labels[0]["@value"] || "Bez naziva";
  }

  function isClass(element) {
    const types = element["@type"] || [];
    return types.includes("http://www.w3.org/2002/07/owl#Class");
  }

  // ====== DROPDOWNI (KLASE, SVOJSTVA, PREFIKSI) =====================

  // KLASE: svaka stavka vodi na /Elements/c/#Cxxxxx
  function populateKlaseDropdown() {
  const dd = document.getElementById("klase-dropdown");
  if (!dd) return;
  dd.innerHTML = "";

  GRAPH.forEach((el) => {
    if (!isClass(el)) return;

    const curieField = el["http://www.registar.kam.hr/ontologies/ont.owl/ID"];
    if (!curieField || !curieField[0] || !curieField[0]["@value"]) return;

    const curie = curieField[0]["@value"];      // npr. "kamjo:C10001"
    const parts = curie.split(":");
    if (parts.length !== 2) return;
    const localId = parts[1];                   // "C10001"

    const label = getHrLabel(el);

    const item = document.createElement("div");
    item.textContent = label;
    // ako imaš klasu u CSS-u (npr. dropdown-item), dodaj:
    // item.className = "dropdown-item";

    item.onclick = function () {
      window.location.href = `/Elements/c/#${encodeURIComponent(localId)}`;
    };

    dd.appendChild(item);
  });
}

function populateSvojstvaDropdown() {
  const dd = document.getElementById("svojstva-dropdown");
  if (!dd) return;
  dd.innerHTML = "";

  GRAPH.forEach((el) => {
    if (!isClass(el)) return;

    const curieField = el["http://www.registar.kam.hr/ontologies/ont.owl/ID"];
    if (!curieField || !curieField[0] || !curieField[0]["@value"]) return;

    const curie = curieField[0]["@value"];   // "kamjo:C10001"
    const [prefix] = curie.split(":");
    if (!prefix || !prefix.startsWith("kam")) return;

    const segment = prefix.substring(3);     // "jo", "a", "m", ...
    if (!segment) return;

    const label = getHrLabel(el);

    const item = document.createElement("div");
    item.textContent = label;
    // item.className = "dropdown-item";

    item.onclick = function () {
      window.location.href = `/Elements/${segment}/`;
    };

    dd.appendChild(item);
  });
}


  // PREFIKSI – kao do sada: tablica u #content
  function populatePrefiksi() {
    const btn = document.getElementById("prefiksi");
    if (!btn) return;

    btn.onclick = () => {
      const uniquePrefixes = new Set();
      const content = document.getElementById("content");
      if (!content) return;

      content.innerHTML = "<h2>Prefiksi</h2>";
      let table =
        `<table id="prefTable" class="display"><thead>` +
        `<tr><th>Prefix</th><th>Naziv</th><th>Imenski prostor</th></tr>` +
        `</thead><tbody>`;

      GRAPH.forEach((el) => {
        if (!isClass(el)) return;

        const id = el["@id"] || "Nepoznat ID";
        const namespace = id.substring(0, id.lastIndexOf("/") + 1);

        const curieField = el["http://www.registar.kam.hr/ontologies/ont.owl/ID"];
        if (!curieField || !curieField[0] || !curieField[0]["@value"]) return;

        const curie = curieField[0]["@value"]; // npr. "kamjo:C10001"
        const prefix = curie.split(":")[0]; // "kamjo"
        if (uniquePrefixes.has(prefix)) return;
        uniquePrefixes.add(prefix);

        const className = getHrLabel(el);

        table += `<tr><td>${prefix}</td><td>${className}</td><td>${namespace}</td></tr>`;
      });

      table += "</tbody></table>";
      content.innerHTML += table;

      if (window.$ && $.fn.DataTable) {
        $("#prefTable").DataTable();
      }
    };
  }

  // ====== PRIKAZ DETALJA KLASE (za /Elements/c/#Cxxxx) ===============

  function displayClassDetails(ontologyClass) {
    const content = document.getElementById("content");
    if (!content) return;

    const title = getHrLabel(ontologyClass);
    const id = ontologyClass["@id"] || "Unknown ID";
    const curieValue =
      ontologyClass["http://www.registar.kam.hr/ontologies/ont.owl/ID"] &&
      ontologyClass["http://www.registar.kam.hr/ontologies/ont.owl/ID"][0]
        ? ontologyClass["http://www.registar.kam.hr/ontologies/ont.owl/ID"][0]["@value"]
        : "";
    const definition =
      ontologyClass["http://www.registar.kam.hr/ontologies/ont.owl/definition"] &&
      ontologyClass["http://www.registar.kam.hr/ontologies/ont.owl/definition"][0]
        ? ontologyClass["http://www.registar.kam.hr/ontologies/ont.owl/definition"][0]["@value"]
        : "Bez definicije";
    const types = ontologyClass["@type"] || [];

    let elementType = types
      .map((type) => {
        const t = type.split("#").pop();
        return t === "Class" ? "klasa" : t;
      })
      .join(", ");

    if (!elementType) elementType = "klasa";

    let table =
      `<table id="myClassTable" class="display">` +
      `<thead><tr><th>Svojstvo</th><th>Vrijednost</th></tr></thead>` +
      `<tbody>` +
      `<tr><td>ID</td><td>${id}</td></tr>` +
      `<tr><td>Naziv klase</td><td>${title}</td></tr>` +
      `<tr><td>Element</td><td>${elementType}</td></tr>` +
      `<tr><td>Definicija</td><td>${definition}</td></tr>` +
      `<tr><td>CURIE</td><td>${createCurieLink(curieValue)}</td></tr>` +
      `</tbody></table>`;

    content.innerHTML = table;

    if (window.$ && $.fn.DataTable) {
      $("#myClassTable").DataTable();
    }
  }

  function getHashIdForClass() {
    const h = window.location.hash;
    if (!h || !h.startsWith("#")) return null;
    const id = h.substring(1).trim(); // C10001
    return id || null;
  }

  function findClassByLocalId(localId) {
    return GRAPH.find((el) => {
      if (!isClass(el)) return false;
      const idField = el["http://www.registar.kam.hr/ontologies/ont.owl/ID"];
      if (!idField || !idField[0] || !idField[0]["@value"]) return false;
      const curie = idField[0]["@value"]; // npr. "kamjo:C10001"
      return curie.endsWith(":" + localId);
    });
  }

  function initClassPage() {
    // /Elements/c/
    function showFromHash() {
      const localId = getHashIdForClass();
      const content = document.getElementById("content");
      if (!content) return;

      if (!localId) {
        content.innerHTML =
          "<p>Nije zadana klasa (očekujem hash, npr. #C10001).</p>";
        return;
      }
      const cls = findClassByLocalId(localId);
      if (!cls) {
        content.innerHTML = `<p>Klasa s ID-jem <code>${localId}</code> nije pronađena.</p>`;
        return;
      }
      displayClassDetails(cls);
    }

    window.addEventListener("hashchange", showFromHash);
    showFromHash();
  }

  // ====== TABLICA SVOJSTAVA ZA KLASU (propertyGroup: /Elements/jo/) ======

  function displayPropertiesForClass(classId, className) {
    const content = document.getElementById("content");
    if (!content) return;

    const properties = GRAPH.filter((item) => {
      const domains = item["http://www.w3.org/2000/01/rdf-schema#domain"];
      return (
        domains &&
        domains.some((domain) => domain["@id"] === classId)
      );
    });

    content.innerHTML = `<h2>Svojstva za klasu: ${className}</h2>`;

    if (!properties.length) {
      content.innerHTML += "<p>Za ovu klasu nema definiranih svojstava.</p>";
      return;
    }

    let table =
      `<table id="myPropTable" class="display">` +
      `<thead>` +
      `<tr>` +
      `<th>CURIE</th>` +
      `<th>Naziv svojstva</th>` +
      `<th>Podsvojstvo od</th>` +
      `<th>Obrnuto od</th>` +
      `<th>Doseg</th>` +
      `</tr>` +
      `</thead><tbody>`;

    properties.forEach((property) => {
      const curieField = property["http://www.registar.kam.hr/ontologies/ont.owl/ID"];
      const curieValue =
        curieField && curieField[0] ? curieField[0]["@value"] : "";

      const label =
        property["http://www.w3.org/2000/01/rdf-schema#label"] &&
        property["http://www.w3.org/2000/01/rdf-schema#label"][0]
          ? property["http://www.w3.org/2000/01/rdf-schema#label"][0]["@value"]
          : "Bez naziva";

      const subPropertyOf = getCurieForProperty(
        property["http://www.w3.org/2000/01/rdf-schema#subPropertyOf"]
      );
      const inverseOf = getCurieForProperty(
        property["http://www.w3.org/2002/07/owl#inverseOf"]
      );
      const range = getCurieForProperty(
        property["http://www.w3.org/2000/01/rdf-schema#range"]
      );

      table +=
        "<tr>" +
        `<td>${createCurieLink(curieValue)}</td>` +
        `<td>${label}</td>` +
        `<td>${createCurieLink(subPropertyOf)}</td>` +
        `<td>${createCurieLink(inverseOf)}</td>` +
        `<td>${createCurieLink(range)}</td>` +
        "</tr>";
    });

    table += "</tbody></table>";
    content.innerHTML += table;

    if (window.$ && $.fn.DataTable) {
      $("#myPropTable").DataTable();
    }
  }

  // pronađi klasu za propertyGroup:
  //  - ako ima domainLabel => tražimo po labelu
  //  - inače, ako ima groupPrefix => tražimo klasu čiji CURIE počinje tim prefiksom i lokal ID počinje na "C"
  function findDomainClassForGroup() {
    // 1) po nazivu (Jedinica opisa, Agent, Mjesto...)
    if (domainLabel) {
      const byLabel = GRAPH.find(
        (el) => isClass(el) && getHrLabel(el) === domainLabel
      );
      if (byLabel) return byLabel;
    }

    // 2) po prefiksu
    if (groupPrefix) {
      const byPrefix = GRAPH.find((el) => {
        if (!isClass(el)) return false;
        const curieField = el["http://www.registar.kam.hr/ontologies/ont.owl/ID"];
        if (!curieField || !curieField[0] || !curieField[0]["@value"]) return false;
        const curie = curieField[0]["@value"]; // npr. "kamjo:C10001"
        if (!curie.startsWith(groupPrefix + ":")) return false;
        const localId = curie.split(":")[1] || "";
        return localId.startsWith("C");
      });
      if (byPrefix) return byPrefix;
    }

    return null;
  }

 function initPropertyGroup() {
  const content = document.getElementById("content");
  if (!content) return;

  const domainClass = findDomainClassForGroup();
  if (!domainClass) {
    content.innerHTML =
      "<p>Nisam uspio pronaći klasu za ovu grupu svojstava (provjeri domainLabel/groupPrefix).</p>";
    return;
  }

  const classId = domainClass["@id"];
  const classLabel = getHrLabel(domainClass);

  // prefiks za svojstva (kamd, kamjo, ...)
  const prefix =
    groupPrefix ||
    (function () {
      const curieField =
        domainClass["http://www.registar.kam.hr/ontologies/ont.owl/ID"];
      if (!curieField || !curieField[0] || !curieField[0]["@value"]) return "";
      return curieField[0]["@value"].split(":")[0]; // npr. "kamd"
    })();

  function render() {
    const hashId = getHashIdGeneric(); // npr. "P20007" ili null

    // BEZ HASH-a → tablica svojstava za klasu (kao dosad)
    if (!hashId) {
      displayPropertiesForClass(classId, classLabel);
      return;
    }

    // S HASH-om → detalj svojstva
    const curie = prefix + ":" + hashId;
    const prop = GRAPH.find((el) => {
      const cf = el["http://www.registar.kam.hr/ontologies/ont.owl/ID"];
      return cf && cf[0] && cf[0]["@value"] === curie;
    });

    if (!prop) {
      content.innerHTML =
        `<p>Svojstvo <code>${curie}</code> nije pronađeno u ontologiji.</p>`;
      return;
    }

    const label =
      prop["http://www.w3.org/2000/01/rdf-schema#label"]?.[0]?.["@value"] ||
      "Bez naziva";
    const def =
      prop["http://www.registar.kam.hr/ontologies/ont.owl/definition"]?.[0]?.[
        "@value"
      ] || "Bez definicije";

    const domainCurie = getCurieForProperty(
      prop["http://www.w3.org/2000/01/rdf-schema#domain"]
    );
    const rangeCurie = getCurieForProperty(
      prop["http://www.w3.org/2000/01/rdf-schema#range"]
    );
    const subCurie = getCurieForProperty(
      prop["http://www.w3.org/2000/01/rdf-schema#subPropertyOf"]
    );
    const invCurie = getCurieForProperty(
      prop["http://www.w3.org/2002/07/owl#inverseOf"]
    );

    let html = `<h2>${label}</h2>
      <table id="myPropDetail" class="display">
        <tbody>
          <tr><td><b>CURIE</b></td><td>${curie}</td></tr>
          <tr><td><b>Definicija</b></td><td>${def}</td></tr>
          <tr><td><b>Domena</b></td><td>${createCurieLink(domainCurie)}</td></tr>
          <tr><td><b>Doseg</b></td><td>${createCurieLink(rangeCurie)}</td></tr>
          <tr><td><b>Podsvojstvo od</b></td><td>${createCurieLink(subCurie)}</td></tr>
          <tr><td><b>Obrnuto od</b></td><td>${createCurieLink(invCurie)}</td></tr>
        </tbody>
      </table>`;

    content.innerHTML = html;
    if (window.$ && $.fn.DataTable) {
      $("#myPropDetail").DataTable();
    }
  }

  // početna render funkcija + reakcija na promjenu hash-a
  window.addEventListener("hashchange", render);
  render();
}

  // ====== INIT ZA ROOT STRANICU =====================================

  function initRootPage() {
  }

  // ====== GLAVNI FETCH & DISPATCH ===================================

  function initAfterDataLoaded() {
    // meni vrijedi za sve stranice
    populateKlaseDropdown();
    populateSvojstvaDropdown();
    populatePrefiksi();

    if (pageType === "root") {
      initRootPage();
    } else if (pageType === "classPage") {
      initClassPage();
    } else if (pageType === "propertyGroup") {
      initPropertyGroup();
    }
  }


  // start
  displayLastModified();

  fetch(jsonPath)
    .then((r) => {
      if (!r.ok) throw new Error("Network response was not ok");
      return r.json();
    })
    .then((data) => {
      RAW_DATA = data;
      GRAPH = getGraph(data);
      initAfterDataLoaded();
    })
    .catch((err) => {
      console.error("Pogreška u dohvaćanju JSON-LD:", err);
      const content = document.getElementById("content");
      if (content) {
        content.innerHTML =
          "<p>Greška pri učitavanju ontologije. Provjeri putanju jsonPath u KAM_CONFIG.</p>";
      }
    });
})();
