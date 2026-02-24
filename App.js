/**
 * nano-SYNAPSYS
 * AI Evolution secure messaging + bot client
 * React Native (Expo) — single-file architecture
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
  createContext,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

// ---------------------------------------------------------------------------
// COLOUR PALETTES
// ---------------------------------------------------------------------------
const GREEN_C = {
  bg:          '#050f05',
  surface:     '#0a1a0a',
  panel:       '#0d200d',
  border:      '#1a3a1a',
  borderBright:'#00C83240',
  text:        '#aad0aa',
  bright:      '#e8f8e8',
  dim:         '#4a8a4a',
  muted:       '#2a5a2a',
  accent:      '#00FF41',
  green:       '#00C832',
  amber:       '#f59e0b',
  red:         '#ef4444',
};

const TACTICAL_C = {
  bg:          '#0c0c0e',
  surface:     '#141418',
  panel:       '#1a1a22',
  border:      '#28283a',
  borderBright:'#6878a050',
  text:        '#9090a8',
  bright:      '#d8d8ec',
  dim:         '#505068',
  muted:       '#2c2c3c',
  accent:      '#a8b8cc',
  green:       '#6888a0',
  amber:       '#b89060',
  red:         '#c04848',
};

// ---------------------------------------------------------------------------
// STYLES FACTORY  (called once per palette → two static StyleSheet objects)
// ---------------------------------------------------------------------------
function makeRawStyles(C) {
  const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
  return {
    flex:       { flex: 1 },
    safeArea:   { flex: 1, backgroundColor: C.bg },
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    splashScreen: {
      flex: 1, backgroundColor: C.bg,
      alignItems: 'center', justifyContent: 'center', gap: 16,
    },
    splashTitle: {
      fontFamily: mono, fontSize: 28, fontWeight: '700',
      color: C.accent, letterSpacing: 2,
      textShadowColor: C.accent, textShadowRadius: 8,
      textShadowOffset: { width: 0, height: 0 },
    },
    splashSub: { fontFamily: mono, fontSize: 12, color: C.dim, letterSpacing: 4 },

    appHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.surface,
      borderBottomWidth: 1, borderBottomColor: C.border,
      paddingHorizontal: 12, paddingVertical: 10,
    },
    appHeaderTitle: {
      fontFamily: mono, fontSize: 16, fontWeight: '700',
      color: C.bright, letterSpacing: 1, textAlign: 'center',
    },
    backBtn:     { paddingVertical: 4, paddingRight: 8 },
    backBtnText: { fontFamily: mono, fontSize: 13, color: C.accent },

    homeHeader: {
      backgroundColor: C.surface,
      borderBottomWidth: 1, borderBottomColor: C.border,
      paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center',
    },
    homeTitle: {
      fontFamily: mono, fontSize: 22, fontWeight: '800',
      color: C.accent, letterSpacing: 2,
      textShadowColor: C.accent, textShadowRadius: 6,
      textShadowOffset: { width: 0, height: 0 },
    },
    homeSubtitle: { fontFamily: mono, fontSize: 10, color: C.dim, letterSpacing: 4, marginTop: 2 },

    tabBar: {
      flexDirection: 'row', backgroundColor: C.surface,
      borderTopWidth: 1, borderTopColor: C.border,
    },
    tabItem:    { flex: 1, alignItems: 'center', paddingVertical: 7, position: 'relative' },
    tabIcon:    { fontSize: 18, textAlign: 'center', marginBottom: 2 },
    tabText:    { fontFamily: mono, fontSize: 8, color: C.dim, letterSpacing: 0.5 },
    tabTextActive: { color: C.accent, fontWeight: '700' },
    tabIndicator: {
      position: 'absolute', top: 0, left: '20%', right: '20%',
      height: 2, backgroundColor: C.accent,
    },

    authScroll: {
      flexGrow: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center',
    },
    logoBlock: { alignItems: 'center', marginBottom: 40 },
    logoText: {
      fontFamily: mono, fontSize: 26, fontWeight: '800',
      color: C.accent, letterSpacing: 2,
      textShadowColor: C.accent, textShadowRadius: 10,
      textShadowOffset: { width: 0, height: 0 },
    },
    logoSub: { fontFamily: mono, fontSize: 10, color: C.dim, letterSpacing: 4, marginTop: 6 },
    authTabRow: {
      flexDirection: 'row', borderWidth: 1, borderColor: C.border,
      marginBottom: 24, backgroundColor: C.surface,
    },
    authTab:       { flex: 1, paddingVertical: 10, alignItems: 'center' },
    authTabActive: { backgroundColor: C.panel, borderBottomWidth: 2, borderBottomColor: C.accent },
    authTabText:       { fontFamily: mono, fontSize: 13, color: C.dim, letterSpacing: 1 },
    authTabTextActive: { color: C.accent, fontWeight: '700' },
    authForm: { gap: 12 },

    input: {
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      color: C.bright, paddingHorizontal: 14, paddingVertical: 12,
      fontFamily: mono, fontSize: 14, letterSpacing: 1,
    },
    inputMultiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },

    primaryBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.green,
      alignItems: 'center', paddingVertical: 14,
    },
    primaryBtnDisabled: { borderColor: C.muted, opacity: 0.6 },
    primaryBtnText: {
      fontFamily: mono, fontSize: 14, fontWeight: '700', color: C.accent, letterSpacing: 2,
    },
    ghostBtn: {
      backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border,
      alignItems: 'center', paddingVertical: 14,
    },
    ghostBtnText: { fontFamily: mono, fontSize: 13, color: C.dim, letterSpacing: 1 },

    errText: {
      color: C.red, fontFamily: mono, fontSize: 12,
      paddingHorizontal: 16, paddingVertical: 8,
    },
    emptyText: {
      color: C.muted, fontFamily: mono, fontSize: 13,
      textAlign: 'center', marginTop: 40, letterSpacing: 2,
    },

    separator: { height: 1, backgroundColor: C.border },
    userRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.surface,
    },
    userRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    userRowInfo: { flex: 1, marginLeft: 10 },
    userRowName: { fontFamily: mono, fontSize: 15, color: C.bright, fontWeight: '600' },
    userRowMeta: { fontFamily: mono, fontSize: 11, color: C.dim, marginTop: 2, letterSpacing: 1 },
    chevron:     { color: C.dim, fontFamily: mono, fontSize: 16, marginLeft: 8 },

    dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },

    msgList:      { padding: 12, paddingBottom: 20 },
    msgRow:       { marginVertical: 4, flexDirection: 'row' },
    msgRowMine:   { justifyContent: 'flex-end' },
    msgRowTheirs: { justifyContent: 'flex-start' },
    msgBubble: {
      maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1,
    },
    bubbleMine: {
      backgroundColor: C.panel, borderColor: C.borderBright, borderRadius: 0,
    },
    bubbleTheirs: {
      backgroundColor: C.surface, borderColor: C.border, borderRadius: 0,
    },
    bubbleBotMsg: {
      backgroundColor: C.panel, borderColor: C.borderBright, borderRadius: 0,
    },
    msgText:    { fontFamily: mono, fontSize: 14, color: C.text, lineHeight: 20 },
    botMsgText: { color: C.bright },
    msgSender: {
      fontFamily: mono, fontSize: 10, color: C.accent,
      letterSpacing: 1, marginBottom: 4, fontWeight: '700',
    },
    botLabel: {
      fontFamily: mono, fontSize: 10, color: C.accent,
      letterSpacing: 2, fontWeight: '700', marginBottom: 4,
    },
    msgMeta: {
      flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'flex-end',
    },
    msgTime: { fontFamily: mono, fontSize: 10, color: C.muted, marginTop: 4 },
    msgRead: { fontFamily: mono, fontSize: 10, color: C.green },

    imageMsg: { width: 200, height: 150, marginVertical: 4 },

    inputRow: {
      flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border,
      backgroundColor: C.surface, padding: 8, alignItems: 'flex-end',
    },
    attachBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.border,
      width: 38, height: 38, justifyContent: 'center', alignItems: 'center', marginRight: 6,
    },
    attachBtnText: { fontFamily: mono, fontSize: 22, color: C.accent, lineHeight: 26 },
    chatInput: {
      flex: 1, color: C.bright, backgroundColor: C.panel,
      borderWidth: 1, borderColor: C.border,
      paddingHorizontal: 12, paddingVertical: 10,
      fontFamily: mono, fontSize: 14, maxHeight: 120, marginRight: 8,
    },
    sendBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.green,
      paddingHorizontal: 14, paddingVertical: 10,
      justifyContent: 'center', alignItems: 'center', minWidth: 60,
    },
    sendBtnDisabled: { borderColor: C.muted, opacity: 0.5 },
    sendBtnText: {
      fontFamily: mono, fontSize: 12, color: C.accent, fontWeight: '700', letterSpacing: 1,
    },

    createGroupBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.green,
      margin: 16, paddingVertical: 12, alignItems: 'center',
    },
    createGroupBtnText: {
      fontFamily: mono, fontSize: 13, color: C.accent, fontWeight: '700', letterSpacing: 2,
    },
    createGroupForm: {
      backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
      padding: 16, gap: 10,
    },
    formLabel: { fontFamily: mono, fontSize: 12, color: C.accent, letterSpacing: 2, marginBottom: 4 },
    formBtnRow: { flexDirection: 'row', marginTop: 4 },

    botHeader: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
      borderBottomWidth: 1, borderBottomColor: C.border,
      paddingHorizontal: 16, paddingVertical: 10,
    },
    botHeaderText: {
      fontFamily: mono, fontSize: 14, fontWeight: '700', color: C.accent, letterSpacing: 3,
    },

    profileScroll:  { padding: 16, paddingBottom: 60 },
    profileCard: {
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      padding: 14, marginBottom: 8,
    },
    profileLabel: { fontFamily: mono, fontSize: 10, color: C.dim, letterSpacing: 2, marginBottom: 4 },
    profileValue: { fontFamily: mono, fontSize: 15, color: C.bright, fontWeight: '600' },
    profileDivider: { height: 1, backgroundColor: C.border, marginVertical: 20 },
    inviteUrlBox: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.borderBright,
      padding: 14, marginTop: 12, gap: 8,
    },
    inviteUrlLabel: { fontFamily: mono, fontSize: 10, color: C.accent, letterSpacing: 2 },
    inviteUrlText:  { fontFamily: mono, fontSize: 12, color: C.text, lineHeight: 18 },
    copyBtn: {
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      paddingVertical: 8, alignItems: 'center', marginTop: 4,
    },
    copyBtnText: { fontFamily: mono, fontSize: 11, color: C.accent, letterSpacing: 1 },
    logoutBtn: {
      backgroundColor: 'transparent', borderWidth: 1, borderColor: C.red,
      paddingVertical: 14, alignItems: 'center',
    },
    logoutBtnText: {
      fontFamily: mono, fontSize: 14, fontWeight: '700', color: C.red, letterSpacing: 2,
    },

    // ── Settings / Skin ──────────────────────────────────────────────────
    settingsHeader: {
      fontFamily: mono, fontSize: 11, color: C.accent,
      letterSpacing: 3, marginBottom: 12, marginTop: 4,
    },
    skinRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
    skinBtn: {
      flex: 1, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border,
      paddingVertical: 14, alignItems: 'center', gap: 4,
    },
    skinBtnActive:     { borderColor: C.accent },
    skinDot:           { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
    skinBtnLabel:      { fontFamily: mono, fontSize: 9, color: C.dim, letterSpacing: 2 },
    skinBtnName:       { fontFamily: mono, fontSize: 13, fontWeight: '700', color: C.dim },
    skinBtnNameActive: { color: C.accent },

    // ── Disappearing messages ─────────────────────────────────────────────
    disappearWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    disappearOpt: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.border,
      paddingVertical: 8, paddingHorizontal: 12,
    },
    disappearOptActive:      { borderColor: C.accent },
    disappearOptText:        { fontFamily: mono, fontSize: 11, color: C.dim, letterSpacing: 1 },
    disappearOptTextActive:  { color: C.accent, fontWeight: '700' },

    // ── Contacts ──────────────────────────────────────────────────────────
    contactSection: {
      fontFamily: mono, fontSize: 11, color: C.accent,
      letterSpacing: 3, marginBottom: 8, marginTop: 4,
    },
    contactRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.surface,
    },
    contactRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    contactRowInfo: { flex: 1, marginLeft: 10 },
    contactRowName: { fontFamily: mono, fontSize: 15, color: C.bright, fontWeight: '600' },
    contactRowMeta: { fontFamily: mono, fontSize: 11, color: C.dim, marginTop: 2, letterSpacing: 1 },
    contactBtnRow: { flexDirection: 'row', gap: 6 },
    contactActionBtn: {
      borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10, borderColor: C.green,
    },
    contactActionBtnText: { fontFamily: mono, fontSize: 11, color: C.accent, letterSpacing: 1 },
    contactRejectBtn: { borderColor: C.red },
    contactRejectBtnText: { color: C.red },
    addContactBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.green,
      margin: 16, paddingVertical: 12, alignItems: 'center',
    },
    addContactBtnText: {
      fontFamily: mono, fontSize: 13, color: C.accent, fontWeight: '700', letterSpacing: 2,
    },
    pendingBadge: {
      backgroundColor: C.amber, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6,
    },
    pendingBadgeText: { fontFamily: mono, fontSize: 9, color: '#000', fontWeight: '700' },

    // ── Admin panel ────────────────────────────────────────────────────────
    adminCard: {
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.amber,
      padding: 14, marginBottom: 10,
    },
    adminCardLabel: { fontFamily: mono, fontSize: 10, color: C.amber, letterSpacing: 2, marginBottom: 6 },
    adminCardName:  { fontFamily: mono, fontSize: 15, color: C.bright, fontWeight: '700', marginBottom: 2 },
    adminCardEmail: { fontFamily: mono, fontSize: 12, color: C.dim, marginBottom: 4 },
    adminCardReason:{ fontFamily: mono, fontSize: 11, color: C.text, lineHeight: 16, marginBottom: 8 },
    adminBtnRow:    { flexDirection: 'row', gap: 8 },
    adminApproveBtn:{ flex: 1, borderWidth: 1, borderColor: C.green, paddingVertical: 9, alignItems: 'center' },
    adminApproveBtnText: { fontFamily: mono, fontSize: 11, color: C.accent, fontWeight: '700', letterSpacing: 1 },
    adminRejectBtn: { flex: 1, borderWidth: 1, borderColor: C.red, paddingVertical: 9, alignItems: 'center' },
    adminRejectBtnText:  { fontFamily: mono, fontSize: 11, color: C.red, fontWeight: '700', letterSpacing: 1 },

    // ── Profile Edit ──────────────────────────────────────────────────────
    profileEditHeader: {
      fontFamily: mono, fontSize: 11, color: C.accent,
      letterSpacing: 3, marginBottom: 10, marginTop: 4,
    },
    profileEditInput: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.border,
      color: C.bright, paddingHorizontal: 14, paddingVertical: 10,
      fontFamily: mono, fontSize: 14, letterSpacing: 1, marginTop: 6,
    },
    profileEditMultiline: { minHeight: 70, textAlignVertical: 'top', paddingTop: 10 },
    saveProfileBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.green,
      alignItems: 'center', paddingVertical: 13, marginTop: 10,
    },
    saveProfileBtnText: {
      fontFamily: mono, fontSize: 13, fontWeight: '700', color: C.accent, letterSpacing: 2,
    },
    saveOkText: { fontFamily: mono, fontSize: 11, color: C.green, textAlign: 'center', marginTop: 8, letterSpacing: 1 },

    // ── Location ──────────────────────────────────────────────────────────
    locationBox: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.borderBright,
      padding: 14, marginBottom: 8, gap: 4,
    },
    locationCoord: { fontFamily: mono, fontSize: 14, color: C.accent, letterSpacing: 1, fontWeight: '700' },
    locationMeta:  { fontFamily: mono, fontSize: 10, color: C.dim, letterSpacing: 1, marginTop: 2 },
    getLocationBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.green,
      alignItems: 'center', paddingVertical: 13, marginTop: 4,
    },
    getLocationBtnText: {
      fontFamily: mono, fontSize: 13, fontWeight: '700', color: C.accent, letterSpacing: 2,
    },

    // ── Face ID ───────────────────────────────────────────────────────────
    bioLoginBtn: {
      backgroundColor: 'transparent', borderWidth: 1, borderColor: C.accent,
      alignItems: 'center', paddingVertical: 14, marginTop: 4,
    },
    bioLoginBtnText: {
      fontFamily: mono, fontSize: 14, fontWeight: '700', color: C.accent, letterSpacing: 2,
    },
    bioFaceIcon:    { fontSize: 52, textAlign: 'center' },
    bioBtn:         { width: 240, alignSelf: 'center' },
    bioFallbackBtn: { marginTop: 28, paddingVertical: 8 },
    bioFallbackText: {
      fontFamily: mono, fontSize: 12, color: C.dim,
      letterSpacing: 1, textDecorationLine: 'underline',
    },
    bioDisableBtn: {
      backgroundColor: 'transparent', borderWidth: 1, borderColor: C.amber,
      paddingVertical: 14, alignItems: 'center',
    },
    bioDisableBtnText: {
      fontFamily: mono, fontSize: 14, fontWeight: '700', color: C.amber, letterSpacing: 2,
    },

    // ── Modal ─────────────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
      justifyContent: 'center', alignItems: 'center', padding: 24,
    },
    modalBox: {
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderBright,
      padding: 24, width: '100%', maxWidth: 380,
    },
    modalTitle: {
      fontFamily: mono, fontSize: 16, fontWeight: '800',
      color: C.accent, letterSpacing: 2, marginBottom: 8,
    },
    modalSub: { fontFamily: mono, fontSize: 12, color: C.dim, lineHeight: 18 },

    // ── Destructive actions (delete group / block contact) ────────────────
    deleteGroupBtn: {
      borderWidth: 1, borderColor: C.red,
      paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8,
    },
    deleteGroupBtnText: {
      fontFamily: mono, fontSize: 11, color: C.red, fontWeight: '700', letterSpacing: 1,
    },
    blockContactBtn: {
      borderWidth: 1, borderColor: C.red,
      paddingHorizontal: 10, paddingVertical: 6, marginLeft: 6,
    },
    blockContactBtnText: {
      fontFamily: mono, fontSize: 11, color: C.red, fontWeight: '700', letterSpacing: 1,
    },
  };
}

// Two pre-built StyleSheets — swap by skin name
const STYLES = {
  green:    StyleSheet.create(makeRawStyles(GREEN_C)),
  tactical: StyleSheet.create(makeRawStyles(TACTICAL_C)),
};

// ---------------------------------------------------------------------------
// SKIN CONTEXT
// ---------------------------------------------------------------------------
const SkinContext = createContext({ skin: 'green', setSkin: () => {} });

function SkinProvider({ children }) {
  const [skin, setSkinState] = useState('green');

  useEffect(() => {
    SecureStore.getItemAsync(SKIN_KEY).then(v => {
      if (v === 'tactical') setSkinState('tactical');
    });
  }, []);

  const setSkin = useCallback(async (s) => {
    setSkinState(s);
    await SecureStore.setItemAsync(SKIN_KEY, s);
  }, []);

  return (
    <SkinContext.Provider value={{ skin, setSkin }}>
      {children}
    </SkinContext.Provider>
  );
}

function useSkin() {
  const { skin, setSkin } = useContext(SkinContext);
  const C      = skin === 'tactical' ? TACTICAL_C : GREEN_C;
  const styles = STYLES[skin] ?? STYLES.green;
  return { skin, C, styles, setSkin };
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const BASE_URL    = 'https://www.ai-evolution.com.au';
const WS_URL      = 'wss://www.ai-evolution.com.au/chat';
const JWT_KEY     = 'nano_jwt';
const USER_KEY    = 'nano_user';
const BIO_KEY     = 'nano_bio_enabled';
const BIO_EMAIL_KEY = 'nano_bio_email';
const BIO_PASS_KEY  = 'nano_bio_pass';
const SKIN_KEY      = 'nano_skin';
const DISAPPEAR_KEY = 'nano_disappear';
const PROFILE_EXT_KEY = 'nano_profile_ext';
const LOCATION_KEY    = 'nano_location';

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

// ---------------------------------------------------------------------------
// API HELPER
// ---------------------------------------------------------------------------
async function api(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const msg =
      data?.detail || data?.message || data?.error ||
      (typeof data === 'string' ? data : null) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ---------------------------------------------------------------------------
// SECURE STORE HELPERS
// ---------------------------------------------------------------------------
async function saveToken(t) { await SecureStore.setItemAsync(JWT_KEY, t); }
async function loadToken()  { return SecureStore.getItemAsync(JWT_KEY); }
async function clearToken() { await SecureStore.deleteItemAsync(JWT_KEY); }
async function saveUser(u)  { await SecureStore.setItemAsync(USER_KEY, JSON.stringify(u)); }

async function clearUser()  { await SecureStore.deleteItemAsync(USER_KEY); }

async function saveBioEnabled(v) { await SecureStore.setItemAsync(BIO_KEY, v ? '1' : '0'); }
async function loadBioEnabled()  { return (await SecureStore.getItemAsync(BIO_KEY)) === '1'; }
async function clearBio() {
  await SecureStore.deleteItemAsync(BIO_KEY);
  await SecureStore.deleteItemAsync(BIO_EMAIL_KEY);
  await SecureStore.deleteItemAsync(BIO_PASS_KEY);
}
async function saveBioCreds(email, password) {
  await SecureStore.setItemAsync(BIO_EMAIL_KEY, email);
  await SecureStore.setItemAsync(BIO_PASS_KEY, password);
}
async function loadBioCreds() {
  const email    = await SecureStore.getItemAsync(BIO_EMAIL_KEY);
  const password = await SecureStore.getItemAsync(BIO_PASS_KEY);
  return email && password ? { email, password } : null;
}
async function isBiometricReady() {
  const hw  = await LocalAuthentication.hasHardwareAsync();
  const enr = await LocalAuthentication.isEnrolledAsync();
  return hw && enr;
}
async function saveDisappear(v) {
  await SecureStore.setItemAsync(DISAPPEAR_KEY, v === null ? '' : String(v));
}
async function loadDisappear() {
  const v = await SecureStore.getItemAsync(DISAPPEAR_KEY);
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}
async function saveProfileExt(data) {
  await SecureStore.setItemAsync(PROFILE_EXT_KEY, JSON.stringify(data));
}
async function loadProfileExt() {
  try {
    const v = await SecureStore.getItemAsync(PROFILE_EXT_KEY);
    return v ? JSON.parse(v) : {};
  } catch { return {}; }
}
async function saveLocation(loc) {
  await SecureStore.setItemAsync(LOCATION_KEY, JSON.stringify(loc));
}
async function loadLocation() {
  try {
    const v = await SecureStore.getItemAsync(LOCATION_KEY);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// FORMAT HELPERS
// ---------------------------------------------------------------------------
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}
function isImageContent(c) { return typeof c === 'string' && c.startsWith('data:image'); }

// ---------------------------------------------------------------------------
// THEMED WRAPPERS
// ---------------------------------------------------------------------------
function ThemedSafeArea({ style, children }) {
  const { skin, C } = useSkin();
  if (skin === 'tactical') {
    return (
      <ImageBackground
        source={require('./magpulbackground.webp')}
        style={{ flex: 1, backgroundColor: C.bg }}
        imageStyle={{ opacity: 0.07 }}
        resizeMode="repeat"
      >
        <SafeAreaView style={[{ flex: 1, backgroundColor: 'transparent' }, style]}>
          {children}
        </SafeAreaView>
      </ImageBackground>
    );
  }
  return (
    <SafeAreaView style={[{ flex: 1, backgroundColor: C.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

function ThemedView({ style, children }) {
  const { skin, C } = useSkin();
  if (skin === 'tactical') {
    return (
      <ImageBackground
        source={require('./magpulbackground.webp')}
        style={[{ flex: 1, backgroundColor: C.bg }, style]}
        imageStyle={{ opacity: 0.07 }}
        resizeMode="repeat"
      >
        {children}
      </ImageBackground>
    );
  }
  return <View style={[{ flex: 1, backgroundColor: C.bg }, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// SHARED UI ATOMS
// ---------------------------------------------------------------------------
function Spinner({ size = 'small' }) {
  const { C } = useSkin();
  return <ActivityIndicator color={C.accent} size={size} />;
}

function ErrText({ msg }) {
  const { styles } = useSkin();
  if (!msg) return null;
  return <Text style={styles.errText}>{msg}</Text>;
}

function OnlineDot({ online }) {
  const { C } = useSkin();
  return <View style={[{ width: 8, height: 8, borderRadius: 4, marginLeft: 4 }, { backgroundColor: online ? C.green : C.muted }]} />;
}

function AppHeader({ title, onBack }) {
  const { styles } = useSkin();
  return (
    <View style={styles.appHeader}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'< BACK'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 80 }} />
      )}
      <Text style={styles.appHeaderTitle}>{title}</Text>
      <View style={{ width: 80 }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// BOTTOM TAB BAR  (5 tabs)
// ---------------------------------------------------------------------------
const TABS = ['CHATS', 'CONTACTS', 'GROUPS', 'BOT', 'PROFILE', 'SETTINGS'];
const TAB_ICONS = {
  CHATS:    '\uD83D\uDCAC',
  CONTACTS: '\uD83D\uDCCB',
  GROUPS:   '\uD83D\uDC65',
  BOT:      '\uD83E\uDD16',
  PROFILE:  '\uD83D\uDC64',
  SETTINGS: '\u2699\uFE0F',
};

function TabBar({ active, onChange }) {
  const { styles, C } = useSkin();
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const isActive = tab === active;
        return (
          <TouchableOpacity key={tab} style={styles.tabItem} onPress={() => onChange(tab)}>
            {isActive && <View style={styles.tabIndicator} />}
            <Text style={[styles.tabIcon, { color: isActive ? C.accent : C.dim }]}>{TAB_ICONS[tab]}</Text>
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// BIOMETRIC UNLOCK SCREEN
// ---------------------------------------------------------------------------
function BiometricUnlockScreen({ onUnlock, onUsePassword }) {
  const { styles, C } = useSkin();
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  const tryBiometric = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:         'Unlock nano-SYNAPSYS',
        disableDeviceFallback: true,
      });
      if (result.success) { onUnlock(); }
      else if (result.error === 'lockout' || result.error === 'lockout_permanent') {
        setErr('Face ID locked. Tap "USE PASSWORD INSTEAD" below.');
      } else { setErr(result.error === 'user_cancel' ? '' : 'Authentication failed. Try again.'); }
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [onUnlock]);

  useEffect(() => { tryBiometric(); }, []);

  return (
    <ThemedSafeArea>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={styles.centerFill}>
        <Text style={styles.logoText}>nano-SYNAPSYS</Text>
        <Text style={styles.logoSub}>AI EVOLUTION SECURE MESH</Text>
        <View style={{ height: 48 }} />
        <Text style={styles.bioFaceIcon}>{'\uD83D\uDD12'}</Text>
        <View style={{ height: 24 }} />
        <TouchableOpacity
          style={[styles.primaryBtn, styles.bioBtn, loading && styles.primaryBtnDisabled]}
          onPress={tryBiometric} disabled={loading}
        >
          {loading ? <Spinner /> : <Text style={styles.primaryBtnText}>FACE ID LOGIN</Text>}
        </TouchableOpacity>
        <ErrText msg={err} />
        <TouchableOpacity style={styles.bioFallbackBtn} onPress={onUsePassword}>
          <Text style={styles.bioFallbackText}>USE PASSWORD INSTEAD</Text>
        </TouchableOpacity>
      </View>
    </ThemedSafeArea>
  );
}

// ---------------------------------------------------------------------------
// AUTH SCREEN
// ---------------------------------------------------------------------------
function AuthScreen({ onAuth }) {
  const { styles, C } = useSkin();
  const [tab, setTab]                 = useState('LOGIN');
  const [username, setUsername]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [inviteCode, setInviteCode]   = useState('');
  const [joinReason, setJoinReason]   = useState('');
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState('');
  const [bioSupported, setBioSupported] = useState(false);
  const [bioReady, setBioReady]         = useState(false);
  const [bioLoading, setBioLoading]     = useState(false);

  useEffect(() => {
    (async () => {
      const supported = await isBiometricReady();
      const enabled   = await loadBioEnabled();
      const creds     = await loadBioCreds();
      setBioSupported(supported);
      setBioReady(supported && enabled && !!creds);
    })();
  }, []);

  const reset = () => { setUsername(''); setEmail(''); setPassword(''); setInviteCode(''); setJoinReason(''); setErr(''); };
  const handleTabSwitch = (t) => { setTab(t); reset(); };

  const handleBioLogin = async () => {
    setBioLoading(true); setErr('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login to nano-SYNAPSYS', disableDeviceFallback: true,
      });
      if (!result.success) { setErr(result.error === 'user_cancel' ? '' : 'Face ID failed. Use password instead.'); return; }
      const creds = await loadBioCreds();
      if (!creds) { setErr('No stored credentials. Please log in with password.'); return; }
      const data = await api('/auth/login', 'POST', { email: creds.email, password: creds.password });
      await saveToken(data.token); await saveUser(data.user);
      onAuth(data.token, data.user);
    } catch (e) { setErr(e.message); }
    finally { setBioLoading(false); }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) { setErr('Email and password are required.'); return; }
    setLoading(true); setErr('');
    try {
      const data = await api('/auth/login', 'POST', { email: username.trim(), password });
      await saveToken(data.token); await saveUser(data.user);
      onAuth(data.token, data.user);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) { setErr('Username, email and password are required.'); return; }
    setLoading(true); setErr('');
    try {
      const body = { username: username.trim(), email: email.trim(), password, join_reason: joinReason.trim() };
      if (inviteCode.trim()) body.invite_code = inviteCode.trim();
      const data = await api('/auth/register', 'POST', body);
      await saveToken(data.token); await saveUser(data.user);
      onAuth(data.token, data.user);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <ThemedSafeArea>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView style={styles.flex} behavior={KAV_BEHAVIOR}>
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoBlock}>
            <Text style={styles.logoText}>nano-SYNAPSYS</Text>
            <Text style={styles.logoSub}>AI EVOLUTION SECURE MESH</Text>
          </View>
          <View style={styles.authTabRow}>
            {['LOGIN', 'REGISTER'].map((t) => (
              <TouchableOpacity key={t} style={[styles.authTab, tab === t && styles.authTabActive]} onPress={() => handleTabSwitch(t)}>
                <Text style={[styles.authTabText, tab === t && styles.authTabTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.authForm}>
            <TextInput
              style={styles.input}
              placeholder={tab === 'LOGIN' ? 'EMAIL' : 'USERNAME'}
              placeholderTextColor={C.muted}
              value={username} onChangeText={setUsername}
              autoCapitalize="none" autoCorrect={false}
              keyboardType={tab === 'LOGIN' ? 'email-address' : 'default'}
            />
            {tab === 'REGISTER' && (
              <TextInput style={styles.input} placeholder="EMAIL" placeholderTextColor={C.muted}
                value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} />
            )}
            <TextInput style={styles.input} placeholder="PASSWORD" placeholderTextColor={C.muted}
              value={password} onChangeText={setPassword} secureTextEntry />
            {tab === 'REGISTER' && (
              <TextInput style={styles.input} placeholder="INVITE CODE (OPTIONAL)" placeholderTextColor={C.muted}
                value={inviteCode} onChangeText={setInviteCode} autoCapitalize="none" autoCorrect={false} />
            )}
            {tab === 'REGISTER' && (
              <TextInput style={[styles.input, styles.inputMultiline]}
                placeholder="WHY DO YOU WANT TO JOIN? (REQUIRED)" placeholderTextColor={C.muted}
                value={joinReason} onChangeText={setJoinReason}
                multiline numberOfLines={3} textAlignVertical="top" autoCorrect={false} />
            )}
            <ErrText msg={err} />
            <TouchableOpacity style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={tab === 'LOGIN' ? handleLogin : handleRegister} disabled={loading}>
              {loading ? <Spinner /> : <Text style={styles.primaryBtnText}>{tab === 'LOGIN' ? 'LOGIN' : 'CREATE ACCOUNT'}</Text>}
            </TouchableOpacity>
            {tab === 'LOGIN' && bioSupported && (
              <TouchableOpacity style={[styles.bioLoginBtn, bioLoading && styles.primaryBtnDisabled]}
                onPress={bioReady ? handleBioLogin : () => Alert.alert('FACE ID NOT SET UP', 'Go to Profile tab and tap "ENABLE FACE ID LOGIN" to set up biometric login.')}
                disabled={bioLoading}>
                {bioLoading ? <Spinner /> : <Text style={styles.bioLoginBtnText}>{'\uD83D\uDD12'}  FACE ID LOGIN</Text>}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedSafeArea>
  );
}

// ---------------------------------------------------------------------------
// SWIPEABLE ROW  (pure Animated + PanResponder — no extra packages)
// Swipe left to reveal a destructive action button. Swipe right to close.
// ---------------------------------------------------------------------------
const _SWIPE_W = 76; // width of the revealed action button

function SwipeableRow({ children, rightLabel = 'DELETE', rightColor, onAction, disabled = false }) {
  const { C } = useSkin();
  const mono  = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
  const color = rightColor || C.red;

  // Single Animated.Value tracks the row's X position (0 = closed, -_SWIPE_W = open).
  // We never use setOffset/flattenOffset — those cause jumps when a new gesture starts
  // mid-animation. Instead we capture the real position via stopAnimation() at grant time.
  const position  = useRef(new Animated.Value(0)).current;
  const dragStart = useRef(0); // actual position when the finger goes down

  const snapTo = useCallback((toValue) => {
    Animated.spring(position, {
      toValue,
      useNativeDriver: true,
      bounciness: 0,   // no oscillation — clean mechanical snap
      speed: 20,
    }).start();
  }, [position]);

  const pan = useRef(PanResponder.create({
    // Only claim clearly horizontal gestures so vertical list scroll is unaffected
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      !disabled && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy) * 1.5,

    onPanResponderGrant: () => {
      // Stop any running snap animation and read the exact current pixel position
      position.stopAnimation((val) => { dragStart.current = val; });
    },

    onPanResponderMove: (_, { dx }) => {
      position.setValue(Math.max(-_SWIPE_W, Math.min(0, dragStart.current + dx)));
    },

    onPanResponderRelease: (_, { dx, vx }) => {
      const cur = Math.max(-_SWIPE_W, Math.min(0, dragStart.current + dx));
      // Fast leftward flick OR crossed the halfway mark → open; otherwise close
      if (vx < -0.3 || cur < -(_SWIPE_W / 2)) {
        snapTo(-_SWIPE_W);
      } else {
        snapTo(0);
      }
    },

    onPanResponderTerminate: () => snapTo(0),
  })).current;

  const handleAction = () => {
    snapTo(0);
    onAction && onAction();
  };

  return (
    <View style={{ overflow: 'hidden' }}>
      {/* Action button revealed behind the sliding row */}
      <View style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: _SWIPE_W, backgroundColor: color,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <TouchableOpacity
          onPress={handleAction}
          style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ fontFamily: mono, fontSize: 11, color: '#fff', fontWeight: '700', letterSpacing: 1 }}>
            {rightLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sliding content */}
      <Animated.View style={{ transform: [{ translateX: position }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CHATS TAB
// ---------------------------------------------------------------------------
function ChatsTab({ token, currentUser, onOpenDM }) {
  const { styles, C } = useSkin();
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr]             = useState('');

  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setErr('');
    try {
      const data = await api('/api/users', 'GET', null, token);
      setUsers(data.filter((u) => !u.isMe));
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, currentUser.id]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  if (loading) return <View style={styles.centerFill}><Spinner size="large" /></View>;

  return (
    <View style={styles.flex}>
      <ErrText msg={err} />
      <FlatList
        data={users} keyExtractor={(u) => String(u.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchUsers(true)} tintColor={C.accent} />}
        ListEmptyComponent={<Text style={styles.emptyText}>NO USERS FOUND</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.userRow} onPress={() => onOpenDM(item)}>
            <View style={styles.userRowLeft}>
              <OnlineDot online={item.online} />
              <View style={styles.userRowInfo}>
                <Text style={styles.userRowName}>{item.displayName || item.display_name || item.username}</Text>
                <Text style={styles.userRowMeta}>{item.online ? 'ONLINE' : item.last_seen ? `LAST SEEN ${fmtDate(item.last_seen)}` : 'OFFLINE'}</Text>
              </View>
            </View>
            <Text style={styles.chevron}>{'>'}</Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// DM CHAT SCREEN
// ---------------------------------------------------------------------------
function DMChatScreen({ token, currentUser, peer, onBack, wsRef, incomingMsg, disappear }) {
  const { styles, C } = useSkin();
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [err, setErr]           = useState('');
  const listRef                 = useRef(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const data = await api(`/api/messages/${peer.id}`, 'GET', null, token);
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [token, peer.id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    if (!incomingMsg || incomingMsg.type !== 'chat_message') return;
    // Handle both new snake_case (from_user) and legacy camelCase (from) field names
    const fromId = String(incomingMsg.from_user?.id ?? incomingMsg.from_user ?? incomingMsg.from);
    const toId   = String(incomingMsg.to);
    const peerId = String(peer.id);
    const meId   = String(currentUser.id);
    // Show only messages that belong to THIS conversation
    const belongs = (fromId === peerId && toId === meId) ||
                    (fromId === meId   && toId === peerId);
    if (belongs) {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === incomingMsg.id);
        return exists ? prev : [...prev, incomingMsg];
      });
    }
  }, [incomingMsg, peer.id, currentUser.id]);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = useCallback(async (overrideContent = null) => {
    const content = overrideContent ?? text.trim();
    if (!content) return;
    if (!overrideContent) setText('');
    setSending(true);
    const isImage = typeof content === 'string' && content.startsWith('data:');
    try {
      // Images always go via REST (too large for the WebSocket frame limit).
      // Text goes via WebSocket for real-time delivery; falls back to REST when WS is down.
      if (!isImage && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const msgPayload = { type: 'chat_message', to: peer.id, content };
        if (disappear) msgPayload.disappear_after = disappear;
        wsRef.current.send(JSON.stringify(msgPayload));
        // No optimistic push — the server echoes the message back via WS which adds it
      } else {
        const msg = await api('/api/messages', 'POST', { to: peer.id, content }, token);
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      }
    } catch (e) { setErr(e.message); if (!overrideContent) setText(content); }
    finally { setSending(false); }
  }, [text, peer.id, currentUser.id, wsRef, token, disappear]);

  const handleAttachment = useCallback(async () => {
    // Images are sent via REST (not WebSocket) so size is not a concern at the
    // transport layer, but we still compress to save DB space and load time.
    const pickerOpts = { quality: 0.25, base64: true, exif: false };
    Alert.alert('ATTACH', 'Select source', [
      {
        text: 'CAMERA',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (perm.status !== 'granted') { Alert.alert('PERMISSION DENIED', 'Camera access required.'); return; }
          const res = await ImagePicker.launchCameraAsync(pickerOpts);
          if (!res.canceled && res.assets?.[0]) {
            const a = res.assets[0];
            if (!a.base64) { Alert.alert('ERROR', 'Could not read image data.'); return; }
            sendMessage(`data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}`);
          }
        },
      },
      {
        text: 'PHOTO LIBRARY',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (perm.status !== 'granted') { Alert.alert('PERMISSION DENIED', 'Photo library access required.'); return; }
          const res = await ImagePicker.launchImageLibraryAsync({
            ...pickerOpts, mediaTypes: 'images',
          });
          if (!res.canceled && res.assets?.[0]) {
            const a = res.assets[0];
            if (!a.base64) { Alert.alert('ERROR', 'Could not read image data.'); return; }
            sendMessage(`data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}`);
          }
        },
      },
      { text: 'CANCEL', style: 'cancel' },
    ]);
  }, [sendMessage]);

  const isMine = (msg) => String(msg.from_user?.id ?? msg.from_user) === String(currentUser.id);

  return (
    <ThemedSafeArea>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader title={peer.display_name || peer.displayName || peer.username} onBack={onBack} />
      {disappear && (
        <View style={{ backgroundColor: C.panel, paddingHorizontal: 14, paddingVertical: 4, alignItems: 'center' }}>
          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 10, color: C.amber, letterSpacing: 1 }}>
            {'\u23F1'} MESSAGES DISAPPEAR AFTER {DISAPPEAR_OPTIONS.find(o => o.value === disappear)?.label ?? ''}
          </Text>
        </View>
      )}
      <KeyboardAvoidingView style={styles.flex} behavior={KAV_BEHAVIOR}>
        {loading ? <View style={styles.centerFill}><Spinner size="large" /></View> : (
          <>
            <ErrText msg={err} />
            <FlatList
              ref={listRef} data={messages} keyExtractor={(m) => String(m.id)}
              contentContainerStyle={styles.msgList}
              ListEmptyComponent={<Text style={styles.emptyText}>NO MESSAGES YET</Text>}
              renderItem={({ item }) => {
                const mine = isMine(item);
                return (
                  <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}>
                    <View style={[styles.msgBubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      {isImageContent(item.content)
                        ? <Image source={{ uri: item.content }} style={styles.imageMsg} resizeMode="contain" />
                        : <Text style={styles.msgText}>{item.content}</Text>
                      }
                      <View style={styles.msgMeta}>
                        <Text style={styles.msgTime}>{fmtTime(item.created_at)}</Text>
                        {mine && <Text style={styles.msgRead}>{item.read ? ' \u2713\u2713' : ' \u2713'}</Text>}
                      </View>
                    </View>
                  </View>
                );
              }}
            />
            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.attachBtn} onPress={handleAttachment}>
                <Text style={styles.attachBtnText}>+</Text>
              </TouchableOpacity>
              <TextInput style={styles.chatInput} placeholder="MESSAGE..." placeholderTextColor={C.muted}
                value={text} onChangeText={setText} multiline maxLength={2000} />
              <TouchableOpacity style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                onPress={() => sendMessage()} disabled={!text.trim() || sending}>
                {sending ? <Spinner /> : <Text style={styles.sendBtnText}>SEND</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </ThemedSafeArea>
  );
}

// ---------------------------------------------------------------------------
// GROUPS TAB
// ---------------------------------------------------------------------------
function GroupsTab({ token, onOpenGroup }) {
  const { styles, C } = useSkin();
  const [groups, setGroups]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr]               = useState('');
  const [creating, setCreating]     = useState(false);
  const [newName, setNewName]       = useState('');
  const [newDesc, setNewDesc]       = useState('');
  const [createErr, setCreateErr]   = useState('');
  const [showForm, setShowForm]     = useState(false);

  const fetchGroups = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setErr('');
    try {
      const data = await api('/api/groups', 'GET', null, token);
      setGroups(Array.isArray(data) ? data : []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const createGroup = async () => {
    if (!newName.trim()) { setCreateErr('Group name is required.'); return; }
    setCreating(true); setCreateErr('');
    try {
      const g = await api('/api/groups', 'POST', { name: newName.trim(), description: newDesc.trim() }, token);
      setGroups((prev) => [g, ...prev]); setShowForm(false); setNewName(''); setNewDesc('');
    } catch (e) { setCreateErr(e.message); }
    finally { setCreating(false); }
  };

  const deleteGroup = (g) => {
    Alert.alert(
      'DELETE GROUP',
      `Delete "${g.name}"? This cannot be undone.`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/api/groups/${g.id}`, 'DELETE', null, token);
              setGroups(prev => prev.filter(x => x.id !== g.id));
            } catch (e) { setErr(e.message); }
          },
        },
      ]
    );
  };

  if (loading) return <View style={styles.centerFill}><Spinner size="large" /></View>;

  return (
    <View style={styles.flex}>
      <ErrText msg={err} />
      {showForm && (
        <View style={styles.createGroupForm}>
          <Text style={styles.formLabel}>NEW GROUP</Text>
          <TextInput style={styles.input} placeholder="GROUP NAME" placeholderTextColor={C.muted} value={newName} onChangeText={setNewName} />
          <TextInput style={styles.input} placeholder="DESCRIPTION (OPTIONAL)" placeholderTextColor={C.muted} value={newDesc} onChangeText={setNewDesc} />
          <ErrText msg={createErr} />
          <View style={styles.formBtnRow}>
            <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginRight: 8 }]} onPress={createGroup} disabled={creating}>
              {creating ? <Spinner /> : <Text style={styles.primaryBtnText}>CREATE</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ghostBtn, { flex: 1 }]} onPress={() => { setShowForm(false); setCreateErr(''); }}>
              <Text style={styles.ghostBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <FlatList
        data={groups} keyExtractor={(g) => String(g.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchGroups(true)} tintColor={C.accent} />}
        ListHeaderComponent={!showForm ? (
          <TouchableOpacity style={styles.createGroupBtn} onPress={() => setShowForm(true)}>
            <Text style={styles.createGroupBtnText}>+ NEW GROUP</Text>
          </TouchableOpacity>
        ) : null}
        ListEmptyComponent={<Text style={styles.emptyText}>NO GROUPS YET</Text>}
        renderItem={({ item }) => {
          const row = (
            <TouchableOpacity style={styles.userRow} onPress={() => onOpenGroup(item)}>
              <View style={styles.userRowInfo}>
                <Text style={styles.userRowName}>{item.name}</Text>
                {item.description
                  ? <Text style={styles.userRowMeta} numberOfLines={1}>{item.description}</Text>
                  : <Text style={styles.userRowMeta}>CREATED {fmtDate(item.created_at)}</Text>
                }
              </View>
              <Text style={styles.chevron}>{'>'}</Text>
            </TouchableOpacity>
          );
          if (item.my_role !== 'admin') return row;
          return (
            <SwipeableRow rightLabel="DELETE" onAction={() => deleteGroup(item)}>
              {row}
            </SwipeableRow>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// GROUP CHAT SCREEN
// ---------------------------------------------------------------------------
function GroupChatScreen({ token, currentUser, group, onBack, wsRef, incomingMsg }) {
  const { styles, C } = useSkin();
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [err, setErr]           = useState('');
  const listRef                 = useRef(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const data = await api(`/api/groups/${group.id}/messages`, 'GET', null, token);
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [token, group.id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    if (!incomingMsg) return;
    if (incomingMsg.type === 'group_message' &&
        String(incomingMsg.group?.id ?? incomingMsg.group_id) === String(group.id)) {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === incomingMsg.id);
        return exists ? prev : [...prev, incomingMsg];
      });
    }
  }, [incomingMsg, group.id]);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = useCallback(async (overrideContent = null) => {
    const content = overrideContent ?? text.trim();
    if (!content) return;
    if (!overrideContent) setText('');
    setSending(true);
    const isImage = typeof content === 'string' && content.startsWith('data:');
    try {
      if (!isImage && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'group_message', group_id: group.id, content }));
        // No optimistic push — the server echoes the message back via WS which adds it
      } else {
        const msg = await api(`/api/groups/${group.id}/messages`, 'POST', { content }, token);
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      }
    } catch (e) { setErr(e.message); if (!overrideContent) setText(content); }
    finally { setSending(false); }
  }, [text, group.id, currentUser, wsRef, token]);

  const handleAttachment = useCallback(async () => {
    const pickerOpts = { quality: 0.25, base64: true, exif: false };
    Alert.alert('ATTACH', 'Select source', [
      {
        text: 'CAMERA',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (perm.status !== 'granted') { Alert.alert('PERMISSION DENIED', 'Camera access required.'); return; }
          const res = await ImagePicker.launchCameraAsync(pickerOpts);
          if (!res.canceled && res.assets?.[0]) {
            const a = res.assets[0];
            if (!a.base64) { Alert.alert('ERROR', 'Could not read image data.'); return; }
            sendMessage(`data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}`);
          }
        },
      },
      {
        text: 'PHOTO LIBRARY',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (perm.status !== 'granted') { Alert.alert('PERMISSION DENIED', 'Photo library access required.'); return; }
          const res = await ImagePicker.launchImageLibraryAsync({
            ...pickerOpts, mediaTypes: 'images',
          });
          if (!res.canceled && res.assets?.[0]) {
            const a = res.assets[0];
            if (!a.base64) { Alert.alert('ERROR', 'Could not read image data.'); return; }
            sendMessage(`data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}`);
          }
        },
      },
      { text: 'CANCEL', style: 'cancel' },
    ]);
  }, [sendMessage]);

  // Handle both new snake_case (from_user) and legacy camelCase (from) field names
  const isMine = (msg) => {
    const id = msg.from_user?.id ?? msg.from_user ?? msg.from;
    return String(id) === String(currentUser.id);
  };

  return (
    <ThemedSafeArea>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader title={group.name} onBack={onBack} />
      <KeyboardAvoidingView style={styles.flex} behavior={KAV_BEHAVIOR}>
        {loading ? <View style={styles.centerFill}><Spinner size="large" /></View> : (
          <>
            <ErrText msg={err} />
            <FlatList
              ref={listRef} data={messages} keyExtractor={(m) => String(m.id)}
              contentContainerStyle={styles.msgList}
              ListEmptyComponent={<Text style={styles.emptyText}>NO MESSAGES YET</Text>}
              renderItem={({ item }) => {
                const mine = isMine(item);
                const senderName = mine ? 'YOU' : (item.from_display || item.fromDisplay || item.from_username || item.fromUsername || 'UNKNOWN');
                return (
                  <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}>
                    <View style={[styles.msgBubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      {!mine && <Text style={styles.msgSender}>{senderName}</Text>}
                      {isImageContent(item.content)
                        ? <Image source={{ uri: item.content }} style={styles.imageMsg} resizeMode="contain" />
                        : <Text style={styles.msgText}>{item.content}</Text>
                      }
                      <Text style={styles.msgTime}>{fmtTime(item.created_at)}</Text>
                    </View>
                  </View>
                );
              }}
            />
            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.attachBtn} onPress={handleAttachment}>
                <Text style={styles.attachBtnText}>+</Text>
              </TouchableOpacity>
              <TextInput style={styles.chatInput} placeholder="MESSAGE..." placeholderTextColor={C.muted}
                value={text} onChangeText={setText} multiline maxLength={2000} />
              <TouchableOpacity style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                onPress={() => sendMessage()} disabled={!text.trim() || sending}>
                {sending ? <Spinner /> : <Text style={styles.sendBtnText}>SEND</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </ThemedSafeArea>
  );
}

// ---------------------------------------------------------------------------
// BOT TAB
// ---------------------------------------------------------------------------
function BotTab({ token }) {
  const { styles, C } = useSkin();
  const [messages, setMessages] = useState([{
    id: 0, role: 'bot', content: 'BANNER AI ONLINE. How can I assist you today?', ts: new Date().toISOString(),
  }]);
  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [typing, setTyping]   = useState(false);
  const listRef               = useRef(null);
  const typingTimer           = useRef(null);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, typing]);

  const sendToBot = async () => {
    const content = text.trim();
    if (!content || loading) return;
    setText(''); setErr('');
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content, ts: new Date().toISOString() }]);
    setTyping(true); setLoading(true);
    typingTimer.current = setTimeout(async () => {
      try {
        const data = await api('/api/bot/chat', 'POST', { message: content }, token);
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'bot', content: data.reply || '...', ts: new Date().toISOString() }]);
      } catch (e) { setErr(e.message); }
      finally { setTyping(false); setLoading(false); }
    }, 400);
  };

  useEffect(() => { return () => { if (typingTimer.current) clearTimeout(typingTimer.current); }; }, []);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={KAV_BEHAVIOR}>
      <View style={styles.botHeader}>
        <Text style={styles.botHeaderText}>BANNER AI</Text>
        <View style={[{ width: 8, height: 8, borderRadius: 4, marginLeft: 8 }, { backgroundColor: C.green }]} />
      </View>
      <FlatList
        ref={listRef} data={messages} keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.msgList}
        renderItem={({ item }) => {
          const isBot = item.role === 'bot';
          return (
            <View style={[styles.msgRow, isBot ? styles.msgRowTheirs : styles.msgRowMine]}>
              <View style={[styles.msgBubble, isBot ? styles.bubbleBotMsg : styles.bubbleMine]}>
                {isBot && <Text style={styles.botLabel}>BANNER</Text>}
                <Text style={[styles.msgText, isBot && styles.botMsgText]}>{item.content}</Text>
                <Text style={styles.msgTime}>{fmtTime(item.ts)}</Text>
              </View>
            </View>
          );
        }}
        ListFooterComponent={typing ? (
          <View style={[styles.msgRow, styles.msgRowTheirs]}>
            <View style={[styles.msgBubble, styles.bubbleBotMsg]}>
              <Text style={styles.botLabel}>BANNER</Text>
              <TypingDots />
            </View>
          </View>
        ) : null}
      />
      <ErrText msg={err} />
      <View style={styles.inputRow}>
        <TextInput style={styles.chatInput} placeholder="ASK BANNER AI..." placeholderTextColor={C.muted}
          value={text} onChangeText={setText} multiline maxLength={2000} onSubmitEditing={sendToBot} />
        <TouchableOpacity style={[styles.sendBtn, (!text.trim() || loading) && styles.sendBtnDisabled]}
          onPress={sendToBot} disabled={!text.trim() || loading}>
          {loading ? <Spinner /> : <Text style={styles.sendBtnText}>SEND</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function TypingDots() {
  const { C } = useSkin();
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setFrame((f) => (f + 1) % 4), 350);
    return () => clearInterval(iv);
  }, []);
  return <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 14, color: C.accent }}>{'.'.repeat(frame) || ' '}</Text>;
}

// ---------------------------------------------------------------------------
// PROFILE TAB
// ---------------------------------------------------------------------------
function ProfileTab({ token, currentUser, onLogout }) {
  const { styles, C } = useSkin();

  // ── invite / bio state ────────────────────────────────────────────────
  const [loading, setLoading]     = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteErr, setInviteErr] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled]     = useState(false);
  const [showBioModal, setShowBioModal] = useState(false);
  const [bioPassword, setBioPassword]   = useState('');
  const [bioLoading, setBioLoading]     = useState(false);
  const [bioErr, setBioErr]             = useState('');

  // ── editable profile fields ───────────────────────────────────────────
  const [displayName,     setDisplayName]     = useState('');
  const [phone,           setPhone]           = useState('');
  const [residentialAddr, setResidentialAddr] = useState('');
  const [workAddr,        setWorkAddr]        = useState('');
  const [savingProfile,   setSavingProfile]   = useState(false);
  const [saveProfileErr,  setSaveProfileErr]  = useState('');
  const [saveProfileOk,   setSaveProfileOk]   = useState('');

  useEffect(() => {
    (async () => {
      setBioAvailable(await isBiometricReady());
      setBioEnabled(await loadBioEnabled());
      const ext = await loadProfileExt();
      setDisplayName(ext.displayName ?? currentUser.display_name ?? currentUser.username ?? '');
      setPhone(ext.phone ?? '');
      setResidentialAddr(ext.residentialAddr ?? '');
      setWorkAddr(ext.workAddr ?? '');
    })();
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true); setSaveProfileErr(''); setSaveProfileOk('');
    try {
      const ext = { displayName, phone, residentialAddr, workAddr };
      await saveProfileExt(ext);
      // attempt backend sync — silent fail if endpoint not available
      try {
        await api('/api/profile', 'PATCH', { display_name: displayName, phone, residential_address: residentialAddr, work_address: workAddr }, token);
      } catch {}
      setSaveProfileOk('PROFILE SAVED');
      setTimeout(() => setSaveProfileOk(''), 2500);
    } catch (e) { setSaveProfileErr(e.message); }
    finally { setSavingProfile(false); }
  };

  const handleEnableBio = async () => {
    if (!bioPassword.trim()) { setBioErr('Password is required.'); return; }
    setBioLoading(true); setBioErr('');
    try {
      await api('/auth/login', 'POST', { email: currentUser.email, password: bioPassword });
      await saveBioEnabled(true);
      await saveBioCreds(currentUser.email, bioPassword);
      setBioEnabled(true); setShowBioModal(false); setBioPassword('');
      Alert.alert('FACE ID ENABLED', 'Face ID will unlock the app on your next launch.');
    } catch (e) { setBioErr(e.message || 'Incorrect password.'); }
    finally { setBioLoading(false); }
  };

  const handleDisableBio = () => {
    Alert.alert('DISABLE FACE ID', 'Face ID login will be turned off.', [
      { text: 'CANCEL', style: 'cancel' },
      { text: 'DISABLE', style: 'destructive', onPress: async () => { await clearBio(); setBioEnabled(false); } },
    ]);
  };

  const handleInvite = async () => {
    setLoading(true); setInviteErr('');
    try {
      const data = await api('/api/invites', 'POST', {}, token);
      const url = data.invite_url || data.url || '';
      setInviteUrl(url);
      Alert.alert('INVITE LINK GENERATED', url, [
        { text: 'COPY', onPress: async () => { await Clipboard.setStringAsync(url); Alert.alert('COPIED', 'Invite URL copied to clipboard.'); } },
        { text: 'OK' },
      ]);
    } catch (e) { setInviteErr(e.message); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    Alert.alert('LOGOUT', 'Disconnect from nano-SYNAPSYS?', [
      { text: 'CANCEL', style: 'cancel' },
      { text: 'LOGOUT', style: 'destructive', onPress: onLogout },
    ]);
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.profileScroll}>

      {/* ── READ-ONLY INFO ──────────────────────────────────────────── */}
      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>USERNAME</Text>
        <Text style={styles.profileValue}>{currentUser.username}</Text>
      </View>
      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>EMAIL</Text>
        <Text style={styles.profileValue}>{currentUser.email || '—'}</Text>
      </View>
      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>ACCOUNT STATUS</Text>
        <Text style={[styles.profileValue, { color: currentUser.is_approved ? C.green : C.amber }]}>
          {currentUser.is_approved ? 'APPROVED' : 'PENDING APPROVAL'}
        </Text>
      </View>

      <View style={styles.profileDivider} />

      {/* ── EDIT PROFILE ────────────────────────────────────────────── */}
      <Text style={styles.profileEditHeader}>EDIT PROFILE</Text>

      <Text style={[styles.profileLabel, { marginTop: 4 }]}>DISPLAY NAME</Text>
      <TextInput
        style={styles.profileEditInput}
        placeholder="DISPLAY NAME"
        placeholderTextColor={C.muted}
        value={displayName}
        onChangeText={setDisplayName}
        autoCorrect={false}
        autoCapitalize="words"
      />

      <Text style={[styles.profileLabel, { marginTop: 12 }]}>PHONE NUMBER</Text>
      <TextInput
        style={styles.profileEditInput}
        placeholder="+61 000 000 000"
        placeholderTextColor={C.muted}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoCorrect={false}
      />

      <Text style={[styles.profileLabel, { marginTop: 12 }]}>RESIDENTIAL ADDRESS</Text>
      <TextInput
        style={[styles.profileEditInput, styles.profileEditMultiline]}
        placeholder="Street, City, State, Postcode"
        placeholderTextColor={C.muted}
        value={residentialAddr}
        onChangeText={setResidentialAddr}
        multiline
        numberOfLines={3}
        autoCorrect={false}
      />

      <Text style={[styles.profileLabel, { marginTop: 12 }]}>WORK ADDRESS</Text>
      <TextInput
        style={[styles.profileEditInput, styles.profileEditMultiline]}
        placeholder="Street, City, State, Postcode"
        placeholderTextColor={C.muted}
        value={workAddr}
        onChangeText={setWorkAddr}
        multiline
        numberOfLines={3}
        autoCorrect={false}
      />

      <ErrText msg={saveProfileErr} />
      {saveProfileOk ? <Text style={styles.saveOkText}>{'\u2713'} {saveProfileOk}</Text> : null}

      <TouchableOpacity
        style={[styles.saveProfileBtn, savingProfile && styles.primaryBtnDisabled]}
        onPress={handleSaveProfile}
        disabled={savingProfile}
      >
        {savingProfile ? <Spinner /> : <Text style={styles.saveProfileBtnText}>SAVE PROFILE</Text>}
      </TouchableOpacity>

      <View style={styles.profileDivider} />

      {/* ── INVITE ──────────────────────────────────────────────────── */}
      <TouchableOpacity style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]} onPress={handleInvite} disabled={loading}>
        {loading ? <Spinner /> : <Text style={styles.primaryBtnText}>GENERATE INVITE LINK</Text>}
      </TouchableOpacity>
      <ErrText msg={inviteErr} />
      {inviteUrl ? (
        <View style={styles.inviteUrlBox}>
          <Text style={styles.inviteUrlLabel}>INVITE URL</Text>
          <Text style={styles.inviteUrlText} selectable>{inviteUrl}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={async () => { await Clipboard.setStringAsync(inviteUrl); Alert.alert('COPIED', 'Invite URL copied to clipboard.'); }}>
            <Text style={styles.copyBtnText}>COPY TO CLIPBOARD</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.profileDivider} />

      {/* ── FACE ID ─────────────────────────────────────────────────── */}
      {bioAvailable && (
        bioEnabled
          ? <TouchableOpacity style={styles.bioDisableBtn} onPress={handleDisableBio}><Text style={styles.bioDisableBtnText}>DISABLE FACE ID LOGIN</Text></TouchableOpacity>
          : <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowBioModal(true)}><Text style={styles.primaryBtnText}>ENABLE FACE ID LOGIN</Text></TouchableOpacity>
      )}

      <View style={styles.profileDivider} />

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>LOGOUT</Text>
      </TouchableOpacity>

      <Modal visible={showBioModal} transparent animationType="fade"
        onRequestClose={() => { setShowBioModal(false); setBioPassword(''); setBioErr(''); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>ENABLE FACE ID</Text>
            <Text style={styles.modalSub}>Enter your password to authorise Face ID login</Text>
            <TextInput style={[styles.input, { marginTop: 16 }]} placeholder="PASSWORD" placeholderTextColor={C.muted}
              value={bioPassword} onChangeText={setBioPassword} secureTextEntry autoFocus onSubmitEditing={handleEnableBio} />
            <ErrText msg={bioErr} />
            <View style={[styles.formBtnRow, { marginTop: 12 }]}>
              <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginRight: 8 }, (bioLoading || !bioPassword.trim()) && styles.primaryBtnDisabled]}
                onPress={handleEnableBio} disabled={bioLoading || !bioPassword.trim()}>
                {bioLoading ? <Spinner /> : <Text style={styles.primaryBtnText}>CONFIRM</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ghostBtn, { flex: 1 }]} onPress={() => { setShowBioModal(false); setBioPassword(''); setBioErr(''); }}>
                <Text style={styles.ghostBtnText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// CONTACTS TAB
// ---------------------------------------------------------------------------
function ContactsTab({ token, currentUser, onOpenDM }) {
  const { styles, C } = useSkin();
  // contacts  → array of { contactId, userId, username, displayName, online, since }
  // pending   → { received: [{contactId, userId, username, displayName}], sent: [...] }
  // users     → array of { id, username, displayName, online, isMe, contactStatus }
  const [contacts,   setContacts]   = useState([]);
  const [pending,    setPending]    = useState({ received: [], sent: [] });
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err,        setErr]        = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [query,      setQuery]      = useState('');
  const [actioning,  setActioning]  = useState({});

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setErr('');
    try {
      const [c, p, u] = await Promise.all([
        api('/api/contacts',         'GET', null, token),
        api('/api/contacts/pending', 'GET', null, token),
        api('/api/users',            'GET', null, token),
      ]);
      setContacts(Array.isArray(c) ? c : []);
      // pending is { received: [...], sent: [...] } — never an array
      setPending({ received: p?.received ?? [], sent: p?.sent ?? [] });
      setUsers(Array.isArray(u) ? u.filter(u2 => !u2.isMe) : []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const act = async (key, fn) => {
    setActioning(a => ({ ...a, [key]: true }));
    try { await fn(); await fetchAll(); } catch (e) { setErr(e.message); }
    finally { setActioning(a => ({ ...a, [key]: false })); }
  };

  // API uses camelCase keys
  const sendRequest    = (userId)    => act(`req_${userId}`,    () => api('/api/contacts/request', 'POST', { userId },    token));
  const acceptRequest  = (contactId) => act(`acc_${contactId}`, () => api('/api/contacts/accept',  'POST', { contactId }, token));
  const declineRequest = (contactId) => act(`dec_${contactId}`, () => api('/api/contacts/decline', 'POST', { contactId }, token));

  const blockUser = (c) => {
    Alert.alert(
      'BLOCK USER',
      `Block ${c.displayName || c.username}? They won't be able to message you.`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'BLOCK',
          style: 'destructive',
          onPress: () => act(`blk_${c.userId}`, () => api('/api/contacts/block', 'POST', { userId: c.userId }, token)),
        },
      ]
    );
  };

  // Correct field names from API responses
  const contactUserIds = new Set(contacts.map(c => c.userId));
  const pendingFromIds = new Set(pending.received.map(p => p.userId));
  const pendingSentIds = new Set(pending.sent.map(p => p.userId));

  const filteredUsers = query.trim()
    ? users.filter(u => (u.username + (u.displayName || '')).toLowerCase().includes(query.toLowerCase()))
    : users;

  if (loading) return <View style={styles.centerFill}><Spinner size="large" /></View>;

  return (
    <ScrollView
      style={styles.flex}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor={C.accent} />}
    >
      <ErrText msg={err} />

      {/* ── INCOMING REQUESTS ──────────────────────────────────── */}
      {pending.received.length > 0 && (
        <>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.contactSection}>PENDING REQUESTS</Text>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pending.received.length}</Text>
            </View>
          </View>
          {pending.received.map(p => (
            <View key={p.contactId} style={[styles.contactRow, { borderLeftWidth: 3, borderLeftColor: C.amber }]}>
              <View style={styles.contactRowLeft}>
                <View style={styles.contactRowInfo}>
                  <Text style={styles.contactRowName}>{p.displayName || p.username}</Text>
                  <Text style={styles.contactRowMeta}>WANTS TO CONNECT</Text>
                </View>
              </View>
              <View style={styles.contactBtnRow}>
                <TouchableOpacity
                  style={styles.contactActionBtn}
                  onPress={() => acceptRequest(p.contactId)}
                  disabled={!!actioning[`acc_${p.contactId}`]}
                >
                  {actioning[`acc_${p.contactId}`]
                    ? <Spinner />
                    : <Text style={styles.contactActionBtnText}>{'\u2713'} OK</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.contactActionBtn, styles.contactRejectBtn]}
                  onPress={() => declineRequest(p.contactId)}
                  disabled={!!actioning[`dec_${p.contactId}`]}
                >
                  <Text style={[styles.contactActionBtnText, styles.contactRejectBtnText]}>{'\u2715'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={styles.separator} />
        </>
      )}

      {/* ── MY CONTACTS ────────────────────────────────────────── */}
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
        <Text style={styles.contactSection}>MY CONTACTS</Text>
      </View>
      {contacts.length === 0
        ? <Text style={styles.emptyText}>NO CONTACTS YET{'\n'}Search below to add someone</Text>
        : contacts.map(c => (
            <SwipeableRow key={c.contactId} rightLabel="BLOCK" onAction={() => blockUser(c)}>
              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => onOpenDM({ id: c.userId, username: c.username, display_name: c.displayName })}
              >
                <View style={styles.contactRowLeft}>
                  <OnlineDot online={c.online} />
                  <View style={styles.contactRowInfo}>
                    <Text style={styles.contactRowName}>{c.displayName || c.username}</Text>
                    <Text style={styles.contactRowMeta}>{c.online ? 'ONLINE' : 'OFFLINE'}</Text>
                  </View>
                </View>
                <Text style={styles.chevron}>{'>'}</Text>
              </TouchableOpacity>
            </SwipeableRow>
          ))
      }

      <View style={styles.separator} />

      {/* ── ADD CONTACTS ───────────────────────────────────────── */}
      <TouchableOpacity style={styles.addContactBtn} onPress={() => setShowSearch(s => !s)}>
        <Text style={styles.addContactBtnText}>{showSearch ? '\u2715 CLOSE SEARCH' : '+ ADD CONTACT'}</Text>
      </TouchableOpacity>

      {showSearch && (
        <>
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <TextInput
              style={styles.input}
              placeholder="SEARCH USERS..."
              placeholderTextColor={C.muted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          {filteredUsers.map(u => {
            const isContact   = contactUserIds.has(u.id);
            const sentPending = pendingSentIds.has(u.id);
            const recvPending = pendingFromIds.has(u.id);
            const key = `req_${u.id}`;
            return (
              <View key={u.id} style={styles.contactRow}>
                <View style={styles.contactRowLeft}>
                  <OnlineDot online={u.online} />
                  <View style={styles.contactRowInfo}>
                    <Text style={styles.contactRowName}>{u.displayName || u.username}</Text>
                    <Text style={styles.contactRowMeta}>{u.online ? 'ONLINE' : 'OFFLINE'}</Text>
                  </View>
                </View>
                {isContact ? (
                  <Text style={[styles.contactActionBtnText, { color: C.green }]}>{'\u2713'} CONTACT</Text>
                ) : sentPending ? (
                  <Text style={[styles.contactActionBtnText, { color: C.amber }]}>PENDING</Text>
                ) : recvPending ? (
                  <Text style={[styles.contactActionBtnText, { color: C.amber }]}>RESPOND ABOVE</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.contactActionBtn}
                    onPress={() => sendRequest(u.id)}
                    disabled={!!actioning[key]}
                  >
                    {actioning[key] ? <Spinner /> : <Text style={styles.contactActionBtnText}>+ ADD</Text>}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// SETTINGS TAB
// ---------------------------------------------------------------------------
function SettingsTab({ token, currentUser }) {
  const { styles, C, skin, setSkin } = useSkin();
  const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
  const [disappear, setDisappearState] = useState(null);
  const [location,   setLocationState] = useState(null);
  const [locLoading, setLocLoading]    = useState(false);
  const [locErr,     setLocErr]        = useState('');

  // ── Admin state ───────────────────────────────────────────────────────
  const isAdmin = currentUser?.is_staff || currentUser?.is_superuser;
  const [pendingUsers,   setPendingUsers]   = useState([]);
  const [adminLoading,   setAdminLoading]   = useState(false);
  const [adminRefreshing,setAdminRefreshing]= useState(false);
  const [adminErr,       setAdminErr]       = useState('');
  const [adminActioning, setAdminActioning] = useState({});

  const fetchPending = useCallback(async (isRefresh = false) => {
    if (!isAdmin) return;
    if (isRefresh) setAdminRefreshing(true); else setAdminLoading(true);
    setAdminErr('');
    try {
      const data = await api('/api/admin/pending', 'GET', null, token);
      setPendingUsers(Array.isArray(data) ? data : []);
    } catch (e) { setAdminErr(e.message); }
    finally { setAdminLoading(false); setAdminRefreshing(false); }
  }, [isAdmin, token]);

  const adminAction = async (key, path, userId) => {
    setAdminActioning(a => ({ ...a, [key]: true }));
    try {
      await api(path, 'POST', {}, token);
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (e) { setAdminErr(e.message); }
    finally { setAdminActioning(a => ({ ...a, [key]: false })); }
  };

  useEffect(() => {
    loadDisappear().then(v => setDisappearState(v));
    loadLocation().then(v => { if (v) setLocationState(v); });
    fetchPending();
  }, [fetchPending]);

  const handleSetDisappear = async (v) => {
    setDisappearState(v);
    await saveDisappear(v);
  };

  const handleGetLocation = async () => {
    setLocLoading(true); setLocErr('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocErr('Location permission denied.'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const loc = {
        lat:       pos.coords.latitude,
        lng:       pos.coords.longitude,
        accuracy:  Math.round(pos.coords.accuracy ?? 0),
        altitude:  pos.coords.altitude != null ? Math.round(pos.coords.altitude) : null,
        timestamp: new Date().toISOString(),
      };
      setLocationState(loc);
      await saveLocation(loc);
    } catch (e) { setLocErr(e.message || 'Failed to get location.'); }
    finally { setLocLoading(false); }
  };

  const SKIN_OPTS = [
    { key: 'green',    label: 'PHANTOM', sub: 'GREEN',  dot: '#00FF41', desc: 'Classic matrix terminal' },
    { key: 'tactical', label: 'TACTICAL', sub: 'STEEL', dot: '#a8b8cc', desc: 'Metallic Magpul texture' },
  ];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.profileScroll}>

      {/* ── SKIN ──────────────────────────────────────────────── */}
      <Text style={styles.settingsHeader}>INTERFACE SKIN</Text>
      <View style={styles.skinRow}>
        {SKIN_OPTS.map(({ key, label, sub, dot }) => (
          <TouchableOpacity
            key={key}
            style={[styles.skinBtn, skin === key && styles.skinBtnActive]}
            onPress={() => setSkin(key)}
          >
            <View style={[styles.skinDot, { backgroundColor: dot }]} />
            <Text style={styles.skinBtnLabel}>{label}</Text>
            <Text style={[styles.skinBtnName, skin === key && styles.skinBtnNameActive]}>{sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 10, color: C.dim, marginTop: 8, letterSpacing: 1 }}>
        {skin === 'tactical' ? 'TACTICAL: gunmetal + Magpul texture overlay' : 'PHANTOM: classic green terminal matrix'}
      </Text>

      <View style={styles.profileDivider} />

      {/* ── DISAPPEARING MESSAGES ────────────────────────────── */}
      <Text style={styles.settingsHeader}>DISAPPEARING MESSAGES</Text>
      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 10, color: C.dim, marginBottom: 12, letterSpacing: 1, lineHeight: 16 }}>
        New messages will be deleted automatically after the selected time.
      </Text>
      <View style={styles.disappearWrap}>
        {DISAPPEAR_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={String(opt.value)}
            style={[styles.disappearOpt, disappear === opt.value && styles.disappearOptActive]}
            onPress={() => handleSetDisappear(opt.value)}
          >
            <Text style={[styles.disappearOptText, disappear === opt.value && styles.disappearOptTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {disappear && (
        <Text style={{ fontFamily: mono, fontSize: 10, color: C.amber, marginTop: 10, letterSpacing: 1 }}>
          {'\u26A0'} Messages will disappear after {DISAPPEAR_OPTIONS.find(o => o.value === disappear)?.label}
        </Text>
      )}

      <View style={styles.profileDivider} />

      {/* ── GPS LOCATION ─────────────────────────────────────── */}
      <Text style={styles.settingsHeader}>GPS LOCATION</Text>
      <Text style={{ fontFamily: mono, fontSize: 10, color: C.dim, marginBottom: 12, letterSpacing: 1, lineHeight: 16 }}>
        Capture and store your current GPS coordinates.
      </Text>

      {location && (
        <View style={styles.locationBox}>
          <Text style={styles.locationCoord}>
            {'\uD83D\uDCCD'} {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </Text>
          {location.altitude != null && (
            <Text style={styles.locationMeta}>ALT {location.altitude}m</Text>
          )}
          <Text style={styles.locationMeta}>ACC \u00B1{location.accuracy}m</Text>
          <Text style={styles.locationMeta}>CAPTURED {new Date(location.timestamp).toLocaleString()}</Text>
        </View>
      )}

      {locErr ? <Text style={[styles.errText, { marginBottom: 8 }]}>{locErr}</Text> : null}

      <TouchableOpacity
        style={[styles.getLocationBtn, locLoading && styles.primaryBtnDisabled]}
        onPress={handleGetLocation}
        disabled={locLoading}
      >
        {locLoading
          ? <Spinner />
          : <Text style={styles.getLocationBtnText}>{location ? '\uD83D\uDD04 UPDATE LOCATION' : '\uD83D\uDCCD GET LOCATION'}</Text>
        }
      </TouchableOpacity>

      <View style={styles.profileDivider} />

      {/* ── ADMIN PANEL (staff only) ─────────────────────────── */}
      {isAdmin && (
        <>
          <Text style={[styles.settingsHeader, { color: C.amber }]}>ADMIN — PENDING APPROVALS</Text>
          {adminErr ? <ErrText msg={adminErr} /> : null}

          {adminLoading ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}><Spinner /></View>
          ) : pendingUsers.length === 0 ? (
            <Text style={[styles.emptyText, { marginTop: 0, marginBottom: 16, fontSize: 11 }]}>
              {'\u2713'} NO PENDING REGISTRATIONS
            </Text>
          ) : (
            pendingUsers.map(u => (
              <View key={u.id} style={styles.adminCard}>
                <Text style={styles.adminCardLabel}>PENDING REGISTRATION</Text>
                <Text style={styles.adminCardName}>{u.username}</Text>
                <Text style={styles.adminCardEmail}>{u.email}</Text>
                {u.join_reason ? (
                  <Text style={styles.adminCardReason}>"{u.join_reason}"</Text>
                ) : null}
                {u.ip_address ? (
                  <Text style={styles.adminCardEmail}>IP: {u.ip_address}</Text>
                ) : null}
                <Text style={styles.adminCardEmail}>
                  {new Date(u.created_at).toLocaleString()}
                </Text>
                <View style={styles.adminBtnRow}>
                  <TouchableOpacity
                    style={[styles.adminApproveBtn, adminActioning[`app_${u.id}`] && { opacity: 0.5 }]}
                    onPress={() => adminAction(`app_${u.id}`, `/api/admin/approve/${u.id}`, u.id)}
                    disabled={!!adminActioning[`app_${u.id}`] || !!adminActioning[`rej_${u.id}`]}
                  >
                    {adminActioning[`app_${u.id}`]
                      ? <Spinner />
                      : <Text style={styles.adminApproveBtnText}>{'\u2713'} APPROVE</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.adminRejectBtn, adminActioning[`rej_${u.id}`] && { opacity: 0.5 }]}
                    onPress={() => adminAction(`rej_${u.id}`, `/api/admin/reject/${u.id}`, u.id)}
                    disabled={!!adminActioning[`app_${u.id}`] || !!adminActioning[`rej_${u.id}`]}
                  >
                    {adminActioning[`rej_${u.id}`]
                      ? <Spinner />
                      : <Text style={styles.adminRejectBtnText}>{'\u2715'} REJECT</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <TouchableOpacity
            style={[styles.ghostBtn, { marginBottom: 4 }, adminRefreshing && { opacity: 0.5 }]}
            onPress={() => fetchPending(true)}
            disabled={adminRefreshing || adminLoading}
          >
            {adminRefreshing ? <Spinner /> : <Text style={styles.ghostBtnText}>{'\uD83D\uDD04'} REFRESH LIST</Text>}
          </TouchableOpacity>

          <View style={styles.profileDivider} />
        </>
      )}

      {/* ── APP INFO ─────────────────────────────────────────── */}
      <Text style={styles.settingsHeader}>APP INFO</Text>
      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>VERSION</Text>
        <Text style={styles.profileValue}>1.0.0</Text>
      </View>
      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>NETWORK</Text>
        <Text style={styles.profileValue}>AI EVOLUTION SECURE MESH</Text>
      </View>
      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>ENCRYPTION</Text>
        <Text style={[styles.profileValue, { color: C.green }]}>E2E + JWT</Text>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// HOME SCREEN  (tabs + routing)
// ---------------------------------------------------------------------------
function HomeScreen({ token, currentUser, onLogout }) {
  const { styles, C } = useSkin();
  const [activeTab, setActiveTab]     = useState('CHATS');
  const [dmPeer, setDmPeer]           = useState(null);
  const [groupChat, setGroupChat]     = useState(null);
  const [incomingMsg, setIncomingMsg] = useState(null);
  const [disappear, setDisappear]     = useState(null);

  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);
  const backoffRef   = useRef(1000);

  useEffect(() => {
    loadDisappear().then(v => setDisappear(v));
  }, []);

  const connectWS = useCallback(() => {
    if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => { backoffRef.current = 1000; };
    ws.onmessage = (event) => {
      try { setIncomingMsg(JSON.parse(event.data)); } catch {}
    };
    ws.onerror  = () => {};
    ws.onclose  = () => {
      const delay = Math.min(backoffRef.current, 30000);
      backoffRef.current = Math.min(backoffRef.current * 2, 30000);
      reconnectRef.current = setTimeout(connectWS, delay);
    };
  }, [token]);

  useEffect(() => {
    connectWS();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    };
  }, [connectWS]);

  if (dmPeer) {
    return (
      <DMChatScreen
        token={token} currentUser={currentUser} peer={dmPeer}
        onBack={() => setDmPeer(null)} wsRef={wsRef} incomingMsg={incomingMsg} disappear={disappear}
      />
    );
  }

  if (groupChat) {
    return (
      <GroupChatScreen
        token={token} currentUser={currentUser} group={groupChat}
        onBack={() => setGroupChat(null)} wsRef={wsRef} incomingMsg={incomingMsg} disappear={disappear}
      />
    );
  }

  return (
    <ThemedSafeArea>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={styles.homeHeader}>
        <Text style={styles.homeTitle}>nano-SYNAPSYS</Text>
        <Text style={styles.homeSubtitle}>AI EVOLUTION MESH</Text>
      </View>
      <View style={styles.flex}>
        {activeTab === 'CHATS'    && <ChatsTab token={token} currentUser={currentUser} onOpenDM={(peer) => setDmPeer(peer)} />}
        {activeTab === 'CONTACTS' && <ContactsTab token={token} currentUser={currentUser} onOpenDM={(peer) => { setDmPeer(peer); setActiveTab('CHATS'); }} />}
        {activeTab === 'GROUPS'   && <GroupsTab token={token} onOpenGroup={(g) => setGroupChat(g)} />}
        {activeTab === 'BOT'      && <BotTab token={token} />}
        {activeTab === 'PROFILE'  && <ProfileTab token={token} currentUser={currentUser} onLogout={onLogout} />}
        {activeTab === 'SETTINGS' && <SettingsTab token={token} currentUser={currentUser} />}
      </View>
      <TabBar active={activeTab} onChange={setActiveTab} />
    </ThemedSafeArea>
  );
}

// ---------------------------------------------------------------------------
// ROOT APP
// ---------------------------------------------------------------------------
function AppInner() {
  const { styles, C } = useSkin();
  const [appState, setAppState] = useState('loading');
  const [token, setToken]       = useState(null);
  const [currentUser, setUser]  = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await loadToken();
        if (!storedToken) { setAppState('auth'); return; }
        const rawMe = await api('/auth/me', 'GET', null, storedToken);
        // MeView wraps in { user: {...} } — unwrap it
        const user = rawMe?.user ?? rawMe;
        await saveUser(user);
        setToken(storedToken); setUser(user);
        const bioEnabled = await loadBioEnabled();
        const bioReady   = await isBiometricReady();
        setAppState(bioEnabled && bioReady ? 'biometric' : 'home');
      } catch {
        await clearToken(); await clearUser();
        setAppState('auth');
      }
    })();
  }, []);

  const handleAuth = useCallback((t, u) => { setToken(t); setUser(u); setAppState('home'); }, []);
  const handleLogout = useCallback(async () => {
    await clearToken(); await clearUser();
    setToken(null); setUser(null); setAppState('auth');
  }, []);

  if (appState === 'loading') {
    return (
      <ThemedView style={styles.splashScreen}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <Text style={styles.splashTitle}>nano-SYNAPSYS</Text>
        <Text style={styles.splashSub}>AI EVOLUTION</Text>
        <Spinner size="large" />
      </ThemedView>
    );
  }

  if (appState === 'biometric') {
    return (
      <BiometricUnlockScreen
        onUnlock={() => setAppState('home')}
        onUsePassword={async () => { await clearToken(); await clearUser(); setToken(null); setUser(null); setAppState('auth'); }}
      />
    );
  }

  if (appState === 'auth') return <AuthScreen onAuth={handleAuth} />;

  return <HomeScreen token={token} currentUser={currentUser} onLogout={handleLogout} />;
}

export default function App() {
  return (
    <SkinProvider>
      <AppInner />
    </SkinProvider>
  );
}
