export interface CycloneShelterNode {
  id: string;
  name: string;
  lat: number;
  lon: number;
  district: string;
  state: string;
  capacity: number;
  currentOccupancy: number;
  evacuationPriority: "IMMEDIATE" | "HIGH" | "ADVISORY" | "STANDBY";
  facilityType: "MPCS Grade A" | "MPCS Grade B" | "High School Cyclone Refuge" | "Community Cyclone Citadel";
  amenities: {
    backupGenerator: boolean;
    solarROWater: boolean;
    helipad: boolean;
    medicalTriage: boolean;
    satelliteComms: boolean;
    foodRationsDays: number;
  };
  contactOfficer: string;
  contactPhone: string;
  distanceFromEyeKm?: number;
}

export interface CoastalSeawall {
  id: string;
  name: string;
  coordinates: [number, number][]; // [lat, lon]
  defenseType: "Tetrapod Concrete Seawall" | "Rock Armor Embankment" | "Geosynthetic Wave Barrier" | "Tidal Surge Dike";
  designSurgeHeightM: number;
  lengthKm: number;
  condition: "OPTIMAL" | "OPERATIONAL" | "REINFORCED" | "MONITORING";
  district: string;
}

export interface MangroveBioshield {
  id: string;
  name: string;
  coordinates: [number, number][][]; // polygon coordinates [lat, lon]
  areaSqKm: number;
  waveAttenuationPct: number;
  windReductionPct: number;
  species: string;
  protectionZone: string;
}

export interface NDRFStagingDepot {
  id: string;
  battalion: string;
  locationName: string;
  lat: number;
  lon: number;
  personnelCount: number;
  rescueBoats: number;
  satellitePhones: number;
  triageTeams: number;
  commandLead: string;
}

export interface EvacuationCorridor {
  id: string;
  name: string;
  fromArea: string;
  toShelter: string;
  coordinates: [number, number][]; // [lat, lon]
  status: "CLEAR" | "PRIORITY_EVACUATION" | "CAUTION" | "DIVERTED";
  capacityPerHour: number;
}

