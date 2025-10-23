const API_URL = "https://script.google.com/macros/s/AKfycbwHYBuZGqLH4AB3DuLUc76LHonDKKsnE9pQyrpMYFzSllBFjdlmUst143yj7ufy8Wj9bw/exec";

document.addEventListener('DOMContentLoaded', function () {
  let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
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
    moisSelect.innerHTML = [...Array(12).keys()].map(i => `<option value="${i}">${getMoisNom(i)}</option>`).join('');
    const anneeActuelle = new Date().getFullYear();
    anneeSelect.innerHTML = [...Array(10).keys()].map(i => `<option value="${anneeActuelle - i}">${anneeActuelle - i}</option>`).join('');
    moisSelect.value = new Date().getMonth();
    anneeSelect.value = new Date().getFullYear();

    const now = new Date();
    const mois = String(now.getMonth() + 1).padStart(2, '0');
    const annee = now.getFullYear();
    moisAnneeInput.value = `${annee}-${mois}`;
  }

  function enregistrerTransactions() {
    localStorage.setItem("transactions", JSON.stringify(transactions));
  }

  function afficherTransactions() {
    const moisFiltre = parseInt(moisSelect.value);
    const anneeFiltre = parseInt(anneeSelect.value);

    listeTransactions.innerHTML = "";

    const filtres = transactions.map((tx, index) => {
      const [annee, mois] = tx.date.split("-");
      return { ...tx, index, mois: parseInt(mois), annee: parseInt(annee) };
    }).filter(tx => tx.mois === moisFiltre + 1 && tx.annee === anneeFiltre);

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
      }

      if (tx.type === "sortie") {
        parCategorie[tx.categorie] = (parCategorie[tx.categorie] || 0) + tx.montant;
      }

      const li = document.createElement("li");
      const sous = tx.sousCategorie ? ` > ${tx.sousCategorie}` : '';
      li.innerHTML = `
        ${tx.type === "entrée" ? "➕" : "➖"} ${tx.montant.toFixed(2)} € - ${tx.categorie}${sous} (${tx.compte})
        <button class="btn-modifier" data-index="${tx.index}" style="float:right; margin-left:5px;">✏️</button>
        <button class="btn-supprimer" data-index="${tx.index}" style="float:right;">🗑️</button>
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
          legend: { position: 'bottom' }
        }
      }
    });

    document.querySelectorAll(".btn-supprimer").forEach(btn => {
      btn.addEventListener("click", () => {
        const index = parseInt(btn.dataset.index);
        const tx = transactions[index];

        fetch(API_URL, {
          method: "POST",
          body: JSON.stringify({ ...tx, action: "delete" }),
          headers: { "Content-Type": "application/json" }
        })
          .then(res => res.json())
          .then(() => {
            transactions.splice(index, 1);
            enregistrerTransactions();
            afficherTransactions();
          })
          .catch(err => console.error("Erreur suppression:", err));
      });
    });

    document.querySelectorAll(".btn-modifier").forEach(btn => {
      btn.addEventListener("click", () => {
        const index = parseInt(btn.dataset.index);
        const tx = transactions[index];

        typeInput.value = tx.type;
        montantInput.value = tx.montant;
        categorieInput.value = tx.categorie;
        sousCategorieInput.value = tx.sousCategorie || "";
        compteInput.value = tx.compte;
        moisAnneeInput.value = tx.date;
        descriptionInput.value = tx.description || "";

        indexAModifier = index;
      });
    });

    afficherSoldeCumule();
  }

  function afficherSoldeCumule() {
    const total = transactions.reduce((acc, tx) => {
      const sens = tx.type === "sortie" ? -1 : 1;
      return acc + sens * tx.montant;
    }, 0);
    totalCumuleDiv.textContent = `💼 Solde total cumulé : ${total.toFixed(2)} €`;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const nouvelle = {
      type: typeInput.value,
      montant: parseFloat(montantInput.value),
      categorie: categorieInput.value,
      sousCategorie: sousCategorieInput.value.trim(),
      compte: compteInput.value,
      date: moisAnneeInput.value,
      description: descriptionInput.value.trim(),
      action: "add"
    };

    fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(nouvelle),
      headers: { "Content-Type": "application/json" }
    })
      .then(res => res.json())
      .then(() => {
        if (indexAModifier !== null) {
          transactions[indexAModifier] = nouvelle;
          indexAModifier = null;
        } else {
          transactions.push(nouvelle);
        }

        enregistrerTransactions();
        afficherTransactions();
        form.reset();
        remplirFiltres();
      })
      .catch(err => console.error("Erreur lors de l'envoi:", err));
  });

  moisSelect.addEventListener("change", afficherTransactions);
  anneeSelect.addEventListener("change", afficherTransactions);

  remplirSelects();
  remplirFiltres();
  afficherTransactions();
});
