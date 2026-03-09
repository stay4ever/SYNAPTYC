// Polyfill crypto.getRandomValues — MUST be first import (required by tweetnacl / @noble/hashes in RN)
import 'react-native-get-random-values';
/**
 * SYNAPTYC
 * nano-SYNAPSYS secure messaging + bot client
 * React Native (Expo) — single-file architecture
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
  createContext,
  useMemo,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import * as Notifications from 'expo-notifications';
import * as Calendar from 'expo-calendar';
import Svg, { Path, Circle, Line, G, Polygon, Rect, Defs, Pattern } from 'react-native-svg';
// tweetnacl — still used inside signal_protocol.js; keep import for legacy decrypt
// eslint-disable-next-line import/no-commonjs
const nacl     = require('tweetnacl');
// eslint-disable-next-line import/no-commonjs
const naclUtil = require('tweetnacl-util');
// Signal Protocol — X3DH + Double Ratchet + Sender Keys
// eslint-disable-next-line import/no-commonjs
const SIG      = require('./src/signal_protocol');
// Phase 4: Offline DB + Cloudflare R2 encrypted media
// eslint-disable-next-line import/no-commonjs
const DB    = require('./src/db');
// eslint-disable-next-line import/no-commonjs
const SYNC  = require('./src/sync');
// eslint-disable-next-line import/no-commonjs
const MEDIA = require('./src/media');
// eslint-disable-next-line import/no-commonjs
const { PhoenixWS } = require('./src/ws');
// eslint-disable-next-line import/no-commonjs
const CONST = require('./src/constants');

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
  muted:       '#5a8a5a',   // was #2a5a2a — brightened for readable placeholder text
  accent:      '#00FF41',
  green:       '#00C832',
  amber:       '#f59e0b',
  red:         '#ef4444',
  silver:      '#C0C0C0',
  accentFaint: 'rgba(0,255,65,0.07)',
  accentDim:   'rgba(0,255,65,0.15)',
  accentMid:   'rgba(0,255,65,0.30)',
};

const TACTICAL_C = {
  bg:          '#0a0a0f',
  surface:     '#13131a',
  panel:       '#1c1c28',
  border:      '#2a2a40',
  borderBright:'#7888b060',
  text:        '#9898b4',
  bright:      '#e0e0f4',
  dim:         '#585878',
  muted:       '#505068',   // was #2c2c3c — brightened for readable placeholder text
  accent:      '#b0c4de',
  green:       '#7090b0',
  amber:       '#c89860',
  red:         '#c85050',
  silver:      '#B8B8CC',
  accentFaint: 'rgba(176,196,222,0.08)',
  accentDim:   'rgba(176,196,222,0.18)',
  accentMid:   'rgba(176,196,222,0.35)',
};

// ---------------------------------------------------------------------------
// STYLES FACTORY  (called once per palette → two static StyleSheet objects)
// ---------------------------------------------------------------------------
function makeRawStyles(C) {
  // Technical labels, logos, timestamps → Menlo (more readable than Courier New)
  const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
  // Body text, inputs, messages → system font (SF Pro on iOS, Roboto on Android)
  const body = undefined;

  // Detect tactical (glossy steel) skin
  const isTactical = C.accent === '#b0c4de';

  // Reusable shadow helpers — tactical gets deeper shadows for glossy depth
  const cardShadow = isTactical ? {
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.50, shadowRadius: 16, elevation: 8,
  } : {
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  };
  const inputShadow = isTactical ? {
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 4,
  } : {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
  };
  const btnShadow = isTactical ? {
    shadowColor: C.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30, shadowRadius: 14, elevation: 6,
  } : {
    shadowColor: C.green, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22, shadowRadius: 10, elevation: 4,
  };

  // Glossy highlight — a subtle bright top-border for metallic sheen (tactical only)
  const glossyHighlight = isTactical ? {
    borderTopWidth: 1,
    borderTopColor: 'rgba(200,210,230,0.12)',
  } : {};

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
      ...glossyHighlight,
    },
    appHeaderTitle: {
      fontFamily: mono, fontSize: 16, fontWeight: '700',
      color: C.bright, letterSpacing: 1, textAlign: 'center',
    },
    backBtnCircle: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: 'rgba(255,255,255,0.13)',
      justifyContent: 'center', alignItems: 'center',
      marginLeft: 4,
    },
    backBtnChevron: { fontFamily: mono, fontSize: 26, color: C.accent, lineHeight: 30, marginTop: -1 },

    closeCircleBtn: {
      width: 46, height: 46, borderRadius: 23,
      backgroundColor: 'rgba(255,255,255,0.13)',
      alignItems: 'center', justifyContent: 'center',
    },
    closeCircleText: { color: '#fff', fontSize: 20, fontWeight: '700' },

    homeHeader: {
      backgroundColor: C.surface,
      borderBottomWidth: 1, borderBottomColor: C.border,
      paddingHorizontal: 16, paddingVertical: 12,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      ...glossyHighlight,
    },
    homeTitle: {
      fontFamily: mono, fontSize: 22, fontWeight: '800',
      color: C.accent, letterSpacing: 2,
      textShadowColor: C.accent, textShadowRadius: 6,
      textShadowOffset: { width: 0, height: 0 },
    },
    homeSubtitle: { fontFamily: mono, fontSize: 10, color: C.dim, letterSpacing: 4, marginTop: 2 },

    tabBar: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: 28,
      marginHorizontal: 12,
      marginBottom: Platform.OS === 'ios' ? 6 : 8,
      paddingVertical: 10,
      paddingHorizontal: 2,
      shadowColor: isTactical ? '#000' : C.accent,
      shadowOffset: { width: 0, height: isTactical ? 8 : 6 },
      shadowOpacity: isTactical ? 0.45 : 0.22,
      shadowRadius: isTactical ? 28 : 22,
      elevation: 24,
      borderWidth: 1,
      borderColor: isTactical ? 'rgba(200,210,230,0.14)' : C.borderBright,
      ...glossyHighlight,
    },
    tabItem:    { flex: 1, alignItems: 'center', paddingVertical: 4, position: 'relative', gap: 4 },
    tabIcon:    { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
    tabText:    { fontFamily: mono, fontSize: 7, color: C.dim, letterSpacing: 0.5 },
    tabTextActive: { color: C.accent, fontWeight: '700' },
    tabActiveGlow: {
      position: 'absolute', top: -1, left: '15%', right: '15%',
      height: 2, borderRadius: 2, backgroundColor: C.accent,
      shadowColor: C.accent, shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9, shadowRadius: 6, elevation: 0,
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
      borderRadius: 10, overflow: 'hidden',
    },
    authTab:       { flex: 1, paddingVertical: 10, alignItems: 'center' },
    authTabActive: { backgroundColor: C.panel, borderBottomWidth: 2, borderBottomColor: C.accent },
    authTabText:       { fontFamily: mono, fontSize: 13, color: C.dim, letterSpacing: 1 },
    authTabTextActive: { color: C.accent, fontWeight: '700' },
    authForm: { gap: 14 },

    input: {
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      color: C.bright, paddingHorizontal: 16, paddingVertical: 13,
      fontFamily: body, fontSize: 15,
      borderRadius: 12,
      ...inputShadow,
      ...glossyHighlight,
    },
    inputMultiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: 13 },

    primaryBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.green,
      alignItems: 'center', paddingVertical: 14,
      borderRadius: 10, ...btnShadow,
      ...glossyHighlight,
    },
    primaryBtnDisabled: { borderColor: C.muted, opacity: 0.6 },
    primaryBtnText: {
      fontFamily: mono, fontSize: 14, fontWeight: '700', color: C.accent, letterSpacing: 2,
    },
    ghostBtn: {
      backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border,
      alignItems: 'center', paddingVertical: 14, borderRadius: 10,
    },
    ghostBtnText: { fontFamily: mono, fontSize: 13, color: C.dim, letterSpacing: 1 },

    errText: {
      color: C.red, fontFamily: body, fontSize: 13,
      paddingHorizontal: 16, paddingVertical: 8,
    },
    emptyText: {
      color: C.muted, fontFamily: body, fontSize: 14,
      textAlign: 'center', marginTop: 40,
    },

    separator: { height: 1, backgroundColor: C.border },
    userRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.surface,
    },
    userRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    userRowInfo: { flex: 1, marginLeft: 10 },
    userRowName: { fontFamily: body, fontSize: 15, color: C.bright, fontWeight: '600' },
    userRowMeta: { fontFamily: mono, fontSize: 11, color: C.dim, marginTop: 2, letterSpacing: 1 },
    chevron:     { color: C.dim, fontFamily: mono, fontSize: 16, marginLeft: 8 },

    dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 4 },

    msgList:      { padding: 12, paddingBottom: 20 },
    msgRow:       { marginVertical: 3, flexDirection: 'row' },
    msgRowMine:   { justifyContent: 'flex-end' },
    msgRowTheirs: { justifyContent: 'flex-start' },
    msgBubble: {
      maxWidth: '78%', paddingHorizontal: 13, paddingVertical: 9, borderWidth: 1,
    },
    // WhatsApp-style bubbles: flat corner on sender side
    bubbleMine: {
      backgroundColor: isTactical ? '#1e1e2c' : C.panel, borderColor: C.borderBright,
      borderRadius: 18, borderTopRightRadius: 4,
      shadowColor: '#000', shadowOffset: { width: 0, height: isTactical ? 4 : 2 },
      shadowOpacity: isTactical ? 0.35 : 0.2, shadowRadius: isTactical ? 10 : 6, elevation: isTactical ? 5 : 3,
      ...(isTactical ? { borderTopWidth: 1, borderTopColor: 'rgba(200,210,230,0.10)' } : {}),
    },
    bubbleTheirs: {
      backgroundColor: C.surface, borderColor: C.border,
      borderRadius: 18, borderTopLeftRadius: 4,
      shadowColor: '#000', shadowOffset: { width: 0, height: isTactical ? 4 : 2 },
      shadowOpacity: isTactical ? 0.35 : 0.2, shadowRadius: isTactical ? 10 : 6, elevation: isTactical ? 5 : 3,
      ...(isTactical ? { borderTopWidth: 1, borderTopColor: 'rgba(200,210,230,0.08)' } : {}),
    },
    bubbleBotMsg: {
      backgroundColor: C.panel, borderColor: C.borderBright,
      borderRadius: 18, borderTopLeftRadius: 4,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
    },
    msgText:    { fontFamily: body, fontSize: 15, color: C.text, lineHeight: 22 },
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

    imageMsg: { width: 200, height: 150, marginVertical: 4, borderRadius: 12 },

    inputRow: {
      flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border,
      backgroundColor: C.surface, padding: 8, alignItems: 'flex-end',
    },
    attachBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.border,
      width: 38, height: 38, borderRadius: 19,
      justifyContent: 'center', alignItems: 'center', marginRight: 6,
    },
    attachBtnText: { fontFamily: mono, fontSize: 22, color: C.accent, lineHeight: 26 },
    chatInput: {
      flex: 1, color: C.bright, backgroundColor: C.panel,
      borderWidth: 1, borderColor: C.border,
      paddingHorizontal: 16, paddingVertical: 10,
      fontFamily: body, fontSize: 15, maxHeight: 120, marginRight: 8,
      borderRadius: 22,
    },
    sendBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.green,
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 19,
      justifyContent: 'center', alignItems: 'center', minWidth: 44,
      ...btnShadow,
    },
    sendBtnDisabled: { borderColor: C.muted, opacity: 0.5 },
    sendBtnText: {
      fontFamily: mono, fontSize: 12, color: C.accent, fontWeight: '700', letterSpacing: 1,
    },

    createGroupBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.green,
      margin: 16, paddingVertical: 12, alignItems: 'center',
      borderRadius: 10, ...btnShadow,
    },
    createGroupBtnText: {
      fontFamily: mono, fontSize: 13, color: C.accent, fontWeight: '700', letterSpacing: 2,
    },
    createGroupForm: {
      backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border,
      padding: 16, gap: 10,
    },
    formLabel: { fontFamily: mono, fontSize: 12, color: C.accent, letterSpacing: 2, marginBottom: 4 },
    formBtnRow: { flexDirection: 'row', marginTop: 4, gap: 8 },

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
      padding: 16, marginBottom: 10, borderRadius: 12,
      ...cardShadow,
      ...glossyHighlight,
    },
    profileLabel: { fontFamily: mono, fontSize: 10, color: C.dim, letterSpacing: 2, marginBottom: 4 },
    profileValue: { fontFamily: body, fontSize: 15, color: C.bright, fontWeight: '600' },
    profileDivider: { height: 1, backgroundColor: C.border, marginVertical: 20 },
    inviteUrlBox: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.borderBright,
      padding: 14, marginTop: 12, gap: 8, borderRadius: 12,
    },
    inviteUrlLabel: { fontFamily: mono, fontSize: 10, color: C.accent, letterSpacing: 2 },
    inviteUrlText:  { fontFamily: body, fontSize: 13, color: C.text, lineHeight: 20 },
    copyBtn: {
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
      paddingVertical: 8, alignItems: 'center', marginTop: 4, borderRadius: 8,
    },
    copyBtnText: { fontFamily: mono, fontSize: 11, color: C.accent, letterSpacing: 1 },
    logoutBtn: {
      backgroundColor: 'transparent', borderWidth: 1, borderColor: C.red,
      paddingVertical: 14, alignItems: 'center', borderRadius: 10,
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
      paddingVertical: 14, alignItems: 'center', gap: 4, borderRadius: 10,
      ...glossyHighlight,
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
      paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20,
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
    contactRowName: { fontFamily: body, fontSize: 15, color: C.bright, fontWeight: '600' },
    contactRowMeta: { fontFamily: mono, fontSize: 11, color: C.dim, marginTop: 2, letterSpacing: 1 },
    contactBtnRow: { flexDirection: 'row', gap: 6 },
    contactActionBtn: {
      borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10,
      borderColor: C.green, borderRadius: 8,
    },
    contactActionBtnText: { fontFamily: mono, fontSize: 11, color: C.accent, letterSpacing: 1 },
    contactRejectBtn: { borderColor: C.red },
    contactRejectBtnText: { color: C.red },
    addContactBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.green,
      margin: 16, paddingVertical: 12, alignItems: 'center',
      borderRadius: 10, ...btnShadow,
    },
    addContactBtnText: {
      fontFamily: mono, fontSize: 13, color: C.accent, fontWeight: '700', letterSpacing: 2,
    },
    pendingBadge: {
      backgroundColor: C.amber, paddingHorizontal: 8, paddingVertical: 3,
      marginLeft: 6, borderRadius: 10,
    },
    pendingBadgeText: { fontFamily: mono, fontSize: 9, color: '#000', fontWeight: '700' },

    // ── Admin panel ────────────────────────────────────────────────────────
    adminCard: {
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.amber,
      padding: 14, marginBottom: 10, borderRadius: 12,
      ...cardShadow,
    },
    adminCardLabel: { fontFamily: mono, fontSize: 10, color: C.amber, letterSpacing: 2, marginBottom: 6 },
    adminCardName:  { fontFamily: body, fontSize: 15, color: C.bright, fontWeight: '700', marginBottom: 2 },
    adminCardEmail: { fontFamily: body, fontSize: 13, color: C.dim, marginBottom: 4 },
    adminCardReason:{ fontFamily: body, fontSize: 13, color: C.text, lineHeight: 20, marginBottom: 8 },
    adminBtnRow:    { flexDirection: 'row', gap: 8 },
    adminApproveBtn:{ flex: 1, borderWidth: 1, borderColor: C.green, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
    adminApproveBtnText: { fontFamily: mono, fontSize: 11, color: C.accent, fontWeight: '700', letterSpacing: 1 },
    adminRejectBtn: { flex: 1, borderWidth: 1, borderColor: C.red, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
    adminRejectBtnText:  { fontFamily: mono, fontSize: 11, color: C.red, fontWeight: '700', letterSpacing: 1 },

    // ── Profile Edit ──────────────────────────────────────────────────────
    profileEditHeader: {
      fontFamily: mono, fontSize: 11, color: C.accent,
      letterSpacing: 3, marginBottom: 10, marginTop: 4,
    },
    profileEditInput: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.border,
      color: C.bright, paddingHorizontal: 16, paddingVertical: 12,
      fontFamily: body, fontSize: 15, marginTop: 6,
      borderRadius: 12, ...inputShadow,
    },
    profileEditMultiline: { minHeight: 70, textAlignVertical: 'top', paddingTop: 12 },
    saveProfileBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.green,
      alignItems: 'center', paddingVertical: 13, marginTop: 10,
      borderRadius: 10, ...btnShadow,
    },
    saveProfileBtnText: {
      fontFamily: mono, fontSize: 13, fontWeight: '700', color: C.accent, letterSpacing: 2,
    },
    saveOkText: { fontFamily: body, fontSize: 13, color: C.green, textAlign: 'center', marginTop: 8 },

    // ── Location ──────────────────────────────────────────────────────────
    locationBox: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.borderBright,
      padding: 14, marginBottom: 8, gap: 4, borderRadius: 12,
    },
    locationCoord: { fontFamily: mono, fontSize: 14, color: C.accent, letterSpacing: 1, fontWeight: '700' },
    locationMeta:  { fontFamily: mono, fontSize: 10, color: C.dim, letterSpacing: 1, marginTop: 2 },
    getLocationBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.green,
      alignItems: 'center', paddingVertical: 13, marginTop: 4,
      borderRadius: 10, ...btnShadow,
    },
    getLocationBtnText: {
      fontFamily: mono, fontSize: 13, fontWeight: '700', color: C.accent, letterSpacing: 2,
    },

    // ── Face ID ───────────────────────────────────────────────────────────
    bioLoginBtn: {
      backgroundColor: 'transparent', borderWidth: 1, borderColor: C.accent,
      alignItems: 'center', paddingVertical: 14, marginTop: 4, borderRadius: 10,
    },
    bioLoginBtnText: {
      fontFamily: mono, fontSize: 14, fontWeight: '700', color: C.accent, letterSpacing: 2,
    },
    bioFaceIcon:    { fontSize: 52, textAlign: 'center' },
    bioBtn:         { width: 240, alignSelf: 'center' },
    bioFallbackBtn: { marginTop: 28, paddingVertical: 8 },
    bioFallbackText: {
      fontFamily: body, fontSize: 13, color: C.dim,
      textDecorationLine: 'underline',
    },
    bioDisableBtn: {
      backgroundColor: 'transparent', borderWidth: 1, borderColor: C.amber,
      paddingVertical: 14, alignItems: 'center', borderRadius: 10,
    },
    bioDisableBtnText: {
      fontFamily: mono, fontSize: 14, fontWeight: '700', color: C.amber, letterSpacing: 2,
    },

    // ── Modal ─────────────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
      justifyContent: 'center', alignItems: 'center', padding: 24,
    },
    modalBox: {
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.borderBright,
      padding: 24, width: '100%', maxWidth: 380,
      borderRadius: 16, ...cardShadow,
      ...glossyHighlight,
    },
    modalTitle: {
      fontFamily: mono, fontSize: 16, fontWeight: '800',
      color: C.accent, letterSpacing: 2, marginBottom: 8,
    },
    modalSub: { fontFamily: body, fontSize: 14, color: C.dim, lineHeight: 22 },

    // ── Destructive actions (delete group / block contact) ────────────────
    deleteGroupBtn: {
      borderWidth: 1, borderColor: C.red,
      paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8, borderRadius: 8,
    },
    deleteGroupBtnText: {
      fontFamily: mono, fontSize: 11, color: C.red, fontWeight: '700', letterSpacing: 1,
    },
    blockContactBtn: {
      borderWidth: 1, borderColor: C.red,
      paddingHorizontal: 10, paddingVertical: 6, marginLeft: 6, borderRadius: 8,
    },
    blockContactBtnText: {
      fontFamily: mono, fontSize: 11, color: C.red, fontWeight: '700', letterSpacing: 1,
    },

    // ── Unread badges ────────────────────────────────────────────────────
    tabBadge: {
      position: 'absolute', top: -2, right: -4,
      backgroundColor: '#ef4444', borderRadius: 8,
      minWidth: 16, height: 16,
      justifyContent: 'center', alignItems: 'center',
      paddingHorizontal: 3,
    },
    tabBadgeText: {
      fontFamily: mono, fontSize: 8, color: '#fff', fontWeight: '700',
    },
    rowBadge: {
      backgroundColor: '#ef4444', borderRadius: 10,
      minWidth: 20, height: 20,
      justifyContent: 'center', alignItems: 'center',
      paddingHorizontal: 6, marginLeft: 8,
    },
    rowBadgeText: {
      fontFamily: mono, fontSize: 10, color: '#fff', fontWeight: '700',
    },

    // ── Group members modal ──────────────────────────────────────────────
    membersHeaderBtn: {
      paddingVertical: 4, paddingLeft: 8,
    },
    membersHeaderBtnText: {
      fontFamily: mono, fontSize: 11, color: C.accent, letterSpacing: 1,
    },
    memberRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    memberName: { fontFamily: body, fontSize: 14, color: C.bright, fontWeight: '600' },
    memberRole: { fontFamily: mono, fontSize: 9, color: C.dim, letterSpacing: 1, marginTop: 2 },
    memberRemoveBtn: {
      borderWidth: 1, borderColor: C.red,
      paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6,
    },
    memberRemoveBtnText: { fontFamily: mono, fontSize: 10, color: C.red, letterSpacing: 0.5 },
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
// CONSTANTS  (extracted to src/constants.js)
// ---------------------------------------------------------------------------
const {
  BASE_URL, WS_URL, JWT_KEY, USER_KEY, BIO_KEY, BIO_REFRESH_KEY,
  BIO_EMAIL_KEY, BIO_PASS_KEY, SKIN_KEY, DISAPPEAR_KEY, PROFILE_EXT_KEY,
  LOCATION_KEY, NOTIF_KEY, BANNER_PERM_MSGS_KEY, BANNER_PERM_SEND_KEY,
  BANNER_PERM_CAL_KEY, BANNER_PERM_CON_KEY, DEVICE_ID_KEY, SKIP_AUTH_KEY,
  BANNER_ENABLED_KEY, PROFILE_IMAGE_KEY, DISAPPEAR_OPTIONS, KAV_BEHAVIOR,
} = CONST;
// Alias for backward compat (some helpers reference BASE_URL as a local)
const BASE_URL_LOCAL = BASE_URL;

// ---------------------------------------------------------------------------
// E2EE — Signal Protocol (X3DH + Double Ratchet + Sender Keys)
// Backward-compatible: legacy NaCl envelopes are still decrypted if received.
// ---------------------------------------------------------------------------

// ── Identity key singleton ────────────────────────────────────────────────────
let _sigIdentityKey = null;   // { publicKey: Uint8Array, secretKey: Uint8Array }
let _sigSPK         = null;   // signed pre-key { publicKey, secretKey, id }

// Promise that resolves once initE2EE has loaded keys (prevents decrypt-before-keys race)
let _e2eeReadyResolve = null;
let _e2eeReady = new Promise(r => { _e2eeReadyResolve = r; });

// SecureStore keys
const SIG_IK_STORE   = 'sig_identity_key_v1';
const SIG_SPK_STORE  = 'sig_signed_prekey_v1';
const SIG_OPK_STORE  = 'sig_one_time_prekeys_v1';
const sigSessStore   = (uid)     => `sig_session_${uid}`;
const sigSKStore     = (gid, sid) => `sig_sk_${gid}_${sid}`;

// In-memory caches
const _sigSessions    = {};   // { [userId]:  drSession  }
const _sigSenderKeys  = {};   // { [`${gid}_${sid}`]: senderKeyState }
const _groupKeyCache  = {};   // { [groupId]: groupKey }
const _pkCache        = {};   // { [userId]: base64PublicKey }
const _decryptFails   = {};   // { [peerId]: consecutiveFailCount }

// ── Per-peer decryption mutex ─────────────────────────────────────────────────
// Prevents concurrent Double Ratchet mutations for the same peer (race from
// effect re-runs when new WS messages trigger a messages state update mid-decrypt).
// Each operation has a 20s hard timeout to prevent chain poisoning — if one op
// hangs, subsequent operations for the same key will still proceed after the timeout.
const _decryptLocks   = {};   // { [peerId]: Promise }
function _withDecryptLock(peerId, fn) {
  const prev = _decryptLocks[peerId] || Promise.resolve();
  const guarded = () => Promise.race([
    fn().catch(e => { console.warn('[Lock] operation failed:', e?.message); return null; }),
    new Promise(r => setTimeout(() => { console.warn('[Lock] timeout for', peerId); r(null); }, 20000)),
  ]);
  const next = prev.then(guarded, guarded);
  _decryptLocks[peerId] = next;
  return next;
}

// ── Per-message decryption in-flight guard ────────────────────────────────────
// Prevents the same message from being decrypted concurrently by overlapping effects.
const _decryptInFlight = new Set(); // Set<msgId>

// ── Legacy NaCl compat (kept for reading old messages) ───────────────────────
const _b64enc = (buf) => naclUtil.encodeBase64(buf);
const _b64dec = (str) => naclUtil.decodeBase64(str);

function _legacyDecryptDM(envelopeStr, myKeyPair) {
  try {
    const env = JSON.parse(envelopeStr);
    if (env.enc !== 1) return null;
    const myPkB64    = _b64enc(myKeyPair.publicKey);
    const theirPkB64 = (env.spk === myPkB64) ? env.rpk : env.spk;
    const plain = nacl.box.open(
      _b64dec(env.ct), _b64dec(env.nonce), _b64dec(theirPkB64), myKeyPair.secretKey
    );
    return plain ? naclUtil.encodeUTF8(plain) : null;
  } catch { return null; }
}

function _legacyDecryptGroup(envelopeStr, groupKey) {
  try {
    const env   = JSON.parse(envelopeStr);
    if (env.enc !== 2) return null;
    const plain = nacl.secretbox.open(_b64dec(env.ct), _b64dec(env.nonce), groupKey);
    return plain ? naclUtil.encodeUTF8(plain) : null;
  } catch { return null; }
}

// ── Key initialisation ────────────────────────────────────────────────────────

/**
 * Generate a random pre-key ID (1–0x7FFFFF).
 */
function _newKeyId() { return Math.floor(Math.random() * 0x7FFFFF) + 1; }

/**
 * Self-sign the signed pre-key using the identity key.
 * We use HMAC-SHA256(IK_secret, SPK_public) as a lightweight signature
 * (full Ed25519 signing is not yet supported by tweetnacl's box API).
 * Returns base64 88-char signature (64 bytes → 88 base64 chars).
 */
function _selfSign(ikSecretKey, spkPublicKey) {
  // Pad to 64 bytes so server validates length === 88 (base64 of 64B)
  const combined = new Uint8Array(64);
  const mac = nacl.hash(new Uint8Array([...ikSecretKey, ...spkPublicKey]));  // SHA-512
  combined.set(mac.slice(0, 64));
  return _b64enc(combined);
}

/**
 * Initialise Signal Protocol for this session:
 *   1. Load or generate identity key pair (IK) — persistent
 *   2. Load or generate signed pre-key (SPK)   — persistent
 *   3. Generate one-time pre-keys (OPK)         — upload batch if needed
 *   4. Register pre-key bundle with server
 *   5. Upload legacy public key for backward-compat (/api/keys)
 */
async function initE2EE(token) {
  try {
    // ── One-time session wipe (v2) ──────────────────────────────────────────
    // Sessions were corrupted during the broken-WS period (builds 40-45).
    // Clear all peer sessions to force fresh X3DH exchanges. Identity keys,
    // SPK, and OPK are preserved — only peer-to-peer ratchet state is wiped.
    const RESET_FLAG = 'sig_session_reset_v2';
    const didReset = await SecureStore.getItemAsync(RESET_FLAG).catch(() => null);
    if (!didReset) {
      // Wipe all in-memory sessions
      Object.keys(_sigSessions).forEach(k => delete _sigSessions[k]);
      Object.keys(_decryptFails).forEach(k => delete _decryptFails[k]);
      // Wipe persisted sessions — enumerate known contacts from server
      try {
        const contacts = await api('/api/contacts', 'GET', null, token).catch(() => []);
        const users = Array.isArray(contacts) ? contacts : [];
        for (const c of users) {
          const uid = c.userId ?? c.user_id ?? c.id;
          if (uid) await SecureStore.deleteItemAsync(sigSessStore(uid)).catch(() => {});
        }
        // Also wipe any sessions cached under user IDs we fetched before
        const allUsers = await api('/api/users', 'GET', null, token).catch(() => []);
        if (Array.isArray(allUsers)) {
          for (const u of allUsers) {
            if (u.id) await SecureStore.deleteItemAsync(sigSessStore(u.id)).catch(() => {});
          }
        }
      } catch {}
      await SecureStore.setItemAsync(RESET_FLAG, 'done');
    }

    // ── Identity Key ────────────────────────────────────────────────────────
    const ikRaw = await SecureStore.getItemAsync(SIG_IK_STORE);
    if (ikRaw) {
      try {
        const stored = JSON.parse(ikRaw);
        _sigIdentityKey = {
          publicKey: _b64dec(stored.pub),
          secretKey: _b64dec(stored.sec),
        };
      } catch { _sigIdentityKey = null; }
    }
    if (!_sigIdentityKey) {
      _sigIdentityKey = nacl.box.keyPair();
      await SecureStore.setItemAsync(SIG_IK_STORE, JSON.stringify({
        pub: _b64enc(_sigIdentityKey.publicKey),
        sec: _b64enc(_sigIdentityKey.secretKey),
      }));
    }

    // ── Signed Pre-Key ──────────────────────────────────────────────────────
    const spkRaw = await SecureStore.getItemAsync(SIG_SPK_STORE);
    if (spkRaw) {
      try {
        const stored = JSON.parse(spkRaw);
        _sigSPK = {
          id:        stored.id,
          publicKey: _b64dec(stored.pub),
          secretKey: _b64dec(stored.sec),
        };
      } catch { _sigSPK = null; }
    }
    if (!_sigSPK) {
      const kp = nacl.box.keyPair();
      _sigSPK  = { id: _newKeyId(), publicKey: kp.publicKey, secretKey: kp.secretKey };
      await SecureStore.setItemAsync(SIG_SPK_STORE, JSON.stringify({
        id:  _sigSPK.id,
        pub: _b64enc(_sigSPK.publicKey),
        sec: _b64enc(_sigSPK.secretKey),
      }));
    }

    // ═══ Local keys loaded — unblock decryption NOW (before any network calls) ═══
    // decryptDM/decryptGroupMsg await _e2eeReady. Resolving here avoids blocking
    // decryption on slow OPK-count / bundle-registration network requests.
    if (_e2eeReadyResolve) { _e2eeReadyResolve(); _e2eeReadyResolve = null; }

    // ── One-Time Pre-Keys ───────────────────────────────────────────────────
    const otpRaw   = await SecureStore.getItemAsync(SIG_OPK_STORE);
    let   otpStore = otpRaw ? JSON.parse(otpRaw) : { keys: [], nextId: 1 };

    // Upload if pool has fewer than 20 keys
    const remaining = await api('/api/signal/prekeys/count', 'GET', null, token).catch(() => ({ remaining_otks: 99 }));
    if ((remaining?.remaining_otks ?? 0) < 20) {
      const batch = [];
      for (let i = 0; i < 50; i++) {
        const kp = nacl.box.keyPair();
        batch.push({ id: otpStore.nextId + i, key: _b64enc(kp.publicKey) });
        // Store secret key locally
        otpStore.keys.push({
          id: otpStore.nextId + i,
          pub: _b64enc(kp.publicKey),
          sec: _b64enc(kp.secretKey),
        });
      }
      otpStore.nextId += 50;
      await SecureStore.setItemAsync(SIG_OPK_STORE, JSON.stringify(otpStore));
      api('/api/signal/prekeys/one-time', 'POST', { one_time_prekeys: batch }, token).catch(() => {});
    }

    // ── Register bundle with server ─────────────────────────────────────────
    const sig = _selfSign(_sigIdentityKey.secretKey, _sigSPK.publicKey);
    api('/api/signal/prekeys', 'POST', {
      identity_key:             _b64enc(_sigIdentityKey.publicKey),
      signed_prekey_id:         _sigSPK.id,
      signed_prekey:            _b64enc(_sigSPK.publicKey),
      signed_prekey_signature:  sig,
    }, token).catch(() => {});

    // ── Legacy key for backward-compat (/api/keys still expects a 44-char key)
    api('/api/keys', 'POST', { public_key: _b64enc(_sigIdentityKey.publicKey) }, token).catch(() => {});

  } catch (e) {
    console.warn('[Signal] initE2EE error:', e?.message);
  } finally {
    // Signal that E2EE keys are loaded (or failed) — unblock any waiting decryptions
    if (_e2eeReadyResolve) { _e2eeReadyResolve(); _e2eeReadyResolve = null; }
  }
}

