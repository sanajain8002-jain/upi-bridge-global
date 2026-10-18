// World coverage data for the prototype. EVERYTHING HERE IS ILLUSTRATIVE SAMPLE DATA.
// - Country list: ISO 3166 sovereign states (India is the sender, so it is not a destination).
// - SAMPLE_PER_USD: rough, hand-entered sample rates (units of currency per 1 USD). Not live market rates.
//   They are converted to "per 1 INR" in config.js and are editable by the demo admin.

// code|name|currency|region
const COUNTRY_TABLE = `
NP|Nepal|NPR|South Asia
BD|Bangladesh|BDT|South Asia
LK|Sri Lanka|LKR|South Asia
BT|Bhutan|BTN|South Asia
MV|Maldives|MVR|South Asia
PK|Pakistan|PKR|South Asia
AF|Afghanistan|AFN|South Asia
AE|United Arab Emirates|AED|Middle East
SA|Saudi Arabia|SAR|Middle East
QA|Qatar|QAR|Middle East
KW|Kuwait|KWD|Middle East
BH|Bahrain|BHD|Middle East
OM|Oman|OMR|Middle East
JO|Jordan|JOD|Middle East
IL|Israel|ILS|Middle East
TR|Türkiye|TRY|Middle East
IQ|Iraq|IQD|Middle East
LB|Lebanon|LBP|Middle East
YE|Yemen|YER|Middle East
IR|Iran|IRR|Middle East
SY|Syria|SYP|Middle East
SG|Singapore|SGD|Asia-Pacific
MY|Malaysia|MYR|Asia-Pacific
TH|Thailand|THB|Asia-Pacific
PH|Philippines|PHP|Asia-Pacific
ID|Indonesia|IDR|Asia-Pacific
VN|Vietnam|VND|Asia-Pacific
JP|Japan|JPY|Asia-Pacific
KR|South Korea|KRW|Asia-Pacific
CN|China|CNY|Asia-Pacific
HK|Hong Kong|HKD|Asia-Pacific
TW|Taiwan|TWD|Asia-Pacific
MM|Myanmar|MMK|Asia-Pacific
KH|Cambodia|KHR|Asia-Pacific
LA|Laos|LAK|Asia-Pacific
BN|Brunei|BND|Asia-Pacific
TL|Timor-Leste|USD|Asia-Pacific
MN|Mongolia|MNT|Asia-Pacific
KZ|Kazakhstan|KZT|Asia-Pacific
UZ|Uzbekistan|UZS|Asia-Pacific
KG|Kyrgyzstan|KGS|Asia-Pacific
TJ|Tajikistan|TJS|Asia-Pacific
TM|Turkmenistan|TMT|Asia-Pacific
KP|North Korea|KPW|Asia-Pacific
AU|Australia|AUD|Oceania
NZ|New Zealand|NZD|Oceania
FJ|Fiji|FJD|Oceania
PG|Papua New Guinea|PGK|Oceania
WS|Samoa|WST|Oceania
TO|Tonga|TOP|Oceania
VU|Vanuatu|VUV|Oceania
SB|Solomon Islands|SBD|Oceania
KI|Kiribati|AUD|Oceania
TV|Tuvalu|AUD|Oceania
NR|Nauru|AUD|Oceania
FM|Micronesia|USD|Oceania
MH|Marshall Islands|USD|Oceania
PW|Palau|USD|Oceania
GB|United Kingdom|GBP|Europe
DE|Germany|EUR|Europe
FR|France|EUR|Europe
IT|Italy|EUR|Europe
ES|Spain|EUR|Europe
NL|Netherlands|EUR|Europe
BE|Belgium|EUR|Europe
AT|Austria|EUR|Europe
PT|Portugal|EUR|Europe
IE|Ireland|EUR|Europe
FI|Finland|EUR|Europe
GR|Greece|EUR|Europe
LU|Luxembourg|EUR|Europe
SK|Slovakia|EUR|Europe
SI|Slovenia|EUR|Europe
EE|Estonia|EUR|Europe
LV|Latvia|EUR|Europe
LT|Lithuania|EUR|Europe
MT|Malta|EUR|Europe
CY|Cyprus|EUR|Europe
HR|Croatia|EUR|Europe
BG|Bulgaria|EUR|Europe
ME|Montenegro|EUR|Europe
MC|Monaco|EUR|Europe
SM|San Marino|EUR|Europe
AD|Andorra|EUR|Europe
CH|Switzerland|CHF|Europe
LI|Liechtenstein|CHF|Europe
SE|Sweden|SEK|Europe
NO|Norway|NOK|Europe
DK|Denmark|DKK|Europe
IS|Iceland|ISK|Europe
PL|Poland|PLN|Europe
CZ|Czechia|CZK|Europe
HU|Hungary|HUF|Europe
RO|Romania|RON|Europe
RS|Serbia|RSD|Europe
BA|Bosnia and Herzegovina|BAM|Europe
AL|Albania|ALL|Europe
MK|North Macedonia|MKD|Europe
MD|Moldova|MDL|Europe
UA|Ukraine|UAH|Europe
BY|Belarus|BYN|Europe
RU|Russia|RUB|Europe
GE|Georgia|GEL|Europe
AM|Armenia|AMD|Europe
AZ|Azerbaijan|AZN|Europe
US|United States|USD|Americas
CA|Canada|CAD|Americas
MX|Mexico|MXN|Americas
BR|Brazil|BRL|Americas
AR|Argentina|ARS|Americas
CL|Chile|CLP|Americas
CO|Colombia|COP|Americas
PE|Peru|PEN|Americas
UY|Uruguay|UYU|Americas
PY|Paraguay|PYG|Americas
BO|Bolivia|BOB|Americas
EC|Ecuador|USD|Americas
VE|Venezuela|VES|Americas
GY|Guyana|GYD|Americas
SR|Suriname|SRD|Americas
CR|Costa Rica|CRC|Americas
PA|Panama|PAB|Americas
GT|Guatemala|GTQ|Americas
HN|Honduras|HNL|Americas
NI|Nicaragua|NIO|Americas
SV|El Salvador|USD|Americas
BZ|Belize|BZD|Americas
CU|Cuba|CUP|Americas
DO|Dominican Republic|DOP|Americas
HT|Haiti|HTG|Americas
JM|Jamaica|JMD|Americas
TT|Trinidad and Tobago|TTD|Americas
BS|Bahamas|BSD|Americas
BB|Barbados|BBD|Americas
AG|Antigua and Barbuda|XCD|Americas
DM|Dominica|XCD|Americas
GD|Grenada|XCD|Americas
KN|Saint Kitts and Nevis|XCD|Americas
LC|Saint Lucia|XCD|Americas
VC|Saint Vincent and the Grenadines|XCD|Americas
NG|Nigeria|NGN|Africa
KE|Kenya|KES|Africa
ZA|South Africa|ZAR|Africa
EG|Egypt|EGP|Africa
GH|Ghana|GHS|Africa
ET|Ethiopia|ETB|Africa
TZ|Tanzania|TZS|Africa
UG|Uganda|UGX|Africa
RW|Rwanda|RWF|Africa
MA|Morocco|MAD|Africa
DZ|Algeria|DZD|Africa
TN|Tunisia|TND|Africa
LY|Libya|LYD|Africa
SD|Sudan|SDG|Africa
SS|South Sudan|SSP|Africa
SN|Senegal|XOF|Africa
CI|Côte d'Ivoire|XOF|Africa
ML|Mali|XOF|Africa
BF|Burkina Faso|XOF|Africa
NE|Niger|XOF|Africa
TG|Togo|XOF|Africa
BJ|Benin|XOF|Africa
GW|Guinea-Bissau|XOF|Africa
CM|Cameroon|XAF|Africa
GA|Gabon|XAF|Africa
CG|Republic of the Congo|XAF|Africa
TD|Chad|XAF|Africa
CF|Central African Republic|XAF|Africa
GQ|Equatorial Guinea|XAF|Africa
CD|DR Congo|CDF|Africa
ZM|Zambia|ZMW|Africa
ZW|Zimbabwe|ZWG|Africa
MZ|Mozambique|MZN|Africa
AO|Angola|AOA|Africa
NA|Namibia|NAD|Africa
BW|Botswana|BWP|Africa
MW|Malawi|MWK|Africa
MG|Madagascar|MGA|Africa
MU|Mauritius|MUR|Africa
SC|Seychelles|SCR|Africa
LR|Liberia|LRD|Africa
SL|Sierra Leone|SLE|Africa
GM|Gambia|GMD|Africa
GN|Guinea|GNF|Africa
MR|Mauritania|MRU|Africa
CV|Cape Verde|CVE|Africa
ST|São Tomé and Príncipe|STN|Africa
KM|Comoros|KMF|Africa
DJ|Djibouti|DJF|Africa
ER|Eritrea|ERN|Africa
SO|Somalia|SOS|Africa
BI|Burundi|BIF|Africa
LS|Lesotho|LSL|Africa
SZ|Eswatini|SZL|Africa
`;

