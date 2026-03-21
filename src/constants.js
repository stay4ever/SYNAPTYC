/**
 * src/constants.js — App-wide constants for SYNAPTYC
 */
'use strict';

const { Platform } = require('react-native');

const BASE_URL    = 'https://nano-synapsys-server.fly.dev';
const WS_URL      = 'wss://nano-synapsys-server.fly.dev/chat/websocket';
const JWT_KEY     = 'nano_jwt';
const USER_KEY    = 'nano_user';
const BIO_KEY         = 'nano_bio_enabled';
const BIO_REFRESH_KEY = 'nano_bio_refresh';
const BIO_EMAIL_KEY   = 'nano_bio_email';
const BIO_PASS_KEY    = 'nano_bio_pass';
const SKIN_KEY      = 'nano_skin';
const DISAPPEAR_KEY = 'nano_disappear';
const PROFILE_EXT_KEY = 'nano_profile_ext';
const LOCATION_KEY    = 'nano_location';
const NOTIF_KEY       = 'nano_notif_enabled';
const BANNER_PERM_MSGS_KEY = 'banner_perm_msgs';
const BANNER_PERM_SEND_KEY = 'banner_perm_send';
const BANNER_PERM_CAL_KEY  = 'banner_perm_cal';
const BANNER_PERM_CON_KEY  = 'banner_perm_con';
const DEVICE_ID_KEY      = 'nano_device_id';
const SKIP_AUTH_KEY      = 'nano_skip_auth';
const BANNER_ENABLED_KEY = 'nano_banner_enabled';
const PROFILE_IMAGE_KEY  = 'nano_profile_image';

const DISAPPEAR_OPTIONS = [
  { label: 'OFF',     value: null   },
  { label: '1 MIN',   value: 60     },
  { label: '5 MIN',   value: 300    },
  { label: '10 MIN',  value: 600    },
  { label: '5 DAYS',  value: 432000 },
  { label: '10 DAYS', value: 864000 },
  { label: '30 DAYS', value: 2592000},
];

const KAV_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';

module.exports = {
  BASE_URL,
  WS_URL,
  JWT_KEY,
  USER_KEY,
  BIO_KEY,
  BIO_REFRESH_KEY,
  BIO_EMAIL_KEY,
  BIO_PASS_KEY,
  SKIN_KEY,
  DISAPPEAR_KEY,
  PROFILE_EXT_KEY,
  LOCATION_KEY,
  NOTIF_KEY,
  BANNER_PERM_MSGS_KEY,
  BANNER_PERM_SEND_KEY,
  BANNER_PERM_CAL_KEY,
  BANNER_PERM_CON_KEY,
  DEVICE_ID_KEY,
  SKIP_AUTH_KEY,
  BANNER_ENABLED_KEY,
  PROFILE_IMAGE_KEY,
  DISAPPEAR_OPTIONS,
  KAV_BEHAVIOR,
};
