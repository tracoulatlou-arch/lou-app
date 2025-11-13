// 🔗 URL Sheet.best pour le PREVISIONNEL
const sheetBestPrevURL = "https://api.sheetbest.com/sheets/2a404265-6cec-4903-b13a-1c11e8600b96";

document.addEventListener("DOMContentLoaded", () => {
  // ----------------- Sélecteurs DOM -----------------
  const moisSelect = document.getElementById("prev-mois-select");
  const anneeSelect = document.getElementById("prev-annee-select");

  const saveBtn = document.getElementById("prev-save");
  const statusSpan = document.getElementById("prev-status");

  const totalDepensesCell = document.getElementById("total-depenses");
  const totalEntreesCell = document.getElementById("total-entrees");
  const totalEpargneCell = document.getElementById("total-epargne");

  const allInputs = () => document.querySelectorAll(".prev-input");

  // Toutes les lignes renvoyées par Sheet.best
  let allRows = [];

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
    return `${annee}-${mois}`;              // ex: "2025-11"
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

  // ----------------- Chargement depuis Google Sheet -----------------
  async function loadFromSheet() {
    try {
      console.log("🔹 Chargement depuis Sheet.best...");
      // ?t=timestamp pour éviter tout cache
      const res = await fetch(`${sheetBestPrevURL}?t=${Date.now()}`);
      allRows = await res.json();
      console.log("🔹 Lignes reçues :", allRows.length);
      applyValuesForCurrentMonth();
    } catch (e) {
      console.error("Erreur chargement prévisionnel :", e);
      statusSpan.textContent = "Erreur de chargement 😢";
    }
  }

  function resetInputs() {
    allInputs().forEach(input => {
      input.value = "";
    });
    recalcTotals();
  }

  function applyValuesForCurrentMonth() {
    resetInputs();
    const key = getCurrentKey();
    console.log("🔹 Application des valeurs pour", key);

    const rowsForMonth = allRows.filter(r => (r.mois || "").trim() === key);

    // On garde la DERNIÈRE valeur pour chaque (bloc + ligne)
    const lastValues = {};
    rowsForMonth.forEach(row => {
      const bloc = (row.bloc || "").trim();
      const ligne = (row.ligne || "").trim();
      const montant = parseFloat(row.montant || "0");
      if (!bloc || !ligne || isNaN(montant)) return;
      const keyMap = `${bloc}__${ligne}`;
      lastValues[keyMap] = montant;
    });

    Object.entries(lastValues).forEach(([keyMap, montant]) => {
      const [bloc, ligne] = keyMap.split("__");
      const input = document.querySelector(
        `.prev-input[data-bloc="${bloc}"][data-id="${ligne}"]`
      );
      if (input) {
        input.value = montant;
      }
    });

    recalcTotals();
  }

  // ----------------- Recalcul des totaux -----------------
  function sumBloc(blocName) {
    let sum = 0;
    allInputs().forEach(input => {
      if (input.dataset.bloc !== blocName) return;
      const v = parseFloat(input.value || "0");
      if (!isNaN(v)) sum += v;
    });
    return sum;
  }

  function recalcTotals() {
    const dep = sumBloc("depenses");
    const ent = sumBloc("revenus");
    const ep = sumBloc("epargne");

    totalDepensesCell.textContent = formatEuro(dep);
    totalEntreesCell.textContent = formatEuro(ent);
    totalEpargneCell.textContent = formatEuro(ep);
  }

  function attachInputListeners() {
    allInputs().forEach(input => {
      input.addEventListener("input", recalcTotals);
    });
  }

  // ----------------- Sauvegarde dans Google Sheet -----------------
  async function saveCurrentMonth() {
    const key = getCurrentKey();
    statusSpan.textContent = "Enregistrement en cours...";
    console.log("🔹 Sauvegarde du mois", key);

    try {
      // 1) Construire toutes les lignes à enregistrer
      const rowsToSave = [];
      allInputs().forEach(input => {
        if (input.value === "") return; // ignore les cases vides
        const montant = parseFloat(input.value || "0");
        if (isNaN(montant)) return;

        rowsToSave.push({
          mois: key,                     // ex: "2025-11"
          bloc: input.dataset.bloc,      // depenses / revenus / epargne
          ligne: input.dataset.id,       // loyer, elec_gaz, salaire…
          label: input.dataset.label,    // texte lisible
          montant: montant
        });
      });

      console.log("🔹 Lignes à sauvegarder :", rowsToSave);

      if (rowsToSave.length === 0) {
        statusSpan.textContent = "Rien à enregistrer (toutes les cases sont vides).";
        setTimeout(() => { statusSpan.textContent = ""; }, 2500);
        return;
      }

      // 2) Envoyer chaque ligne UNE PAR UNE
      for (const row of rowsToSave) {
        const postRes = await fetch(sheetBestPrevURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row)   // un seul objet par requête
        });
        console.log("POST row status =", postRes.status, row);
        if (!postRes.ok) {
          statusSpan.textContent = "Erreur API (code " + postRes.status + ") 😢";
          return;
        }
      }

      // ✅ L'API a accepté toutes les lignes
      statusSpan.textContent = "Enregistré ✔";
      setTimeout(() => { statusSpan.textContent = ""; }, 3500);

      // 3) On recharge les données depuis Sheet.best pour vérifier
      await loadFromSheet();

    } catch (e) {
      console.error("❌ Erreur d'enregistrement :", e);
      statusSpan.textContent = "Erreur JS lors de l'enregistrement 😢";
    }
  }

  // ----------------- Écouteurs -----------------
  moisSelect.addEventListener("change", applyValuesForCurrentMonth);
  anneeSelect.addEventListener("change", applyValuesForCurrentMonth);
  saveBtn.addEventListener("click", saveCurrentMonth);

  // ----------------- Init globale -----------------
  initFiltres();
  attachInputListeners();
  loadFromSheet();
});
