/**
 * assetFormUtil.js
 * Form state structures, validations, and payload transformations for assets.
 * Pure helper without UI or React Native dependencies.
 */

import { rupeesToPaise, paiseToRupees } from './currency';
import { isoToDateString } from './dateUtil.js';

export const ATTRIBUTE_FIELDS = {
  PUMP: [
    { key: 'hp', label: 'attrHp', kind: 'number' },
    { key: 'make', label: 'attrMake', kind: 'text' },
    { key: 'model', label: 'attrModel', kind: 'text' },
    { key: 'serialNo', label: 'attrSerialNo', kind: 'text' },
  ],
  TANK: [
    { key: 'capacityL', label: 'attrCapacityL', kind: 'number' },
    { key: 'material', label: 'attrMaterial', kind: 'text' },
  ],
  PIPELINE: [
    { key: 'lengthM', label: 'attrLengthM', kind: 'number' },
    { key: 'material', label: 'attrMaterial', kind: 'text' },
    { key: 'diameterMm', label: 'attrDiameterMm', kind: 'number' },
  ],
  VALVE: [
    { key: 'valveType', label: 'attrValveType', kind: 'text' },
    { key: 'diameterMm', label: 'attrDiameterMm', kind: 'number' },
  ],
  SOURCE: [
    { key: 'sourceType', label: 'attrSourceType', kind: 'text' },
    { key: 'depthM', label: 'attrDepthM', kind: 'number' },
  ],
  TREATMENT_PLANT: [
    { key: 'treatmentType', label: 'attrTreatmentType', kind: 'text' },
    { key: 'capacityLPD', label: 'attrCapacityLPD', kind: 'number' },
  ],
  STANDPOST: [],
};

export function emptyForm() {
  return {
    name: '',
    type: '',
    status: 'WORKING',
    installDate: '',
    warrantyExpiry: '',
    lat: '',
    lng: '',
    cost: '',
    notes: '',
    statusNote: '',
    photoUrl: '',
    attributes: {},
  };
}

export function assetToForm(asset) {
  if (!asset) return emptyForm();

  const attrs = {};
  if (asset.attributes && typeof asset.attributes === 'object') {
    for (const [k, v] of Object.entries(asset.attributes)) {
      if (v !== null && v !== undefined) {
        attrs[k] = String(v);
      }
    }
  }

  return {
    name: asset.name || '',
    type: asset.type || '',
    status: asset.status || 'WORKING',
    installDate: isoToDateString(asset.installDate),
    warrantyExpiry: isoToDateString(asset.warrantyExpiry),
    lat: asset.lat !== null && asset.lat !== undefined ? String(asset.lat) : '',
    lng: asset.lng !== null && asset.lng !== undefined ? String(asset.lng) : '',
    cost: paiseToRupees(asset.cost),
    notes: asset.notes || '',
    statusNote: '',
    photoUrl: asset.photoUrl || '',
    attributes: attrs,
  };
}