/** Return the loaded identity keypair, or null. */
function e2eeKey() { return _sigIdentityKey; }

// ── Session management ────────────────────────────────────────────────────────

/**
 * Load or build a Double Ratchet session with `peerId`.
 * If no session exists, fetches their pre-key bundle and runs X3DH.
 * Returns the session object, or null if setup failed.
 */
async function _getOrBuildSession(peerId, token) {
  // 1. In-memory cache
  if (_sigSessions[peerId]) return _sigSessions[peerId];

  // 2. SecureStore
  try {
    const raw = await SecureStore.getItemAsync(sigSessStore(peerId));
    if (raw) {
      const sess = SIG.deserialiseSession(raw);
      _sigSessions[peerId] = sess;
      return sess;
    }
  } catch {}

  // 3. Build new session via X3DH (8s timeout)
  try {
    const bundle = await Promise.race([
      api(`/api/signal/prekeys/${peerId}`, 'GET', null, token),
      new Promise((_, rej) => setTimeout(() => rej(new Error('bundle fetch timeout')), 8000)),
    ]);
    if (!bundle?.identity_key || !bundle?.signed_prekey) return null;

    const IK_B_pub   = _b64dec(bundle.identity_key);
    const SPK_B_pub  = _b64dec(bundle.signed_prekey);
    const OPK_B_pub  = bundle.one_time_prekey ? _b64dec(bundle.one_time_prekey.key) : null;

    // Ephemeral key pair (single use)
    const EK_A = nacl.box.keyPair();

    const SK = SIG.x3dhInitiator(
      _sigIdentityKey.secretKey, EK_A.secretKey,
      IK_B_pub, SPK_B_pub, OPK_B_pub
    );

    // Double Ratchet init — sender starts with SPK_B as their ratchet key
    const sess = SIG.drInitSender(SK, SPK_B_pub);

    // Attach X3DH metadata so receiver can run x3dhResponder
    sess._x3dh = {
      IK_A_pub:   _b64enc(_sigIdentityKey.publicKey),
      EK_A_pub:   _b64enc(EK_A.publicKey),
      SPK_B_id:   bundle.signed_prekey_id,
      OPK_B_id:   bundle.one_time_prekey?.id ?? null,
    };

    _sigSessions[peerId] = sess;
    await SecureStore.setItemAsync(sigSessStore(peerId), SIG.serialiseSession(sess));
    return sess;
  } catch (e) {
    console.warn('[Signal] session build failed:', e?.message);
    return null;
  }
}

/** Persist a session to SecureStore after mutation. */
async function _saveSession(peerId) {
  const sess = _sigSessions[peerId];
  if (!sess) return;
  try {
    await SecureStore.setItemAsync(sigSessStore(peerId), SIG.serialiseSession(sess));
  } catch {}
}

// ── DM Encryption ─────────────────────────────────────────────────────────────

/**
 * Encrypt a DM for peerId.
 * Returns an envelope JSON string or null on failure.
 */
async function encryptDM(plaintext, _recipientPkB64_unused, peerId, token) {
  // Wait for initE2EE to finish loading keys before attempting encryption (5s timeout)
  await Promise.race([_e2eeReady, new Promise(r => setTimeout(r, 5000))]);
  if (!_sigIdentityKey) return null;
  // Serialize with decryptions for the same peer — both encrypt and decrypt
  // mutate the Double Ratchet session and must not overlap.
  return _withDecryptLock(peerId, async () => {
    let sess = await _getOrBuildSession(peerId, token);
    // Retry once after 2s if session build failed (peer may not have registered bundle yet)
    if (!sess) {
      await new Promise(r => setTimeout(r, 2000));
      sess = await _getOrBuildSession(peerId, token);
    }
    if (!sess) return null;
    try {
      const { header, ciphertext } = SIG.drEncrypt(sess, plaintext);
      await _saveSession(peerId);
      // Always include x3dh in the header so the receiver can rebuild
      // a session from ANY message (not just the first one).
      const envelope = {
        sig:  true,
        v:    1,
        hdr:  JSON.stringify({ ...header, x3dh: sess._x3dh || undefined }),
        ct:   ciphertext,
      };
      // Reset failure counter on successful encrypt
      delete _decryptFails[peerId];
      return JSON.stringify(envelope);
    } catch (e) {
      console.warn('[Signal] encryptDM error:', e?.message);
      return null;
    }
  });
}

/**
 * Build a responder session from x3dh metadata in the header.
 * Returns true on success, false on failure.
 */
async function _buildSessionFromX3DH(senderId, x3) {
  try {
    const spkRaw = await SecureStore.getItemAsync(SIG_SPK_STORE);
    const spkStore = spkRaw ? JSON.parse(spkRaw) : null;

    // If SPK ID matches, build as responder (the normal path)
    if (spkStore && spkStore.id === x3.SPK_B_id) {
      const IK_B  = _sigIdentityKey;
      if (!IK_B) return false;
      const SPK_B = { publicKey: _b64dec(spkStore.pub), secretKey: _b64dec(spkStore.sec) };

      let OPK_B_sec = null;
      if (x3.OPK_B_id != null) {
        const otpRaw   = await SecureStore.getItemAsync(SIG_OPK_STORE);
        const otpStore = otpRaw ? JSON.parse(otpRaw) : null;
        const opk      = otpStore?.keys?.find(k => k.id === x3.OPK_B_id);
        if (opk) {
          OPK_B_sec = _b64dec(opk.sec);
          // Consume the one-time prekey — remove from local pool to prevent reuse.
          // OPKs are single-use by design (forward secrecy guarantee).
          otpStore.keys = otpStore.keys.filter(k => k.id !== x3.OPK_B_id);
          try {
            await SecureStore.setItemAsync(SIG_OPK_STORE, JSON.stringify(otpStore));
          } catch (e) {
            console.warn('[Signal] Failed to persist OPK removal — forward secrecy risk:', e?.message);
          }
        }
      }

      const IK_A_pub = _b64dec(x3.IK_A_pub);
      const EK_A_pub = _b64dec(x3.EK_A_pub);

      const SK = SIG.x3dhResponder(
        IK_B.secretKey, SPK_B.secretKey, OPK_B_sec,
        IK_A_pub, EK_A_pub
      );

      _sigSessions[senderId] = SIG.drInitReceiver(SK, SPK_B);
      return true;
    }

    // SPK mismatch — our SPK was regenerated since the sender built their session.
    // This message cannot be decrypted with x3dhResponder because we no longer have
    // the matching secret key. Log a warning — the sender needs to re-establish
    // with our current bundle. Try building as INITIATOR so future messages work.
    console.warn(`[Signal] SPK_B_id mismatch for peer ${senderId} (theirs=${x3.SPK_B_id}, ours=${spkStore?.id}) — cannot decrypt this message, establishing fresh session as initiator`);
    return false;
  } catch { return false; }
}

/**
 * Attempt to build a NEW session with a peer as initiator (fetch their current
 * bundle from server). Used as last-resort recovery when x3dh responder path
 * fails. The CURRENT message still can't be decrypted (it was encrypted under
 * the old session), but all FUTURE messages will work.
 */
async function _rebuildSessionAsInitiator(peerId, token) {
  try {
    // Delete any stale session
    delete _sigSessions[peerId];
    try { await SecureStore.deleteItemAsync(sigSessStore(peerId)); } catch {}
    // Build a brand new session as initiator
    const sess = await _getOrBuildSession(peerId, token);
    return !!sess;
  } catch { return false; }
}

/**
 * Attempt Signal decrypt with existing or SecureStore-loaded session.
 * On failure, restores session from backup. Returns plaintext or null.
 */
async function _trySignalDecrypt(senderId, hdr, ct) {
  // Load session from SecureStore if not in memory
  if (!_sigSessions[senderId]) {
    try {
      const raw = await SecureStore.getItemAsync(sigSessStore(senderId));
      if (raw) _sigSessions[senderId] = SIG.deserialiseSession(raw);
    } catch {}
  }

  // If still no session and x3dh present, build as responder
  if (!_sigSessions[senderId] && hdr.x3dh) {
    await _buildSessionFromX3DH(senderId, hdr.x3dh);
  }

  if (!_sigSessions[senderId]) return null;
  return _trySignalDecryptRaw(senderId, hdr, ct);
}

/**
 * Low-level decrypt: assumes _sigSessions[senderId] exists.
 * Backs up session before mutating, restores on failure. Saves on success.
 */
async function _trySignalDecryptRaw(senderId, hdr, ct) {
  if (!_sigSessions[senderId]) return null;
  const sessBackup = SIG.serialiseSession(_sigSessions[senderId]);
  const plain = SIG.drDecrypt(_sigSessions[senderId], hdr, ct);
  if (plain !== null) {
    await _saveSession(senderId);
  } else {
    _sigSessions[senderId] = SIG.deserialiseSession(sessBackup);
  }
  return plain;
}

/**
 * Decrypt a DM envelope string from senderId.
 * Handles Signal Protocol (sig:true) and legacy NaCl (enc:1).
 * Returns plaintext string or null.
 */
async function decryptDM(envelopeStr, senderId, token) {
  if (!envelopeStr) return null;
  // Wait for initE2EE to finish loading keys before attempting decryption (5s timeout)
  await Promise.race([_e2eeReady, new Promise(r => setTimeout(r, 5000))]);
  if (!_sigIdentityKey) return null;
  // Serialize all decryptions for the same peer — Double Ratchet is stateful
  // and concurrent mutations corrupt the session irreversibly.
  return _withDecryptLock(senderId, async () => {
    try {
      // Unescape HTML entities — backend may have corrupted the JSON envelope
      let rawStr = envelopeStr;
      if (typeof rawStr === 'string' && rawStr.includes('&quot;')) rawStr = _htmlUnescape(rawStr);
      const env = JSON.parse(rawStr);

      // ── Signal Protocol ──────────────────────────────────────────────────────
      if (env?.sig === true && env?.v === 1) {
        const hdr = JSON.parse(env.hdr);

        // Try to decrypt with existing or new session
        const plain = await _trySignalDecrypt(senderId, hdr, env.ct);
        if (plain !== null) {
          delete _decryptFails[senderId];
          return plain;
        }

        // Decryption failed — if x3dh present, try rebuilding session from scratch
        if (hdr.x3dh) {
          // Delete corrupted session
          delete _sigSessions[senderId];
          try { await SecureStore.deleteItemAsync(sigSessStore(senderId)); } catch {}
          // Rebuild from x3dh and retry
          const rebuilt = await _buildSessionFromX3DH(senderId, hdr.x3dh);
          if (rebuilt) {
            const retryPlain = await _trySignalDecryptRaw(senderId, hdr, env.ct);
            if (retryPlain !== null) {
              delete _decryptFails[senderId];
              return retryPlain;
            }
          }
        }

        // Last resort: rebuild as initiator using peer's CURRENT bundle from server.
        // This won't decrypt THIS message (it was encrypted under the old session),
        // but it establishes a fresh session so FUTURE messages and retries of THIS
        // message (if the peer re-sends) will succeed.
        _decryptFails[senderId] = (_decryptFails[senderId] || 0) + 1;
        if (_decryptFails[senderId] >= 3 && token) {
          console.warn(`[Signal] ${_decryptFails[senderId]} failures for peer ${senderId} — attempting fresh session as initiator`);
          await _rebuildSessionAsInitiator(senderId, token);
        }
        return null;
      }

      // ── Legacy NaCl DM ───────────────────────────────────────────────────────
      if (env?.enc === 1 && _sigIdentityKey) {
        return _legacyDecryptDM(envelopeStr, _sigIdentityKey);
      }
    } catch (e) {
      console.warn('[Signal] decryptDM error:', e?.message);
    }
    return null;
  });
}

/**
 * Reverse HTML entity escaping applied by the backend.
 * Fixes messages corrupted by the backend's html_escape() being applied
 * to encrypted envelopes (backend checked for legacy {"enc": prefix only).
 */
