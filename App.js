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
  Easing,
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
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import * as Notifications from 'expo-notifications';
import Svg, { Path, Circle, Line, G, Polygon, Rect, Defs, Pattern } from 'react-native-svg';

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
  muted:       '#484860',   // was #2c2c3c — brightened for readable placeholder text
  accent:      '#a8b8cc',
  green:       '#6888a0',
  amber:       '#b89060',
  red:         '#c04848',
};

// ---------------------------------------------------------------------------
// STYLES FACTORY  (called once per palette → two static StyleSheet objects)
// ---------------------------------------------------------------------------
function makeRawStyles(C) {
  // Technical labels, logos, timestamps → Menlo (more readable than Courier New)
  const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
  // Body text, inputs, messages → system font (SF Pro on iOS, Roboto on Android)
  const body = undefined;

  // Reusable shadow helpers
  const cardShadow = {
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  };
  const inputShadow = {
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
  };
  const btnShadow = {
    shadowColor: C.green, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22, shadowRadius: 10, elevation: 4,
  };

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
      flexDirection: 'row',
      backgroundColor: C.surface,
      borderRadius: 28,
      marginHorizontal: 12,
      marginBottom: Platform.OS === 'ios' ? 6 : 8,
      paddingVertical: 10,
      paddingHorizontal: 2,
      shadowColor: C.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 22,
      elevation: 24,
      borderWidth: 1,
      borderColor: C.borderBright,
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
    },
    inputMultiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: 13 },

    primaryBtn: {
      backgroundColor: C.panel, borderWidth: 1, borderColor: C.green,
      alignItems: 'center', paddingVertical: 14,
      borderRadius: 10, ...btnShadow,
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
      backgroundColor: C.panel, borderColor: C.borderBright,
      borderRadius: 18, borderTopRightRadius: 4,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
    },
    bubbleTheirs: {
      backgroundColor: C.surface, borderColor: C.border,
      borderRadius: 18, borderTopLeftRadius: 4,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
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
const NOTIF_KEY       = 'nano_notif_enabled';

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
function isLocationContent(c) { return typeof c === 'string' && c.includes('[LOCATION:'); }

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
/* SynapseTexture — custom dot-grid background, replaces magpul branding */
function SynapseTexture({ accentColor }) {
  // 6 radial arms at 60° intervals for the central mark
  const arms = [0, 60, 120, 180, 240, 300].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const tx = (80 * cos).toFixed(1);
    const ty = (80 * sin).toFixed(1);
    const bx = (52 * cos).toFixed(1);
    const by = (52 * sin).toFixed(1);
    const b1x = (52 * cos + 14 * Math.cos(rad + Math.PI / 3)).toFixed(1);
    const b1y = (52 * sin + 14 * Math.sin(rad + Math.PI / 3)).toFixed(1);
    const b2x = (52 * cos + 14 * Math.cos(rad - Math.PI / 3)).toFixed(1);
    const b2y = (52 * sin + 14 * Math.sin(rad - Math.PI / 3)).toFixed(1);
    return { tx, ty, bx, by, b1x, b1y, b2x, b2y };
  });
  const hexPts = [0, 60, 120, 180, 240, 300]
    .map((d) => {
      const r = (d * Math.PI) / 180;
      return `${(88 * Math.cos(r)).toFixed(1)},${(88 * Math.sin(r)).toFixed(1)}`;
    })
    .join(' ');

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

      {/* Central synapse mark — watermark at screen center */}
      <G opacity="0.07" transform="translate(50%, 50%) translate(188, 400)">
        {/* Outer connecting hexagon */}
        <Polygon points={hexPts} stroke={accentColor} strokeWidth="1" fill="none" />
        {/* Radial arms + branches */}
        {arms.map((a, i) => (
          <G key={i}>
            <Line x1="0" y1="0" x2={a.tx} y2={a.ty} stroke={accentColor} strokeWidth="0.8" />
            <Line x1={a.bx} y1={a.by} x2={a.b1x} y2={a.b1y} stroke={accentColor} strokeWidth="0.6" />
            <Line x1={a.bx} y1={a.by} x2={a.b2x} y2={a.b2y} stroke={accentColor} strokeWidth="0.6" />
            <Circle cx={parseFloat(a.tx)} cy={parseFloat(a.ty)} r="3.5" fill={accentColor} />
          </G>
        ))}
        {/* Nucleus rings */}
        <Circle cx="0" cy="0" r="18" stroke={accentColor} strokeWidth="1.2" fill="none" />
        <Circle cx="0" cy="0" r="8" stroke={accentColor} strokeWidth="0.8" fill="none" />
        <Circle cx="0" cy="0" r="3" fill={accentColor} />
      </G>
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

