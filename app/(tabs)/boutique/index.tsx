import { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, FlatList, Image, StyleSheet, TouchableOpacity,
  Alert, RefreshControl, ScrollView, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform, TextInput,
} from 'react-native';
import { router, Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { boutiqueApi } from '@/services/api';
import { Product } from '@/types';
import { COLORS, PAYMENT_METHODS } from '@/constants';
import PaymentMethodIcon from '@/components/PaymentMethodIcon';
import { FontAwesome5 } from '@expo/vector-icons';
import { EmojiPicker } from '@/components/EmojiPicker';
import { useAuthStore } from '@/store/authStore';
import PaymentInfoFields, {
  PaymentInfo, EMPTY_PAYMENT_INFO, validatePaymentInfo,
} from '@/components/PaymentInfoFields';

const EMPTY_FORM = { name: '', price: '', stock: '', category: '', emoji: '', description: '' };

/* ── Composant carte produit mémoïsé ─────────────────────────────────────── */
type ProductCardProps = {
  item:          Product;
  cart:          Record<number, number>;
  isPrestataire: boolean;
  myId:          number;
  onAdd:         (p: Product) => void;
  onRemove:      (p: Product) => void;
  onEdit:        (p: Product) => void;
  onDelete:      (p: Product) => void;
  onDetail:      (p: Product) => void;
};

const ProductCard = memo(({
  item, cart, isPrestataire, myId, onAdd, onRemove, onEdit, onDelete, onDetail,
}: ProductCardProps) => {
  const { t } = useTranslation();
  const qty        = cart[item.id] ?? 0;
  const imageUrl   = item.image_url;
  const outOfStock = item.stock <= 0;
  const canManage  = Number(item.user_id) === myId;

  return (
    <View style={styles.card}>
      {/* Zone image — tappable pour voir le détail */}
      <TouchableOpacity onPress={() => onDetail(item)} activeOpacity={0.8}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.productImg} resizeMode="cover" />
        ) : (
          <View style={styles.emojiBadge}>
            <Text style={styles.emoji}>{item.emoji ?? '📦'}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Infos produit + bouton Détail */}
      <TouchableOpacity style={{ flex: 1 }} onPress={() => onDetail(item)} activeOpacity={0.7}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.category}>{item.category}</Text>
        <Text style={[styles.stock, outOfStock && { color: COLORS.danger }]}>
          {outOfStock ? t('boutique.outOfStock') : t('boutique.stockCount', { count: item.stock })}
        </Text>
        <Text style={styles.price}>{item.price?.toLocaleString()} FCFA</Text>
        {item.description ? (
          <Text style={styles.descPreview} numberOfLines={1}>{item.description}</Text>
        ) : null}
        {isPrestataire && item.user_id && !canManage && (
          <View style={styles.otherBadge}>
            <Text style={styles.otherBadgeText}>{t('boutique.otherProvider')}</Text>
          </View>
        )}
        <View style={styles.detailHint}>
          <FontAwesome5 name="info-circle" size={11} color={COLORS.primary} />
          <Text style={styles.detailHintText}>{t('boutique.viewDetail')}</Text>
        </View>
      </TouchableOpacity>

      {/* Actions */}
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {isPrestataire ? (
          canManage ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={() => onEdit(item)}>
                <FontAwesome5 name="pen" size={15} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onDelete(item)}>
                <FontAwesome5 name="trash-alt" size={15} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          ) : null
        ) : outOfStock ? null : qty === 0 ? (
          <TouchableOpacity style={styles.addBtn} onPress={() => onAdd(item)}>
            <FontAwesome5 name="cart-plus" size={16} color={COLORS.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.qtyRow}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => onRemove(item)}>
              <FontAwesome5 name="minus" size={13} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{qty}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => onAdd(item)}>
              <FontAwesome5 name="plus" size={13} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
});