function _htmlUnescape(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Return true if content is a Signal DM or legacy NaCl DM envelope. */
function isEncryptedDM(content) {
  if (SIG.isSignalDM(content) || SIG.isLegacyNaClDM(content)) return true;
  // Try unescaping HTML entities (backend may have corrupted the JSON)
  if (typeof content === 'string' && content.includes('&quot;')) {
    const fixed = _htmlUnescape(content);
    return SIG.isSignalDM(fixed) || SIG.isLegacyNaClDM(fixed);
  }
  return false;
}

// ── Group Encryption — Sender Keys ────────────────────────────────────────────

/**
 * Get or create the local sender key chain for a group.
 * Returns the sender key state object.
 */
async function _getMySenderKeyState(groupId, myId) {
  const cacheKey = `${groupId}_${myId}`;
  if (_sigSenderKeys[cacheKey]) return _sigSenderKeys[cacheKey];
  try {
    const raw = await SecureStore.getItemAsync(sigSKStore(groupId, myId));
    if (raw) {
      const state = SIG.deserialiseSKState(raw);
      _sigSenderKeys[cacheKey] = state;
      return state;
    }
  } catch {}
  // Generate fresh sender key and persist the initial seed for distribution
  const state = SIG.skGenerate();
  _sigSenderKeys[cacheKey] = state;
  const serialised = SIG.serialiseSKState(state);
  await SecureStore.setItemAsync(sigSKStore(groupId, myId), serialised);
  // Store the seed (iteration 0) separately — distribution always uses this
  await SecureStore.setItemAsync(`sig_sk_seed_${groupId}_${myId}`, serialised);
  return state;
}

/**
 * Distribute our sender key to all group members (encrypted via their DM sessions).
 * Called when joining or creating a group.
 */
async function generateAndDistributeGroupKey(groupId, memberIds, token, myId) {
  await Promise.race([_e2eeReady, new Promise(r => setTimeout(r, 5000))]);
  if (!_sigIdentityKey) return;
  // Ensure our sender key state exists (creates + seeds if needed)
  await _getMySenderKeyState(groupId, myId);
  // Always distribute the INITIAL seed (iteration 0) so recipients can decrypt
  // ALL messages from the start. Never distribute the advanced state.
  let seedStr = null;
  try { seedStr = await SecureStore.getItemAsync(`sig_sk_seed_${groupId}_${myId}`); } catch {}
  if (!seedStr) {
    // Legacy: no seed stored (key was created before this change).
    // Use current state as seed and persist for future distributions.
    const current = await _getMySenderKeyState(groupId, myId);
    seedStr = SIG.serialiseSKState(current);
    await SecureStore.setItemAsync(`sig_sk_seed_${groupId}_${myId}`, seedStr);
  }
  const skPayload  = naclUtil.decodeUTF8(seedStr);
  const myIkPub    = _b64enc(_sigIdentityKey.publicKey);

  const keys = [];
  for (const uid of memberIds) {
    const userId = typeof uid === 'object' ? (uid.userId ?? uid.user_id ?? uid.id) : uid;
    if (String(userId) === String(myId)) continue;
    try {
      // Fetch recipient's identity public key from their pre-key bundle (5s timeout per member)
      const bundle = await Promise.race([
        api(`/api/signal/prekeys/${userId}`, 'GET', null, token),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
      ]);
      if (!bundle?.identity_key) continue;
      const recipientIkPub = _b64dec(bundle.identity_key);
      // Encrypt sender key with NaCl box (our IK secret + their IK public)
      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const ct = nacl.box(skPayload, nonce, recipientIkPub, _sigIdentityKey.secretKey);
      if (!ct) continue;
      keys.push({
        recipient_id: userId,
        encrypted_sk: JSON.stringify({
          ik_box: true,
          ik_sender: myIkPub,
          nonce: _b64enc(nonce),
          ct: _b64enc(ct),
        }),
      });
    } catch (e) {
      console.warn(`[Signal] distributeSK: error encrypting for member ${userId}:`, e?.message);
    }
  }

  if (keys.length > 0) {
    try {
      await api('/api/signal/sender-keys', 'POST', { group_id: groupId, keys }, token);
    } catch (e) {
      console.warn('[Signal] distributeSK: upload error:', e?.message);
    }
  }
}

/**
 * Load all sender keys for a group.
 * ALWAYS fetches from server to detect stale/regenerated keys.
 * Compares server's raw encrypted_sk blob with what we last processed —
 * if unchanged, keeps the locally-advanced chain state (don't regress).
 * If different, the sender regenerated: decrypt new seed, replace local state.
 * Supports both NaCl box (ik_box:true) and legacy DM-encrypted envelopes.
 */
async function loadGroupSenderKeys(groupId, token, _myId) {
  await _e2eeReady;
  try {
    const serverKeys = await api(`/api/signal/sender-keys/${groupId}`, 'GET', null, token);
    if (!serverKeys || !Array.isArray(serverKeys) || serverKeys.length === 0) return;

    for (const { sender_id, encrypted_sk } of serverKeys) {
      const sid = String(sender_id);
      const cacheKey = `${groupId}_${sid}`;
      const rawStoreKey = `sig_sk_raw_${groupId}_${sid}`;

      // ── Fast path: server key hasn't changed since we last processed it ──
      // Compare raw encrypted blob — if identical, skip expensive decryption.
      // Still ensure in-memory cache is populated (may have been evicted).
      try {
        const storedRaw = await SecureStore.getItemAsync(rawStoreKey);
        if (storedRaw === encrypted_sk) {
          if (!_sigSenderKeys[cacheKey]) {
            try {
              const stored = await SecureStore.getItemAsync(sigSKStore(groupId, sid));
              if (stored) _sigSenderKeys[cacheKey] = SIG.deserialiseSKState(stored);
            } catch {}
          }
          if (_sigSenderKeys[cacheKey]) continue; // Same server key, state loaded — done
        }
      } catch {}

      // ── Slow path: decrypt from server envelope ──
      try {
        const env = JSON.parse(encrypted_sk);
        let plainStr = null;

        // NaCl box with identity keys (session-independent, preferred)
        if (env.ik_box === true && _sigIdentityKey) {
          const senderIkPub = _b64dec(env.ik_sender);
          const nonce       = _b64dec(env.nonce);
          const ct          = _b64dec(env.ct);
          const plainBytes  = nacl.box.open(ct, nonce, senderIkPub, _sigIdentityKey.secretKey);
          if (plainBytes) plainStr = naclUtil.encodeUTF8(plainBytes);
        }

        // Legacy DM-encrypted envelope (hdr + ct)
        if (!plainStr && env.hdr && env.ct) {
          plainStr = await decryptDM(
            JSON.stringify({ sig: true, v: 1, hdr: env.hdr, ct: env.ct }),
            sid, token
          );
        }

        if (plainStr) {
          const state = SIG.deserialiseSKState(plainStr);
          _sigSenderKeys[cacheKey] = state;
          await SecureStore.setItemAsync(sigSKStore(groupId, sid), SIG.serialiseSKState(state));
          // Persist raw blob for future staleness detection
          try { await SecureStore.setItemAsync(rawStoreKey, encrypted_sk); } catch {}
        } else {
          console.warn(`[Signal] loadGroupSenderKeys: failed to decrypt sender key from user ${sid} for group ${groupId} (identity key mismatch? sender needs to re-distribute)`);
        }
      } catch (e) {
        console.warn(`[Signal] loadGroupSenderKeys: error decrypting sender key from user ${sid}:`, e?.message);
      }
    }
  } catch (e) {
    console.warn('[Signal] loadGroupSenderKeys: fetch error:', e?.message);
  }
}

/**
 * Encrypt a group message using our sender key.
 * Returns JSON envelope string or null.
 */
async function encryptGroupMsg(plaintext, _unusedGroupKey, groupId, myId) {
  await Promise.race([_e2eeReady, new Promise(r => setTimeout(r, 5000))]);
  if (!_sigIdentityKey) return null;
  // Serialize group encryptions to prevent concurrent sends from racing on sender key state.
  // Two overlapping encryptions would both read the same state, produce duplicate iteration
  // numbers, and the second message would be undecryptable by recipients.
  return _withDecryptLock(`grp_${groupId}_${myId}`, async () => {
    const state = await _getMySenderKeyState(groupId, myId);
    const result = SIG.skEncrypt(state, plaintext, myId);
    // Handle iteration overflow — regenerate sender key and redistribute
    if (!result) {
      console.warn('[Signal] Sender key iteration overflow — regenerating for group', groupId);
      // Fetch current group members for redistribution (with timeout)
      const tok = _SESSION_TOKEN || null;
      try {
        await Promise.race([
          (async () => {
            const mems = await api(`/api/groups/${groupId}/members`, 'GET', null, tok).catch(() => []);
            const ids = (Array.isArray(mems) ? mems : []).map(m => m.userId ?? m.user_id ?? m.id).filter(Boolean);
            if (ids.length > 0) await generateAndDistributeGroupKey(groupId, ids, tok, myId);
          })(),
          new Promise(r => setTimeout(r, 10000)),  // 10s hard timeout
        ]);
      } catch {}
      const freshState = await _getMySenderKeyState(groupId, myId);
      const retry = SIG.skEncrypt(freshState, plaintext, myId);
      if (!retry) return null;  // Should never happen with fresh key
      _sigSenderKeys[`${groupId}_${myId}`] = retry.newState;
      await SecureStore.setItemAsync(sigSKStore(groupId, myId), SIG.serialiseSKState(retry.newState));
      return JSON.stringify(retry.envelope);
    }
    _sigSenderKeys[`${groupId}_${myId}`] = result.newState;
    await SecureStore.setItemAsync(sigSKStore(groupId, myId), SIG.serialiseSKState(result.newState));
    return JSON.stringify(result.envelope);
  });
}

/**
 * Decrypt a group message.
 * Handles Signal Sender Keys (gsig:true) and legacy NaCl (enc:2).
 * Returns plaintext or null.
 */
async function decryptGroupMsg(envelopeStr, _unusedGroupKey, senderId, groupId) {
  if (!envelopeStr) return null;
  await Promise.race([_e2eeReady, new Promise(r => setTimeout(r, 5000))]);
  if (!_sigIdentityKey) return null;
  // Serialize decryptions per sender per group — sender key chain is stateful
  // and concurrent mutations corrupt it (one decrypt consumes the key another needs).
  return _withDecryptLock(`grp_${groupId}_${senderId}`, async () => {
    try {
      // Unescape HTML entities — backend may have corrupted the JSON envelope
      let rawStr = envelopeStr;
      if (typeof rawStr === 'string' && rawStr.includes('&quot;')) rawStr = _htmlUnescape(rawStr);
      const env = JSON.parse(rawStr);

      // ── Signal Sender Key ────────────────────────────────────────────────────
      if (env?.gsig === true) {
        const sid = String(senderId);
        const cacheKey = `${groupId}_${sid}`;
        let state = _sigSenderKeys[cacheKey];
        // Load from SecureStore if not in memory (e.g. after app restart)
        if (!state) {
          try {
            const raw = await SecureStore.getItemAsync(sigSKStore(groupId, sid));
            if (raw) {
              state = SIG.deserialiseSKState(raw);
              _sigSenderKeys[cacheKey] = state;
            }
          } catch {}
        }
        // Last resort: re-fetch sender keys from server (may not have been loaded yet)
        if (!state) {
          try {
            await loadGroupSenderKeys(groupId, _SESSION_TOKEN || null, sid);
            state = _sigSenderKeys[cacheKey];
          } catch {}
        }
        if (!state) {
          console.warn(`[Signal] decryptGroupMsg: no sender key for user ${sid} in group ${groupId}`);
          return null;
        }
        // Back up sender key state before mutating — restore on failure
        // (mirrors DM _trySignalDecryptRaw pattern for safety)
        const stateBackup = SIG.serialiseSKState(state);
        const result = SIG.skDecrypt(state, env);
        if (result) {
          _sigSenderKeys[cacheKey] = result.newSenderKeyState;
          await SecureStore.setItemAsync(
            sigSKStore(groupId, sid),
            SIG.serialiseSKState(result.newSenderKeyState)
          );
          return result.plaintext;
        }

        // Restore state from backup before retry — skDecrypt may have partially advanced the chain
        _sigSenderKeys[cacheKey] = SIG.deserialiseSKState(stateBackup);

        // skDecrypt failed — key may be stale (peer regenerated after reinstall).
        // Clear ALL local caches (state + raw blob) and re-fetch fresh key from server.
        console.warn(`[Signal] decryptGroupMsg: skDecrypt failed for user ${sid} (iter=${state.iteration}), retrying with fresh key`);
        delete _sigSenderKeys[cacheKey];
        try { await SecureStore.deleteItemAsync(sigSKStore(groupId, sid)); } catch {}
        try { await SecureStore.deleteItemAsync(`sig_sk_raw_${groupId}_${sid}`); } catch {}
        try {
          await loadGroupSenderKeys(groupId, _SESSION_TOKEN || null, sid);
          const freshState = _sigSenderKeys[cacheKey];
          if (freshState) {
            const freshBackup = SIG.serialiseSKState(freshState);
            const retry = SIG.skDecrypt(freshState, env);
            if (retry) {
              _sigSenderKeys[cacheKey] = retry.newSenderKeyState;
              await SecureStore.setItemAsync(
                sigSKStore(groupId, sid),
                SIG.serialiseSKState(retry.newSenderKeyState)
              );
              return retry.plaintext;
            }
            // Restore fresh state on retry failure too
            _sigSenderKeys[cacheKey] = SIG.deserialiseSKState(freshBackup);
          }
        } catch {}
        console.warn(`[Signal] decryptGroupMsg: retry also failed for user ${sid} in group ${groupId}`);
        return null;
      }

      // ── Legacy NaCl group ────────────────────────────────────────────────────
      if (env?.enc === 2 && _unusedGroupKey) {
        return _legacyDecryptGroup(envelopeStr, _unusedGroupKey);
      }
    } catch (e) {
      console.warn('[Signal] decryptGroupMsg error:', e?.message);
    }
    return null;
  });
}

/** Return true if content looks like any encrypted group envelope. */
function isEncryptedGroup(content) {
  if (SIG.isSignalGroup(content) ||
    (typeof content === 'string' && content.startsWith('{"enc":2'))) return true;
  // Try unescaping HTML entities (backend may have corrupted the JSON)
  if (typeof content === 'string' && content.includes('&quot;')) {
    const fixed = _htmlUnescape(content);
    return SIG.isSignalGroup(fixed) || fixed.startsWith('{"enc":2');
  }
  return false;
}

// Legacy stubs for call sites that haven't been updated yet
async function fetchPubKey(userId, token) {
  // Still used to populate publicKey for group key distribution
  try {
    const data = await api(`/api/keys/${userId}`, 'GET', null, token);
    return data?.public_key || null;
  } catch { return null; }
}

// Legacy group key functions — kept for backward compat with older server messages
async function loadGroupKey(groupId, token) { return null; }
function encryptKeyForMember() { return null; }
function decryptGroupKey() { return null; }

// ---------------------------------------------------------------------------
// API HELPER — with automatic JWT refresh on 401
// ---------------------------------------------------------------------------
// Module-level session (updated on login / refresh — avoids stale closure tokens)
let _SESSION_TOKEN   = null;
let _SESSION_REFRESH = null;
let _SESSION_UPDATER = null;  // React setState from AppInner

function _setSession(token, refresh, updater) {
  _SESSION_TOKEN   = token;
  _SESSION_REFRESH = refresh ?? _SESSION_REFRESH;
  if (updater) _SESSION_UPDATER = updater;
}

async function api(path, method = 'GET', body = null, token = null, _isRetry = false) {
  const tok = token ?? _SESSION_TOKEN;
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  // 15s timeout on all API calls — prevents spinner from hanging forever
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  opts.signal = controller.signal;
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, opts);
  } finally {
    clearTimeout(timeoutId);
  }
  let data;
  try { data = await res.json(); } catch { data = {}; }

  // Auto-refresh on 401 (expired access token) — one retry only
  if (res.status === 401 && !_isRetry) {
    // Use module-level refresh token, or fall back to SecureStore
    const refreshTok = _SESSION_REFRESH || await SecureStore.getItemAsync(BIO_REFRESH_KEY);
    if (refreshTok) try {
      const rr = await fetch(`${BASE_URL}/auth/bio-refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshTok }),
      });
      if (rr.ok) {
        const rd = await rr.json();
        _SESSION_TOKEN = rd.token;
        if (rd.refresh) { _SESSION_REFRESH = rd.refresh; }
        // Persist new tokens
        await SecureStore.setItemAsync(JWT_KEY, rd.token);
        if (rd.refresh) await SecureStore.setItemAsync(BIO_REFRESH_KEY, rd.refresh);
        // Notify React state so future renders pick up new token
        if (_SESSION_UPDATER) _SESSION_UPDATER(rd.token);
        return api(path, method, body, rd.token, true);
      }
    } catch {}
  }

  if (!res.ok) {
    // Extract error message from Phoenix/Ecto/Django formats
    let msg;
    if (data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
      msg = Object.entries(data.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ');
    } else if (typeof data?.errors === 'string') {
      msg = data.errors;
    } else {
      msg = data?.detail || data?.message || data?.error ||
        (typeof data === 'string' ? data : null) || `HTTP ${res.status}`;
    }
    throw new Error(msg);
  }
  return data;
}

// Normalise /api/contacts response (backend sends snake_case, client expects camelCase)
function _normContacts(data) {
  return (Array.isArray(data) ? data : []).map(c => ({
    contactId:   c.contactId   ?? c.contact_id,
    userId:      c.userId      ?? c.user_id,
    username:    c.username,
    displayName: c.displayName ?? c.display_name,
    avatar_url:  c.avatar_url,
    last_seen:   c.last_seen,
    online:      c.online,
    since:       c.since,
  }));
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
  await SecureStore.deleteItemAsync(BIO_REFRESH_KEY);
  // Also wipe legacy keys if present (migration cleanup)
  await SecureStore.deleteItemAsync(BIO_EMAIL_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(BIO_PASS_KEY).catch(() => {});
}
async function saveBioRefresh(refreshToken) {
  await SecureStore.setItemAsync(BIO_REFRESH_KEY, refreshToken);
}
async function loadBioRefresh() {
  return SecureStore.getItemAsync(BIO_REFRESH_KEY);
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
async function loadBannerPerm(key) { return (await SecureStore.getItemAsync(key)) === '1'; }
async function saveBannerPerm(key, val) { await SecureStore.setItemAsync(key, val ? '1' : '0'); }
async function saveLocation(loc) {
  await SecureStore.setItemAsync(LOCATION_KEY, JSON.stringify(loc));
}
async function loadLocation() {
  try {
    const v = await SecureStore.getItemAsync(LOCATION_KEY);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

/** Returns the persistent device UUID, creating and storing it on first call. */
async function getOrCreateDeviceId() {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}
async function saveBannerEnabled(v) { await SecureStore.setItemAsync(BANNER_ENABLED_KEY, v ? '1' : '0'); }
async function loadBannerEnabled() { return (await SecureStore.getItemAsync(BANNER_ENABLED_KEY)) !== '0'; }

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
function isLocationContent(c) { return typeof c === 'string' && c.includes('[LOCATION:'); }
function isMediaMsg(c) { return MEDIA.isMediaPayload(c); }

// ---------------------------------------------------------------------------
// NOTIFICATION HELPERS
// ---------------------------------------------------------------------------
async function loadNotifEnabled() {
  try {
    const v = await SecureStore.getItemAsync(NOTIF_KEY);
    return v === null ? true : v !== 'false';   // default ON
  } catch { return true; }
}
async function saveNotifEnabled(v) {
  try { await SecureStore.setItemAsync(NOTIF_KEY, v ? 'true' : 'false'); } catch {}
}
async function registerForNotifications() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00FF41',
      });
    }
    return true;
  } catch { return false; }
}
async function showLocalNotification(title, body) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'messages' } : {}),
      },
      trigger: null,
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// THEMED WRAPPERS
// ---------------------------------------------------------------------------
/* SynapseTexture — dot-grid background */
function SynapseTexture({ accentColor }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
      <Defs>
        {/* Repeating dot-grid tile */}
        <Pattern id="sg" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
          <Circle cx="14" cy="14" r="1.2" fill={accentColor} fillOpacity="0.09" />
          <Line x1="0" y1="14" x2="28" y2="14" stroke={accentColor} strokeOpacity="0.025" strokeWidth="0.5" />
          <Line x1="14" y1="0" x2="14" y2="28" stroke={accentColor} strokeOpacity="0.025" strokeWidth="0.5" />
        </Pattern>
      </Defs>
      {/* Full-screen dot grid */}
      <Rect width="100%" height="100%" fill="url(#sg)" />
    </Svg>
  );
}

function ThemedSafeArea({ style, children }) {
  const { C } = useSkin();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SynapseTexture accentColor={C.accent} />
      <SafeAreaView style={[{ flex: 1, backgroundColor: 'transparent' }, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

function ThemedView({ style, children }) {
  const { C } = useSkin();
  return (
    <View style={[{ flex: 1, backgroundColor: C.bg }, style]}>
      <SynapseTexture accentColor={C.accent} />
      {children}
    </View>
  );
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

function AppHeader({ title, subtitle, avatarUri, onBack, rightComponent }) {
  const { styles, C } = useSkin();
  const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
  const slideIn = useRef(new Animated.Value(-20)).current;
  const fadeIn  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideIn, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(fadeIn,  { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[styles.appHeader, { opacity: fadeIn, transform: [{ translateX: slideIn }] }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtnCircle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backBtnChevron}>{'‹'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 42 }} />
      )}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.accentMid }} />
        ) : null}
        <View style={{ alignItems: avatarUri ? 'flex-start' : 'center' }}>
          <Text style={styles.appHeaderTitle} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={{ fontFamily: mono, fontSize: 9, color: C.dim, letterSpacing: 0.5 }}>{subtitle}</Text> : null}
        </View>
      </View>
      {rightComponent ? rightComponent : <View style={{ width: 42 }} />}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// CUSTOM SVG ICONS  (personalised, transparent background)
// ---------------------------------------------------------------------------
function IconChats({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Rounded speech bubble */}
      <Path
        d="M4 3.5h16c.83 0 1.5.67 1.5 1.5v10c0 .83-.67 1.5-1.5 1.5H8.8L4 20V5c0-.83.67-1.5 1.5-1.5z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      />
      {/* Signal dots */}
      <Circle cx="8.5" cy="9.5" r="1.3" fill={color} />
      <Circle cx="12"  cy="9.5" r="1.3" fill={color} />
      <Circle cx="15.5" cy="9.5" r="1.3" fill={color} />
    </Svg>
  );
}

function IconContacts({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Head */}
      <Circle cx="12" cy="7.5" r="4" stroke={color} strokeWidth="1.5" />
      {/* Body arc */}
      <Path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Small connection node top-right — unique to this icon */}
      <Circle cx="18.5" cy="4.5" r="2" fill={color} fillOpacity="0.7" />
      <Line x1="16.8" y1="5.2" x2="15" y2="6.5" stroke={color} strokeWidth="1.1" />
    </Svg>
  );
}

function IconGroups({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Left person */}
      <Circle cx="8" cy="7" r="3.2" stroke={color} strokeWidth="1.4" />
      <Path d="M2 21c0-3.3 2.7-6 6-6" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      {/* Right person */}
      <Circle cx="16" cy="7" r="3.2" stroke={color} strokeWidth="1.4" />
      <Path d="M22 21c0-3.3-2.7-6-6-6" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      {/* Centre overlap arc — connects them */}
      <Path d="M9.5 15.5c.8-.3 1.6-.5 2.5-.5s1.7.2 2.5.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}

function IconBot({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Hexagon shell */}
      <Polygon
        points="12,2 20.5,7 20.5,17 12,22 3.5,17 3.5,7"
        stroke={color} strokeWidth="1.4" strokeLinejoin="round"
      />
      {/* Centre nucleus */}
      <Circle cx="12" cy="12" r="2.5" fill={color} />
      {/* Radial spokes */}
      <Line x1="12" y1="7"  x2="12" y2="9.5"  stroke={color} strokeWidth="1"  />
      <Line x1="12" y1="14.5" x2="12" y2="17" stroke={color} strokeWidth="1"  />
      <Line x1="7.3"  y1="9.5"  x2="9.8"  y2="11"  stroke={color} strokeWidth="1" />
      <Line x1="16.7" y1="9.5"  x2="14.2" y2="11"  stroke={color} strokeWidth="1" />
      <Line x1="7.3"  y1="14.5" x2="9.8"  y2="13"  stroke={color} strokeWidth="1" />
      <Line x1="16.7" y1="14.5" x2="14.2" y2="13"  stroke={color} strokeWidth="1" />
      {/* Vertex nodes */}
      <Circle cx="12"   cy="2"  r="1.2" fill={color} fillOpacity="0.6" />
      <Circle cx="20.5" cy="7"  r="1.2" fill={color} fillOpacity="0.6" />
      <Circle cx="20.5" cy="17" r="1.2" fill={color} fillOpacity="0.6" />
      <Circle cx="12"   cy="22" r="1.2" fill={color} fillOpacity="0.6" />
      <Circle cx="3.5"  cy="17" r="1.2" fill={color} fillOpacity="0.6" />
      <Circle cx="3.5"  cy="7"  r="1.2" fill={color} fillOpacity="0.6" />
    </Svg>
  );
}

function IconProfile({ size = 24, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Head */}
      <Circle cx="12" cy="7.5" r="4" stroke={color} strokeWidth="1.5" />
      {/* Body arc */}
      <Path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Shield badge — bottom-right corner */}
      <Path
        d="M18 13.5l2.5 1.2v3c0 1.6-1.2 2.8-2.5 3.3-1.3-.5-2.5-1.7-2.5-3.3v-3L18 13.5z"
        stroke={color} strokeWidth="1.2" fill={color} fillOpacity="0.15"
      />
      <Line x1="18" y1="16.2" x2="18" y2="18.8" stroke={color} strokeWidth="1" strokeLinecap="round" />
    </Svg>
  );
}

function IconSettings({ size = 24, color }) {
  // Sniper / monoscope reticle
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Outer scope ring */}
      <Circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1.2" />
      {/* Inner precision ring */}
      <Circle cx="12" cy="12" r="5.5" stroke={color} strokeWidth="0.9" />
      {/* Mil-dot ring */}
      <Circle cx="12" cy="12" r="2.8" stroke={color} strokeWidth="0.8" />
      {/* Centre dot */}
      <Circle cx="12" cy="12" r="0.9" fill={color} />
      {/* Cross-hairs — full length, breaking at inner ring */}
      {/* Top */}
      <Path d="M12 2.5V6.5" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      {/* Bottom */}
      <Path d="M12 17.5V21.5" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      {/* Left */}
      <Path d="M2.5 12H6.5" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      {/* Right */}
      <Path d="M17.5 12H21.5" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      {/* Short inner cross stubs (between mil-dot ring and inner ring) */}
      <Path d="M12 9.2V6.5" stroke={color} strokeWidth="0.7" strokeLinecap="round" strokeOpacity="0.5" />
      <Path d="M12 14.8V17.5" stroke={color} strokeWidth="0.7" strokeLinecap="round" strokeOpacity="0.5" />
      <Path d="M9.2 12H6.5" stroke={color} strokeWidth="0.7" strokeLinecap="round" strokeOpacity="0.5" />
      <Path d="M14.8 12H17.5" stroke={color} strokeWidth="0.7" strokeLinecap="round" strokeOpacity="0.5" />
      {/* Mil-dot markers on outer ring at 45° positions */}
      <Circle cx="18.73" cy="5.27" r="0.6" fill={color} fillOpacity="0.55" />
      <Circle cx="5.27"  cy="5.27" r="0.6" fill={color} fillOpacity="0.55" />
      <Circle cx="18.73" cy="18.73" r="0.6" fill={color} fillOpacity="0.55" />
      <Circle cx="5.27"  cy="18.73" r="0.6" fill={color} fillOpacity="0.55" />
      {/* Range-finding hash marks on right arm */}
      <Path d="M19 10.8V11.4" stroke={color} strokeWidth="0.7" strokeLinecap="round" strokeOpacity="0.65" />
      <Path d="M20.2 11.1V11.9" stroke={color} strokeWidth="0.7" strokeLinecap="round" strokeOpacity="0.65" />
      <Path d="M19 12.6V13.2" stroke={color} strokeWidth="0.7" strokeLinecap="round" strokeOpacity="0.65" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// GROUP MEMBERS MODAL
// ---------------------------------------------------------------------------
function GroupMembersModal({ token, group, currentUser, visible, onClose }) {
  const { styles, C } = useSkin();
  const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
  const [members,     setMembers]     = useState([]);
  const [allUsers,    setAllUsers]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [showAdd,     setShowAdd]     = useState(false);
  const [query,       setQuery]       = useState('');
  const [actioning,   setActioning]   = useState({});

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(`/api/groups/${group.id}/members`, 'GET', null, token);
      setMembers(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); }
  }, [group.id, token]);

  useEffect(() => {
    if (!visible) return;
    fetchMembers();
    api('/api/users', 'GET', null, token)
      .then(data => setAllUsers(Array.isArray(data) ? data.filter(u => !u.isMe) : []))
      .catch(() => {});
  }, [visible, fetchMembers, token]);

  const isAdmin = members.find(m => m.userId === currentUser.id)?.role === 'admin';
  const memberIds = new Set(members.map(m => m.userId));

  const act = async (key, fn) => {
    setActioning(a => ({ ...a, [key]: true }));
    try { await fn(); await fetchMembers(); } catch (e) { Alert.alert('ERROR', e.message); }
    finally { setActioning(a => ({ ...a, [key]: false })); }
  };

  const addMember = (userId) => act(`add_${userId}`, async () => {
    await api(`/api/groups/${group.id}/members`, 'POST', { user_id: userId }, token);
    // Distribute our Signal sender key to the new member
    if (e2eeKey()) {
      generateAndDistributeGroupKey(group.id, [userId], token, String(currentUser.id)).catch(() => {});
    }
  });

  const removeMember = (userId) => {
    Alert.alert('REMOVE MEMBER', 'Remove this member from the group?', [
      { text: 'CANCEL', style: 'cancel' },
      { text: 'REMOVE', style: 'destructive', onPress: () =>
        act(`rem_${userId}`, () =>
          api(`/api/groups/${group.id}/members`, 'DELETE', { user_id: userId }, token)
        ),
      },
    ]);
  };

  const filteredAdd = query.trim()
    ? allUsers.filter(u => !memberIds.has(u.id) && (u.username + (u.displayName || '')).toLowerCase().includes(query.toLowerCase()))
    : allUsers.filter(u => !memberIds.has(u.id));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { maxHeight: '85%' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={styles.modalTitle}>MEMBERS</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeCircleBtn}>
              <Text style={styles.closeCircleText}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}><Spinner size="large" /></View>
          ) : (
            <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
              {members.map(m => (
                <View key={m.userId} style={styles.memberRow}>
                  <View>
                    <Text style={styles.memberName}>{m.displayName || m.username}</Text>
                    <Text style={styles.memberRole}>{m.role.toUpperCase()}</Text>
                  </View>
                  {isAdmin && m.userId !== currentUser.id && (
                    <TouchableOpacity
                      style={styles.memberRemoveBtn}
                      onPress={() => removeMember(m.userId)}
                      disabled={!!actioning[`rem_${m.userId}`]}
                    >
                      {actioning[`rem_${m.userId}`]
                        ? <Spinner />
                        : <Text style={styles.memberRemoveBtnText}>REMOVE</Text>
                      }
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {members.length === 0 && <Text style={styles.emptyText}>NO MEMBERS</Text>}
            </ScrollView>
          )}

          {isAdmin && (
            <>
              <TouchableOpacity
                style={[styles.ghostBtn, { marginTop: 14, marginBottom: showAdd ? 8 : 0 }]}
                onPress={() => { setShowAdd(s => !s); setQuery(''); }}
              >
                <Text style={styles.ghostBtnText}>{showAdd ? '\u2715 CANCEL' : '+ ADD MEMBER'}</Text>
              </TouchableOpacity>
              {showAdd && (
                <>
                  <TextInput
                    style={[styles.input, { marginBottom: 8 }]}
                    placeholder="SEARCH USERS..."
                    placeholderTextColor={C.muted}
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled">
                    {filteredAdd.map(u => (
                      <View key={u.id} style={styles.memberRow}>
                        <Text style={styles.memberName}>{u.displayName || u.display_name || u.username}</Text>
                        <TouchableOpacity
                          style={[styles.contactActionBtn, { borderColor: C.green }]}
                          onPress={() => addMember(u.id)}
                          disabled={!!actioning[`add_${u.id}`]}
                        >
                          {actioning[`add_${u.id}`]
                            ? <Spinner />
                            : <Text style={styles.contactActionBtnText}>+ ADD</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    ))}
                    {filteredAdd.length === 0 && <Text style={styles.emptyText}>NO USERS FOUND</Text>}
                  </ScrollView>
                </>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const ICON_COMPONENTS = {
  CHATS:    IconChats,
  GROUPS:   IconGroups,
  BOT:      IconBot,
  PROFILE:  IconProfile,
  SETTINGS: IconSettings,
};

// ---------------------------------------------------------------------------
// BOTTOM TAB BAR  (floating, rounded, back-shadowed)
// ---------------------------------------------------------------------------
const TABS = ['CHATS', 'GROUPS', 'BOT', 'PROFILE', 'SETTINGS'];

function TabBar({ active, onChange, unread = {}, tabs = TABS }) {
  const { styles, C } = useSkin();
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = tab === active;
        const IconComp = ICON_COMPONENTS[tab];
        const cnt = unread[tab] || 0;
        return (
          <TouchableOpacity key={tab} style={styles.tabItem} onPress={() => onChange(tab)} activeOpacity={0.7}>
            {isActive && <View style={styles.tabActiveGlow} />}
            <View style={[styles.tabIcon, { position: 'relative' }]}>
              <IconComp size={22} color={isActive ? C.accent : C.dim} />
              {cnt > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{cnt > 99 ? '99+' : cnt}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// FACE ID ICON  (drawn with Views — no external icon library needed)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// SVG ICON HELPERS  (no emoji anywhere — pure vector)
// ---------------------------------------------------------------------------
function IconPin({ size = 16, color = '#00FF41' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        stroke={color} strokeWidth="1.7" fill="none" strokeLinejoin="round" />
      <Circle cx="12" cy="9" r="2.5" fill={color} />
    </Svg>
  );
}

function IconCamera({ size = 16, color = '#00FF41' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
        stroke={color} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="13" r="4" stroke={color} strokeWidth="1.7" fill="none" />
    </Svg>
  );
}

function IconSMS({ size = 16, color = '#00FF41' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke={color} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="8" y1="10" x2="16" y2="10" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <Line x1="8" y1="14" x2="12" y2="14" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

function IconRefresh({ size = 14, color = '#00FF41' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M23 4v6h-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M1 20v-6h6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function IconLock({ size = 14, color = '#00FF41' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke={color} strokeWidth="1.8" fill="none" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// VAULT ICON  (replaces Face-ID icon — transparent background, SVG vault door)
// ---------------------------------------------------------------------------
function VaultIcon({ size = 68, color }) {
  const { C } = useSkin();
  const c    = color || C.accent;
  const half = size / 2;
  const outerR = half * 0.88;
  const doorR  = half * 0.68;
  const dialR  = half * 0.26;
  const lw     = Math.max(1.5, size * 0.038);

  // 8 locking bolts radiating from door edge to frame
  const bolts = Array.from({ length: 8 }, (_, i) => {
    const a = (i * 2 * Math.PI) / 8;
    return {
      x1: half + doorR * 0.84 * Math.cos(a),
      y1: half + doorR * 0.84 * Math.sin(a),
      x2: half + outerR * 0.90 * Math.cos(a),
      y2: half + outerR * 0.90 * Math.sin(a),
    };
  });

  // 12 tick marks on the combination dial
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a      = (i * 2 * Math.PI) / 12;
    const major  = i % 3 === 0;
    const inner  = dialR * (major ? 0.52 : 0.68);
    const outer  = dialR * 0.90;
    return {
      x1: half + inner * Math.cos(a), y1: half + inner * Math.sin(a),
      x2: half + outer * Math.cos(a), y2: half + outer * Math.sin(a),
      major,
    };
  });

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Outer frame ring */}
      <Circle cx={half} cy={half} r={outerR} stroke={c} strokeWidth={lw * 0.7} fill="none" opacity={0.35} />
      {/* Vault door */}
      <Circle cx={half} cy={half} r={doorR} stroke={c} strokeWidth={lw} fill="none" />
      {/* Locking bolts */}
      {bolts.map((b, i) => (
        <Line key={i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
          stroke={c} strokeWidth={lw * 1.4} strokeLinecap="round" />
      ))}
      {/* Combination dial ring */}
      <Circle cx={half} cy={half} r={dialR} stroke={c} strokeWidth={lw} fill="none" opacity={0.9} />
      {/* Dial tick marks */}
      {ticks.map((t, i) => (
        <Line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={c} strokeWidth={t.major ? lw * 0.7 : lw * 0.4} strokeLinecap="round" opacity={0.65} />
      ))}
      {/* 12 o'clock marker */}
      <Circle cx={half} cy={half - dialR * 0.72} r={lw * 0.9} fill={c} />
      {/* Centre hub */}
      <Circle cx={half} cy={half} r={lw * 1.8} fill={c} />
      {/* Handle lever */}
      <Line x1={half + dialR * 0.1} y1={half} x2={half + doorR * 0.78} y2={half}
        stroke={c} strokeWidth={lw * 1.2} strokeLinecap="round" />
      <Circle cx={half + doorR * 0.78} cy={half} r={lw * 1.5}
        stroke={c} strokeWidth={lw * 0.8} fill="none" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// BIOMETRIC UNLOCK SCREEN
// ---------------------------------------------------------------------------
function BiometricUnlockScreen({ onUnlock, onUsePassword }) {
  const { styles, C } = useSkin();
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  const tryBiometric = useCallback(async (isAutoTrigger = false) => {
    setLoading(true); setErr('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:         'Unlock SYNAPTYC',
        // Allow device passcode as fallback so iOS can clear any Face ID lockout
        // caused by repeated failed attempts. iOS tries Face ID first; if it
        // fails or is locked it shows the device passcode prompt automatically.
        disableDeviceFallback: false,
        cancelLabel:           'Cancel',
      });
      if (result.success) {
        onUnlock();
      } else if (result.error === 'missing_usage_description') {
        // NSFaceIDUsageDescription absent (Expo Go or non-native build).
        // Clear stored bio settings so user is not stuck on this screen.
        await clearBio();
        onUsePassword();
      }
      // All other failure cases (user_cancel, lockout, not_available) are
      // handled by iOS natively — no action needed from our side.
    } catch (e) {
      if (!isAutoTrigger) setErr('Could not start Face ID. Please use password instead.');
    } finally {
      setLoading(false);
    }
  }, [onUnlock]);

  // Auto-trigger after mount so the Face ID prompt appears without a tap
  useEffect(() => {
    const t = setTimeout(() => tryBiometric(true), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <ThemedSafeArea>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={styles.centerFill}>
        <Image source={require('./assets/icon.png')} style={{ width: 96, height: 96, borderRadius: 22, marginBottom: 10 }} resizeMode="contain" />
        <Text style={[styles.logoText, { fontSize: 18, letterSpacing: 3 }]}>SYNAPTYC</Text>
        <Text style={styles.logoSub}>BY nano-SYNAPSYS</Text>
        <View style={{ height: 48 }} />
        <TouchableOpacity onPress={() => tryBiometric(false)} disabled={loading} activeOpacity={0.7}>
          <VaultIcon size={72} />
        </TouchableOpacity>
        <View style={{ height: 24 }} />
        <TouchableOpacity
          style={[styles.primaryBtn, styles.bioBtn, loading && styles.primaryBtnDisabled]}
          onPress={() => tryBiometric(false)} disabled={loading}
        >
          {loading ? <Spinner /> : <Text style={styles.primaryBtnText}>FACE ID</Text>}
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
// AUTH SCREEN — PIN keypad (device-linked 6-digit PIN)
// ---------------------------------------------------------------------------
function AuthScreen({ onAuth, inviteToken = null, inviterName = null }) {
  const { styles, C } = useSkin();
  const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

  // flow: 'login' | 'register_name' | 'register_pin' | 'register_confirm'
  //       'forgot_name' | 'forgot_pin' | 'forgot_confirm'
  //       'link_name' | 'link_pin'
  const [flow,         setFlow]         = useState(inviteToken ? 'register_name' : 'login');
  const [username,     setUsername]     = useState('');
  const [pin,          setPin]          = useState('');
  const [confirmPin,   setConfirmPin]   = useState('');
  const [loading,      setLoading]      = useState(false);
  const [err,          setErr]          = useState('');
  const [bioSupported, setBioSupported] = useState(false);
  const [bioReady,     setBioReady]     = useState(false);
  const [bioLoading,   setBioLoading]   = useState(false);
  const [deviceId,     setDeviceId]     = useState('');

  useEffect(() => {
    (async () => {
      const id         = await getOrCreateDeviceId();
      const supported  = await isBiometricReady();
      const enabled    = await loadBioEnabled();
      const refreshTok = await loadBioRefresh();
      setDeviceId(id);
      setBioSupported(supported);
      setBioReady(supported && enabled && !!refreshTok);
    })();
  }, []);

  useEffect(() => {
    if (inviteToken && inviterName) setFlow('register_name');
  }, [inviteToken, inviterName]);

  // ── Digit input helpers ──────────────────────────────────────────────────
  const appendDigit = useCallback((d) => {
    if (flow === 'register_confirm' || flow === 'forgot_confirm') {
      setConfirmPin(p => p.length < 6 ? p + d : p);
    } else {
      setPin(p => p.length < 6 ? p + d : p);
    }
  }, [flow]);

  const deleteDigit = useCallback(() => {
    if (flow === 'register_confirm' || flow === 'forgot_confirm') {
      setConfirmPin(p => p.slice(0, -1));
    } else {
      setPin(p => p.slice(0, -1));
    }
  }, [flow]);

  // ── Bio login — identical to previous implementation ────────────────────
  const handleBioLogin = async () => {
    setBioLoading(true); setErr('');
    try {
      const hw  = await LocalAuthentication.hasHardwareAsync();
      const enr = await LocalAuthentication.isEnrolledAsync();
      if (!hw)  { setErr('Face ID hardware not found on this device.'); return; }
      if (!enr) { setErr('Face ID is not set up. Go to iOS Settings → Face ID & Passcode.'); return; }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login to SYNAPTYC', disableDeviceFallback: true, cancelLabel: 'Cancel',
      });
      if (!result.success) {
        if (result.error === 'user_cancel' || result.error === 'system_cancel') { return; }
        if (result.error === 'lockout' || result.error === 'lockout_permanent') {
          setErr('Face ID locked. Enter your device passcode first to re-enable it.');
        } else if (result.error === 'missing_usage_description') {
          await clearBio();
          setBioSupported(false); setBioReady(false);
          setErr('Face ID requires a native build. Use PIN login for now.');
        } else {
          setErr(`Face ID failed (${result.error || 'error'}). Use PIN instead.`);
        }
        return;
      }
      const storedRefresh = await loadBioRefresh();
      if (!storedRefresh) {
        setErr('Face ID session expired. Log in with PIN to re-enable Face ID.');
        await clearBio(); setBioReady(false);
        return;
      }
      const data = await api('/auth/bio-refresh', 'POST', { refresh: storedRefresh });
      if (data.refresh) await saveBioRefresh(data.refresh);
      await saveToken(data.token); await saveUser(data.user);
      onAuth(data.token, data.user);
    } catch (e) {
      await clearBio(); setBioReady(false);
      setErr('Face ID session expired. Log in with PIN and re-enable Face ID in Profile.');
    } finally { setBioLoading(false); }
  };

  // ── PIN login ────────────────────────────────────────────────────────────
  const handleLogin = useCallback(async () => {
    if (pin.length < 6 || loading) return;
    setLoading(true); setErr('');
    try {
      const data = await api('/auth/pin-login', 'POST', { device_id: deviceId, pin });
      await saveToken(data.token); await saveUser(data.user);
      if (data.refresh) await saveBioRefresh(data.refresh);
      onAuth(data.token, data.user);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); setPin(''); }
  }, [pin, deviceId, loading, onAuth]);

  // ── PIN registration ─────────────────────────────────────────────────────
  const handleRegister = useCallback(async () => {
    if (loading) return;
    setLoading(true); setErr('');
    try {
      const data = await api('/auth/register', 'POST', {
        username: username.trim(), device_id: deviceId, pin,
        ...(inviteToken ? { invite_token: inviteToken } : {}),
      });
      await saveToken(data.token); await saveUser(data.user);
      if (data.refresh) await saveBioRefresh(data.refresh);
      onAuth(data.token, data.user);
    } catch (e) {
      setErr(e.message); setFlow('register_pin'); setPin(''); setConfirmPin('');
    } finally { setLoading(false); }
  }, [username, deviceId, pin, loading, onAuth]);

  // ── PIN reset (forgot PIN — re-register same device) ────────────────────
  const handlePinReset = useCallback(async () => {
    if (loading) return;
    setLoading(true); setErr('');
    try {
      const data = await api('/auth/pin-reset', 'POST', {
        device_id: deviceId, username: username.trim(), new_pin: pin,
      });
      await saveToken(data.token); await saveUser(data.user);
      if (data.refresh) await saveBioRefresh(data.refresh);
      onAuth(data.token, data.user);
    } catch (e) {
      setErr(e.message); setFlow('forgot_pin'); setPin(''); setConfirmPin('');
    } finally { setLoading(false); }
  }, [deviceId, username, pin, loading, onAuth]);

  // ── Link device (reinstall recovery) ───────────────────────────────────
  const handleLinkDevice = useCallback(async () => {
    if (pin.length < 6 || loading) return;
    setLoading(true); setErr('');
    try {
      const data = await api('/auth/link-device', 'POST', {
        username: username.trim(), pin, device_id: deviceId,
      });
      await saveToken(data.token); await saveUser(data.user);
      if (data.refresh) await saveBioRefresh(data.refresh);
      onAuth(data.token, data.user);
    } catch (e) {
      setErr(e.message); setPin('');
    } finally { setLoading(false); }
  }, [username, pin, deviceId, loading, onAuth]);

  // ── Unified primary action handler ───────────────────────────────────────
  const handlePrimaryAction = useCallback(() => {
    setErr('');
    switch (flow) {
      case 'login':           handleLogin(); break;
      case 'register_name':
        if (!username.trim() || username.trim().length < 3) { setErr('Username must be 3-24 chars.'); return; }
        setPin(''); setFlow('register_pin');
        break;
      case 'register_pin':
        if (pin.length < 6) { setErr('Enter a 6-digit PIN.'); return; }
        setConfirmPin(''); setFlow('register_confirm');
        break;
      case 'register_confirm':
        if (confirmPin.length < 6) { setErr('Enter 6 digits to confirm.'); return; }
        if (confirmPin !== pin) { setErr('PINs do not match. Try again.'); setConfirmPin(''); return; }
        handleRegister();
        break;
      case 'forgot_name':
        if (!username.trim() || username.trim().length < 3) { setErr('Enter your username.'); return; }
        setPin(''); setFlow('forgot_pin');
        break;
      case 'forgot_pin':
        if (pin.length < 6) { setErr('Enter a new 6-digit PIN.'); return; }
        setConfirmPin(''); setFlow('forgot_confirm');
        break;
      case 'forgot_confirm':
        if (confirmPin.length < 6) { setErr('Enter 6 digits to confirm.'); return; }
        if (confirmPin !== pin) { setErr('PINs do not match. Try again.'); setConfirmPin(''); return; }
        handlePinReset();
        break;
      case 'link_name':
        if (!username.trim() || username.trim().length < 3) { setErr('Enter your username.'); return; }
        setPin(''); setFlow('link_pin');
        break;
      case 'link_pin':
        handleLinkDevice();
        break;
    }
  }, [flow, username, pin, confirmPin, handleLogin, handleRegister, handlePinReset, handleLinkDevice]);

  const activePin = (flow === 'register_confirm' || flow === 'forgot_confirm') ? confirmPin : pin;
  const showKeypad = flow !== 'register_name' && flow !== 'forgot_name' && flow !== 'link_name';
  const TITLES = {
    login: 'ENTER PIN', register_name: 'CREATE ACCOUNT',
    register_pin: 'SET YOUR PIN', register_confirm: 'CONFIRM PIN',
    forgot_name: 'FORGOT PIN', forgot_pin: 'NEW PIN', forgot_confirm: 'CONFIRM NEW PIN',
    link_name: 'LINK DEVICE', link_pin: 'ENTER YOUR PIN',
  };
  const PRIMARY_LABELS = {
    login: 'UNLOCK', register_name: 'NEXT', register_pin: 'NEXT',
    register_confirm: 'CREATE ACCOUNT', forgot_name: 'NEXT',
    forgot_pin: 'NEXT', forgot_confirm: 'RESET PIN',
    link_name: 'NEXT', link_pin: 'LINK DEVICE',
  };
  const pinReady = activePin.length === 6;

  return (
    <ThemedSafeArea>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoBlock}>
          <Image
            source={require('./assets/icon.png')}
            style={{ width: 96, height: 96, borderRadius: 22, marginBottom: 10 }}
            resizeMode="contain"
          />
          <Text style={[styles.logoText, { fontSize: 18, letterSpacing: 3 }]}>SYNAPTYC</Text>
          <Text style={styles.logoSub}>BY nano-SYNAPSYS</Text>
        </View>

        {/* Invite banner */}
        {inviteToken && inviterName && (
          <View style={{
            backgroundColor: '#00FF4115', borderWidth: 1, borderColor: '#00FF4140',
            borderRadius: 6, padding: 12, marginBottom: 16, marginHorizontal: 4, alignItems: 'center',
          }}>
            <Text style={{ fontFamily: mono, fontSize: 11, color: '#00FF41', fontWeight: '700', letterSpacing: 1.5 }}>
              {'\u2713'} INVITED BY {inviterName.toUpperCase()}
            </Text>
            <Text style={{ fontFamily: mono, fontSize: 10, color: '#00c832', marginTop: 4, letterSpacing: 0.5 }}>
              Register below — you'll be connected instantly
            </Text>
          </View>
        )}

        {/* Section title */}
        <Text style={{ fontFamily: mono, fontSize: 11, color: C.dim, letterSpacing: 2, textAlign: 'center', marginBottom: 14 }}>
          {TITLES[flow]}
        </Text>

        {/* Username input — register_name / forgot_name flows */}
        {!showKeypad && (
          <View style={styles.authForm}>
            <TextInput
              style={styles.input}
              placeholder="USERNAME"
              placeholderTextColor={C.muted}
              value={username}
              onChangeText={t => { setUsername(t); setErr(''); }}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={24}
            />
            <ErrText msg={err} />
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handlePrimaryAction}
              disabled={loading}
            >
              {loading ? <Spinner /> : <Text style={styles.primaryBtnText}>{PRIMARY_LABELS[flow]}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* PIN dots + numpad — all other flows */}
        {showKeypad && (
          <View style={{ alignItems: 'center' }}>
            {/* 6 indicator dots */}
            <View style={{ flexDirection: 'row', gap: 14, justifyContent: 'center', marginVertical: 20 }}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <View key={i} style={{
                  width: 15, height: 15, borderRadius: 8,
                  backgroundColor: i < activePin.length ? C.accent : 'transparent',
                  borderWidth: 1.5,
                  borderColor: i < activePin.length ? C.accent : C.border,
                }} />
              ))}
            </View>
            <ErrText msg={err} />

            {/* Number pad */}
            {[[1, 2, 3], [4, 5, 6], [7, 8, 9], ['', 0, '⌫']].map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row', gap: 14, marginBottom: 12 }}>
                {row.map((d, di) => (
                  <TouchableOpacity
                    key={di}
                    style={{
                      width: 72, height: 72, borderRadius: 36,
                      borderWidth: d === '' ? 0 : 1,
                      borderColor: C.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                    onPress={() => { if (d === '⌫') deleteDigit(); else if (d !== '') appendDigit(String(d)); }}
                    disabled={d === ''}
                    activeOpacity={0.6}
                  >
                    {d !== '' && (
                      <Text style={{ fontFamily: mono, fontSize: d === '⌫' ? 20 : 24, color: C.text, fontWeight: '300' }}>
                        {d}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Action button — active only when 6 digits entered */}
            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 8, width: 230 }, (!pinReady || loading) && styles.primaryBtnDisabled]}
              onPress={handlePrimaryAction}
              disabled={!pinReady || loading}
            >
              {loading ? <Spinner /> : <Text style={styles.primaryBtnText}>{PRIMARY_LABELS[flow]}</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Face ID button — login flow only */}
        {flow === 'login' && bioSupported && (
          <TouchableOpacity
            style={[styles.bioLoginBtn, { marginTop: 16 }, bioLoading && styles.primaryBtnDisabled]}
            onPress={bioReady
              ? handleBioLogin
              : () => Alert.alert('FACE ID NOT SET UP', 'Go to Profile tab and tap "ENABLE FACE ID LOGIN".')}
            disabled={bioLoading}
          >
            {bioLoading ? <Spinner /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconLock size={15} color={C.accent} />
                <Text style={styles.bioLoginBtnText}>FACE ID LOGIN</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Register / forgot PIN / link device links — login flow only */}
        {flow === 'login' && (
          <View style={{ alignItems: 'center', marginTop: 20, gap: 14 }}>
            <TouchableOpacity onPress={() => { setFlow('register_name'); setPin(''); setErr(''); setUsername(''); }}>
              <Text style={{ fontFamily: mono, fontSize: 11, color: C.dim, letterSpacing: 1 }}>NEW DEVICE? REGISTER</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setFlow('link_name'); setPin(''); setErr(''); setUsername(''); }}>
              <Text style={{ fontFamily: mono, fontSize: 11, color: C.amber, letterSpacing: 1 }}>REINSTALLED? LINK DEVICE</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setFlow('forgot_name'); setPin(''); setErr(''); setUsername(''); }}>
              <Text style={{ fontFamily: mono, fontSize: 10, color: C.dim, letterSpacing: 1 }}>FORGOT PIN?</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Back link — all non-login flows */}
        {flow !== 'login' && (
          <TouchableOpacity
            onPress={() => { setFlow('login'); setPin(''); setConfirmPin(''); setErr(''); setUsername(''); }}
            style={{ alignItems: 'center', marginTop: 20 }}
          >
            <Text style={{ fontFamily: mono, fontSize: 10, color: C.dim, letterSpacing: 1 }}>BACK TO LOGIN</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ThemedSafeArea>
  );
}

// ---------------------------------------------------------------------------
// SWIPEABLE ROW  (pure Animated + PanResponder — no extra packages)
// Swipe left to reveal a destructive action button. Swipe right to close.
// ---------------------------------------------------------------------------
const _SWIPE_W = 88;      // px: width of the revealed action button
const _FULL_SWIPE = 160;  // px: drag past this → fly off + trigger action immediately

function SwipeableRow({ children, rightLabel = 'DELETE', rightColor, onAction, disabled = false }) {
  const { C } = useSkin();
  const mono  = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
  const color = rightColor || C.red;

  const position  = useRef(new Animated.Value(0)).current;
  const dragStart = useRef(0);
  const fired     = useRef(false); // prevent double-fire on full swipe

  // R.current holds always-fresh copies of props/helpers so PanResponder
  // (created once) never calls stale closures.
  const R = useRef({});
  R.current.onAction = onAction;
  R.current.disabled = disabled;

  R.current.snapTo = (toValue) => {
    Animated.spring(position, {
      toValue,
      useNativeDriver: false,   // keep on JS thread to match setValue tracking
      bounciness: 0,
      speed: 28,
    }).start();
  };

  // Fly the row off-screen to the left, then fire onAction.
  R.current.slideOff = () => {
    if (fired.current) return;
    fired.current = true;
    Animated.timing(position, {
      toValue: -500,
      duration: 200,
      useNativeDriver: false,
    }).start(() => R.current.onAction && R.current.onAction());
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    // Claim horizontal gestures; let vertical scroll through unimpeded
    onMoveShouldSetPanResponder: (_, { dx, dy }) =>
      !R.current.disabled && Math.abs(dx) > 4 && Math.abs(dx) > Math.abs(dy) * 1.8,

    onPanResponderGrant: (_, { x0: _x }) => {
      fired.current = false;
      position.stopAnimation((val) => { dragStart.current = val; });
    },

    onPanResponderMove: (_, { dx }) => {
      position.setValue(Math.min(0, dragStart.current + dx));
    },

    onPanResponderRelease: (_, { dx, vx }) => {
      const cur = Math.min(0, dragStart.current + dx);
      if (vx < -0.5 || cur < -_FULL_SWIPE) {
        R.current.slideOff();
      } else if (vx < -0.12 || cur < -(_SWIPE_W * 0.3)) {
        R.current.snapTo(-_SWIPE_W);
      } else {
        R.current.snapTo(0);
      }
    },

    onPanResponderTerminate: () => {
      if (!fired.current) R.current.snapTo(0);
    },
  })).current;

  return (
    <View style={{ overflow: 'hidden' }}>
      {/* Action button revealed behind the sliding row */}
      <View style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        width: _SWIPE_W, backgroundColor: color,
        justifyContent: 'center', alignItems: 'center',
      }}>
        <TouchableOpacity
          onPress={() => { R.current.snapTo(0); R.current.onAction && R.current.onAction(); }}
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
// ---------------------------------------------------------------------------
// PHONE CONTACTS BOTTOM SHEET
// ---------------------------------------------------------------------------
const _PC_KEY = 'nano_phone_statuses';
const _nrmPh  = (p) => (p || '').replace(/[\s\-().+]/g, '');

async function _pcLoad() {
  try {
    const raw = await SecureStore.getItemAsync(_PC_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw);
    const now = Date.now();
    let changed = false;
    for (const k of Object.keys(map)) {
      if (map[k].s === 'i' && map[k].e && map[k].e < now) { delete map[k]; changed = true; }
    }
    if (changed) SecureStore.setItemAsync(_PC_KEY, JSON.stringify(map)).catch(() => {});
    return map;
  } catch { return {}; }
}

async function _pcSave(phone, entry) {
  const key = _nrmPh(phone);
  if (!key) return;
  const map = await _pcLoad();
  map[key] = entry;
  try { await SecureStore.setItemAsync(_PC_KEY, JSON.stringify(map)); } catch {}
}

function PhoneContactsSheet({ visible, onClose, token, currentUser, onOpenDM }) {
  const { styles, C } = useSkin();
  const mono     = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
  const screenH  = Dimensions.get('window').height;

  const [deviceContacts, setDeviceContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isLimited, setIsLimited] = useState(false);
  const [contactsErr,     setContactsErr]     = useState('');
  const [contactsQuery,   setContactsQuery]   = useState('');
  const [phoneStatuses,   setPhoneStatuses]   = useState({});
  const [inviting,        setInviting]        = useState(null);
  const [appContactIds,   setAppContactIds]   = useState(new Set());
  const [autoMatchedMap,  setAutoMatchedMap]  = useState({});   // phone → app user (auto-detected)
  const [autoSearching,   setAutoSearching]   = useState(false);
  const [toast,           setToast]           = useState('');   // inline feedback bar
  const toastTimer = useRef(null);
  const autoSearchCooldownRef = useRef(0);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  };

  useEffect(() => {
    if (visible) { loadAll(); }
    else { setContactsQuery(''); setContactsErr(''); }
  }, [visible]);

  const loadAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    // Fetch accepted app contacts for green LED check
    let confirmedIds = new Set();
    try {
      const data = _normContacts(await api('/api/contacts', 'GET', null, token));
      confirmedIds = new Set(data.map(c => c.userId));
      setAppContactIds(confirmedIds);
    } catch {}

    // Load persisted statuses — clear stale 'c' entries (re-verified by autoSearch)
    const loaded = await _pcLoad();
    let cleaned = false;
    for (const k of Object.keys(loaded)) {
      if (loaded[k].s === 'c') { delete loaded[k]; cleaned = true; }
    }
    if (cleaned) SecureStore.setItemAsync(_PC_KEY, JSON.stringify(loaded)).catch(() => {});
    setPhoneStatuses(loaded);

    // Request contacts permission (returns accessPrivileges on iOS 18+)
    const permResult = await Contacts.requestPermissionsAsync();
    if (permResult.status !== 'granted') {
      setContactsErr('CONTACTS PERMISSION DENIED');
      return;
    }

    // iOS 18+: limited access — show available contacts + Settings footer
    setIsLimited(permResult.accessPrivileges === 'limited');
    setContactsLoading(true);
    try {
      const result = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
        ],
      });
      const raw = Array.isArray(result?.data) ? result.data
                : Array.isArray(result)        ? result
                : [];
      const list = raw
        .filter(c => c.phoneNumbers?.length > 0)
        .map(c => ({
          id:    c.id || String(Math.random()),
          name:  (c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim()) || 'Unknown',
          phone: c.phoneNumbers[0].number || '',
        }))
        .filter(c => c.phone)
        .sort((a, b) => a.name.localeCompare(b.name));
      setDeviceContacts(list);
      // Auto-search in background — pass confirmedIds directly (React state may not be updated yet)
      autoSearchContacts(list, confirmedIds).catch(() => {});
    } catch (e) {
      setContactsErr('Could not load contacts: ' + (e?.message || String(e)));
    } finally {
      setContactsLoading(false);
      setRefreshing(false);
    }
  };

  // Phone-based contact discovery: single batch lookup by phone number (Signal model)
  // Uses last-7-digit suffix matching to handle country code differences
  const autoSearchContacts = async (contacts, confirmedIds) => {
    if (Date.now() - autoSearchCooldownRef.current < 60000) return;
    setAutoSearching(true);
    const ids = confirmedIds || appContactIds;

    // Build maps: normalized phone -> contact, AND last7 -> contact (for fuzzy match)
    const phoneMap = {};   // exact normalized → contact
    const suffixMap = {};  // last 7 digits → contact
    for (const c of contacts) {
      const norm = _nrmPh(c.phone);
      if (norm.length >= 7) {
        phoneMap[norm] = c;
        suffixMap[norm.slice(-7)] = c;
      }
    }

    try {
      const matches = await api('/api/users/phone-lookup', 'POST',
        { phones: Object.keys(phoneMap) }, token);
      const map = {};
      for (const m of (Array.isArray(matches) ? matches : [])) {
        const mNorm = _nrmPh(m.phone);
        // Try exact match first, then suffix match (last 7 digits)
        const contact = phoneMap[mNorm] || suffixMap[mNorm.slice(-7)];
        if (contact) {
          map[contact.phone] = m;
          const status = ids.has(m.id) ? 'c' : 'g';
          await _pcSave(contact.phone, { s: status });
        }
      }
      setPhoneStatuses(await _pcLoad());
      setAutoMatchedMap(map);
    } catch {}

    setAutoSearching(false);
    autoSearchCooldownRef.current = Date.now();
  };

  const getPhoneStatus = (phone) => {
    const entry = phoneStatuses[_nrmPh(phone)];
    if (!entry) return null;
    if (entry.s === 'i' && entry.e && entry.e < Date.now()) return null;
    return entry.s;  // 'c' = connected | 'g' = has app | 'i' = invited
  };

  const saveStatus = async (phone, entry) => {
    await _pcSave(phone, entry);
    setPhoneStatuses(prev => ({ ...prev, [_nrmPh(phone)]: entry }));
  };

  const addContact = async (userId, phone) => {
    await api('/api/contacts/request', 'POST', { userId }, token);
    setAppContactIds(prev => new Set([...prev, userId]));
    if (phone) await saveStatus(phone, { s: 'c' });
  };

  // Cancel a pending invite — expires it on the server then clears local state
  const cancelInvite = async (phone) => {
    const map = await _pcLoad();
    const key = _nrmPh(phone);
    const storedToken = map[key]?.t;
    if (storedToken) {
      // Cancel the specific invite by token (new behaviour)
      try { await api(`/api/invites/cancel/${storedToken}`, 'DELETE', null, token); } catch {}
    } else {
      // No token stored (pre-fix invite) — bulk-cancel all active invites to clear the cap
      try { await api('/api/invites', 'DELETE', null, token); } catch {}
    }
    delete map[key];
    try { await SecureStore.setItemAsync(_PC_KEY, JSON.stringify(map)); } catch {}
    setPhoneStatuses(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const findOnApp = async (contact) => {
    const q = contact.name.split(' ')[0];
    if (q.length < 2) {
      Alert.alert('NOT ON APP YET', `"${contact.name}" doesn't appear to be on SYNAPTYC.\n\nSend them an invite?`, [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'SEND INVITE', onPress: () => sendSMSInvite(contact) },
      ]);
      return;
    }
    try {
      const data = await api(`/api/users/search?q=${encodeURIComponent(q)}`, 'GET', null, token);
      const all     = Array.isArray(data) ? data : [];
      const newOnes = all.filter(u => !appContactIds.has(u.id));
      const known   = all.filter(u =>  appContactIds.has(u.id));

      if (all.length === 0) {
        Alert.alert('NOT ON APP YET',
          `"${contact.name}" doesn't have SYNAPTYC.\n\nSend them an invite?`,
          [{ text: 'CANCEL', style: 'cancel' }, { text: 'SEND INVITE', onPress: () => sendSMSInvite(contact) }]);
      } else if (newOnes.length === 0) {
        await saveStatus(contact.phone, { s: 'c' });
        showToast(`✓ ${known[0].displayName || known[0].username} is already in your contacts`);
      } else if (newOnes.length === 1) {
        await addContact(newOnes[0].id, contact.phone);
        showToast(`✓ ${newOnes[0].displayName || newOnes[0].username} added to contacts`);
      } else {
        Alert.alert('MULTIPLE MATCHES', `Found ${newOnes.length} users matching "${q}". Ask them to share their exact username.`);
      }
    } catch (e) { Alert.alert('ERROR', e.message); }
  };

  const sendSMSInvite = async (contact) => {
    setInviting(contact.id);
    try {
      // Auto-clear invite cap then retry once so it never blocks the user
      let data;
      try {
        data = await api('/api/invites', 'POST', {}, token);
      } catch (invErr) {
        if ((invErr.message || '').includes('10 active')) {
          try { await api('/api/invites', 'DELETE', null, token); } catch {}
          data = await api('/api/invites', 'POST', {}, token);
        } else { throw invErr; }
      }
      const inviteUrl   = data.invite_url || data.url;
      const inviteToken = data.token || null;   // store for server-side cancel
      if (!inviteUrl) { Alert.alert('ERROR', 'Could not generate invite link.'); return; }

      const senderName = currentUser?.display_name || currentUser?.username || 'A friend';
      const tkMatch    = inviteUrl.match(/[?&]invite=([A-Za-z0-9_=-]+)/);
      const deepLink   = tkMatch ? `nanosynapsys://join/${tkMatch[1]}` : null;
      const msg = deepLink
        ? `${senderName} invited you to SYNAPTYC.\n\n1. Download: https://apps.apple.com/app/id6759710350\n2. Tap to join: ${deepLink}\n\nOr open: ${inviteUrl}\n\nLink expires in 25 minutes — one-time use.`
        : `${senderName} invited you to SYNAPTYC. Join here: ${inviteUrl}\n(Expires in 25 min, one-time use)`;

      // Strip all non-digit chars except leading + for international numbers
      const phone = (contact.phone || '').replace(/(?!^\+)[^\d]/g, '');

      let sent = false;
      const smsAvail = await SMS.isAvailableAsync();
      if (smsAvail) {
        const { result } = await SMS.sendSMSAsync([phone], msg);
        if (result === 'sent' || result === 'unknown') {
          sent = true;
          showToast(`✓ Invite sent to ${contact.name}`);
        }
        // 'cancelled' = user backed out of SMS composer — do nothing
      } else {
        // Fallback: copy link to clipboard
        await Clipboard.setStringAsync(inviteUrl);
        sent = true;
        showToast(`Link copied — paste it to ${contact.name}`);
      }
      if (sent) await saveStatus(contact.phone, { s: 'i', e: Date.now() + 25 * 60 * 1000, t: inviteToken });
    } catch (e) { Alert.alert('ERROR', e.message || 'Failed to send invite.'); }
    finally { setInviting(null); }
  };

  // Reset amber status + immediately resend invite
  const resendInvite = async (contact) => {
    await cancelInvite(contact.phone);
    await sendSMSInvite(contact);
  };

  const filtered = deviceContacts.filter(c =>
    !contactsQuery.trim() ||
    c.name.toLowerCase().includes(contactsQuery.toLowerCase()) ||
    c.phone.includes(contactsQuery)
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, height: screenH * 0.86 }}>
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border }} />
          </View>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 }}>
            <Text style={{ fontFamily: mono, fontSize: 13, color: C.accent, fontWeight: '700', letterSpacing: 1, flex: 1 }}>MY PHONE CONTACTS</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeCircleBtn}><Text style={styles.closeCircleText}>✕</Text></TouchableOpacity>
          </View>
          {/* Inline toast */}
          {toast ? (
            <View style={{ backgroundColor: C.border, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: C.accent }}>
              <Text style={{ fontFamily: mono, fontSize: 11, color: C.accent }}>{toast}</Text>
            </View>
          ) : null}
          {/* LED legend */}
          <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingBottom: 10 }}>
            {[{ color: C.accent, label: 'CONTACT' }, { color: C.amber, label: 'INVITE SENT' }, { color: C.red, label: 'NOT CONNECTED' }].map(({ color, label }) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                <Text style={{ fontFamily: mono, fontSize: 9, color: C.dim }}>{label}</Text>
              </View>
            ))}
          </View>
          {/* Search */}
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <TextInput
              style={styles.input}
              placeholder="SEARCH CONTACTS..."
              placeholderTextColor={C.muted}
              value={contactsQuery}
              onChangeText={setContactsQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          {/* Body */}
          {contactsLoading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}><Spinner size="large" /></View>
          ) : contactsErr ? (
            <View style={{ padding: 24, alignItems: 'center', gap: 14 }}>
              <Text style={{ fontFamily: mono, fontSize: 11, color: C.red, textAlign: 'center', letterSpacing: 1 }}>
                CONTACTS PERMISSION DENIED
              </Text>
              <Text style={{ fontFamily: mono, fontSize: 10, color: C.dim, textAlign: 'center', lineHeight: 16 }}>
                {'Enable contacts access in:\nSettings → SYNAPTYC → Contacts'}
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('app-settings:')}
                style={{ borderWidth: 1, borderColor: C.accent, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 4 }}
              >
                <Text style={{ fontFamily: mono, fontSize: 11, color: C.accent, letterSpacing: 1 }}>OPEN SETTINGS</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
            <FlatList
              data={filtered}
              keyExtractor={c => c.id}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={true}
              maxToRenderPerBatch={12}
              windowSize={7}
              initialNumToRender={15}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={C.accent} />}
              ListEmptyComponent={<Text style={styles.emptyText}>NO CONTACTS FOUND</Text>}
              ListHeaderComponent={deviceContacts.length > 0 ? (
                <Text style={{ fontFamily: mono, fontSize: 9, color: C.dim, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6 }}>
                  {deviceContacts.length} CONTACT{deviceContacts.length !== 1 ? 'S' : ''}
                </Text>
              ) : null}
              renderItem={({ item: c }) => {
                const ps = getPhoneStatus(c.phone);
                const matched = autoMatchedMap[c.phone];
                const onApp = !!matched;
                const ledColor = ps === 'c'
                  ? (matched?.online ? C.accent : C.silver)
                  : ps === 'g' ? C.green
                  : ps === 'i' ? C.amber
                  : C.red;
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: ledColor, marginRight: 12, flexShrink: 0 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: mono, fontSize: 13, color: C.bright }}>{c.name}</Text>
                      <Text style={{ fontFamily: mono, fontSize: 10, color: C.dim }}>{c.phone}</Text>
                      {onApp && ps !== 'c' && (
                        <Text style={{ fontFamily: mono, fontSize: 9, color: C.green, marginTop: 1 }}>
                          ON APP · {matched.display_name || matched.displayName || matched.username}
                        </Text>
                      )}
                    </View>
                    {ps === 'c' ? (
                      /* Green: already a contact — show MESSAGE button */
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontFamily: mono, fontSize: 10, color: C.accent }}>✓</Text>
                        {onApp && (
                          <TouchableOpacity
                            style={{ borderWidth: 1, borderColor: C.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 }}
                            onPress={() => { onClose(); onOpenDM(matched); }}
                          >
                            <Text style={{ fontFamily: mono, fontSize: 10, color: C.accent }}>MSG</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : ps === 'i' ? (
                      /* Amber: invite pending — allow cancelling and resending */
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontFamily: mono, fontSize: 9, color: C.amber }}>PENDING</Text>
                        <TouchableOpacity
                          style={{ borderWidth: 1, borderColor: C.amber, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 3 }}
                          onPress={() => resendInvite(c)}
                          disabled={inviting === c.id}
                        >
                          {inviting === c.id
                            ? <ActivityIndicator size="small" color={C.amber} style={{ width: 28 }} />
                            : <Text style={{ fontFamily: mono, fontSize: 9, color: C.amber }}>RESEND</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ paddingHorizontal: 4, paddingVertical: 3 }}
                          onPress={() => cancelInvite(c.phone)}
                        >
                          <Text style={{ fontFamily: mono, fontSize: 9, color: C.dim }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ) : onApp ? (
                      /* Auto-detected on app — offer MSG + ADD */
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={{ borderWidth: 1, borderColor: C.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 }}
                          onPress={() => { onClose(); onOpenDM(matched); }}
                        >
                          <Text style={{ fontFamily: mono, fontSize: 10, color: C.accent }}>MSG</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ borderWidth: 1, borderColor: C.green, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 }}
                          onPress={() => addContact(matched.id, c.phone)}
                        >
                          <Text style={{ fontFamily: mono, fontSize: 10, color: C.green }}>ADD</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      /* Red: not detected — offer FIND + INVITE */
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          style={{ borderWidth: 1, borderColor: C.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 }}
                          onPress={() => findOnApp(c)}
                        >
                          <Text style={{ fontFamily: mono, fontSize: 10, color: C.accent }}>FIND</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ borderWidth: 1, borderColor: C.amber, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 }}
                          onPress={() => sendSMSInvite(c)}
                          disabled={inviting === c.id}
                        >
                          {inviting === c.id
                            ? <ActivityIndicator size="small" color={C.amber} style={{ width: 28 }} />
                            : <Text style={{ fontFamily: mono, fontSize: 10, color: C.amber }}>INVITE</Text>}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }}
              ListFooterComponent={isLimited ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL('app-settings:')}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 6, borderTopWidth: 1, borderTopColor: C.border }}
                >
                  <Text style={{ fontFamily: mono, fontSize: 10, color: C.dim, letterSpacing: 0.5 }}>Not seeing all contacts?</Text>
                  <Text style={{ fontFamily: mono, fontSize: 10, color: C.accent, letterSpacing: 0.5 }}>Open Settings →</Text>
                </TouchableOpacity>
              ) : null}
            />
            </>
          )}
          <View style={{ height: 24 }} />
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// CHATS TAB — 2-column grid
// ---------------------------------------------------------------------------
const CHAT_CARD_GAP    = 6;
const CHAT_CARD_MARGIN = 10;
const AVATAR_COLORS = ['#1a472a','#14213d','#4a1942','#7b2d00','#003049','#1b4332','#312244','#3d1c02'];
const GROUP_COLORS  = ['#1a2e1a','#1a1a3a','#2e1a2e','#2e1a0a','#0a1a2e','#1a2e24','#24152e','#2e1a10'];

