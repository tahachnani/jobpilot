-- Amélioration 6 — la relance rédigée.
--
-- Une relance est un email, mais pas l'email de candidature : mélangés dans
-- le même type, le dernier écrirait par-dessus l'autre à l'affichage. Elle
-- reçoit donc sa propre valeur dans l'énumération.
--
-- `add value` doit être exécuté hors transaction : lance ce fichier seul dans
-- l'éditeur SQL, pas collé à la suite d'un autre.

alter type type_document add value if not exists 'relance';
