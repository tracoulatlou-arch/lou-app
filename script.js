// ✅ URL Sheet.best (la tienne)
const sheetBestURL = "https://api.sheetbest.com/sheets/dfb86ada-81c7-4a1c-8bc4-544c2281c911";

document.addEventListener("DOMContentLoaded", () => {
  let transactions = [];
  let camembertChart;
  let lineChart;
  let legendMode = "percent"; // 'percent' | 'value'

  // 🎨 Couleurs camembert (ordre = légende)
  const PIE_COLORS = [
    "#6ce5e8", "#41b8d5", "#2d8bba", "#506e9a", "#635a92",
    "#7e468a", "#942270", "#c12862", "#eb4e57", "#ff7742",
    "#ffae3a", "#efda5b", "#a6d664", "#5bbc6b", "#189f74",
    "#228b7d", "#377376", "#21667d", "#176192", "#012238"
  ];

  // 📋 Catégories & Comptes fixes
  const CATEGORIES_FIXES = [
    "Apple", "Assurance", "Autre", "CAF", "Courses", "Électricité / Gaz",
    "Épargne", "Essence", "Forfait téléphone", "Garantie", "Liquide",
    "Loyer", "Restaurants", "Salaire", "Santé", "Shopping", "Sorties",
    "Transport", "Virement bénéficiaire"
  ];
  const COMPTES_FIXES = [
    "Compte Courant", "Épargne PEL", "Épargne Liv. A",
    "Révolut", "Trade Republic", "Fortunéo"
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
    const catsSorted = [...CATEGORIES_FIXES].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));
    categorieInput.innerHTML = catsSorted.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    compteInput.innerHTML = COMPTES_FIXES.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  /* ----------------------------- Filtres ------------------------------*/
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

  /* ----------------------------- Chargement ------------------------------*/
  async function chargerTransactions() {
    const res = await fetch(sheetBestURL);
    transactions = await res.json();
    afficherGlobal();
    afficherMoisSection();
  }

  /* ====== Vue globale ====== */
  function afficherGlobal() {
    // Normalisation : somme signée (entrée +, sortie -) + mois/année
    const txNorm = transactions.map(tx => {
      const [a, m] = String(tx.date || "").split("-");
      const montant = parseFloat(tx.montant || 0);
      const signe = (tx.type === "sortie") ? -1 : 1;
      return {
        ...tx,
        montant,
        an: parseInt(a || "0", 10),
        mois: parseInt(m || "0", 10),
        signed: montant * signe
      };
    });

    // Totaux par compte
    const totauxParCompte = {};
    txNorm.forEach(tx => {
      const c = tx.compte || "";
      if (!totauxParCompte[c]) totauxParCompte[c] = 0;
      totauxParCompte[c] += tx.signed;
    });

    // Totaux globaux
    const totalCumule = Object.values(totauxParCompte).reduce((a,b)=>a+(b||0),0);
    const savingsTotal = SAVINGS_ORDER.reduce((sum, acc) => sum + (totauxParCompte[acc] || 0), 0);

    // Ordre d'affichage + rendu des lignes (2 lignes sombres)
    const autres = Object.keys(totauxParCompte).filter(c => c && !["Compte Courant", ...SAVINGS_ORDER].includes(c));
    const ordre = ["Compte Courant", "Solde total épargne", ...SAVINGS_ORDER, ...autres];

    comptesCumulesUl.innerHTML = `
      <li class="total"><span>Solde total cumulé</span><strong>${totalCumule.toFixed(2)} €</strong></li>
      ${ordre.map(c => {
        const val = (c === "Solde total épargne") ? savingsTotal : (totauxParCompte[c] || 0);
        const cls = (c === "Solde total épargne") ? ' class="total"' : '';
        return `<li${cls}><span>${c}</span><strong>${val.toFixed(2)} €</strong></li>`;
      }).join('')}
    `;

    // 📈 Évolution annuelle : solde total cumulé de fin de mois
    const annee = parseInt(anneeSelect.value, 10);
    const endOfMonthBalance = [];
    for (let m = 1; m <= 12; m++) {
      const bal = txNorm.reduce((acc, tx) => {
        const avantOuEqual = (tx.an < annee) || (tx.an === annee && tx.mois <= m);
        return acc + (avantOuEqual ? tx.signed : 0);
      }, 0);
      endOfMonthBalance.push(bal);
    }

    if (lineChart) lineChart.destroy();
    lineChart = new Chart(chartAnnee, {
      type: "line",
      data: {
        labels: Array.from({length:12}, (_,i)=>getMoisNom(i)),
        datasets: [{ label: "Solde total cumulé", data: endOfMonthBalance, fill: false, tension: 0.25 }]
      },
      options: { maintainAspectRatio:false, responsive:true, plugins:{ legend:{display:true,position:'bottom'} } }
    });

    kpiSoldeCumule.textContent = `${totalCumule.toFixed(2)} €`;
  }

  /* ====== Mois sélectionné ====== */
  function afficherMoisSection() {
    const moisFiltre = parseInt(moisSelect.value, 10);
    const anneeFiltre = parseInt(anneeSelect.value, 10);
    const txNorm = transactions.map(tx => {
      const [a, m] = String(tx.date || "").split("-");
      return {
        ...tx,
        mois: parseInt(m,10),
        annee: parseInt(a,10),
        montant: parseFloat(tx.montant||0),
        compte: tx.compte || "",
        categorie: tx.categorie || "",
        sousCategorie: tx.sousCategorie || "",
        description: tx.description || "",
        type: tx.type || "",
        timestamp: tx.timestamp || ""
      };
    });
    const moisTx = txNorm.filter(tx => tx.mois === (moisFiltre + 1) && tx.annee === anneeFiltre);

    const ccTx = moisTx.filter(t => t.compte === "Compte Courant");
    const totalEntrees = ccTx.filter(t => t.type === "entrée").reduce((a,t)=>a+t.montant,0);
    const totalSorties = ccTx.filter(t => t.type === "sortie").reduce((a,t)=>a+t.montant,0);
    const soldeMois = totalEntrees - totalSorties;
    kpiEntrees.textContent = `${totalEntrees.toFixed(2)} €`;
    kpiSorties.textContent = `${totalSorties.toFixed(2)} €`;
    kpiSoldeMois.textContent = `${soldeMois.toFixed(2)} €`;

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

    // 🔁 Dépenses par catégorie : uniquement Compte Courant (sorties)
    const parCategorie = {};
    const sortiesTx = moisTx.filter(t => t.type === "sortie" && t.compte === "Compte Courant");
    sortiesTx.forEach(tx => {
      parCategorie[tx.categorie] = (parCategorie[tx.categorie] || 0) + tx.montant;
    });

    // Tri alphabétique (labels/values restent alignés avec les couleurs)
    const entries = Object.entries(parCategorie).sort((a,b)=> a[0].localeCompare(b[0],'fr',{sensitivity:'base'}));
    const labels = entries.map(e=>e[0]);
    const values = entries.map(e=>e[1]);
    const totalSortiesMois = values.reduce((a,b)=>a+b,0);

    if (camembertChart) camembertChart.destroy();
    camembertChart = new Chart(camembert,{
      type:"pie",
      data:{ labels, datasets:[{ data:values, backgroundColor: PIE_COLORS }] },
      options:{
        maintainAspectRatio:false,responsive:true,
        plugins:{ legend:{ display:false }, tooltip:{ callbacks:{
          label:(ctx)=>{
            const v=ctx.parsed;const p=totalSortiesMois?(v/totalSortiesMois*100):0;
            return `${ctx.label}: ${v.toFixed(2)} € (${p.toFixed(1)}%)`;
          }
        }}}
      }
    });

    renderCatLegend(labels, values, totalSortiesMois);
    renderTransactionsList(moisTx);
  }

  // ⬅️ Pastille couleur + label + valeur (€/%)
  function renderCatLegend(labels, values, total){
    const rows = labels.map((lab,i)=>{
      const v = values[i] || 0;
      const pct = total ? (v/total*100) : 0;
      const right = (legendMode==="percent") ? `${pct.toFixed(1)} %` : `${v.toFixed(2)} €`;
      const color = PIE_COLORS[i % PIE_COLORS.length];
      return `
        <div class="cat-row">
          <div class="cat-left">
            <span class="cat-color" style="background:${color};"></span>
            <span class="cat-label">${lab}</span>
          </div>
          <span class="cat-value">${right}</span>
        </div>
      `;
    }).join("");
    catLegendBox.innerHTML = rows;
    toggleMetricBtn.textContent = (legendMode==="percent") ? "€" : "%";
    toggleMetricBtn.setAttribute("title", (legendMode==="percent") ? "Afficher les montants en €" : "Afficher les pourcentages");
  }

  function renderTransactionsList(moisTx){
    // Tri par ordre d'ajout (timestamp ISO) — plus récent en haut
    const order = (tx) => {
      const t = Date.parse(tx.timestamp || tx.date || 0);
      return isNaN(t) ? 0 : t;
    };
    const entrees = moisTx
      .filter(tx => tx.type === "entrée")
      .sort((a,b) => order(b) - order(a));
    const sorties = moisTx
      .filter(tx => tx.type === "sortie")
      .sort((a,b) => order(b) - order(a));

    listeTransactions.innerHTML="";
    const container=document.createElement("div");
    container.className="transactions-grid";

    const colEntrees=document.createElement("div");
    colEntrees.className="col-entrees";
    colEntrees.innerHTML="<h3>Entrées</h3>";

    const colSorties=document.createElement("div");
    colSorties.className="col-sorties";
    colSorties.innerHTML="<h3>Sorties</h3>";

    function makeTxRow(tx){
      const sous=tx.sousCategorie?` > ${tx.sousCategorie}`:"";
      const desc=tx.description?` – ${tx.description}`:"";
      const li=document.createElement("li");
      li.className="tx-row";
      li.innerHTML=`
        <div class="tx-amount">${Number(tx.montant).toFixed(2)} €</div>
        <div class="tx-desc">${tx.categorie}${sous}${desc}</div>
        <div class="tx-account">${tx.compte}</div>
        <div class="tx-actions"><button class="btn-delete-square" data-timestamp="${tx.timestamp}">×</button></div>`;
      return li;
    }

    entrees.forEach(tx=>colEntrees.appendChild(makeTxRow(tx)));
    sorties.forEach(tx=>colSorties.appendChild(makeTxRow(tx)));

    container.appendChild(colEntrees);
    container.appendChild(colSorties);
    listeTransactions.appendChild(container);

    document.querySelectorAll(".btn-delete-square").forEach(btn=>{
      btn.addEventListener("click",async()=>{
        const timestamp=btn.dataset.timestamp;
        if(!confirm("Supprimer définitivement cette transaction ?"))return;
        await fetch(`${sheetBestURL}/timestamp/${encodeURIComponent(timestamp)}`,{method:"DELETE"});
        await chargerTransactions();
      });
    });
  }

  form.addEventListener("submit",async(e)=>{
    e.preventDefault();
    const nouvelle={
      type:typeInput.value,montant:montantInput.value,categorie:categorieInput.value,
      sousCategorie:sousCategorieInput.value,compte:compteInput.value,date:moisAnneeInput.value,
      description:descriptionInput.value,timestamp:new Date().toISOString()
    };
    await fetch(sheetBestURL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(nouvelle)});
    form.reset();
    const now=new Date();const mm=String(now.getMonth()+1).padStart(2,"0");
    moisAnneeInput.value=`${now.getFullYear()}-${mm}`;await chargerTransactions();
  });

  moisSelect.addEventListener("change",()=>afficherMoisSection());
  anneeSelect.addEventListener("change",()=>{afficherGlobal();afficherMoisSection();});
  toggleMetricBtn.addEventListener("click",()=>{legendMode=(legendMode==="percent")?"value":"percent";afficherMoisSection();});

  remplirSelects();
  remplirFiltres();
  chargerTransactions();
});
