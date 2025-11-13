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
    allInputs().forEach(input => {
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

    try {
      // 1) On supprime toutes les lignes existantes pour ce mois
      await fetch(`${sheetBestPrevURL}/mois/${encodeURIComponent(key)}`, {
        method: "DELETE"
      });

      // 2) On envoie toutes les valeurs non vides
      const rowsToSave = [];
      allInputs().forEach(input => {
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

      for (const row of rowsToSave) {
        await fetch(sheetBestPrevURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row)
        });
      }

      statusSpan.textContent = "Enregistré ✔";
      setTimeout(() => { statusSpan.textContent = ""; }, 2500);

      await loadFromSheet();

    } catch (e) {
      console.error("Erreur d'enregistrement :", e);
      statusSpan.textContent = "Erreur lors de l'enregistrement 😢";
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
