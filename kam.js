(function () {
    const cfg = window.KAM_CONFIG || {};
    const PAGE_TYPE = cfg.pageType || "root";
    const JSONLD_URL = cfg.jsonPath || "KAMOntologija_v12.jsonld";

    // ------------------- HELPERS -------------------

    function qs(id) { return document.getElementById(id); }

    function getHashId() {
        const h = window.location.hash;
        if (!h || !h.startsWith("#")) return null;
        return h.substring(1).trim() || null;
    }

    function createCurieLink(curie) {
        if (!curie) return "";
        const [prefix, localId] = curie.split(":");
        if (!localId) return curie;

        let segment = "";
        if (localId.startsWith("C")) segment = "c";
        else if (localId.startsWith("P")) segment = prefix.substring(3);

        return `<a href="/Elements/${segment}/#${localId}">${curie}</a>`;
    }

    function findByCurie(data, curie) {
        return Object.values(data).find(el =>
            el["http://www.registar.kam.hr/ontologies/ont.owl/ID"]?.[0]?.["@value"] === curie
        );
    }

    function findClassByName(data, label) {
        return Object.values(data).find(el => {
            if (!el["@type"]?.includes("http://www.w3.org/2002/07/owl#Class")) return false;
            return el["http://www.w3.org/2000/01/rdf-schema#label"]?.[0]?.["@value"] === label;
        });
    }

    function displayPropertiesForClass(data, classEl) {
        const classLabel =
            classEl["http://www.w3.org/2000/01/rdf-schema#label"][0]["@value"];

        const classId = classEl["@id"];

        const props = Object.values(data).filter(p => {
            const dom = p["http://www.w3.org/2000/01/rdf-schema#domain"];
            return dom?.some(d => d["@id"] === classId);
        });

        let html = `<h2>Svojstva za klasu: ${classLabel}</h2>`;
        html += `<table id="tbl" class="display"><thead>
            <tr><th>CURIE</th><th>Naziv</th><th>Domena</th><th>Doseg</th></tr>
        </thead><tbody>`;

        props.forEach(p => {
            const curie = p["http://www.registar.kam.hr/ontologies/ont.owl/ID"]?.[0]?.["@value"];
            const label = p["http://www.w3.org/2000/01/rdf-schema#label"]?.[0]?.["@value"];
            const range = p["http://www.w3.org/2000/01/rdf-schema#range"]?.[0]?.["@id"];
            const domain = p["http://www.w3.org/2000/01/rdf-schema#domain"]?.[0]?.["@id"];

            html += `<tr>
                <td>${createCurieLink(curie)}</td>
                <td>${label}</td>
                <td>${createCurieLink(findByCurie(data, domain)?.["http://www.registar.kam.hr/ontologies/ont.owl/ID"]?.[0]?.["@value"] || "")}</td>
                <td>${createCurieLink(findByCurie(data, range)?.["http://www.registar.kam.hr/ontologies/ont.owl/ID"]?.[0]?.["@value"] || "")}</td>
            </tr>`;
        });

        html += `</tbody></table>`;
        qs("content").innerHTML = html;
        $("#tbl").DataTable();
    }

    // ------------------- MENI -------------------

    function populateDropdowns(data) {
        const klase = qs("klase-dropdown");
        const svojstva = qs("svojstva-dropdown");

        Object.values(data).forEach(el => {
            if (!el["@type"]?.includes("http://www.w3.org/2002/07/owl#Class")) return;

            const label = el["http://www.w3.org/2000/01/rdf-schema#label"]?.[0]?.["@value"];
            const curie = el["http://www.registar.kam.hr/ontologies/ont.owl/ID"]?.[0]?.["@value"];
            const localId = curie?.split(":")[1];

            // KLASE
            const d1 = document.createElement("div");
            d1.textContent = label;
            d1.onclick = () => window.location.href = `/Elements/c/#${localId}`;
            klase.appendChild(d1);

            // SVOJSTVA — specifična domena ide u svoj folder
            const d2 = document.createElement("div");
            d2.textContent = label;

            if (label === cfg.domainLabel) {
                d2.onclick = () => window.location.href = `/Elements/${cfg.groupPrefix.substring(3)}/`;
            } else {
                d2.onclick = () => displayPropertiesForClass(data, el);
            }
            svojstva.appendChild(d2);
        });
    }

    // ------------------- PAGE TYPES -------------------

    function initRoot(data) {
        populateDropdowns(data);
    }

    function initClassPage(data) {
        populateDropdowns(data);

        function update() {
            const id = getHashId();
            if (!id) return;

            const curie = `kamc:${id}`;
            const cls = findByCurie(data, curie);
            if (!cls) return;

            let label = cls["http://www.w3.org/2000/01/rdf-schema#label"]?.[0]?.["@value"];

            qs("content").innerHTML = `<h2>${label}</h2><p>Prikaz klase u izradi</p>`;
        }

        update();
        window.addEventListener("hashchange", update);
    }

    function initPropertyGroup(data) {
        populateDropdowns(data);

        function update() {
            const localId = getHashId();

            // BEZ HASH — prikaži svojstva za domenu
            if (!localId) {
                const classEl = findClassByName(data, cfg.domainLabel);
                if (classEl) displayPropertiesForClass(data, classEl);
                return;
            }

            // S HASH — prikaži detalj svojstva
            const curie = `${cfg.groupPrefix}:${localId}`;
            const p = findByCurie(data, curie);
            if (!p) {
                qs("content").innerHTML = `<p>Svojstvo ${curie} ne postoji.</p>`;
                return;
            }

            const label = p["http://www.w3.org/2000/01/rdf-schema#label"]?.[0]?.["@value"];
            const def = p["http://www.registar.kam.hr/ontologies/ont.owl/definition"]?.[0]?.["@value"];

            qs("content").innerHTML = `
                <h2>${label}</h2>
                <p><b>CURIE:</b> ${curie}</p>
                <p><b>Definicija:</b> ${def || "—"}</p>
            `;
        }

        update();
        window.addEventListener("hashchange", update);
    }

    // ------------------- MAIN INIT -------------------

    document.addEventListener("DOMContentLoaded", () => {
        fetch(JSONLD_URL)
            .then(r => r.json())
            .then(data => {
                if (PAGE_TYPE === "root") initRoot(data);
                else if (PAGE_TYPE === "classPage") initClassPage(data);
                else if (PAGE_TYPE === "propertyGroup") initPropertyGroup(data);
            })
            .catch(err => {
                qs("content").innerHTML = "<p>Greška pri učitavanju.</p>";
                console.error(err);
            });
    });
})();
