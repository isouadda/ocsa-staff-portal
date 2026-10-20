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
    // When the checklist day turns on that clock, HH:MM, the API's
    // helpers/checklistDay.js day start. A block's window is read from
    // it, so 1:00 AM work belongs to the night that comes after it. Since
    // part 369 the day start GET /api/settings answers
    // (checklistDayStartsAt) is read in its place, and kept on the phone;
    // this one counts only until the API has answered once.
    checklistDayStartsAt: '04:00',
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
