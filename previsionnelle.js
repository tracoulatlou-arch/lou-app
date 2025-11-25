// 🔗 URLs NoCodeAPI pour le PREVISIONNEL
const PREV_BASE_URL   = "https://v1.nocodeapi.com/loou142/google_sheets/YsLMknJkjiuqDlxW";
const PREV_TAB_ID     = "PREVISIONNEL";

// GET (lecture)
const sheetPrevGetURL = `${PREV_BASE_URL}?tabId=${PREV_TAB_ID}`;
// POST en JSON objets (ajout de lignes)
const sheetPrevAddURL = `${PREV_BASE_URL}/addRows?tabId=${PREV_TAB_ID}`;

document.addEventListener("DOMContentLoaded", () => {
  const moisSelect = document.getElementById("prev-mois-select");
  const anneeSelect = document.getElementById("prev-annee-select");
  const saveBtn = document.getElementById("prev-save");
  const statusSpan = document.getElementById("prev-status");

  const totalDepensesCell = document.getElementById("total-depenses");
  const totalEntreesCell = document.getElementById("total-entrees");
  const totalEpargneCell = document.getElementById("total-epargne");

  const tbodyDepenses = document.getElementById("tbody-depenses");
  const tbodyRevenus = document.getElementById("tbody-revenus");
  const tbodyEpargne = document.getElementById("tbody-epargne");

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

  const customCounters = { depenses: 0, revenus: 0, epargne: 0 };
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
    return `${year}-${mois}`;
  }

  function formatEuro(v){
    return `${v.toFixed(2)} €`;
  }

  // Mémorise les valeurs par défaut de chaque champ montant
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
    const y = now.getFullYear();
    anneeSelect.innerHTML = [...Array(3).keys()]
      .map(i=>`<option value="${y+i}">${y+i}</option>`).join("");

    moisSelect.value = String(now.getMonth());
    anneeSelect.value = String(y);
  }

  async function loadFromSheet(){
    try{
      const res = await fetch(`${sheetPrevGetURL}&t=${Date.now()}`);
      const json = await res.json();
      // NoCodeAPI renvoie { data: [...] } (ou "données")
      allRows = json.data || json["données"] || json;
      applyValuesForCurrentMonth();
    }catch(e){
      console.error("Erreur chargement prévisionnel :",e);
      statusSpan.textContent = "Erreur de chargement 😢";
    }
  }

  // IMPORTANT : réinitialise les champs aux valeurs par défaut
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

  function addCustomRow(bloc, id=null, labelText=""){
    const tbody = bloc==="depenses"
      ? tbodyDepenses
      : bloc==="revenus"
      ? tbodyRevenus
      : tbodyEpargne;

    if(!id){
      customCounters[bloc] = (customCounters[bloc]||0)+1;
      id = `custom_${bloc}_${customCounters[bloc]}`;
    }

    const tr = document.createElement("tr");
    tr.classList.add("custom-row");
    tr.innerHTML = `
      <td class="prev-label">
        <input type="text" class="prev-label-input" data-bloc="${bloc}" data-id="${id}" value="${labelText||""}">
      </td>
      <td><input type="number" step="0.01" class="prev-input" data-bloc="${bloc}" data-id="${id}"></td>
      <td class="prev-note-cell"><input type="text" class="prev-note" data-bloc="${bloc}" data-id="${id}"></td>
    `;
    tbody.appendChild(tr);

    const amountInput = tr.querySelector(".prev-input");
    amountInput.addEventListener("input", recalcTotals);

    return tr;
  }

  function applyValuesForCurrentMonth(){
    resetInputs(); // remet les valeurs par défaut

    const key = getCurrentKey();
    const rowsForMonth = allRows.filter(r => (r.mois||"").trim()===key);

    const map = {};
    rowsForMonth.forEach(row=>{
      const bloc = (row.bloc||"").trim();
      const ligne = (row.ligne||"").trim();
      if(!bloc||!ligne) return;
      const montant = parseFloat(row.montant||"0");
      const label = row.label || "";
      const note  = row.note  || "";
      map[`${bloc}__${ligne}`] = {montant,label,note};
    });

    Object.entries(map).forEach(([keyMap,data])=>{
      const [bloc,ligne] = keyMap.split("__");
      const isStatic = STATIC_IDS[bloc] && STATIC_IDS[bloc].includes(ligne);

      if(isStatic){
        const amountInput = document.querySelector(`.prev-input[data-bloc="${bloc}"][data-id="${ligne}"]`);
        const noteInput   = document.querySelector(`.prev-note[data-bloc="${bloc}"][data-id="${ligne}"]`);
        if(amountInput && !isNaN(data.montant)) amountInput.value = data.montant;
        if(noteInput) noteInput.value = data.note || "";
      }else{
        const tr = addCustomRow(bloc, ligne, data.label);
        const amountInput = tr.querySelector(".prev-input");
        const noteInput   = tr.querySelector(".prev-note");
        if(amountInput && !isNaN(data.montant)) amountInput.value = data.montant;
        if(noteInput) noteInput.value = data.note || "";
      }
    });

    recalcTotals();
  }

  function sumBloc(bloc){
    let sum=0;
    allAmountInputs().forEach(input=>{
      if(input.dataset.bloc!==bloc) return;
      const v = parseFloat(input.value||"0");
      if(!isNaN(v)) sum+=v;
    });
    return sum;
  }

  function recalcTotals(){
    totalDepensesCell.textContent = formatEuro(sumBloc("depenses"));
    totalEntreesCell.textContent  = formatEuro(sumBloc("revenus"));
    totalEpargneCell.textContent  = formatEuro(sumBloc("epargne"));
  }

  function attachInputListeners(){
    allAmountInputs().forEach(input=>{
      input.addEventListener("input", recalcTotals);
    });
  }

  async function saveCurrentMonth(){
    const key = getCurrentKey();
    statusSpan.textContent = "Enregistrement en cours...";

    try{
      const rowsToSave = [];
      allAmountInputs().forEach(input=>{
        if(input.value==="") return;

        const bloc = input.dataset.bloc;
        const id   = input.dataset.id;
        const montant = parseFloat(input.value||"0");
        if(isNaN(montant)) return;

        const noteInput  = document.querySelector(`.prev-note[data-bloc="${bloc}"][data-id="${id}"]`);
        const note = noteInput ? noteInput.value : "";

        const labelInput = document.querySelector(`.prev-label-input[data-bloc="${bloc}"][data-id="${id}"]`);
        let label = input.dataset.label || "";
        if(labelInput) label = labelInput.value || label;

        rowsToSave.push({
          mois: key,
          bloc,
          ligne: id,
          label,
          montant,
          note
        });
      });

      if(rowsToSave.length===0){
        statusSpan.textContent = "Rien à enregistrer.";
        setTimeout(()=>statusSpan.textContent="",2500);
        return;
      }

      // ✅ Ajout via /addRows (JSON objects) — on envoie toutes les lignes en une fois
      const res = await fetch(sheetBestPrevURL, {
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify(rowsToSave)
});

if(!res.ok){
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

  document.querySelectorAll(".prev-add-row").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const bloc = btn.dataset.bloc;
      addCustomRow(bloc);
    });
  });

  moisSelect.addEventListener("change", applyValuesForCurrentMonth);
  anneeSelect.addEventListener("change", applyValuesForCurrentMonth);
  saveBtn.addEventListener("click", saveCurrentMonth);

  /* --------- Init globale --------- */

  // Sauvegarde les valeurs par défaut dès le départ (ex: loyer = 550)
  storeDefaults();

  initFiltres();
  attachInputListeners();
  loadFromSheet();
});