// Comprehensive National MPCS & Refugee Cyclone Shelters Suite
export const NATIONAL_CYCLONE_SHELTERS: CycloneShelterNode[] = [
  // Odisha Coast
  {
    id: "mpcs-od-01",
    name: "Paradip Port Multipurpose Cyclone Shelter (MPCS-01)",
    lat: 20.295,
    lon: 86.685,
    district: "Jagatsinghpur",
    state: "Odisha",
    capacity: 2500,
    currentOccupancy: 2050,
    evacuationPriority: "IMMEDIATE",
    facilityType: "Community Cyclone Citadel",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: true,
      medicalTriage: true,
      satelliteComms: true,
      foodRationsDays: 7,
    },
    contactOfficer: "Sub-Collector Jagatsinghpur",
    contactPhone: "+91-6722-220101",
  },
  {
    id: "mpcs-od-02",
    name: "Dhamra Port Coastal Refuge Citadel (MPCS-02)",
    lat: 20.812,
    lon: 86.955,
    district: "Bhadrak",
    state: "Odisha",
    capacity: 1800,
    currentOccupancy: 1420,
    evacuationPriority: "IMMEDIATE",
    facilityType: "MPCS Grade A",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: false,
      medicalTriage: true,
      satelliteComms: true,
      foodRationsDays: 5,
    },
    contactOfficer: "Bhadrak Emergency Control",
    contactPhone: "+91-6784-251200",
  },
  {
    id: "mpcs-od-03",
    name: "Gopalpur Marine Cyclone Shelter",
    lat: 19.261,
    lon: 84.908,
    district: "Ganjam",
    state: "Odisha",
    capacity: 2200,
    currentOccupancy: 1100,
    evacuationPriority: "HIGH",
    facilityType: "MPCS Grade A",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: true,
      medicalTriage: true,
      satelliteComms: true,
      foodRationsDays: 6,
    },
    contactOfficer: "Ganjam Disaster Officer",
    contactPhone: "+91-6811-232145",
  },
  {
    id: "mpcs-od-04",
    name: "Puri Beachfront Emergency Cyclone Haven",
    lat: 19.798,
    lon: 85.825,
    district: "Puri",
    state: "Odisha",
    capacity: 3000,
    currentOccupancy: 1850,
    evacuationPriority: "HIGH",
    facilityType: "Community Cyclone Citadel",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: true,
      medicalTriage: true,
      satelliteComms: true,
      foodRationsDays: 8,
    },
    contactOfficer: "Puri District Relief Center",
    contactPhone: "+91-6752-223400",
  },
  {
    id: "mpcs-od-05",
    name: "Chandbali Delta Riverine Shelter",
    lat: 20.781,
    lon: 86.745,
    district: "Bhadrak",
    state: "Odisha",
    capacity: 1200,
    currentOccupancy: 950,
    evacuationPriority: "IMMEDIATE",
    facilityType: "MPCS Grade B",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: false,
      medicalTriage: true,
      satelliteComms: false,
      foodRationsDays: 4,
    },
    contactOfficer: "Chandbali Tehsildar",
    contactPhone: "+91-6786-220011",
  },

  // West Bengal Coast
  {
    id: "mpcs-wb-01",
    name: "Digha Coastal Multipurpose Shelter Hub (MPCS-WB01)",
    lat: 21.628,
    lon: 87.525,
    district: "Purba Medinipur",
    state: "West Bengal",
    capacity: 2800,
    currentOccupancy: 2450,
    evacuationPriority: "IMMEDIATE",
    facilityType: "Community Cyclone Citadel",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: true,
      medicalTriage: true,
      satelliteComms: true,
      foodRationsDays: 7,
    },
    contactOfficer: "Digha Development Authority",
    contactPhone: "+91-3220-266200",
  },
  {
    id: "mpcs-wb-02",
    name: "Kakdwip Sundarbans Delta Cyclone Refuge",
    lat: 21.875,
    lon: 88.185,
    district: "South 24 Parganas",
    state: "West Bengal",
    capacity: 1900,
    currentOccupancy: 1680,
    evacuationPriority: "IMMEDIATE",
    facilityType: "MPCS Grade A",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: false,
      medicalTriage: true,
      satelliteComms: true,
      foodRationsDays: 6,
    },
    contactOfficer: "Kakdwip SDO Disaster Desk",
    contactPhone: "+91-3210-255100",
  },
  {
    id: "mpcs-wb-03",
    name: "Haldia Industrial Coastal Safety Center",
    lat: 22.062,
    lon: 88.065,
    district: "Purba Medinipur",
    state: "West Bengal",
    capacity: 2200,
    currentOccupancy: 1350,
    evacuationPriority: "HIGH",
    facilityType: "MPCS Grade A",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: true,
      medicalTriage: true,
      satelliteComms: true,
      foodRationsDays: 5,
    },
    contactOfficer: "Haldia Municipal Disaster Desk",
    contactPhone: "+91-3224-252100",
  },

  // Maharashtra Coast (Arabian Sea)
  {
    id: "mpcs-mh-01",
    name: "Alibaug Central Cyclone Protection Citadel (MPCS-MH01)",
    lat: 18.358,
    lon: 72.985,
    district: "Raigad",
    state: "Maharashtra",
    capacity: 2000,
    currentOccupancy: 1640,
    evacuationPriority: "IMMEDIATE",
    facilityType: "Community Cyclone Citadel",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: true,
      medicalTriage: true,
      satelliteComms: true,
      foodRationsDays: 7,
    },
    contactOfficer: "District Disaster Control Alibaug",
    contactPhone: "+91-2141-222001",
  },
  {
    id: "mpcs-mh-02",
    name: "Shrivardhan Coastal High School Evacuation Shelter",
    lat: 18.045,
    lon: 73.015,
    district: "Raigad",
    state: "Maharashtra",
    capacity: 1500,
    currentOccupancy: 1120,
    evacuationPriority: "HIGH",
    facilityType: "High School Cyclone Refuge",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: false,
      medicalTriage: true,
      satelliteComms: false,
      foodRationsDays: 5,
    },
    contactOfficer: "Shrivardhan Nagar Palika",
    contactPhone: "+91-2147-222300",
  },
  {
    id: "mpcs-mh-03",
    name: "Ratnagiri Mirya Bay Cyclone Safe Haven",
    lat: 17.012,
    lon: 73.285,
    district: "Ratnagiri",
    state: "Maharashtra",
    capacity: 1600,
    currentOccupancy: 890,
    evacuationPriority: "ADVISORY",
    facilityType: "MPCS Grade A",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: true,
      medicalTriage: true,
      satelliteComms: true,
      foodRationsDays: 6,
    },
    contactOfficer: "Ratnagiri Collectorate Control",
    contactPhone: "+91-2352-226200",
  },

  // Gujarat Coast (Arabian Sea)
  {
    id: "mpcs-gj-01",
    name: "Mandvi Port Emergency Cyclone Fortress (MPCS-GJ01)",
    lat: 23.205,
    lon: 68.612,
    district: "Kutch",
    state: "Gujarat",
    capacity: 2600,
    currentOccupancy: 2180,
    evacuationPriority: "IMMEDIATE",
    facilityType: "Community Cyclone Citadel",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: true,
      medicalTriage: true,
      satelliteComms: true,
      foodRationsDays: 8,
    },
    contactOfficer: "Kutch Disaster Cell",
    contactPhone: "+91-2832-250020",
  },
  {
    id: "mpcs-gj-02",
    name: "Dwarka Coastal Community Safety Hub",
    lat: 22.245,
    lon: 68.968,
    district: "Devbhumi Dwarka",
    state: "Gujarat",
    capacity: 2000,
    currentOccupancy: 1350,
    evacuationPriority: "HIGH",
    facilityType: "MPCS Grade A",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: true,
      medicalTriage: true,
      satelliteComms: true,
      foodRationsDays: 6,
    },
    contactOfficer: "Dwarka Emergency Response",
    contactPhone: "+91-2833-234200",
  },

  // Andhra Pradesh Coast
  {
    id: "mpcs-ap-01",
    name: "Visakhapatnam Harbor Heights Refuge Center",
    lat: 17.695,
    lon: 83.225,
    district: "Visakhapatnam",
    state: "Andhra Pradesh",
    capacity: 3500,
    currentOccupancy: 2200,
    evacuationPriority: "HIGH",
    facilityType: "Community Cyclone Citadel",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: true,
      medicalTriage: true,
      satelliteComms: true,
      foodRationsDays: 8,
    },
    contactOfficer: "GVMC Disaster Command",
    contactPhone: "+91-891-2568200",
  },
  {
    id: "mpcs-ap-02",
    name: "Machilipatnam Krishna Delta MPCS Hub",
    lat: 16.182,
    lon: 81.145,
    district: "Krishna",
    state: "Andhra Pradesh",
    capacity: 1800,
    currentOccupancy: 1250,
    evacuationPriority: "ADVISORY",
    facilityType: "MPCS Grade A",
    amenities: {
      backupGenerator: true,
      solarROWater: true,
      helipad: false,
      medicalTriage: true,
      satelliteComms: true,
      foodRationsDays: 5,
    },
    contactOfficer: "Krishna Collectorate Control",
    contactPhone: "+91-8672-252500",
  },
];

