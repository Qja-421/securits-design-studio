// =====================================================================
// Brand theme system for Securits Design Studio
// Each electrical component brand has its own visual identity,
// reference naming, and color palette. This file centralizes them so
// the canvas, library, and properties panel can stay in sync.
// =====================================================================

export type BrandId =
  | 'legrand'
  | 'schneider'
  | 'hager'
  | 'abb'
  | 'telemecanique'
  | 'generic';

export interface BrandTheme {
  id: BrandId;
  /** Short display name (e.g. on the breaker front plate) */
  shortName: string;
  /** Full display name (e.g. on the library card) */
  fullName: string;
  /** Origin country, used in tooltips/library subtitles */
  country: string;
  /** Two-stop gradient for the breaker plastic body */
  bodyGradient: [string, string];
  /** Subtle bottom shadow on the body */
  bodyShadow: string;
  /** Top brand band color (Legrand red, Schneider green, etc.) */
  brandStripeColor: string;
  /** Text color for the brand stripe / label */
  brandLabelColor: string;
  /** Reference prefix printed under the brand name (e.g. DX³, Acti9) */
  referencePrefix: string;
  /** Reference family by component type */
  referenceByType: {
    general_protection: string;
    differential: string;
    breaker: string;
    distribution: string;
    load: string;
  };
  /** Front plate color (inner faceplate) */
  frontPlateGradient: [string, string];
  /** Accent color for the rocker switch ON state */
  rockerOnColor: [string, string];
  /** Accent color for the rocker switch OFF state */
  rockerOffColor: [string, string];
}

export const BRAND_THEMES: Record<BrandId, BrandTheme> = {
  legrand: {
    id: 'legrand',
    shortName: 'Legrand',
    fullName: 'Legrand',
    country: 'France',
    bodyGradient: ['#f5f5f3', '#e5e5e0'],
    bodyShadow: '#bcbcb4',
    brandStripeColor: '#8B1E3F', // bordeaux (Legrand red)
    brandLabelColor: '#8B1E3F',
    referencePrefix: 'DX³',
    referenceByType: {
      general_protection: 'VISTOP',
      differential: 'DX³-ID',
      breaker: 'DX³-DN',
      distribution: 'DX³',
      load: 'DX³'
    },
    frontPlateGradient: ['#ffffff', '#f9f9f6'],
    rockerOnColor: ['#ef4444', '#991b1b'],
    rockerOffColor: ['#6b7280', '#374151']
  },
  schneider: {
    id: 'schneider',
    shortName: 'Schneider',
    fullName: 'Schneider Electric',
    country: 'France',
    bodyGradient: ['#f8f8f6', '#ececea'],
    bodyShadow: '#c5c5c0',
    brandStripeColor: '#3DCD58', // Schneider signature green
    brandLabelColor: '#3DCD58',
    referencePrefix: 'Acti9',
    referenceByType: {
      general_protection: 'iSW',
      differential: 'iID',
      breaker: 'iC60',
      distribution: 'iC60',
      load: 'iC60'
    },
    frontPlateGradient: ['#ffffff', '#f4f4f1'],
    rockerOnColor: ['#3DCD58', '#1f7a32'],
    rockerOffColor: ['#6b7280', '#374151']
  },
  hager: {
    id: 'hager',
    shortName: 'Hager',
    fullName: 'Hager',
    country: 'France / Allemagne',
    bodyGradient: ['#fafaf8', '#ededea'],
    bodyShadow: '#c0c0bb',
    brandStripeColor: '#F7941D', // Hager orange (matches brand-blue/orange scheme)
    brandLabelColor: '#003B7E', // Hager deep blue
    referencePrefix: 'HTN',
    referenceByType: {
      general_protection: 'HNB',
      differential: 'HFD',
      breaker: 'HTN',
      distribution: 'HTN',
      load: 'HTN'
    },
    frontPlateGradient: ['#ffffff', '#f6f6f2'],
    rockerOnColor: ['#F7941D', '#b35d00'],
    rockerOffColor: ['#6b7280', '#374151']
  },
  abb: {
    id: 'abb',
    shortName: 'ABB',
    fullName: 'ABB',
    country: 'Suisse / Suède',
    bodyGradient: ['#f4f4f2', '#e0e0dd'],
    bodyShadow: '#b8b8b3',
    brandStripeColor: '#FF002F', // ABB signature red
    brandLabelColor: '#FF002F',
    referencePrefix: 'System pro M',
    referenceByType: {
      general_protection: 'SHD',
      differential: 'F202',
      breaker: 'S200',
      distribution: 'S200',
      load: 'S200'
    },
    frontPlateGradient: ['#ffffff', '#f5f5f2'],
    rockerOnColor: ['#FF002F', '#99001f'],
    rockerOffColor: ['#6b7280', '#374151']
  },
  telemecanique: {
    id: 'telemecanique',
    shortName: 'Télémécanique',
    fullName: 'Télémécanique (Schneider)',
    country: 'France',
    bodyGradient: ['#f6f6f3', '#e8e8e4'],
    bodyShadow: '#bcbcb6',
    brandStripeColor: '#00A39A', // Telemecanique teal
    brandLabelColor: '#00A39A',
    referencePrefix: 'Acti9',
    referenceByType: {
      general_protection: 'iSW',
      differential: 'iID',
      breaker: 'iC60',
      distribution: 'iC60',
      load: 'iC60'
    },
    frontPlateGradient: ['#ffffff', '#f5f5f2'],
    rockerOnColor: ['#00A39A', '#006b65'],
    rockerOffColor: ['#6b7280', '#374151']
  },
  generic: {
    id: 'generic',
    shortName: 'Securits',
    fullName: 'Securits (générique)',
    country: '—',
    bodyGradient: ['#f5f5f3', '#e5e5e0'],
    bodyShadow: '#bcbcb4',
    brandStripeColor: '#29ABE2',
    brandLabelColor: '#29ABE2',
    referencePrefix: 'STD',
    referenceByType: {
      general_protection: 'GMC',
      differential: 'GMD',
      breaker: 'GMB',
      distribution: 'GMD',
      load: 'GML'
    },
    frontPlateGradient: ['#ffffff', '#f9f9f6'],
    rockerOnColor: ['#29ABE2', '#1a6f9c'],
    rockerOffColor: ['#6b7280', '#374151']
  }
};

export const BRAND_LIST: BrandTheme[] = [
  BRAND_THEMES.legrand,
  BRAND_THEMES.schneider,
  BRAND_THEMES.hager,
  BRAND_THEMES.abb,
  BRAND_THEMES.telemecanique,
  BRAND_THEMES.generic
];

/** Resolve a brand id, falling back to legrand for unknown values. */
export const resolveBrand = (id: string | undefined | null): BrandTheme => {
  if (id && id in BRAND_THEMES) {
    return BRAND_THEMES[id as BrandId];
  }
  return BRAND_THEMES.legrand;
};
