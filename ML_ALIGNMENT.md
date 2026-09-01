# CYCLONEX academic-objective alignment

## Objective

Develop an AI/ML-based system to identify, classify, and predict tropical
cyclone patterns using multi-source satellite data.

## Current status

The existing ocean-node and 200 m damage-risk components are retained as
**downstream impact assessment**. They are not, by themselves, an AI/ML
cyclone-pattern system.

## Target processing flow

```text
Satellite scenes + satellite-derived products + best-track labels
    -> quality control, co-registration, storm-centred sequence cubes
    -> identification model
    -> pattern / intensity classification model
    -> 6 h, 12 h, 24 h track and intensity prediction model
    -> uncertainty and confidence
    -> TB/VF ocean context and 200 m impact-risk grid
```

## Multi-source data design

| Source | Role | Minimum fields |
| --- | --- | --- |
| NOAA HURSAT-B1 historical storm-centred infrared imagery | train and test image-sequence models | image, timestamp, storm ID, centre |
| INSAT / geostationary imagery for Indian Ocean operations | near-real-time Bay of Bengal and Arabian Sea imagery | infrared / visible channels, timestamp, coverage |
| GPM IMERG | satellite-derived rain structure and rain-rate features | precipitation, timestamp, grid |
| Sentinel-1 SAR | post-event surface/flood context, all-weather observation | VV/VH backscatter, acquisition time |
| HYCOM ocean profile | physical ocean context, not an image label | TB and VF at storm position |
| IMD / JTWC / IBTrACS best tracks | supervised truth labels | storm centre, wind, pressure, lifecycle stage |

Google Maps tiles are for visualisation only. They must not be used to train
or infer the ML model.

## ML tasks and outputs

### 1. Identification

Input: a time-stamped, geo-referenced satellite sequence.

Output: `NO_CYCLONE`, `TROPICAL_DISTURBANCE`, or `TROPICAL_CYCLONE`, with
storm-centre coordinates and confidence.

### 2. Pattern classification

Input: storm-centred multi-channel sequence plus ocean features.

Output: lifecycle pattern: `FORMATION`, `INTENSIFYING`, `MATURE`,
`WEAKENING`, or `LANDFALLING`; intensity class; and confidence.

The final intensity classes must follow the selected authority (IMD for the
North Indian Ocean) and be recorded in a versioned label specification.

### 3. Prediction

Input: the preceding 6-24 hours of satellite sequence, best available ocean
features, and prior storm motion.

Output: 6 h, 12 h, and 24 h forecasts for centre latitude/longitude,
maximum sustained wind, central pressure, lifecycle class, and uncertainty.

## Model progression

1. Establish a baseline using engineered satellite/ocean features and a
   gradient-boosted classifier/regressor.
2. Train a CNN plus temporal model (ConvLSTM or temporal transformer) on
   storm-centred image sequences.
3. Compare each model to persistence and climatology baselines. Do not claim
   predictive capability without held-out storm evaluation.

## Data and evaluation rules

- Split training, validation, and test data by storm, never by individual
  image, to avoid leakage.
- Include Bay of Bengal and Arabian Sea storms in every split.
- Record source URL, product version, timestamp, spatial resolution, and
  preprocessing version for every sample.
- Report identification precision/recall/F1; classification macro-F1 and
  confusion matrix; track error in km; and intensity MAE in km/h and hPa.
- Always return uncertainty. The current impact grid must visibly state when
  it uses an ML forecast rather than an observed or manually entered scenario.

## Replacement path for the current API

The current `POST /api/v2/scenarios` remains useful for manual demonstration.
The production ML path will add:

- `POST /api/v3/observations/ingest` - register a source scene/product
- `POST /api/v3/best-tracks/ibtracs` - import a bounded North Indian label extract
- `POST /api/v3/training-samples` - register a storm-split labelled sample
- `GET /api/v3/dataset-summary` - verify readiness without claiming a trained model
- `POST /api/v3/inference` - identify, classify, and predict from a sequence
- `GET /api/v3/storms/{storm_id}/forecast` - forecast with confidence and
  provenance
- `POST /api/v3/storms/{storm_id}/impact-run` - generate the TB/VF-linked
  200 m impact grid from the ML forecast

## Required access

Use free research/education access first: NOAA HURSAT-B1 historical data,
NASA GPM/IMERG (Earthdata account), and Earth Engine research/education
access for Sentinel products. Obtain the selected Indian Ocean geostationary
source and its terms before operational use.
