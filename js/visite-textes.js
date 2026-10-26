(function (root) {
  'use strict';

  // Textes de la visite guidée (bouton « ? » de l’en-tête). Pour les modifier : changer `titre` ou `texte`
  // d’une étape, ou en ajouter / retirer (de 4 à 7 par onglet, 2 à 3 phrases chacune). `cible` est la clé
  // `data-aide` de l’élément entouré dans la page (voir les fichiers js/ui-*.js) : ne la changer que si
  // l’attribut est renommé aussi dans le code. Une étape dont la cible est absente est sautée ; la première
  // étape de chaque onglet présente l’onglet. La visite « navigateur » (une étape, sans cadre) s’affiche sur
  // l’écran « Navigateur non pris en charge ».
  // Pendant la visite la page est bloquée : les textes décrivent donc ce que l’on pourra faire APRÈS la visite.
  const textesVisite = {
    navigateur: [
      { cible: 'accueil-navigateur', titre: 'Navigateur non pris en charge', texte: 'Cette application a besoin d’accéder aux dossiers de votre ordinateur, ce que seuls Google Chrome et Microsoft Edge permettent. Ouvrez cette page dans l’un de ces deux navigateurs, sur ordinateur.' },
    ],

    accueil: [
      { cible: 'accueil-intro', titre: 'Bienvenue', texte: 'Cette application projette votre compte mois par mois sur 10 à 15 ans, à partir de vos revenus et de vos dépenses. Tout se passe sur votre ordinateur : rien n’est envoyé sur Internet.' },
      { cible: 'accueil-ouvrir', titre: 'Ouvrir le dossier de données', texte: 'Choisissez le dossier data/ du projet : les fichiers y sont lus puis enregistrés directement à chaque modification. L’autorisation d’accès n’est pas conservée : il faudra rouvrir le dossier à chaque visite de la page.' },
      { cible: 'accueil-importer', titre: 'Importer une sauvegarde', texte: 'Pour reprendre des données exportées depuis un autre ordinateur, choisissez le fichier de sauvegarde, puis le dossier de destination. Le fichier est vérifié avant toute écriture, et aucun fichier existant n’est remplacé sans votre accord.' },
      { cible: 'bouton-aide', titre: 'Le bouton d’aide', texte: 'Ce bouton « ? » est toujours là, sur chaque écran : il lance la visite de l’onglet affiché. La visite ne démarre jamais seule et ne modifie aucune donnée. Échap la ferme, les flèches du clavier changent d’étape.' },
    ],

    dashboard: [
      { cible: 'chiffres-cles', titre: 'Le tableau de bord', texte: 'Cet onglet se consulte, il ne se modifie pas : il montre l’évolution de votre solde (compte courant plus épargne) d’après les autres onglets. Ces trois grands chiffres donnent le solde à la fin du premier mois, le net de ce mois (revenus moins dépenses) et le solde à la fin de la projection ; ils sont verts quand ils sont positifs, terre cuite quand ils sont négatifs.' },
      { cible: 'solde-periode-graphe', titre: 'La courbe du solde', texte: 'La courbe montre le solde de fin de mois, tracé en vert au-dessus de zéro et en terre cuite en dessous. Une fois la visite terminée, survolez un mois pour voir d’où viennent les montants : régulier, annuel, exceptionnel, futur et prêts.' },
      { cible: 'solde-periode-choix', titre: 'Choisir la période', texte: 'Ce menu règle la période du premier graphique : les douze prochains mois ou une année civile. Le graphique se met à jour dès que vous changez de choix.' },
      { cible: 'solde-long', titre: 'Le solde sur plusieurs années', texte: 'Ce second graphique part du solde de départ (compte courant et épargne), puis ajoute le résultat de chaque mois. Le menu « Durée affichée » propose 5, 8, 10 ou 15 ans, sans jamais dépasser l’horizon de la projection réglé dans Paramètres.' },
      { cible: 'detail-mois-choix', titre: 'Choisir un mois', texte: 'Sélectionnez un mois pour afficher en dessous le détail de ce qui entre et de ce qui sort. La liste couvre toute la durée de la projection.' },
      { cible: 'detail-mois-zone', titre: 'Le détail du mois', texte: 'Les revenus et les dépenses du mois sont regroupés par catégorie, avec chaque ligne et son origine (mensuel, annuel, exceptionnel, futur ou prêt). En bas, le net du mois est la différence entre revenus et dépenses, et le solde de fin de mois le montant disponible une fois ce mois passé. Les lignes masquées ne sont pas comptées.' },
    ],

    mensuel: [
      { cible: 'mensuel-totaux', titre: 'Les lignes mensuelles', texte: 'Cet onglet liste ce qui revient chaque mois : salaires, loyer, abonnements… Les totaux en haut utilisent les montants de départ, sans revalorisation : revenus, dépenses, puis ce qu’il reste chaque mois, avant et après les mensualités de prêts (moyenne des douze premiers mois, d’après l’onglet Prêts).' },
      { cible: 'mensuel-tableau', titre: 'Modifier sur place', texte: 'Les lignes sont rangées par catégorie : cliquez sur une valeur pour la modifier, le changement est enregistré tout de suite. « Revalorisé » fait augmenter le montant chaque année selon les Paramètres, « Fin » arrête la ligne à un mois donné et la corbeille la retire après confirmation. Attention : un nouvel import Excel remplace ces lignes.' },
      { cible: 'ligne-oeil', titre: 'Masquer une ligne', texte: 'L’œil met la ligne de côté sans la supprimer : elle n’est plus comptée nulle part (totaux, graphiques, détail par mois). Cliquez de nouveau pour la reprendre en compte. Un nouvel import Excel remet toutes les lignes importées visibles.' },
      { cible: 'ligne-palier', titre: 'Un montant qui change', texte: 'Cochez « Palier » quand le montant d’une ligne doit changer à une date précise, par exemple après une augmentation : un palier remplace le montant à partir de sa date. Cocher la case fait apparaître sous la ligne le bouton « + ajouter un palier ». Décocher la case d’une ligne qui a des paliers les supprime, après confirmation.' },
      { cible: 'palier-ligne', titre: 'Les paliers d’une ligne', texte: 'Chaque palier a un mois « à partir de » (AAAA-MM) et un nouveau montant, valable jusqu’au palier suivant ; 0 signifie plus rien à partir de cette date. « + ajouter un palier » en crée un le mois suivant le dernier palier (pour le premier : le mois suivant le début de la ligne ou de la projection), avec le montant précédent. Le dernier palier dure jusqu’à la « Fin » de la ligne ; dès qu’une ligne a des paliers, la case « Fin » se saisit sur son dernier palier.' },
      { cible: 'mensuel-ajout', titre: 'Ajouter une ligne', texte: 'Choisissez dépense ou revenu, indiquez la catégorie (des suggestions reprennent celles qui existent), un libellé et le montant mensuel, puis validez. La ligne est enregistrée aussitôt ; si une saisie est invalide, un message l’explique et rien n’est écrit.' },
      { cible: 'orphelins', titre: 'Paliers sans ligne', texte: 'Cette carte n’apparaît que si des paliers enregistrés (ils survivent à un nouvel import Excel) ne correspondent plus à aucune ligne, par exemple parce qu’elle a été renommée. Ils sont conservés tant que vous ne les supprimez pas, et se rattachent de nouveau à une ligne qui retrouve les mêmes nature, type, catégorie et libellé.' },
    ],

    annuel: [
      { cible: 'annuel-bilan', titre: 'Annuel et exceptionnel', texte: 'Cet onglet regroupe ce qui ne revient pas chaque mois : une ou plusieurs fois par an, ou une seule fois à une date précise. Ce tableau montre, de janvier à décembre, les revenus, les dépenses et le bilan des douze premiers mois projetés, avec un total. Les montants sont ceux de départ, sans revalorisation.' },
      { cible: 'annuel-syntaxe', titre: 'Écrire les échéances', texte: 'Pour écrire les échéances : « 800 » veut dire 800 € chaque mois entre le début et la fin, « 3-300 » 300 € chaque année en mars, « 6-500, 10-500 » 500 € en juin et en octobre, et « 2026-3-300 » 300 € une seule fois, en mars 2026. Le mois va de 1 à 12. Une fois la visite terminée, le petit « ? » à côté du champ rappelle cette syntaxe au survol.' },
      { cible: 'annuel-tableau', titre: 'Modifier sur place', texte: 'Chaque case se modifie directement et le changement est enregistré tout de suite ; la corbeille retire la ligne après confirmation. L’impact mensuel est le total des douze premiers mois divisé par douze. Les lignes exceptionnelles, plus bas, fonctionnent pareil mais sont datées par leurs échéances : sans début, fin ni revalorisation.' },
      { cible: 'ligne-oeil', titre: 'Masquer une ligne', texte: 'L’œil exclut la ligne de tous les calculs sans la supprimer : bilans, graphiques et détail par mois l’ignorent. Un second clic la reprend en compte, et un nouvel import Excel remet toutes les lignes importées visibles.' },
      { cible: 'ligne-palier', titre: 'Un montant qui change', texte: 'Cochez « Palier » pour que les échéances d’une ligne changent à partir d’une date : un palier remplace le montant à partir de sa date. Cocher la case fait apparaître sous la ligne le bouton « + ajouter un palier ». Décocher la case d’une ligne qui a des paliers les supprime, après confirmation.' },
      { cible: 'palier-ligne', titre: 'Les paliers d’une ligne', texte: 'Un palier se compose d’un mois « à partir de » (AAAA-MM) et de nouvelles échéances, valables jusqu’au palier suivant ; 0 signifie plus rien à partir de cette date. « + ajouter un palier » en crée un le mois suivant le dernier palier (pour le premier : le mois suivant le début de la ligne ou de la projection), avec les échéances précédentes. Le dernier palier dure jusqu’à la « Fin » de la ligne ; dès qu’une ligne a des paliers, la case « Fin » se saisit sur son dernier palier.' },
      { cible: 'annuel-ajout', titre: 'Ajouter une ligne', texte: 'Choisissez la nature (annuel ou exceptionnel), le type, la catégorie, le libellé et les échéances. La ligne est enregistrée dès la validation ; si la saisie est invalide, un message l’explique et rien n’est écrit.' },
    ],

    evenements: [
      { cible: 'evenements-bilan', titre: 'Revenus et dépenses futurs', texte: 'Cet onglet sert aux projets à venir qui ne sont pas dans votre budget courant : études, achat d’une voiture, prime… Ce tableau donne l’impact de ces événements année par année sur dix ans, en revenus, dépenses et bilan. Les montants sont ceux de départ, sans revalorisation et sans les prêts.' },
      { cible: 'evenements-ajout', titre: 'Ajouter un événement', texte: 'Choisissez revenu ou dépense, une catégorie, un libellé et le montant, puis validez : l’événement est enregistré aussitôt. Le montant s’écrit ainsi : « 800 » = 800 € par mois entre le début et la fin, « 3-300 » = 300 € chaque mars, « 6-500, 10-500 » = plusieurs fois par an, « 2026-3-300 » = une seule fois, en mars 2026. Une fois la visite terminée, le petit « ? » à côté du champ rappelle cette syntaxe au survol.' },
      { cible: 'evenements-liste', titre: 'Les événements enregistrés', texte: 'Chaque case se modifie sur place et le changement est enregistré tout de suite dans le fichier des événements futurs. « Supprimer » retire l’événement après confirmation.' },
      { cible: 'ligne-oeil', titre: 'Masquer un événement', texte: 'L’œil met l’événement de côté : il n’est plus compté nulle part, ni dans les bilans, ni dans les graphiques du tableau de bord. Cliquez de nouveau pour le reprendre en compte.' },
      { cible: 'ligne-palier', titre: 'Un montant qui change', texte: 'Cochez « Palier » si le montant doit changer à une date précise : un palier remplace le montant à partir de sa date. Cocher la case fait apparaître sous la ligne le bouton « + ajouter un palier ». Décocher la case d’un événement qui a des paliers les supprime, après confirmation.' },
      { cible: 'palier-ligne', titre: 'Les paliers d’un événement', texte: 'Chaque palier indique le mois « à partir de » (AAAA-MM) et le nouveau montant, valable jusqu’au palier suivant ; 0 signifie plus rien à partir de cette date. « + ajouter un palier » en crée un le mois suivant le dernier palier (pour le premier : le mois suivant le début de l’événement ou de la projection), avec le montant précédent. Le dernier palier dure jusqu’à la « Fin » de l’événement ; dès qu’il a des paliers, la case « Fin » se saisit sur son dernier palier.' },
      { cible: 'evenements-synthese', titre: 'La synthèse', texte: 'Ce tableau additionne vos événements par type, par catégorie et par année sur toute la durée de la projection, avec un total par ligne. Il sert à voir d’un coup d’œil ce que pèse chaque catégorie. Les montants sont ceux de départ, sans revalorisation.' },
    ],

    prets: [
      { cible: 'prets-encours', titre: 'Les prêts', texte: 'Cet onglet gère vos crédits : ceux déjà souscrits (cette carte) et, plus bas, ceux que vous voulez simuler. Pour un prêt en cours, indiquez seulement la mensualité et le mois de fin : elle est comptée comme une dépense chaque mois jusqu’à cette date. Retirez la ligne équivalente de l’onglet Mensuel pour ne pas la compter deux fois.' },
      { cible: 'prets-simules', titre: 'Simuler un prêt', texte: 'Le montant emprunté arrive en recette le mois de mise à disposition ; les remboursements commencent le mois suivant, décalés du différé s’il y en a un (un prêt étudiant, par exemple). Sans taux, la mensualité est le montant divisé par la durée ; avec un taux, elle est constante.' },
      { cible: 'prets-simules-ajout', titre: 'Ajouter un prêt à simuler', texte: 'Renseignez un libellé, le montant, le mois de mise à disposition (AAAA-MM) et la durée en mois. Le différé et le taux annuel sont facultatifs, et la virgule décimale est acceptée. Le prêt est enregistré à la validation.' },
      { cible: 'prets-simules-tableau', titre: 'Le résultat de la simulation', texte: 'Pour chaque prêt simulé, le tableau calcule la mensualité, les mois de premier et dernier remboursement et le coût des intérêts. Modifiez une case et tout est recalculé et enregistré ; « Supprimer » retire le prêt après confirmation. Le tableau de bord tient compte de ces prêts.' },
      { cible: 'ligne-oeil', titre: 'Masquer un prêt', texte: 'L’œil met un prêt de côté sans le supprimer : ni son versement éventuel ni ses remboursements ne sont comptés. C’est utile pour comparer l’évolution du solde avec et sans ce prêt. Cliquez de nouveau pour le reprendre en compte.' },
    ],

    parametres: [
      { cible: 'parametres-carte', titre: 'Les paramètres', texte: 'Ces réglages commandent toute la projection. Chaque changement valide est enregistré tout de suite, et les graphiques sont recalculés. Une saisie invalide est refusée avec un message, et rien n’est écrit.' },
      { cible: 'param-depart', titre: 'Le mois de départ', texte: 'C’est le premier mois de la projection, au format AAAA-MM. Les graphiques et les bilans commencent à ce mois, et les montants de départ sont ceux de ce moment.' },
      { cible: 'param-horizon', titre: 'L’horizon', texte: 'C’est la durée projetée, en années : entre 10 et 15. Plus elle est longue, plus loin les graphiques et les listes de mois s’étendent.' },
      { cible: 'param-revalorisation', titre: 'La revalorisation', texte: 'Le taux annuel, en pourcentage (2 pour 2 %), s’applique chaque année aux seules lignes cochées « revalorisé ». Le champ « mois » donne le mois où l’augmentation intervient (1 pour janvier). Les autres lignes gardent leur montant.' },
      { cible: 'param-solde', titre: 'Le solde de départ', texte: 'Ces deux champs fixent le compte courant et l’épargne au premier mois. Vides, les valeurs du fichier Excel sont reprises ; un nombre les remplace, même après un nouvel import (les négatifs sont acceptés). Le total est rappelé sous les champs.' },
      { cible: 'param-export', titre: 'Exporter une sauvegarde', texte: 'Ce bouton télécharge un seul fichier texte contenant vos données, vos événements et prêts, vos paramètres et vos paliers, tels qu’enregistrés, sans l’historique CSV (recréé à chaque enregistrement). Ce fichier contient vos données financières. Partagez-le avec soin.' },
      { cible: 'param-import', titre: 'Importer une sauvegarde', texte: 'Choisissez un fichier exporté, puis le dossier de destination, par exemple sur un autre ordinateur. Le fichier est entièrement vérifié avant d’écrire quoi que ce soit, et si le dossier contient déjà des fichiers, la liste vous est montrée : rien n’est remplacé sans votre accord.' },
    ],
  };

  const api = { textesVisite: textesVisite };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Budget = Object.assign(root.Budget || {}, api);
})(this);
