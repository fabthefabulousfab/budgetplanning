# Compte-rendu de Flashmob — Need Polishing — Budget prévisionnel familial

> **Niveau dans le cycle :** Pré-T-1 — Flashmob de Need Polishing.
> **Destinataire(s) :** rédigé par l'Agent IA sous la supervision de fabulous (Pilote) ; lu par fabulous (casquette Sponsor) au GATE T-1 et par le porteur de la carte d'identité de Capability.
> **Objectif du document :** tracer les décisions actées pendant la Flashmob de Need Polishing.
> **Niveau de détail minimal attendu :** compréhensible par une personne absente de la session.
> **Statut :** `Validated` — cf. `docs/standards/cross-cutting/document-lifecycle-profile.md` §H. Validé le 2026-10-18 en fin de Flashmob, conjointement avec `need-polished.md` (fabulous, PO — seule partie prenante requise).

Généré depuis : `docs/standards/cross-cutting/flashmob-profile.md` (section B)
Produit avec : `Anthropic/claude-opus-5-5`

> Statut d'espace : promu de `/plans/` vers `/docs/` par `git mv` le 2026-10-18, après la décision GATE T-1 Go — voir `cross-cutting/temporal-quarantine-profile.md`.

---

- **Nom de la Flashmob :** Need Polishing — Budget prévisionnel familial à 10-15 ans.
- **Type :** Need Polishing.
- **Date :** 2026-10-18.
- **Pilote :** fabulous.
- **Participants :** fabulous (PO) ; animation par l'Agent IA (`Anthropic/claude-opus-5-5`), mode distanciel (Claude Code CLI). Rôles attendus (`flashmob-profile.md` §A : PO) couverts. Le Sponsor (également fabulous) n'a pas participé en tant que tel — il intervient au GATE T-1.
- **Livrable produit :** `need-polished.md` (même dossier).
- **Décisions actées durant la session :**
  1. Date de départ de la projection : octobre 2026 (coquille "2027" corrigée).
  2. Décision principale à éclairer : périodes de déficit et montant manquant (dimensionnement des prêts étudiants) ; secondaire : moments où de l'argent se libère.
  3. Le Google Sheet reste source maîtresse des données courantes, lu sans écriture ; les événements futurs sont stockés dans l'application.
  4. Le solde d'épargne de départ est lu dans le Google Sheet.
  5. Revalorisation des salaires : 2 % par an. Intérêts de l'épargne : exclus. Impôts : exclus (prélevés à la source).
  6. Prêts étudiants : estimation à taux zéro, décalage configurable (années) avant remboursement, remboursement réinjecté comme dépense future.
  7. Un seul scénario en v1 (pas de comparaison).
  8. v1 locale, mono-utilisateur ; l'ouverture web à la famille est un besoin distinct, ultérieur.
  9. La source des données courantes devient l'import d'un fichier Excel (`.xlsx`), réimportable à la demande pour refléter une nouvelle situation — remplace la lecture Google Sheet (annule et remplace les décisions 3 et 4 sur ce point : le principe "lecture sans écriture" est conservé).
  10. Les événements futurs saisis dans l'application sont sauvegardés en YAML modifiable à la main ; au démarrage, l'application recharge ces événements ainsi que les données du dernier import Excel.
  11. Une maquette préparatoire rapide est produite avant le GATE T-1 (`prototypes/projection-budget.PROTOTYPE.html`, non versionnée — données réelles).
  12. Le fichier Excel et la maquette sont exclus du versionnement Git (`.gitignore`).
  13. Les dates de fin des prêts en cours sont portées par le fichier Excel (ajoutées par fabulous : voiture 02/2028, maison 07/2032, appartement 02/2041) — l'application ne les redemande pas.
  14. Une synthèse des nouveaux éléments (études, nouveaux prêts, nouveaux revenus) est attendue à côté des synthèses existantes ; la maquette la propose par catégorie et par année.
  15. Un revenu annuel récurrent peut démarrer à une date future, déclarée dans l'Excel (« Prime Leader », 17 000 €/an à partir de janvier 2029). DERIVED — saisi dans la colonne des dépenses exceptionnelles (P/Q/R) : le format d'import devra distinguer clairement revenus et dépenses et porter une date de début.
  16. Les parcours guidés de la maquette sont retirés (données fictives jugées déroutantes) ; seule la saisie libre sur les données réelles est conservée.
  17. Chaque ligne issue de l'Excel est modifiable directement dans la page ; l'ensemble des données est sauvegardé en YAML ; au démarrage, on choisit de partir de l'Excel ou des YAML existants. La maquette simule la sauvegarde dans le navigateur et affiche le contenu exact des 3 fichiers YAML proposés.
  18. Chaque événement futur porte un type explicite (revenu ou dépense), choisi à la saisie et modifiable, indépendant de sa catégorie.
  19. Le dashboard présente deux histogrammes mensuels superposés : revenus (+, bleu) / dépenses (−, rouge, remboursements de prêts étudiants inclus), puis argent restant cumulé (positif / négatif) ; ils sont recalculés à chaque modification. Les lignes issues de l'Excel peuvent être supprimées. Convention de signe confirmée : revenu = +, dépense = −.
  20. Les sections mensuelle et annuelle affichent le restant mensuel et l'impact mensuel des annuels et exceptionnels ; le « restant moyen tout compris » de la maquette (415,17 €) est identique à la cellule C66 de l'Excel. Le montant d'un événement accepte trois formats (mensuel, certains mois, dates précises), expliqués en bulle d'aide. La maquette adopte un design plus épuré.
  21. Architecture : application en **page HTML sans serveur applicatif** (Django abandonné), avec un **script Python qui convertit le fichier Excel en YAML au démarrage**.
  22. Les YAML sont séparés en deux familles : **YAML d'import** (régénérés à chaque import Excel, susceptibles de changer) et **YAML d'événements futurs** (à part, alimentés au fil de l'eau, jamais écrasés par un import). Conséquence : repartir de l'Excel conserve les événements futurs (point ouvert précédent soldé).
  23. La page lit les YAML et écrit les événements futurs via l'**API d'accès aux fichiers du navigateur** (Chrome/Edge uniquement, autorisation du dossier redonnée à chaque session) ; le script Python ne fait que la conversion Excel → YAML. Alternatives écartées : lanceur Python local, export/import manuel. À formaliser en ADR C1.
- **Enseignements de la maquette (données de `Budget 2026.xlsx`) :**
  - Situation actuelle inchangée : solde négatif dès janvier-février 2027 (≈ −800 €) — creux saisonnier avant les primes de mars.
  - La colonne « quand » est en texte libre et contient des incohérences (« 50e par mois » pour un total de 500 € ; « 1245e par mois d'octobre à mai » pour un total de 9 900 €) et des mois absents (Epargne Perco, Aide CE) : import automatique non fiable en l'état.
  - « Etude Noé » est saisie comme dépense annuelle récurrente sans fin : il faut pouvoir borner une récurrence annuelle.
  - Les prêts étudiants modélisés « au fil de l'eau » génèrent des remboursements qui chevauchent de nouveaux emprunts.
- **Points laissés ouverts / à trancher ultérieurement :**
  - Une modification faite dans la page sur une ligne importée est perdue au prochain import Excel : avertissement à confirmer — porteur : fabulous (PO), au Raffinage Capability.
  - Format du fichier Excel importable (échéances lisibles par la machine) — porteur : fabulous (PO + Tech Lead), au Raffinage Capability.
  - Interprétations manuelles de la maquette à valider ligne par ligne (trimestres = janv./avr./juil./oct. ; Aide CE en juillet ; Epargne Perco répartie sur 12 mois ; « Augmentation fabrice Mai » = versement unique de 300 € ou hausse de salaire mensuelle ?) — porteur : fabulous (PO).
  - Date anniversaire de la revalorisation des salaires (janvier ? mois d'embauche ?) — porteur : fabulous (PO), au Raffinage Capability.
  - Durée de remboursement des prêts étudiants configurable ou fixe — porteur : fabulous (PO), au Raffinage Capability.
  - Horizon exact : 10 ans, 15 ans ou configurable — porteur : fabulous (PO), au Raffinage Capability.
- **Prochaine étape :** GATE T-1 tenu le 2026-10-18 — décision **Go** (fabulous, casquette Sponsor). Suite : carte d'identité de la Capability Business `CAP-100` (`02-carte-identite-capability-business.md`), travail solo du PO, sans Flashmob.

---

## Annexe A — Retours du PO pendant la Flashmob (verbatim, ordre chronologique)

*Quoi :* chaque message de fabulous exprimant un besoin, recopié sans correction, avec sa traduction dans le brief.
*Pourquoi :* garantir que rien de ce qui a été dit ne se perd entre la parole et les intentions formalisées — un lecteur peut vérifier la traduction ligne par ligne.

Les deux premiers énoncés (énoncé brut et complément Excel/YAML) sont recopiés en section 1 de `need-polished.md`.

| # | Retour verbatim | Traduit en |
| :--- | :--- | :--- |
| A.1 | « Oui la date de départ c'est octobre 2026, OK pour la décision principale OK pour la source de vérité, oui c'est bien dans Google sheet pour l'épargne de départ, je l'ai indiqué dans la feuille pour le point cinq considère une revalorisation des salaires de 2 %, on ne prend pas les intérêts de l'épargne et les impôts sont directement retiré à la source des salaires, alors qui dit remboursement des prêt, étudiant si il faut rajouter une estimation de dépenses futures à taux zéro avec la possibilité de configurer le nombre d'années de décalage pour que le remboursement démarre OK pour le six et le sept » | Décisions 1-8 ; I6, I8, I9, I10 ; exclusions (intérêts, impôts, scénarios) |
| A.2 | « j'ai mis à jour le fichier excel pour connaitre les date de fin des prêts actuels (pour que ce ne soit pas à demander). il y a dan la page une section  de synthèse, des dépenses manuelles et de synthèse des dépenses exceptionnelles annuelles, il faudra faire apparaître ensuite une synthèse des nouvelles dépenses qu'on souhaite faire apparaître comme les études, les nouveaux prêts, les nouveaux revenus. » | Décisions 13-14 ; I16, I17 |
| A.3 | « j'ai mis un nouveau fichier pour Une catégorie spéciale de revenus qui n'arrivera qu'une seule fois par an, et qui ne commencera qu'à partir de janvier 2029, je l'ai indiqué dans le fichier Excel. je ne comprends pas la section de parcours guidéje ne comprends pas la section de parcours guidé les informations de départ étaient bien renseigné à partir du fichier Excel  À quoi sert ce parcours à quoi sert ce parcours ? » | Décisions 15-16 ; I18 |
| A.4 | « Il faut que dans le libellé des synthèses qui sont aussi du fichier Excel, on puisse apporter des modifications et que l'ensemble de ces informations se sauvegarder dans des fichiers GL, il faut qu'on puisse avoir le choix et que soit au démarrage on part du fichier Excel, soit ensuite on part des fichiers Yael s'ils sont déjà existant. […répété…] De manière à ce qu'on puisse modifier directement chaque ligne dans la page. » (« GL » / « Yael » = YAML) | Décision 17 ; I19, I20, I21 |
| A.5 | « dans Événements futurs (saisis dans l'appli), il faut pourvoir indiquer si c'est un revenu ou une dépense » | Décision 18 ; I22 |
| A.6 | « tout ce qui est revenu est bien considéré en + et tout ce qui est dépense en - ? je prefère voir le graphe en histogramme, avec graphe qui donne en bleu l'histogramme des revenue, et en rouge (négatif) l'histogramme des dépense et dessosu l'histogramme de l'argent restant cumulé. a chaque fois qu'un évunement futus est rajouté les graphe doivent être mis à jour. on peut aussi supprimer les lignes existantes » | Décision 19 ; I23, I24, I25 |
| A.7 | « j'avais indiqué sur django, mais est-ce que tout le fichier html  pourrait fonctionneer en mode standalone ? sinon rajouter à côté des dépnses et revenu mensuel le restant mensuel total, et pour les dépenses annuel, l'impact mensuel que cela a au total, idem pour les dépnses exceptionneles. pour les évenement futurs mettre en bulle ou commentaire le type de formattage possible (montant quand c'est menseul, mois-montant quand c'est certains moi, ou année-mois-montant quand c'est une fois par an). proposé un design plus élégant . » | Décision 20 ; I26, I27 |
| A.8 | « HTML only, avec un script python de conversion du fichier excel en YAML au démarrage. distinguer les fichiers yaml lié à l'import qui peuvent changer, des yaml d'évenements futurs qui sont à pat et rajouter au fil de l'eau. est-ce que tout ce que j'ai indiqué depuis le début a bien été tracé dans une spec complété au fil de l'eau qui sera suavegradé ? » | Décisions 21-22 ; I28, I29 ; la question de traçabilité a motivé la présente annexe |
| A.9 | Choix fermé : « API fichiers du navigateur » (parmi lanceur Python / API fichiers du navigateur / export-import manuel) ; GATE T-1 : « Go » | Décision 23 ; section 4 et section 5 de `need-polished.md` |
