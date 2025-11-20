// kam.js – zajednički JS za registar KAM
// Očekuje da je prije uključivanja postavljen window.KAM_CONFIG = { pageType, jsonPath }

(function () {
    const config = window.KAM_CONFIG || {};
    const PAGE_TYPE = config.pageType || "root";
    const JSONLD_URL = config.jsonPath || "KAMOntologija_v12.jsonld";

    // ---------- OPĆE FUNKCIJE ----------

    function displayLastModified() {
        const lastModified = document.lastModified;
        const el = document.getElementById("last-modified");
        if (el) {
            el.innerHTML = `<p>Posljednja izmjena: ${lastModified}</p>`;
        }
    }

    function createCurieLink(curieValue) {
        if (!curieValue) return "";

        const parts = curieValue.split(":");
        if (parts.length !== 2) return curieValue;

        const [prefix, localId] = parts;

        if (prefix.startsWith("kam")) {
            let segment = "";

            if (localId.startsWith("C")) {
                // klase → /Elements/c/
                segment = "c";
            } else if (localId.startsWith("P")) {
                // svojstva → po prefiksu (jo, a, ...)
                const suffix = prefix.substring(3); // "jo" iz "kamjo"
                segment = suffix || "";
            } else {
                segment = prefix.substring(3) || "";
            }

            if (segment) {
                const link = `/Elements/${segment}/#${localId}`;
                return `<a href="${link}">${curieValue}</a>`;
            }
        }

        // fallback – ako nije KAM prefiks
        const fallbackLink = `property.html?curie=${encodeURIComponent(curieValue)}`;
        return `<a href="${fallbackLink}">${curieValue}</a>`;
    }

    // helper: iz @id (URI) do KAM CURIE-ja
    function getCurieForProperty(propertyField, data) {
        if (propertyField && propertyField[0] && propertyField[0]["@id"]) {
            const idValue = propertyField[0]["@id"];
            const foundElement = Object.values(data).find((item) => item["@id"] === idValue);
            if (foundElement && foundElement["http://www.registar.kam.hr/ontologies/ont.owl/ID"]) {
                return foundElement["http://www.registar.kam.hr/ontologies/ont.owl/ID"][0]["@value"];
            }
        }
        return "";
    }

    // ---------- PRIKAZ KLASE ----------

    function displayClassDetails(ontologyClass) {
        const content = document.getElementById("content");
        if (!content) return;
        content.innerHTML = "";

        const title = ontologyClass["http://www.w3.org/2000/01/rdf-schema#label"]
            ? ontologyClass["http://www.w3.org/2000/01/rdf-schema#label"][0]["@value"]
            : "Unknown Class";
        const id = ontologyClass["@id"] || "Unknown ID";
        const curieValue = ontologyClass["http://www.registar.kam.hr/ontologies/ont.owl/ID"]
            ? ontologyClass["http://www.registar.kam.hr/ontologies/ont.owl/ID"][0]["@value"]
            : "";
        const definition = ontologyClass["http://www.registar.kam.hr/ontologies/ont.owl/definition"]
            ? ontologyClass["http://www.registar.kam.hr/ontologies/ont.owl/definition"][0]["@value"]
            : "No definition available";
        const types = ontologyClass["@type"] || [];

        let table = `<table id="myClassTable" class="display">
            <thead>
                <tr><th>Svojstvo</th><th>Vrijednost</th></tr>
            </thead>
            <tbody>
                <tr><td>ID</td><td>${id}</td></tr>
                <tr><td>Naziv klase</td><td>${title}</td></tr>
                <tr><td>Element</td><td>${
                    types
                        .map((type) => {
                            const t = type.split("#").pop();
                            return t === "Class" ? "klasa" : t;
                        })
                        .join(", ")
                }</td></tr>
                <tr><td>Definicija</td><td>${definition}</td></tr>
                <tr><td>CURIE</td><td>${createCurieLink(curieValue)}</td></tr>
            </tbody>
        </table>`;

        content.innerHTML = table;

        if (window.$ && $.fn.DataTable) {
            $(function () {
                $("#myClassTable").DataTable();
            });
        }
    }

    // tablica "Svojstva za klasu: X"
    function displayPropertiesForClass(classId, data, className) {
        const properties = Object.values(data).filter((item) => {
            const domains = item["http://www.w3.org/2000/01/rdf-schema#domain"];
            return domains && domains.some((domain) => domain["@id"] === classId);
        });

        const content = document.getElementById("content");
        if (!content) return;

        content.innerHTML = `<h2>Svojstva za klasu: ${className}</h2>`;

        if (properties.length === 0) {
            content.innerHTML += "<p>Nema svojstava za ovu klasu.</p>";
            return;
        }

        let table = `<table id="myTable" class="display">
            <thead>
                <tr>
                    <th>CURIE</th>
                    <th>Naziv svojstva</th>
                    <th>Podsvojstvo od</th>
                    <th>Obrnuto od</th>
                    <th>Doseg</th>
                </tr>
            </thead>
            <tbody>`;

        properties.forEach((property) => {
            const curieValue = property["http://www.registar.kam.hr/ontologies/ont.owl/ID"]
                ? property["http://www.registar.kam.hr/ontologies/ont.owl/ID"][0]["@value"]
                : "";
            const label = property["http://www.w3.org/2000/01/rdf-schema#label"]
                ? property["http://www.w3.org/2000/01/rdf-schema#label"][0]["@value"]
                : "Unknown Label";
            const subPropertyOf = getCurieForProperty(
                property["http://www.w3.org/2000/01/rdf-schema#subPropertyOf"],
                data
            );
            const inverseOf = getCurieForProperty(
                property["http://www.w3.org/2002/07/owl#inverseOf"],
                data
            );
            const range = getCurieForProperty(
                property["http://www.w3.org/2000/01/rdf-schema#range"],
                data
            );

            table += `<tr>
                <td>${createCurieLink(curieValue)}</td>
                <td>${label}</td>
                <td>${createCurieLink(subPropertyOf)}</td>
                <td>${createCurieLink(inverseOf)}</td>
                <td>${createCurieLink(range)}</td>
            </tr>`;
        });

        table += "</tbody></table>";
        content.innerHTML += table;

        if (window.$ && $.fn.DataTable) {
            $(function () {
                $("#myTable").DataTable();
            });
        }
    }

    // ---------- DROPDOWNI ----------

    // KLASE – sada vode na canonical URI /Elements/c/#Cxxxx
    function populateKlaseDropdown(data) {
        const klaseDropdown = document.getElementById("klase-dropdown");
        if (!klaseDropdown) return;

        Object.keys(data).forEach((key) => {
            const element = data[key];
            const labels = element["http://www.w3.org/2000/01/rdf-schema#label"];
            const dropdownLabel =
                labels && labels[0] && labels[0]["@value"]
                    ? labels[0]["@value"]
                    : element["@id"].split("/").pop();

            if (
                element["@type"] &&
                element["@type"].includes("http://www.w3.org/2002/07/owl#Class")
            ) {
                const idField =
                    element["http://www.registar.kam.hr/ontologies/ont.owl/ID"];
                const curie = idField && idField[0] ? idField[0]["@value"] : null;
                const localId = curie ? curie.split(":")[1] : null; // C10003

                const item = document.createElement("div");
                item.textContent = dropdownLabel;

                if (localId) {
                    item.onclick = () => {
                        window.location.href = `/Elements/c/#${localId}`;
                    };
                } else {
                    item.onclick = () => displayClassDetails(element);
                }

                klaseDropdown.appendChild(item);
            }
        });
    }

    // SVOJSTVA – lista klasa, klik → tablica svojstava za tu klasu
    function populateSvojstvaDropdown(data) {
        const svojstvaDropdown = document.getElementById("svojstva-dropdown");
        if (!svojstvaDropdown) return;

        Object.keys(data).forEach((key) => {
            const element = data[key];
            const labels = element["http://www.w3.org/2000/01/rdf-schema#label"];
            const dropdownLabel =
                labels && labels[0] && labels[0]["@value"]
                    ? labels[0]["@value"]
                    : element["@id"].split("/").pop();

            if (
                element["@type"] &&
                element["@type"].includes("http://www.w3.org/2002/07/owl#Class")
            ) {
                const item = document.createElement("div");
                item.textContent = dropdownLabel;
                item.onclick = () =>
                    displayPropertiesForClass(element["@id"], data, dropdownLabel);
                svojstvaDropdown.appendChild(item);
            }
        });
    }

    function populatePrefiksi(data) {
        const prefiksi = document.getElementById("prefiksi");
        if (!prefiksi) return;

        prefiksi.addEventListener("click", () => {
            const uniquePrefixes = new Set();
            const content = document.getElementById("content");
            if (!content) return;

            content.innerHTML = "<h2>Prefiksi</h2>";
            let table =
                "<table><tr><th>Prefix</th><th>Naziv</th><th>Imenski prostor</th></tr>";

            Object.keys(data).forEach((key) => {
                const element = data[key];

                if (
                    element["@type"] &&
                    element["@type"].includes("http://www.w3.org/2002/07/owl#Class")
                ) {
                    const id = element["@id"] || "Nepoznat ID";
                    const namespace = id.substring(0, id.lastIndexOf("/") + 1);
                    const curieValue =
                        element["http://www.registar.kam.hr/ontologies/ont.owl/ID"] &&
                        element[
                            "http://www.registar.kam.hr/ontologies/ont.owl/ID"
                        ][0]["@value"];

                    if (curieValue) {
                        const prefix = curieValue.split(":")[0];
                        if (!uniquePrefixes.has(prefix)) {
                            uniquePrefixes.add(prefix);
                            const className =
                                element[
                                    "http://www.w3.org/2000/01/rdf-schema#label"
                                ][0]["@value"];
                            table += `<tr><td>${prefix}</td><td>${className}</td><td>${namespace}</td></tr>`;
                        }
                    }
                }
            });

            table += "</table>";
            content.innerHTML += table;
        });
    }

    // ---------- HASH HELPERI ----------

    function getHashId() {
        const h = window.location.hash;
        if (!h || !h.startsWith("#")) return null;
        const id = h.substring(1).trim();
        return id || null;
    }

    function findClassByLocalId(localId, data) {
        return Object.values(data).find((el) => {
            if (
                !(
                    el["@type"] &&
                    el["@type"].includes("http://www.w3.org/2002/07/owl#Class")
                )
            ) {
                return false;
            }
            const idField =
                el["http://www.registar.kam.hr/ontologies/ont.owl/ID"];
            if (!idField || !idField[0] || !idField[0]["@value"]) return false;
            const curie = idField[0]["@value"]; // npr. kamjo:C10001
            return curie.endsWith(":" + localId);
        });
    }

    function findElementByCURIE(data, curie) {
        return Object.values(data).find((el) => {
            const idf = el["http://www.registar.kam.hr/ontologies/ont.owl/ID"];
            return idf && idf[0] && idf[0]["@value"] === curie;
        });
    }

    // ---------- INIT ZA POJEDINE STRANICE ----------

    function initRootPage(data) {
        populateKlaseDropdown(data);
        populateSvojstvaDropdown(data);
        populatePrefiksi(data);
        // sadržaj korijenske stranice ostaje onakav kakav je u HTML-u
    }

    function initClassPage(data) {
        populateKlaseDropdown(data);
        populateSvojstvaDropdown(data);
        populatePrefiksi(data);

        function showFromHash() {
            const localId = getHashId();
            const content = document.getElementById("content");
            if (!localId || !content) {
                if (content) {
                    content.innerHTML =
                        "<p>Nije zadana klasa (očekujem hash, npr. #C10001).</p>";
                }
                return;
            }
            const cls = findClassByLocalId(localId, data);
            if (!cls) {
                content.innerHTML = `<p>Klasa s ID-jem <code>${localId}</code> nije pronađena.</p>`;
                return;
            }
            displayClassDetails(cls);
        }

        window.addEventListener("hashchange", showFromHash);
        showFromHash();
    }

    function initPropertyJoPage(data) {
        populateKlaseDropdown(data);
        populateSvojstvaDropdown(data);
        populatePrefiksi(data);

        function showFromHash() {
            const localId = getHashId();
            const content = document.getElementById("content");
            if (!localId || !content) {
                if (content) {
                    content.innerHTML =
                        "<p>Nije zadano svojstvo (očekujem hash, npr. #P10001).</p>";
                }
                return;
            }
            const curie = "kamjo:" + localId;
            const prop = findElementByCURIE(data, curie);
            if (!prop) {
                content.innerHTML = `<p>Svojstvo <code>${curie}</code> nije pronađeno u ontologiji.</p>`;
                return;
            }

            // prikaz svojstva – vrlo slično onome što već imaš
            const label = prop["http://www.w3.org/2000/01/rdf-schema#label"]
                ? prop["http://www.w3.org/2000/01/rdf-schema#label"][0]["@value"]
                : curie;
            const definition =
                prop["http://www.registar.kam.hr/ontologies/ont.owl/definition"] &&
                prop["http://www.registar.kam.hr/ontologies/ont.owl/definition"][0]["@value"];

            const subPropertyOf = getCurieForProperty(
                prop["http://www.w3.org/2000/01/rdf-schema#subPropertyOf"],
                data
            );
            const inverseOf = getCurieForProperty(
                prop["http://www.w3.org/2002/07/owl#inverseOf"],
                data
            );
            const range = getCurieForProperty(
                prop["http://www.w3.org/2000/01/rdf-schema#range"],
                data
            );
            const domain = getCurieForProperty(
                prop["http://www.w3.org/2000/01/rdf-schema#domain"],
                data
            );

            const uri = window.location.href;

            content.innerHTML = `
                <h2>${label}</h2>
                <table id="propTable" class="display">
                    <tbody>
                        <tr><td><b>URI</b></td><td><code>${uri}</code></td></tr>
                        <tr><td><b>CURIE</b></td><td><code>${curie}</code></td></tr>
                        <tr><td><b>Definicija</b></td><td>${definition || "—"}</td></tr>
                        <tr><td><b>Domena</b></td><td>${createCurieLink(domain)}</td></tr>
                        <tr><td><b>Doseg</b></td><td>${createCurieLink(range)}</td></tr>
                        <tr><td><b>Podsvojstvo od</b></td><td>${createCurieLink(
                            subPropertyOf
                        )}</td></tr>
                        <tr><td><b>Obrnuto od</b></td><td>${createCurieLink(
                            inverseOf
                        )}</td></tr>
                    </tbody>
                </table>
            `;

            if (window.$ && $.fn.DataTable) {
                $(function () {
                    $("#propTable").DataTable({
                        paging: false,
                        searching: false,
                        info: false,
                    });
                });
            }
        }

        window.addEventListener("hashchange", showFromHash);
        showFromHash();
    }

    // ---------- GLAVNI INIT ----------

    function initWithData(data) {
        displayLastModified();

        if (PAGE_TYPE === "root") {
            initRootPage(data);
        } else if (PAGE_TYPE === "classPage") {
            initClassPage(data);
        } else if (PAGE_TYPE === "propertyJo") {
            initPropertyJoPage(data);
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        fetch(JSONLD_URL)
            .then((r) => {
                if (!r.ok) throw new Error("Network response was not ok");
                return r.json();
            })
            .then((data) => {
                initWithData(data);
            })
            .catch((err) => {
                console.error(err);
                const content = document.getElementById("content");
                if (content) {
                    content.innerHTML =
                        "<p>Greška pri učitavanju ontologije.</p>";
                }
            });
    });
})();
