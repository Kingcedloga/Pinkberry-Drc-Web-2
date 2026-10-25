import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/** Fichiers — iOS / Android. Même API que fichiers.web.ts. */

/** Joint un fichier local (photo choisie…) à un envoi multipart. */
export async function joindreFichier(form: FormData, champ: string, f: { uri: string; nom: string; type: string }): Promise<void> {
  form.append(champ, { uri: f.uri, name: f.nom, type: f.type } as any);
}

/** Remet à l'utilisateur un fichier reçu du serveur : feuille de partage du système. */
export async function remettreFichier(reponse: Response, nom: string): Promise<void> {
  const octets = new Uint8Array(await reponse.arrayBuffer());
  const fichier = new File(Paths.cache, nom);
  if (fichier.exists) fichier.delete();
  fichier.create();
  // SDK 58 : write() est asynchrone, on attend la fin avant de partager le fichier.
  await fichier.write(octets);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fichier.uri);
}