/* ══════════════════════════════════════════════════════════════════════════ */
export default function BoutiqueScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isPrestataire = user?.role === 'prestataire';
  const myId = Number(user?.id);

  const [products,        setProducts]        = useState<Product[]>([]);
  const [cart,            setCart]            = useState<Record<number, number>>({});
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [showCart,        setShowCart]        = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('');
  const [paymentInfo,     setPaymentInfo]     = useState<PaymentInfo>({ ...EMPTY_PAYMENT_INFO });
  const [ordering,        setOrdering]        = useState(false);
  const [activeTab,       setActiveTab]       = useState<'tous' | 'mes'>('tous');

  /* ── État modal détail produit ─────────────────────────────────────────── */
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  const filteredProducts = useMemo(() => {
    if (!isPrestataire || activeTab === 'tous') return products;
    return products.filter(p => Number(p.user_id) === myId);
  }, [products, activeTab, isPrestataire, myId]);

  /* ── Modal création / édition produit (prestataire) ───────────────────── */
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct,   setEditingProduct]   = useState<Product | null>(null);
  const [productForm,      setProductForm]      = useState({ ...EMPTY_FORM });
  const [productImage,     setProductImage]     = useState<{ uri: string; name: string; type: string } | null>(null);
  const [saving,           setSaving]           = useState(false);

  const fetchProducts = async () => {
    try {
      const res = await boutiqueApi.products();
      setProducts(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  /* ── Panier local ─────────────────────────────────────────────────────── */
  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart(prev => ({ ...prev, [product.id]: (prev[product.id] ?? 0) + 1 }));
  };

  const removeFromCart = (product: Product) =>
    setCart(prev => {
      const next = { ...prev };
      if (next[product.id] <= 1) delete next[product.id];
      else next[product.id]--;
      return next;
    });

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalPrice = products.reduce((acc, p) => acc + (p.price * (cart[p.id] ?? 0)), 0);

  const closeCart = () => {
    setShowCart(false);
    setSelectedPayment('');
    setPaymentInfo({ ...EMPTY_PAYMENT_INFO });
  };

  const handlePlaceOrder = async () => {
    if (!selectedPayment) { Alert.alert(t('common.required'), t('hotels.paymentRequired')); return; }
    const infoError = validatePaymentInfo(selectedPayment, paymentInfo, t);
    if (infoError) { Alert.alert(t('hotels.paymentInfo'), infoError); return; }
    setOrdering(true);
    try {
      for (const [id, qty] of Object.entries(cart)) {
        await boutiqueApi.addToCart(Number(id), qty);
      }
      await boutiqueApi.placeOrder(selectedPayment);
      setCart({});
      closeCart();
      fetchProducts(); // rafraîchir les stocks
      Alert.alert(t('common.success'), t('boutique.orderPlaced'), [
        { text: t('dashboard.action_orders'), onPress: () => router.push('/(tabs)/boutique/my-orders') },
        { text: t('common.ok') },
      ]);
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('boutique.orderError'));
    } finally {
      setOrdering(false);
    }
  };

  /* ── CRUD produits (prestataire) ─────────────────────────────────────── */
  const pickImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'image/*' });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        Alert.alert(t('hotels.photoTooBig'), t('boutique.imageMax10'));
        return;
      }
      setProductImage({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'image/jpeg' });
    } catch (e) {
      console.error('Image picker:', e);
    }
  };

  const openCreate = () => {
    setEditingProduct(null);
    setProductForm({ ...EMPTY_FORM });
    setProductImage(null);
    setShowProductModal(true);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name:        p.name,
      price:       String(p.price),
      stock:       String(p.stock),
      category:    p.category ?? '',
      emoji:       p.emoji ?? '',
      description: p.description ?? '',
    });
    setProductImage(null);
    setShowProductModal(true);
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim() || !productForm.price) {
      Alert.alert(t('common.required'), t('boutique.nameAndPriceRequired'));
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name',        productForm.name.trim());
      fd.append('price',       productForm.price);
      fd.append('stock',       productForm.stock || '0');
      fd.append('category',    productForm.category.trim());
      fd.append('emoji',       productForm.emoji.trim());
      fd.append('description', productForm.description.trim());
      if (productImage) fd.append('image', productImage as any);
      if (editingProduct) {
        await boutiqueApi.updateProduct(editingProduct.id, fd);
      } else {
        await boutiqueApi.createProduct(fd);
      }
      setShowProductModal(false);
      fetchProducts();
    } catch (e: any) {
      Alert.alert(t('common.error'), e.response?.data?.message ?? t('hotels.cannotSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = (p: Product) => {
    Alert.alert(
      t('common.delete'),
      t('services.deleteMsg', { name: p.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: async () => {
            try {
              await boutiqueApi.deleteProduct(p.id);
              fetchProducts();
            } catch (e: any) {
              Alert.alert(t('common.error'), e.response?.data?.message ?? t('hotels.cannotDelete'));
            }
          },
        },
      ]
    );
  };

  /* ── Rendu produit mémoïsé ────────────────────────────────────────────── */
  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <ProductCard
      item={item}
      cart={cart}
      isPrestataire={isPrestataire}
      myId={myId}
      onAdd={addToCart}
      onRemove={removeFromCart}
      onEdit={openEdit}
      onDelete={handleDeleteProduct}
      onDetail={setViewingProduct}
    />
  ), [cart, isPrestataire, myId]);

  /* ── Quantité du produit affiché dans le détail ───────────────────────── */
  const detailQty     = viewingProduct ? (cart[viewingProduct.id] ?? 0) : 0;
  const detailOOS     = viewingProduct ? viewingProduct.stock <= 0 : false;

  /* ══════════════════════════════════════════════════════════════════════════
     RENDU PRINCIPAL
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Hôtelio' }} />

      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>
          <FontAwesome5 name="shopping-bag" size={15} color={COLORS.primary} />{'  '}
          {isPrestataire ? t('dashboard.action_boutique') : t('boutique.ourProducts')}
        </Text>

        {!isPrestataire && (
          <View style={styles.topBarActions}>
            {/* Lien Mes commandes */}
            <TouchableOpacity
              style={styles.ordersBtn}
              onPress={() => router.push('/(tabs)/boutique/my-orders')}
            >
              <FontAwesome5 name="receipt" size={14} color={COLORS.primary} />
              <Text style={styles.ordersBtnText}>{t('dashboard.action_orders')}</Text>
            </TouchableOpacity>

            {/* Panier — badge + bouton paiement */}
            <TouchableOpacity
              style={styles.cartHeaderBtn}
              onPress={() => setShowCart(true)}
              activeOpacity={0.8}
            >
              <FontAwesome5 name="shopping-cart" size={17} color={COLORS.primary} />
              {totalItems > 0 && (
                <View style={styles.cartHeaderBadge}>
                  <Text style={styles.cartHeaderBadgeText}>{totalItems}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Onglets prestataire */}
      {isPrestataire && (
        <View style={styles.tabBar}>
          {(['tous', 'mes'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'tous' ? t('boutique.allProducts') : t('boutique.myProducts')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={filteredProducts}
        keyExtractor={p => String(p.id)}
        renderItem={renderProduct}
        contentContainerStyle={{ padding: 12, paddingBottom: (!isPrestataire && totalItems > 0) ? 90 : 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchProducts(); }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <FontAwesome5 name="shopping-bag" size={48} color={COLORS.grayLight} />
              <Text style={styles.emptyText}>{t('boutique.emptyShop')}</Text>
            </View>
          ) : null
        }
      />

      {/* FAB prestataire */}
      {isPrestataire && (
        <TouchableOpacity style={styles.fab} onPress={openCreate}>
          <FontAwesome5 name="plus" size={22} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* FAB panier client */}
      {!isPrestataire && totalItems > 0 && (
        <TouchableOpacity style={styles.cartFab} onPress={() => setShowCart(true)}>
          <FontAwesome5 name="shopping-cart" size={20} color={COLORS.white} />
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{totalItems}</Text>
          </View>
          <Text style={styles.cartTotal}>{totalPrice.toLocaleString()} {t('common.fcfa')}</Text>
          <FontAwesome5 name="chevron-up" size={12} color="rgba(255,255,255,0.7)" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
      )}

      {/* ══ MODAL DÉTAIL PRODUIT ══════════════════════════════════════════════ */}
      <Modal
        visible={!!viewingProduct}
        animationType="slide"
        transparent
        onRequestClose={() => setViewingProduct(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.detailSheet}>
            {/* En-tête */}
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle} numberOfLines={1}>
                {viewingProduct?.name}
              </Text>
              <TouchableOpacity onPress={() => setViewingProduct(null)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Image / Emoji grand format */}
              {viewingProduct?.image_url ? (
                <Image
                  source={{ uri: viewingProduct.image_url }}
                  style={styles.detailImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.detailEmojiWrap}>
                  <Text style={styles.detailEmoji}>{viewingProduct?.emoji ?? '📦'}</Text>
                </View>
              )}

              <View style={styles.detailBody}>
                {/* Catégorie + badges */}
                <View style={styles.detailTagRow}>
                  {viewingProduct?.category ? (
                    <View style={styles.detailTag}>
                      <FontAwesome5 name="tag" size={11} color={COLORS.primary} />
                      <Text style={styles.detailTagText}>{viewingProduct.category}</Text>
                    </View>
                  ) : null}
                  <View style={[
                    styles.detailTag,
                    { backgroundColor: detailOOS ? '#fef2f2' : '#f0fdf4' },
                  ]}>
                    <FontAwesome5
                      name="boxes"
                      size={11}
                      color={detailOOS ? COLORS.danger : COLORS.success}
                    />
                    <Text style={[
                      styles.detailTagText,
                      { color: detailOOS ? COLORS.danger : COLORS.success },
                    ]}>
                      {detailOOS
                        ? t('boutique.outOfStock')
                        : t('boutique.inStock', { count: viewingProduct?.stock })}
                    </Text>
                  </View>
                </View>

                {/* Prix */}
                <Text style={styles.detailPrice}>
                  {viewingProduct?.price?.toLocaleString()} FCFA
                </Text>

                {/* Description */}
                {viewingProduct?.description ? (
                  <>
                    <Text style={styles.detailSectionTitle}>{t('hotels.descSection')}</Text>
                    <Text style={styles.detailDescription}>{viewingProduct.description}</Text>
                  </>
                ) : null}

                {/* Actions panier (client uniquement) */}
                {!isPrestataire && !detailOOS && (
                  <View style={styles.detailCartRow}>
                    {detailQty === 0 ? (
                      <TouchableOpacity
                        style={styles.detailAddBtn}
                        onPress={() => { addToCart(viewingProduct!); }}
                      >
                        <FontAwesome5 name="cart-plus" size={16} color={COLORS.white} />
                        <Text style={styles.detailAddBtnText}>{t('boutique.addToCart')}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.detailQtyWrap}>
                        <TouchableOpacity
                          style={styles.detailQtyBtn}
                          onPress={() => removeFromCart(viewingProduct!)}
                        >
                          <FontAwesome5 name="minus" size={14} color={COLORS.primary} />
                        </TouchableOpacity>
                        <Text style={styles.detailQtyCount}>{detailQty}</Text>
                        <TouchableOpacity
                          style={styles.detailQtyBtn}
                          onPress={() => addToCart(viewingProduct!)}
                        >
                          <FontAwesome5 name="plus" size={14} color={COLORS.primary} />
                        </TouchableOpacity>
                        <Text style={styles.detailSubtotal}>
                          = {(viewingProduct!.price * detailQty).toLocaleString()} FCFA
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Prestataire : boutons edit/delete */}
                {isPrestataire && Number(viewingProduct?.user_id) === myId && (
                  <View style={styles.detailMgmtRow}>
                    <TouchableOpacity
                      style={styles.detailMgmtBtn}
                      onPress={() => { setViewingProduct(null); openEdit(viewingProduct!); }}
                    >
                      <FontAwesome5 name="pen" size={13} color={COLORS.primary} />
                      <Text style={[styles.detailMgmtBtnText, { color: COLORS.primary }]}>{t('common.edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.detailMgmtBtn, { backgroundColor: '#fef2f2' }]}
                      onPress={() => { setViewingProduct(null); handleDeleteProduct(viewingProduct!); }}
                    >
                      <FontAwesome5 name="trash" size={13} color={COLORS.danger} />
                      <Text style={[styles.detailMgmtBtnText, { color: COLORS.danger }]}>{t('common.delete')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ══ MODAL PANIER + PAIEMENT (client) ═════════════════════════════════ */}
      {!isPrestataire && (
        <Modal visible={showCart} transparent animationType="slide" onRequestClose={closeCart}>
          <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.cartSheet}>
              <View style={styles.cartHeader}>
                <Text style={styles.cartTitle}>{t('boutique.yourCart')}</Text>
                <TouchableOpacity onPress={closeCart}>
                  <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {products.filter(p => cart[p.id]).map(p => (
                  <View key={p.id} style={styles.cartItem}>
                    <Text style={styles.cartItemEmoji}>{p.emoji ?? '📦'}</Text>
                    <Text style={{ flex: 1, color: COLORS.dark, fontWeight: '600' }}>{p.name}</Text>
                    <Text style={{ color: COLORS.textMuted }}>{cart[p.id]}×</Text>
                    <Text style={{ color: COLORS.primary, fontWeight: '700', marginLeft: 8 }}>
                      {(p.price * cart[p.id]).toLocaleString()} FCFA
                    </Text>
                  </View>
                ))}
                <View style={styles.cartTotalRow}>
                  <Text style={styles.cartTotalLabel}>{t('reservations.total')}</Text>
                  <Text style={[styles.cartTotalLabel, { color: COLORS.primary }]}>
                    {totalPrice.toLocaleString()} FCFA
                  </Text>
                </View>
                <Text style={styles.sectionLabel}>{t('hotels.paymentMethod')}</Text>
                {PAYMENT_METHODS.map(pm => (
                  <TouchableOpacity
                    key={pm.value}
                    style={[styles.payBtn, selectedPayment === pm.value && styles.payBtnActive]}
                    onPress={() => { setSelectedPayment(pm.value); setPaymentInfo({ ...EMPTY_PAYMENT_INFO }); }}
                  >
                    <PaymentMethodIcon method={pm} size={28} />
                    <Text style={[styles.payLabel, selectedPayment === pm.value && styles.payLabelActive]}>{pm.label}</Text>
                    {selectedPayment === pm.value && (
                      <View style={styles.payCheck}>
                        <Text style={{ color: COLORS.white, fontSize: 11, fontWeight: '700' }}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
                <PaymentInfoFields method={selectedPayment} info={paymentInfo} onChange={setPaymentInfo} />
                <TouchableOpacity
                  style={[styles.orderBtn, (!selectedPayment || ordering) && { opacity: 0.6 }]}
                  onPress={handlePlaceOrder}
                  disabled={!selectedPayment || ordering}
                >
                  {ordering
                    ? <ActivityIndicator color={COLORS.white} />
                    : <>
                        <FontAwesome5 name="check-circle" size={16} color={COLORS.white} />
                        <Text style={styles.orderBtnText}>{t('common.confirm')} · {totalPrice.toLocaleString()} {t('common.fcfa')}</Text>
                      </>
                  }
                </TouchableOpacity>
                <View style={{ height: 16 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* ══ MODAL CRÉATION / ÉDITION PRODUIT (prestataire) ══════════════════ */}
      <Modal
        visible={showProductModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProductModal(false)}
      >
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.cartSheet}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>
                {editingProduct ? t('common.edit') : t('boutique.newProduct')}
              </Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <FontAwesome5 name="times" size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <Text style={styles.fieldLabel}>{t('boutique.nameLabel')}</Text>
              <TextInput style={styles.input} value={productForm.name}
                onChangeText={v => setProductForm(f => ({ ...f, name: v }))}
                placeholder={t('boutique.namePlaceholder')} placeholderTextColor={COLORS.textMuted} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{t('boutique.priceLabel')}</Text>
                  <TextInput style={styles.input} value={productForm.price}
                    onChangeText={v => setProductForm(f => ({ ...f, price: v.replace(/[^0-9]/g, '') }))}
                    placeholder="0" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{t('boutique.stockLabel')}</Text>
                  <TextInput style={styles.input} value={productForm.stock}
                    onChangeText={v => setProductForm(f => ({ ...f, stock: v.replace(/[^0-9]/g, '') }))}
                    placeholder="0" placeholderTextColor={COLORS.textMuted} keyboardType="number-pad" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.fieldLabel}>{t('hotels.categoryLabel')}</Text>
                  <TextInput style={styles.input} value={productForm.category}
                    onChangeText={v => setProductForm(f => ({ ...f, category: v }))}
                    placeholder={t('boutique.categoryPlaceholder')} placeholderTextColor={COLORS.textMuted} />
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.fieldLabel}>{t('boutique.iconLabel')}</Text>
                  <EmojiPicker
                    value={productForm.emoji}
                    onChange={v => setProductForm(f => ({ ...f, emoji: v }))}
                    placeholder="📦"
                    categories={['Shopping', 'Boissons', 'Nature']}
                    buttonSize={50}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>{t('hotels.descSection')}</Text>
              <TextInput
                style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
                value={productForm.description}
                onChangeText={v => setProductForm(f => ({ ...f, description: v }))}
                placeholder={t('boutique.descPlaceholder')}
                placeholderTextColor={COLORS.textMuted}
                multiline numberOfLines={3}
              />

              <Text style={styles.fieldLabel}>{t('boutique.imageLabel')}</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {productImage ? (
                  <Image source={{ uri: productImage.uri }} style={{ width: '100%', height: 120, borderRadius: 10 }} resizeMode="cover" />
                ) : (
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <FontAwesome5 name="camera" size={24} color={COLORS.textMuted} />
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{t('boutique.chooseImage')}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.orderBtn, saving && { opacity: 0.6 }]}
                onPress={handleSaveProduct}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.orderBtnText}>
                      {editingProduct ? t('common.save') : t('boutique.createProduct')}
                    </Text>
                }
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.background },
  topBar:              { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topBarTitle:         { fontSize: 15, fontWeight: '700', color: COLORS.dark, flex: 1 },
  topBarActions:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ordersBtn:           { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  ordersBtnText:       { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  cartHeaderBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  cartHeaderBadge:     { position: 'absolute', top: -4, right: -4, backgroundColor: COLORS.secondary, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: COLORS.white },
  cartHeaderBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },

  /* Carte produit */
  card:           { backgroundColor: COLORS.white, borderRadius: 14, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
  productImg:     { width: 72, height: 72, borderRadius: 10 },
  emojiBadge:     { width: 72, height: 72, borderRadius: 10, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  emoji:          { fontSize: 32 },
  productName:    { fontSize: 14, fontWeight: '700', color: COLORS.dark },
  category:       { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  stock:          { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  price:          { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginTop: 4 },
  descPreview:    { fontSize: 11, color: COLORS.textMuted, marginTop: 2, fontStyle: 'italic' },
  detailHint:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  detailHintText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  otherBadge:     { marginTop: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(148,163,184,.12)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(148,163,184,.2)' },
  otherBadgeText: { fontSize: 10, color: '#94a3b8', fontWeight: '600' },
  addBtn:         { backgroundColor: COLORS.primary, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  qtyRow:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn:         { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  qtyText:        { fontSize: 15, fontWeight: '700', color: COLORS.dark, minWidth: 20, textAlign: 'center' },

  /* FABs */
  fab:            { position: 'absolute', bottom: 20, right: 20, backgroundColor: COLORS.primary, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  cartFab:        { position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  cartBadge:      { backgroundColor: COLORS.secondary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  cartBadgeText:  { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  cartTotal:      { color: COLORS.white, fontSize: 14, fontWeight: '700' },

  /* Overlay + sheets */
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  cartSheet:      { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  cartHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cartTitle:      { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  cartItem:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  cartItemEmoji:  { fontSize: 20 },
  cartTotalRow:   { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 8, marginBottom: 4 },
  cartTotalLabel: { fontSize: 16, fontWeight: '700', color: COLORS.dark },
  sectionLabel:   { fontSize: 14, fontWeight: '700', color: COLORS.dark, marginTop: 18, marginBottom: 10 },
  payBtn:         { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: COLORS.border, borderRadius: 12, padding: 13, marginBottom: 8, backgroundColor: COLORS.white },
  payBtnActive:   { borderColor: COLORS.primary, backgroundColor: '#EEF2FF' },
  payIcon:        { fontSize: 20 },
  payLabel:       { flex: 1, fontSize: 14, color: COLORS.dark },
  payLabelActive: { color: COLORS.primary, fontWeight: '700' },
  payCheck:       { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  orderBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 15, marginTop: 20 },
  orderBtnText:   { color: COLORS.white, fontSize: 15, fontWeight: '700' },

  /* Formulaire produit */
  fieldLabel:     { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6, marginTop: 12 },
  input:          { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.background, fontSize: 14, color: COLORS.dark },
  imagePicker:    { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, borderStyle: 'dashed', paddingVertical: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 4, backgroundColor: COLORS.background, overflow: 'hidden' },

  /* Onglets prestataire */
  tabBar:         { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab:            { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText:        { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  tabTextActive:  { color: COLORS.primary },

  /* Empty */
  empty:          { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:      { fontSize: 16, color: COLORS.textMuted },

  /* ── Modal détail produit ─────────────────────────────────────────────── */
  detailSheet:       { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  detailHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailTitle:       { fontSize: 16, fontWeight: '700', color: COLORS.dark, flex: 1, marginRight: 12 },
  detailImage:       { width: '100%', height: 220 },
  detailEmojiWrap:   { height: 160, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  detailEmoji:       { fontSize: 72 },
  detailBody:        { padding: 18, gap: 8 },
  detailTagRow:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  detailTag:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EEF2FF', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  detailTagText:     { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  detailPrice:       { fontSize: 26, fontWeight: '800', color: COLORS.primary },
  detailSectionTitle:{ fontSize: 13, fontWeight: '700', color: COLORS.dark, marginTop: 8 },
  detailDescription: { fontSize: 14, color: COLORS.textMuted, lineHeight: 21 },
  detailCartRow:     { marginTop: 16 },
  detailAddBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14 },
  detailAddBtnText:  { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  detailQtyWrap:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.background, borderRadius: 12, padding: 12 },
  detailQtyBtn:      { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  detailQtyCount:    { fontSize: 20, fontWeight: '800', color: COLORS.dark, minWidth: 30, textAlign: 'center' },
  detailSubtotal:    { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginLeft: 'auto' },
  detailMgmtRow:     { flexDirection: 'row', gap: 10, marginTop: 16 },
  detailMgmtBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#EEF2FF', borderRadius: 10, paddingVertical: 11 },
  detailMgmtBtnText: { fontSize: 13, fontWeight: '600' },
});
