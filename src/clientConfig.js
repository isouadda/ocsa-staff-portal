const clientConfig = {
  company: {
    name: 'OCSA Cleaning Inc.',
    shortName: 'OCSA Cleaning',
    brandTag: 'OCSA',
    // The app's name on a home screen, the same as public/manifest.json
    // and the apple-mobile-web-app-title in public/index.html.
    appName: 'OCSA Staff',
    location: 'Philadelphia, PA',
    confidentialLabel: 'Confidential Record',
    footerLine: 'OCSA Cleaning Inc. | Philadelphia, PA | Confidential Record',
    // The company's own clock, which says what today and yesterday are
    // when the checklist says who did something and when.
    timeZone: 'America/New_York',
  },
  brand: {
    navy: '#0A1628',
    gold: '#E7B017',
    navyDark: '#0F1D32',
    blueDeep: '#0D2C93',
    blueBright: '#0030B4',
    goldMid: '#B27916',
    panelLight: '#15558F',
  },
  employee: {
    idPrefix: 'OCSA',
  },
};

export default clientConfig;
