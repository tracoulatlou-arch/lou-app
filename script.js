// ✅ URL Sheet.best (la tienne)
const sheetBestURL = "https://api.sheetbest.com/sheets/dfb86ada-81c7-4a1c-8bc4-544c2281c911";

document.addEventListener("DOMContentLoaded", () => {
  let transactions = [];
  let camembertChart;

  // 🎨 15 couleurs (bleus/violets) pour le camembert
  const PIE_COLORS = [
    "#59236eff", "#0A1A45", "#1c9be4ff", "#0044ffff", "#3f2e9bff",
    "#aa4bcfff", "#22caaeff", "#550034ff", "#5d6970ff", "#6a88ffff",
    "#93ddffff", "#19574cff", "#b10d5fff", "#B8A9FF", "#7BBBFF"
  ];

  // 🧾 Comptes affichés en CUMULÉ (toutes périodes)
  const ACCOUNTS_CUMULATIFS = [
    "Révolut", "Trade Republic", "Epargne PEL", "Epargne LIV. A", "Fortunéo"
  ];

  // 🔌 Sélecteurs DOM
  const form = document.getElementById("form-ajout");
  const typeInput = document.getElementById("type");
  const montantInput = document.getElementById("montant");
  const categorieInput = document.getElementById("categorie");
  const sousCategorieInput = document.getElementById("sous-categorie");
  const compteInput = document.getElementById("compte");
  const moisAnneeInput = document.getElementById("mois-annee");
  const descriptionInput = document.getElementById("description");
  const listeTransactions = document.getElementById("liste-transactions");
  const moisSelect = document.getElementById("mois-select");
  const anneeSelect = document.getElementById("annee-select");
  const soldeTotalDiv = document.getElementById("solde-total");
  const comptesList = document.getElementById("comptes-list");
  const totalCumuleDiv = document.getElementById("total-cumule");
  const camembert = document.getElementById("camembert");

  /* ----------------------------- Utils : LocalStorage & Selects ------------------------------*/
  const getStoredArray = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : null;
      return Array.isArray(arr) ? arr : fallback;
    } catch {
      return fallback;
    }
  };

  const getCategories = () =>
    getStoredArray("categories", ["Loyer", "Courses", "Essence", "Assurance", "Sorties", "Salaire", "Autres"]);
  const getComptes = () =>
    getStoredArray("comptes", ["Compte Courant", "Révolut", "Trade Republic", "Epargne PEL", "Epargne LIV. A", "Fortunéo"]);

  function remplirSelects() {
    const categories = getCategories();
    const comptes = getComptes();
    categorieInput.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    compteInput.innerHTML = comptes.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  /* ----------------------------- Filtres (mois / année / date) ------------------------------*/
  function getMoisNom(index) {
    return ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][index];
  }

  function remplirFiltres() {
    moisSelect.innerHTML = [...Array(12).keys()]
      .map(i => `<option value="${i}">${getMoisNom(i)}</option>`)
      .join('');
    const anneeActuelle = new Date().getFullYear();
    anneeSelect.innerHTML = [...Array(10).keys()]
      .map(i => `<option value="${anneeActuelle - i}">${anneeActuelle - i}</option>`)
      .join('');
    moisSelect.value = new Date().getMonth();
    anneeSelect.value = new Date().getFullYear();

    const now = new Date();
    const mois = String(now.getMonth() + 1).padStart(2, '0');
    const annee = now.getFullYear();
    moisAnneeInput.value = `${annee}-${mois}`;
  }

  /* ----------------------------- Chargement & affichage ------------------------------*/
  async function chargerTransactions() {
    const res = await fetch(sheetBestURL);
    transactions = await res.json();
    afficherTransactions();
  }

  function afficherTransactions() {
    const moisFiltre = parseInt(moisSelect.value, 10);
    const anneeFiltre = parseInt(anneeSelect.value, 10);
    listeTransactions.innerHTML = "";

    // Normalisation
    const txNorm = transactions.map((tx, index) => {
      const [annee, mois] = String(tx.date || "").split("-");
      return {
        ...tx,
        index,
        mois: parseInt(mois, 10),
        annee: parseInt(annee, 10),
        montant: parseFloat(tx.montant || 0)
      };
    });

    // Période (pour Compte Courant + solde période + camembert)
    const filtres = txNorm.filter(tx => tx.mois === (moisFiltre + 1) && tx.annee === anneeFiltre);

    /* ===== Transactions: colonnes sorties/entrées ===== */
    const entrees = filtres.filter(tx => tx.type === "entrée");
    const sorties = filtres.filter(tx => tx.type === "sortie");

    const container = document.createElement("div");
    container.className = "transactions-grid";

    const colSorties = document.createElement("div");
    colSorties.className = "col-sorties";
    colSorties.innerHTML = "<h3>➖ Sorties</h3>";

    const colEntrees = document.createElement("div");
    colEntrees.className = "col-entrees";
    colEntrees.innerHTML = "<h3>➕ Entrées</h3>";

    function makeItem(tx) {
      const sous = tx.sousCategorie ? ` > ${tx.sousCategorie}` : '';
      const li = document.createElement("li");
      li.innerHTML = `${tx.montant.toFixed(2)} € - ${tx.categorie}${sous} (${tx.compte})
        <button class="btn-supprimer" data-timestamp="${tx.timestamp}" style="float:right;">🗑️</button>`;
      return li;
    }

    sorties.forEach(tx => colSorties.appendChild(makeItem(tx)));
    entrees.forEach(tx => colEntrees.appendChild(makeItem(tx)));

    container.appendChild(colSorties);
    container.appendChild(colEntrees);
    listeTransactions.appendChild(container);

    /* ===== Vue globale ===== */
    let soldePeriode = 0;
    const parCompteMois = {};
    const parCategorie = {};

    filtres.forEach(tx => {
      const sens = tx.type === "sortie" ? -1 : 1;
      soldePeriode += sens * tx.montant;
      if (!parCompteMois[tx.compte]) parCompteMois[tx.compte] = { entrees: 0, sorties: 0 };
      if (tx.type === "entrée") parCompteMois[tx.compte].entrees += tx.montant;
      else {
        parCompteMois[tx.compte].sorties += tx.montant;
        parCategorie[tx.categorie] = (parCategorie[tx.categorie] || 0) + tx.montant;
      }
    });

    soldeTotalDiv.textContent = `Solde total : ${soldePeriode.toFixed(2)} €`;

    const cumulParCompte = {};
    ACCOUNTS_CUMULATIFS.forEach(acc => {
      cumulParCompte[acc] = { entrees: 0, sorties: 0 };
    });

    txNorm.forEach(tx => {
      if (ACCOUNTS_CUMULATIFS.includes(tx.compte)) {
        if (tx.type === "entrée") cumulParCompte[tx.compte].entrees += tx.montant;
        else cumulParCompte[tx.compte].sorties += tx.montant;
      }
    });

    const parts = [];
    const cc = parCompteMois["Compte Courant"] || { entrees: 0, sorties: 0 };
    const ccSolde = cc.entrees - cc.sorties;

    parts.push(`
      <li class="account-card">
        <strong>Compte Courant</strong><br>
        ➕ Entrées : ${cc.entrees.toFixed(2)} €<br>
        ➖ Sorties : ${cc.sorties.toFixed(2)} €<br>
        ⚖️ Solde : ${ccSolde.toFixed(2)} €
      </li>
    `);

    parts.push(`<li class="group-title">Épargne</li>`);

    ACCOUNTS_CUMULATIFS.forEach(acc => {
      const data = cumulParCompte[acc];
      const solde = data.entrees - data.sorties;
      parts.push(`
        <li class="account-card">
          <strong>${acc}</strong><br>
          ➕ Entrées : ${data.entrees.toFixed(2)} €<br>
          ➖ Sorties : ${data.sorties.toFixed(2)} €<br>
          ⚖️ Solde : ${solde.toFixed(2)} €
        </li>
      `);
    });

    comptesList.innerHTML = parts.join("");

    /* ===== Camembert (période) ===== */
    if (camembertChart) camembertChart.destroy();
    camembertChart = new Chart(camembert, {
      type: "pie",
      data: {
        labels: Object.keys(parCategorie),
        datasets: [{ data: Object.values(parCategorie), backgroundColor: PIE_COLORS }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });

    /* ===== Total cumulé (toutes transactions) ===== */
    const totalCumule = txNorm.reduce((acc, tx) => {
      const sens = tx.type === "sortie" ? -1 : 1;
      return acc + sens * tx.montant;
    }, 0);
    totalCumuleDiv.textContent = `💼 Solde total cumulé : ${totalCumule.toFixed(2)} €`;

    /* ===== Suppression ===== */
    document.querySelectorAll(".btn-supprimer").forEach(btn => {
      btn.addEventListener("click", async () => {
        const timestamp = btn.dataset.timestamp;
        const ok = confirm("Supprimer définitivement cette transaction ?");
        if (!ok) return;
        await fetch(`${sheetBestURL}/timestamp/${encodeURIComponent(timestamp)}`, { method: 'DELETE' });
        await chargerTransactions();
      });
    });
  }

  /* ----------------------------- Ajout d'une transaction ------------------------------*/
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nouvelle = {
      type: typeInput.value,
      montant: montantInput.value,
      categorie: categorieInput.value,
      sousCategorie: sousCategorieInput.value,
      compte: compteInput.value,
      date: moisAnneeInput.value,
      description: descriptionInput.value,
      timestamp: new Date().toISOString()
    };

    await fetch(sheetBestURL, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nouvelle)
    });

    form.reset();
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    moisAnneeInput.value = `${now.getFullYear()}-${mm}`;
    await chargerTransactions();
  });

  // Changement de période
  moisSelect.addEventListener("change", afficherTransactions);
  anneeSelect.addEventListener("change", afficherTransactions);

  // 🚀 Démarrage
  remplirSelects();
  remplirFiltres();
  chargerTransactions();
});
