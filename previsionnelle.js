// 🔗 URLs NoCodeAPI pour le PREVISIONNEL
const PREV_BASE_URL = "https://v1.nocodeapi.com/loou142/google_sheets/YsLMknJkjiuqDlxW";
const PREV_TAB_ID   = "PREVISIONNEL";

// GET (lecture)
const PREV_GET_URL  = `${PREV_BASE_URL}?tabId=${PREV_TAB_ID}`;
// POST (ajout de lignes sous forme d'objets JSON)
const PREV_ADD_URL  = `${PREV_BASE_URL}/addRows?tabId=${PREV_TAB_ID}`;

document.addEventListener("DOMContentLoaded", () => {
  const moisSelect  = document.getElementById("prev-mois-select");
  const anneeSelect = document.getElementById("prev-annee-select");
  const saveBtn     = document.getElementById("prev-save");
  const statusSpan  = document.getElementById("prev-status");

  const totalDepensesCell = document.getElementById("total-depenses");
  const totalEntreesCell  = document.getElementById("total-entrees");
  const totalEpargneCell  = document.getElementById("total-epargne");

  // Résumé global (cadre blanc)
  const resumeDepensesSpan = document.getElementById("resume-depenses");
  const resumeEntreesSpan  = document.getElementById("resume-entrees");
  const resumeResultatSpan = document.getElementById("resume-resultat");

  const tbodyDepenses = document.getElementById("tbody-depenses");
  const tbodyRevenus  = document.getElementById("tbody-revenus");
  const tbodyEpargne  = document.getElementById("tbody-epargne");

  const allAmountInputs = () => document.querySelectorAll(".prev-input");

  // ids "fixes" (lignes pré-remplies)
  const STATIC_IDS = {
    depenses: [
      "loyer",
      "elec_gaz",
      "ass_voiture",
      "garantie",
      "tel",
      "credit_agricole",
      "apple",
      "essence",
      "courses",
      "epargne_pel",
      "epargne_tr_dep",
      "epargne_livret_a_dep",
      "epargne_fortuneo_dep"
    ],
    revenus: [
      "salaire",
      "caf",
      "mois_prec"
    ],
    epargne: [
      "livret_a",
      "pel",
      "trade_republic",
      "fortuneo"
    ]
  };

  // Compteurs pour générer custom_depenses_1, custom_revenus_2, etc.
  const customCounters = { depenses: 0, revenus: 0, epargne: 0 };

  // Toutes les lignes venant de la Google Sheet
  let allRows = [];

  /* --------- Utilitaires --------- */

  function getMoisNom(i){
    return [
      "Janvier","Février","Mars","Avril","Mai","Juin",
      "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
    ][i];
  }

  function getCurrentKey(){
    const mIdx = parseInt(moisSelect.value,10);
    const year = parseInt(anneeSelect.value,10);
    const mois = String(mIdx+1).padStart(2,"0");
    return `${year}-${mois}`;           // ex: "2025-12"
  }

  function formatEuro(v){
    return `${v.toFixed(2)} €`;
  }

  // Mémorise les valeurs par défaut des montants (ex: loyer = 550)
  function storeDefaults(){
    document.querySelectorAll(".prev-input").forEach(input=>{
      if(!input.dataset.default){
        input.dataset.default = input.value || "";
      }
    });
  }

  function initFiltres(){
    moisSelect.innerHTML = [...Array(12).keys()]
      .map(i=>`<option value="${i}">${getMoisNom(i)}</option>`).join("");

    const now = new Date();
    const y   = now.getFullYear();
    anneeSelect.innerHTML = [...Array(3).keys()]
      .map(i=>`<option value="${y+i}">${y+i}</option>`).join("");

    moisSelect.value  = String(now.getMonth());
    anneeSelect.value = String(y);
  }

  // 🔄 Charge toutes les lignes de la feuille PREVISIONNELLE
  async function loadFromSheet(){
    try{
      const res  = await fetch(`${PREV_GET_URL}&t=${Date.now()}`);
      const json = await res.json();
      allRows    = json.data || json["données"] || json;

      applyValuesForCurrentMonth();
    }catch(e){
      console.error("Erreur chargement prévisionnel :",e);
      statusSpan.textContent = "Erreur de chargement 😢";
    }
  }

  // Remet les inputs aux valeurs par défaut + supprime les lignes custom visuelles
  function resetInputs(){
    document.querySelectorAll(".prev-input").forEach(input=>{
      const def = (typeof input.dataset.default !== "undefined")
        ? input.dataset.default
        : "";
      input.value = def;
    });

    document.querySelectorAll(".prev-note").forEach(i=>i.value="");
    document.querySelectorAll("tr.custom-row").forEach(tr=>tr.remove());
    recalcTotals();
  }

  // Ajout d'une ligne custom dans le tableau HTML
  function addCustomRow(bloc, id = null, labelText = ""){
    const tbody = (bloc === "depenses")
      ? tbodyDepenses
      : (bloc === "revenus")
      ? tbodyRevenus
      : tbodyEpargne;

    // Si pas d'id (clic sur "Ajouter une ligne") → on génère un nouvel id
    if(!id){
      customCounters[bloc] = (customCounters[bloc] || 0) + 1;
      id = `custom_${bloc}_${customCounters[bloc]}`;
    }

    const tr = document.createElement("tr");
    tr.classList.add("custom-row");
    tr.innerHTML = `
      <td class="prev-label">
        <input type="text" class="prev-label-input"
               data-bloc="${bloc}" data-id="${id}" value="${labelText||""}">
      </td>
      <td>
        <input type="number" step="0.01" class="prev-input"
               data-bloc="${bloc}" data-id="${id}">
      </td>
      <td class="prev-note-cell">
        <input type="text" class="prev-note"
               data-bloc="${bloc}" data-id="${id}">
      </td>
    `;
    tbody.appendChild(tr);

    const amountInput = tr.querySelector(".prev-input");
    amountInput.addEventListener("input", recalcTotals);

    return tr;
  }

  // 💡 Applique les données du mois courant au tableau HTML
  //    + met les compteurs customCounters à jour (1,2,3…)
  function applyValuesForCurrentMonth() {
    resetInputs();

    // On repart de zéro pour les compteurs custom
    customCounters.depenses = 0;
    customCounters.revenus  = 0;
    customCounters.epargne  = 0;

    const key = getCurrentKey();

    // On prend uniquement les lignes du mois sélectionné
    // et on trie par row_id pour que la dernière écrase les précédentes
    const rowsForMonth = allRows
      .filter(r => (r.mois || "").trim() === key)
      .sort((a, b) => {
        const ra = parseInt(a.row_id || "0", 10);
        const rb = parseInt(b.row_id || "0", 10);
        return ra - rb;
      });

    const map = {};

    rowsForMonth.forEach(row => {
      const bloc  = (row.bloc  || "").trim();   // depenses / revenus / epargne
      const ligne = (row.ligne || "").trim();   // ex: loyer, custom_revenus_1
      if (!bloc || !ligne) return;

      const montant = parseFloat(row.montant || "0");
      const label   = row.label || "";
      const note    = row.note  || "";

      // Met à jour les compteurs si c'est une ligne custom
      const m = ligne.match(/^custom_(.+)_([0-9]+)$/);
      if (m) {
        const blocInId = m[1];              // ex: "revenus"
        const num      = parseInt(m[2],10); // ex: 1,2,3…
        customCounters[blocInId] = Math.max(customCounters[blocInId] || 0, num);
      }

      // Enregistre la dernière version pour ce bloc + ligne
      const keyMap = `${bloc}__${ligne}`;
      map[keyMap] = { montant, label, note };
    });

    // Applique les valeurs au DOM
    Object.entries(map).forEach(([keyMap, data]) => {
      const [bloc, ligne] = keyMap.split("__");
      const isStatic = STATIC_IDS[bloc] && STATIC_IDS[bloc].includes(ligne);

      if (isStatic) {
        // Ligne fixe existante
        const amountInput = document.querySelector(
          `.prev-input[data-bloc="${bloc}"][data-id="${ligne}"]`
        );
        const noteInput = document.querySelector(
          `.prev-note[data-bloc="${bloc}"][data-id="${ligne}"]`
        );

        if (amountInput && !isNaN(data.montant))
          amountInput.value = data.montant;
        if (noteInput)
          noteInput.value = data.note || "";
      } else {
        // Ligne custom → on la (re)crée avec le bon id et le bon label
        const tr = addCustomRow(bloc, ligne, data.label);
        const amountInput = tr.querySelector(".prev-input");
        const noteInput   = tr.querySelector(".prev-note");

        if (amountInput && !isNaN(data.montant))
          amountInput.value = data.montant;
        if (noteInput)
          noteInput.value = data.note || "";
      }
    });

    recalcTotals();
  }

  function sumBloc(bloc){
    let sum = 0;
    allAmountInputs().forEach(input=>{
      if(input.dataset.bloc !== bloc) return;
      const v = parseFloat(input.value || "0");
      if(!isNaN(v)) sum += v;
    });
    return sum;
  }

  function recalcTotals(){
    const dep  = sumBloc("depenses");
    const ent  = sumBloc("revenus");
    const epar = sumBloc("epargne");
    const res  = ent - dep;

    // totaux en bas des tableaux
    totalDepensesCell.textContent = formatEuro(dep);
    totalEntreesCell.textContent  = formatEuro(ent);
    totalEpargneCell.textContent  = formatEuro(epar);

    // résumé global en haut
    if (resumeDepensesSpan) resumeDepensesSpan.textContent = formatEuro(dep);
    if (resumeEntreesSpan)  resumeEntreesSpan.textContent  = formatEuro(ent);

    if (resumeResultatSpan){
      resumeResultatSpan.textContent = formatEuro(res);
      resumeResultatSpan.classList.toggle("negatif", res < 0);
    }
  }

  function attachInputListeners(){
    allAmountInputs().forEach(input=>{
      input.addEventListener("input", recalcTotals);
    });
  }

  // 💾 Enregistre toutes les lignes du mois courant dans la Google Sheet
  async function saveCurrentMonth(){
    const key = getCurrentKey();
    statusSpan.textContent = "Enregistrement en cours...";

    try{
      const rowsToSave = [];

      allAmountInputs().forEach(input=>{
        if(input.value === "") return;

        const bloc    = input.dataset.bloc;
        const id      = input.dataset.id;
        const montant = parseFloat(input.value || "0");
        if(isNaN(montant)) return;

        const noteInput = document.querySelector(
          `.prev-note[data-bloc="${bloc}"][data-id="${id}"]`
        );
        const note = noteInput ? noteInput.value : "";

        const labelInput = document.querySelector(
          `.prev-label-input[data-bloc="${bloc}"][data-id="${id}"]`
        );
        let label = input.dataset.label || "";
        if (labelInput) label = labelInput.value || label;

        rowsToSave.push({
          mois: key,
          bloc,
          ligne: id,
          label,
          montant,
          note
        });
      });

      if (rowsToSave.length === 0){
        statusSpan.textContent = "Rien à enregistrer.";
        setTimeout(()=>statusSpan.textContent="",2500);
        return;
      }

      // Envoie toutes les lignes d'un coup à NoCodeAPI
      const res = await fetch(PREV_ADD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rowsToSave)
      });

      if (!res.ok){
        const txt = await res.text().catch(()=>"(pas de body)");
        console.error("Réponse NocodeAPI non OK:", res.status, txt);
        statusSpan.textContent = "Erreur API ("+res.status+") 😢";
        return;
      }

      statusSpan.textContent = "Enregistré ✔";
      setTimeout(()=>statusSpan.textContent="",3000);

    }catch(e){
      console.error("Erreur enregistrement :",e);
      statusSpan.textContent = "Erreur lors de l'enregistrement 😢";
    }
  }

  /* --------- Écouteurs --------- */

  // Boutons "+ Ajouter une ligne"
  document.querySelectorAll(".prev-add-row").forEach(btn=>{
    btn.addEventListener("click", () => {
      const bloc = btn.dataset.bloc; // "depenses" ou "revenus"
      addCustomRow(bloc);
    });
  });

  moisSelect.addEventListener("change", applyValuesForCurrentMonth);
  anneeSelect.addEventListener("change", applyValuesForCurrentMonth);
  saveBtn.addEventListener("click", saveCurrentMonth);

  /* --------- Init globale --------- */

  storeDefaults();
  initFiltres();
  attachInputListeners();
  loadFromSheet();
});