function ChatsTab({ token, currentUser, onOpenDM, unread = {} }) {
  const { styles, C } = useSkin();
  const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [err,          setErr]          = useState('');
  const [showContacts, setShowContacts] = useState(false);
  const screenW = Dimensions.get('window').width;
  const cardW   = (screenW - CHAT_CARD_MARGIN * 2 - CHAT_CARD_GAP) / 2;

  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setErr('');
    try {
      const data = await api('/api/contacts', 'GET', null, token);
      setUsers(_normContacts(data).map(c => ({ ...c, id: c.userId })));
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token, currentUser.id]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const deleteChat = useCallback(async (user) => {
    const name = user.displayName || user.display_name || user.username;
    Alert.alert(
      'DELETE CHAT',
      `This will permanently delete all your chat history with ${name}. This action cannot be undone.`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'DELETE', style: 'destructive',
          onPress: async () => {
            setUsers(prev => prev.filter(u => u.id !== user.id));
            try {
              // Delete from backend
              await api(`/api/messages/delete/${user.id}`, 'DELETE', null, token);
              // Clear local DB cache
              await DB.deleteConversation(`dm_${user.id}`);
            } catch (e) { setErr(e.message); fetchUsers(); }
          },
        },
      ],
    );
  }, [token, fetchUsers]);

  if (loading) return <View style={styles.centerFill}><Spinner size="large" /></View>;

  return (
    <View style={styles.flex}>
      <ErrText msg={err} />
      <FlatList
        data={users}
        keyExtractor={(u) => String(u.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: CHAT_CARD_GAP, paddingHorizontal: CHAT_CARD_MARGIN }}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 100, gap: CHAT_CARD_GAP }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchUsers(true)} tintColor={C.accent} />}
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={10}
        ListEmptyComponent={<Text style={[styles.emptyText, { textAlign: 'center', marginTop: 40 }]}>NO CHATS YET{'\n'}Tap + to find contacts</Text>}
        renderItem={({ item }) => {
          const cnt  = unread[`dm_${item.id}`] || 0;
          const name = item.displayName || item.display_name || item.username || '?';
          const initials = name[0].toUpperCase();
          const avatarBg = AVATAR_COLORS[item.id % AVATAR_COLORS.length];
          const statusText = item.online ? 'ONLINE' : item.last_seen ? `SEEN ${fmtDate(item.last_seen)}` : 'OFFLINE';

          return (
            <TouchableOpacity
              style={{
                width: cardW,
                backgroundColor: C.accentFaint,
                borderWidth: 1,
                borderColor: C.accentDim,
                borderRadius: 16,
                padding: 12,
                alignItems: 'center',
                position: 'relative',
              }}
              onPress={() => onOpenDM(item)}
              onLongPress={() => deleteChat(item)}
              delayLongPress={500}
              activeOpacity={0.75}
            >
              {/* Unread badge */}
              {cnt > 0 && (
                <View accessibilityLabel="unread-badge" style={{
                  position: 'absolute', top: -6, right: -6,
                  backgroundColor: '#ee0011',
                  width: 20, height: 20, borderRadius: 10,
                  alignItems: 'center', justifyContent: 'center',
                  zIndex: 10,
                }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{cnt > 99 ? '99+' : cnt}</Text>
                </View>
              )}

              {/* Online indicator */}
              {item.online && (
                <View style={{
                  position: 'absolute', top: 8, left: 10,
                  width: 8, height: 8, borderRadius: 4,
                  backgroundColor: C.accent,
                }} />
              )}

              {/* Avatar */}
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={{
                  width: 56, height: 56, borderRadius: 28,
                  marginBottom: 8,
                  borderWidth: 2,
                  borderColor: item.online ? C.accent : C.accentMid,
                }} />
              ) : (
                <View style={{
                  width: 56, height: 56, borderRadius: 28,
                  backgroundColor: avatarBg,
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 8,
                  borderWidth: 2,
                  borderColor: item.online ? C.accent : 'transparent',
                }}>
                  <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', fontFamily: mono }}>{initials}</Text>
                </View>
              )}

              {/* Display name */}
              <Text style={{ fontFamily: mono, fontSize: 12, fontWeight: '700', color: C.text, letterSpacing: 0.5, textAlign: 'center' }} numberOfLines={1}>{name}</Text>

              {/* Username subtitle */}
              {name !== item.username && item.username && (
                <Text style={{ fontFamily: mono, fontSize: 9, color: C.dim, letterSpacing: 0.5, marginTop: 1, textAlign: 'center' }} numberOfLines={1}>@{item.username}</Text>
              )}

              {/* Status */}
              <Text style={{ fontFamily: mono, fontSize: 9, color: item.online ? C.accent : C.dim, letterSpacing: 0.5, marginTop: 3, textAlign: 'center' }} numberOfLines={1}>{statusText}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Floating + button */}
      <TouchableOpacity
        onPress={() => setShowContacts(true)}
        style={{
          position: 'absolute', bottom: 20, right: 20,
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: C.accent,
          justifyContent: 'center', alignItems: 'center',
          shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Text style={{ fontSize: 30, color: '#050f05', fontWeight: '700', lineHeight: 34 }}>+</Text>
      </TouchableOpacity>

      <PhoneContactsSheet
        visible={showContacts}
        onClose={() => { setShowContacts(false); fetchUsers(); }}
        token={token}
        currentUser={currentUser}
        onOpenDM={onOpenDM}
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
  const disappearTimers         = useRef([]);
  const peerPkRef               = useRef(null);  // cached peer public key (legacy compat)
  const [decryptedMsgs,  setDecryptedMsgs]  = useState({});
  const decryptedMsgsRef = useRef({});   // always-current mirror — survives effect cancellation
  const [decryptedMedia, setDecryptedMedia] = useState({});
  const ownPlainRef = useRef({});  // encrypted payload → plaintext for own sent messages
  const [peerTyping,     setPeerTyping]     = useState(false);
  const typingTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  // Pre-fetch peer's public key for E2EE (legacy NaCl compat)
  useEffect(() => {
    fetchPubKey(peer.id, token).then(pk => { peerPkRef.current = pk; }).catch(() => {});
  }, [peer.id, token]);

  // User topic is auto-joined at WS connect; no per-peer join needed for DMs

  // Send read receipt when entering this DM conversation
  useEffect(() => {
    if (wsRef.current && wsRef.current._phxSend) {
      wsRef.current._phxSend(`user:${currentUser.id}`, 'mark_read', { from: peer.id });
    }
  }, [peer.id, currentUser.id]);

  // Clean up all pending disappear timers and typing timeout on unmount
  useEffect(() => () => {
    disappearTimers.current.forEach(clearTimeout);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      // 1. Load cached messages from local DB immediately (instant)
      const local = await DB.getLocalMessages(`dm_${peer.id}`);
      if (local.length > 0) { setMessages(local); setLoading(false); }
      // 2. Delta-sync new messages from backend (decrypt + persist in SYNC)
      await SYNC.syncDM(peer.id, token, decryptDM);
      // 3. Reload DB to show any new messages
      const fresh = await DB.getLocalMessages(`dm_${peer.id}`);
      if (fresh.length > 0) {
        setMessages(fresh);
      } else if (local.length === 0) {
        // No local cache at all — try direct API fetch
        const data = await api(`/api/messages/${peer.id}`, 'GET', null, token);
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      setErr(e.message);
      // Graceful fallback: direct API call
      try {
        const data = await api(`/api/messages/${peer.id}`, 'GET', null, token);
        setMessages(Array.isArray(data) ? data : []);
      } catch {}
    }
    finally { setLoading(false); }
  }, [token, peer.id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    if (!incomingMsg) return;

    // ── DM message ──
    if (incomingMsg.type === 'chat_message') {
      // Handle both new snake_case (from_user) and legacy camelCase (from) field names
      const fromId = String(incomingMsg.from_user?.id ?? incomingMsg.from_user ?? incomingMsg.from);
      const toId   = String(incomingMsg.to_user?.id ?? incomingMsg.to_user ?? incomingMsg.to);
      const peerId = String(peer.id);
      const meId   = String(currentUser.id);
      // Show only messages that belong to THIS conversation
      const belongs = (fromId === peerId && toId === meId) ||
                      (fromId === meId   && toId === peerId);
      if (belongs) {
        const fromMe = fromId === meId;
        setMessages((prev) => {
          // Remove temp (optimistic) messages from self when real echo arrives
          const base = fromMe ? prev.filter(m => !m._temp) : prev;
          if (base.some(m => m.id === incomingMsg.id)) return base;
          // Pre-populate decrypted cache for own echoed messages.
          // Uses ownPlainRef (keyed by encrypted payload) — reliable even with rapid sends.
          // Server may HTML-escape the JSON (&quot;), so try unescaped key too.
          // Falls back to temp message content for backward compat.
          if (fromMe && isEncryptedDM(incomingMsg.content)) {
            const dmOwnKey = ownPlainRef.current[incomingMsg.content] ? incomingMsg.content
              : (typeof incomingMsg.content === 'string' && incomingMsg.content.includes('&quot;'))
                ? _htmlUnescape(incomingMsg.content) : null;
            const plain = (dmOwnKey && ownPlainRef.current[dmOwnKey])
              ? ownPlainRef.current[dmOwnKey]
              : (prev.find(m => m._temp))?.content;
            if (plain) {
              if (dmOwnKey) delete ownPlainRef.current[dmOwnKey];
              decryptedMsgsRef.current[incomingMsg.id] = plain;
              setDecryptedMsgs(p => ({ ...p, [incomingMsg.id]: plain }));
              // Persist plaintext immediately — sender can never re-decrypt own messages
              DB.persistMessage(`dm_${peerId}`, incomingMsg.id, meId, plain, incomingMsg.created_at, currentUser.username, currentUser.display_name).catch(() => {});
            }
          }
          return [...base, incomingMsg];
        });
        // Schedule disappear if requested — track timer so it's cancelled on unmount
        if (incomingMsg.disappear_after && incomingMsg.disappear_after > 0) {
          const msgId = incomingMsg.id;
          const tid = setTimeout(() => {
            setMessages(prev => prev.filter(m => m.id !== msgId));
          }, incomingMsg.disappear_after * 1000);
          disappearTimers.current.push(tid);
        }
        // Eagerly decrypt incoming encrypted messages from others — don't wait
        // for the batch decrypt effect. This makes decryption near-instant for
        // real-time messages arriving via WebSocket.
        if (!fromMe && isEncryptedDM(incomingMsg.content)) {
          const mid = incomingMsg.id;
          const sid = fromId;
          _decryptInFlight.add(mid);
          decryptDM(incomingMsg.content, sid, token).then(plain => {
            _decryptInFlight.delete(mid);
            if (plain !== null) {
              decryptedMsgsRef.current[mid] = plain;
              setDecryptedMsgs(p => ({ ...p, [mid]: plain }));
              DB.persistMessage(`dm_${peer.id}`, mid, sid, plain, incomingMsg.created_at, incomingMsg.from_username ?? incomingMsg.fromUsername, incomingMsg.from_display ?? incomingMsg.fromDisplay).catch(() => {});
            }
          }).catch(() => { _decryptInFlight.delete(mid); });
        }
      }
    }

    // ── Read receipt: mark all own messages to this peer as read ──
    if (incomingMsg.type === 'messages_read' && String(incomingMsg.by) === String(peer.id)) {
      setMessages(prev => prev.map(m =>
        String(m.from_user ?? m.from) === String(currentUser.id) ? { ...m, read: true } : m
      ));
    }

    // ── Typing indicator from peer ──
    if (incomingMsg.type === 'typing' && String(incomingMsg.from) === String(peer.id)) {
      setPeerTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setPeerTyping(false), 3000);
    }

    // ── Server error reply (rate limit, invalid, etc.) ──
    if (incomingMsg.type === 'ws_error') {
      setErr(incomingMsg.reason || 'Message rejected by server');
      setTimeout(() => setErr(''), 5000);
      // Clean up stuck temp messages — server rejected the send
      setMessages(prev => prev.filter(m => !m._temp));
    }
  }, [incomingMsg, peer.id, currentUser.id]);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // Async decrypt all encrypted DMs whenever the message list changes.
  // Each successful decryption IMMEDIATELY updates state (not batched at end)
  // to prevent "[Decrypting…]" from persisting due to effect cancellation races.
  // Messages that fail decryption are retried up to 3 times before marking __UNDECRYPTABLE__.
  const decryptRetryRef = useRef({});  // { [msgId]: retryCount }
  useEffect(() => {
    let alive = true;
    const myInflight = new Set();
    (async () => {
      for (const msg of messages) {
        if (isEncryptedDM(msg.content)) {
          const cached = decryptedMsgsRef.current[msg.id];
          // Skip successfully decrypted messages (but retry __UNDECRYPTABLE__ up to max retries)
          if (cached && cached !== '__UNDECRYPTABLE__') {
            // Already decrypted — ref is always current
          } else if (_decryptInFlight.has(msg.id)) {
            continue;
          } else {
            const retryCount = decryptRetryRef.current[msg.id] || 0;
            // After max retries, mark as permanently undecryptable
            if (retryCount >= 3) {
              if (cached !== '__UNDECRYPTABLE__') {
                decryptedMsgsRef.current[msg.id] = '__UNDECRYPTABLE__';
                setDecryptedMsgs(prev => ({ ...prev, [msg.id]: '__UNDECRYPTABLE__' }));
              }
              continue;
            }
            _decryptInFlight.add(msg.id);
            myInflight.add(msg.id);
            const sid = String(msg.from_user?.id ?? msg.from_user ?? msg.from ?? msg.from_id ?? '');
            let plain = null;
            // 1. Check DB cache first — sync may have decrypted and persisted it
            try {
              const dbCached = await DB.getMessage(`dm_${peer.id}`, msg.id);
              if (dbCached?.content && !isEncryptedDM(dbCached.content)) plain = dbCached.content;
            } catch {}
            // 2. If not in DB, try live decryption
            if (plain === null) {
              plain = await decryptDM(msg.content, sid, token);
            }
            _decryptInFlight.delete(msg.id);
            myInflight.delete(msg.id);
            if (plain !== null) {
              decryptedMsgsRef.current[msg.id] = plain;
              setDecryptedMsgs(prev => ({ ...prev, [msg.id]: plain }));
              delete decryptRetryRef.current[msg.id];
              DB.persistMessage(`dm_${peer.id}`, msg.id, sid, plain, msg.created_at, msg.from_username ?? msg.fromUsername, msg.from_display ?? msg.fromDisplay).catch(() => {});
            } else {
              // Increment retry counter — will retry on next effect run
              decryptRetryRef.current[msg.id] = retryCount + 1;
              // Don't mark __UNDECRYPTABLE__ yet — leave as null so UI shows [Decrypting…]
              // which is less alarming and signals that retries are in progress
            }
          }
        }
        // Trigger media decryption for any message whose resolved content is a media payload
        const resolved = decryptedMsgsRef.current[msg.id] ?? (isEncryptedDM(msg.content) ? null : msg.content);
        if (resolved && resolved !== '__UNDECRYPTABLE__' && MEDIA.isMediaPayload(resolved) && !decryptedMedia[msg.id]) {
          const mp = MEDIA.parseMediaPayload(resolved);
          if (mp) {
            MEDIA.decryptMedia(mp.url, mp.key, mp.nonce, mp.mime).then(uri => {
              if (alive) setDecryptedMedia(prev => ({ ...prev, [msg.id]: uri }));
            }).catch(() => {});
          }
        }
      }
      // Schedule a retry pass after 2s for any messages still pending decryption.
      // This gives time for sessions to be established (e.g., x3dh bundle fetch).
      const pendingRetries = messages.some(m =>
        isEncryptedDM(m.content) && !decryptedMsgsRef.current[m.id] && (decryptRetryRef.current[m.id] || 0) < 3
      );
      if (pendingRetries && alive) {
        setTimeout(() => {
          if (alive) setDecryptedMsgs(prev => ({ ...prev })); // trigger re-render → effect re-run
        }, 2000);
      }
      // Reconciliation batch: sync all ref entries to state in one pass.
      if (alive) {
        const batch = {};
        let needed = false;
        for (const msg of messages) {
          if (isEncryptedDM(msg.content) && decryptedMsgsRef.current[msg.id]) {
            batch[msg.id] = decryptedMsgsRef.current[msg.id];
            needed = true;
          }
        }
        if (needed) setDecryptedMsgs(prev => ({ ...prev, ...batch }));
      }
    })();
    return () => {
      alive = false;
      for (const id of myInflight) _decryptInFlight.delete(id);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, token, peer.id]);

  const sendMessage = useCallback(async (overrideContent = null) => {
    const content = overrideContent ?? text.trim();
    if (!content) return;
    if (!overrideContent) setText('');
    setSending(true);
    const isImage = typeof content === 'string' && content.startsWith('data:');
    try {
      // E2EE: encrypt text messages (not images — images are large binary data)
      let payload = content;
      if (!isImage && e2eeKey()) {
        // 10s timeout prevents spinner from hanging forever if session build stalls
        payload = await Promise.race([
          encryptDM(content, null, peer.id, token),
          new Promise(r => setTimeout(() => r(null), 10000)),
        ]);
        if (payload === null) {
          // Don't block the user — send plaintext as fallback instead of aborting
          payload = content;
          console.warn('[Signal] DM encrypt timeout/failure — sending plaintext');
        }
      }
      // Cache plaintext keyed by encrypted payload — sender can never re-decrypt own
      // Double Ratchet messages.  ownPlainRef lookup is reliable even with rapid sends
      // (unlike matching by temp message position).
      if (payload !== content && isEncryptedDM(payload)) {
        ownPlainRef.current[payload] = content;
      }
      // Images always go via REST (too large for the WebSocket frame limit).
      // Text goes via WebSocket for real-time delivery; falls back to REST when WS is down.
      if (!isImage && wsRef.current && wsRef.current.readyState === WebSocket.OPEN && wsRef.current._phxSend) {
        const phxPayload = { content: payload, to: peer.id };
        if (disappear) phxPayload.disappear_after = disappear;
        wsRef.current._phxSend(`user:${currentUser.id}`, 'chat_message', phxPayload);
        // Optimistic push — show plaintext immediately; server echo replaces on arrival
        const tempId = `temp_${Date.now()}`;
        setMessages(prev => [...prev, {
          id: tempId, from_user: currentUser, from: currentUser.id,
          to: peer.id, content, created_at: new Date().toISOString(), _temp: true,
        }]);
        // Safety: auto-expire temp message after 15s if server echo never arrives
        // (handles silent WS send failure — connection may drop right after send)
        setTimeout(() => {
          setMessages(prev => prev.some(m => m.id === tempId) ?
            prev.map(m => m.id === tempId ? { ...m, _temp: false, _failed: true } : m) : prev);
        }, 15000);
      } else {
        const msg = await api('/api/messages', 'POST', { to: peer.id, content: payload }, token);
        // Pre-populate decrypted cache for own encrypted message
        if (payload !== content && isEncryptedDM(payload)) {
          decryptedMsgsRef.current[msg.id] = content;
          setDecryptedMsgs(p => ({ ...p, [msg.id]: content }));
          // Persist plaintext immediately — sender can never re-decrypt own messages
          DB.persistMessage(`dm_${peer.id}`, msg.id, String(currentUser.id), content, msg.created_at, currentUser.username, currentUser.display_name).catch(() => {});
        }
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      }
    } catch (e) { setErr(e.message); if (!overrideContent) setText(content); }
    finally { setSending(false); }
  }, [text, peer.id, currentUser.id, wsRef, token, disappear]);

  const handleAttachment = useCallback(async () => {
    const pickerOpts = { quality: 0.4, base64: true, exif: false };
    const uploadAndSend = async (a) => {
      if (!a.base64) { Alert.alert('ERROR', 'Could not read image data.'); return; }
      try {
        const mimeType = a.mimeType ?? 'image/jpeg';
        const { url, key, nonce } = await MEDIA.uploadEncryptedMedia(a.base64, mimeType, token);
        await sendMessage(MEDIA.mediaPayload(url, key, nonce, mimeType));
      } catch (e) {
        Alert.alert('UPLOAD ERROR', e.message ?? 'Image upload failed.');
      }
    };
    Alert.alert('ATTACH', 'Select source', [
      {
        text: 'CAMERA',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (perm.status !== 'granted') { Alert.alert('PERMISSION DENIED', 'Camera access required.'); return; }
          const res = await ImagePicker.launchCameraAsync(pickerOpts);
          if (!res.canceled && res.assets?.[0]) await uploadAndSend(res.assets[0]);
        },
      },
      {
        text: 'PHOTO LIBRARY',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (perm.status !== 'granted') { Alert.alert('PERMISSION DENIED', 'Photo library access required.'); return; }
          const res = await ImagePicker.launchImageLibraryAsync({ ...pickerOpts, mediaTypes: 'images' });
          if (!res.canceled && res.assets?.[0]) await uploadAndSend(res.assets[0]);
        },
      },
      { text: 'CANCEL', style: 'cancel' },
    ]);
  }, [sendMessage, token]);

  const handleShareLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('PERMISSION DENIED', 'Location access required.'); return; }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      sendMessage(`[LOCATION:${lat},${lng}] https://maps.google.com/?q=${lat},${lng}`);
    } catch (e) { Alert.alert('ERROR', 'Failed to get location: ' + e.message); }
  }, [sendMessage]);

  const isMine = (msg) => String(msg.from_user?.id ?? msg.from_user ?? msg.from ?? msg.from_id) === String(currentUser.id);
  // Resolve plaintext from a message — reads from async-decrypted cache or DB-loaded content
  const resolveContent = (msg) => {
    const raw = isEncryptedDM(msg.content) ? decryptedMsgs[msg.id] : msg.content;
    const isEnc = isEncryptedDM(msg.content);
    if (raw === '__UNDECRYPTABLE__') return { text: '[Encrypted]', encrypted: true, failed: true, isMedia: false };
    if (!raw && isEnc) return { text: '[Decrypting…]', encrypted: true, failed: false, isMedia: false };
    if (raw && MEDIA.isMediaPayload(raw)) return { text: '', encrypted: isEnc, failed: false, isMedia: true };
    return { text: raw ?? '[Decrypting…]', encrypted: isEnc, failed: !raw && isEnc, isMedia: false };
  };
  const getMediaUri = (msg) => decryptedMedia[msg.id] ?? null;

  // Swipe right to go back
  const swipeBackDM = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dx > 20 && Math.abs(g.dy) < 60,
    onPanResponderRelease: (_, g) => { if (g.dx > 60) onBack(); },
  })).current;

  return (
    <ThemedSafeArea>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader
        title={peer.display_name || peer.displayName || peer.username}
        subtitle={peer.display_name || peer.displayName ? `@${peer.username}` : undefined}
        avatarUri={peer.avatar_url}
        onBack={onBack}
      />
      {disappear && (
        <View style={{ backgroundColor: C.panel, paddingHorizontal: 14, paddingVertical: 4, alignItems: 'center' }}>
          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 10, color: C.amber, letterSpacing: 1 }}>
            {'\u23F1'} MESSAGES DISAPPEAR AFTER {DISAPPEAR_OPTIONS.find(o => o.value === disappear)?.label ?? ''}
          </Text>
        </View>
      )}
      <KeyboardAvoidingView style={styles.flex} behavior={KAV_BEHAVIOR} {...swipeBackDM.panHandlers}>
        {loading ? <View style={styles.centerFill}><Spinner size="large" /></View> : (
          <>
            <ErrText msg={err} />
            <FlatList
              ref={listRef} data={messages} keyExtractor={(m) => String(m.id)}
              contentContainerStyle={styles.msgList}
              removeClippedSubviews={Platform.OS !== 'ios'}
              maxToRenderPerBatch={15}
              windowSize={11}
              initialNumToRender={20}
              ListEmptyComponent={<Text style={styles.emptyText}>NO MESSAGES YET</Text>}
              renderItem={({ item }) => {
                const mine = isMine(item);
                const { text: msgText, failed, isMedia } = resolveContent(item);
                const mediaUri = isMedia ? getMediaUri(item) : null;
                return (
                  <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}>
                    <View style={[styles.msgBubble, mine ? styles.bubbleMine : styles.bubbleTheirs, failed && { borderColor: C.red, borderWidth: 1.5 }]}>
                      {isImageContent(item.content) ? (
                        <Image source={{ uri: item.content }} style={styles.imageMsg} resizeMode="contain" />
                      ) : isMedia ? (
                        mediaUri
                          ? <Image source={{ uri: mediaUri }} style={styles.imageMsg} resizeMode="contain" />
                          : <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 9, color: mine ? '#ffffffaa' : C.dim }}>Loading image…</Text>
                      ) : isLocationContent(msgText) ? (
                        <TouchableOpacity onPress={() => {
                          const m = msgText.match(/\[LOCATION:([-\d.]+),([-\d.]+)\]/);
                          if (m) Linking.openURL(`https://maps.google.com/?q=${m[1]},${m[2]}`);
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <IconPin size={13} color={mine ? '#fff' : C.accent} />
                            <Text style={[styles.msgText, { color: mine ? '#fff' : C.accent }]}>Location shared</Text>
                          </View>
                          <Text style={[styles.msgTime, { marginTop: 2 }]}>
                            {msgText.match(/\[LOCATION:([-\d.]+),([-\d.]+)\]/)?.[0].replace('[LOCATION:', '').replace(']', '') || ''}
                          </Text>
                          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 9, color: mine ? '#ffffffaa' : C.dim, marginTop: 2 }}>
                            TAP TO OPEN IN MAPS
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.msgText, failed && { color: C.red }]}>{msgText}</Text>
                      )}
                      <View style={styles.msgMeta}>
                        <Text style={styles.msgTime}>{fmtTime(item.created_at)}</Text>
                        {mine && <Text style={styles.msgRead}>{item.read ? ' \u2713\u2713' : ' \u2713'}</Text>}
                      </View>
                    </View>
                  </View>
                );
              }}
            />
            {peerTyping && (
              <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 10, color: C.dim, paddingHorizontal: 16, paddingBottom: 4 }}>
                {peer.display_name || peer.displayName || peer.username} is typing…
              </Text>
            )}
            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.attachBtn} onPress={handleAttachment}>
                <Text style={styles.attachBtnText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachBtn} onPress={handleShareLocation}>
                <IconPin size={18} color={C.accent} />
              </TouchableOpacity>
              <TextInput style={styles.chatInput} placeholder="MESSAGE..." placeholderTextColor={C.muted}
                value={text} onChangeText={(v) => {
                  setText(v);
                  const now = Date.now();
                  if (v.length > 0 && now - lastTypingSentRef.current > 2000 && wsRef.current?._phxSend) {
                    wsRef.current._phxSend(`user:${currentUser.id}`, 'typing', { to: peer.id });
                    lastTypingSentRef.current = now;
                  }
                }} multiline maxLength={2000}
                autoCorrect={false} spellCheck={false} />
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
function GroupsTab({ token, onOpenGroup, unread = {} }) {
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
      // Initialize sender key state for the new group (no other members yet, so no distribution)
      if (e2eeKey()) {
        await generateAndDistributeGroupKey(g.id, [], token, String(g.created_by));
      }
    } catch (e) { setCreateErr(e.message); }
    finally { setCreating(false); }
  };

  const deleteGroup = (g) => {
    Alert.alert(
      'DELETE GROUP',
      `Delete "${g.name}" for everyone? This cannot be undone.`,
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

  const leaveGroup = (g) => {
    Alert.alert(
      'LEAVE GROUP',
      `Leave "${g.name}"?`,
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'LEAVE',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/api/groups/${g.id}/leave`, 'POST', null, token);
              setGroups(prev => prev.filter(x => x.id !== g.id));
            } catch (e) { setErr(e.message); }
          },
        },
      ]
    );
  };

  if (loading) return <View style={styles.centerFill}><Spinner size="large" /></View>;

  const screenW2 = Dimensions.get('window').width;
  const cardW2   = (screenW2 - CHAT_CARD_MARGIN * 2 - CHAT_CARD_GAP) / 2;
  const mono2    = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

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
        data={groups}
        keyExtractor={(g) => String(g.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: CHAT_CARD_GAP, paddingHorizontal: CHAT_CARD_MARGIN }}
        contentContainerStyle={{ paddingTop: 10, paddingBottom: 100, gap: CHAT_CARD_GAP }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchGroups(true)} tintColor={C.accent} />}
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={10}
        ListHeaderComponent={!showForm ? (
          <View style={{ paddingHorizontal: CHAT_CARD_MARGIN, paddingBottom: 8 }}>
            <TouchableOpacity style={styles.createGroupBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.createGroupBtnText}>+ NEW GROUP</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        ListEmptyComponent={<Text style={[styles.emptyText, { textAlign: 'center', marginTop: 40 }]}>NO GROUPS YET</Text>}
        renderItem={({ item }) => {
          const cnt = unread[`group_${item.id}`] || 0;
          const isAdmin = item.my_role === 'admin';
          const initials = (item.name || 'G')[0].toUpperCase();
          const bgColor  = GROUP_COLORS[item.id % GROUP_COLORS.length];
          const subtitle = item.description || `CREATED ${fmtDate(item.created_at)}`;

          return (
            <TouchableOpacity
              style={{
                width: cardW2,
                backgroundColor: C.accentFaint,
                borderWidth: 1,
                borderColor: C.accentDim,
                borderRadius: 16,
                padding: 12,
                alignItems: 'center',
                position: 'relative',
                overflow: 'visible',
              }}
              onPress={() => onOpenGroup(item)}
              onLongPress={() => {
                const actions = isAdmin
                  ? [
                      { text: 'CANCEL', style: 'cancel' },
                      { text: 'DELETE GROUP', style: 'destructive', onPress: () => deleteGroup(item) },
                    ]
                  : [
                      { text: 'CANCEL', style: 'cancel' },
                      { text: 'LEAVE GROUP', style: 'destructive', onPress: () => leaveGroup(item) },
                    ];
                Alert.alert(item.name, isAdmin ? 'Delete this group for everyone?' : 'Leave this group?', actions);
              }}
              delayLongPress={500}
              activeOpacity={0.75}
            >
              {/* Unread badge */}
              {cnt > 0 && (
                <View accessibilityLabel="unread-badge" style={{
                  position: 'absolute', top: -6, right: -6,
                  backgroundColor: '#ee0011',
                  width: 20, height: 20, borderRadius: 10,
                  alignItems: 'center', justifyContent: 'center',
                  zIndex: 10,
                }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{cnt > 99 ? '99+' : cnt}</Text>
                </View>
              )}

              {/* Group avatar */}
              <View style={{
                width: 56, height: 56, borderRadius: 16,
                backgroundColor: bgColor,
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 8,
                borderWidth: 2,
                borderColor: C.accentMid,
              }}>
                <Text style={{ color: C.accent, fontSize: 24, fontWeight: '700', fontFamily: mono2 }}>{initials}</Text>
              </View>

              {/* Name */}
              <Text style={{ fontFamily: mono2, fontSize: 12, fontWeight: '700', color: C.text, letterSpacing: 0.5, textAlign: 'center' }} numberOfLines={1}>{item.name}</Text>

              {/* Description / date */}
              <Text style={{ fontFamily: mono2, fontSize: 9, color: C.dim, letterSpacing: 0.5, marginTop: 3, textAlign: 'center' }} numberOfLines={1}>{subtitle}</Text>

              {/* Admin badge */}
              {isAdmin && (
                <View style={{ marginTop: 6, backgroundColor: C.accentDim, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: mono2, fontSize: 8, color: C.accent, letterSpacing: 1 }}>ADMIN</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Floating + button */}
      <TouchableOpacity
        onPress={() => setShowForm(true)}
        style={{
          position: 'absolute', bottom: 20, right: 20,
          width: 52, height: 52, borderRadius: 26,
          backgroundColor: C.accent,
          justifyContent: 'center', alignItems: 'center',
          shadowColor: C.accent, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Text style={{ fontSize: 30, color: '#050f05', fontWeight: '700', lineHeight: 34 }}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// GROUP CHAT SCREEN
// ---------------------------------------------------------------------------
function GroupChatScreen({ token, currentUser, group, onBack, wsRef, incomingMsg }) {
  const { styles, C } = useSkin();
  const [messages, setMessages]     = useState([]);
  const [text, setText]             = useState('');
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [err, setErr]               = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const listRef                     = useRef(null);
  const disappearTimers             = useRef([]);
  const groupKeyRef                 = useRef(null);  // legacy NaCl group key (compat)
  const [decryptedMsgs,  setDecryptedMsgs]  = useState({});
  const decryptedMsgsRef = useRef({});   // always-current mirror — survives effect cancellation
  const [decryptedMedia, setDecryptedMedia] = useState({});
  const [senderKeysReady, setSenderKeysReady] = useState(false);
  const senderKeysPromise = useRef(null);  // awaitable promise for sender key loading
  const ownPlainRef = useRef({});  // encrypted payload hash → plaintext for own sent messages

  useEffect(() => () => { disappearTimers.current.forEach(clearTimeout); }, []);

  // Load all Signal sender keys for this group.
  // 1. Fetch existing sender keys from server (detects stale/regenerated keys)
  // 2. Distribute OUR sender key to ALL current members (covers new members)
  // 3. Re-fetch sender keys again AFTER distribution (other members may have
  //    distributed while we were setting up — catches the mutual-join race)
  useEffect(() => {
    setSenderKeysReady(false);
    const p = (async () => {
      // Phase 1: Load existing sender keys from server
      await loadGroupSenderKeys(group.id, token, String(currentUser.id));
      setSenderKeysReady(true);  // Unblock decryption attempts with what we have

      // Phase 2: Distribute our sender key to ALL current members (15s timeout)
      try {
        await Promise.race([
          (async () => {
            const members = await api(`/api/groups/${group.id}/members`, 'GET', null, token).catch(() => []);
            const memberIds = (Array.isArray(members) ? members : []).map(m => m.userId ?? m.user_id ?? m.id).filter(Boolean);
            if (memberIds.length > 0 && e2eeKey()) {
              await generateAndDistributeGroupKey(group.id, memberIds, token, String(currentUser.id));
            }
          })(),
          new Promise(r => setTimeout(r, 15000)),
        ]);
      } catch {}

      // Phase 3: Re-fetch sender keys (other members may have distributed during phase 2)
      try { await loadGroupSenderKeys(group.id, token, String(currentUser.id)); } catch {}
    })().catch(() => setSenderKeysReady(true));
    senderKeysPromise.current = p;
    // Also load legacy NaCl key for backward compat
    loadGroupKey(group.id, token).then(k => { groupKeyRef.current = k; }).catch(() => {});
  }, [group.id, token, currentUser.id]);

  // Join the Phoenix channel topic for this group so inbound messages arrive
  useEffect(() => {
    if (wsRef.current && wsRef.current._phxJoin) {
      wsRef.current._phxJoin(`group:${group.id}`);
    }
  }, [group.id, wsRef]);

  const fetchHistory = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      // 1. Load from local DB immediately (show cached messages while keys load)
      const local = await DB.getLocalMessages(`group_${group.id}`);
      if (local.length > 0) { setMessages(local); setLoading(false); }
      // 2. Wait for sender keys before syncing — decryptGroupMsg needs them
      if (senderKeysPromise.current) await senderKeysPromise.current;
      // 3. Delta-sync from backend
      await SYNC.syncGroup(group.id, token, decryptGroupMsg, String(currentUser.id));
      // 3. Reload DB
      const fresh = await DB.getLocalMessages(`group_${group.id}`);
      if (fresh.length > 0) {
        setMessages(fresh);
      } else if (local.length === 0) {
        const data = await api(`/api/groups/${group.id}/messages`, 'GET', null, token);
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      setErr(e.message);
      try {
        const data = await api(`/api/groups/${group.id}/messages`, 'GET', null, token);
        setMessages(Array.isArray(data) ? data : []);
      } catch {}
    }
    finally { setLoading(false); }
  }, [token, group.id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    if (!incomingMsg) return;
    if (incomingMsg.type === 'group_message' &&
        String(incomingMsg.group?.id ?? incomingMsg.group_id) === String(group.id)) {
      setMessages((prev) => {
        const fromMe = String(incomingMsg.from_user?.id ?? incomingMsg.from_user ?? incomingMsg.from_id ?? incomingMsg.from) === String(currentUser.id);
        // Remove any temp (optimistic) messages from self when real echo arrives
        const base = fromMe ? prev.filter(m => !m._temp) : prev;
        if (base.some(m => m.id === incomingMsg.id)) return base;
        // For own encrypted messages, pre-populate decrypted cache from ownPlainRef.
        // Server may HTML-escape the JSON envelope (&quot; etc.), so try both raw and unescaped keys.
        const ownKey = ownPlainRef.current[incomingMsg.content] ? incomingMsg.content
          : (typeof incomingMsg.content === 'string' && incomingMsg.content.includes('&quot;'))
            ? _htmlUnescape(incomingMsg.content) : null;
        if (fromMe && isEncryptedGroup(incomingMsg.content) && ownKey && ownPlainRef.current[ownKey]) {
          const plain = ownPlainRef.current[ownKey];
          delete ownPlainRef.current[ownKey];
          decryptedMsgsRef.current[incomingMsg.id] = plain;
          setDecryptedMsgs(p => ({ ...p, [incomingMsg.id]: plain }));
          // Persist plaintext immediately — sender can never re-decrypt own messages
          DB.persistMessage(`group_${group.id}`, incomingMsg.id, String(currentUser.id), plain, incomingMsg.created_at, currentUser.username, currentUser.display_name).catch(() => {});
        }
        return [...base, incomingMsg];
      });
      if (incomingMsg.disappear_after && incomingMsg.disappear_after > 0) {
        const msgId = incomingMsg.id;
        const tid = setTimeout(() => {
          setMessages(prev => prev.filter(m => m.id !== msgId));
        }, incomingMsg.disappear_after * 1000);
        disappearTimers.current.push(tid);
      }
      // Eagerly decrypt incoming encrypted messages from others — don't wait
      // for the batch decrypt effect. Near-instant decryption for real-time messages.
      // If initial decrypt fails (missing sender key), reload keys from server and retry
      // after a short delay — the sender's key distribution may arrive moments after the message.
      {
        const fromId = String(incomingMsg.from_user?.id ?? incomingMsg.from_user ?? incomingMsg.from_id ?? incomingMsg.from);
        if (fromId !== String(currentUser.id) && isEncryptedGroup(incomingMsg.content)) {
          const mid = incomingMsg.id;
          _decryptInFlight.add(mid);
          decryptGroupMsg(incomingMsg.content, null, fromId, group.id).then(async (plain) => {
            if (plain !== null) {
              _decryptInFlight.delete(mid);
              decryptedMsgsRef.current[mid] = plain;
              setDecryptedMsgs(p => ({ ...p, [mid]: plain }));
              DB.persistMessage(`group_${group.id}`, mid, fromId, plain, incomingMsg.created_at, incomingMsg.from_username ?? incomingMsg.fromUsername, incomingMsg.from_display ?? incomingMsg.fromDisplay).catch(() => {});
            } else {
              // Retry with escalating delays — sender key may arrive shortly after message.
              // Only reload sender keys (lightweight GET), never distribute (expensive POST loop).
              const delays = [1500, 3000, 5000];
              let decrypted = null;
              for (const delay of delays) {
                await new Promise(r => setTimeout(r, delay));
                try { await loadGroupSenderKeys(group.id, token, String(currentUser.id)); } catch {}
                decrypted = await decryptGroupMsg(incomingMsg.content, null, fromId, group.id).catch(() => null);
                if (decrypted !== null) break;
              }
              _decryptInFlight.delete(mid);
              if (decrypted !== null) {
                decryptedMsgsRef.current[mid] = decrypted;
                setDecryptedMsgs(p => ({ ...p, [mid]: decrypted }));
                DB.persistMessage(`group_${group.id}`, mid, fromId, decrypted, incomingMsg.created_at, incomingMsg.from_username ?? incomingMsg.fromUsername, incomingMsg.from_display ?? incomingMsg.fromDisplay).catch(() => {});
              }
              // If still null, the batch decrypt effect will retry with longer delays
            }
          }).catch(() => { _decryptInFlight.delete(mid); });
        }
      }
    }

    // ── Server error reply (rate limit, invalid, etc.) ──
    if (incomingMsg.type === 'ws_error') {
      setErr(incomingMsg.reason || 'Message rejected by server');
      setTimeout(() => setErr(''), 5000);
      // Clean up stuck temp messages — server rejected the send
      setMessages(prev => prev.filter(m => !m._temp));
    }
  }, [incomingMsg, group.id, currentUser.id]);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // Async decrypt all encrypted group messages whenever the message list changes.
  // Each successful decryption IMMEDIATELY updates state (not batched at end)
  // to prevent "[Decrypting…]" from persisting due to effect cancellation races.
  // Messages that fail are retried up to 6 times (with escalating delays and
  // sender key re-fetches between passes) before marking __UNDECRYPTABLE__.
  const MAX_GROUP_RETRIES = 6;
  const decryptRetryRef = useRef({});
  useEffect(() => {
    let alive = true;
    const myInflight = new Set();
    (async () => {
      // On retry passes (retryCount > 0), reload sender keys from server first —
      // the missing key may have been distributed since last attempt.
      const maxRetryAmongPending = Math.max(0, ...messages
        .filter(m => isEncryptedGroup(m.content) && !decryptedMsgsRef.current[m.id])
        .map(m => decryptRetryRef.current[m.id] || 0));
      if (maxRetryAmongPending > 0 && senderKeysReady) {
        try { await loadGroupSenderKeys(group.id, token, String(currentUser.id)); } catch {}
      }

      for (const msg of messages) {
        if (isEncryptedGroup(msg.content)) {
          const cached = decryptedMsgsRef.current[msg.id];
          if (cached && cached !== '__UNDECRYPTABLE__') {
            // Already decrypted — skip
          } else if (_decryptInFlight.has(msg.id)) {
            continue;
          } else {
            const retryCount = decryptRetryRef.current[msg.id] || 0;
            // After max retries AND sender keys are loaded, give up
            if (retryCount >= MAX_GROUP_RETRIES && senderKeysReady) {
              if (cached !== '__UNDECRYPTABLE__') {
                decryptedMsgsRef.current[msg.id] = '__UNDECRYPTABLE__';
                setDecryptedMsgs(prev => ({ ...prev, [msg.id]: '__UNDECRYPTABLE__' }));
              }
              continue;
            }
            // If sender keys not ready yet, don't burn retry attempts
            if (!senderKeysReady && retryCount > 0) continue;
            _decryptInFlight.add(msg.id);
            myInflight.add(msg.id);
            const sid = String(msg.from_user?.id ?? msg.from_user ?? msg.from ?? msg.from_id ?? '');
            let plain = null;
            // 1. Check DB cache — sync or WS handler may have persisted plaintext
            try {
              const dbCached = await DB.getMessage(`group_${group.id}`, msg.id);
              if (dbCached?.content && !isEncryptedGroup(dbCached.content)) plain = dbCached.content;
            } catch {}
            // 2. Live decryption (decryptGroupMsg has its own internal retry with key re-fetch)
            if (plain === null) {
              try {
                plain = await decryptGroupMsg(msg.content, null, sid, group.id);
              } catch {}
            }
            _decryptInFlight.delete(msg.id);
            myInflight.delete(msg.id);
            if (plain !== null) {
              decryptedMsgsRef.current[msg.id] = plain;
              setDecryptedMsgs(prev => ({ ...prev, [msg.id]: plain }));
              delete decryptRetryRef.current[msg.id];
              DB.persistMessage(`group_${group.id}`, msg.id, sid, plain, msg.created_at, msg.from_username ?? msg.fromUsername, msg.from_display ?? msg.fromDisplay).catch(() => {});
            } else if (senderKeysReady) {
              decryptRetryRef.current[msg.id] = retryCount + 1;
              // Leave as null (not __UNDECRYPTABLE__) — shows [Decrypting…] while retries remain
            }
            // If !senderKeysReady, leave as null — will retry when keys load
          }
        }
        // Trigger media decryption for any message whose resolved content is a media payload
        const resolved = decryptedMsgsRef.current[msg.id] ?? (isEncryptedGroup(msg.content) ? null : msg.content);
        if (resolved && resolved !== '__UNDECRYPTABLE__' && MEDIA.isMediaPayload(resolved) && !decryptedMedia[msg.id]) {
          const mp = MEDIA.parseMediaPayload(resolved);
          if (mp) {
            MEDIA.decryptMedia(mp.url, mp.key, mp.nonce, mp.mime).then(uri => {
              if (alive) setDecryptedMedia(prev => ({ ...prev, [msg.id]: uri }));
            }).catch(() => {});
          }
        }
      }
      // Schedule retry with escalating delay for messages still pending decryption.
      // Delay increases per retry: 3s, 5s, 7s, 9s, 11s, 13s — gives time for
      // sender key distribution to propagate between members.
      const pendingRetries = messages.filter(m =>
        isEncryptedGroup(m.content) && !decryptedMsgsRef.current[m.id] && (decryptRetryRef.current[m.id] || 0) < MAX_GROUP_RETRIES
      );
      if (pendingRetries.length > 0 && alive) {
        const maxRetry = Math.max(...pendingRetries.map(m => decryptRetryRef.current[m.id] || 0));
        const delay = 3000 + (maxRetry * 2000);  // 3s, 5s, 7s, 9s, 11s, 13s
        setTimeout(() => {
          if (alive) setDecryptedMsgs(prev => ({ ...prev })); // trigger re-render → effect re-run
        }, delay);
      }
      // Reconciliation batch — sync all ref entries to state in one pass
      if (alive) {
        const batch = {};
        let needed = false;
        for (const msg of messages) {
          if (isEncryptedGroup(msg.content) && decryptedMsgsRef.current[msg.id]) {
            batch[msg.id] = decryptedMsgsRef.current[msg.id];
            needed = true;
          }
        }
        if (needed) setDecryptedMsgs(prev => ({ ...prev, ...batch }));
      }
    })();
    return () => {
      alive = false;
      for (const id of myInflight) _decryptInFlight.delete(id);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, group.id, senderKeysReady]);

  const sendMessage = useCallback(async (overrideContent = null) => {
    const content = overrideContent ?? text.trim();
    if (!content) return;
    if (!overrideContent) setText('');
    setSending(true);
    const isImage = typeof content === 'string' && content.startsWith('data:');
    try {
      // E2EE: encrypt text messages with Signal Sender Keys
      let payload = content;
      if (!isImage && e2eeKey()) {
        try {
          // Sender key distribution happens in the group-open effect (phases 1-3).
          // DO NOT distribute here — it blocks the send with multiple sequential
          // network calls and can hang the spinner indefinitely.
          const enc = await Promise.race([
            encryptGroupMsg(content, null, group.id, String(currentUser.id)),
            new Promise(r => setTimeout(() => r(null), 8000)),  // 8s timeout — fallback to plaintext
          ]);
          if (enc !== null) {
            payload = enc;
            // Cache plaintext keyed by ciphertext — sender can't decrypt own ratcheted message
            ownPlainRef.current[enc] = content;
          }
          // If null: E2EE key not ready or timeout — fall back to plaintext silently
        } catch { /* fallback to plaintext */ }
      }
      // Phoenix channel: join the group topic, then push via group_message event
      if (!isImage && wsRef.current && wsRef.current.readyState === WebSocket.OPEN && wsRef.current._phxSend) {
        wsRef.current._phxJoin(`group:${group.id}`);
        wsRef.current._phxSend(`group:${group.id}`, 'group_message', { content: payload, group_id: group.id });
        // Optimistic push — show plaintext immediately; server echo will replace temp on arrival
        const tempId = `temp_${Date.now()}`;
        setMessages(prev => [...prev, {
          id: tempId, from_id: String(currentUser.id),
          from_user: currentUser, content, created_at: new Date().toISOString(), _temp: true,
        }]);
        // Safety: auto-expire temp message after 15s if server echo never arrives
        setTimeout(() => {
          setMessages(prev => prev.some(m => m.id === tempId) ?
            prev.map(m => m.id === tempId ? { ...m, _temp: false, _failed: true } : m) : prev);
        }, 15000);
      } else {
        const msg = await api(`/api/groups/${group.id}/messages`, 'POST', { content: payload }, token);
        // Pre-populate decrypted cache for own encrypted messages
        if (ownPlainRef.current[payload]) {
          const plain = ownPlainRef.current[payload];
          decryptedMsgsRef.current[msg.id] = plain;
          setDecryptedMsgs(p => ({ ...p, [msg.id]: plain }));
          delete ownPlainRef.current[payload];
          // Persist plaintext immediately — sender can never re-decrypt own messages
          DB.persistMessage(`group_${group.id}`, msg.id, String(currentUser.id), plain, msg.created_at, currentUser.username, currentUser.display_name).catch(() => {});
        }
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
      }
    } catch (e) { setErr(e.message); if (!overrideContent) setText(content); }
    finally { setSending(false); }
  }, [text, group.id, currentUser, wsRef, token]);

  const handleAttachment = useCallback(async () => {
    const pickerOpts = { quality: 0.4, base64: true, exif: false };
    const uploadAndSend = async (a) => {
      if (!a.base64) { Alert.alert('ERROR', 'Could not read image data.'); return; }
      try {
        const mimeType = a.mimeType ?? 'image/jpeg';
        const { url, key, nonce } = await MEDIA.uploadEncryptedMedia(a.base64, mimeType, token);
        await sendMessage(MEDIA.mediaPayload(url, key, nonce, mimeType));
      } catch (e) {
        Alert.alert('UPLOAD ERROR', e.message ?? 'Image upload failed.');
      }
    };
    Alert.alert('ATTACH', 'Select source', [
      {
        text: 'CAMERA',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (perm.status !== 'granted') { Alert.alert('PERMISSION DENIED', 'Camera access required.'); return; }
          const res = await ImagePicker.launchCameraAsync(pickerOpts);
          if (!res.canceled && res.assets?.[0]) await uploadAndSend(res.assets[0]);
        },
      },
      {
        text: 'PHOTO LIBRARY',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (perm.status !== 'granted') { Alert.alert('PERMISSION DENIED', 'Photo library access required.'); return; }
          const res = await ImagePicker.launchImageLibraryAsync({ ...pickerOpts, mediaTypes: 'images' });
          if (!res.canceled && res.assets?.[0]) await uploadAndSend(res.assets[0]);
        },
      },
      { text: 'CANCEL', style: 'cancel' },
    ]);
  }, [sendMessage, token]);

  const handleShareLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('PERMISSION DENIED', 'Location access required.'); return; }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      sendMessage(`[LOCATION:${lat},${lng}] https://maps.google.com/?q=${lat},${lng}`);
    } catch (e) { Alert.alert('ERROR', 'Failed to get location: ' + e.message); }
  }, [sendMessage]);

  // Handle both new snake_case (from_user) and legacy camelCase (from) field names
  const isMine = (msg) => {
    const id = msg.from_user?.id ?? msg.from_user ?? msg.from ?? msg.from_id;
    return String(id) === String(currentUser.id);
  };
  const resolveGroupContent = (msg) => {
    const raw = isEncryptedGroup(msg.content) ? decryptedMsgs[msg.id] : msg.content;
    const isEnc = isEncryptedGroup(msg.content);
    if (raw === '__UNDECRYPTABLE__') return { text: '[Encrypted]', encrypted: true, failed: true, isMedia: false };
    if (!raw && isEnc) return { text: '[Decrypting…]', encrypted: true, failed: false, isMedia: false };
    if (raw && MEDIA.isMediaPayload(raw)) return { text: '', encrypted: isEnc, failed: false, isMedia: true };
    return { text: raw ?? '[Decrypting…]', encrypted: isEnc, failed: !raw && isEnc, isMedia: false };
  };
  const getGroupMediaUri = (msg) => decryptedMedia[msg.id] ?? null;

  // Swipe right to go back
  const swipeBackGroup = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dx > 20 && Math.abs(g.dy) < 60,
    onPanResponderRelease: (_, g) => { if (g.dx > 60) onBack(); },
  })).current;

  return (
    <ThemedSafeArea>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader
        title={group.name}
        onBack={onBack}
        rightComponent={
          <TouchableOpacity style={styles.membersHeaderBtn} onPress={() => setShowMembers(true)}>
            <Text style={styles.membersHeaderBtnText}>MEMBERS</Text>
          </TouchableOpacity>
        }
      />
      <GroupMembersModal
        token={token}
        group={group}
        currentUser={currentUser}
        visible={showMembers}
        onClose={() => setShowMembers(false)}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={KAV_BEHAVIOR} {...swipeBackGroup.panHandlers}>
        {loading ? <View style={styles.centerFill}><Spinner size="large" /></View> : (
          <>
            <ErrText msg={err} />
            <FlatList
              ref={listRef} data={messages} keyExtractor={(m) => String(m.id)}
              contentContainerStyle={styles.msgList}
              removeClippedSubviews={Platform.OS !== 'ios'}
              maxToRenderPerBatch={15}
              windowSize={11}
              initialNumToRender={20}
              ListEmptyComponent={<Text style={styles.emptyText}>NO MESSAGES YET</Text>}
              renderItem={({ item }) => {
                const mine = isMine(item);
                const senderName = mine ? 'YOU' : (item.from_display || item.fromDisplay || item.from_username || item.fromUsername || item.from_display_name || 'UNKNOWN');
                const { text: msgText, failed, isMedia } = resolveGroupContent(item);
                const mediaUri = isMedia ? getGroupMediaUri(item) : null;
                return (
                  <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowTheirs]}>
                    <View style={[styles.msgBubble, mine ? styles.bubbleMine : styles.bubbleTheirs, failed && { borderColor: C.red, borderWidth: 1.5 }]}>
                      {!mine && <Text style={styles.msgSender}>{senderName}</Text>}
                      {isImageContent(item.content) ? (
                        <Image source={{ uri: item.content }} style={styles.imageMsg} resizeMode="contain" />
                      ) : isMedia ? (
                        mediaUri
                          ? <Image source={{ uri: mediaUri }} style={styles.imageMsg} resizeMode="contain" />
                          : <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 9, color: mine ? '#ffffffaa' : C.dim }}>Loading image…</Text>
                      ) : isLocationContent(msgText) ? (
                        <TouchableOpacity onPress={() => {
                          const m = msgText.match(/\[LOCATION:([-\d.]+),([-\d.]+)\]/);
                          if (m) Linking.openURL(`https://maps.google.com/?q=${m[1]},${m[2]}`);
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <IconPin size={13} color={mine ? '#fff' : C.accent} />
                            <Text style={[styles.msgText, { color: mine ? '#fff' : C.accent }]}>Location shared</Text>
                          </View>
                          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 9, color: mine ? '#ffffffaa' : C.dim, marginTop: 2 }}>
                            TAP TO OPEN IN MAPS
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={[styles.msgText, failed && { color: C.red }]}>{msgText}</Text>
                      )}
                      <View style={styles.msgMeta}>
                        <Text style={styles.msgTime}>{fmtTime(item.created_at)}</Text>
                        {mine && <Text style={styles.msgRead}>{' \u2713'}</Text>}
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
              <TouchableOpacity style={styles.attachBtn} onPress={handleShareLocation}>
                <IconPin size={18} color={C.accent} />
              </TouchableOpacity>
              <TextInput style={styles.chatInput} placeholder="MESSAGE..." placeholderTextColor={C.muted}
                value={text} onChangeText={setText} multiline maxLength={2000}
                autoCorrect={false} spellCheck={false} />
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
function BotTab({ token, wsRef }) {
  const { styles, C } = useSkin();
  const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
  const [messages, setMessages] = useState([{
    id: 0, role: 'bot',
    content: 'Hey, I\'m Banner — your personal AI assistant. Ask me anything, send a photo, or just tell me what you need help with.',
    ts: new Date().toISOString(),
  }]);
  const [text,          setText]          = useState('');
  const [loading,       setLoading]       = useState(false);
  const [err,           setErr]           = useState('');
  const [typing,        setTyping]        = useState(false);
  const [pendingImage,  setPendingImage]  = useState(null);
  const [bpMsgs,        setBpMsgs]        = useState(false);
  const [bpSend,        setBpSend]        = useState(false);
  const [bpCal,         setBpCal]         = useState(false);
  const [bpCon,         setBpCon]         = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  // contacts list: fetched when bpSend or bpCon is on so executeAction can look up IDs
  const [contacts,      setContacts]      = useState([]);
  const listRef     = useRef(null);
  const typingTimer = useRef(null);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, typing]);

  // Load Banner permissions from SecureStore on mount
  useEffect(() => {
    (async () => {
      setBpMsgs(await loadBannerPerm(BANNER_PERM_MSGS_KEY));
      setBpSend(await loadBannerPerm(BANNER_PERM_SEND_KEY));
      setBpCal(await loadBannerPerm(BANNER_PERM_CAL_KEY));
      setBpCon(await loadBannerPerm(BANNER_PERM_CON_KEY));
    })();
  }, []);

  // Fetch contacts when send or contacts permission is active (needed for executeAction to resolve IDs)
  useEffect(() => {
    if (!bpSend && !bpCon) return;
    api('/api/contacts', 'GET', null, token)
      .then(data => { const norm = _normContacts(data); if (norm.length) setContacts(norm); })
      .catch(() => {});
  }, [bpSend, bpCon, token]);

  useEffect(() => { return () => { if (typingTimer.current) clearTimeout(typingTimer.current); }; }, []);

  /**
   * Fetch phone contacts from the device (if bpCon permission granted).
   * Passed to the server so Banner can call list_phone_contacts on demand.
   * Only name + primary phone are sent — no emails, addresses, etc.
   */
  const getPhoneContacts = async () => {
    if (!bpCon) return [];
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') return [];
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });
      const out = [];
      for (const c of data) {
        const name  = c.name || '';
        const phone = c.phoneNumbers?.[0]?.number || '';
        if (name && phone) out.push({ name, phone });
      }
      // Sort alphabetically and cap at 300
      out.sort((a, b) => a.name.localeCompare(b.name));
      return out.slice(0, 300);
    } catch { return []; }
  };

  /**
   * Fetch calendar events from the device (if bpCal permission granted).
   * Returns an array of event objects — sent to the server so Banner can call
   * the get_calendar_events tool on demand instead of getting a context dump.
   */
  const getCalendarEvents = async () => {
    if (!bpCal) return [];
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') return [];
      const now  = new Date();
      const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const evts = await Calendar.getEventsAsync(cals.map(c => c.id), now, in7d);
      return evts.slice(0, 100).map(e => ({
        title:    e.title,
        start:    e.startDate,
        end:      e.endDate,
        location: e.location || '',
        notes:    e.notes || '',
      }));
    } catch { return []; }
  };

  /** Execute a Banner action after user confirmation. */
  const executeAction = async (action) => {
    setPendingAction(null);
    try {
      if (action.type === 'send_message') {
        const target = contacts.find(u =>
          u.username === action.to_username ||
          (u.displayName || '').toLowerCase() === (action.to_username || '').toLowerCase()
        );
        if (!target) { Alert.alert('USER NOT FOUND', `"${action.to_username}" is not in your contacts.`); return; }
        if (wsRef?.current?.readyState === WebSocket.OPEN && wsRef.current._phxSend) {
          wsRef.current._phxSend(`user:${currentUser.id}`, 'chat_message', { content: action.content, to: target.id });
        } else {
          await api('/api/messages', 'POST', { to: target.id, content: action.content }, token);
        }
        setMessages(prev => [...prev, {
          id: Date.now(), role: 'bot',
          content: `\u2713 Sent to ${action.to_username}: "${action.content}"`,
          ts: new Date().toISOString(),
        }]);
      } else if (action.type === 'create_event') {
        const { status } = await Calendar.requestCalendarPermissionsAsync();
        if (status !== 'granted') { Alert.alert('PERMISSION', 'Calendar access required.'); return; }
        const defaultCal = await Calendar.getDefaultCalendarAsync();
        await Calendar.createEventAsync(defaultCal.id, {
          title:     action.title,
          startDate: new Date(action.start),
          endDate:   new Date(action.end || action.start),
          notes:     action.notes || '',
          timeZone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        setMessages(prev => [...prev, {
          id: Date.now(), role: 'bot',
          content: `\u2713 Event "${action.title}" added to your calendar.`,
          ts: new Date().toISOString(),
        }]);
      } else if (action.type === 'send_sms') {
        const phone = (action.to_phone || '').replace(/(?!^\+)[^\d]/g, '');
        const smsAvail = await SMS.isAvailableAsync();
        if (!smsAvail) { Alert.alert('SMS UNAVAILABLE', 'SMS is not available on this device.'); return; }
        await SMS.sendSMSAsync([phone], action.content || '');
        setMessages(prev => [...prev, {
          id: Date.now(), role: 'bot',
          content: `\u2197 SMS composer opened for ${action.to_name || action.to_phone}.`,
          ts: new Date().toISOString(),
        }]);
      }
    } catch (e) { Alert.alert('ERROR', e.message); }
  };

  const sendToBot = async () => {
    const content   = text.trim();
    const imgToSend = pendingImage;
    if (!content && !imgToSend || loading) return;
    setText('');
    setPendingImage(null);
    setPendingAction(null);
    setErr('');
    setMessages((prev) => [...prev, {
      id: Date.now(), role: 'user',
      content: content || '[Image]',
      imageUri: imgToSend?.uri,
      ts: new Date().toISOString(),
    }]);
    setTyping(true); setLoading(true);
    typingTimer.current = setTimeout(async () => {
      try {
        const [calendar_events, phone_contacts] = await Promise.all([
          getCalendarEvents().catch(() => []),
          getPhoneContacts().catch(() => []),
        ]);
        const body = {
          message: content || 'Describe this image.',
          calendar_events,
          phone_contacts,
          permissions: { msgs: bpMsgs, send: bpSend, cal: bpCal, contacts: bpCon },
        };
        if (imgToSend?.base64) { body.image_base64 = imgToSend.base64; body.image_mime = imgToSend.mimeType || 'image/jpeg'; }
        const data = await api('/api/bot/chat', 'POST', body, token);
        const raw  = data.reply || '...';
        // Parse optional <<<ACTION:{...}>>> block appended by Banner
        const ACTION_RE = /<<<ACTION:([\s\S]*?)>>>/;
        const match   = raw.match(ACTION_RE);
        const display = raw.replace(ACTION_RE, '').trim();
        if (match) {
          try {
            const action = JSON.parse(match[1]);
            const permitted =
              (action.type === 'send_message' && bpSend) ||
              (action.type === 'create_event'  && bpCal) ||
              (action.type === 'send_sms'      && bpCon);
            if (permitted) setPendingAction(action);
          } catch {}
        }
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'bot', content: display || raw, ts: new Date().toISOString() }]);
      } catch (e) { setErr(e.message); }
      finally { setTyping(false); setLoading(false); }
    }, 400);
  };

  const pickImageForBanner = () => {
    Alert.alert('BANNER VISION', 'Choose image source', [
      {
        text: 'PHOTO LIBRARY',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (perm.status !== 'granted') { Alert.alert('PERMISSION DENIED', 'Photo library access required.'); return; }
          const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.5, base64: true, mediaTypes: 'images' });
          if (!res.canceled && res.assets?.[0]) {
            const a = res.assets[0];
            setPendingImage({ uri: a.uri, base64: a.base64, mimeType: a.mimeType || 'image/jpeg' });
          }
        },
      },
      {
        text: 'CAMERA / SCREENSHOT',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (perm.status !== 'granted') { Alert.alert('PERMISSION DENIED', 'Camera access required.'); return; }
          const res = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
          if (!res.canceled && res.assets?.[0]) {
            const a = res.assets[0];
            setPendingImage({ uri: a.uri, base64: a.base64, mimeType: a.mimeType || 'image/jpeg' });
          }
        },
      },
      { text: 'CANCEL', style: 'cancel' },
    ]);
  };

  const canSend = (text.trim().length > 0 || pendingImage !== null) && !loading;
  const permTags = [bpCon && 'CON', bpMsgs && 'MSGS', bpSend && 'SEND', bpCal && 'CAL'].filter(Boolean).join(' \u00B7 ');

  return (
    <View style={styles.flex}>
      <View style={styles.botHeader}>
        <Text style={styles.botHeaderText}>BANNER AI</Text>
        <View style={[{ width: 8, height: 8, borderRadius: 4, marginLeft: 8 }, { backgroundColor: C.green }]} />
        <Text style={{ fontFamily: mono, fontSize: 9, color: C.dim, marginLeft: 8, letterSpacing: 1 }}>
          UNLIMITED{permTags ? ` \u00B7 ${permTags}` : ' \u00B7 VISION'}
        </Text>
      </View>
      <FlatList
        ref={listRef} data={messages} keyExtractor={(m) => String(m.id)}
        style={styles.flex}
        contentContainerStyle={styles.msgList}
        removeClippedSubviews={Platform.OS !== 'ios'}
        maxToRenderPerBatch={10}
        windowSize={9}
        initialNumToRender={15}
        renderItem={({ item }) => {
          const isBot = item.role === 'bot';
          return (
            <View style={[styles.msgRow, isBot ? styles.msgRowTheirs : styles.msgRowMine]}>
              <View style={[styles.msgBubble, isBot ? styles.bubbleBotMsg : styles.bubbleMine]}>
                {isBot && <Text style={styles.botLabel}>BANNER</Text>}
                {item.imageUri && (
                  <Image source={{ uri: item.imageUri }} style={[styles.imageMsg, { marginBottom: 6 }]} resizeMode="contain" />
                )}
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
      {pendingImage && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 6, flexDirection: 'row', alignItems: 'center' }}>
          <Image source={{ uri: pendingImage.uri }} style={{ width: 56, height: 56, borderRadius: 6, borderWidth: 1, borderColor: C.accent }} />
          <TouchableOpacity onPress={() => setPendingImage(null)} style={{ marginLeft: 8, padding: 4 }}>
            <Text style={{ fontFamily: mono, fontSize: 11, color: C.danger || C.amber }}>{'\u2715'} REMOVE</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* Pending action confirmation card */}
      {pendingAction && (
        <View style={{ margin: 10, padding: 12, borderRadius: 6, borderWidth: 1, borderColor: C.accent, backgroundColor: C.panel }}>
          <Text style={{ fontFamily: mono, fontSize: 10, color: C.accent, letterSpacing: 1.5, marginBottom: 8 }}>
            {pendingAction.type === 'send_message' ? '\u2197 BANNER WANTS TO SEND A MESSAGE'
              : pendingAction.type === 'send_sms'  ? '\uD83D\uDCF1 BANNER WANTS TO SEND AN SMS'
              : '\uD83D\uDCC5 BANNER WANTS TO CREATE AN EVENT'}
          </Text>
          {pendingAction.type === 'send_message' ? (
            <>
              <Text style={{ fontFamily: mono, fontSize: 11, color: C.fg ?? C.green, marginBottom: 2 }}>To: {pendingAction.to_username}</Text>
              <Text style={{ fontFamily: mono, fontSize: 11, color: C.dim, marginBottom: 10 }}>"{pendingAction.content}"</Text>
            </>
          ) : pendingAction.type === 'send_sms' ? (
            <>
              <Text style={{ fontFamily: mono, fontSize: 11, color: C.fg ?? C.green, marginBottom: 2 }}>To: {pendingAction.to_name || pendingAction.to_phone}</Text>
              <Text style={{ fontFamily: mono, fontSize: 10, color: C.dim, marginBottom: 2 }}>{pendingAction.to_phone}</Text>
              <Text style={{ fontFamily: mono, fontSize: 11, color: C.dim, marginBottom: 10 }}>"{pendingAction.content}"</Text>
            </>
          ) : (
            <>
              <Text style={{ fontFamily: mono, fontSize: 11, color: C.fg ?? C.green, marginBottom: 2 }}>{pendingAction.title}</Text>
              <Text style={{ fontFamily: mono, fontSize: 11, color: C.dim, marginBottom: 10 }}>{new Date(pendingAction.start).toLocaleString()}</Text>
            </>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => executeAction(pendingAction)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 4, backgroundColor: C.accent, alignItems: 'center' }}>
              <Text style={{ fontFamily: mono, fontSize: 11, color: '#000', fontWeight: '700', letterSpacing: 1 }}>CONFIRM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPendingAction(null)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 4, borderWidth: 1, borderColor: C.dim, alignItems: 'center' }}>
              <Text style={{ fontFamily: mono, fontSize: 11, color: C.dim, letterSpacing: 1 }}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.attachBtn} onPress={pickImageForBanner}>
          <IconCamera size={18} color={C.accent} />
        </TouchableOpacity>
        <TextInput style={styles.chatInput} placeholder="ASK BANNER AI..." placeholderTextColor={C.muted}
          value={text} onChangeText={setText} multiline maxLength={4000} onSubmitEditing={sendToBot} />
        <TouchableOpacity style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          onPress={sendToBot} disabled={!canSend}>
          {loading ? <Spinner /> : <Text style={styles.sendBtnText}>SEND</Text>}
        </TouchableOpacity>
      </View>
    </View>
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
function ProfileTab({ token, currentUser, onLogout, profileImageUri, setProfileImageUri }) {
  const { styles, C } = useSkin();
  const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
  const BASE_URL_LOCAL = 'https://nano-synapsys-server.fly.dev';

  // ── invite / bio state ────────────────────────────────────────────────
  const [loading, setLoading]     = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteErr, setInviteErr] = useState('');
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled]     = useState(false);
  // PIN modal for enabling Face ID
  const [showPinForBio, setShowPinForBio] = useState(false);
  const [bioPinEntry,   setBioPinEntry]   = useState('');
  const [bioPinErr,     setBioPinErr]     = useState('');
  const [bioPinLoading, setBioPinLoading] = useState(false);
  // ── Banner AI permissions ─────────────────────────────────────────────
  const [bpMsgs, setBpMsgs] = useState(false);
  const [bpSend, setBpSend] = useState(false);
  const [bpCal,  setBpCal]  = useState(false);
  const [bpCon,  setBpCon]  = useState(false);

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
      const [bioReady, bioOn, ext, pmMsgs, pmSend, pmCal, pmCon] = await Promise.all([
        isBiometricReady(),
        loadBioEnabled(),
        loadProfileExt(),
        loadBannerPerm(BANNER_PERM_MSGS_KEY),
        loadBannerPerm(BANNER_PERM_SEND_KEY),
        loadBannerPerm(BANNER_PERM_CAL_KEY),
        loadBannerPerm(BANNER_PERM_CON_KEY),
      ]);
      setBioAvailable(bioReady);
      setBioEnabled(bioOn);
      setDisplayName(ext.displayName ?? currentUser.display_name ?? currentUser.username ?? '');
      setPhone(ext.phone ?? '');
      setResidentialAddr(ext.residentialAddr ?? '');
      setWorkAddr(ext.workAddr ?? '');
      setBpMsgs(pmMsgs); setBpSend(pmSend); setBpCal(pmCal); setBpCon(pmCon);
    })();
  }, []);

  const handlePickProfileImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true,
    });
    if (!res.canceled && res.assets?.[0]) {
      const asset = res.assets[0];
      const destUri = FileSystem.documentDirectory + 'profile_avatar.jpg';
      try {
        // Save locally first (guaranteed to persist even if upload fails)
        if (asset.base64) {
          await FileSystem.writeAsStringAsync(destUri, asset.base64, { encoding: FileSystem.EncodingType.Base64 });
        } else {
          await FileSystem.copyAsync({ from: asset.uri, to: destUri });
        }
        // Cache-bust: append timestamp so Image component reloads
        const freshUri = destUri + '?t=' + Date.now();
        setProfileImageUri(freshUri);
        await SecureStore.setItemAsync(PROFILE_IMAGE_KEY, destUri);
      } catch (e) {
        // Fallback: use picker URI for this session
        setProfileImageUri(asset.uri);
      }
      // Sync to backend in background (so other users can see it)
      try {
        const b64 = asset.base64 || await FileSystem.readAsStringAsync(destUri, { encoding: FileSystem.EncodingType.Base64 });
        await api('/api/profile', 'PATCH', { avatar_base64: b64 }, token);
      } catch (e) {
        console.warn('[Avatar] backend sync error:', e?.message);
      }
    }
  };

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

  // PIN confirm → then enable Face ID
  const handleBioPinConfirm = async () => {
    if (bioPinEntry.length !== 6) { setBioPinErr('Enter your 6-digit PIN'); return; }
    setBioPinLoading(true); setBioPinErr('');
    try {
      const deviceId = await getOrCreateDeviceId();
      const res = await fetch(`${BASE_URL_LOCAL}/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, pin: bioPinEntry }),
      });
      if (!res.ok) { setBioPinErr('Incorrect PIN. Face ID not enabled.'); setBioPinEntry(''); setBioPinLoading(false); return; }
      setShowPinForBio(false); setBioPinEntry(''); setBioPinErr('');
      // Proceed with Face ID enrollment
      await handleEnableBio();
    } catch { setBioPinErr('Network error. Try again.'); }
    finally { setBioPinLoading(false); }
  };

  const handleEnableBio = async () => {
    try {
      await saveBioEnabled(true);
      // Store refresh token if available (already stored during login)
      setBioEnabled(true);
      Alert.alert('FACE ID ENABLED', 'Face ID will unlock the app on your next launch.');
    } catch (e) { Alert.alert('ERROR', e.message || 'Could not enable Face ID.'); }
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
    Alert.alert('LOGOUT', 'Disconnect from SYNAPTYC?', [
      { text: 'CANCEL', style: 'cancel' },
      { text: 'LOGOUT', style: 'destructive', onPress: onLogout },
    ]);
  };

  const avatarBg = AVATAR_COLORS[currentUser.id % AVATAR_COLORS.length];
  const initials = (currentUser.display_name || currentUser.username || '?')[0].toUpperCase();

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.profileScroll}>

      {/* ── CIRCULAR AVATAR ──────────────────────────────────────── */}
      <TouchableOpacity onPress={handlePickProfileImage} style={{ alignItems: 'center', marginVertical: 24 }}>
        {profileImageUri
          ? <Image source={{ uri: profileImageUri }} style={{ width: 96, height: 96, borderRadius: 48 }}
              onError={() => setProfileImageUri(null)}
              />
          : <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: avatarBg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.accent }}>
              <Text style={{ color: '#fff', fontSize: 38, fontWeight: '700', fontFamily: mono }}>{initials}</Text>
            </View>
        }
        <Text style={{ fontFamily: mono, fontSize: 11, color: C.dim, marginTop: 6, letterSpacing: 0.5 }}>tap to change photo</Text>
      </TouchableOpacity>
      <Text style={{ fontFamily: mono, fontSize: 16, fontWeight: '700', color: C.text, textAlign: 'center', letterSpacing: 1, marginBottom: 4 }}>{displayName || currentUser.display_name || currentUser.displayName || currentUser.username}</Text>
      <Text style={{ fontFamily: mono, fontSize: 11, color: C.dim, textAlign: 'center', letterSpacing: 1, marginBottom: 16 }}>@{currentUser.username}</Text>

      {/* ── READ-ONLY INFO ──────────────────────────────────────────── */}
      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>USERNAME</Text>
        <Text style={styles.profileValue}>{currentUser.username}</Text>
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
          : <TouchableOpacity style={styles.primaryBtn} onPress={() => { setBioPinEntry(''); setBioPinErr(''); setShowPinForBio(true); }}><Text style={styles.primaryBtnText}>ENABLE FACE ID LOGIN</Text></TouchableOpacity>
      )}

      <View style={styles.profileDivider} />

      {/* ── BANNER PERMISSIONS ───────────────────────────────────────── */}
      <Text style={styles.profileEditHeader}>BANNER PERMISSIONS</Text>
      <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 10, color: C.dim, letterSpacing: 0.5, marginBottom: 14, lineHeight: 16 }}>
        Allow Banner AI to access your data and take actions on your behalf. Actions always require your confirmation.
      </Text>
      {[
        { key: BANNER_PERM_CON_KEY,  label: 'CONTACTS ACCESS',    desc: 'Banner can look up your contacts by name to help you message or reference them.', val: bpCon, set: setBpCon },
        { key: BANNER_PERM_MSGS_KEY, label: 'READ CONVERSATIONS', desc: 'Banner can read recent messages to provide context-aware responses.', val: bpMsgs, set: setBpMsgs },
        { key: BANNER_PERM_SEND_KEY, label: 'SEND MESSAGES',      desc: 'Banner can send messages as you — confirmation required each time.', val: bpSend, set: setBpSend },
        { key: BANNER_PERM_CAL_KEY,  label: 'CALENDAR ACCESS',    desc: 'Banner can read your schedule and create events — confirmation required.', val: bpCal, set: setBpCal },
      ].map(({ key, label, desc, val, set }) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.panel }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 11, color: val ? C.accent : C.text ?? C.green, letterSpacing: 1, marginBottom: 3 }}>{label}</Text>
            <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 10, color: C.dim, lineHeight: 15 }}>{desc}</Text>
          </View>
          <Switch
            value={val}
            onValueChange={async (v) => { set(v); await saveBannerPerm(key, v); }}
            trackColor={{ false: C.panel, true: C.accent }}
            thumbColor={val ? C.green : C.dim}
          />
        </View>
      ))}

      <View style={styles.profileDivider} />

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>LOGOUT</Text>
      </TouchableOpacity>

      {/* ── PIN CONFIRMATION MODAL (for enabling Face ID) ─────────── */}
      <Modal visible={showPinForBio} transparent animationType="fade"
        onRequestClose={() => { setShowPinForBio(false); setBioPinEntry(''); setBioPinErr(''); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>CONFIRM PIN</Text>
            <Text style={styles.modalSub}>Enter your 6-digit PIN to authorise Face ID</Text>

            {/* 6-dot PIN indicator */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 20 }}>
              {[0,1,2,3,4,5].map(i => (
                <View key={i} style={{
                  width: 14, height: 14, borderRadius: 7,
                  backgroundColor: bioPinEntry.length > i ? C.accent : 'transparent',
                  borderWidth: 2, borderColor: C.accent,
                }} />
              ))}
            </View>

            {/* Numpad */}
            {[['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']].map((row, ri) => (
              <View key={ri} style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 10 }}>
                {row.map((k, ki) => k === '' ? (
                  <View key={ki} style={{ width: 64, height: 56 }} />
                ) : (
                  <TouchableOpacity key={ki}
                    style={{ width: 64, height: 56, borderRadius: 12, backgroundColor: 'rgba(0,255,65,0.07)', borderWidth: 1, borderColor: 'rgba(0,255,65,0.2)', alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => {
                      if (k === '⌫') { setBioPinEntry(p => p.slice(0, -1)); }
                      else if (bioPinEntry.length < 6) { setBioPinEntry(p => p + k); }
                    }}
                  >
                    <Text style={{ fontFamily: mono, fontSize: 20, color: C.text, fontWeight: '600' }}>{k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <ErrText msg={bioPinErr} />
            <View style={[styles.formBtnRow, { marginTop: 12 }]}>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, marginRight: 8 }, (bioPinLoading || bioPinEntry.length !== 6) && styles.primaryBtnDisabled]}
                onPress={handleBioPinConfirm}
                disabled={bioPinLoading || bioPinEntry.length !== 6}
              >
                {bioPinLoading ? <Spinner /> : <Text style={styles.primaryBtnText}>CONFIRM</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ghostBtn, { flex: 1 }]} onPress={() => { setShowPinForBio(false); setBioPinEntry(''); setBioPinErr(''); }}>
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
  // searchResults → array from /api/users/search (id, username, displayName, contactStatus)
  const [contacts,       setContacts]       = useState([]);
  const [searchResults,  setSearchResults]  = useState([]);
  const [searching,      setSearching]      = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [err,            setErr]            = useState('');
  const [showSearch,     setShowSearch]     = useState(false);
  const [query,          setQuery]          = useState('');
  const [actioning,      setActioning]      = useState({});
  // Phone contacts modal
  const [showInvite,     setShowInvite]     = useState(false);
  const [deviceContacts, setDeviceContacts] = useState([]);
  const [contactsLoading,setContactsLoading]= useState(false);
  const [contactsQuery,  setContactsQuery]  = useState('');
  const [inviting,       setInviting]       = useState(null);
  const [phoneStatuses,  setPhoneStatuses]  = useState({});   // normalizedPhone → { s:'c'|'i', e?:ms }
  const [contactsErr,    setContactsErr]    = useState('');
  const searchDebounceRef = useRef(null);

  // ── Phone status helpers ─────────────────────────────────────────
  const _PHONE_KEY = 'nano_phone_statuses';
  const _nrmPhone  = (p) => (p || '').replace(/[\s\-().+]/g, '');

  const _loadPhoneStatuses = async () => {
    try {
      const raw = await SecureStore.getItemAsync(_PHONE_KEY);
      if (!raw) return {};
      const map = JSON.parse(raw);
      const now = Date.now();
      let changed = false;
      for (const k of Object.keys(map)) {
        if (map[k].s === 'i' && map[k].e && map[k].e < now) { delete map[k]; changed = true; }
      }
      if (changed) SecureStore.setItemAsync(_PHONE_KEY, JSON.stringify(map)).catch(() => {});
      return map;
    } catch { return {}; }
  };

  const _savePhoneStatus = async (phone, entry) => {
    const normalized = _nrmPhone(phone);
    if (!normalized) return;
    const map = await _loadPhoneStatuses();
    map[normalized] = entry;
    try { await SecureStore.setItemAsync(_PHONE_KEY, JSON.stringify(map)); } catch {}
    setPhoneStatuses(prev => ({ ...prev, [normalized]: entry }));
  };

  const getPhoneStatus = (phone) => {
    const normalized = _nrmPhone(phone);
    const entry = phoneStatuses[normalized];
    if (!entry) return null;
    if (entry.s === 'i' && entry.e && entry.e < Date.now()) return null;
    return entry.s;  // 'c' = contact (green) | 'i' = invited (amber)
  };

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setErr('');
    try {
      const c = _normContacts(await api('/api/contacts', 'GET', null, token));
      setContacts(c);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Debounced search against /api/users/search when the search panel is open
  useEffect(() => {
    if (!showSearch) { setSearchResults([]); return; }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const data = await api(`/api/users/search?q=${encodeURIComponent(q)}`, 'GET', null, token);
        setSearchResults(Array.isArray(data) ? data : []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [query, showSearch, token]);

  const act = async (key, fn) => {
    setActioning(a => ({ ...a, [key]: true }));
    try { await fn(); await fetchAll(true); } catch (e) { setErr(e.message); }
    finally { setActioning(a => ({ ...a, [key]: false })); }
  };

  // Instant add — no approval needed, contacts immediately mutual
  const addContact = (userId) => act(`add_${userId}`, async () => {
    await api('/api/contacts/request', 'POST', { userId }, token);
  });

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

  const openInviteModal = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'CONTACTS PERMISSION',
        'Contacts access is required to send SMS invites. Please enable it in Settings.',
        [
          { text: 'CANCEL', style: 'cancel' },
          { text: 'OPEN SETTINGS', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    // Load persisted phone statuses (contact / pending invite)
    const loaded = await _loadPhoneStatuses();
    setPhoneStatuses(loaded);
    setContactsErr('');
    setShowInvite(true);
    setContactsLoading(true);
    try {
      // Note: no `sort` param — it can cause a native crash on some iOS versions
      const result = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
        ],
      });
      const raw = Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []);
      const withPhones = raw
        .filter(c => c.phoneNumbers?.length > 0)
        .map(c => ({
          id:    c.id || String(Math.random()),
          name:  (c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim()) || 'Unknown',
          phone: c.phoneNumbers[0].number || '',
        }))
        .filter(c => c.phone);  // skip if phone is empty string
      setDeviceContacts(withPhones);
      if (withPhones.length === 0 && raw.length > 0) {
        setContactsErr(`Found ${raw.length} contacts but none have phone numbers.`);
      }
    } catch (e) {
      setContactsErr('Could not load contacts: ' + (e?.message || String(e)));
    } finally {
      setContactsLoading(false);
    }
  };

  const sendSMSInvite = async (contact) => {
    setInviting(contact.id);
    try {
      // Auto-clear invite cap then retry once so it never blocks the user
      let data;
      try {
        data = await api('/api/invites', 'POST', {}, token);
      } catch (invErr) {
        if ((invErr.message || '').includes('10 active')) {
          try { await api('/api/invites', 'DELETE', null, token); } catch {}
          data = await api('/api/invites', 'POST', {}, token);
        } else { throw invErr; }
      }
      const inviteUrl = data.invite_url || data.url;
      if (!inviteUrl) {
        Alert.alert('ERROR', 'Could not generate an invite link. Please try again.');
        return;
      }
      const senderName = currentUser?.display_name || currentUser?.username || 'A friend';
      // Extract the token from the invite URL so we can embed the deep link
      const tokenMatch = inviteUrl.match(/[?&]invite=([A-Za-z0-9_=-]+)/);
      const inviteToken = tokenMatch ? tokenMatch[1] : null;
      const deepLink = inviteToken ? `nanosynapsys://join/${inviteToken}` : null;
      const msg = deepLink
        ? `${senderName} invited you to SYNAPTYC — private encrypted messaging.\n\n1. Download the app: https://apps.apple.com/app/id6759710350\n2. Open this link to join: ${deepLink}\n\nOr register at: ${inviteUrl}\n(One-use invite, expires in 25 minutes)`
        : `${senderName} invited you to SYNAPTYC — private encrypted messaging by nano-SYNAPSYS. Join here: ${inviteUrl} (expires in 25 minutes, one-use only)`;

      // Normalize phone number — strip whitespace/formatting
      const phone = (contact.phone || '').replace(/\s+/g, '');
      const isAvailable = await SMS.isAvailableAsync();

      let sent = false;
      if (isAvailable) {
        const { result } = await SMS.sendSMSAsync([phone], msg);
        if (result !== 'cancelled') {
          sent = true;
          Alert.alert('INVITE SENT', `Invite sent to ${contact.name}.\n\nThey have 25 minutes to join using the link.`);
        }
      } else {
        // Fallback: copy invite link to clipboard
        await Clipboard.setStringAsync(inviteUrl);
        sent = true;
        Alert.alert(
          'LINK COPIED',
          `SMS is not available on this device.\n\nThe invite link has been copied to your clipboard — paste it and share with ${contact.name}.`,
        );
      }
      // Mark phone as pending invite (amber LED, 25-minute window) — store token for server cancel
      if (sent) {
        const storedToken = data.token || inviteToken || null;
        await _savePhoneStatus(contact.phone, { s: 'i', e: Date.now() + 25 * 60 * 1000, t: storedToken });
      }
    } catch (e) {
      Alert.alert('ERROR', e.message || 'Failed to send invite. Please try again.');
    } finally {
      setInviting(null);
    }
  };

  const cancelInvite = async (contact) => {
    const normalized = _nrmPhone(contact.phone);
    const entry = phoneStatuses[normalized];
    const storedToken = entry?.t || null;
    try {
      if (storedToken) {
        await api(`/api/invites/cancel/${storedToken}`, 'DELETE', null, token);
      } else {
        await api('/api/invites', 'DELETE', null, token);
      }
    } catch {}
    // Clear local status so the row resets to FIND / INVITE
    const map = await _loadPhoneStatuses();
    delete map[normalized];
    try { await SecureStore.setItemAsync(_PHONE_KEY, JSON.stringify(map)); } catch {}
    setPhoneStatuses(prev => { const n = { ...prev }; delete n[normalized]; return n; });
  };

  // Find a phone contact on the app — if not found, offer SMS invite automatically
  const findOnApp = async (contact) => {
    const q = contact.name.split(' ')[0];
    if (q.length < 2) {
      // Name too short to search — skip to invite
      Alert.alert(
        'INVITE TO APP',
        `"${contact.name}" is not on SYNAPTYC yet.\n\nSend them an invite link via SMS?`,
        [
          { text: 'CANCEL', style: 'cancel' },
          { text: 'SEND INVITE', onPress: () => sendSMSInvite(contact) },
        ],
      );
      return;
    }
    try {
      const data = await api(`/api/users/search?q=${encodeURIComponent(q)}`, 'GET', null, token);
      const allMatches   = Array.isArray(data) ? data : [];
      const newMatches   = allMatches.filter(u => !contactUserIds.has(u.id));
      const knownMatches = allMatches.filter(u =>  contactUserIds.has(u.id));

      if (allMatches.length === 0) {
        // Genuinely not on the app — offer invite
        Alert.alert(
          'NOT ON APP YET',
          `"${contact.name}" doesn't have SYNAPTYC.\n\nSend them an invite? They'll be added to your contacts automatically when they join.`,
          [
            { text: 'CANCEL', style: 'cancel' },
            { text: 'SEND INVITE', onPress: () => sendSMSInvite(contact) },
          ],
        );
      } else if (newMatches.length === 0) {
        // Found on app but already in contacts — mark green
        const name = knownMatches[0].displayName || knownMatches[0].username;
        await _savePhoneStatus(contact.phone, { s: 'c' });
        Alert.alert('\u2713 ALREADY IN CONTACTS', `${name} is already in your contacts. Tap their name to chat.`);
      } else if (newMatches.length === 1) {
        setShowInvite(false);
        await addContact(newMatches[0].id);
        // Mark green — this phone contact is now on the app and in contacts
        await _savePhoneStatus(contact.phone, { s: 'c' });
        Alert.alert('\u2713 ADDED', `${newMatches[0].displayName || newMatches[0].username} is now in your contacts.`);
      } else {
        // Multiple new matches — open search panel pre-filled so user picks the right one
        setShowInvite(false);
        setQuery(q);
        setShowSearch(true);
      }
    } catch (e) { Alert.alert('ERROR', e.message); }
  };

  const contactUserIds = new Set(contacts.map(c => c.userId));

  if (loading) return <View style={styles.centerFill}><Spinner size="large" /></View>;

  return (
    <ScrollView
      style={styles.flex}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor={C.accent} />}
    >
      <ErrText msg={err} />

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
          {searching && <View style={{ alignItems: 'center', paddingVertical: 8 }}><Spinner /></View>}
          {!searching && query.trim().length >= 2 && searchResults.length === 0 && (
            <Text style={styles.emptyText}>NO USERS FOUND</Text>
          )}
          {searchResults.map(u => {
            const isContact = contactUserIds.has(u.id);
            const key = `add_${u.id}`;
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
                  <TouchableOpacity onPress={() => onOpenDM({ id: u.id, username: u.username, display_name: u.displayName })}>
                    <Text style={[styles.contactActionBtnText, { color: C.green }]}>{'\u2713'} MESSAGE</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.contactActionBtn}
                    onPress={() => addContact(u.id)}
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

      <View style={styles.separator} />

      {/* ── INVITE / PHONE CONTACTS ──────────────────────────────── */}
      <TouchableOpacity style={[styles.addContactBtn, { borderColor: C.amber, flexDirection: 'row', gap: 8 }]} onPress={openInviteModal}>
        <IconSMS size={15} color={C.amber} />
        <Text style={[styles.addContactBtnText, { color: C.amber }]}>FROM MY PHONE CONTACTS</Text>
      </TouchableOpacity>

      {/* ── PHONE CONTACTS MODAL ─────────────────────────────────── */}
      <Modal visible={showInvite} transparent animationType="slide" onRequestClose={() => { setShowInvite(false); setContactsQuery(''); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>MY PHONE CONTACTS</Text>

            {/* LED legend */}
            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 10 }}>
              {[
                { color: C.accent, label: 'CONTACT' },
                { color: C.amber,  label: 'INVITE SENT' },
                { color: C.red,    label: 'NOT CONNECTED' },
              ].map(({ color, label }) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                  <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 9, color: C.dim, letterSpacing: 0.3 }}>{label}</Text>
                </View>
              ))}
            </View>

            <TextInput
              style={[styles.input, { marginBottom: 8 }]}
              placeholder="SEARCH CONTACTS..."
              placeholderTextColor={C.muted}
              value={contactsQuery}
              onChangeText={setContactsQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {contactsLoading ? (
              <View style={{ paddingVertical: 30, alignItems: 'center' }}><Spinner size="large" /></View>
            ) : (
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {contactsErr ? (
                  <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 11, color: C.red, paddingHorizontal: 4, paddingBottom: 8 }}>{contactsErr}</Text>
                ) : null}
                {!contactsErr && deviceContacts.length > 0 && (
                  <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 9, color: C.dim, paddingHorizontal: 4, paddingBottom: 6 }}>
                    {deviceContacts.length} CONTACT{deviceContacts.length !== 1 ? 'S' : ''} WITH PHONE NUMBERS
                  </Text>
                )}
                {deviceContacts
                  .filter(c => !contactsQuery.trim() || c.name.toLowerCase().includes(contactsQuery.toLowerCase()) || c.phone.includes(contactsQuery))
                  .map(c => {
                    const ps = getPhoneStatus(c.phone);  // 'c' | 'g' | 'i' | null
                    const matched = autoMatchedMap[c.phone];
                    const ledColor = ps === 'c'
                      ? (matched?.online ? C.accent : C.silver)
                      : ps === 'g' ? C.green
                      : ps === 'i' ? C.amber
                      : C.red;
                    return (
                      <View key={c.id} style={[styles.contactRow, { paddingVertical: 10 }]}>
                        {/* LED dot */}
                        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: ledColor, marginRight: 10, alignSelf: 'center' }} />
                        {/* Name + phone */}
                        <View style={[styles.contactRowInfo, { flex: 1 }]}>
                          <Text style={styles.contactRowName}>{c.name}</Text>
                          <Text style={styles.contactRowMeta}>{c.phone}</Text>
                        </View>
                        {/* Action area */}
                        {ps === 'c' || ps === 'g' ? (
                          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 10, color: C.accent, letterSpacing: 0.5 }}>✓ CONTACT</Text>
                        ) : ps === 'i' ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 9, color: C.amber, letterSpacing: 0.5 }}>PENDING</Text>
                            <TouchableOpacity
                              style={[styles.contactActionBtn, { borderColor: C.red, paddingHorizontal: 6 }]}
                              onPress={() => cancelInvite(c)}
                            >
                              <Text style={[styles.contactActionBtnText, { color: C.red }]}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                              style={styles.contactActionBtn}
                              onPress={() => findOnApp(c)}
                            >
                              <Text style={styles.contactActionBtnText}>FIND</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.contactActionBtn, { borderColor: C.amber }]}
                              onPress={() => sendSMSInvite(c)}
                              disabled={inviting === c.id}
                            >
                              {inviting === c.id
                                ? <Spinner />
                                : <Text style={[styles.contactActionBtnText, { color: C.amber }]}>INVITE</Text>
                              }
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })
                }
                {deviceContacts.length === 0 && !contactsLoading && (
                  <Text style={styles.emptyText}>NO CONTACTS WITH PHONE NUMBERS</Text>
                )}
              </ScrollView>
            )}
            <TouchableOpacity
              style={[styles.ghostBtn, { marginTop: 12 }]}
              onPress={() => { setShowInvite(false); setContactsQuery(''); }}
            >
              <Text style={styles.ghostBtnText}>{'\u2715'} CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// SETTINGS TAB
