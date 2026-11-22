/**
 * assetUtil.js
 * Utility helpers, constants, and formatting functions for JalSetu assets.
 */

import { strings } from '../strings';

export const ASSET_TYPES = [
  { value: 'SOURCE', label: strings.assetTypeSource },
  { value: 'PUMP', label: strings.assetTypePump },
  { value: 'PIPELINE', label: strings.assetTypePipeline },
  { value: 'VALVE', label: strings.assetTypeValve },
  { value: 'TANK', label: strings.assetTypeTank },
  { value: 'TREATMENT_PLANT', label: strings.assetTypeTreatmentPlant },
  { value: 'STANDPOST', label: strings.assetTypeStandpost },
];

export const ASSET_STATUSES = [
  { value: 'WORKING', label: strings.assetStatusWorking },
  { value: 'FAULTY', label: strings.assetStatusFaulty },
  { value: 'UNDER_REPAIR', label: strings.assetStatusUnderRepair },
];

export function statusTone(status) {
  switch (status) {
    case 'WORKING':
      return 'success';
    case 'FAULTY':
      return 'danger';
    case 'UNDER_REPAIR':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function typeIcon(type) {
  switch (type) {
    case 'SOURCE':
      return 'water-outline';
    case 'PUMP':
      return 'settings-outline';
    case 'PIPELINE':
      return 'git-commit-outline';
    case 'VALVE':
      return 'options-outline';
    case 'TANK':
      return 'beaker-outline';
    case 'TREATMENT_PLANT':
      return 'flask-outline';
    case 'STANDPOST':
      return 'location-outline';
    default:
      return 'cube-outline';
  }
}

export function typeLabel(type) {
  const match = ASSET_TYPES.find((item) => item.value === type);
  return match ? match.label : type || '';
}

export function statusLabel(status) {
  const match = ASSET_STATUSES.find((item) => item.value === status);
  return match ? match.label : status || '';
}

export function attributeSummary(asset) {
  if (!asset || !asset.attributes || typeof asset.attributes !== 'object') {
    return '';
  }

  const { type, attributes } = asset;

  switch (type) {
    case 'PUMP':
      if (attributes.hp !== undefined && attributes.hp !== null && attributes.hp !== '') {
        const val = typeof attributes.hp === 'number' ? attributes.hp.toLocaleString() : attributes.hp;
        return `${val} ${strings.unitHp}`;
      }
      return '';

    case 'TANK':
      if (attributes.capacityL !== undefined && attributes.capacityL !== null && attributes.capacityL !== '') {
        const val = typeof attributes.capacityL === 'number' ? attributes.capacityL.toLocaleString() : attributes.capacityL;
        return `${val} ${strings.unitLiter}`;
      }
      return '';

    case 'PIPELINE':
      if (attributes.lengthM !== undefined && attributes.lengthM !== null && attributes.lengthM !== '') {
        const val = typeof attributes.lengthM === 'number' ? attributes.lengthM.toLocaleString() : attributes.lengthM;
        return `${val} ${strings.unitMeter}`;
      }
      return '';

    case 'SOURCE':
      if (attributes.depthM !== undefined && attributes.depthM !== null && attributes.depthM !== '') {
        const val = typeof attributes.depthM === 'number' ? attributes.depthM.toLocaleString() : attributes.depthM;
        return `${val} ${strings.unitMeter}`;
      }
      return '';

    case 'TREATMENT_PLANT':
      if (attributes.capacityLPD !== undefined && attributes.capacityLPD !== null && attributes.capacityLPD !== '') {
        const val = typeof attributes.capacityLPD === 'number' ? attributes.capacityLPD.toLocaleString() : attributes.capacityLPD;
        return `${val} ${strings.unitLpd}`;
      }
      return '';

    case 'STANDPOST':
    default:
      return '';
  }
}

export function formatAssetCount(count) {
  if (count === 1) {
    return strings.assetCountSingular;
  }
  return strings.assetCountPlural.replace('{count}', (count || 0).toLocaleString());
}
