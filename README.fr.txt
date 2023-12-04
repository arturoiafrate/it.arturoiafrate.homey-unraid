Intégration non officielle pour unRAID.
Cette intégration vous permet de superviser et gérer votre NAS unRAID.

Langues supportées :
English
Italiano
Français

Comment ça marche ?
Installez l'application et ajoutez un nouvel appareil unRAID. Ouvrez les paramètres de l'appareil et configurez :
• Hôte > Le nom de l'hôte/L'adresse ip de votre NAS unRAID.
• Identifiant> Un utilisateur valide sur votre serveur unRAID. Vous pouvez aussi utiliser l'utilisateur root.
• Mot de passe > Le mot de passe de l'utilisateur.
• Port > Le port de connexion SSH. Par défaut: 22
• Intervalle de Ping > l'intervalle de ping (en secondes). Utilisé pour vérifier si le serveur unRAID est joignable. Défault: 3
• Adresse MAC > L'adresse MAC de votre serveur unRAID. Si paramétré, et si votre serveur est sur votre LAN, vous pouvez envoyer un magic packet (WOL) pour réveiller votre NAS.
• Intervalle de vérification > L'intervalle de rafraichissement (en secondes) de toutes les sondes.

Pour plus d'informations à propos de la confifuration du service, visitez le dépôt github.