import { Linking } from 'react-native';
import type { AxiosResponse } from 'axios';

/* Ouvre le reçu PDF d'une réservation ou d'une commande dans le navigateur, qui le télécharge.
   Le navigateur ne pouvant pas envoyer l'en-tête Authorization, on demande d'abord au serveur
   un jeton de téléchargement valable 2 minutes, passé dans l'URL. */
export async function openReceipt(
  fetchToken: () => Promise<AxiosResponse<{ token: string }>>,
  urlFor: (token: string) => string,
) {
  const res = await fetchToken();
  await Linking.openURL(urlFor(res.data.token));
}