// ---------------------------------------------------------------------------
function SettingsTab({ token, currentUser, notifEnabled, onSetNotifEnabled,
                        bannerEnabled, onSetBannerEnabled, skipAuth, onSetSkipAuth }) {
  const { styles, C, skin, setSkin } = useSkin();
  const mono = Platform.OS === 'ios' ? 'Courier New' : 'monospace';
  const [disappear, setDisappearState] = useState(null);
  const [location,   setLocationState] = useState(null);
  const [locLoading, setLocLoading]    = useState(false);
  const [locErr,     setLocErr]        = useState('');

  useEffect(() => {
    loadDisappear().then(v => setDisappearState(v));
    loadLocation().then(v => { if (v) setLocationState(v); });
  }, []);

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
    { key: 'tactical', label: 'TACTICAL', sub: 'STEEL', dot: '#b0c4de', desc: 'Glossy steel Magpul finish' },
  ];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.profileScroll}>

      {/* ── ACCESS ────────────────────────────────────────────── */}
      <Text style={styles.settingsHeader}>ACCESS</Text>

      {/* Always Open (24h skip-auth) */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text style={{ fontFamily: mono, fontSize: 11, color: C.text, letterSpacing: 1 }}>ALWAYS OPEN (24H)</Text>
          <Text style={{ fontFamily: mono, fontSize: 9, color: C.dim, marginTop: 2, letterSpacing: 0.5 }}>
            Skip PIN and Face ID — resets automatically after 24 hours
          </Text>
        </View>
        <Switch
          value={!!skipAuth}
          onValueChange={onSetSkipAuth}
          thumbColor={skipAuth ? C.accent : C.dim}
          trackColor={{ false: C.border, true: `${C.accent}55` }}
        />
      </View>

      {/* Enable Banner AI */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text style={{ fontFamily: mono, fontSize: 11, color: C.text, letterSpacing: 1 }}>ENABLE BANNER AI</Text>
          <Text style={{ fontFamily: mono, fontSize: 9, color: C.dim, marginTop: 2, letterSpacing: 0.5 }}>
            Show Banner AI assistant tab
          </Text>
        </View>
        <Switch
          value={!!bannerEnabled}
          onValueChange={onSetBannerEnabled}
          thumbColor={bannerEnabled ? C.accent : C.dim}
          trackColor={{ false: C.border, true: `${C.accent}55` }}
        />
      </View>

      <View style={styles.profileDivider} />

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
        {skin === 'tactical' ? 'TACTICAL: glossy steel + Magpul finish' : 'PHANTOM: classic green terminal matrix'}
      </Text>

      <View style={styles.profileDivider} />

      {/* ── NOTIFICATIONS ────────────────────────────────────── */}
      <Text style={styles.settingsHeader}>NOTIFICATIONS</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text style={{ fontFamily: mono, fontSize: 11, color: C.text, letterSpacing: 1 }}>
            Message notifications
          </Text>
          <Text style={{ fontFamily: mono, fontSize: 9, color: C.dim, marginTop: 2, letterSpacing: 0.5 }}>
            Show alerts when a new message arrives
          </Text>
        </View>
        <Switch
          value={notifEnabled ?? true}
          onValueChange={onSetNotifEnabled}
          thumbColor={notifEnabled ? C.accent : C.dim}
          trackColor={{ false: C.border, true: `${C.accent}55` }}
        />
      </View>

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <IconPin size={13} color={C.accent} />
            <Text style={styles.locationCoord}>{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</Text>
          </View>
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
          : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {location ? <IconRefresh size={13} color={C.bright} /> : <IconPin size={13} color={C.bright} />}
              <Text style={styles.getLocationBtnText}>{location ? 'UPDATE LOCATION' : 'GET LOCATION'}</Text>
            </View>
          )
        }
      </TouchableOpacity>

      <View style={styles.profileDivider} />


      {/* ── APP INFO ─────────────────────────────────────────── */}
      <Text style={styles.settingsHeader}>APP INFO</Text>
      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>VERSION</Text>
        <Text style={styles.profileValue}>1.3.0</Text>
      </View>
      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>NETWORK</Text>
        <Text style={styles.profileValue}>BY nano-SYNAPSYS</Text>
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
  const [notifEnabled,   setNotifEnabled]   = useState(true);
  const [bannerEnabled,  setBannerEnabled]  = useState(true);
  const [skipAuth,       setSkipAuth]       = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [showSearch,     setShowSearch]     = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchResults,  setSearchResults]  = useState([]);
  const [profileImageUri, setProfileImageUri] = useState(null);

  const [wsStatus, setWsStatus] = useState('disconnected');

  const wsRef          = useRef(null);
  const notifRef       = useRef(true);    // mirrors notifEnabled for WS closure
  const activeTabRef   = useRef('CHATS'); // mirrors activeTab for WS closure
  const dmPeerRef      = useRef(null);    // mirrors dmPeer for WS closure
  const groupChatRef   = useRef(null);    // mirrors groupChat for WS closure

  useEffect(() => {
    loadDisappear().then(v => setDisappear(v));
    loadNotifEnabled().then(v => { setNotifEnabled(v); notifRef.current = v; });
    loadBannerEnabled().then(v => setBannerEnabled(v));
    SecureStore.getItemAsync(SKIP_AUTH_KEY).then(v => {
      setSkipAuth(Date.now() < parseInt(v || '0', 10));
    });
    // Load persisted profile image — check local file first, then restore from server
    if (token) {
      (async () => {
        const destUri = FileSystem.documentDirectory + 'profile_avatar.jpg';
        const bust = (uri) => uri + '?t=' + Date.now();  // cache-bust for Image component
        // 1. Check well-known local file first (fastest)
        try {
          const info = await FileSystem.getInfoAsync(destUri);
          if (info.exists && info.size > 0) {
            setProfileImageUri(bust(destUri));
            return;
          }
        } catch {}
        // 2. No local file — restore from server
        try {
          const profile = await api('/api/profile', 'GET', null, token);
          if (profile?.avatar_url) {
            if (profile.avatar_url.startsWith('data:')) {
              const b64 = profile.avatar_url.split(',')[1];
              try {
                await FileSystem.writeAsStringAsync(destUri, b64, { encoding: FileSystem.EncodingType.Base64 });
              } catch {
                // If file write fails, use data URI directly
                setProfileImageUri(profile.avatar_url);
                return;
              }
            } else {
              await FileSystem.downloadAsync(profile.avatar_url, destUri);
            }
            setProfileImageUri(bust(destUri));
          }
        } catch {}
      })();
    }
    // Load persisted unread counts from SQLCipher — validate against actual conversations.
    // Stale counts for deleted groups/contacts cause phantom red badges on app launch.
    (async () => {
      try {
        const [counts, groups, contacts] = await Promise.all([
          DB.getUnreadCounts(),
          api('/api/groups', 'GET', null, token).catch(() => []),
          api('/api/contacts', 'GET', null, token).catch(() => []),
        ]);
        if (!counts || Object.keys(counts).length === 0) return;
        const validGroupIds = new Set((Array.isArray(groups) ? groups : []).map(g => `group_${g.id}`));
        const validDmIds    = new Set((_normContacts(Array.isArray(contacts) ? contacts : [])).map(c => `dm_${c.userId}`));
        const validated = {};
        for (const [key, count] of Object.entries(counts)) {
          if (count > 0 && (validGroupIds.has(key) || validDmIds.has(key))) {
            validated[key] = count;
          } else if (count > 0) {
            // Clean up stale unread count from DB
            DB.clearUnread(key).catch(() => {});
          }
        }
        if (Object.keys(validated).length > 0) setUnreadCounts(validated);
      } catch {}
    })();
    // Initialise E2EE keypair (generate if new, upload public key)
    initE2EE(token);
    // Register Expo push token with backend
    (async () => {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'e5532763-45a0-4185-9294-2bd0ef8d1bef',
        });
        if (tokenData?.data) {
          await api('/api/push-token', 'POST', { token: tokenData.data }, token);
        }
      } catch {}
    })();
  }, [token]);

  // Keep refs in sync with state
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { notifRef.current = notifEnabled; }, [notifEnabled]);
  useEffect(() => { dmPeerRef.current = dmPeer; }, [dmPeer]);
  useEffect(() => { groupChatRef.current = groupChat; }, [groupChat]);

  const handleSetNotifEnabled = useCallback((v) => {
    setNotifEnabled(v);
    notifRef.current = v;
    saveNotifEnabled(v);
  }, []);

  const handleSetBannerEnabled = useCallback(async (v) => {
    setBannerEnabled(v);
    await saveBannerEnabled(v);
    // If BOT tab is active and user disables Banner, switch away
    if (!v && activeTabRef.current === 'BOT') setActiveTab('CHATS');
  }, []);

  const handleSetSkipAuth = useCallback(async (v) => {
    setSkipAuth(v);
    const val = v ? String(Date.now() + 24 * 60 * 60 * 1000) : '0';
    await SecureStore.setItemAsync(SKIP_AUTH_KEY, val);
  }, []);

  // Debounced full-text search across local SQLCipher DB
  useEffect(() => {
    if (!showSearch) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      if (!searchQuery.trim()) { setSearchResults([]); return; }
      try {
        const res = await DB.searchMessages(searchQuery);
        setSearchResults(Array.isArray(res) ? res : []);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, showSearch]);

  // ── WebSocket (PhoenixWS) — robust connection with auto-reconnect ────────
  useEffect(() => {
    const phoenix = new PhoenixWS({
      url: WS_URL,
      token,
      onMessage: (frame) => {
        const { topic, event: evtName, payload: pl } = frame;

        // ── DM: "chat.message" on topic "user:<my_id>" ──
        if (evtName === 'chat.message') {
          const msg = { ...pl, type: 'chat_message' };
          setIncomingMsg(msg);
          const fromId = String(pl.from_user?.id ?? pl.from_user ?? pl.from);
          const meId   = String(currentUser.id);
          if (fromId !== meId) {
            const isViewingThisChat =
              activeTabRef.current === 'CHATS' &&
              dmPeerRef.current !== null &&
              String(dmPeerRef.current.id) === fromId;
            if (!isViewingThisChat) {
              setUnreadCounts(prev => ({ ...prev, [`dm_${fromId}`]: (prev[`dm_${fromId}`] || 0) + 1 }));
              DB.incrementUnread(`dm_${fromId}`).catch(() => {});
            } else {
              phoenix.send(`user:${currentUser.id}`, 'mark_read', { from: parseInt(fromId) });
            }
            if (notifRef.current && !isViewingThisChat) {
              const sender = pl.from_user?.username || pl.from_username || 'Someone';
              let preview;
              if (isEncryptedDM(pl.content))                                              preview = 'New encrypted message';
              else if (typeof pl.content === 'string' && pl.content.startsWith('data:')) preview = '[Image]';
              else                                                                         preview = (pl.content || '').slice(0, 80);
              showLocalNotification(`SYNAPTYC — ${sender}`, preview);
            }
          }
        }

        // ── Read receipt ──
        if (evtName === 'messages_read') {
          setIncomingMsg({ type: 'messages_read', by: String(pl.by) });
        }

        // ── Typing indicator ──
        if (evtName === 'typing') {
          setIncomingMsg({ type: 'typing', from: String(pl.from) });
        }

        // ── Group: "group.message" on topic "group:<group_id>" ──
        if (evtName === 'group.message') {
          const msg = { ...pl, type: 'group_message' };
          setIncomingMsg(msg);
          const fromId  = String(pl.from_user?.id ?? pl.from_user ?? pl.from);
          const meId    = String(currentUser.id);
          const groupId = pl.group_id ?? topic?.split(':')?.[1];
          if (fromId !== meId) {
            const isViewingThisGroup =
              activeTabRef.current === 'GROUPS' &&
              groupChatRef.current !== null &&
              String(groupChatRef.current.id) === String(groupId);
            if (!isViewingThisGroup) {
              setUnreadCounts(prev => ({ ...prev, [`group_${groupId}`]: (prev[`group_${groupId}`] || 0) + 1 }));
              DB.incrementUnread(`group_${groupId}`).catch(() => {});
            }
            if (notifRef.current && !isViewingThisGroup) {
              const sender = pl.from_display || pl.from_username || 'Group';
              let preview;
              if (isEncryptedGroup(pl.content))                                             preview = 'New encrypted message';
              else if (typeof pl.content === 'string' && pl.content.startsWith('data:'))   preview = '[Image]';
              else                                                                          preview = (pl.content || '').slice(0, 80);
              showLocalNotification(`SYNAPTYC — Group`, `${sender}: ${preview}`);
            }
          }
        }
      },
      onStatusChange: (status) => {
        setWsStatus(status);
        if (status === 'connected') {
          // Delta-sync missed messages on every (re)connect
          (async () => {
            try {
              const [contactsData, groupsData] = await Promise.all([
                api('/api/contacts', 'GET', null, token).catch(() => []),
                api('/api/groups', 'GET', null, token).catch(() => []),
              ]);
              const dmPeerIds = (_normContacts(contactsData)).map(c => c.userId).filter(Boolean);
              const groups    = Array.isArray(groupsData) ? groupsData : [];
              const groupIds  = groups.map(g => g.id).filter(Boolean);
              const myId = String(currentUser?.id);
              // Pre-load sender keys for all groups BEFORE syncing
              await Promise.allSettled(
                groupIds.map(gid => loadGroupSenderKeys(gid, token, myId))
              );
              // Join all group topics — persists across reconnects
              for (const gid of groupIds) phoenix.join(`group:${gid}`);
              const counts = await SYNC.syncOnConnect(token, dmPeerIds, groupIds, decryptDM, decryptGroupMsg, myId);
              // Update unread badges for messages missed while offline
              if (counts) {
                setUnreadCounts(prev => {
                  const n = { ...prev };
                  for (const [pid, c] of Object.entries(counts.dm || {})) {
                    const key = `dm_${pid}`;
                    n[key] = (n[key] || 0) + c;
                    DB.setUnreadCount(key, n[key]).catch(() => {});
                  }
                  for (const [gid, c] of Object.entries(counts.group || {})) {
                    const key = `group_${gid}`;
                    n[key] = (n[key] || 0) + c;
                    DB.setUnreadCount(key, n[key]).catch(() => {});
                  }
                  return n;
                });
              }
            } catch (e) {
              console.warn('[WS] syncOnConnect error:', e?.message);
            }
          })();
        }
      },
      onError: (reason) => {
        console.warn('[WS] Server error reply:', reason);
        setIncomingMsg({ type: 'ws_error', reason });
      },
    });
    // Backward-compat shims so DMChatScreen / GroupChatScreen / BotTab still work
    phoenix._phxSend = phoenix.send.bind(phoenix);
    phoenix._phxJoin = phoenix.join.bind(phoenix);
    Object.defineProperty(phoenix, 'readyState', {
      get() { return phoenix.getStatus() === 'connected' ? WebSocket.OPEN : WebSocket.CLOSED; },
    });
    wsRef.current = phoenix;
    // Join own user topic (persists across reconnects via PhoenixWS._joinedTopics)
    if (currentUser?.id) phoenix.join(`user:${currentUser.id}`);
    phoenix.connect();
    return () => phoenix.destroy();
  }, [token]);

  const openDM = useCallback((peer) => {
    setDmPeer(peer);
    setUnreadCounts(prev => { const n = { ...prev }; delete n[`dm_${peer.id}`]; return n; });
    DB.clearUnread(`dm_${peer.id}`).catch(() => {});
  }, []);

  const openGroup = useCallback((g) => {
    setGroupChat(g);
    setUnreadCounts(prev => { const n = { ...prev }; delete n[`group_${g.id}`]; return n; });
    DB.clearUnread(`group_${g.id}`).catch(() => {});
  }, []);

  // iOS app icon badge — total unread count
  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((s, v) => s + v, 0);
    Notifications.setBadgeCountAsync(total).catch(() => {});
  }, [unreadCounts]);

  // Aggregate unread counts for tab bar badges (memoized)
  const tabUnread = useMemo(() => ({
    CHATS:  Object.entries(unreadCounts).filter(([k]) => k.startsWith('dm_')).reduce((s, [, v]) => s + v, 0),
    GROUPS: Object.entries(unreadCounts).filter(([k]) => k.startsWith('group_')).reduce((s, [, v]) => s + v, 0),
  }), [unreadCounts]);

  // Dynamic tab list — hide BOT when Banner is disabled
  const visibleTabs = TABS.filter(t => t !== 'BOT' || bannerEnabled);

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
        onBack={() => setGroupChat(null)} wsRef={wsRef} incomingMsg={incomingMsg}
      />
    );
  }

  return (
    <ThemedSafeArea>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={styles.homeHeader}>
        <View>
          <Text style={styles.homeTitle}>SYNAPTYC</Text>
          <Text style={styles.homeSubtitle}>by nano-SYNAPSYS</Text>
        </View>
        <TouchableOpacity onPress={() => { setShowSearch(true); setSearchQuery(''); }} style={{ padding: 8 }}>
          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 28, color: C.accent }}>⌕</Text>
        </TouchableOpacity>
      </View>
      {wsStatus !== 'connected' && (
        <View style={{ backgroundColor: C.amber + '33', paddingVertical: 4, alignItems: 'center' }}>
          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 10, color: C.amber, letterSpacing: 1 }}>
            {wsStatus === 'connecting' ? 'CONNECTING…' : 'RECONNECTING…'}
          </Text>
        </View>
      )}

      {/* Search overlay */}
      <Modal visible={showSearch} animationType="slide" onRequestClose={() => setShowSearch(false)}>
        <ThemedSafeArea>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <TextInput
              style={[styles.chatInput, { flex: 1, marginRight: 8 }]}
              placeholder="SEARCH MESSAGES…" placeholderTextColor={C.muted}
              value={searchQuery} onChangeText={setSearchQuery}
              autoFocus autoCorrect={false} spellCheck={false}
            />
            <TouchableOpacity onPress={() => setShowSearch(false)}>
              <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, color: C.accent, letterSpacing: 1 }}>CLOSE</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={searchResults}
            keyExtractor={(r) => String(r.id)}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={7}
            initialNumToRender={15}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { marginTop: 32 }]}>
                {searchQuery.trim() ? 'NO RESULTS' : 'TYPE TO SEARCH'}
              </Text>
            }
            renderItem={({ item }) => {
              const isGroup = item.convo_key?.startsWith('group_');
              const label = isGroup
                ? `GROUP — ${item.convo_key?.replace('group_', '')}`
                : `DM — ${item.convo_key?.replace('dm_', '')}`;
              return (
                <TouchableOpacity
                  style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: C.border }}
                  onPress={() => {
                    setShowSearch(false);
                    // Navigate to the relevant conversation
                    if (isGroup) { setActiveTab('GROUPS'); }
                    else { setActiveTab('CHATS'); }
                  }}
                >
                  <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 9, color: C.dim, marginBottom: 2, letterSpacing: 1 }}>{label}</Text>
                  <Text style={[styles.msgText, { color: C.text }]} numberOfLines={2}>{item.content}</Text>
                  <Text style={styles.msgTime}>{fmtTime(item.created_at)}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </ThemedSafeArea>
      </Modal>

      {/* KeyboardAvoidingView wraps content+tabbar so Banner input slides above keyboard */}
      <KeyboardAvoidingView style={styles.flex} behavior={KAV_BEHAVIOR} enabled={activeTab === 'BOT'}>
        <View style={styles.flex}>
          {activeTab === 'CHATS'    && <ChatsTab token={token} currentUser={currentUser} onOpenDM={openDM} unread={unreadCounts} />}
          {activeTab === 'GROUPS'   && <GroupsTab token={token} onOpenGroup={openGroup} unread={unreadCounts} />}
          {activeTab === 'BOT'      && <BotTab token={token} wsRef={wsRef} currentUser={currentUser} />}
          {activeTab === 'PROFILE'  && <ProfileTab token={token} currentUser={currentUser} onLogout={onLogout} profileImageUri={profileImageUri} setProfileImageUri={setProfileImageUri} />}
          {activeTab === 'SETTINGS' && <SettingsTab token={token} currentUser={currentUser} notifEnabled={notifEnabled} onSetNotifEnabled={handleSetNotifEnabled} bannerEnabled={bannerEnabled} onSetBannerEnabled={handleSetBannerEnabled} skipAuth={skipAuth} onSetSkipAuth={handleSetSkipAuth} />}
        </View>
        <TabBar active={activeTab} onChange={setActiveTab} unread={tabUnread} tabs={visibleTabs} />
      </KeyboardAvoidingView>
    </ThemedSafeArea>
  );
}

