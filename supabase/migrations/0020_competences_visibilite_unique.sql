-- D131 : une compétence est dans le profil ou elle n'y est pas.
--
-- Mesure du 8 octobre : sur 203 compétences visibles, 197 l'étaient dans les
-- deux volets, six en comptabilité seulement, et aucune en contrôle de gestion
-- seulement. Les six n'étaient pas des choix — c'étaient six clics donnés
-- depuis l'onglet CDG, celui que la page ouvre par défaut, alors que
-- l'intention était de retirer la ligne du profil.
--
-- On aligne sur l'intention : retirée d'un volet, retirée des deux. Les
-- colonnes restent, elles portent encore la visibilité des expériences et des
-- formations ; pour les compétences, le code les écrit désormais ensemble.
update competences
set visible_compta = false
where visible_cdg = false and visible_compta = true;
