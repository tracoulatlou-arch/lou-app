// 🔗 URL Sheet.best pour le PREVISIONNEL (autre onglet / autre fichier)
const sheetBestPrevURL = "https://api.sheetbest.com/sheets/2a404265-6cec-4903-b13a-1c11e8600b96";

document.addEventListener("DOMContentLoaded", () => {

  // ----------------- Configuration du tableau (lignes) -----------------
  // On reproduit ton Excel : listes fixes de lignes par bloc

  const LIGNES_DEPENSES = [
    { id: "mois_prec", label: "Mois précédent" },
    { id: "loyer", label: "Loyer moi" },
    { id: "elec_gaz", label: "Élec + Gaz" },
    { id: "ass_voiture_trot", label: "Ass. voiture + trott." },
    { id: "garantie", label: "Garantie" },
    { id: "tel", label: "Téléphone" },
    { id: "apple", label: "Apple" },
    { id: "essence", label: "Essence" },
    { id: "courses", label: "Courses" },
    { id: "epargne_liv_a", label: "Épargne LIV.A" },
    { id: "compte", label: "Compte" },
    { id: "trad", label: "Trad." },
    { id: "epargne_pel", label: "Épargne PEL" },
    { id: "max", label: "Max" },
    { id: "extra", label: "Extra" },
    { id: "max_ass", label: "Max ass." },
    { id: "shein", label: "Shein" }
  ];

  const LIGNES_ENTREES = [
    { id: "salaire", label: "Salaire" },
    { id: "caf_prime", label: "CAF Prime" },
    { id: "max", label: "Max" },
    { id: "shein", label: "Shein" },
    { id: "ass_axa", label: "ASS. AXA" },
    { id: "papa_maman", label: "Papa / Maman" }
  ];

  const LIGNES_EPARGNE = [
    { id: "liv_a", label: "LIV.A" },
    { id: "pel", label: "PEL" },
    { id: "lep", label: "LEP" }
  ];

  // ----------------- Sélecteurs DOM -----------------
  const moisSelect = document.getElementById("prev-mois-select");
  const anneeSelect = document.getElementById("prev-annee-select");

  const kpiDepenses = document.getElementById("prev-kpi-depenses");
  const kpiEntrees = document.getElementById("prev-kpi-entrees");
  const kpiEpargne = document.getElementById("prev-kpi-epargne");
  const kpiSolde = document.getElementById("prev-kpi-solde");

  const tbodyDepenses = document.getElementById("prev-table-depenses");
  const tbodyEntrees = document.getElementById("prev-table-entrees");
  const tbodyEpargne = document.getElementById("prev-table-epargne");

  const saveBtn = document.getElementById("prev-save");
  const statusSpan = document.getElementById("prev-status");

  let allRows = []; // toutes les lignes venant de Google Sheet

  // ----------------- Utilitaires -----------------
  function getMoisNom(i) {
    return [
      "Janvier","Février","Mars","Avril","Mai","Juin",
      "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
    ][i];
  }

  function getCurrentKey() {
    const moisIndex = parseInt(moisSelect.value, 10); // 0..11
    const annee = parseInt(anneeSelect.value, 10);
    const mois = String(moisIndex + 1).padStart(2, "0");
    return `${annee}-${mois}`;
  }

  function formatEuro(v) {
    return `${v.toFixed(2)} €`;
  }

  // ----------------- Remplir les filtres mois / année -----------------
  function initFiltres() {
    // Mois (0..11)
    moisSelect.innerHTML = [...Array(12).keys()]
      .map(i => `<option value="${i}">${getMoisNom(i)}</option>`)
      .join("");

    const now = new Date();
    const yearNow = now.getFullYear();

    // Année courante + 2 ans après
    anneeSelect.innerHTML = [...Array(3).keys()]
      .map(i => `<option value="${yearNow + i}">${yearNow + i}</option>`)
      .join("");

    // Défaut : mois actuel
    moisSelect.value = String(now.getMonth());
    anneeSelect.value = String(yearNow);
  }

  // ----------------- Construction du tableau (interface type Excel) -----------------
  function buildTable() {
    function buildBloc(tbody, blocName, lignes) {
      tbody.innerHTML = "";
      lignes.forEach(l => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="prev-label">${l.label}</td>
          <td>
            <input 
              type="number" 
              step="0.01" 
              class="prev-input"
              data-bloc="${blocName}"
              data-id="${l.id}"
              data-label="${l.label}"
            />
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    buildBloc(tbodyDepenses, "depenses", LIGNES_DEPENSES);
    buildBloc(tbodyEntrees, "revenus", LIGNES_ENTREES);
    buildBloc(tbodyEpargne, "epargne", LIGNES_EPARGNE);

    // Quand on tape dans une case → recalcul immédiat
    document.querySelectorAll(".prev-input").forEach(input => {
      input.addEventListener("input", recalcTotals);
    });
  }

  // ----------------- Chargement depuis Google Sheet -----------------
  async function loadFromSheet() {
    try {
      const res = await fetch(sheetBestPrevURL);
      allRows = await res.json();
      applyValuesForCurrentMonth();
    } catch (e) {
      console.error("Erreur chargement prévisionnel :", e);
      statusSpan.textContent = "Erreur de chargement 😢";
    }
  }

  function resetInputs() {
    document.querySelectorAll(".prev-input").forEach(input => {
      input.value = "";
    });
  }

  function applyValuesForCurrentMonth() {
    resetInputs();
    const key = getCurrentKey();
    const rowsForMonth = allRows.filter(r => (r.mois || "").trim() === key);

    rowsForMonth.forEach(row => {
      const bloc = (row.bloc || "").trim();
      const ligne = (row.ligne || "").trim();
      const montant = parseFloat(row.montant || "0");

      if (!bloc || !ligne) return;

      const input = document.querySelector(
        `.prev-input[data-bloc="${bloc}"][data-id="${ligne}"]`
      );
      if (input) {
        input.value = isNaN(montant) ? "" : montant;
      }
    });

    recalcTotals();
  }

  // ----------------- Recalcul des totaux -----------------
  function sumBloc(blocName) {
    let sum = 0;
    document.querySelectorAll(`.prev-input[data-bloc="${blocName}"]`)
      .forEach(input => {
        const v = parseFloat(input.value || "0");
        if (!isNaN(v)) sum += v;
      });
    return sum;
  }

  function recalcTotals() {
    const dep = sumBloc("depenses");
    const ent = sumBloc("revenus");
    const ep = sumBloc("epargne");
    const solde = ent - dep; // logique simple : entrées - dépenses

    kpiDepenses.textContent = formatEuro(dep);
    kpiEntrees.textContent = formatEuro(ent);
    kpiEpargne.textContent = formatEuro(ep);
    kpiSolde.textContent = formatEuro(solde);
  }

  // ----------------- Sauvegarde dans Google Sheet -----------------
  async function saveCurrentMonth() {
    const key = getCurrentKey();
    statusSpan.textContent = "Enregistrement en cours...";

    try {
      // 1) On supprime toutes les lignes existantes pour ce mois
      await fetch(`${sheetBestPrevURL}/mois/${encodeURIComponent(key)}`, {
        method: "DELETE"
      });

      // 2) On envoie toutes les valeurs non vides
      const rowsToSave = [];
      document.querySelectorAll(".prev-input").forEach(input => {
        if (input.value === "") return;
        const montant = parseFloat(input.value || "0");
        if (isNaN(montant)) return;

        rowsToSave.push({
          mois: key,
          bloc: input.dataset.bloc,
          ligne: input.dataset.id,
          label: input.dataset.label,
          montant
        });
      });

      // Envoi ligne par ligne (simple, sûr avec Sheet.best)
      for (const row of rowsToSave) {
        await fetch(sheetBestPrevURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row)
        });
      }

      statusSpan.textContent = "Enregistré ✔";
      setTimeout(() => { statusSpan.textContent = ""; }, 2500);

      // Rechargement pour être sûr d'être synchro
      await loadFromSheet();

    } catch (e) {
      console.error("Erreur d'enregistrement :", e);
      statusSpan.textContent = "Erreur lors de l'enregistrement 😢";
    }
  }

  // ----------------- Écouteurs mois / année / bouton -----------------
  moisSelect.addEventListener("change", applyValuesForCurrentMonth);
  anneeSelect.addEventListener("change", applyValuesForCurrentMonth);
  saveBtn.addEventListener("click", saveCurrentMonth);

  // ----------------- Init globale -----------------
  initFiltres();
  buildTable();
  loadFromSheet();
});
