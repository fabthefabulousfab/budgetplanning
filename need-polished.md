# Brief de Need Polished — Budget prévisionnel familial à 10-15 ans

> **Niveau dans le cycle :** Pré-T-1 (le tout premier document du cycle, avant toute Capability).
> **Destinataire(s) :** rédigé par fabulous (PO) avec l'aide d'un Agent IA, lors de la Flashmob de Need Polishing ; arbitré par fabulous (casquette Sponsor) au GATE T-1.
> **Objectif du document :** transformer la demande brute en intention cadrée, support de la décision Go/No-Go/Hold.
> **Niveau de détail minimal attendu :** lisible en moins de 5 minutes ; le détail arrive au niveau Capability.
> **Statut :** `Validated` — cf. `docs/standards/cross-cutting/document-lifecycle-profile.md` §H. Validé le 2026-10-18 en fin de Flashmob de Need Polishing (fabulous, PO — seule partie prenante requise) ; décision GATE T-1 : **Go**, prononcée le 2026-10-18 par fabulous (casquette Sponsor).

Généré depuis : `docs/standards/templates/00-need-polished.md`
Produit avec : `Anthropic/claude-opus-5-5`

> Statut d'espace : promu de `/plans/` vers `/docs/` par `git mv` le 2026-10-18, après la décision GATE T-1 Go — voir `cross-cutting/temporal-quarantine-profile.md`.

Vocabulaire du projet (Need Polished, GATE T-1, Flashmob, Capability, Sponsor) : voir `docs/standards/cross-cutting/glossaire.md`.

Compte-rendu de la Flashmob : `flashmob-need-polishing.md` (même dossier).

---

## 1. Identification du Besoin Initial ("Need")

*Quoi :* la demande telle que formulée, sans interprétation.
*Pourquoi :* garder la trace du problème réel derrière la solution déjà envisagée.

- **Nom du Besoin :** Budget prévisionnel familial à 10-15 ans.
- **Source / Demandeur :** fabulous (usage personnel/familial).
- **Énoncé Brut :**

> oui, il s'agit d'un projet de budget personnel qui va consister à récupérer depuis un fichier Google sheet les informations de budget concernant les dépenses mensuels avec des catégories et des sous catégories, les revenus mensuels avec leur catégorie les dépenses exceptionnels annuel avec le moment où elles arrivent et leur montant les revenus exceptionnels annuel avec l'indication de quand ils arrivent et leur montant, ces deux catégories sont des dépenses et des revenus annuels exceptionnels, mais qui sont récurrents tous les ans, et il y a aussi des dépenses exceptionnels annuel qu'il arrive qu'une fois l'année suivant, il faut savoir que le fichier que je vais t'indiquer devra prendre comme point de départ le mois actuel, c'est-à-dire octobre 2027, ce que je souhaite pouvoir faire, c'est avoir une visibilité sur les 10 ou 15 prochaines années de la manière dont on va évoluer mes dépenses selon que le delta dépense est revenu, mensuel et positif ou négatif qui va me permettre de rajouter des informations comme quand s'arrête mon prêt maison quand s'arrête mon pré voiture de manière à voir à quel moment on a des somme d'argent qui se libère et aussi pour pouvoir ajouter des dépenses concernant les études de mes enfants sur les prochaines années, c'est-à-dire d'anticiper que de quelle année à quelle année j'aurai telle nouvelles dépenses qui va arriver de telle année. Je vais peut-être devoir acheter une nouvelle voiture à quelle année j'ai mon prêt maison qui va s'arrêter de manière à pouvoir avoir un Dashboard qui me présente globalement la manière dont on va évoluer l'argent que j'ai de côté ou l'argent qui me manque pour savoir concrètement sur quelle période il va falloir que j'anticipe de faire des prêts étudiants de façon à compenser les périodes où je suis en négatif, et où je n'ai plus l'argent pour régler tout ce qui est à régler. Donc il me faudra dans mon interface un Dashboard de synthèse un une tabulation qui va me permettre de rajouter tous ces revenus où ces dépenses exceptionnelles avec leur date de début et leur date de fin de pouvoir configurer les montants. Des voilà le point de départ est actuellement donc un fichier Excel qui a été fait dans Google sheet, et ce serait bien que pour toutes les informations qui sont dans ce fichier Excel, ça le reste parce que c'est un bon point de départ facilement modifiable par toutes les familles enfin, pour la simplicité de la gestion, je voudrais que tout le projet soit fait en Django python de manière à pouvoir être exécuté directement depuis ce répertoire. L'idée serait devoir ensuite si il y a des services Google qui permettrait d'avoir facilement une Web consommable par tous mais ça c'est dans un deuxième temps.

