(function () {
    const cfg = window.KAM_CONFIG || {};
    const PAGE_TYPE = cfg.pageType || "root";
    const JSONLD_URL = cfg.jsonPath || "KAMOntologija_v12.jsonld";

    // ----------------- HELPERS -----------------

    const q = (id) => document.getElementById(id);

    function getHashId() {
        const h = window.location.hash;
        if (!h || !h.startsWith("#")) return null;
        return h.substring(1).trim();
    }

    function createCurieLink(curie) {
        if (!curie) return "";
        const [prefix, localId] = curie.split(":");
        if (!localId) return curie;

        let folder = "";
        if (localId.startsWith("C")) folder = "c";
        else if (localId.startsWith("P")) folder = prefix.substring(3);

        return `<a href="/Elements/${folder}/#${localId}">${curie}</a>`;
    }

    function getElementByCurie(data, curie) {
        return Object.values(data).find(el =>
            el["http://www.registar.kam.hr/ontologies/ont.owl/ID"]
            ?. [0]?.["@value"] === curie
        );
    }

    function getLabel(el) {
        return el["http://www.w3.org/2000/01/rdf-schema#label"]?.[0]?.["@value"] || "";
    }

    function getCurie(el) {
        return el["http://www.registar.kam.hr/ontologies/ont.owl/ID"]?.[0]?.["@value"] || "";
    }

    function getDefinition(el) {
        return el["http://www.registar.kam.hr/ontologies/ont.owl/definition"]?.[0]?.["@value"] || "";
    }

    function extractCurieFromProperty(propField, data) {
        if (!propField || !propField[0]) return "";
        const id = propField[0]["@id"];
        const found = Object.values(data).find(x => x["@id"] === id);
        return found ? getCurie(found) : "";
    }

    function findClassByLabel(data, label) {
        return Object.values(data).find(el =>
            el["@type"]?.includes("http://www.w3.org/2002/07/owl#Class") &&
            getLabel(el) === label
        );
    }

    // ----------------- TABLES -----------------

    function displayPropertiesForClass(data, classEl) {
        const classLabel = getLabel(classEl);
        const classId = classEl["@id"];

        const properties = Object.values(data).filter(el => {
            const domain = el["http://www.w3.org/2000/01/rdf-schema#domain"];
            return domain?.some(d => d["@id"] === classId);
        });

        let html = `<h2>Svojstva za klasu: "${classLabel}"</h2>`;
        html += `<table id="tbl" class="display"><thead>
            <tr>
                <th>CURIE</th>
                <th>Naziv</th>
                <th>Domena</th>
                <th>Doseg</th>
            </tr></thead><tbody>`;

        properties.forEach(p => {
            const curie = getCurie(p);
            const label = getLabel(p);
            const domainCurie = extractCurieFromProperty(
                p["http://www.w3.org/2000/01/rdf-schema#domain"],
                data
            );
            const rangeCurie = extractCurieFromProperty(
                p["http://www.w3.org/2000/01/rdf-schema#range"],
                data
            );

            html += `<tr>
                <td>${createCurieLink(curie)}</td>
                <td>${label}</td>
                <td>${createCurieLink(domainCurie)}</td>
                <td>${createCurieLink(rangeCurie)}</td>
            </tr>`;
        });

        html += `</tbody></table>`;
        q("content").innerHTML = html;

        $("#tbl").DataTable();
    }

    function displayClassDetails(data, classEl) {
        let html = `<h2>${getLabel(classEl)}</h2>
            <table id="tbl" class="display"><tbody>
            <tr><td><b>CURIE</b></td><td>${createCurieLink(getCurie(classEl))}</td></tr>
            <tr><td><b>Definicija</b></td><td>${getDefinition(classEl)}</td></tr>
        </tbody></table>`;

        q("content").innerHTML = html;
        $("#tbl").DataTable();
    }

    function displayPropertyDetails(data, prefix, localId) {
        const curie = `${prefix}:${localId}`;
        const el = getElementByCurie(data, curie);

        if (!el) {
            q("content").innerHTML = `<p>Svojstvo <code>${curie}</code> ne postoji.</p>`;
            return;
        }

        const domain = extractCurieFromProperty(
            el["http://www.w3.org/2000/01/rdf-schema#domain"],
            data
        );
        const range = extractCurieFromProperty(
            el["http://www.w3.org/2000/01/rdf-schema#range"],
            data
        );
        const inverse = extractCurieFromProperty(
            el["http://www.w3.org/2002/07/owl#inverseOf"],
            data
        );
        const superP = extractCurieFromProperty(
            el["http://www.w3.org/2000/01/rdf-schema#subPropertyOf"],
            data
        );

        let html = `<h2>${getLabel(el)}</h2>
            <table id="tbl" class="display"><tbody>
                <tr><td><b>CURIE</b></td><td>${curie}</td></tr>
                <tr><td><b>Definicija</b></td><td>${getDefinition(el)}</td></tr>
                <tr><td><b>Domena</b></td><td>${createCurieLink(domain)}</td></tr>
                <tr><td><b>Doseg</b></td><td>${createCurieLink(range)}</td></tr>
                <tr><td><b>Podsvojstvo od</b></td><td>${createCurieLink(superP)}</td></tr>
                <tr><td><b>Obrnuto od</b></td><td>${createCurieLink(inverse)}</td></tr>
            </tbody></table>`;

        q("content").innerHTML = html;
        $("#tbl").DataTable();
    }

    // ----------------- MENU -----------------

    function populateMenus(data) {
        const klase = q("klase-dropdown");
        const svojstva = q("svojstva-dropdown");

        Object.values(data).forEach(el => {
            if (!el["@type"]?.includes("http://www.w3.org/2002/07/owl#Class")) return;

            const label = getLabel(el);
            const curie = getCurie(el);
            const localId = curie.split(":")[1];

            // KLASE
            const k = document.createElement("div");
            k.textContent = label;
            k.onclick = () => window.location.href = `/Elements/c/#${localId}`;
            klase.appendChild(k);

            // SVOJSTVA
            const s = document.createElement("div");
            s.textContent = label;

            if (label === cfg.domainLabel) {
                const folder = cfg.groupPrefix.substring(3);
                s.onclick = () => window.location.href = `/Elements/${folder}/`;
            } else {
                s.onclick = () => displayPropertiesForClass(data, el);
            }

            svojstva.appendChild(s);
        });
    }

    // ----------------- PAGE TYPES -----------------

    function initRoot(data) {
        populateMenus(data);
    }

    function initClassPage(data) {
        populateMenus(data);

        function update() {
            const id = getHashId();
            if (!id) return;
            const curie = `kamc:${id}`;
            const cls = getElementByCurie(data, curie);
            if (!cls) return;

            displayClassDetails(data, cls);
        }

        update();
        window.addEventListener("hashchange", update);
    }

    function initPropertyGroup(data) {
        populateMenus(data);

        function update() {
            const localId = getHashId();
            const prefix = cfg.groupPrefix;

            // BEZ HASH → tablica svojstava klase
            if (!localId) {
                const cls = findClassByLabel(data, cfg.domainLabel);
                if (cls) displayPropertiesForClass(data, cls);
                return;
            }

            // S HASH → detalj svojstva
            displayPropertyDetails(data, prefix, localId);
        }

        update();
        window.addEventListener("hashchange", update);
    }

    // ----------------- MAIN -----------------

    document.addEventListener("DOMContentLoaded", () => {
        fetch(JSONLD_URL)
            .then(r => r.json())
            .then(data => {
                if (PAGE_TYPE === "root") initRoot(data);
                else if (PAGE_TYPE === "classPage") initClassPage(data);
                else if (PAGE_TYPE === "propertyGroup") initPropertyGroup(data);
            })
            .catch(err => {
                q("content").innerHTML = "<p>Greška pri učitavanju ontologije.</p>";
                console.error(err);
            });
    });
})();