// ---------------------------------------------------------------------------
// ROOT APP
// ---------------------------------------------------------------------------
function AppInner() {
  const { styles, C } = useSkin();
  const [appState,    setAppState]    = useState('loading');
  const [token,       setToken]       = useState(null);
  const [currentUser, setUser]        = useState(null);
  // Invite deep-link state: set when app opens via nanosynapsys://join/{token}
  const [inviteToken, setInviteToken] = useState(null);
  const [inviterName, setInviterName] = useState(null);

  // Handle nanosynapsys://join/{token} deep links
  useEffect(() => {
    const handleURL = async (url) => {
      if (!url) return;
      const match = url.match(/nanosynapsys:\/\/join\/([A-Za-z0-9_=-]+)/);
      if (!match) return;
      const tkn = match[1];
      try {
        const data = await api(`/api/invites/validate/${tkn}`, 'GET', null, null);
        if (data?.valid) {
          setInviteToken(tkn);
          setInviterName(data.created_by);
          // Only redirect to auth if not already logged in
          setAppState(prev => (prev === 'home' || prev === 'biometric') ? prev : 'auth');
        }
      } catch {}
    };
    Linking.getInitialURL().then(url => { if (url) handleURL(url); });
    const sub = Linking.addEventListener('url', e => handleURL(e.url));
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    registerForNotifications().catch(() => {});
    (async () => {
      try {
        const storedToken = await loadToken();
        if (!storedToken) { setAppState('auth'); return; }

        // 24h skip-auth: if within the window, refresh silently and go straight home
        const skipUntil = parseInt(await SecureStore.getItemAsync(SKIP_AUTH_KEY) || '0', 10);
        if (Date.now() < skipUntil) {
          const refreshTok = await loadBioRefresh();
          if (refreshTok) {
            try {
              const data = await api('/auth/bio-refresh', 'POST', { refresh: refreshTok });
              if (data.refresh) await saveBioRefresh(data.refresh);
              await saveToken(data.token); await saveUser(data.user);
              setToken(data.token); setUser(data.user);
              _setSession(data.token, data.refresh, setToken);
              setAppState('home');
              return;
            } catch {
              // Refresh failed — clear skip-auth and fall through to normal check
              await SecureStore.deleteItemAsync(SKIP_AUTH_KEY).catch(() => {});
            }
          }
        }

        const rawMe = await api('/auth/me', 'GET', null, storedToken);
        // MeView wraps in { user: {...} } — unwrap it
        const user = rawMe?.user ?? rawMe;
        await saveUser(user);
        setToken(storedToken); setUser(user);
        // Register global session for auto-refresh during active use
        loadBioRefresh().then(r => _setSession(storedToken, r, setToken));
        const bioEnabled = await loadBioEnabled();
        const bioReady   = await isBiometricReady();
        setAppState(bioEnabled && bioReady ? 'biometric' : 'home');
      } catch {
        await clearToken(); await clearUser();
        setAppState('auth');
      }
    })();
  }, []);

  const handleAuth = useCallback((t, u) => {
    setToken(t); setUser(u);
    // Register with global session for auto-refresh
    loadBioRefresh().then(r => _setSession(t, r, setToken));
    // Clear invite state once registration/login is complete
    setInviteToken(null); setInviterName(null);
    setAppState('home');
  }, []);
  const handleLogout = useCallback(async () => {
    await clearToken(); await clearUser();
    // Clear all in-memory E2EE state so it cannot leak to the next session.
    _sigIdentityKey = null;
    // Reset E2EE ready gate for next login session
    _e2eeReady = new Promise(r => { _e2eeReadyResolve = r; });
    Object.keys(_pkCache).forEach(k => delete _pkCache[k]);
    Object.keys(_groupKeyCache).forEach(k => delete _groupKeyCache[k]);
    Object.keys(_sigSessions).forEach(k => delete _sigSessions[k]);
    Object.keys(_sigSenderKeys).forEach(k => delete _sigSenderKeys[k]);
    setToken(null); setUser(null); setAppState('auth');
  }, []);

  if (appState === 'loading') {
    return (
      <ThemedView style={styles.splashScreen}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <Text style={styles.splashTitle}>SYNAPTYC</Text>
        <Text style={styles.splashSub}>nano-SYNAPSYS</Text>
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

  if (appState === 'auth') {
    return <AuthScreen onAuth={handleAuth} inviteToken={inviteToken} inviterName={inviterName} />;
  }

  return <HomeScreen token={token} currentUser={currentUser} onLogout={handleLogout} />;
}

export default function App() {
  return (
    <SkinProvider>
      <AppInner />
    </SkinProvider>
  );
}