// Sample units of currency per 1 USD (illustrative only).
export const SAMPLE_PER_USD = {
  AFN: 70, ALL: 93, AMD: 390, AOA: 912, ARS: 1000, AUD: 1.52, AZN: 1.7, BAM: 1.8, BBD: 2, BDT: 120, BHD: 0.376,
  BIF: 2900, BND: 1.33, BOB: 6.9, BRL: 5.4, BSD: 1, BWP: 13.6, BYN: 3.3, BZD: 2, CDF: 2850, CHF: 0.88,
  CLP: 940, CNY: 7.2, COP: 4100, CRC: 510, CUP: 24, CVE: 101, CZK: 23.5, DJF: 178, DKK: 6.9, DOP: 60,
  DZD: 134, EGP: 49, ERN: 15, ETB: 120, FJD: 2.25, GEL: 2.7, GHS: 15, GMD: 70, GNF: 8600, GTQ: 7.7,
  GYD: 209, HKD: 7.8, HNL: 25, HTG: 131, HUF: 365, ILS: 3.7, IQD: 1310, IRR: 42000, ISK: 138, JMD: 157, JOD: 0.709,
  KGS: 85, KHR: 4100, KMF: 450, KPW: 900, KRW: 1350, KZT: 480, LAK: 22000, LBP: 89500, LRD: 190, LSL: 18,
  LYD: 4.8, MAD: 9.8, MDL: 17.8, MGA: 4500, MKD: 57, MMK: 2100, MNT: 3400, MRU: 40, MVR: 15.4, MWK: 1750,
  MZN: 64, NAD: 18, NIO: 36.8, NOK: 10.8, NZD: 1.65, OMR: 0.385, PAB: 1, PEN: 3.75, PGK: 3.9, PKR: 280,
  PLN: 4, PYG: 7800, RON: 4.6, RSD: 108, RUB: 92, SBD: 8.4, SCR: 14, SDG: 600, SEK: 10.5, TZS: 2700, RWF: 1380, MUR: 45, SLE: 22.7, SOS: 570,
  SRD: 33, SSP: 4500, STN: 22.5, SYP: 13000, SZL: 18, TJS: 10.6, TMT: 3.5, TND: 3.1, TOP: 2.35, TRY: 34,
  TTD: 6.8, TWD: 32, UAH: 41, UGX: 3700, UYU: 41, UZS: 12800, VES: 45, VND: 25400, VUV: 119, WST: 2.7,
  XAF: 600, XCD: 2.7, XOF: 600, YER: 250, ZMW: 27, ZWG: 26,
};

// Corridors this demo treats as blocked (comprehensively sanctioned jurisdictions). Illustrative only:
// a real regulated partner would apply its own, current, legally-reviewed lists per corridor.
export const RESTRICTED = {
  CU: 'Comprehensive sanctions regime',
  IR: 'Comprehensive sanctions regime',
  KP: 'Comprehensive sanctions regime',
  SY: 'Comprehensive sanctions regime',
};

const flagEmoji = (code) => String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));

export function buildWorldCountries(featured = ['NP', 'BD', 'LK', 'BT']) {
  return COUNTRY_TABLE.trim().split('\n').map((line) => {
    const [code, name, currency, region] = line.split('|');
    const c = { code, name, currency, flag: flagEmoji(code), region };
    if (featured.includes(code)) c.featured = true;
    if (RESTRICTED[code]) { c.restricted = true; c.restrictedReason = RESTRICTED[code]; }
    return c;
  });
}
