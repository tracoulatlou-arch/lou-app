const SHEET_BEST_URL = "https://api.sheetbest.com/sheets/dfb86ada-81c7-4a1c-8bc4-544c2281c911";

let transactions = [];

document.addEventListener('DOMContentLoaded', async function () {
  await chargerTransactionsDepuisSheet();

  document.getElementById("ajouterTransactionForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const type = document.getElementById("type").value;
    const montant = parseFloat(document.getElementById("montant").value);
    const categorie = document.getElementById("categorie").value;
    const sousCategorie = document.getElementById("sousCategorie").value;
    const compte = document.getElementById("compte").value;
    const date = document.getElementById("date").value;
    const description = document.getElementById("description").value;
    const timestamp = new Date().toLocaleString("fr-FR");

    const transaction = {
      type,
      montant,
      categorie,
      sousCategorie,
      compte,
      date,
      description,
      timestamp
    };

    transactions.push(transaction);
    await envoyerTransactionDansSheet(transaction);
    afficherTransactions();
    e.target.reset();
  });
});

async function chargerTransactionsDepuisSheet() {
  try {
    const response = await fetch(SHEET_BEST_URL);
    const data = await response.json();
    transactions = data.map((tx, index) => ({
      ...tx,
      montant: parseFloat(tx.montant),
      index
    }));
    afficherTransactions();
  } catch (e) {
    console.error("Erreur de chargement des données :", e);
  }
}

function afficherTransactions() {
  const tableau = document.getElementById("transactionsBody");
  tableau.innerHTML = "";

  const moisSelectionne = document.getElementById("moisSelection").value;

  const transactionsFiltrees = transactions.filter((tx) => {
    return tx.date && tx.date.startsWith(moisSelectionne);
  });

  transactionsFiltrees.forEach((tx, index) => {
    const ligne = document.createElement("tr");

    ligne.innerHTML = `
      <td>${tx.type}</td>
      <td>${tx.montant.toFixed(2)} €</td>
      <td>${tx.categorie}</td>
      <td>${tx.sousCategorie}</td>
      <td>${tx.compte}</td>
      <td>${tx.date}</td>
      <td>${tx.description}</td>
      <td>
        <button onclick="supprimerTransaction(${index})">Supprimer</button>
      </td>
    `;

    tableau.appendChild(ligne);
  });
}

async function envoyerTransactionDansSheet(transaction) {
  try {
    await fetch(SHEET_BEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(transaction)
    });
  } catch (e) {
    console.error("Erreur lors de l'envoi :", e);
  }
}

async function supprimerTransaction(index) {
  const transactionASupprimer = transactions.filter((tx) => {
    return tx.date && tx.date.startsWith(document.getElementById("moisSelection").value);
  })[index];

  if (!transactionASupprimer || !transactionASupprimer.timestamp) {
    console.error("Transaction introuvable ou timestamp manquant");
    return;
  }

  // Appelle la suppression dans Sheet
  await supprimerTransactionDansSheet(transactionASupprimer);

  // Supprime localement
  transactions = transactions.filter((tx) => tx.timestamp !== transactionASupprimer.timestamp);
  afficherTransactions();
}

async function supprimerTransactionDansSheet(transaction) {
  try {
    const deleteURL = `${SHEET_BEST_URL}/timestamp/${encodeURIComponent(transaction.timestamp)}`;
    await fetch(deleteURL, {
      method: "DELETE"
    });
  } catch (e) {
    console.error("Erreur suppression :", e);
  }
}
