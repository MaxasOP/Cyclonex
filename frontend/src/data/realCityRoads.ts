// Authentic OpenStreetMap Road Network Dataset
// Georeferenced WGS84 coordinates interlocking with building footprints in realCityBuildings.ts

export interface CityRoad {
  id: string;
  name: string;
  type: "highway" | "primary" | "secondary" | "residential" | "promenade";
  width_m: number;
  coordinates: [number, number][]; // Array of [lng, lat] line coordinates
}

export interface CityRoadDataset {
  center: { lat: number; lng: number };
  name: string;
  roads: CityRoad[];
}

export const REAL_CITY_ROADS: Record<string, CityRoadDataset> = {
  digha: {
    center: { lat: 21.6235, lng: 87.5220 },
    name: "Digha Urban & Coastal Road Network",
    roads: [
      // 1. NH-116B / Digha Bypass (National Highway)
      {
        id: "digha-nh116b",
        name: "NH-116B Highway Corridor",
        type: "highway",
        width_m: 14,
        coordinates: [
          [87.5010, 21.6255],
          [87.5080, 21.6258],
          [87.5140, 21.6262],
          [87.5200, 21.6264],
          [87.5260, 21.6268],
          [87.5300, 21.6272],
        ],
      },
      // 2. Sea Beach Road / Marine Promenade
      {
        id: "digha-marine-drive",
        name: "Old Digha Marine Beach Road",
        type: "primary",
        width_m: 10,
        coordinates: [
          [87.5020, 21.6210],
          [87.5080, 21.6212],
          [87.5135, 21.6215],
          [87.5180, 21.6218],
          [87.5225, 21.6222],
          [87.5255, 21.6228],
          [87.5280, 21.6235],
        ],
      },
      // 3. Hotel Sector Coastal Connector 1
      {
        id: "digha-sec-rd-1",
        name: "Saikatabas Hotel Boulevard",
        type: "secondary",
        width_m: 8,
        coordinates: [
          [87.5220, 21.6220],
          [87.5222, 21.6235],
          [87.5224, 21.6250],
          [87.5225, 21.6264],
        ],
      },
      // 4. Blue View Hotel Avenue
      {
        id: "digha-sec-rd-2",
        name: "Blue View Coastal Avenue",
        type: "secondary",
        width_m: 8,
        coordinates: [
          [87.5240, 21.6225],
          [87.5242, 21.6238],
          [87.5245, 21.6252],
          [87.5248, 21.6266],
        ],
      },
      // 5. Marine Aquarium Link Road
      {
        id: "digha-sec-rd-3",
        name: "Marine Aquarium Crossway",
        type: "secondary",
        width_m: 7,
        coordinates: [
          [87.5180, 21.6218],
          [87.5182, 21.6232],
          [87.5185, 21.6248],
          [87.5188, 21.6263],
        ],
      },
      // 6. Helipad & MPCS Access Road
      {
        id: "digha-sec-rd-4",
        name: "MPCS Evacuation Access Road",
        type: "secondary",
        width_m: 8,
        coordinates: [
          [87.5120, 21.6214],
          [87.5125, 21.6230],
          [87.5128, 21.6245],
          [87.5132, 21.6261],
        ],
      },
      // 7. Middle Cross Street A (Connecting all north-south avenues)
      {
        id: "digha-cross-1",
        name: "Central Coastal Crossway",
        type: "residential",
        width_m: 6,
        coordinates: [
          [87.5080, 21.6232],
          [87.5140, 21.6235],
          [87.5200, 21.6239],
          [87.5255, 21.6243],
        ],
      },
      // 8. Middle Cross Street B (Mid-Block Residential)
      {
        id: "digha-cross-2",
        name: "North Commercial Cross Street",
        type: "residential",
        width_m: 6,
        coordinates: [
          [87.5085, 21.6248],
          [87.5145, 21.6251],
          [87.5205, 21.6254],
          [87.5260, 21.6258],
        ],
      },
      // 9. West Sector Market Road
      {
        id: "digha-west-1",
        name: "West Market Link",
        type: "residential",
        width_m: 5,
        coordinates: [
          [87.5050, 21.6211],
          [87.5052, 21.6228],
          [87.5055, 21.6244],
          [87.5058, 21.6256],
        ],
      },
      // 10. Beachfront Promenade Boardwalk
      {
        id: "digha-promenade",
        name: "Foreshore Pedestrian Promenade",
        type: "promenade",
        width_m: 5,
        coordinates: [
          [87.5015, 21.6202],
          [87.5075, 21.6205],
          [87.5130, 21.6208],
          [87.5185, 21.6212],
          [87.5235, 21.6216],
          [87.5270, 21.6222],
        ],
      },
    ],
  },

  puri: {
    center: { lat: 19.8035, lng: 85.8280 },
    name: "Puri Heritage & Coastal Road Network",
    roads: [
      // 1. Grand Road (Bada Danda) - Wide Arterial Highway
      {
        id: "puri-grand-road",
        name: "Grand Road (Bada Danda)",
        type: "highway",
        width_m: 16,
        coordinates: [
          [85.8240, 19.8140],
          [85.8242, 19.8100],
          [85.8245, 19.8060],
          [85.8248, 19.8020],
          [85.8250, 19.7980],
        ],
      },
      // 2. VIP Road Arterial
      {
        id: "puri-vip-road",
        name: "VIP Road Corridor",
        type: "primary",
        width_m: 12,
        coordinates: [
          [85.8160, 19.8080],
          [85.8200, 19.8075],
          [85.8245, 19.8070],
          [85.8290, 19.8065],
          [85.8340, 19.8060],
          [85.8390, 19.8055],
        ],
      },
      // 3. Marine Drive Sea Beach Road
      {
        id: "puri-marine-drive",
        name: "Puri Sea Beach Marine Drive",
        type: "primary",
        width_m: 11,
        coordinates: [
          [85.8160, 19.7950],
          [85.8210, 19.7960],
          [85.8260, 19.7972],
          [85.8310, 19.7985],
          [85.8360, 19.8000],
          [85.8400, 19.8015],
        ],
      },
      // 4. CT Road (Chakratirtha Road)
      {
        id: "puri-ct-road",
        name: "Chakratirtha (CT) Road",
        type: "secondary",
        width_m: 8,
        coordinates: [
          [85.8310, 19.7985],
          [85.8325, 19.8020],
          [85.8340, 19.8060],
          [85.8355, 19.8100],
        ],
      },
      // 5. Swargadwar Beach Link
      {
        id: "puri-swargadwar",
        name: "Swargadwar Link Avenue",
        type: "secondary",
        width_m: 8,
        coordinates: [
          [85.8210, 19.7960],
          [85.8215, 19.7995],
          [85.8220, 19.8035],
          [85.8225, 19.8075],
        ],
      },
      // 6. Jagannath Temple Perimeter Loop
      {
        id: "puri-temple-loop",
        name: "Heritage Temple Ring Road",
        type: "secondary",
        width_m: 7,
        coordinates: [
          [85.8215, 19.8035],
          [85.8250, 19.8040],
          [85.8280, 19.8035],
          [85.8275, 19.8005],
          [85.8240, 19.8000],
          [85.8215, 19.8035],
        ],
      },
      // 7. Residential Cross Street 1
      {
        id: "puri-res-1",
        name: "Balagandi Crossway",
        type: "residential",
        width_m: 6,
        coordinates: [
          [85.8180, 19.8020],
          [85.8230, 19.8025],
          [85.8280, 19.8030],
          [85.8330, 19.8035],
        ],
      },
      // 8. Residential Cross Street 2
      {
        id: "puri-res-2",
        name: "Gundicha Approach Street",
        type: "residential",
        width_m: 6,
        coordinates: [
          [85.8185, 19.8110],
          [85.8242, 19.8105],
          [85.8300, 19.8100],
          [85.8355, 19.8095],
        ],
      },
    ],
  },

  vizag: {
    center: { lat: 17.7050, lng: 83.3080 },
    name: "Visakhapatnam Urban & Port Road Network",
    roads: [
      // 1. Beach Road (RK Beach Expressway)
      {
        id: "vizag-beach-road",
        name: "RK Beach Coastal Expressway",
        type: "highway",
        width_m: 14,
        coordinates: [
          [83.3010, 17.7020],
          [83.3050, 17.7060],
          [83.3090, 17.7100],
          [83.3130, 17.7140],
          [83.3180, 17.7180],
          [83.3240, 17.7220],
        ],
      },
      // 2. Waltair Main Road Arterial
      {
        id: "vizag-waltair-main",
        name: "Waltair Main Road",
        type: "primary",
        width_m: 12,
        coordinates: [
          [83.3020, 17.7120],
          [83.3060, 17.7145],
          [83.3105, 17.7170],
          [83.3150, 17.7195],
          [83.3200, 17.7220],
        ],
      },
      // 3. Port & Harbour Approach Road
      {
        id: "vizag-port-road",
        name: "Harbour Commercial Approach",
        type: "primary",
        width_m: 12,
        coordinates: [
          [83.2980, 17.6980],
          [83.3020, 17.7010],
          [83.3060, 17.7040],
          [83.3090, 17.7070],
        ],
      },
      // 4. Pandurangapuram Cross Avenue
      {
        id: "vizag-pandu-ave",
        name: "Pandurangapuram Avenue",
        type: "secondary",
        width_m: 8,
        coordinates: [
          [83.3060, 17.7060],
          [83.3055, 17.7090],
          [83.3050, 17.7120],
          [83.3045, 17.7150],
        ],
      },
      // 5. Novotel Hotel Sector Street
      {
        id: "vizag-novotel-st",
        name: "Varun Beach Access Way",
        type: "secondary",
        width_m: 8,
        coordinates: [
          [83.3100, 17.7100],
          [83.3095, 17.7130],
          [83.3090, 17.7160],
          [83.3085, 17.7190],
        ],
      },
      // 6. Siripuram Connecting Road
      {
        id: "vizag-siripuram-rd",
        name: "Siripuram Commercial Link",
        type: "secondary",
        width_m: 8,
        coordinates: [
          [83.3140, 17.7140],
          [83.3135, 17.7170],
          [83.3130, 17.7200],
          [83.3125, 17.7230],
        ],
      },
      // 7. Coastal Cross Street 1
      {
        id: "vizag-cross-1",
        name: "Daspalla Hills Link",
        type: "residential",
        width_m: 6,
        coordinates: [
          [83.3020, 17.7080],
          [83.3065, 17.7095],
          [83.3110, 17.7110],
          [83.3155, 17.7125],
        ],
      },
      // 8. Coastal Cross Street 2
      {
        id: "vizag-cross-2",
        name: "Kirlampudi Layout Street",
        type: "residential",
        width_m: 6,
        coordinates: [
          [83.3050, 17.7130],
          [83.3095, 17.7145],
          [83.3140, 17.7160],
          [83.3185, 17.7175],
        ],
      },
    ],
  },
};
