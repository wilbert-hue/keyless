const fs = require('fs');
const path = require('path');

// Years: 2021-2033
const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033];

// Geographies with their region grouping
const regions = {
  "North America": ["U.S.", "Canada"],
  "Europe": ["U.K.", "Germany", "Italy", "France", "Spain", "Russia", "Rest of Europe"],
  "Asia Pacific": ["China", "India", "Japan", "South Korea", "ASEAN", "Australia", "Rest of Asia Pacific"],
  "Latin America": ["Brazil", "Argentina", "Mexico", "Rest of Latin America"],
  "Middle East & Africa": ["GCC", "South Africa", "Rest of Middle East & Africa"]
};

// Segment type keys and leaves (align with public/data value.json)
const segmentTypes = {
  "By System Type": {
    "Immobilizer System": 0.24,
    "Remote Keyless Entry System": 0.36,
    "Passive Keyless Entry and Start System": 0.40
  },
  "By Key Form Factor": {
    "Conventional Transponder Key": 0.22,
    "Remote Head Key": 0.20,
    "Flip Key": 0.2,
    "Smart Key": 0.2,
    "Card Key": 0.18
  },
  "By Propulsion Type": {
    "Internal Combustion Engine Vehicles": 0.34,
    "Hybrid Vehicles": 0.33,
    "Battery Electric Vehicles": 0.33
  },
  "By Sales Channel": {
    "OEM Factory-Fit": 0.55,
    "Aftermarket Replacement Channel": 0.45
  },
  "By Vehicle Type": {
    "Passenger Cars": 0.4,
    "Two-Wheelers": 0.15,
    "Commercial Vehicles": {
      "Light Commercial Vehicles": 0.22,
      "Heavy Commercial Vehicles": 0.23
    }
  }
};

// Regional base values (USD Million) for 2021 - total market per region
// Global Normothermic Machine Perfusion market ~$300M in 2021, growing ~12% CAGR
const regionBaseValues = {
  "North America": 120,
  "Europe": 90,
  "Asia Pacific": 50,
  "Latin America": 20,
  "Middle East & Africa": 15
};

// Country share within region (must sum to ~1.0)
const countryShares = {
  "North America": { "U.S.": 0.82, "Canada": 0.18 },
  "Europe": { "U.K.": 0.18, "Germany": 0.22, "Italy": 0.12, "France": 0.16, "Spain": 0.10, "Russia": 0.08, "Rest of Europe": 0.14 },
  "Asia Pacific": { "China": 0.28, "India": 0.12, "Japan": 0.25, "South Korea": 0.12, "ASEAN": 0.10, "Australia": 0.07, "Rest of Asia Pacific": 0.06 },
  "Latin America": { "Brazil": 0.45, "Argentina": 0.15, "Mexico": 0.25, "Rest of Latin America": 0.15 },
  "Middle East & Africa": { "GCC": 0.45, "South Africa": 0.25, "Rest of Middle East & Africa": 0.30 }
};

// Growth rates (CAGR) per region - slightly different for variety
const regionGrowthRates = {
  "North America": 0.115,
  "Europe": 0.108,
  "Asia Pacific": 0.145,
  "Latin America": 0.125,
  "Middle East & Africa": 0.118
};

const segmentGrowthMultipliers = {
  "By System Type": {
    "Immobilizer System": 0.98,
    "Remote Keyless Entry System": 1.0,
    "Passive Keyless Entry and Start System": 1.12
  },
  "By Key Form Factor": {
    "Conventional Transponder Key": 0.97,
    "Remote Head Key": 1.0,
    "Flip Key": 1.01,
    "Smart Key": 1.1,
    "Card Key": 1.15
  },
  "By Propulsion Type": {
    "Internal Combustion Engine Vehicles": 0.95,
    "Hybrid Vehicles": 1.1,
    "Battery Electric Vehicles": 1.2
  },
  "By Sales Channel": {
    "OEM Factory-Fit": 0.99,
    "Aftermarket Replacement Channel": 1.05
  },
  "By Vehicle Type": {
    "Passenger Cars": 0.99,
    "Two-Wheelers": 1.12,
    "Commercial Vehicles": {
      "Light Commercial Vehicles": 1.05,
      "Heavy Commercial Vehicles": 1.0
    }
  }
};

// Volume multiplier: units per USD Million (rough: ~500 units per $1M for perfusion devices)
const volumePerMillionUSD = 480;

// Seeded pseudo-random for reproducibility
let seed = 42;
function seededRandom() {
  seed = (seed * 16807 + 0) % 2147483647;
  return (seed - 1) / 2147483646;
}

function addNoise(value, noiseLevel = 0.03) {
  return value * (1 + (seededRandom() - 0.5) * 2 * noiseLevel);
}

