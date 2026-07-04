/** ISO / FIFA team name → flag emoji for WC 2026 corner model UI. */

const UK_SUBDIVISION_FLAGS = {
  England: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  Scotland: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  Wales: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}',
  'Northern Ireland': '\u{1F3F4}\u{E0067}\u{E0062}\u{E006E}\u{E0069}\u{E0072}\u{E007F}',
};

/** Canonical dashboard team name → ISO 3166-1 alpha-2 (or explicit flag above). */
export const WC_TEAM_ISO = {
  Switzerland: 'CH',
  Canada: 'CA',
  Qatar: 'QA',
  Croatia: 'HR',
  Bosnia: 'BA',
  'Bosnia and Herzegovina': 'BA',
  England: 'GB',
  Ghana: 'GH',
  Panama: 'PA',
  Colombia: 'CO',
  'DR Congo': 'CD',
  Morocco: 'MA',
  Haiti: 'HT',
  Scotland: 'GB',
  Brazil: 'BR',
  Czechia: 'CZ',
  Mexico: 'MX',
  'South Africa': 'ZA',
  'South Korea': 'KR',
  Austria: 'AT',
  'Ivory Coast': 'CI',
  Australia: 'AU',
  Belgium: 'BE',
  USA: 'US',
  'United States': 'US',
  Argentina: 'AR',
  Spain: 'ES',
  France: 'FR',
  Portugal: 'PT',
  Germany: 'DE',
  Norway: 'NO',
  Netherlands: 'NL',
  Japan: 'JP',
  Senegal: 'SN',
  Uruguay: 'UY',
  Ecuador: 'EC',
  Paraguay: 'PY',
  Turkiye: 'TR',
  Turkey: 'TR',
  Algeria: 'DZ',
  Iran: 'IR',
  Egypt: 'EG',
  Sweden: 'SE',
  Uzbekistan: 'UZ',
  Jordan: 'JO',
  Iraq: 'IQ',
  'Saudi Arabia': 'SA',
  'Cabo Verde': 'CV',
  'Cape Verde': 'CV',
  'New Zealand': 'NZ',
  Tunisia: 'TN',
  Curacao: 'CW',
  Curaçao: 'CW',
  Iceland: 'IS',
  Ireland: 'IE',
  'El Salvador': 'SV',
  Syria: 'SY',
  Montenegro: 'ME',
  Slovenia: 'SI',
  Burundi: 'BI',
  Peru: 'PE',
  Madagascar: 'MG',
  Bolivia: 'BO',
  'Costa Rica': 'CR',
  Albania: 'AL',
  Wales: 'GB',
  Chile: 'CL',
  Denmark: 'DK',
  Jamaica: 'JM',
  Bermuda: 'BM',
  Italy: 'IT',
  'Dominican Republic': 'DO',
  'North Macedonia': 'MK',
  Serbia: 'RS',
  Kosovo: 'XK',
  Guatemala: 'GT',
  Nicaragua: 'NI',
  'Trinidad & Tobago': 'TT',
  Finland: 'FI',
  China: 'CN',
  Ukraine: 'UA',
  Poland: 'PL',
  Greece: 'GR',
  Romania: 'RO',
  Venezuela: 'VE',
  Cameroon: 'CM',
  Russia: 'RU',
  Nigeria: 'NG',
  'Northern Ireland': 'GB',
  Mali: 'ML',
  Gambia: 'GM',
  Kazakhstan: 'KZ',
  Sudan: 'SD',
  'Puerto Rico': 'PR',
  Andorra: 'AD',
  Liechtenstein: 'LI',
  Hungary: 'HU',
  Slovakia: 'SK',
  Georgia: 'GE',
  Israel: 'IL',
  Honduras: 'HN',
};

const TEAM_ALIASES = {
  'cape verde': 'Cabo Verde',
  'united states': 'USA',
  'côte d\'ivoire': 'Ivory Coast',
  "cote d'ivoire": 'Ivory Coast',
  'czech republic': 'Czechia',
  'turkey': 'Turkiye',
  'bosnia and herzegovina': 'Bosnia',
  'trinidad and tobago': 'Trinidad & Tobago',
};

export function isoToFlag(iso) {
  if (!iso || iso.length !== 2) return '';
  const upper = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '';
  return String.fromCodePoint(
    ...[...upper].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65)
  );
}

export function normalizeTeamNameForFlag(name) {
  if (!name) return '';
  const trimmed = String(name).trim();
  if (WC_TEAM_ISO[trimmed] || UK_SUBDIVISION_FLAGS[trimmed]) return trimmed;
  const alias = TEAM_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  const ci = Object.keys(WC_TEAM_ISO).find(
    (key) => key.toLowerCase() === trimmed.toLowerCase()
  );
  return ci || trimmed;
}

export function getTeamFlag(teamName) {
  const canonical = normalizeTeamNameForFlag(teamName);
  if (UK_SUBDIVISION_FLAGS[canonical]) {
    return UK_SUBDIVISION_FLAGS[canonical];
  }
  const iso = WC_TEAM_ISO[canonical];
  return iso ? isoToFlag(iso) : '';
}

export function formatTeamLabel(teamName) {
  const flag = getTeamFlag(teamName);
  if (!flag) return teamName || '';
  return `${flag} ${teamName}`;
}

/** "England/Panama" or "England vs Panama" → flagged label string. */
export function formatMatchLabel(match, separator = ' vs ') {
  if (!match) return '';
  const slashParts = String(match).split('/').map((s) => s.trim()).filter(Boolean);
  if (slashParts.length === 2) {
    return `${formatTeamLabel(slashParts[0])} / ${formatTeamLabel(slashParts[1])}`;
  }
  const vsMatch = String(match).match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (vsMatch) {
    return `${formatTeamLabel(vsMatch[1].trim())}${separator}${formatTeamLabel(vsMatch[2].trim())}`;
  }
  return match;
}
