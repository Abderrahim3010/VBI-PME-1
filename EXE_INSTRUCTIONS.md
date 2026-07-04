# 🖥️ Générer l'application en Exécutable (.exe) Ultra-Fluide

Ce projet contient désormais une configuration **Electron** hautement optimisée pour packager votre application en un fichier `.exe` portable et ultra-fluide (sans latence ni lag).

---

## ⚡ Pourquoi l'ancienne version était-elle "laggy" ?
Les convertisseurs d'applications web simples (comme *Nativefier* ou certains wrappers génériques) ont plusieurs défauts majeurs :
1. **Pas de cache actif** : Ils écrivent constamment sur le disque dur (I/O synchrone).
2. **Throttling d'arrière-plan** : Ils réduisent la priorité CPU de l'application dès que la fenêtre est inactive ou qu'un autre onglet passe devant.
3. **GPU désactivé** : La rastérisation GPU n'est pas forcée, ce qui décharge tout le travail graphique complexe sur votre CPU.

Nous avons **corrigé et optimisé cela** en :
* Désactivant le throttling CPU d'arrière-plan (`backgroundThrottling: false`).
* Activant l'accélération matérielle complète et la rastérisation GPU (`enable-gpu-rasterization`, `enable-oop-rasterization`).
* Remplaçant les écritures synchrones sur disque par un système de persistance locale asynchrone ultra-rapide (débruitage de 250ms sur les sauvegardes `localStorage`).

---

## 🛠️ Instructions de compilation locale (En 1 clic)

Une fois que vous téléchargez ou exportez le code de votre application (depuis le menu **Paramètres (icône engrenage) > Exporter le ZIP**), suivez ces étapes simples sur votre ordinateur pour générer votre `.exe` :

### Étape 1 : Installer Node.js
Si ce n'est pas déjà fait, téléchargez et installez **Node.js LTS** sur [nodejs.org](https://nodejs.org/).

### Étape 2 : Lancer la compilation automatique !
Nous avons préparé un script automatique. Ouvrez votre terminal (PowerShell ou Invite de commandes) dans le dossier du projet et exécutez :

```bash
# 1. Installer toutes les dépendances configurées
npm install

# 2. Compiler l'application et packager en .exe portable d'un coup !
npm run build:exe
```

Le fichier exécutable `.exe` final sera généré instantanément dans le dossier :
📂 **`dist-exe/PMESuite.exe`** (ou `PMESuite-Portable.exe`)

---

## 🎯 Mode Portable en 1 Fichier
Le script génère un fichier `.exe` indépendant. Vous pouvez le copier sur une clé USB, l'envoyer à vos collaborateurs ou le placer sur votre bureau. Il s'exécute directement sans aucune installation requise !