function AppHeader({ title, onBack, rightComponent }) {
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
      {rightComponent ? rightComponent : <View style={{ width: 80 }} />}
    </View>
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

  const addMember = (userId) => act(`add_${userId}`, () =>
    api(`/api/groups/${group.id}/members`, 'POST', { user_id: userId }, token)
  );

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
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontFamily: mono, fontSize: 14, color: C.dim }}>{'\u2715'}</Text>
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
  CONTACTS: IconContacts,
  GROUPS:   IconGroups,
  BOT:      IconBot,
  PROFILE:  IconProfile,
  SETTINGS: IconSettings,
};

// ---------------------------------------------------------------------------
// BOTTOM TAB BAR  (floating, rounded, back-shadowed)
// ---------------------------------------------------------------------------
const TABS = ['CHATS', 'CONTACTS', 'GROUPS', 'BOT', 'PROFILE', 'SETTINGS'];

function TabBar({ active, onChange, unread = {} }) {
  const { styles, C } = useSkin();
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
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
        promptMessage:         'Unlock nano-SYNAPSYS',
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
        <Text style={styles.logoText}>nano-SYNAPSYS</Text>
        <Text style={styles.logoSub}>AI EVOLUTION SECURE MESH</Text>
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
      const hw  = await LocalAuthentication.hasHardwareAsync();
      const enr = await LocalAuthentication.isEnrolledAsync();
      if (!hw)  { setErr('Face ID hardware not found on this device.'); return; }
      if (!enr) { setErr('Face ID is not set up. Go to iOS Settings → Face ID & Passcode.'); return; }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login to nano-SYNAPSYS', disableDeviceFallback: true, cancelLabel: 'Cancel',
      });
      if (!result.success) {
        if (result.error === 'user_cancel' || result.error === 'system_cancel') { return; }
        if (result.error === 'lockout' || result.error === 'lockout_permanent') {
          setErr('Face ID locked. Enter your device passcode first to re-enable it.');
        } else if (result.error === 'missing_usage_description') {
          // NSFaceIDUsageDescription absent — Expo Go or non-native build.
          // Auto-clear so the button disappears and user isn't confused.
          await clearBio();
          setBioSupported(false); setBioReady(false);
          setErr('Face ID requires a native build. Use password login for now.');
        } else {
          setErr(`Face ID failed (${result.error || 'error'}). Use password instead.`);
        }
        return;
      }
      const creds = await loadBioCreds();
      if (!creds) { setErr('No stored credentials. Please log in with password.'); return; }
      const data = await api('/auth/login', 'POST', { email: creds.email, password: creds.password });
      await saveToken(data.token); await saveUser(data.user);
      onAuth(data.token, data.user);
    } catch (e) { setErr(e.message || 'Face ID error. Please try again.'); }
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
                {bioLoading ? <Spinner /> : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <IconLock size={15} color={C.accent} />
                    <Text style={styles.bioLoginBtnText}>VAULT LOGIN</Text>
                  </View>
                )}
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
    Animated.timing(position, {
      toValue,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
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
function ChatsTab({ token, currentUser, onOpenDM, unread = {} }) {
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
        renderItem={({ item }) => {
          const cnt = unread[`dm_${item.id}`] || 0;
          return (
            <TouchableOpacity style={styles.userRow} onPress={() => onOpenDM(item)}>
              <View style={styles.userRowLeft}>
                <OnlineDot online={item.online} />
                <View style={styles.userRowInfo}>
                  <Text style={styles.userRowName}>{item.displayName || item.display_name || item.username}</Text>
                  <Text style={styles.userRowMeta}>{item.online ? 'ONLINE' : item.last_seen ? `LAST SEEN ${fmtDate(item.last_seen)}` : 'OFFLINE'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {cnt > 0 && (
                  <View style={styles.rowBadge}>
                    <Text style={styles.rowBadgeText}>{cnt > 99 ? '99+' : cnt}</Text>
                  </View>
                )}
                <Text style={styles.chevron}>{'>'}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
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
  const disappearTimers         = useRef([]);

  // Clean up all pending disappear timers on unmount
  useEffect(() => () => { disappearTimers.current.forEach(clearTimeout); }, []);

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
      // Schedule disappear if requested — track timer so it's cancelled on unmount
      if (incomingMsg.disappear_after && incomingMsg.disappear_after > 0) {
        const msgId = incomingMsg.id;
        const tid = setTimeout(() => {
          setMessages(prev => prev.filter(m => m.id !== msgId));
        }, incomingMsg.disappear_after * 1000);
        disappearTimers.current.push(tid);
      }
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
                      {isImageContent(item.content) ? (
                        <Image source={{ uri: item.content }} style={styles.imageMsg} resizeMode="contain" />
                      ) : isLocationContent(item.content) ? (
                        <TouchableOpacity onPress={() => {
                          const m = item.content.match(/\[LOCATION:([-\d.]+),([-\d.]+)\]/);
                          if (m) Linking.openURL(`https://maps.google.com/?q=${m[1]},${m[2]}`);
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <IconPin size={13} color={mine ? '#fff' : C.accent} />
                            <Text style={[styles.msgText, { color: mine ? '#fff' : C.accent }]}>Location shared</Text>
                          </View>
                          <Text style={[styles.msgTime, { marginTop: 2 }]}>
                            {item.content.match(/\[LOCATION:([-\d.]+),([-\d.]+)\]/)?.[0].replace('[LOCATION:', '').replace(']', '') || ''}
                          </Text>
                          <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 9, color: mine ? '#ffffffaa' : C.dim, marginTop: 2 }}>
                            TAP TO OPEN IN MAPS
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.msgText}>{item.content}</Text>
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
            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.attachBtn} onPress={handleAttachment}>
                <Text style={styles.attachBtnText}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachBtn} onPress={handleShareLocation}>
                <IconPin size={18} color={C.accent} />
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
          const cnt = unread[`group_${item.id}`] || 0;
          const row = (
            <TouchableOpacity style={styles.userRow} onPress={() => onOpenGroup(item)}>
              <View style={[styles.userRowInfo, { flex: 1 }]}>
                <Text style={styles.userRowName}>{item.name}</Text>
                {item.description
                  ? <Text style={styles.userRowMeta} numberOfLines={1}>{item.description}</Text>
                  : <Text style={styles.userRowMeta}>CREATED {fmtDate(item.created_at)}</Text>
                }
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {cnt > 0 && (
                  <View style={styles.rowBadge}>
                    <Text style={styles.rowBadgeText}>{cnt > 99 ? '99+' : cnt}</Text>
                  </View>
                )}
                <Text style={styles.chevron}>{'>'}</Text>
              </View>
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
  const [messages, setMessages]     = useState([]);
  const [text, setText]             = useState('');
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [err, setErr]               = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const listRef                     = useRef(null);
  const disappearTimers             = useRef([]);

  useEffect(() => () => { disappearTimers.current.forEach(clearTimeout); }, []);

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
      if (incomingMsg.disappear_after && incomingMsg.disappear_after > 0) {
        const msgId = incomingMsg.id;
        const tid = setTimeout(() => {
          setMessages(prev => prev.filter(m => m.id !== msgId));
        }, incomingMsg.disappear_after * 1000);
        disappearTimers.current.push(tid);
      }
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
    const id = msg.from_user?.id ?? msg.from_user ?? msg.from;
    return String(id) === String(currentUser.id);
  };

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
                      {isImageContent(item.content) ? (
                        <Image source={{ uri: item.content }} style={styles.imageMsg} resizeMode="contain" />
                      ) : isLocationContent(item.content) ? (
                        <TouchableOpacity onPress={() => {
                          const m = item.content.match(/\[LOCATION:([-\d.]+),([-\d.]+)\]/);
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
                        <Text style={styles.msgText}>{item.content}</Text>
                      )}
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
              <TouchableOpacity style={styles.attachBtn} onPress={handleShareLocation}>
                <IconPin size={18} color={C.accent} />
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
    id: 0, role: 'bot', content: 'BANNER AI ONLINE.\n\nI\'m your unlimited AI assistant — ask me anything, or send a photo/screenshot for analysis.',
    ts: new Date().toISOString(),
  }]);
  const [text,         setText]         = useState('');
  const [loading,      setLoading]      = useState(false);
  const [err,          setErr]          = useState('');
  const [typing,       setTyping]       = useState(false);
  const [pendingImage, setPendingImage] = useState(null); // { uri, base64, mimeType }
  const listRef                         = useRef(null);
  const typingTimer                     = useRef(null);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, typing]);

  const sendToBot = async () => {
    const content  = text.trim();
    const imgToSend = pendingImage;
    if (!content && !imgToSend || loading) return;
    setText('');
    setPendingImage(null);
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
        const body = { message: content || 'Describe this image.' };
        if (imgToSend?.base64) { body.image_base64 = imgToSend.base64; body.image_mime = imgToSend.mimeType || 'image/jpeg'; }
        const data = await api('/api/bot/chat', 'POST', body, token);
        setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'bot', content: data.reply || '...', ts: new Date().toISOString() }]);
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

  useEffect(() => { return () => { if (typingTimer.current) clearTimeout(typingTimer.current); }; }, []);

  const canSend = (text.trim().length > 0 || pendingImage !== null) && !loading;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={KAV_BEHAVIOR}>
      <View style={styles.botHeader}>
        <Text style={styles.botHeaderText}>BANNER AI</Text>
        <View style={[{ width: 8, height: 8, borderRadius: 4, marginLeft: 8 }, { backgroundColor: C.green }]} />
        <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 9, color: C.dim, marginLeft: 8, letterSpacing: 1 }}>
          UNLIMITED · VISION
        </Text>
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
            <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 11, color: C.danger || C.amber }}>
              {'\u2715'} REMOVE
            </Text>
          </TouchableOpacity>
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
  const [contacts,       setContacts]       = useState([]);
  const [pending,        setPending]        = useState({ received: [], sent: [] });
  const [users,          setUsers]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [err,            setErr]            = useState('');
  const [showSearch,     setShowSearch]     = useState(false);
  const [query,          setQuery]          = useState('');
  const [actioning,      setActioning]      = useState({});
  // SMS invite
  const [showInvite,     setShowInvite]     = useState(false);
  const [deviceContacts, setDeviceContacts] = useState([]);
  const [contactsLoading,setContactsLoading]= useState(false);
  const [contactsQuery,  setContactsQuery]  = useState('');
  const [inviting,       setInviting]       = useState(null);

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
    // Use isRefresh=true so the pull-to-refresh indicator shows instead of
    // replacing the entire UI with a full-screen spinner while data reloads.
    try { await fn(); await fetchAll(true); } catch (e) { setErr(e.message); }
    finally { setActioning(a => ({ ...a, [key]: false })); }
  };

  // API uses camelCase keys
  const sendRequest = (userId) => act(`req_${userId}`, async () => {
    const res = await api('/api/contacts/request', 'POST', { userId }, token);
    // Backend returns {status:'already_contacts'} if already connected
    if (!res?.status || res.status !== 'already_contacts') {
      Alert.alert('REQUEST SENT', 'Contact request sent. They will need to accept before you can chat.');
    }
  });
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
    setShowInvite(true);
    setContactsLoading(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
        sort: Contacts.SortTypes.FirstName,
      });
      const withPhones = data
        .filter(c => c.phoneNumbers?.length > 0)
        .map(c => ({
          id: c.id,
          name: (c.name || ((c.firstName || '') + ' ' + (c.lastName || '')).trim()) || 'Unknown',
          phone: c.phoneNumbers[0].number,
        }));
      setDeviceContacts(withPhones);
    } catch (e) {
      Alert.alert('ERROR', 'Failed to load contacts: ' + e.message);
    } finally {
      setContactsLoading(false);
    }
  };

  const sendSMSInvite = async (contact) => {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('SMS NOT AVAILABLE', 'This device cannot send SMS messages.');
      return;
    }
    setInviting(contact.id);
    try {
      const data = await api('/api/invites', 'POST', {}, token);
      const inviteUrl = data.invite_url || data.url;
      if (!inviteUrl) {
        Alert.alert('ERROR', 'Could not generate an invite link. Please try again.');
        return;
      }
      const senderName = currentUser?.display_name || currentUser?.username || 'A friend';
      const msg =
        `${senderName} invited you to nano-SYNAPSYS — private encrypted messaging by AI Evolution. Join here: ${inviteUrl} (expires in 7 days, one-use only)`;
      const { result } = await SMS.sendSMSAsync([contact.phone], msg);
      if (result !== 'cancelled') {
        Alert.alert('INVITE SENT', `Invite sent to ${contact.name}.\n\nThey will receive a link to join nano-SYNAPSYS.`);
      }
    } catch (e) {
      Alert.alert('ERROR', e.message);
    } finally {
      setInviting(null);
    }
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

      <View style={styles.separator} />

      {/* ── INVITE VIA SMS ──────────────────────────────────────── */}
      <TouchableOpacity style={[styles.addContactBtn, { borderColor: C.amber, flexDirection: 'row', gap: 8 }]} onPress={openInviteModal}>
        <IconSMS size={15} color={C.amber} />
        <Text style={[styles.addContactBtnText, { color: C.amber }]}>INVITE VIA SMS</Text>
      </TouchableOpacity>

      {/* ── INVITE MODAL ───────────────────────────────────────── */}
      <Modal visible={showInvite} transparent animationType="slide" onRequestClose={() => { setShowInvite(false); setContactsQuery(''); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>INVITE CONTACT</Text>
            <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 10, color: C.dim, marginBottom: 10, letterSpacing: 0.5 }}>
              Select a contact to send them an invite link via SMS.
            </Text>
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
                {deviceContacts
                  .filter(c => !contactsQuery.trim() || c.name.toLowerCase().includes(contactsQuery.toLowerCase()) || c.phone.includes(contactsQuery))
                  .map(c => (
                    <View key={c.id} style={styles.contactRow}>
                      <View style={styles.contactRowLeft}>
                        <View style={styles.contactRowInfo}>
                          <Text style={styles.contactRowName}>{c.name}</Text>
                          <Text style={styles.contactRowMeta}>{c.phone}</Text>
                        </View>
                      </View>
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
                  ))
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
function SettingsTab({ token, currentUser, notifEnabled, onSetNotifEnabled }) {
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
            {adminRefreshing ? <Spinner /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconRefresh size={13} color={C.dim} />
                <Text style={styles.ghostBtnText}>REFRESH LIST</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.profileDivider} />
        </>
      )}

      {/* ── APP INFO ─────────────────────────────────────────── */}
      <Text style={styles.settingsHeader}>APP INFO</Text>
      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>VERSION</Text>
        <Text style={styles.profileValue}>1.1.0</Text>
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
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({});

  const wsRef          = useRef(null);
  const reconnectRef   = useRef(null);
  const backoffRef     = useRef(1000);
  const notifRef       = useRef(true);    // mirrors notifEnabled for WS closure
  const activeTabRef   = useRef('CHATS'); // mirrors activeTab for WS closure
  const dmPeerRef      = useRef(null);    // mirrors dmPeer for WS closure
  const groupChatRef   = useRef(null);    // mirrors groupChat for WS closure

  useEffect(() => {
    loadDisappear().then(v => setDisappear(v));
    loadNotifEnabled().then(v => { setNotifEnabled(v); notifRef.current = v; });
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

  const connectWS = useCallback(() => {
    if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => { backoffRef.current = 1000; };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setIncomingMsg(msg);

        if (msg.type === 'chat_message') {
          const fromId = String(msg.from_user?.id ?? msg.from_user ?? msg.from);
          const meId   = String(currentUser.id);
          // Only count messages from others
          if (fromId !== meId) {
            const isViewingThisChat =
              activeTabRef.current === 'CHATS' &&
              dmPeerRef.current !== null &&
              String(dmPeerRef.current.id) === fromId;
            if (!isViewingThisChat) {
              setUnreadCounts(prev => ({ ...prev, [`dm_${fromId}`]: (prev[`dm_${fromId}`] || 0) + 1 }));
            }
            // Fire local notification when not viewing that chat
            if (notifRef.current && !isViewingThisChat) {
              const sender = msg.from_user?.username || msg.fromUsername || 'Someone';
              const preview = (typeof msg.content === 'string' && !msg.content.startsWith('data:'))
                ? msg.content.slice(0, 80) : '[Image]';
              showLocalNotification(`nano-SYNAPSYS \u2014 ${sender}`, preview);
            }
          }
        }

        if (msg.type === 'group_message') {
          const fromId = String(msg.from_user?.id ?? msg.from_user);
          const meId   = String(currentUser.id);
          if (fromId !== meId) {
            const groupId = msg.group_id ?? msg.group?.id;
            const isViewingThisGroup =
              activeTabRef.current === 'GROUPS' &&
              groupChatRef.current !== null &&
              String(groupChatRef.current.id) === String(groupId);
            if (!isViewingThisGroup) {
              setUnreadCounts(prev => ({ ...prev, [`group_${groupId}`]: (prev[`group_${groupId}`] || 0) + 1 }));
            }
            if (notifRef.current && !isViewingThisGroup) {
              const sender = msg.from_display || msg.from_username || 'Group';
              const preview = (typeof msg.content === 'string' && !msg.content.startsWith('data:'))
                ? msg.content.slice(0, 80) : '[Image]';
              showLocalNotification(`nano-SYNAPSYS — ${msg.group?.name || 'Group'}`, `${sender}: ${preview}`);
            }
          }
        }
      } catch {}
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

  const openDM = useCallback((peer) => {
    setDmPeer(peer);
    setUnreadCounts(prev => { const n = { ...prev }; delete n[`dm_${peer.id}`]; return n; });
  }, []);

  const openGroup = useCallback((g) => {
    setGroupChat(g);
    setUnreadCounts(prev => { const n = { ...prev }; delete n[`group_${g.id}`]; return n; });
  }, []);

  // Aggregate unread counts for tab bar badges
  const tabUnread = {
    CHATS:  Object.entries(unreadCounts).filter(([k]) => k.startsWith('dm_')).reduce((s, [, v]) => s + v, 0),
    GROUPS: Object.entries(unreadCounts).filter(([k]) => k.startsWith('group_')).reduce((s, [, v]) => s + v, 0),
  };

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
        <Text style={styles.homeTitle}>nano-SYNAPSYS</Text>
        <Text style={styles.homeSubtitle}>AI EVOLUTION MESH</Text>
      </View>
      <View style={styles.flex}>
        {activeTab === 'CHATS'    && <ChatsTab token={token} currentUser={currentUser} onOpenDM={openDM} unread={unreadCounts} />}
        {activeTab === 'CONTACTS' && <ContactsTab token={token} currentUser={currentUser} onOpenDM={(peer) => { openDM(peer); setActiveTab('CHATS'); }} />}
        {activeTab === 'GROUPS'   && <GroupsTab token={token} onOpenGroup={openGroup} unread={unreadCounts} />}
        {activeTab === 'BOT'      && <BotTab token={token} />}
        {activeTab === 'PROFILE'  && <ProfileTab token={token} currentUser={currentUser} onLogout={onLogout} />}
        {activeTab === 'SETTINGS' && <SettingsTab token={token} currentUser={currentUser} notifEnabled={notifEnabled} onSetNotifEnabled={handleSetNotifEnabled} />}
      </View>
      <TabBar active={activeTab} onChange={setActiveTab} unread={tabUnread} />
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
    registerForNotifications().catch(() => {});
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