function roundTo1(val) {
  return Math.round(val * 10) / 10;
}

function roundToInt(val) {
  return Math.round(val);
}

function generateTimeSeries(baseValue, growthRate, roundFn) {
  const series = {};
  for (let i = 0; i < years.length; i++) {
    const year = years[i];
    const rawValue = baseValue * Math.pow(1 + growthRate, i);
    series[year] = roundFn(addNoise(rawValue));
  }
  return series;
}

function isNumberRecord(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  return Object.values(obj).every((v) => typeof v === 'number');
}

/**
 * Build a segment block from share + multiplier trees (nested segment groups, e.g. By Propulsion Type).
 */
function buildSegBlock(shareTree, multTree, baseValue, baseGrowth, roundFn) {
  const out = {};
  for (const [name, def] of Object.entries(shareTree)) {
    const m = multTree[name];
    if (typeof def === 'number' && typeof m === 'number') {
      const g = baseGrowth * m;
      const b = baseValue * def;
      out[name] = generateTimeSeries(b, g, roundFn);
    } else if (isNumberRecord(def) && m && typeof m === 'object' && isNumberRecord(m)) {
      out[name] = {};
      for (const [leaf, sh] of Object.entries(def)) {
        const g2 = baseGrowth * m[leaf];
        const b2 = baseValue * sh;
        out[name][leaf] = generateTimeSeries(b2, g2, roundFn);
      }
    } else if (def && typeof def === 'object' && m && typeof m === 'object') {
      out[name] = buildSegBlock(def, m, baseValue, baseGrowth, roundFn);
    }
  }
  return out;
}

function hasYearKey(obj) {
  return obj && typeof obj === 'object' && '2021' in obj;
}

function scaleBlockValues(block, factor, roundFn) {
  if (hasYearKey(block)) {
    const s = {};
    for (const [k, v] of Object.entries(block)) {
      s[k] = roundFn(v * factor);
    }
    return s;
  }
  const o = {};
  for (const [k, v] of Object.entries(block)) {
    o[k] = scaleBlockValues(v, factor, roundFn);
  }
  return o;
}

function generateData(isVolume) {
  const data = {};
  const roundFn = isVolume ? roundToInt : roundTo1;
  const multiplier = isVolume ? volumePerMillionUSD : 1;

  // Generate data for each region and country
  for (const [regionName, countries] of Object.entries(regions)) {
    const regionBase = regionBaseValues[regionName] * multiplier;
    const regionGrowth = regionGrowthRates[regionName];

    // Region-level data
    data[regionName] = {};
    for (const [segType, segments] of Object.entries(segmentTypes)) {
      data[regionName][segType] = buildSegBlock(
        segments,
        segmentGrowthMultipliers[segType],
        regionBase,
        regionGrowth,
        roundFn
      );
    }

    // Add "By Country" for each region
    data[regionName]["By Country"] = {};
    for (const country of countries) {
      const cShare = countryShares[regionName][country];
      // Use a slight variation of region growth per country
      const countryGrowthVariation = 1 + (seededRandom() - 0.5) * 0.06;
      const countryBase = regionBase * cShare;
      const countryGrowth = regionGrowth * countryGrowthVariation;
      data[regionName]["By Country"][country] = generateTimeSeries(countryBase, countryGrowth, roundFn);
    }

    // Country-level data
    for (const country of countries) {
      const cShare = countryShares[regionName][country];
      const countryBase = regionBase * cShare;
      const countryGrowthVariation = 1 + (seededRandom() - 0.5) * 0.04;
      const countryGrowth = regionGrowth * countryGrowthVariation;

      data[country] = {};
      for (const [segType, segments] of Object.entries(segmentTypes)) {
        const baseBlock = buildSegBlock(
          segments,
          segmentGrowthMultipliers[segType],
          countryBase,
          countryGrowth,
          roundFn
        );
        const shareVariation = 1 + (seededRandom() - 0.5) * 0.1;
        data[country][segType] = scaleBlockValues(baseBlock, shareVariation, roundFn);
      }
    }
  }

  return data;
}

// Generate both datasets
seed = 42;
const valueData = generateData(false);
seed = 7777;
const volumeData = generateData(true);

// Write files
const outDir = path.join(__dirname, 'public', 'data');
fs.writeFileSync(path.join(outDir, 'value.json'), JSON.stringify(valueData, null, 2));
fs.writeFileSync(path.join(outDir, 'volume.json'), JSON.stringify(volumeData, null, 2));

console.log('Generated value.json and volume.json successfully');
console.log('Value geographies:', Object.keys(valueData).length);
console.log('Volume geographies:', Object.keys(volumeData).length);
console.log('Segment types:', Object.keys(valueData['North America']));
console.log('Sample - North America, By System Type:', JSON.stringify(valueData['North America']['By System Type'], null, 2));
