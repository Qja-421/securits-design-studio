# Securits Design Studio — Contexte projet

Application de conception de coffrets électriques pour Securits 
Technologies (Pointe-Noire, Congo), destinée à remplacer XL PRO⁴ 
Legrand. Stack : React 18 + TypeScript + Vite, Konva.js pour le canvas, 
Zustand + Dexie.js (IndexedDB) pour la persistance.

## RÈGLE ABSOLUE : NE PAS TOUCHER CE QUI FONCTIONNE

Le projet est déjà largement fonctionnel. Les modules suivants sont 
VALIDÉS et NE DOIVENT PAS être modifiés sauf demande explicite :

- engine/calculator.ts, engine/validator.ts, engine/norms.ts (moteur 
  de calcul NF C 15-100 : Ib, ΔU, Iz, sections — fonctionne correctement)
- store/projectStore.ts (persistance Dexie.js — vient d'être corrigée, 
  très sensible, ne pas retoucher la logique de loadProject/initNewProject)
- App.tsx (initialisation au montage — vient d'être corrigée)
- Le rendu des composants individuels (ModularComponentNode.tsx) : 
  dégradés, vis, LED, boutons test — déjà au bon niveau de réalisme
- RibbonBar.tsx, CoffretsSidebar.tsx, PropertiesPanel.tsx, 
  PowerBalance.tsx — fonctionnels, ne pas modifier sauf demande explicite

Avant toute modification, si une tâche demandée risque d'impacter un de 
ces fichiers, demande confirmation avant d'agir plutôt que de supposer.

## Ce qui reste À CORRIGER (seul périmètre de travail actuel)

Le câblage visuel (CablingRenderer.tsx) et les dimensions du coffret 
(CabinetCanvas.tsx) sont en dessous du niveau de réalisme attendu. 
Voir la tâche détaillée fournie à chaque session.

## Identité visuelle — à respecter partout

- Bleu dominant : #29ABE2
- Orange accent : #F7941D
- Bordeaux/grenat accent : #8B1E3F
- Gris neutre foncé : #2C2C2A
- Blanc cassé : #F0ECE3
- Jamais de vert dans la palette

## Contexte utilisateur

Le porteur du projet est Jacques Alphonse MATOKO, fondateur de Securits 
Technologies. Profil cadre/chef de projet, exigeant sur la rigueur 
technique et le résultat concret. Priorité : ne jamais casser une 
fonctionnalité déjà validée pour en corriger une autre. Toujours 
confirmer le périmètre exact d'une tâche avant de l'exécuter.
