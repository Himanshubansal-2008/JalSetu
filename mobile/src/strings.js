export const strings = {
  appName: 'JalSetu',

  // Auth & General Actions
  login: 'Login',
  signup: 'Sign Up',
  createAccount: 'Create account',
  logout: 'Logout',
  comingSoon: 'Coming soon',
  loggedInAs: 'Logged in as:',
  role: 'Role:',
  orTryDemo: 'Or explore with demo account',
  demoAdminLogin: 'Demo Admin',
  demoWorkerLogin: 'Demo Worker',

  // Navigation Links
  dontHaveAccount: "Don't have an account? Sign up",
  alreadyHaveAccount: 'Already have an account? Log in',

  // Form Field Labels & Placeholders
  phoneLabel: 'Phone Number',
  phonePlaceholder: '10-digit mobile number',
  passwordLabel: 'Password',
  passwordPlaceholder: 'At least 6 characters',
  gpNameLabel: 'Gram Panchayat Name',
  gpNamePlaceholder: 'e.g. Rampur GP',
  villageLabel: 'Village',
  villagePlaceholder: 'e.g. Rampur',
  districtLabel: 'District',
  districtPlaceholder: 'e.g. Varanasi',
  stateLabel: 'State',
  statePlaceholder: 'e.g. Uttar Pradesh',
  nameLabel: 'Your Name',
  namePlaceholder: 'Full Name',

  // Tab Titles
  dashboard: 'Dashboard',
  home: 'Home',
  assets: 'Assets',
  map: 'Map',
  assetsMap: 'Assets Map',
  inventory: 'Inventory',
  finance: 'Finance',
  consumers: 'Consumers',

  // Validation Messages
  phoneRequired: 'Phone must be 10 digits',
  passwordRequired: 'Password must be at least 6 characters',
  gpNameRequired: 'GP name must be at least 2 characters',
  villageRequired: 'Village must be at least 2 characters',
  districtRequired: 'District must be at least 2 characters',
  stateRequired: 'State must be at least 2 characters',
  nameRequired: 'Name must be at least 2 characters',

  // Error Messages
  networkError:
    'Could not connect to the server. Please check that the backend is running and your device is on the same Wi-Fi network, then try again.',
  genericError: 'Something went wrong. Please try again.',

  // Asset Types
  assetTypeSource: 'Source',
  assetTypePump: 'Pump',
  assetTypePipeline: 'Pipeline',
  assetTypeValve: 'Valve',
  assetTypeTank: 'Tank',
  assetTypeTreatmentPlant: 'Treatment plant',
  assetTypeStandpost: 'Standpost',

  // Asset Statuses
  assetStatusWorking: 'Working',
  assetStatusFaulty: 'Faulty',
  assetStatusUnderRepair: 'Under repair',

  // Asset Units
  unitHp: 'HP',
  unitLiter: 'L',
  unitMeter: 'm',
  unitMm: 'mm',
  unitLpd: 'L/day',

  // Asset Navigation & Headers
  assetsTitle: 'Assets',
  addAsset: 'Add asset',
  add: '+ Add',
  addAssetTitle: 'Add asset',
  editAssetTitle: 'Edit asset',
  assetFormTitle: 'New Asset',
  assetDetailTitle: 'Asset Details',

  // Asset List Search, Filters & Pagination
  searchAssetsPlaceholder: 'Search assets by name...',
  clearSearch: 'Clear search',
  clearFilters: 'Clear filters',
  retry: 'Retry',
  loadMore: 'Load more',
  dismiss: 'Dismiss',

  // Result counts
  assetCountSingular: '1 asset',
  assetCountPlural: '{count} assets',

  // Empty & Error states
  noAssetsYet: 'No assets yet',
  noAssetsMatch: 'No assets match your filters',

  // Asset Form Screen & Labels
  assetNameLabel: 'Name',
  assetNamePlaceholder: 'e.g. Main Village Pump',
  typeLabel: 'Type',
  statusLabel: 'Status',
  typeCannotBeChanged: 'Type cannot be changed',
  installDateLabel: 'Installation date',
  warrantyExpiryLabel: 'Warranty expiry',
  latLabel: 'Latitude',
  latPlaceholder: 'e.g. 25.3176',
  lngLabel: 'Longitude',
  lngPlaceholder: 'e.g. 82.9739',
  locationHint: 'Map picker and GPS will be available in a future update',
  costLabel: 'Cost in rupees',
  costPlaceholder: 'e.g. 15000',
  currencySymbol: '₹',
  notesLabel: 'Notes',
  notesPlaceholder: 'Add any extra details, landmarks, etc.',
  statusNoteLabel: 'Reason for status change',
  statusNotePlaceholder: 'Explain why status changed (e.g. replaced burnt motor)',
  selectDatePlaceholder: 'Select date',
  save: 'Save',
  edit: 'Edit',
  done: 'Done',
  clearDate: 'Clear date',

  // Attribute Labels
  attrHp: 'Horsepower (HP)',
  attrMake: 'Make',
  attrModel: 'Model',
  attrSerialNo: 'Serial number',
  attrCapacityL: 'Capacity (L)',
  attrMaterial: 'Material',
  attrLengthM: 'Length (m)',
  attrDiameterMm: 'Diameter (mm)',
  attrValveType: 'Valve type',
  attrSourceType: 'Source type',
  attrDepthM: 'Depth (m)',
  attrTreatmentType: 'Treatment type',
  attrCapacityLPD: 'Capacity (L/day)',

  // Form Validation Error Keys
  errNameRequired: 'Name is required',
  errNameLength: 'Name must be between 2 and 100 characters',
  errTypeRequired: 'Type is required',
  errLatLngTogether: 'Latitude and longitude must both be provided or both left empty',
  errLatRange: 'Latitude must be between -90 and 90',
  errLngRange: 'Longitude must be between -180 and 180',
  errInstallDateFuture: 'Installation date cannot be in the future',
  errCostInvalid: 'Cost must be a valid positive amount',
  errAttrNumberPositive: 'Value must be greater than 0',
  errAttrTextLength: 'Value must not exceed 100 characters',
  errNotesLength: 'Notes must not exceed 1000 characters',
  errStatusNoteLength: 'Status note must not exceed 300 characters',

  // Form Alerts & Feedback
  fixHighlightedErrors: 'Please fix the highlighted fields',
  noChangesToSave: 'No changes to save',
  assetNotFound: 'This asset no longer exists',
  goBack: 'Go back',
  discardChangesTitle: 'Discard changes?',
  discardChangesMessage: 'You have unsaved changes. Are you sure you want to discard them?',
  keepEditing: 'Keep editing',
  discard: 'Discard',

  // Detail Screen Sections & Details
  detailsSection: 'Details',
  specificationsSection: 'Specifications',
  notesSection: 'Notes',
  historySection: 'History',
  historyCountTitle: 'History ({count})',
  addedOnLabel: 'Added on',
  locationLabel: 'Location',
  expiredBadge: 'Expired',
  emDash: '—',

  // History Section
  noHistoryYet: 'No history or notes recorded yet.',
  showingLatest50Entries: 'Showing the latest 50 entries',
  historyMeta: 'by {name} · {date}',
  byAuthor: 'by {name}',
  unknownUser: 'Unknown',
  statusChangedFrom: 'Status changed from',
  to: 'to',
  viewPhoto: 'View Photo',

  // Event Kind Labels
  eventStatusChange: 'Status Change',
  eventRepair: 'Repair',
  eventInspection: 'Inspection',
  eventNote: 'Note',
  eventUpdate: 'Update',

  // Delete Flow
  delete: 'Delete',
  cancel: 'Cancel',
  ok: 'OK',
  deleteAssetConfirmTitle: 'Delete asset?',
  deleteAssetConfirmMessage:
    'Are you sure you want to delete "{name}"? This cannot be undone and the history will be deleted too.',
  onlyAdminCanDelete: 'Only an admin can delete assets',

  // Location
  useMyLocation: 'Use my location',
  gettingLocation: 'Getting location...',
  locationPermissionTitle: 'Location Permission Needed',
  locationPermissionMessage:
    'Location permission is needed to automatically fill coordinates for this asset. You can enable it in settings or enter coordinates manually.',
  openSettings: 'Open Settings',
  locationServicesDisabledTitle: 'Location Services Disabled',
  locationServicesDisabledMessage:
    'Location services are turned off on your device. Please enable location services in settings, or enter coordinates manually.',
  locationErrorTitle: 'Location Error',
  locationErrorMessage:
    'Unable to acquire current location. Please check your GPS signal or enter coordinates manually.',

  // Map Picker
  pickOnMap: 'Pick on map',
  pickOnMapTitle: 'Pick Location on Map',
  tapToPlacePin: 'Tap on the map to place a location pin',
  dragPinHint: 'Drag the pin or tap elsewhere to adjust',
  selectedCoordinates: 'Selected: {lat}, {lng}',
  confirmLocation: 'Confirm location',
  loadingMap: 'Loading map...',

  // Map Screen
  all: 'All',
  viewDetails: 'View Details',
  noAssetsWithLocation: 'No assets with GPS coordinates found yet',
  noTypeAssetsOnMap: 'No {type} assets on map',
  legendTitle: 'Status',

  // Photo Helper
  selectPhotoSourceTitle: 'Add Photo',
  selectPhotoSourceMessage: 'Choose an option to attach a photo',
  takePhoto: 'Take Photo',
  chooseFromGallery: 'Choose from Gallery',
  cameraPermissionTitle: 'Camera Permission Needed',
  cameraPermissionMessage:
    'Camera permission is required to take photos. Please enable camera access in your device settings.',
  mediaLibraryPermissionTitle: 'Gallery Permission Needed',
  mediaLibraryPermissionMessage:
    'Photo gallery permission is required to select photos. Please enable media access in your device settings.',
  photoLabel: 'Asset Photo',
  changePhoto: 'Change Photo',
  removePhoto: 'Remove Photo',
  uploadingPhoto: 'Uploading... {progress}%',
  uploadFailedTitle: 'Upload Failed',
  uploadFailedMessage:
    'Failed to upload photo to Cloudinary. Would you like to retry?',

  // Add Note / History Event
  addNote: 'Add Note',
  addNoteTitle: 'Add Note',
  eventKindLabel: 'Event Type',
  eventNoteLabel: 'Note',
  eventNotePlaceholder:
    'Describe the repair, inspection finding, or observation...',
  errNoteRequired: 'Note cannot be empty',
  saveNote: 'Save Note',
  attachPhotoOptional: 'Attach Photo (Optional)',

  // Location Map Preview & Google Maps
  locationNotRecorded: 'Location coordinates not recorded',
  openInGoogleMaps: 'Open in Google Maps',
  mapsErrorTitle: 'Unable to Open Maps',
  mapsErrorMessage:
    'Could not open Google Maps or web browser on this device.',

  // Inventory
  inventoryTitle: 'Inventory',
  addItem: '+ Add item',
  addItemTitle: 'Add Inventory Item',
  addInventoryItem: 'Add Inventory Item',
  editInventoryItem: 'Edit Inventory Item',
  saveItem: 'Save Item',
  itemNameLabel: 'Item Name',
  itemNamePlaceholder: 'e.g. Bleaching Powder, PVC Pipe 2-inch',
  unitLabel: 'Unit',
  unitPlaceholder: 'e.g. kg, pcs, litres, bags',
  quantityLabel: 'Opening Quantity',
  quantityPlaceholder: '0',
  reorderLevelLabel: 'Reorder Level',
  reorderLevelPlaceholder: '0',
  reorderLevelHint: 'Triggers the low-stock alert when stock drops to or below this value',
  quantityLockedHint: 'Use Stock IN / Stock OUT on the item screen to adjust stock',
  errItemNameRequired: 'Item name is required',
  errUnitRequired: 'Unit is required',
  errQuantityInvalid: 'Opening quantity must be 0 or greater',
  errReorderLevelInvalid: 'Reorder level must be 0 or greater',
  onlyAdminCanManageInventory: 'Only administrators can create or edit inventory items',
  inventoryDetailTitle: 'Item Details',
  searchInventoryPlaceholder: 'Search items by name...',
  lowStockOnly: 'Low stock only',
  lowStockBadge: 'Low stock',
  lowStockBannerSingular: '⚠️ 1 item at or below reorder level',
  lowStockBannerPlural: '⚠️ {count} items at or below reorder level',
  noInventoryYet: 'No inventory items yet',
  noInventoryMatch: 'No items match your filter',
  itemCountSingular: '1 item',
  itemCountPlural: '{count} items',
};
