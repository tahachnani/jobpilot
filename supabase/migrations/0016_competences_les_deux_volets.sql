-- D119 : le profil ne se découpe pas par volet.
--
-- À l'acceptation d'une compétence révélée par une offre, le code écrivait
-- `visible_cdg: maitrisee && volet === "cdg"` : la compétence n'entrait que
-- dans le volet de l'offre qui l'avait révélée. Pennylane, acceptée depuis une
-- offre de contrôle de gestion, n'avait donc aucun chemin vers un CV
-- comptable — le seul où un cabinet la demanderait. Cent quarante-huit
-- compétences étaient dans cet état.
--
-- On ouvre les deux volets à tout ce qui est maîtrisé et déjà visible quelque
-- part. On ne touche pas :
--   * aux niveaux zéro, qui sont les compétences non maîtrisées, gardées en
--     base uniquement pour ne plus être reproposées ;
--   * aux compétences masquées dans les deux volets, qui l'ont été
--     délibérément depuis Mon profil.
update competences
   set visible_cdg = true,
       visible_compta = true
 where niveau >= 1
   and (visible_cdg or visible_compta)
   and visible_cdg <> visible_compta;
