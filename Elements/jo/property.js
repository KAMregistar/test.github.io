// ------------- RDA-STYLE PROPERTY RENDERER FOR kamjo -------------
// Reads #P10001 → loads kamjo:P10001 → renders property details

const JSONLD_URL = "../../KAMOntologija_v12.jsonld";
const PREFIX = "kamjo:";

function getHashID() {
    const h = window.location.hash;
    if (!h || !h.startsWith("#")) return null;
    const id = h.substring(1).trim();
    return id.length ? id : null;
}

function findElementByCURIE(data, curie) {
    return Object.values(data).find(el => {
        const idf = el["http://www.registar.kam.hr/ontologies/ont.owl/ID"];
        return idf && idf[0] && idf[0]["@value"] === curie;
    });
}

function literal(el, predicate) {
    const v = el[predicate];
    return v && v[0] && v[0]["@value"] ? v[0]["@value"] : "";
}

function idFrom(el, predicate) {
    const list = el[predicate];
    return list && list[0] && list[0]["@id"] ? list[0]["@id"] : null;
}

function curieFromId(idValue, data) {
    const found = Object.values(data).find(x => x["@id"] === idValue);
    if (!found) return "";
    const idField = found["http://www.registar.kam.hr/ontologies/ont.owl/ID"];
    return idField && idField[0] ? idField[0]["@value"] : "";
}

function render(property, data, curie) {
    const cont = document.getElementById("content");

    const label = literal(property, "http://www.w3.org/2000/01/rdf-schema#label") || curie;
    const definition = literal(property, "http://www.registar.kam.hr/ontologies/ont.owl/definition");

    const domId = idFrom(property, "http://www.w3.org/2000/01/rdf-schema#domain");
    const rngId = idFrom(property, "http://www.w3.org/2000/01/rdf-schema#range");
    const subId = idFrom(property, "http://www.w3.org/2000/01/rdf-schema#subPropertyOf");
    const invId = idFrom(property, "http://www.w3.org/2002/07/owl#inverseOf");

    const domCurie = domId ? curieFromId(domId, data) : "";
    const rngCurie = rngId ? curieFromId(rngId, data) : "";
    const subCurie = subId ? curieFromId(subId, data) : "";
    const invCurie = invId ? curieFromId(invId, data) : "";

    const uri = window.location.href;

    cont.innerHTML = `
        <h2>${label}</h2>

        <table id="propTable" class="display">
            <tbody>
                <tr><td><b>URI</b></td><td><code>${uri}</code></td></tr>
                <tr><td><b>CURIE</b></td><td><code>${curie}</code></td></tr>
                <tr><td><b>Definicija</b></td><td>${definition || "—"}</td></tr>
                <tr><td><b>Domena</b></td><td>${domCurie}</td></tr>
                <tr><td><b>Doseg</b></td><td>${rngCurie}</td></tr>
                <tr><td><b>Podsvojstvo od</b></td><td>${subCurie}</td></tr>
                <tr><td><b>Obrnuto od</b></td><td>${invCurie}</td></tr>
            </tbody>
        </table>
    `;

    $(function(){ $("#propTable").DataTable(); });
}

async function init() {
    const id = getHashID();
    if (!id) {
        document.getElementById("content").innerHTML =
            "<p>Nije zadano svojstvo (npr. #P10001).</p>";
        return;
    }

    const curie = PREFIX + id;

    let data;
    try {
        const r = await fetch(JSONLD_URL);
        data = await r.json();
    } catch {
        document.getElementById("content").innerHTML =
            "<p>Ne mogu učitati ontologiju.</p>";
        return;
    }

    const property = findElementByCURIE(data, curie);
    if (!property) {
        document.getElementById("content").innerHTML =
            `<p>Svojstvo <code>${curie}</code> nije pronađeno.</p>`;
        return;
    }

    render(property, data, curie);
}

window.addEventListener("hashchange", init);
init();
