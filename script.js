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

  /* -----------------------------
     Utils : LocalStorage & Selects
  ------------------------------*/
  const getStoredArray = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : null;
      return Array.isArray(arr) ? arr : fallback;
    } catch {
      return fallback;
    }
  };

  // 🔹 mêmes valeurs par défaut que ta page Paramètres
  const getCategories = () =>
    getStoredArray("categories", ["Loyer", "Courses", "Essence", "Assurance", "Sorties", "Salaire", "Autres"]);

  const getComptes = () =>
    getStoredArray("comptes", ["Compte Courant", "Épargne IPEL", "Épargne IVA", "Révolut", "Trade Republic"]);

  function remplirSelects() {
    const categories = getCategories();
    const comptes = getComptes();

    categorieInput.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    compteInput.innerHTML = comptes.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  /* -----------------------------
     Filtres (mois / année / date)
  ------------------------------*/
  function getMoisNom(index) {
    return ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][index];
  }

  function remplirFiltres() {
    // Mois
    moisSelect.innerHTML = [...Array(12).keys()]
      .map(i => `<option value="${i}">${getMoisNom(i)}</option>`).join('');
    // Années (10 dernières)
    const anneeActuelle = new Date().getFullYear();
    anneeSelect.innerHTML = [...Array(10).keys()]
      .map(i => `<option value="${anneeActuelle - i}">${anneeActuelle - i}</option>`).join('');

    // Valeurs courantes
    moisSelect.value = new Date().getMonth();
    anneeSelect.value = new Date().getFullYear();

    // Valeur par défaut pour le champ "mois-annee" (AAAA-MM)
    const now = new Date();
    const mois = String(now.getMonth() + 1).padStart(2, '0');
    const annee = now.getFullYear();
    moisAnneeInput.value = `${annee}-${mois}`;
  }

  /* -----------------------------
     Chargement & affichage
  ------------------------------*/
  async function chargerTransactions() {
    const res = await fetch(sheetBestURL);
    transactions = await res.json();
    afficherTransactions();
  }

  function afficherTransactions() {
    const moisFiltre = parseInt(moisSelect.value, 10);
    const anneeFiltre = parseInt(anneeSelect.value, 10);
    listeTransactions.innerHTML = "";

    // On normalise les transactions du mois sélectionné
    const filtres = transactions
      .map((tx, index) => {
        const [annee, mois] = String(tx.date || "").split("-");
        return {
          ...tx,
          index,
          mois: parseInt(mois, 10),
          annee: parseInt(annee, 10),
          montant: parseFloat(tx.montant || 0)
        };
      })
      .filter(tx => tx.mois === (moisFiltre + 1) && tx.annee === anneeFiltre);

    // Agrégations
    let solde = 0;
    const parCompte = {};
    const parCategorie = {};

    filtres.forEach(tx => {
      const sens = tx.type === "sortie" ? -1 : 1;
      solde += sens * tx.montant;

      if (!parCompte[tx.compte]) {
        parCompte[tx.compte] = { entrees: 0, sorties: 0 };
      }

      if (tx.type === "entrée") {
        parCompte[tx.compte].entrees += tx.montant;
      } else {
        parCompte[tx.compte].sorties += tx.montant;
        parCategorie[tx.categorie] = (parCategorie[tx.categorie] || 0) + tx.montant;
      }

      const li = document.createElement("li");
      const sous = tx.sousCategorie ? ` > ${tx.sousCategorie}` : '';
      li.innerHTML = `
        ${tx.type === "entrée" ? "➕" : "➖"} ${tx.montant.toFixed(2)} € - ${tx.categorie}${sous} (${tx.compte})
        <button class="btn-supprimer" data-timestamp="${tx.timestamp}" style="float:right;">🗑️</button>
      `;
      listeTransactions.appendChild(li);
    });

    // Solde total (de la période filtrée)
    soldeTotalDiv.textContent = `Solde total : ${solde.toFixed(2)} €`;

    // Comptes (liste)
    comptesList.innerHTML = Object.entries(parCompte).map(([compte, data]) => {
      const soldeCompte = (data.entrees || 0) - (data.sorties || 0);
      return `
        <li>
          <strong>${compte}</strong><br>
          ➕ Entrées : ${ (data.entrees || 0).toFixed(2) } €<br>
          ➖ Sorties : ${ (data.sorties || 0).toFixed(2) } €<br>
          ⚖️ Solde : ${ soldeCompte.toFixed(2) } €
        </li>
      `;
    }).join('');

    // Camembert
    if (camembertChart) camembertChart.destroy();
    camembertChart = new Chart(camembert, {
      type: "pie",
      data: {
        labels: Object.keys(parCategorie),
        datasets: [{
          data: Object.values(parCategorie),
          backgroundColor: PIE_COLORS
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Solde total cumulé (toutes transactions)
    const totalCumule = transactions.reduce((acc, tx) => {
      const sens = tx.type === "sortie" ? -1 : 1;
      return acc + sens * parseFloat(tx.montant || 0);
    }, 0);
    totalCumuleDiv.textContent = `💼 Solde total cumulé : ${totalCumule.toFixed(2)} €`;

    // Suppression
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

  /* -----------------------------
     Ajout d'une transaction
  ------------------------------*/
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
    // Réinitialise le champ mois-année à la période courante
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    moisAnneeInput.value = `${now.getFullYear()}-${mm}`;

    await chargerTransactions();
  });

  // Changement de période
  moisSelect.addEventListener("change", afficherTransactions);
  anneeSelect.addEventListener("change", afficherTransactions);

  // 🚀 Démarrage
  remplirSelects();   // ⬅️ charge catégories & comptes depuis localStorage
  remplirFiltres();
  chargerTransactions();
});