// Coastal Seawalls & Physical Defense Assets
export const COASTAL_DEFENSE_SEAWALLS: CoastalSeawall[] = [
  {
    id: "wall-od-01",
    name: "Paradip Port Major Breakwater & Seawall Armor",
    coordinates: [
      [20.275, 86.672],
      [20.285, 86.682],
      [20.298, 86.695],
      [20.312, 86.708],
    ],
    defenseType: "Tetrapod Concrete Seawall",
    designSurgeHeightM: 5.2,
    lengthKm: 6.8,
    condition: "OPTIMAL",
    district: "Jagatsinghpur, Odisha",
  },
  {
    id: "wall-wb-01",
    name: "Digha Sea-Dyke & Coastal Promenade Armor",
    coordinates: [
      [21.618, 87.505],
      [21.625, 87.525],
      [21.632, 87.545],
      [21.638, 87.568],
    ],
    defenseType: "Rock Armor Embankment",
    designSurgeHeightM: 4.8,
    lengthKm: 7.2,
    condition: "REINFORCED",
    district: "Purba Medinipur, West Bengal",
  },
  {
    id: "wall-mh-01",
    name: "Alibaug Varsoli Beach Geo-tube Surge Barrier",
    coordinates: [
      [18.345, 72.968],
      [18.358, 72.975],
      [18.372, 72.982],
    ],
    defenseType: "Geosynthetic Wave Barrier",
    designSurgeHeightM: 3.8,
    lengthKm: 4.5,
    condition: "OPERATIONAL",
    district: "Raigad, Maharashtra",
  },
  {
    id: "wall-gj-01",
    name: "Mandvi Port Marine Protection Wall",
    coordinates: [
      [23.195, 68.595],
      [23.208, 68.618],
      [23.218, 68.638],
    ],
    defenseType: "Tetrapod Concrete Seawall",
    designSurgeHeightM: 5.0,
    lengthKm: 5.4,
    condition: "OPTIMAL",
    district: "Kutch, Gujarat",
  },
];