export function validateForm(form, { mode = 'add', today = '' } = {}) {
  const errors = { attributes: {} };

  // Name validation: trimmed, 2 to 100 characters
  const trimmedName = form.name ? form.name.trim() : '';
  if (!trimmedName) {
    errors.name = 'errNameRequired';
  } else if (trimmedName.length < 2 || trimmedName.length > 100) {
    errors.name = 'errNameLength';
  }

  // Type validation: required in add mode
  if (mode === 'add' && !form.type) {
    errors.type = 'errTypeRequired';
  }

  // Lat and lng validation: must be both filled or both empty
  const hasLat = form.lat !== null && form.lat !== undefined && String(form.lat).trim() !== '';
  const hasLng = form.lng !== null && form.lng !== undefined && String(form.lng).trim() !== '';

  if ((hasLat && !hasLng) || (!hasLat && hasLng)) {
    errors.lat = 'errLatLngTogether';
    errors.lng = 'errLatLngTogether';
  } else if (hasLat && hasLng) {
    const latNorm = String(form.lat).trim().replace(',', '.');
    const lngNorm = String(form.lng).trim().replace(',', '.');
    const latNum = Number(latNorm);
    const lngNum = Number(lngNorm);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      errors.lat = 'errLatRange';
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      errors.lng = 'errLngRange';
    }
  }

  // Install date: not in the future (after today)
  if (form.installDate && today && form.installDate > today) {
    errors.installDate = 'errInstallDateFuture';
  }

  // Cost: via rupeesToPaise must not be NaN
  if (form.cost !== null && form.cost !== undefined && String(form.cost).trim() !== '') {
    const paise = rupeesToPaise(form.cost);
    if (isNaN(paise) || paise < 0) {
      errors.cost = 'errCostInvalid';
    }
  }

  // Type-specific attributes
  const typeFields = ATTRIBUTE_FIELDS[form.type] || [];
  for (const field of typeFields) {
    const rawVal = form.attributes ? form.attributes[field.key] : undefined;
    if (rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '') {
      const val = String(rawVal).trim();
      if (field.kind === 'number') {
        const numVal = Number(val.replace(',', '.'));
        if (isNaN(numVal) || numVal <= 0) {
          errors.attributes[field.key] = 'errAttrNumberPositive';
        }
      } else if (field.kind === 'text') {
        if (val.length > 100) {
          errors.attributes[field.key] = 'errAttrTextLength';
        }
      }
    }
  }

  // Notes: max 1000 characters
  if (form.notes && form.notes.trim().length > 1000) {
    errors.notes = 'errNotesLength';
  }

  // Status note: max 300 characters
  if (form.statusNote && form.statusNote.trim().length > 300) {
    errors.statusNote = 'errStatusNoteLength';
  }

  const hasTopErrors = Object.keys(errors).filter((k) => k !== 'attributes').length > 0;
  const hasAttrErrors = Object.keys(errors.attributes).length > 0;
  const valid = !hasTopErrors && !hasAttrErrors;

  return { valid, errors };
}

export function buildCreatePayload(form) {
  const payload = {
    name: form.name.trim(),
    type: form.type,
    status: form.status || 'WORKING',
  };

  if (form.notes && form.notes.trim()) {
    payload.notes = form.notes.trim();
  }

  if (form.installDate) {
    payload.installDate = form.installDate;
  }

  if (form.warrantyExpiry) {
    payload.warrantyExpiry = form.warrantyExpiry;
  }

  const hasLat = form.lat !== null && form.lat !== undefined && String(form.lat).trim() !== '';
  const hasLng = form.lng !== null && form.lng !== undefined && String(form.lng).trim() !== '';
  if (hasLat && hasLng) {
    payload.lat = Number(String(form.lat).trim().replace(',', '.'));
    payload.lng = Number(String(form.lng).trim().replace(',', '.'));
  }

  if (form.cost !== null && form.cost !== undefined && String(form.cost).trim() !== '') {
    const paise = rupeesToPaise(form.cost);
    if (!isNaN(paise) && paise !== null) {
      payload.cost = paise;
    }
  }

  if (form.photoUrl && form.photoUrl.trim()) {
    payload.photoUrl = form.photoUrl.trim();
  }

  const typeFields = ATTRIBUTE_FIELDS[form.type] || [];
  const attrs = {};
  for (const field of typeFields) {
    const rawVal = form.attributes ? form.attributes[field.key] : undefined;
    if (rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '') {
      const val = String(rawVal).trim();
      if (field.kind === 'number') {
        attrs[field.key] = Number(val.replace(',', '.'));
      } else {
        attrs[field.key] = val;
      }
    }
  }

  if (Object.keys(attrs).length > 0) {
    payload.attributes = attrs;
  }

  return payload;
}

