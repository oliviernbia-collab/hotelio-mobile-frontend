import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/constants';
import { FontAwesome5 } from '@expo/vector-icons';

/**
 * Contenu dupliqué depuis webPHP/app/Http/Controllers/PageController.php (les 7 clés de
 * pages('), à garder en phase si ce texte change côté web. Affiché en dur ici (pas d'appel
 * réseau), en français comme sur le web (le contenu de PageController n'est pas localisé
 * côté web non plus — seuls les libellés d'onglets ci-dessous sont traduits via i18n).
 */
const SECTIONS = {
  centreAide: [
    { h: 'Comment réserver un hôtel ?', b: "Utilisez la barre de recherche pour choisir une ville, des dates et le nombre de voyageurs, puis comparez les hôtels disponibles et confirmez votre réservation en quelques clics." },
    { h: 'Comment payer ma réservation ?', b: "Hôtelio accepte Orange Money, MTN Mobile Money, Wave, la carte bancaire, le virement et le paiement en espèces à la réception selon l'hôtel choisi." },
    { h: 'Puis-je annuler ou modifier ma réservation ?', b: "Oui, rendez-vous dans « Mes réservations » depuis votre espace personnel. Les conditions d'annulation dépendent de la politique de chaque hôtel, indiquée avant la confirmation." },
    { h: "Je n'ai pas reçu ma confirmation", b: "Vérifiez vos courriers indésirables, puis consultez « Mes réservations » dans votre espace client — toutes vos réservations et factures y sont toujours disponibles." },
    { h: "Besoin d'aide supplémentaire ?", b: 'Notre équipe reste disponible par email à contact@hotelio.ci pour toute question non couverte ici.' },
  ],
  securite: [
    { h: 'Paiements protégés', b: "Toutes les transactions (Mobile Money, carte bancaire, virement) transitent par des connexions chiffrées. Hôtelio ne stocke jamais vos identifiants de paiement complets." },
    { h: 'Protection du compte', b: 'Utilisez un mot de passe unique et robuste, et activez la double authentification depuis les paramètres de votre profil pour renforcer la sécurité de votre compte.' },
    { h: 'Hôtels vérifiés', b: "Chaque établissement partenaire fournit un justificatif de propriété, examiné par notre équipe avant validation, afin de garantir des annonces fiables." },
    { h: 'Signaler un problème', b: 'Si vous constatez une activité suspecte sur votre compte ou une annonce douteuse, contactez-nous immédiatement à securite@hotelio.ci.' },
  ],
  cgu: [
    { h: '1. Objet', b: "Hôtelio est une plateforme de mise en relation entre voyageurs et établissements hôteliers en Côte d'Ivoire, permettant la recherche, la réservation et la gestion de séjours." },
    { h: '2. Compte utilisateur', b: "Vous êtes responsable de la confidentialité de vos identifiants et de l'exactitude des informations fournies lors de votre inscription." },
    { h: '3. Réservations et paiements', b: "Toute réservation confirmée constitue un engagement contractuel entre le voyageur et l'établissement. Les tarifs affichés incluent les conditions précisées avant paiement." },
    { h: '4. Annulations', b: "Une réservation d'hôtel payée en ligne peut être annulée tant que le séjour n'a pas commencé : 5% du montant payé sont retenus au titre des frais d'annulation (répartis entre la plateforme et l'établissement), et 95% vous sont remboursés sur le moyen de paiement (mobile money ou compte bancaire) que vous avez enregistré. Une commande boutique payée en ligne peut être annulée dans les 48 heures suivant l'achat, selon les mêmes conditions. Passé ces délais, ou pour un paiement effectué directement en espèces/virement à l'hôtel ou au vendeur, l'annulation et un éventuel remboursement sont à convenir directement avec l'établissement." },
    { h: '5. Comptes hôteliers', b: "Les prestataires s'engagent à fournir des informations exactes sur leurs établissements et à honorer les réservations confirmées sur la plateforme." },
    { h: '6. Responsabilité', b: "Hôtelio agit en tant qu'intermédiaire et ne saurait être tenu responsable des litiges liés directement au séjour ou aux prestations fournies par l'hôtel." },
    { h: '7. Modification des conditions', b: 'Ces conditions peuvent être mises à jour ; toute modification substantielle sera communiquée aux utilisateurs.' },
  ],
  confidentialite: [
    { h: 'Données collectées', b: 'Nom, email, téléphone, informations de réservation et de paiement, ainsi que les données techniques de navigation nécessaires au fonctionnement du site.' },
    { h: 'Utilisation des données', b: 'Vos données servent à gérer vos réservations, vous contacter au sujet de votre séjour, améliorer nos services et respecter nos obligations légales.' },
    { h: 'Partage des données', b: "Vos informations de réservation sont partagées uniquement avec l'établissement concerné, dans la limite nécessaire à la gestion de votre séjour. Hôtelio ne vend aucune donnée personnelle à des tiers." },
    { h: 'Cookies', b: "Le site utilise des cookies pour maintenir votre session, mémoriser vos préférences de langue et d'affichage, et mesurer l'usage du site." },
    { h: 'Vos droits', b: 'Vous pouvez consulter, corriger ou demander la suppression de vos données personnelles à tout moment en nous contactant à confidentialite@hotelio.ci.' },
  ],
  ressourcesHotes: [
    { h: 'Créer votre compte hôtelier', b: "Inscrivez-vous en tant qu'hôtelier, fournissez votre justificatif de propriété et votre compte sera validé par un administrateur sous 24 à 48 h." },
    { h: 'Ajouter votre établissement', b: 'Une fois validé, renseignez les informations de votre hôtel (photos, chambres, tarifs, services) depuis votre espace prestataire.' },
    { h: 'Gérer vos réservations', b: 'Suivez les arrivées, départs et paiements en temps réel depuis votre tableau de bord, et gérez la disponibilité de vos chambres au quotidien.' },
    { h: 'Optimiser votre visibilité', b: 'Des photos de qualité, une description complète et des réponses rapides aux avis clients améliorent votre classement dans les résultats de recherche.' },
  ],
  forum: [
    { h: 'Bientôt disponible', b: "Nous préparons un espace d'échange entre voyageurs et hôteliers pour partager conseils, retours d'expérience et bonnes pratiques." },
    { h: 'En attendant', b: "Pour toute question, notre Centre d'aide et notre équipe support restent disponibles pour vous accompagner." },
  ],
  assistanceHotes: [
    { h: 'Support dédié', b: 'Notre équipe assiste les hôteliers pour la mise en ligne de leur établissement, la gestion des réservations et la résolution de tout problème technique.' },
    { h: 'Nous contacter', b: 'Écrivez-nous à hotes@hotelio.ci ou depuis votre espace prestataire — nous répondons sous 24 h ouvrées.' },
    { h: 'Pas encore partenaire ?', b: 'Créez votre compte hôtelier pour rejoindre Hôtelio et commencer à recevoir des réservations.' },
  ],
};