// Mangrove Bioshields & Ecological Wave Damping Corridors
export const MANGROVE_BIOSHIELDS: MangroveBioshield[] = [
  {
    id: "bio-od-01",
    name: "Bhitarkanika Ramsar Mangrove Bioshield Corridor",
    coordinates: [
      [
        [20.65, 86.85],
        [20.85, 86.88],
        [20.90, 87.05],
        [20.72, 87.12],
        [20.62, 86.98],
        [20.65, 86.85],
      ],
    ],
    areaSqKm: 672,
    waveAttenuationPct: 42,
    windReductionPct: 28,
    species: "Avicennia marina & Rhizophora mucronata",
    protectionZone: "Dhamra Port & Bhadrak Coastal Delta",
  },
  {
    id: "bio-wb-01",
    name: "Sundarbans Biosphere Tidal Wave Barrier",
    coordinates: [
      [
        [21.65, 88.10],
        [21.95, 88.15],
        [22.15, 88.65],
        [21.85, 88.95],
        [21.55, 88.55],
        [21.65, 88.10],
      ],
    ],
    areaSqKm: 4260,
    waveAttenuationPct: 48,
    windReductionPct: 35,
    species: "Heritiera fomes (Sundari) & Excoecaria agallocha",
    protectionZone: "Kakdwip, Sagar Island & South Bengal Delta",
  },
  {
    id: "bio-mh-01",
    name: "Kundalika Estuary Coastal Mangrove Green Belt",
    coordinates: [
      [
        [18.30, 72.94],
        [18.38, 72.96],
        [18.42, 73.04],
        [18.34, 73.08],
        [18.28, 73.00],
        [18.30, 72.94],
      ],
    ],
    areaSqKm: 85,
    waveAttenuationPct: 34,
    windReductionPct: 22,
    species: "Avicennia officinalis",
    protectionZone: "Alibaug & Revdanda Estuary",
  },
];

// NDRF & Coast Guard Strategic Rescue Staging Bases
export const NDRF_STAGING_DEPOTS: NDRFStagingDepot[] = [
  {
    id: "ndrf-03",
    battalion: "03 BN NDRF Mundali / Cuttack",
    locationName: "Cuttack-Bhubaneswar Forward Base",
    lat: 20.465,
    lon: 85.875,
    personnelCount: 450,
    rescueBoats: 38,
    satellitePhones: 16,
    triageTeams: 12,
    commandLead: "Commandant Jacob B.",
  },
  {
    id: "ndrf-02",
    battalion: "02 BN NDRF Haringhata / Kolkata",
    locationName: "Kolkata-Digha Staging Depot",
    lat: 22.572,
    lon: 88.363,
    personnelCount: 420,
    rescueBoats: 32,
    satellitePhones: 14,
    triageTeams: 10,
    commandLead: "Commandant S. K. Mukherjee",
  },
  {
    id: "ndrf-05",
    battalion: "05 BN NDRF Pune / Sudumbare",
    locationName: "Raigad Coastal Strike Force",
    lat: 18.520,
    lon: 73.856,
    personnelCount: 380,
    rescueBoats: 26,
    satellitePhones: 12,
    triageTeams: 8,
    commandLead: "Commandant Anupam S.",
  },
  {
    id: "ndrf-06",
    battalion: "06 BN NDRF Vadodara",
    locationName: "Kutch-Mandvi Marine Deployment Base",
    lat: 22.307,
    lon: 73.181,
    personnelCount: 360,
    rescueBoats: 28,
    satellitePhones: 14,
    triageTeams: 9,
    commandLead: "Commandant R. K. Patel",
  },
];

// Evacuation Arteries & Inland Corridors
export const EVACUATION_CORRIDORS: EvacuationCorridor[] = [
  {
    id: "corridor-od-01",
    name: "SH-12 Paradip to Cuttack Inland Evacuation Super-Corridor",
    fromArea: "Paradip Port Coastal Lowlands (0-3 km)",
    toShelter: "Paradip Central MPCS & Cuttack Inland Citadels",
    coordinates: [
      [20.295, 86.685],
      [20.345, 86.512],
      [20.395, 86.325],
      [20.445, 86.115],
      [20.465, 85.875],
    ],
    status: "PRIORITY_EVACUATION",
    capacityPerHour: 4500,
  },
  {
    id: "corridor-wb-01",
    name: "NH-116B Digha to Contai Safe Inland Expressway",
    fromArea: "Digha Beachfront Coastal Zone",
    toShelter: "Digha MPCS-01 & Contai Elevated Shelters",
    coordinates: [
      [21.628, 87.525],
      [21.685, 87.615],
      [21.745, 87.725],
      [21.785, 87.815],
    ],
    status: "PRIORITY_EVACUATION",
    capacityPerHour: 3800,
  },
  {
    id: "corridor-mh-01",
    name: "Alibaug-Pen-Khopoli Rapid Evacuation Artery",
    fromArea: "Alibaug & Varsoli Lowland Belt",
    toShelter: "Alibaug Central MPCS & Pen Inland Fortresses",
    coordinates: [
      [18.358, 72.985],
      [18.525, 73.095],
      [18.685, 73.185],
      [18.785, 73.345],
    ],
    status: "PRIORITY_EVACUATION",
    capacityPerHour: 3200,
  },
];