export function buildUpdatePayload(form, original) {
  const payload = {};
  if (!original) return payload;

  // Name (cannot be null)
  const newName = form.name ? form.name.trim() : '';
  const origName = original.name ? original.name.trim() : '';
  if (newName !== origName && newName) {
    payload.name = newName;
  }

  // Status and statusNote
  if (form.status !== original.status) {
    payload.status = form.status;
    if (form.statusNote && form.statusNote.trim()) {
      payload.statusNote = form.statusNote.trim();
    }
  }

  // Install date
  const newInstall = form.installDate || '';
  const origInstall = original.installDate || '';
  if (newInstall !== origInstall) {
    payload.installDate = newInstall ? newInstall : null;
  }

  // Warranty expiry
  const newWarranty = form.warrantyExpiry || '';
  const origWarranty = original.warrantyExpiry || '';
  if (newWarranty !== origWarranty) {
    payload.warrantyExpiry = newWarranty ? newWarranty : null;
  }

  // Notes
  const newNotes = form.notes ? form.notes.trim() : '';
  const origNotes = original.notes ? original.notes.trim() : '';
  if (newNotes !== origNotes) {
    payload.notes = newNotes ? newNotes : null;
  }

  // Cost
  const newCostPaise = rupeesToPaise(form.cost);
  const origCostPaise = rupeesToPaise(original.cost);
  if (newCostPaise !== origCostPaise) {
    payload.cost = newCostPaise !== null ? newCostPaise : null;
  }

  // Photo URL
  const newPhotoUrl = form.photoUrl ? form.photoUrl.trim() : '';
  const origPhotoUrl = original.photoUrl ? original.photoUrl.trim() : '';
  if (newPhotoUrl !== origPhotoUrl) {
    payload.photoUrl = newPhotoUrl ? newPhotoUrl : null;
  }

  // Lat and lng (must send both if either changed)
  const hasNewLat = form.lat !== null && form.lat !== undefined && String(form.lat).trim() !== '';
  const hasNewLng = form.lng !== null && form.lng !== undefined && String(form.lng).trim() !== '';
  const hasOrigLat = original.lat !== null && original.lat !== undefined && String(original.lat).trim() !== '';
  const hasOrigLng = original.lng !== null && original.lng !== undefined && String(original.lng).trim() !== '';

  const newLatNum = hasNewLat ? Number(String(form.lat).trim().replace(',', '.')) : null;
  const newLngNum = hasNewLng ? Number(String(form.lng).trim().replace(',', '.')) : null;
  const origLatNum = hasOrigLat ? Number(String(original.lat).trim().replace(',', '.')) : null;
  const origLngNum = hasOrigLng ? Number(String(original.lng).trim().replace(',', '.')) : null;

  if (newLatNum !== origLatNum || newLngNum !== origLngNum) {
    payload.lat = newLatNum;
    payload.lng = newLngNum;
  }

  // Attributes: check if any changed
  const typeFields = ATTRIBUTE_FIELDS[form.type] || [];
  let attrsChanged = false;
  const newAttrs = {};

  for (const field of typeFields) {
    const rawVal = form.attributes ? form.attributes[field.key] : undefined;
    const origRawVal = original.attributes ? original.attributes[field.key] : undefined;

    let parsedNew = null;
    if (rawVal !== null && rawVal !== undefined && String(rawVal).trim() !== '') {
      const trimmedVal = String(rawVal).trim();
      parsedNew = field.kind === 'number' ? Number(trimmedVal.replace(',', '.')) : trimmedVal;
      newAttrs[field.key] = parsedNew;
    }

    let parsedOrig = null;
    if (origRawVal !== null && origRawVal !== undefined && String(origRawVal).trim() !== '') {
      const trimmedOrig = String(origRawVal).trim();
      parsedOrig = field.kind === 'number' ? Number(trimmedOrig.replace(',', '.')) : trimmedOrig;
    }

    if (parsedNew !== parsedOrig) {
      attrsChanged = true;
    }
  }

  if (attrsChanged) {
    payload.attributes = Object.keys(newAttrs).length > 0 ? newAttrs : null;
  }

  return payload;
}