type TabKey = keyof typeof SECTIONS;

const TABS: { key: TabKey; icon: string; labelKey: string; introKey: string }[] = [
  { key: 'centreAide',       icon: 'question-circle', labelKey: 'legal.helpTab',            introKey: 'legal.helpIntro' },
  { key: 'securite',         icon: 'shield-alt',       labelKey: 'legal.securityTab',        introKey: 'legal.securityIntro' },
  { key: 'cgu',              icon: 'file-contract',    labelKey: 'legal.cguTab',             introKey: 'legal.cguIntro' },
  { key: 'confidentialite',  icon: 'user-shield',      labelKey: 'legal.privacyTab',         introKey: 'legal.privacyIntro' },
  { key: 'ressourcesHotes',  icon: 'hotel',            labelKey: 'legal.hostResourcesTab',   introKey: 'legal.hostResourcesIntro' },
  { key: 'forum',            icon: 'comments',         labelKey: 'legal.forumTab',           introKey: 'legal.forumIntro' },
  { key: 'assistanceHotes',  icon: 'headset',          labelKey: 'legal.supportTab',         introKey: 'legal.supportIntro' },
];

export default function LegalScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>('centreAide');
  const active = TABS.find((item) => item.key === tab)!;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow} contentContainerStyle={styles.tabsRowContent}>
        {TABS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.tab, tab === item.key && styles.tabActive]}
            onPress={() => setTab(item.key)}
          >
            <FontAwesome5 name={item.icon} size={12} color={tab === item.key ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{t(item.labelKey)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.introBox}>
          <FontAwesome5 name={active.icon} size={14} color={COLORS.primary} />
          <Text style={styles.introText}>{t(active.introKey)}</Text>
        </View>

        {SECTIONS[tab].map((section, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.h}</Text>
            <Text style={styles.sectionBody}>{section.b}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  tabsRow:     { flexGrow: 0, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabsRowContent: { paddingHorizontal: 8 },
  tab:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 12 },
  tabActive:   { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText:     { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.primary },
  scroll:      { flex: 1 },
  introBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 16 },
  introText:   { flex: 1, fontSize: 12, color: COLORS.dark, lineHeight: 18 },
  section:     { marginBottom: 18 },
  sectionTitle:{ fontSize: 14, fontWeight: '700', color: COLORS.dark, marginBottom: 6 },
  sectionBody: { fontSize: 13, color: COLORS.textMuted, lineHeight: 20 },
});
