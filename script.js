// ✅ Lien vers ton Sheet.best (valide et autorisé)
const sheetBestURL = "https://api.sheetbest.com/sheets/dfb86ada-81c7-4a1c-8bc4-544c2281c911";

document.addEventListener("DOMContentLoaded", () => {
  let transactions = [];
  let indexAModifier = null;

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
  let camembertChart;

  const categories = ["Courses", "Loyer", "Essence", "Sortie", "Salaire", "Autre"];
  const comptes = ["Compte courant", "Épargne", "Revolut", "Trade Republic"];

  function remplirSelects() {
    categorieInput.innerHTML = categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    compteInput.innerHTML = comptes.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  function getMoisNom(index) {
    return ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"][index];
  }

  function remplirFiltres() {
    moisSelect.innerHTML = [...Array(12).keys()].map(i =>
      `<option value="${i}">${getMoisNom(i)}</option>`
    ).join('');
    const anneeActuelle = new Date().getFullYear();
    anneeSelect.innerHTML = [...Array(10).keys()].map(i =>
      `<option value="${anneeActuelle - i}">${anneeActuelle - i}</option>`
    ).join('');
    moisSelect.value = new Date().getMonth();
    anneeSelect.value = new Date().getFullYear();

    const now = new Date();
    const mois = String(now.getMonth() + 1).padStart(2, '0');
    const annee = now.getFullYear();
    moisAnneeInput.value = `${annee}-${mois}`;
  }

  async function chargerTransactions() {
    const res = await fetch(sheetBestURL);
    transactions = await res.json();
    afficherTransactions();
  }

  function afficherTransactions() {
    const moisFiltre = parseInt(moisSelect.value);
    const anneeFiltre = parseInt(anneeSelect.value);
    listeTransactions.innerHTML = "";

    const filtres = transactions
      .map((tx, index) => {
        const [annee, mois] = tx.date.split("-");
        return { ...tx, index, mois: parseInt(mois), annee: parseInt(annee), montant: parseFloat(tx.montant) };
      })
      .filter(tx => tx.mois === moisFiltre + 1 && tx.annee === anneeFiltre);

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
        <button class="btn-modifier" data-timestamp="${tx.timestamp}" style="float:right; margin-left:5px;">✏️</button>
        <button class="btn-supprimer" data-timestamp="${tx.timestamp}" style="float:right;">🗑️</button>
      `;
      listeTransactions.appendChild(li);
    });

    soldeTotalDiv.textContent = `Solde total : ${solde.toFixed(2)} €`;

    comptesList.innerHTML = Object.entries(parCompte).map(([compte, data]) => {
      const soldeCompte = data.entrees - data.sorties;
      return `
        <li>
          <strong>${compte}</strong><br>
          ➕ Entrées : ${data.entrees.toFixed(2)} €<br>
          ➖ Sorties : ${data.sorties.toFixed(2)} €<br>
          ⚖️ Solde : ${soldeCompte.toFixed(2)} €
        </li>
      `;
    }).join('');

    if (camembertChart) camembertChart.destroy();
    camembertChart = new Chart(camembert, {
      type: "pie",
      data: {
        labels: Object.keys(parCategorie),
        datasets: [{
          data: Object.values(parCategorie),
          backgroundColor: ['#f87171', '#facc15', '#4ade80', '#60a5fa', '#c084fc', '#fb923c']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });

    totalCumuleDiv.textContent = `💼 Solde total cumulé : ${transactions.reduce((acc, tx) => {
      const sens = tx.type === "sortie" ? -1 : 1;
      return acc + sens * parseFloat(tx.montant);
    }, 0).toFixed(2)} €`;

    // Suppression
    document.querySelectorAll(".btn-supprimer").forEach(btn => {
      btn.addEventListener("click", async () => {
        const timestamp = btn.dataset.timestamp;
        await fetch(`${sheetBestURL}/timestamp/${encodeURIComponent(timestamp)}`, {
          method: 'DELETE'
        });
        await chargerTransactions();
      });
    });
  }

  form.addEventListener("submit", async function (e) {
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
    remplirFiltres();
    await chargerTransactions();
  });

  moisSelect.addEventListener("change", afficherTransactions);
  anneeSelect.addEventListener("change", afficherTransactions);

  remplirSelects();
  remplirFiltres();
  chargerTransactions();
});
