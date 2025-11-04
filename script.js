// ✅ URL Sheet.best (la tienne)
const sheetBestURL = "https://api.sheetbest.com/sheets/dfb86ada-81c7-4a1c-8bc4-544c2281c911";

document.addEventListener("DOMContentLoaded", () => {
  let transactions = [];
  let camembertChart;
  let lineChart;
  let legendMode = "percent"; // 'percent' ou 'value' pour la légende à droite

  // 🎨 Couleurs camembert
  const PIE_COLORS = [
    "#59236E", "#0A1A45", "#1C9BE4", "#0044FF", "#3F2E9B",
    "#AA4BCF", "#22CAAE", "#550034", "#5D6970", "#6A88FF",
    "#93DDFF", "#19574C", "#B10D5F", "#B8A9FF", "#7BBBFF"
  ];

  // 🧮 ———— Catégories et Comptes FIXES ————
  const CATEGORIES_FIXES = [
    "Loyer","Courses","Essence","Assurance","Sorties","Salaire",
    "Restaurants","Liquide","Électricité / Gaz","Apple",
    "Forfait téléphone","Épargne","Transport","Shopping",
    "Garantie","Virement bénéficiaire","CAF"
  ];

  const COMPTES_FIXES = [
    "Compte Courant","Épargne PEL","Épargne Liv. A",
    "Révolut","Trade Republic","Fortunéo"
  ];

  const SAVINGS_ORDER = ["Épargne PEL","Épargne Liv. A","Révolut","Trade Republic","Fortunéo"];

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

  const kpiSoldeCumule = document.getElementById("kpi-solde-cumule");
  const comptesCumulesUl = document.getElementById("comptes-cumules");
  const savingsUl = document.getElementById("epargne-lignes");

  const kpiEntrees = document.getElementById("kpi-entrees");
  const kpiSorties = document.getElementById("kpi-sorties");
  const kpiSoldeMois = document.getElementById("kpi-solde-mois");

  const camembert = document.getElementById("camembert");
  const chartAnnee = document.getElementById("chart-annee");
  const anneeActuelleSpan = document.getElementById("annee-actuelle");
  const toggleMetricBtn = document.getElementById("toggle-metric");
  const catLegendBox = document.getElementById("cat-legend");

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
      type: tx.type,
      compte: tx.compte || ""
    }));

    // Solde cumulé (toutes périodes)
    const totalCumule = txNorm.reduce((acc, tx) => acc + (tx.type === "sortie" ? -tx.montant : tx.montant), 0);
    kpiSoldeCumule.textContent = `${totalCumule.toFixed(2)} €`;

    // Totaux par compte (cumulés)
    const totauxParCompte = {};
    txNorm.forEach(tx => {
      const sens = tx.type === "sortie" ? -1 : 1;
      if (!totauxParCompte[tx.compte]) totauxParCompte[tx.compte] = 0;
      totauxParCompte[tx.compte] += sens * tx.montant;
    });

    // Ordre : comptes déclarés puis éventuels autres
    const comptesConnus = [...COMPTES_FIXES];
    const autres = Object.keys(totauxParCompte).filter(c => c && !comptesConnus.includes(c));
    const ordre = [...comptesConnus, ...autres];

    comptesCumulesUl.innerHTML = ordre.map(c => `
      <li>
        <span>${c}</span>
        <strong>${(totauxParCompte[c] || 0).toFixed(2)} €</strong>
      </li>
    `).join('');

    // Graphique annuel (solde net cumulatif mois par mois)
    const annee = parseInt(anneeSelect.value, 10) || new Date().getFullYear();
    anneeActuelleSpan.textContent = annee;

    const netParMois = Array(12).fill(0);
    txNorm.filter(tx => tx.an === annee && tx.mois >= 1 && tx.mois <= 12).forEach(tx => {
      const idx = tx.mois - 1;
      netParMois[idx] += (tx.type === "sortie" ? -tx.montant : tx.montant);
    });

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
        maintainAspectRatio: false,
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

    const txNorm = transactions.map((tx, index) => {
      const [annee, mois] = String(tx.date || "").split("-");
      return {
        ...tx, index,
        mois: parseInt(mois, 10),
        annee: parseInt(annee, 10),
        montant: parseFloat(tx.montant || 0),
        compte: tx.compte || "",
        categorie: tx.categorie || "",
        type: tx.type || "",
        sousCategorie: tx.sousCategorie || "",
        description: tx.description || ""
      };
    });

    const moisTx = txNorm.filter(tx => tx.mois === (moisFiltre + 1) && tx.annee === anneeFiltre);

    /* --- KPI Compte Courant uniquement --- */
    const ccTx = moisTx.filter(t => t.compte === "Compte Courant");
    const totalEntrees = ccTx.filter(t => t.type === "entrée").reduce((a,t)=>a+t.montant,0);
    const totalSorties = ccTx.filter(t => t.type === "sortie").reduce((a,t)=>a+t.montant,0);
    const soldeMois = totalEntrees - totalSorties;
    kpiEntrees.textContent = `${totalEntrees.toFixed(2)} €`;
    kpiSorties.textContent = `${totalSorties.toFixed(2)} €`;
    kpiSoldeMois.textContent = `${soldeMois.toFixed(2)} €`;

    /* --- Épargne : lignes "Entrées / Sorties" pour chaque compte --- */
    const parts = [];
    SAVINGS_ORDER.forEach(acc => {
      const t = moisTx.filter(x => x.compte === acc);
      const e = t.filter(x => x.type === "entrée").reduce((a,x)=>a+x.montant,0);
      const s = t.filter(x => x.type === "sortie").reduce((a,x)=>a+x.montant,0);
      parts.push(`
        <li>
          <span class="s-left">${acc}</span>
          <span class="s-right">
            <span class="badge badge-in">+ ${e.toFixed(2)} €</span>
            <span class="badge badge-out">- ${s.toFixed(2)} €</span>
          </span>
        </li>
      `);
    });
    savingsUl.innerHTML = parts.join("");

    /* --- Camembert dépenses par catégorie (mois) --- */
    const parCategorie = {};
    const sortiesTx = moisTx.filter(t => t.type === "sortie");
    sortiesTx.forEach(tx => {
      parCategorie[tx.categorie] = (parCategorie[tx.categorie] || 0) + tx.montant;
    });

    if (camembertChart) camembertChart.destroy();
    const labels = Object.keys(parCategorie);
    const values = Object.values(parCategorie);
    const totalSortiesMois = values.reduce((a,b)=>a+b,0);

    camembertChart = new Chart(camembert, {
      type: "pie",
      data: {
        labels,
        datasets: [{ data: values, backgroundColor: PIE_COLORS }]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
          legend: { display: false }, // on gère notre légende à droite
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed;
                const p = totalSortiesMois ? (v/totalSortiesMois*100) : 0;
                return `${ctx.label}: ${v.toFixed(2)} € (${p.toFixed(1)}%)`;
              }
            }
          }
        }
      }
    });

    // Légende personnalisée à droite (toggle € / %)
    renderCatLegend(labels, values, totalSortiesMois);

    /* --- Liste Transactions triée alphabétiquement --- */
    renderTransactionsList(moisTx);
  }

  function renderCatLegend(labels, values, total) {
    const rows = labels.map((lab, i) => {
      const v = values[i] || 0;
      const pct = total ? (v/total*100) : 0;
      const right = (legendMode === "percent")
        ? `${pct.toFixed(1)} %`
        : `${v.toFixed(2)} €`;
      return `
        <div class="cat-row">
          <span>${lab}</span>
          <strong>${right}</strong>
        </div>
      `;
    }).join("");
    catLegendBox.innerHTML = rows;
    toggleMetricBtn.textContent = (legendMode === "percent") ? "€" : "%";
    toggleMetricBtn.setAttribute("title", (legendMode === "percent") ? "Afficher les montants en €" : "Afficher les pourcentages");
  }

  function renderTransactionsList(moisTx) {
    listeTransactions.innerHTML = "";

    // Sépare et trie alphabétiquement (catégorie + sous-cat + description)
    const key = (tx) => (tx.categorie + " " + tx.sousCategorie + " " + tx.description).trim().toLowerCase();

    const entrees = moisTx.filter(tx => tx.type === "entrée").sort((a,b)=> key(a).localeCompare(key(b)));
    const sorties = moisTx.filter(tx => tx.type === "sortie").sort((a,b)=> key(a).localeCompare(key(b)));

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
      const label = (tx.description ? ` – ${tx.description}` : '');
      const li = document.createElement("li");
      li.innerHTML = `${Number(tx.montant).toFixed(2)} € - ${tx.categorie}${sous} (${tx.compte})${label}
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

  // Toggle € / %
  toggleMetricBtn.addEventListener("click", () => {
    legendMode = (legendMode === "percent") ? "value" : "percent";
    // recalculer avec les dernières données affichées
    const moisFiltre = parseInt(moisSelect.value, 10);
    const anneeFiltre = parseInt(anneeSelect.value, 10);
    const txNorm = transactions.map(tx => ({
      ...tx,
      montant: parseFloat(tx.montant || 0),
      annee: parseInt(String(tx.date || "").split("-")[0], 10),
      mois: parseInt(String(tx.date || "").split("-")[1], 10),
      type: tx.type,
      categorie: tx.categorie || ""
    }));
    const moisTx = txNorm.filter(tx => tx.mois === (moisFiltre + 1) && tx.annee === anneeFiltre && tx.type === "sortie");
    const parCat = {};
    moisTx.forEach(t => { parCat[t.categorie] = (parCat[t.categorie] || 0) + t.montant; });
    const labels = Object.keys(parCat);
    const values = Object.values(parCat);
    const total = values.reduce((a,b)=>a+b,0);
    renderCatLegend(labels, values, total);
  });

  // 🚀 Démarrage
  remplirSelects();
  remplirFiltres();
  chargerTransactions();
});
