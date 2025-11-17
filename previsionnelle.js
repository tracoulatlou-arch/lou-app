// 🔗 URL Sheet.best pour le PREVISIONNEL
const sheetBestPrevURL = "https://api.sheetbest.com/sheets/2a404265-6cec-4903-b13a-1c11e8600b96";

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
      "tel",
      "apple",
      "garantie",
      "ass_voiture",
      "essence",
      "courses",
      "compte",
      "epargne_tr",
      "epargne_pel",
      "livret_a",
      "credit_agricole"
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
      const res = await fetch(`${sheetBestPrevURL}?t=${Date.now()}`);
      allRows = await res.json();
      applyValuesForCurrentMonth();
    }catch(e){
      console.error("Erreur chargement prévisionnel :",e);
      statusSpan.textContent = "Erreur de chargement 😢";
    }
  }

  function resetInputs(){
    allAmountInputs().forEach(i=>i.value="");
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
      <td><input type="text" class="prev-label-input" data-bloc="${bloc}" data-id="${id}" value="${labelText||""}"></td>
      <td><input type="number" step="0.01" class="prev-input" data-bloc="${bloc}" data-id="${id}"></td>
      <td><input type="text" class="prev-note" data-bloc="${bloc}" data-id="${id}"></td>
    `;
    tbody.appendChild(tr);

    const amountInput = tr.querySelector(".prev-input");
    amountInput.addEventListener("input", recalcTotals);

    return tr;
  }

  function applyValuesForCurrentMonth(){
    resetInputs();
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

      for(const row of rowsToSave){
        const res = await fetch(sheetBestPrevURL,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(row)
        });
        console.log("POST row status =",res.status,row);
        if(!res.ok){
          statusSpan.textContent = "Erreur API ("+res.status+") 😢";
          return;
        }
      }

      statusSpan.textContent = "Enregistré ✔";
      setTimeout(()=>statusSpan.textContent="",3000);

      // On ne recharge pas tout de suite pour ne pas effacer la saisie
      // Le rechargement se fait quand tu changes de mois.
    }catch(e){
      console.error("Erreur enregistrement :",e);
      statusSpan.textContent = "Erreur lors de l'enregistrement 😢";
    }
  }

  // Boutons "Ajouter une ligne" (Dépenses + Entrées uniquement)
  document.querySelectorAll(".prev-add-row").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const bloc = btn.dataset.bloc;
      addCustomRow(bloc);
    });
  });

  moisSelect.addEventListener("change", applyValuesForCurrentMonth);
  anneeSelect.addEventListener("change", applyValuesForCurrentMonth);
  saveBtn.addEventListener("click", saveCurrentMonth);

  initFiltres();
  attachInputListeners();
  loadFromSheet();
});
