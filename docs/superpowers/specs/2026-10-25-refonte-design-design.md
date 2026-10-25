# Refonte du design — conception

Date : 2026-10-25. Auteur du besoin : fabulous. Statut : à valider.

## Pourquoi

Le design actuel est « vraiment basique » (mots du PO). L'analyse faite en graphiste sur l'application réelle (données fictives) relève : aucune hiérarchie visuelle (les chiffres qui comptent sont noyés), graphiques par défaut (grosses barres bleues pleines, mois bruts du type `2026-10`, légende redondante), une seule couleur (bleu) plus un rouge sur un fond gris-blanc plat avec des bordures grises lourdes, une police système sans identité, un onglet Mensuel qui ressemble à un formulaire (chaque valeur dans une case grise bordée, « AAAA-MM » répété sur chaque ligne, actions « Palier ☐ 👁 Supprimer » en bruit visuel avec un lien rouge souligné), et aucun mouvement.

Le PO veut une application plus élégante, « classe », avec des animations modernes, destinée à sa famille (femme, enfants) et à d'autres personnes intéressées.

## Ce qui est décidé (par le PO)

- Direction retenue : **« éditorial chaleureux »** (style C de la maquette) : papier crème, titres à empattement, vert sapin et terre cuite, filets fins plutôt que cartes à ombres. Ton rassurant et élégant.
- Onglet Mensuel en présentation de **relevé** : trois grands chiffres soulignés en tête (revenus, dépenses, ce qu'il reste chaque mois) ; lignes sans cases dessinées, un champ ne se dessine qu'au survol ou au clic (soulignement en pointillé sur le champ modifiable) ; montants alignés à droite en chiffres de largeur fixe ; titres de catégorie à empattement avec leur total à droite, en vert pour les revenus et en terre cuite pour les dépenses ; actions (palier, masquer, supprimer) sous forme de petites icônes discrètes, plus foncées au survol de la ligne.
- Animations : **discrètes et lentes**, avec les mots du PO « animations récentes » comme cadre.
- Les fonctions, les données et le comportement de l'application ne changent pas : c'est une refonte visuelle.

## Objectifs

- Une identité visuelle cohérente sur les six onglets, l'écran d'accueil, la visite guidée et les fenêtres de confirmation, par une palette, une échelle typographique et des espacements communs (réglages partagés dans la feuille de style).
- Une hiérarchie claire : les chiffres clés en grand, les explications en second plan.
- Des graphiques retravaillés : le solde cumulé en courbe avec une aire douce ; le Focus mensuel et les histogrammes en barres fines ; mois écrits en lettres (« oct. 2026 ») ; plus de légende redondante ; mêmes couleurs que le reste de l'interface.
- Des tableaux lisibles comme un relevé : onglets Mensuel, Annuel & exceptionnel, Revenus et dépenses futurs, Prêts, avec la même logique que l'onglet Mensuel.
- Un mode sombre « papier de nuit » (brun profond, texte crème, mêmes verts et terre cuite), pris en compte automatiquement selon l'ordinateur comme aujourd'hui.
- Des animations d'entrée en douceur : chiffres qui apparaissent en fondu, barres qui poussent, filets qui se tracent, cartes ou blocs qui glissent légèrement, transition entre onglets.

## Non-objectifs et anti-objectifs

- Aucun changement de fonctionnement, de calcul, de format de fichier ni de textes d'aide, sauf ajustement strictement nécessaire à la nouvelle mise en page.
- Pas de bibliothèque ni de police téléchargée : tout reste hors ligne et léger.
- Pas d'effets qui gênent la lecture ou la saisie : l'élégance ne doit jamais coûter en lisibilité ou en rapidité.
- Anti-objectif : un résultat joli mais moins lisible (contraste faible, texte trop petit) ou qui casse la visite guidée, le mode sombre ou l'impression.
- Hors périmètre : le bouton EN/FR (projet séparé, après celui-ci), une version mobile dédiée.

## Contraintes

- Accessibilité : contrastes suffisants (niveau AA) dans les deux thèmes ; focus clavier toujours visible ; cibles d'action assez grandes ; le mouvement respecte « réduire les animations » (aucun mouvement dans ce cas) ; les animations n'empêchent jamais d'utiliser la page.
- La visite guidée s'appuie sur des attributs `data-aide` : ils doivent être conservés et les zones restent visibles.
- Les tests existants (`npm test`, 191 en JS ; `uv run pytest tests/py`, 34) restent verts. Un test garde les couleurs du thème (contrastes) et la liste des noms de réglages visuels utilisés.
- Impression : les pages restent imprimables lisiblement (fond clair, sans animation).
- L'écran ne doit pas devenir pire qu'aujourd'hui sur petite largeur : on garde les colonnes qui s'empilent, sans viser une version mobile dédiée.

## Choix techniques de la proposition (mes décisions, à relire)

- **Réglages communs :** des variables CSS pour les couleurs, les espacements, les rayons et les durées d'animation, avec un jeu pour le thème clair et un pour le sombre. Les fichiers d'interface n'utilisent plus de couleur ni de taille en dur.
- **Police :** pile de polices à empattement du système (Iowan Old Style, Palatino, Georgia) pour les titres et les grands chiffres ; police sans empattement du système pour les libellés et les champs. Aucun téléchargement.
- **Graphiques :** Chart.js reste, avec une configuration commune (couleurs du thème, grilles très légères, étiquettes en lettres) et la courbe en aire pour le solde cumulé ; l'infobulle HTML existante est restylée.
- **Animations :** transitions CSS et animations Chart.js intégrées ; chiffres qui apparaissent en fondu (pas de compteur qui défile) ; tout est coupé si l'ordinateur demande de réduire les animations.
- **Étapes :** (1) socle commun (variables, typographie, en-tête, cartes, boutons, champs, thème sombre) ; (2) tableau de bord et graphiques ; (3) onglet Mensuel en relevé ; (4) autres onglets (Annuel, Futurs, Prêts, Paramètres, accueil) ; (5) visite guidée et finitions ; chaque étape livrable et relue.

## Précisions (mes décisions après relecture, à vérifier)

- **Les chiffres de l'onglet Mensuel :** les trois grands chiffres sont « Revenus », « Dépenses » et « Reste chaque mois » (le restant mensuel des montants de départ). Les deux autres chiffres actuels, « Mensualités de prêts (moyenne) » et « Reste chaque mois après prêts », restent affichés sur une ligne plus petite dessous : rien n'est supprimé, aucun calcul ne change.
- **Case « Palier » :** elle reste visible avec son libellé « Palier » (pas seulement une icône), pour que la famille la découvre ; seuls l'œil et la suppression deviennent de petites icônes, avec un nom accessible et une info-bulle. Le texte d'aide des paliers reste affiché.
- **Tableaux à plusieurs colonnes (Annuel, Futurs, Prêts) :** les champs modifiables restent repérables au repos par un fin soulignement pointillé clair (utile au clavier et au tactile, où le survol n'existe pas) ; les listes déroulantes gardent un petit chevron ; la case se dessine au survol et au focus. Le but « sans cases dessinées » vise le repos visuel, pas l'accessibilité.
- **« AAAA-MM » répété :** il disparaît des cellules vides, qui affichent « — » ; le format est indiqué une fois dans l'en-tête de colonne (« Fin (AAAA-MM) ») et en info-bulle au focus. Les champs restent des champs de texte : la validation et les brouillons ne changent pas.
- **Totaux par catégorie :** affichés dans les titres de catégorie là où ils existent déjà (Mensuel, détail du mois) ; aucun nouveau calcul n'est ajouté pour les autres onglets, dont les titres de catégorie n'affichent pas de total.
- **Contrastes :** le niveau AA prime sur les couleurs de la maquette, qui ne sont qu'un point de départ : la terre cuite et le vert utilisés en texte peuvent être assombris. Un nouveau test Node lit les deux jeux de couleurs (clair et sombre) dans la feuille de style et vérifie les paires texte/fond, les boutons et les couleurs d'alerte.
- **Tests existants :** ceux qui vérifient la structure ou des noms de classes peuvent être modifiés quand la mise en page change ; les assertions de comportement et de calcul ne changent pas.
- **Mode sombre :** automatique selon l'ordinateur, sans bouton, comme aujourd'hui ; les graphiques se redessinent quand le thème du système change.
- **Couleurs des graphiques :** uniquement le vert sapin et la terre cuite avec leurs nuances ; pas de palette de catégories.
- **Livraison :** une seule branche, une étape par commit relue avec des captures d'écran ; un état intermédiaire mêlant ancien et nouveau style est acceptable sur la branche tant qu'elle n'est pas publiée. La publication sur la page en ligne se fait une fois l'ensemble relu, à la demande du PO.
- **Navigateurs :** les navigateurs récents Chrome et Edge, ceux que l'application exige déjà. La police à empattement du système varie d'un ordinateur à l'autre, ce qui est accepté.

## Laissé au constructeur

- Les valeurs exactes de la palette (à partir des couleurs de la maquette : crème `#f7f1e6`, vert sapin `#2f5d50`, terre cuite `#c0562f`, encre `#2b2a24`, filet `#d9cfb8`, gris chaud `#7d745f`), vérifiées pour le contraste.
- Les icônes exactes des actions (dessinées en SVG simple, sans bibliothèque).
- Les durées et courbes d'animation précises.
- Le détail de l'écran d'accueil et des fenêtres de confirmation.
