// ✅ URL Sheet.best (la tienne)
const sheetBestURL = "https://api.sheetbest.com/sheets/dfb86ada-81c7-4a1c-8bc4-544c2281c911";

document.addEventListener("DOMContentLoaded", () => {
  let transactions = [];
  let camembertChart;
  let lineChart;

  // 🎨 Couleurs
  const PIE_COLORS = [
    "#59236E", "#0A1A45", "#1C9BE4", "#0044FF", "#3F2E9B",
    "#AA4BCF", "#22CAAE", "#550034", "#5D6970", "#6A88FF",
    "#93DDFF", "#19574C", "#B10D5F", "#B8A9FF", "#7BBBFF"
  ];

  // 🧮 ———— À MODIFIER ICI (listes fixes) ————
  const CATEGORIES_FIXES = [
    "Loyer","Courses","Essence","Assurance","Sorties","Salaire",
    "Restaurants","Liquide","Eléctricité / Gaz","Apple","Forfait téléphone","Epargne","Transport","Shopping","Garentie","Virement bénéficiaire","CAF"
  ];
  const COMPTES_FIXES = [
    "Compte Courant","Épargne PEL","Épargne Liv. A","Révolut","Trade Republic","Fortunéo"
  ];
  // ————————————————————————————————————————————————

  // 🔌 Sélecteurs DOM
  const form = document.getElementById("form-ajout");            // 👈 gardée une seule fois
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

  const totalCumuleHeader = document.getElementById("total-cumule");
  const kpiSoldeCumule = document.getElementById("kpi-solde-cumule");
  const comptesCumulesUl = document.getElementById("comptes-cumules");

  const kpiEntrees = document.getElementById("kpi-entrees");
  const kpiSorties = document.getElementById("kpi-sorties");
  const kpiSoldeMois = document.getElementById("kpi-solde-mois");

  const camembert = document.getElementById("camembert");
  const chartAnnee = document.getElementById("chart-annee");
  const anneeActuelleSpan = document.getElementById("annee-actuelle");

  /* ----------------------------- Remplir selects ------------------------------*/
  function remplirSelects() {
    categorieInput.innerHTML = CATEGORIES_FIXES.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    compteInput.innerHTML = COMPTES_FIXES.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  /* ----------------------------- Filtres (mois / année / date) ------------------------------*/
  function getMoisNom(i) {
    return ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"][i];
  }

  function remplirFiltres() {
    moisSelect.innerHTML = [...Array(12).keys()]
      .map(i => `<option value="${i}">${getMoisNom(i)}</option>`).join('');
    const anneeActuelle = new Date().getFullYear();
    anneeSelect.innerHTML = [...Array(10).keys()]
      .map(i => `<option value="${anneeActuelle - i}">${anneeActuelle - i}</option>`).join('');
    moisSelect.value = new Date().getMonth();
    anneeSelect.value = new Date().getFullYear();

    const now = new Date();
    const mois = String(now.getMonth() + 1).padStart(2, '0');
    moisAnneeInput.value = `${now.getFullYear()}-${mois}`;

    anneeActuelleSpan.textContent = anneeSelect.value;
  }

  /* ----------------------------- Chargement & affichage ------------------------------*/
  async function chargerTransactions() {
    const res = await fetch(sheetBestURL);
    transactions = await res.json();
    afficherGlobal();        // bloc 1
    afficherMoisSection();   // bloc 2 + liste
  }

  /* ====== Bloc 1 : Vue globale ====== */
  function afficherGlobal() {
    const txNorm = transactions.map(tx => ({
      ...tx,
      montant: parseFloat(tx.montant || 0),
      an: parseInt(String(tx.date || "").split("-")[0], 10),
      mois: parseInt(String(tx.date || "").split("-")[1], 10),
      type: tx.type
    }));

    // Solde cumulé (toutes périodes)
    const totalCumule = txNorm.reduce((acc, tx) => acc + (tx.type === "sortie" ? -tx.montant : tx.montant), 0);
    totalCumuleHeader.textContent = `Solde total cumulé : ${totalCumule.toFixed(2)} €`;
    kpiSoldeCumule.textContent = `${totalCumule.toFixed(2)} €`;

    // Totaux par compte (cumulés)
    const totauxParCompte = {};
    txNorm.forEach(tx => {
      if (!tx.compte) return;
      const sens = tx.type === "sortie" ? -1 : 1;
      totauxParCompte[tx.compte] = (totauxParCompte[tx.compte] || 0) + sens * tx.montant;
    });

    // Affiche la liste en suivant l'ordre COMPTES_FIXES puis les autres éventuels
    const comptesConnus = [...COMPTES_FIXES];
    const autres = Object.keys(totauxParCompte).filter(c => !comptesConnus.includes(c));
    const ordre = [...comptesConnus, ...autres];

    comptesCumulesUl.innerHTML = ordre.map(c => `
      <li>
        <span>${c}</span>
        <strong>${(totauxParCompte[c] || 0).toFixed(2)} €</strong>
      </li>
    `).join('');

    // Graphique annuel (solde cumulé mois par mois)
    const annee = parseInt(anneeSelect.value, 10) || new Date().getFullYear();
    anneeActuelleSpan.textContent = annee;

    // Somme nette par mois (année choisie)
    const netParMois = Array(12).fill(0);
    txNorm.filter(tx => tx.an === annee && tx.mois >= 1 && tx.mois <= 12).forEach(tx => {
      const idx = tx.mois - 1;
      netParMois[idx] += (tx.type === "sortie" ? -tx.montant : tx.montant);
    });

    // Cumulatif sur l'année
    const cumulParMois = netParMois.reduce((arr, val) => {
      const prev = arr.length ? arr[arr.length - 1] : 0;
      arr.push(prev + val);
      return arr;
    }, []);

    if (lineChart) lineChart.destroy();
    lineChart = new Chart(chartAnnee, {
      type: "line",
      data: {
        labels: Array.from({length:12}, (_,i)=>getMoisNom(i)),
        datasets: [{
          label: "Solde cumulatif",
          data: cumulParMois,
          fill: false,
          tension: 0.25
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true, position: 'bottom' } },
        scales: {
          y: { ticks: { callback: v => `${Number(v).toFixed(0)} €` } }
        }
      }
    });
  }

  /* ====== Bloc 2 : Mois sélectionné ====== */
  function afficherMoisSection() {
    const moisFiltre = parseInt(moisSelect.value, 10);     // 0-11
    const anneeFiltre = parseInt(anneeSelect.value, 10);

    // Normalisation
    const txNorm = transactions.map((tx, index) => {
      const [annee, mois] = String(tx.date || "").split("-");
      return {
        ...tx, index,
        mois: parseInt(mois, 10),
        annee: parseInt(annee, 10),
        montant: parseFloat(tx.montant || 0)
      };
    });

    // Filtre mois/année
    const filtres = txNorm.filter(tx => tx.mois === (moisFiltre + 1) && tx.annee === anneeFiltre);

    // KPI mois
    const totalEntrees = filtres.filter(t => t.type === "entrée").reduce((a,t)=>a+t.montant,0);
    const totalSorties = filtres.filter(t => t.type === "sortie").reduce((a,t)=>a+t.montant,0);
    const soldeMois = totalEntrees - totalSorties;

    kpiEntrees.textContent = `${totalEntrees.toFixed(2)} €`;
    kpiSorties.textContent = `${totalSorties.toFixed(2)} €`;
    kpiSoldeMois.textContent = `${soldeMois.toFixed(2)} €`;

    // Camembert dépenses par catégorie (mois)
    const parCategorie = {};
    filtres.filter(t => t.type === "sortie").forEach(tx => {
      parCategorie[tx.categorie] = (parCategorie[tx.categorie] || 0) + tx.montant;
    });

    if (camembertChart) camembertChart.destroy();
    camembertChart = new Chart(camembert, {
      type: "pie",
      data: {
        labels: Object.keys(parCategorie),
        datasets: [{ data: Object.values(parCategorie), backgroundColor: PIE_COLORS }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });

    // Liste Transactions (mois)
    renderTransactionsList(filtres);
  }

  function renderTransactionsList(filtres) {
    listeTransactions.innerHTML = "";

    const entrees = filtres.filter(tx => tx.type === "entrée");
    const sorties = filtres.filter(tx => tx.type === "sortie");

    const container = document.createElement("div");
    container.className = "transactions-grid";

    const colSorties = document.createElement("div");
    colSorties.className = "col-sorties";
    colSorties.innerHTML = "<h3>Sorties</h3>";

    const colEntrees = document.createElement("div");
    colEntrees.className = "col-entrees";
    colEntrees.innerHTML = "<h3>Entrées</h3>";

    function makeItem(tx) {
      const sous = tx.sousCategorie ? ` > ${tx.sousCategorie}` : '';
      const li = document.createElement("li");
      li.innerHTML = `${Number(tx.montant).toFixed(2)} € - ${tx.categorie}${sous} (${tx.compte})
        <button class="btn-supprimer" data-timestamp="${tx.timestamp}" style="float:right;">🗑️</button>`;
      return li;
    }

    sorties.forEach(tx => colSorties.appendChild(makeItem(tx)));
    entrees.forEach(tx => colEntrees.appendChild(makeItem(tx)));

    container.appendChild(colSorties);
    container.appendChild(colEntrees);
    listeTransactions.appendChild(container);

    // Suppression
    document.querySelectorAll(".btn-supprimer").forEach(btn => {
      btn.addEventListener("click", async () => {
        const timestamp = btn.dataset.timestamp;
        if (!confirm("Supprimer définitivement cette transaction ?")) return;
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

  // Changement de période => met à jour Bloc 2 et aussi la courbe (année) si l'année change
  moisSelect.addEventListener("change", () => afficherMoisSection());
  anneeSelect.addEventListener("change", () => { afficherGlobal(); afficherMoisSection(); });

  // 🚀 Démarrage
  remplirSelects();
  remplirFiltres();
  chargerTransactions();
});
