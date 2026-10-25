/** Fichiers — web / PWA. Même API que fichiers.ts. */

/** Joint un fichier local (URI blob: ou data: du sélecteur) à un envoi multipart. */
export async function joindreFichier(form: FormData, champ: string, f: { uri: string; nom: string; type: string }): Promise<void> {
  const blob = await (await fetch(f.uri)).blob();
  form.append(champ, blob, f.nom);
}

/** Remet à l'utilisateur un fichier reçu du serveur : téléchargement du navigateur. */
export async function remettreFichier(reponse: Response, nom: string): Promise<void> {
  const blob = await reponse.blob();
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(blob);
  lien.download = nom;
  lien.click();
  URL.revokeObjectURL(lien.href);
}
