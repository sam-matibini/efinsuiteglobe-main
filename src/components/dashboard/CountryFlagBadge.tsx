import { useCurrentOrganization } from '@/hooks/useOrganization';
import { useCountryScope } from '@/hooks/useCountryFilter';
import { getCountryLocalization } from '@/data/countryLocalizations';

// SVG Flag components for consistent cross-platform rendering
const FlagCA = () => (
  <svg viewBox="0 0 640 480" className="w-7 h-5 rounded-sm shadow-sm">
    <path fill="#fff" d="M150 0h340v480H150z"/>
    <path fill="#d52b1e" d="M0 0h150v480H0zm490 0h150v480H490zM205 232l30-15-30-15h40l-20-40 20 10 10-55 10 55 20-10-20 40h40l-30 15 30 15h-40l20 40-20-10-10 55-10-55-20 10 20-40z"/>
  </svg>
);

const FlagUS = () => (
  <svg viewBox="0 0 640 480" className="w-7 h-5 rounded-sm shadow-sm">
    <path fill="#bd3d44" d="M0 0h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640z"/>
    <path fill="#fff" d="M0 37h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640zm0 74h640v37h-640z"/>
    <path fill="#192f5d" d="M0 0h260v259H0z"/>
    <g fill="#fff">
      {[...Array(9)].map((_, row) => (
        [...Array(row % 2 === 0 ? 6 : 5)].map((_, col) => (
          <circle key={`${row}-${col}`} cx={22 + col * 43 + (row % 2 === 0 ? 0 : 21)} cy={15 + row * 28} r="8"/>
        ))
      )).flat()}
    </g>
  </svg>
);

const FlagZM = () => (
  <svg viewBox="0 0 640 480" className="w-7 h-5 rounded-sm shadow-sm">
    <path fill="#198a00" d="M0 0h640v480H0z"/>
    <g fill="none">
      <path fill="#ef7d00" d="M480 240h160v240H480z"/>
      <path fill="#000" d="M533 240h54v240h-54z"/>
      <path fill="#de2010" d="M480 240h53v240h-53z"/>
    </g>
    <path fill="#ef7d00" d="M560 60c-20 0-35 15-35 35 0 15 8 27 20 33v32h30v-32c12-6 20-18 20-33 0-20-15-35-35-35z"/>
  </svg>
);

const FlagKE = () => (
  <svg viewBox="0 0 640 480" className="w-7 h-5 rounded-sm shadow-sm">
    <path fill="#fff" d="M0 0h640v480H0z"/>
    <path fill="#000" d="M0 0h640v144H0z"/>
    <path fill="#060" d="M0 336h640v144H0z"/>
    <path fill="#a00" d="M0 168h640v144H0z"/>
    <g transform="translate(320 240)">
      <ellipse fill="#fff" rx="80" ry="120"/>
      <ellipse fill="#a00" rx="60" ry="100"/>
      <ellipse fill="#000" rx="40" ry="80"/>
    </g>
  </svg>
);

const FlagBI = () => (
  <svg viewBox="0 0 640 480" className="w-7 h-5 rounded-sm shadow-sm">
    <path fill="#fff" d="M0 0h640v480H0z"/>
    <path fill="#1eb53a" d="M0 0h640L320 240 0 0zm0 480h640L320 240 0 480z"/>
    <path fill="#ce1126" d="M0 0v480L320 240 0 0zm640 0v480L320 240 640 0z"/>
    <circle fill="#fff" cx="320" cy="240" r="80" stroke="#1eb53a" strokeWidth="3"/>
    <g fill="#ce1126">
      <path d="M320 185l5 15h15l-12 9 5 15-13-10-13 10 5-15-12-9h15z"/>
      <path d="M270 225l5 15h15l-12 9 5 15-13-10-13 10 5-15-12-9h15z"/>
      <path d="M370 225l5 15h15l-12 9 5 15-13-10-13 10 5-15-12-9h15z"/>
    </g>
  </svg>
);

// Get the flag component for a country code
const getFlag = (countryCode: string) => {
  const flags: Record<string, React.ReactNode> = {
    CA: <FlagCA />,
    US: <FlagUS />,
    ZM: <FlagZM />,
    KE: <FlagKE />,
    BI: <FlagBI />,
  };
  return flags[countryCode] || <FlagCA />;
};

export function CountryFlagBadge() {
  const { organization } = useCurrentOrganization();
  const { country: scopedCountry } = useCountryScope();

  // Country scope wins over the organization's own country so this badge
  // reflects the D365-style top-left selector immediately.
  const countryString = scopedCountry || organization?.country || '';
  
  // Map common country names/codes to ISO codes
  const getCountryCode = (country: string): string => {
    const upperCountry = country.toUpperCase().trim();
    const countryMap: Record<string, string> = {
      'CANADA': 'CA',
      'CA': 'CA',
      'CAN': 'CA',
      'UNITED STATES': 'US',
      'USA': 'US',
      'US': 'US',
      'NIGERIA': 'NG',
      'NG': 'NG',
      'NGA': 'NG',
      'UNITED KINGDOM': 'GB',
      'GREAT BRITAIN': 'GB',
      'ENGLAND': 'GB',
      'UK': 'GB',
      'GB': 'GB',
      'ZAMBIA': 'ZM',
      'ZM': 'ZM',
      'ZMB': 'ZM',
      'KENYA': 'KE',
      'KE': 'KE',
      'KEN': 'KE',
      'BURUNDI': 'BI',
      'BI': 'BI',
      'BDI': 'BI',
    };
    return countryMap[upperCountry] || 'CA';
  };

  const countryCode = getCountryCode(countryString);
  const localization = getCountryLocalization(countryCode);

  if (!organization && !scopedCountry) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50">
      <div role="img" aria-label={`${localization.name} flag`}>
        {getFlag(countryCode)}
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-medium text-foreground">{localization.name}</span>
        <span className="text-[10px] text-muted-foreground">{localization.currency}</span>
      </div>
    </div>
  );
}