*(Correction actée en Flashmob : la date de départ est **octobre 2026** — le mois courant —, "2027" dans l'énoncé est une coquille.)*

**Complément d'énoncé brut (même Flashmob, après première restitution) :**

> Il faut également avoir une fonctionnalité de rafraîchissement des données concernant les revenus mensuels, les dépenses mensuels les dépenses et les revenus exceptionnels annuel avec un fichier Excel qui doit pouvoir être importé. Finalement ça va être plus simple que Google sheet et qui vont permettre de reprendre en compte potentiellement une nouvelle situation. Il faut également dans cette application comment ouvre la démarre on puisse récupérer dynamique Mans tout ce qui a été configuré comme évènement futur, qui ont été saisi dans l'application avec les dates de début, date de fin et montant il faut donc que ces informations là soient sauvegarder, probablement facilement dans des fichiers Yael facile à modifier, tu m'aimes que tous les informations qui sont issue de la porte du fichier Excel au démarrage . Je viens de mettre le fichier Excel, budget 2026 à la racine pour que tu puisses avoir les informations. OK pour un prototype rapide.

**Compléments ultérieurs du PO :** tous les retours exprimés pendant la Flashmob, après manipulation de la maquette, sont recopiés mot pour mot, dans l'ordre, en Annexe A du compte-rendu `flashmob-need-polishing.md`. Chacun est traduit en intention (section 2) et/ou en hypothèse de périmètre (section 3).

*(Lecture actée : "Yael" = YAML ; "tu m'aimes que tous les informations qui sont issue de la porte du fichier Excel" = "de même que toutes les informations issues de l'import du fichier Excel". Ce complément remplace la lecture Google Sheet par l'import d'un fichier Excel.)*

## 2. Analyse et Challenge du Besoin (le "Polishing")

*Quoi :* remonter du symptôme exprimé au problème de fond.
*Pourquoi :* un Need mal challengé produit une Capability qui résout le mauvais problème.

- **Objectif Métier Stratégique Associé :** aucun objectif d'entreprise — projet personnel. Objectif familial : sécuriser la trésorerie du foyer sur 10-15 ans, notamment pendant la période des études des enfants.
- **Problème Réel à Résoudre (la "douleur") :**
  - ASSUMPTION (confirmée en Flashmob) — **Douleur principale :** le foyer ne sait pas aujourd'hui sur quelles périodes futures il sera en déficit de trésorerie, ni de combien — il ne peut donc pas anticiper le recours à des prêts étudiants ni leur dimensionnement.
  - ASSUMPTION (confirmée) — **Douleur secondaire :** le foyer ne voit pas à quel moment des sommes se libèrent (fin du prêt maison, fin du prêt voiture), ce qui empêche de planifier les grosses dépenses (ex. nouvelle voiture).
  - DERIVED — Le fichier de budget actuel (Excel, ex-Google Sheet) décrit bien la situation présente mais ne projette pas dans le temps : il ne répond à aucune des deux douleurs ci-dessus.
  - DERIVED (révélé par la maquette) — La douleur existe dès aujourd'hui, pas seulement à horizon lointain : avec la situation actuelle telle quelle, le solde projeté passe **sous zéro en janvier-février 2027 (point bas ≈ −800 €)**, car les grosses dépenses d'octobre à février (études de Noé, Noël) précèdent les primes de mars. La granularité **mensuelle** de la projection est donc indispensable — une vue annuelle masquerait ce creux.

**Intentions polies :**

| # | Catégorie | Intention |
| :--- | :--- | :--- |
| I1 | Explicite | Voir, mois par mois sur 10 à 15 ans, le solde d'épargne projeté du foyer. |
| I2 | Explicite | Identifier les périodes où le solde projeté devient négatif, avec le montant manquant. |
| I3 | Explicite | Repérer les moments où des dépenses récurrentes s'arrêtent (fin de prêt) et libèrent de l'argent. |
| I4 | Explicite | Saisir des événements futurs (dépense ou revenu) avec date de début, date de fin et montant. |
| I5 | Explicite | Conserver un fichier Excel comme point de départ modifiable des données courantes. |
| I6 | Implicite-évident | Partir du solde actuel (compte courant + épargne), déjà renseigné dans le fichier Excel. |
| I7 | Implicite-évident | Garder les données financières du foyer privées (exécution locale, aucun identifiant versionné). |
| I8 | Non-pensé (révélé) | Appliquer une revalorisation annuelle des salaires (2 %) à la projection. |
| I9 | Non-pensé (révélé) | Estimer les prêts étudiants à contracter pour couvrir les déficits. |
| I10 | Non-pensé (révélé) | Projeter le remboursement de ces prêts étudiants comme des dépenses futures. |
| I11 | Explicite | Rafraîchir les données courantes en réimportant un fichier Excel, pour refléter une nouvelle situation. |
| I12 | Explicite | Retrouver au démarrage de l'application les événements futurs saisis, sauvegardés dans des fichiers YAML modifiables à la main. |
| I13 | Explicite | Retrouver au démarrage de l'application les données issues du dernier import Excel. |
| I14 | Non-pensé (révélé par la maquette) | Disposer d'un format de fichier Excel dont les échéances ("quand") sont lisibles par la machine. |
| I15 | Non-pensé (révélé par la maquette) | Pouvoir arrêter une dépense annuelle récurrente à une date donnée (ex. fin des études de Noé). |
| I16 | Explicite | Lire dans le fichier Excel la date de fin des prêts en cours, sans avoir à la ressaisir dans l'application. |
| I17 | Explicite | Voir une synthèse des nouveaux éléments saisis (études, nouveaux prêts, nouveaux revenus...), par catégorie et par année. |
| I18 | Explicite | Déclarer dans le fichier Excel un revenu annuel récurrent qui ne commence qu'à une date future (ex. « Prime Leader », 17 000 € une fois par an à partir de janvier 2029). |
| I19 | Explicite | Modifier directement dans la page chaque ligne issue du fichier Excel (libellé, montant, échéances, dates). |
| I20 | Explicite | Sauvegarder l'ensemble des données (issues de l'Excel, modifiées, événements futurs, paramètres) dans des fichiers YAML. |
| I21 | Explicite | Choisir au démarrage de partir du fichier Excel ou des fichiers YAML existants. |
| I22 | Explicite | Indiquer explicitement, pour chaque événement futur, s'il s'agit d'un revenu ou d'une dépense, indépendamment de sa catégorie. |
| I23 | Explicite | Visualiser la projection en histogrammes mensuels : revenus en positif (bleu) et dépenses en négatif (rouge), avec en dessous l'histogramme de l'argent restant cumulé. |
| I24 | Explicite | Voir les graphes recalculés à chaque ajout ou modification d'un élément. |
| I25 | Explicite | Supprimer une ligne existante issue du fichier Excel. |
| I26 | Explicite | Voir le restant mensuel (revenus − dépenses mensuels), et l'impact mensuel des revenus/dépenses annuels et des dépenses exceptionnelles. |
| I27 | Explicite | Saisir le montant d'un événement futur selon trois formats : montant mensuel (« 800 »), certains mois chaque année (« 6:500, 10:500 »), ou dates précises (« 2029-03:25000 »), avec une aide affichée en bulle. |
| I28 | Explicite | Séparer les fichiers YAML issus de l'import Excel (régénérés à chaque import, donc susceptibles de changer) des fichiers YAML d'événements futurs (alimentés au fil de l'eau, jamais écrasés par un import). |
| I29 | Explicite | Utiliser l'application comme une page HTML, sans serveur applicatif (pas de Django), avec un script Python qui convertit le fichier Excel en YAML au démarrage. |

## 3. Cadrage Initial du Périmètre

*Quoi :* hypothèses de frontières, à confirmer au niveau Capability.
*Pourquoi :* éviter l'extension incontrôlée du périmètre dès le premier atelier.

- **Ce qui semble INCLUS (hypothèses) :**
  - ASSUMPTION (confirmée) — Import d'un fichier Excel (`.xlsx`, structure de `Budget 2026.xlsx`, feuille « Courant ») : dépenses mensuelles (catégories + sous-catégories), revenus mensuels (catégories), dépenses et revenus exceptionnels annuels récurrents (mois + montant), dépenses exceptionnelles ponctuelles, solde de départ (compte courant + épargne). L'application n'écrit jamais dans le fichier Excel.
  - ASSUMPTION (confirmée) — Réimport du fichier Excel à la demande pour rafraîchir les données courantes (nouvelle situation).
  - ASSUMPTION (confirmée) — Toutes les données sont sauvegardées en YAML, en **deux familles de fichiers distinctes** (décision PO 2026-10-18) :
    - **YAML d'import** (ex. `donnees-courantes.yaml`) : produits par le script Python de conversion à partir du fichier Excel, régénérés à chaque import — ils peuvent donc changer ;
    - **YAML d'événements futurs** (ex. `evenements-futurs.yaml`) : à part, alimentés au fil de l'eau depuis la page, jamais écrasés par un import.
    - ASSUMPTION — `parametres.yaml` (revalorisation, horizon, prêts étudiants) relève de la seconde famille : réglé par l'utilisateur, jamais écrasé par un import. Noms et emplacements des fichiers à fixer au niveau Capability.
  - ASSUMPTION (confirmée) — Au démarrage, l'utilisateur choisit le point de départ : le fichier Excel, ou les fichiers YAML s'ils existent déjà.
  - ASSUMPTION (confirmée) — Chaque ligne issue de l'Excel (libellé, montant, échéances, dates de début/fin) est modifiable directement dans la page.
  - ASSUMPTION (confirmée) — Repartir du fichier Excel régénère uniquement les YAML d'import ; les événements futurs et les paramètres sont conservés (conséquence directe de la séparation des deux familles). Aucune fusion Excel ↔ YAML d'import n'est faite.
  - DERIVED — Une modification faite dans la page sur une ligne issue de l'Excel est enregistrée dans les YAML d'import, et sera donc perdue au prochain import Excel. Pour la rendre durable, il faut la reporter dans l'Excel. Un avertissement le rappellera avant tout réimport (à confirmer au niveau Capability).
  - ASSUMPTION (confirmée) — Les événements futurs saisis dans l'application sont sauvegardés dans des fichiers YAML lisibles et modifiables à la main, et rechargés au démarrage.
  - DERIVED (révélé par la maquette) — La colonne « quand » de l'Excel actuel est en texte libre (« 300e par trimestre », « 500 en octobre 2500 en juin », mois dans le libellé, mois absents) et n'est pas importable automatiquement de façon fiable. Le format du fichier Excel importable (ex. une colonne par mois, ou une syntaxe d'échéance fixée) est à définir au niveau Capability ; la maquette en donne une interprétation manuelle, ligne par ligne, à valider.
  - ASSUMPTION (confirmée) — Projection mensuelle démarrant en octobre 2026, sur un horizon de 10 à 15 ans.
  - ASSUMPTION (confirmée) — Événements futurs (début/fin/montant : fin de prêt, études, voiture...) saisis et stockés dans l'application, pas dans le fichier Excel.
  - ASSUMPTION (confirmée) — Revalorisation des salaires de 2 % par an. DERIVED — appliquée aux seuls revenus de catégorie "salaire" ; date anniversaire de la revalorisation à préciser au niveau Capability.
  - ASSUMPTION (confirmée) — Estimation des prêts étudiants : à taux zéro, avec un décalage configurable (en années) avant le début du remboursement ; le remboursement est réinjecté dans la projection comme dépense future. DERIVED — la durée de remboursement doit aussi être configurable (à confirmer au niveau Capability).
  - ASSUMPTION (confirmée) — Un dashboard de synthèse + un onglet de saisie des événements futurs.
  - ASSUMPTION (confirmée) — Les dates de fin des prêts en cours proviennent du fichier Excel (aujourd'hui : voiture février 2028, maison juillet 2032, appartement février 2041). DERIVED — elles sont aujourd'hui écrites dans le libellé (« s'arrête en Juillet 2032 ») : même problème de format que la colonne « quand » ; l'assurance du prêt maison n'a pas de date de fin (supposée alignée sur le prêt, à confirmer).
  - ASSUMPTION (confirmée) — Les pages présentent : la synthèse globale, les dépenses/revenus mensuels, les dépenses/revenus exceptionnels annuels, et une synthèse des nouveaux éléments (événements futurs) regroupés par type (revenu / dépense, choisi explicitement à la saisie) puis par catégorie — Études, Prêt, Achat, Revenu, Autre (liste proposée par la maquette, à confirmer au niveau Capability).
- **Ce qui est EXPLICITEMENT EXCLU :**
  - Intérêts de l'épargne (décision Flashmob).
  - Calcul des impôts (prélevés à la source — les salaires du Sheet sont considérés nets).
  - Inflation des dépenses (seule la revalorisation des salaires est modélisée).
  - Comparaison de plusieurs scénarios — un seul scénario en v1.
  - Écriture dans le fichier Excel depuis l'application.
  - Lecture directe d'un Google Sheet (remplacée par l'import d'un fichier Excel).
  - Accès multi-utilisateurs / publication web pour la famille (service Google ou autre) — besoin distinct, deuxième temps.

## 4. Exigences Implicites et Contraintes Majeures ("Garde-fous")

*Quoi :* les contraintes qui, découvertes tard, remettraient en cause la faisabilité.
*Pourquoi :* une contrainte de sécurité ou technique identifiée tard coûte beaucoup plus cher à corriger.

- **Performance :** ASSUMPTION — volume faible (un foyer, ~180 mois de projection) ; recalcul de la projection perçu comme instantané (< 2 s).
- **Sécurité :** données financières personnelles du foyer (revenus, prêts, épargne, prénoms des membres du foyer) — DERIVED : sensibles au sens de `docs/standards/cross-cutting/data-sensitivity-profile.md` (classification à faire au niveau Capability). Le fichier Excel, les fichiers YAML de données réelles et la maquette ne sont jamais versionnés dans Git (`.gitignore` : `*.xlsx`, `prototypes/` ; règle à étendre aux YAML de données au niveau Capability). Exécution locale uniquement en v1. Pas de cadre réglementaire au-delà (usage privé du foyer, hors champ d'un traitement RGPD par un tiers).
- **Disponibilité :** aucune exigence — application locale lancée à la demande.
- **Autres Contraintes Clés :**
  - Contrainte technique imposée (décision PO/Tech Lead 2026-10-18, remplace Django) : **application en page HTML, sans serveur applicatif**, exécutable depuis ce répertoire, avec un **script Python de conversion du fichier Excel en YAML au démarrage**.
  - Lecture/écriture des fichiers par la page (décision Tech Lead 2026-10-18) : la page utilise l'**API d'accès aux fichiers du navigateur** pour lire les YAML et écrire les événements futurs directement dans le dossier du projet. DERIVED — conséquences acceptées : **navigateurs Chrome ou Edge uniquement** ; l'autorisation d'accès au dossier est redonnée à chaque session. Le script Python ne sert qu'à la conversion Excel → YAML. Alternatives écartées : lanceur Python servant la page en local, export/import manuel. À formaliser en ADR C1 au niveau Capability.
  - Le fichier Excel est la source de vérité des données courantes et doit rester modifiable par la famille sans passer par l'application ; les fichiers YAML sont la source de vérité des événements futurs.
  - Aucune date butoir ni budget connus.

## 5. Recommandation pour la Décision de Gouvernance

*Quoi :* une position claire, jamais un statu quo implicite.
*Pourquoi :* sans recommandation explicite, la gouvernance n'a rien à trancher.

- **Maquette préparatoire :** produite le 2026-10-18 — démonstrateur jetable `prototypes/projection-budget.PROTOTYPE.html` (un fichier HTML autonome, non versionné car il embarque les données réelles du foyer). Il valide le modèle de projection mensuelle sur les données de `Budget 2026.xlsx` (dépenses mensuelles = 7 578 €, conforme à l'Excel ; delta moyen conforme à la cellule C66 une fois la revalorisation de janvier appliquée) et rend jouables : fins de prêts, événements futurs, arrêt d'une dépense annuelle, prêts étudiants à taux 0 avec décalage/durée, refus des saisies incohérentes. Enseignements remontés en sections 2 et 3 : creux dès janvier-février 2027, colonne « quand » non importable telle quelle, remboursements de prêts étudiants pouvant chevaucher de nouveaux emprunts (effet cascade).
- **Statut Proposé :** Validé.
- **Recommandation d'Action :** **Go** — douleur réelle, confirmée par la maquette dès 2027 ; périmètre v1 borné ; risque faible (usage local, une seule personne) ; architecture tranchée (page HTML + script Python de conversion). Point d'attention pour la suite : le format d'import Excel est le principal risque de conception.
- **Décision GATE T-1 :** **Go** — prononcée le 2026-10-18 par fabulous (casquette Sponsor), après manipulation de la maquette. Suite : initialisation par le PO seul de la carte d'identité de Capability Business (`02-carte-identite-capability-business.md`).

---

## Garde-fous qualité

- [x] L'Énoncé Brut (section 1) est un copier-coller non reformulé de la demande initiale.
- [x] Le Problème Réel (section 2) est distinct de la solution pré-supposée (choix technique, fichier Excel, dashboard sont traités comme contraintes/hypothèses).
- [x] La section 5 porte une Recommandation explicite (Go).
- [x] Toutes les sections sont remplies ; la maquette préparatoire est produite et référencée en section 5.
