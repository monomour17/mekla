// Uygulama genelinde kullanılan tipografi sabitleri.
// V1: sistem fontu (iOS: SF Pro, Android: Roboto) — özel font yüklenmez,
// açılışta font beklemesi yoktur. İleride marka fontuna geçilirse buradaki
// değerler fontFamily'ye çevrilerek TYPE kullanıcıları tek noktadan güncellenir.

export const WEIGHTS = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
  extraBold: '800',
};

// Hazır tipografi stilleri — import edip spread et: { ...TYPE.h1 }
export const TYPE = {
  h1: { fontWeight: WEIGHTS.extraBold, fontSize: 28, letterSpacing: -0.5 },
  h2: { fontWeight: WEIGHTS.bold, fontSize: 22, letterSpacing: -0.3 },
  h3: { fontWeight: WEIGHTS.bold, fontSize: 18 },
  h4: { fontWeight: WEIGHTS.semiBold, fontSize: 16 },
  body: { fontWeight: WEIGHTS.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontWeight: WEIGHTS.medium, fontSize: 15 },
  caption: { fontWeight: WEIGHTS.medium, fontSize: 13 },
  label: { fontWeight: WEIGHTS.semiBold, fontSize: 12, letterSpacing: 0.2 },
  micro: { fontWeight: WEIGHTS.medium, fontSize: 11 },
  btn: { fontWeight: WEIGHTS.bold, fontSize: 15 },
  btnLarge: { fontWeight: WEIGHTS.bold, fontSize: 16 },
};
