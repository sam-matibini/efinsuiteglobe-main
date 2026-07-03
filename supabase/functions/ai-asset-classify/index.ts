import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClassificationRequest {
  name: string;
  description?: string;
  acquisition_cost?: number;
}

interface ClassificationResponse {
  cca_class: string;
  cca_rate: number;
  useful_life_months: number;
  depreciation_method: string;
  confidence: number;
  reasoning: string;
}

// CCA class definitions with keywords for matching
const CCA_CLASSES = [
  { class_number: '1', rate: 4, keywords: ['building', 'structure', 'warehouse', 'office building'], useful_life: 300 },
  { class_number: '8', rate: 20, keywords: ['furniture', 'fixture', 'desk', 'chair', 'cabinet', 'equipment', 'appliance'], useful_life: 60 },
  { class_number: '10', rate: 30, keywords: ['vehicle', 'car', 'truck', 'van', 'automobile', 'trailer'], useful_life: 60 },
  { class_number: '10.1', rate: 30, keywords: ['luxury vehicle', 'passenger vehicle'], useful_life: 60 },
  { class_number: '12', rate: 100, keywords: ['tool', 'small tool', 'medical instrument', 'software', 'program'], useful_life: 12 },
  { class_number: '13', rate: 0, keywords: ['leasehold', 'improvement', 'renovation', 'tenant'], useful_life: 60 },
  { class_number: '45', rate: 45, keywords: ['computer', 'laptop', 'server', 'hardware', 'pc', 'workstation'], useful_life: 36 },
  { class_number: '50', rate: 55, keywords: ['computer equipment', 'data processing', 'electronic'], useful_life: 36 },
  { class_number: '43', rate: 30, keywords: ['manufacturing', 'production', 'machinery', 'industrial'], useful_life: 120 },
  { class_number: '53', rate: 50, keywords: ['manufacturing equipment', 'factory equipment'], useful_life: 60 },
  { class_number: '54', rate: 30, keywords: ['zero emission', 'electric vehicle', 'ev', 'hybrid'], useful_life: 60 },
  { class_number: '55', rate: 100, keywords: ['zero-emission', 'fully electric'], useful_life: 60 },
];

function classifyAsset(name: string, description: string = ''): ClassificationResponse {
  const searchText = `${name} ${description}`.toLowerCase();
  
  let bestMatch = CCA_CLASSES[1]; // Default to Class 8 (general equipment)
  let highestScore = 0;
  
  for (const ccaClass of CCA_CLASSES) {
    let score = 0;
    for (const keyword of ccaClass.keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        score += 1;
        // Bonus for exact word match
        if (searchText.split(/\s+/).includes(keyword.toLowerCase())) {
          score += 0.5;
        }
      }
    }
    
    if (score > highestScore) {
      highestScore = score;
      bestMatch = ccaClass;
    }
  }
  
  const confidence = Math.min(0.95, 0.5 + (highestScore * 0.15));
  
  return {
    cca_class: bestMatch.class_number,
    cca_rate: bestMatch.rate,
    useful_life_months: bestMatch.useful_life,
    depreciation_method: bestMatch.rate === 0 ? 'straight_line' : 'declining_balance',
    confidence: Math.round(confidence * 100) / 100,
    reasoning: `Asset "${name}" matched CCA Class ${bestMatch.class_number} based on keyword analysis. ` +
               `This class has a ${bestMatch.rate}% depreciation rate and typical useful life of ${bestMatch.useful_life} months.`
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, description } = await req.json() as ClassificationRequest;

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Asset name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Classifying asset: ${name}`);
    
    const classification = classifyAsset(name, description);
    
    console.log(`Classification result: CCA Class ${classification.cca_class}, ${classification.useful_life_months} months`);

    return new Response(
      JSON.stringify(classification),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Classification error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
