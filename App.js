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
  useMemo,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

// ---------------------------------------------------------------------------
// COLOUR PALETTE
// ---------------------------------------------------------------------------
const C = {
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

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const BASE_URL = 'https://www.ai-evolution.com.au';
const WS_URL   = 'wss://www.ai-evolution.com.au/chat';
const JWT_KEY  = 'nano_jwt';
const USER_KEY = 'nano_user';

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
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg =
      data?.detail ||
      data?.message ||
      data?.error ||
      (typeof data === 'string' ? data : null) ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

// ---------------------------------------------------------------------------
// SECURE STORE HELPERS
// ---------------------------------------------------------------------------
async function saveToken(t) {
  await SecureStore.setItemAsync(JWT_KEY, t);
}
async function loadToken() {
  return SecureStore.getItemAsync(JWT_KEY);
}
async function clearToken() {
  await SecureStore.deleteItemAsync(JWT_KEY);
}
async function saveUser(u) {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(u));
}
async function loadUser() {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
async function clearUser() {
  await SecureStore.deleteItemAsync(USER_KEY);
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

// ---------------------------------------------------------------------------
// SHARED UI ATOMS
// ---------------------------------------------------------------------------
function Spinner({ size = 'small' }) {
  return <ActivityIndicator color={C.accent} size={size} />;
}

function ErrText({ msg }) {
  if (!msg) return null;
  return <Text style={styles.errText}>{msg}</Text>;
}

function OnlineDot({ online }) {
  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: online ? C.green : C.muted },
      ]}
    />
  );
}

function AppHeader({ title, onBack }) {
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
// BOTTOM TAB BAR
// ---------------------------------------------------------------------------
const TABS = ['CHATS', 'GROUPS', 'BOT', 'PROFILE'];

function TabBar({ active, onChange }) {
  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const isActive = tab === active;
        return (
          <TouchableOpacity
            key={tab}
            style={styles.tabItem}
            onPress={() => onChange(tab)}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab}
            </Text>
            {isActive && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// AUTH SCREEN
// ---------------------------------------------------------------------------
function AuthScreen({ onAuth }) {
  const [tab, setTab]               = useState('LOGIN');
  const [username, setUsername]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [inviteCode, setInviteCode]   = useState('');
  const [joinReason, setJoinReason]   = useState('');
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState('');

  const reset = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setInviteCode('');
    setJoinReason('');
    setErr('');
  };

  const handleTabSwitch = (t) => {
    setTab(t);
    reset();
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setErr('Username and password are required.');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const data = await api('/auth/login', 'POST', {
        username: username.trim(),
        password,
      });
      await saveToken(data.token);
      await saveUser(data.user);
      onAuth(data.token, data.user);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      setErr('Username, email and password are required.');
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const body = {
        username:   username.trim(),
        email:      email.trim(),
        password,
        join_reason: joinReason.trim(),
      };
      if (inviteCode.trim()) body.invite_code = inviteCode.trim();
      const data = await api('/auth/register', 'POST', body);
      await saveToken(data.token);
      await saveUser(data.user);
      onAuth(data.token, data.user);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={KAV_BEHAVIOR}
      >
        <ScrollView
          contentContainerStyle={styles.authScroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoBlock}>
            <Text style={styles.logoText}>nano-SYNAPSYS</Text>
            <Text style={styles.logoSub}>AI EVOLUTION SECURE MESH</Text>
          </View>

          {/* Tab switcher */}
          <View style={styles.authTabRow}>
            {['LOGIN', 'REGISTER'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.authTab, tab === t && styles.authTabActive]}
                onPress={() => handleTabSwitch(t)}
              >
                <Text
                  style={[
                    styles.authTabText,
                    tab === t && styles.authTabTextActive,
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Fields */}
          <View style={styles.authForm}>
            <TextInput
              style={styles.input}
              placeholder="USERNAME"
              placeholderTextColor={C.muted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {tab === 'REGISTER' && (
              <TextInput
                style={styles.input}
                placeholder="EMAIL"
                placeholderTextColor={C.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="PASSWORD"
              placeholderTextColor={C.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {tab === 'REGISTER' && (
              <TextInput
                style={styles.input}
                placeholder="INVITE CODE (OPTIONAL)"
                placeholderTextColor={C.muted}
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

            {tab === 'REGISTER' && (
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="WHY DO YOU WANT TO JOIN? (REQUIRED)"
                placeholderTextColor={C.muted}
                value={joinReason}
                onChangeText={setJoinReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                autoCorrect={false}
              />
            )}

            <ErrText msg={err} />

            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={tab === 'LOGIN' ? handleLogin : handleRegister}
              disabled={loading}
            >
              {loading ? (
                <Spinner />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {tab === 'LOGIN' ? 'LOGIN' : 'CREATE ACCOUNT'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// CHATS TAB — User list
// ---------------------------------------------------------------------------
function ChatsTab({ token, currentUser, onOpenDM }) {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr]             = useState('');

  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErr('');
    try {
      const data = await api('/api/users', 'GET', null, token);
      setUsers(data.filter((u) => u.id !== currentUser.id));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, currentUser.id]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  if (loading) {
    return (
      <View style={styles.centerFill}>
        <Spinner size="large" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ErrText msg={err} />
      <FlatList
        data={users}
        keyExtractor={(u) => String(u.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchUsers(true)}
            tintColor={C.accent}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>NO USERS FOUND</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userRow}
            onPress={() => onOpenDM(item)}
          >
            <View style={styles.userRowLeft}>
              <OnlineDot online={item.online} />
              <View style={styles.userRowInfo}>
                <Text style={styles.userRowName}>
                  {item.display_name || item.username}
                </Text>
                <Text style={styles.userRowMeta}>
                  {item.online
                    ? 'ONLINE'
                    : item.last_seen
                    ? `LAST SEEN ${fmtDate(item.last_seen)}`
                    : 'OFFLINE'}
                </Text>
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
function DMChatScreen({ token, currentUser, peer, onBack, wsRef, incomingMsg }) {
  const [messages, setMessages]   = useState([]);
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [err, setErr]             = useState('');
  const listRef                   = useRef(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const data = await api(`/api/messages/${peer.id}`, 'GET', null, token);
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, peer.id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Handle incoming WebSocket message
  useEffect(() => {
    if (!incomingMsg) return;
    if (incomingMsg.type === 'chat_message') {
      const fromId =
        incomingMsg.from_user?.id ?? incomingMsg.from_user;
      if (
        String(fromId) === String(peer.id) ||
        String(fromId) === String(currentUser.id)
      ) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === incomingMsg.id);
          return exists ? prev : [...prev, incomingMsg];
        });
      }
    }
  }, [incomingMsg, peer.id, currentUser.id]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    const content = text.trim();
    if (!content) return;
    setSending(true);
    setText('');
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'chat_message', to: peer.id, content })
        );
        // Optimistic
        const optimistic = {
          id:         Date.now(),
          content,
          from_user:  currentUser.id,
          to_user:    peer.id,
          created_at: new Date().toISOString(),
          read:       false,
        };
        setMessages((prev) => [...prev, optimistic]);
      } else {
        // Fallback REST
        const msg = await api('/api/messages', 'POST', { to: peer.id, content }, token);
        setMessages((prev) => [...prev, msg]);
      }
    } catch (e) {
      setErr(e.message);
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const isMine = (msg) => {
    const fid = msg.from_user?.id ?? msg.from_user;
    return String(fid) === String(currentUser.id);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader
        title={peer.display_name || peer.username}
        onBack={onBack}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={KAV_BEHAVIOR}>
        {loading ? (
          <View style={styles.centerFill}><Spinner size="large" /></View>
        ) : (
          <>
            <ErrText msg={err} />
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => String(m.id)}
              contentContainerStyle={styles.msgList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>NO MESSAGES YET</Text>
              }
              renderItem={({ item }) => {
                const mine = isMine(item);
                return (
                  <View
                    style={[
                      styles.msgRow,
                      mine ? styles.msgRowMine : styles.msgRowTheirs,
                    ]}
                  >
                    <View
                      style={[
                        styles.msgBubble,
                        mine ? styles.bubbleMine : styles.bubbleTheirs,
                      ]}
                    >
                      <Text style={styles.msgText}>{item.content}</Text>
                      <View style={styles.msgMeta}>
                        <Text style={styles.msgTime}>
                          {fmtTime(item.created_at)}
                        </Text>
                        {mine && (
                          <Text style={styles.msgRead}>
                            {item.read ? ' ✓✓' : ' ✓'}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              }}
            />
            <View style={styles.inputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="MESSAGE..."
                placeholderTextColor={C.muted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!text.trim() || sending}
              >
                {sending ? <Spinner /> : <Text style={styles.sendBtnText}>SEND</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// GROUPS TAB
// ---------------------------------------------------------------------------
function GroupsTab({ token, onOpenGroup }) {
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
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErr('');
    try {
      const data = await api('/api/groups', 'GET', null, token);
      setGroups(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const createGroup = async () => {
    if (!newName.trim()) { setCreateErr('Group name is required.'); return; }
    setCreating(true);
    setCreateErr('');
    try {
      const g = await api('/api/groups', 'POST', {
        name:        newName.trim(),
        description: newDesc.trim(),
      }, token);
      setGroups((prev) => [g, ...prev]);
      setShowForm(false);
      setNewName('');
      setNewDesc('');
    } catch (e) {
      setCreateErr(e.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <View style={styles.centerFill}><Spinner size="large" /></View>;
  }

  return (
    <View style={styles.flex}>
      <ErrText msg={err} />

      {showForm && (
        <View style={styles.createGroupForm}>
          <Text style={styles.formLabel}>NEW GROUP</Text>
          <TextInput
            style={styles.input}
            placeholder="GROUP NAME"
            placeholderTextColor={C.muted}
            value={newName}
            onChangeText={setNewName}
          />
          <TextInput
            style={styles.input}
            placeholder="DESCRIPTION (OPTIONAL)"
            placeholderTextColor={C.muted}
            value={newDesc}
            onChangeText={setNewDesc}
          />
          <ErrText msg={createErr} />
          <View style={styles.formBtnRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1, marginRight: 8 }]}
              onPress={createGroup}
              disabled={creating}
            >
              {creating ? <Spinner /> : <Text style={styles.primaryBtnText}>CREATE</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ghostBtn, { flex: 1 }]}
              onPress={() => { setShowForm(false); setCreateErr(''); }}
            >
              <Text style={styles.ghostBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={groups}
        keyExtractor={(g) => String(g.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchGroups(true)}
            tintColor={C.accent}
          />
        }
        ListHeaderComponent={
          !showForm ? (
            <TouchableOpacity
              style={styles.createGroupBtn}
              onPress={() => setShowForm(true)}
            >
              <Text style={styles.createGroupBtnText}>+ NEW GROUP</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>NO GROUPS YET</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userRow}
            onPress={() => onOpenGroup(item)}
          >
            <View style={styles.userRowInfo}>
              <Text style={styles.userRowName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.userRowMeta} numberOfLines={1}>
                  {item.description}
                </Text>
              ) : (
                <Text style={styles.userRowMeta}>
                  CREATED {fmtDate(item.created_at)}
                </Text>
              )}
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
// GROUP CHAT SCREEN
// ---------------------------------------------------------------------------
function GroupChatScreen({ token, currentUser, group, onBack, wsRef, incomingMsg }) {
  const [messages, setMessages]   = useState([]);
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [err, setErr]             = useState('');
  const listRef                   = useRef(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const data = await api(`/api/groups/${group.id}/messages`, 'GET', null, token);
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, group.id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  useEffect(() => {
    if (!incomingMsg) return;
    if (
      incomingMsg.type === 'group_message' &&
      String(incomingMsg.group?.id ?? incomingMsg.group_id) === String(group.id)
    ) {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === incomingMsg.id);
        return exists ? prev : [...prev, incomingMsg];
      });
    }
  }, [incomingMsg, group.id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const sendMessage = async () => {
    const content = text.trim();
    if (!content) return;
    setSending(true);
    setText('');
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: 'group_message', group_id: group.id, content })
        );
        const optimistic = {
          id:         Date.now(),
          content,
          from_user:  currentUser,
          group_id:   group.id,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);
      }
    } catch (e) {
      setErr(e.message);
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const isMine = (msg) => {
    const fid = msg.from_user?.id ?? msg.from_user;
    return String(fid) === String(currentUser.id);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <AppHeader title={group.name} onBack={onBack} />
      <KeyboardAvoidingView style={styles.flex} behavior={KAV_BEHAVIOR}>
        {loading ? (
          <View style={styles.centerFill}><Spinner size="large" /></View>
        ) : (
          <>
            <ErrText msg={err} />
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => String(m.id)}
              contentContainerStyle={styles.msgList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>NO MESSAGES YET</Text>
              }
              renderItem={({ item }) => {
                const mine = isMine(item);
                const senderName =
                  mine
                    ? 'YOU'
                    : item.from_user?.display_name ||
                      item.from_user?.username ||
                      'UNKNOWN';
                return (
                  <View
                    style={[
                      styles.msgRow,
                      mine ? styles.msgRowMine : styles.msgRowTheirs,
                    ]}
                  >
                    <View
                      style={[
                        styles.msgBubble,
                        mine ? styles.bubbleMine : styles.bubbleTheirs,
                      ]}
                    >
                      {!mine && (
                        <Text style={styles.msgSender}>{senderName}</Text>
                      )}
                      <Text style={styles.msgText}>{item.content}</Text>
                      <Text style={styles.msgTime}>
                        {fmtTime(item.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
            <View style={styles.inputRow}>
              <TextInput
                style={styles.chatInput}
                placeholder="MESSAGE..."
                placeholderTextColor={C.muted}
                value={text}
                onChangeText={setText}
                multiline
                maxLength={2000}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                onPress={sendMessage}
                disabled={!text.trim() || sending}
              >
                {sending ? <Spinner /> : <Text style={styles.sendBtnText}>SEND</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// BOT TAB
// ---------------------------------------------------------------------------
function BotTab({ token }) {
  const [messages, setMessages] = useState([
    {
      id:      0,
      role:    'bot',
      content: 'BANNER AI ONLINE. How can I assist you today?',
      ts:      new Date().toISOString(),
    },
  ]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');
  const listRef                 = useRef(null);

  // Typing indicator state
  const [typing, setTyping]     = useState(false);
  const typingTimer             = useRef(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, typing]);

  const sendToBot = async () => {
    const content = text.trim();
    if (!content || loading) return;
    setText('');
    setErr('');

    const userMsg = {
      id:      Date.now(),
      role:    'user',
      content,
      ts:      new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);
    setLoading(true);

    // Simulate streaming feel with a minimum typing delay
    typingTimer.current = setTimeout(async () => {
      try {
        const data = await api('/api/bot/chat', 'POST', { message: content }, token);
        const botMsg = {
          id:      Date.now() + 1,
          role:    'bot',
          content: data.reply || '...',
          ts:      new Date().toISOString(),
        };
        setMessages((prev) => [...prev, botMsg]);
      } catch (e) {
        setErr(e.message);
      } finally {
        setTyping(false);
        setLoading(false);
      }
    }, 400);
  };

  useEffect(() => {
    return () => { if (typingTimer.current) clearTimeout(typingTimer.current); };
  }, []);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={KAV_BEHAVIOR}>
      <View style={styles.botHeader}>
        <Text style={styles.botHeaderText}>BANNER AI</Text>
        <View style={[styles.dot, { backgroundColor: C.green, marginLeft: 8 }]} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={styles.msgList}
        renderItem={({ item }) => {
          const isBot = item.role === 'bot';
          return (
            <View
              style={[
                styles.msgRow,
                isBot ? styles.msgRowTheirs : styles.msgRowMine,
              ]}
            >
              <View
                style={[
                  styles.msgBubble,
                  isBot ? styles.bubbleBotMsg : styles.bubbleMine,
                ]}
              >
                {isBot && (
                  <Text style={styles.botLabel}>BANNER</Text>
                )}
                <Text style={[styles.msgText, isBot && styles.botMsgText]}>
                  {item.content}
                </Text>
                <Text style={styles.msgTime}>{fmtTime(item.ts)}</Text>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          typing ? (
            <View style={[styles.msgRow, styles.msgRowTheirs]}>
              <View style={[styles.msgBubble, styles.bubbleBotMsg]}>
                <Text style={styles.botLabel}>BANNER</Text>
                <TypingDots />
              </View>
            </View>
          ) : null
        }
      />

      <ErrText msg={err} />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.chatInput}
          placeholder="ASK BANNER AI..."
          placeholderTextColor={C.muted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={2000}
          onSubmitEditing={sendToBot}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || loading) && styles.sendBtnDisabled]}
          onPress={sendToBot}
          disabled={!text.trim() || loading}
        >
          {loading ? <Spinner /> : <Text style={styles.sendBtnText}>SEND</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// Animated typing dots
function TypingDots() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setFrame((f) => (f + 1) % 4), 350);
    return () => clearInterval(iv);
  }, []);
  const dots = '.'.repeat(frame);
  return <Text style={[styles.msgText, { color: C.accent }]}>{dots || ' '}</Text>;
}

// ---------------------------------------------------------------------------
// PROFILE TAB
// ---------------------------------------------------------------------------
function ProfileTab({ token, currentUser, onLogout }) {
  const [loading, setLoading]   = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteErr, setInviteErr] = useState('');

  const handleInvite = async () => {
    setLoading(true);
    setInviteErr('');
    try {
      const data = await api('/api/invites', 'POST', {}, token);
      const url = data.invite_url || data.url || '';
      setInviteUrl(url);
      Alert.alert(
        'INVITE LINK GENERATED',
        url,
        [
          {
            text: 'COPY',
            onPress: async () => {
              await Clipboard.setStringAsync(url);
              Alert.alert('COPIED', 'Invite URL copied to clipboard.');
            },
          },
          { text: 'OK' },
        ]
      );
    } catch (e) {
      setInviteErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'LOGOUT',
      'Disconnect from nano-SYNAPSYS?',
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'LOGOUT', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.profileScroll}>
      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>USERNAME</Text>
        <Text style={styles.profileValue}>{currentUser.username}</Text>
      </View>

      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>EMAIL</Text>
        <Text style={styles.profileValue}>{currentUser.email || '—'}</Text>
      </View>

      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>DISPLAY NAME</Text>
        <Text style={styles.profileValue}>{currentUser.display_name || currentUser.username}</Text>
      </View>

      <View style={styles.profileCard}>
        <Text style={styles.profileLabel}>ACCOUNT STATUS</Text>
        <Text
          style={[
            styles.profileValue,
            { color: currentUser.is_approved ? C.green : C.amber },
          ]}
        >
          {currentUser.is_approved ? 'APPROVED' : 'PENDING APPROVAL'}
        </Text>
      </View>

      <View style={styles.profileDivider} />

      <TouchableOpacity
        style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
        onPress={handleInvite}
        disabled={loading}
      >
        {loading ? <Spinner /> : <Text style={styles.primaryBtnText}>GENERATE INVITE LINK</Text>}
      </TouchableOpacity>

      <ErrText msg={inviteErr} />

      {inviteUrl ? (
        <View style={styles.inviteUrlBox}>
          <Text style={styles.inviteUrlLabel}>INVITE URL</Text>
          <Text style={styles.inviteUrlText} selectable>{inviteUrl}</Text>
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={async () => {
              await Clipboard.setStringAsync(inviteUrl);
              Alert.alert('COPIED', 'Invite URL copied to clipboard.');
            }}
          >
            <Text style={styles.copyBtnText}>COPY TO CLIPBOARD</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.profileDivider} />

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>LOGOUT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// HOME SCREEN (tabs + routing)
// ---------------------------------------------------------------------------
function HomeScreen({ token, currentUser, onLogout }) {
  const [activeTab, setActiveTab]     = useState('CHATS');
  const [dmPeer, setDmPeer]           = useState(null);
  const [groupChat, setGroupChat]     = useState(null);
  const [incomingMsg, setIncomingMsg] = useState(null);

  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);
  const backoffRef   = useRef(1000);

  // ------- WebSocket connection -------
  const connectWS = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = 1000;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setIncomingMsg(msg);
      } catch {
        // ignore malformed
      }
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      // Exponential backoff up to 30s
      const delay = Math.min(backoffRef.current, 30000);
      backoffRef.current = Math.min(backoffRef.current * 2, 30000);
      reconnectRef.current = setTimeout(connectWS, delay);
    };
  }, [token]);

  useEffect(() => {
    connectWS();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on unmount
        wsRef.current.close();
      }
    };
  }, [connectWS]);

  // ------- Online user presence -------
  // (incomingMsg of type online_users can be consumed by ChatsTab in the future)

  // ------- Navigation -------
  if (dmPeer) {
    return (
      <DMChatScreen
        token={token}
        currentUser={currentUser}
        peer={dmPeer}
        onBack={() => setDmPeer(null)}
        wsRef={wsRef}
        incomingMsg={incomingMsg}
      />
    );
  }

  if (groupChat) {
    return (
      <GroupChatScreen
        token={token}
        currentUser={currentUser}
        group={groupChat}
        onBack={() => setGroupChat(null)}
        wsRef={wsRef}
        incomingMsg={incomingMsg}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <View style={styles.homeHeader}>
        <Text style={styles.homeTitle}>nano-SYNAPSYS</Text>
        <Text style={styles.homeSubtitle}>AI EVOLUTION MESH</Text>
      </View>

      <View style={styles.flex}>
        {activeTab === 'CHATS' && (
          <ChatsTab
            token={token}
            currentUser={currentUser}
            onOpenDM={(peer) => setDmPeer(peer)}
          />
        )}
        {activeTab === 'GROUPS' && (
          <GroupsTab
            token={token}
            onOpenGroup={(g) => setGroupChat(g)}
          />
        )}
        {activeTab === 'BOT' && (
          <BotTab token={token} />
        )}
        {activeTab === 'PROFILE' && (
          <ProfileTab
            token={token}
            currentUser={currentUser}
            onLogout={onLogout}
          />
        )}
      </View>

      <TabBar active={activeTab} onChange={setActiveTab} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// ROOT APP
// ---------------------------------------------------------------------------
export default function App() {
  const [appState, setAppState] = useState('loading'); // loading | auth | home
  const [token, setToken]       = useState(null);
  const [currentUser, setUser]  = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const storedToken = await loadToken();
        if (!storedToken) {
          setAppState('auth');
          return;
        }
        // Validate token
        const user = await api('/auth/me', 'GET', null, storedToken);
        await saveUser(user);
        setToken(storedToken);
        setUser(user);
        setAppState('home');
      } catch {
        await clearToken();
        await clearUser();
        setAppState('auth');
      }
    })();
  }, []);

  const handleAuth = useCallback((t, u) => {
    setToken(t);
    setUser(u);
    setAppState('home');
  }, []);

  const handleLogout = useCallback(async () => {
    await clearToken();
    await clearUser();
    setToken(null);
    setUser(null);
    setAppState('auth');
  }, []);

  if (appState === 'loading') {
    return (
      <View style={styles.splashScreen}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <Text style={styles.splashTitle}>nano-SYNAPSYS</Text>
        <Text style={styles.splashSub}>AI EVOLUTION</Text>
        <Spinner size="large" />
      </View>
    );
  }

  if (appState === 'auth') {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <HomeScreen
      token={token}
      currentUser={currentUser}
      onLogout={handleLogout}
    />
  );
}

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  // Layout
  flex:        { flex: 1 },
  safeArea:    { flex: 1, backgroundColor: C.bg },
  centerFill:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Splash
  splashScreen: {
    flex:            1,
    backgroundColor: C.bg,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             16,
  },
  splashTitle: {
    fontFamily:  Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:    28,
    fontWeight:  '700',
    color:       C.accent,
    letterSpacing: 2,
    textShadowColor: C.accent,
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
  splashSub: {
    fontFamily:  Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:    12,
    color:       C.dim,
    letterSpacing: 4,
  },

  // AppHeader
  appHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 12,
    paddingVertical:   10,
  },
  appHeaderTitle: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      16,
    fontWeight:    '700',
    color:         C.bright,
    letterSpacing: 1,
    textAlign:     'center',
  },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backBtnText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:   13,
    color:      C.accent,
  },

  // Home header
  homeHeader: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 16,
    paddingVertical:   12,
    alignItems:        'center',
  },
  homeTitle: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      22,
    fontWeight:    '800',
    color:         C.accent,
    letterSpacing: 2,
    textShadowColor: C.accent,
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 0 },
  },
  homeSubtitle: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      10,
    color:         C.dim,
    letterSpacing: 4,
    marginTop:     2,
  },

  // Tab bar
  tabBar: {
    flexDirection:   'row',
    backgroundColor: C.surface,
    borderTopWidth:  1,
    borderTopColor:  C.border,
  },
  tabItem: {
    flex:           1,
    alignItems:     'center',
    paddingVertical: 12,
    position:       'relative',
  },
  tabText: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      10,
    color:         C.dim,
    letterSpacing: 1,
  },
  tabTextActive: {
    color:      C.accent,
    fontWeight: '700',
  },
  tabIndicator: {
    position:        'absolute',
    top:             0,
    left:            '20%',
    right:           '20%',
    height:          2,
    backgroundColor: C.accent,
  },

  // Auth
  authScroll: {
    flexGrow:        1,
    backgroundColor: C.bg,
    padding:         24,
    justifyContent:  'center',
  },
  logoBlock: {
    alignItems:   'center',
    marginBottom: 40,
  },
  logoText: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      26,
    fontWeight:    '800',
    color:         C.accent,
    letterSpacing: 2,
    textShadowColor: C.accent,
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
  logoSub: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      10,
    color:         C.dim,
    letterSpacing: 4,
    marginTop:     6,
  },
  authTabRow: {
    flexDirection:   'row',
    borderWidth:     1,
    borderColor:     C.border,
    marginBottom:    24,
    backgroundColor: C.surface,
  },
  authTab: {
    flex:           1,
    paddingVertical: 10,
    alignItems:     'center',
  },
  authTabActive: {
    backgroundColor: C.panel,
    borderBottomWidth: 2,
    borderBottomColor: C.accent,
  },
  authTabText: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      13,
    color:         C.dim,
    letterSpacing: 1,
  },
  authTabTextActive: {
    color:      C.accent,
    fontWeight: '700',
  },
  authForm: { gap: 12 },

  // Inputs
  input: {
    backgroundColor: C.surface,
    borderWidth:     1,
    borderColor:     C.border,
    color:           C.bright,
    paddingHorizontal: 14,
    paddingVertical:   12,
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      14,
    letterSpacing: 1,
  },
  inputMultiline: {
    minHeight:       90,
    textAlignVertical: 'top',
    paddingTop:      12,
  },

  // Buttons
  primaryBtn: {
    backgroundColor: C.panel,
    borderWidth:     1,
    borderColor:     C.green,
    alignItems:      'center',
    paddingVertical: 14,
  },
  primaryBtnDisabled: {
    borderColor: C.muted,
    opacity:     0.6,
  },
  primaryBtnText: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      14,
    fontWeight:    '700',
    color:         C.accent,
    letterSpacing: 2,
  },
  ghostBtn: {
    backgroundColor: 'transparent',
    borderWidth:     1,
    borderColor:     C.border,
    alignItems:      'center',
    paddingVertical: 14,
  },
  ghostBtnText: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      13,
    color:         C.dim,
    letterSpacing: 1,
  },

  // Errors & empty
  errText: {
    color:      C.red,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:   12,
    paddingHorizontal: 16,
    paddingVertical:    8,
  },
  emptyText: {
    color:      C.muted,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:   13,
    textAlign:  'center',
    marginTop:  40,
    letterSpacing: 2,
  },

  // Lists
  separator: {
    height:          1,
    backgroundColor: C.border,
    marginHorizontal: 0,
  },
  userRow: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: 16,
    paddingVertical:   14,
    backgroundColor:  C.surface,
  },
  userRowLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    flex:          1,
  },
  userRowInfo: { flex: 1, marginLeft: 10 },
  userRowName: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      15,
    color:         C.bright,
    fontWeight:    '600',
  },
  userRowMeta: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:   11,
    color:      C.dim,
    marginTop:  2,
    letterSpacing: 1,
  },
  chevron: {
    color:      C.dim,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:   16,
    marginLeft: 8,
  },

  // Online dot
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    marginLeft:   4,
  },

  // Messages
  msgList: {
    padding:        12,
    paddingBottom:  20,
  },
  msgRow: {
    marginVertical: 4,
    flexDirection:  'row',
  },
  msgRowMine:   { justifyContent: 'flex-end' },
  msgRowTheirs: { justifyContent: 'flex-start' },
  msgBubble: {
    maxWidth:       '78%',
    paddingHorizontal: 12,
    paddingVertical:    8,
    borderWidth:    1,
  },
  bubbleMine: {
    backgroundColor: '#0d2b0d',
    borderColor:     '#00C83230',
    borderRadius:    0,
  },
  bubbleTheirs: {
    backgroundColor: C.surface,
    borderColor:     C.border,
    borderRadius:    0,
  },
  bubbleBotMsg: {
    backgroundColor: '#071407',
    borderColor:     C.borderBright,
    borderRadius:    0,
  },
  msgText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:   14,
    color:      C.text,
    lineHeight: 20,
  },
  botMsgText: { color: C.bright },
  msgSender: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      10,
    color:         C.accent,
    letterSpacing: 1,
    marginBottom:  4,
    fontWeight:    '700',
  },
  botLabel: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      10,
    color:         C.accent,
    letterSpacing: 2,
    fontWeight:    '700',
    marginBottom:  4,
  },
  msgMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     4,
    justifyContent: 'flex-end',
  },
  msgTime: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:   10,
    color:      C.muted,
    marginTop:  4,
  },
  msgRead: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:   10,
    color:      C.green,
  },

  // Chat input
  inputRow: {
    flexDirection:   'row',
    borderTopWidth:  1,
    borderTopColor:  C.border,
    backgroundColor: C.surface,
    padding:         8,
    alignItems:      'flex-end',
  },
  chatInput: {
    flex:            1,
    color:           C.bright,
    backgroundColor: C.panel,
    borderWidth:     1,
    borderColor:     C.border,
    paddingHorizontal: 12,
    paddingVertical:   10,
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      14,
    maxHeight:     120,
    marginRight:   8,
  },
  sendBtn: {
    backgroundColor: C.panel,
    borderWidth:     1,
    borderColor:     C.green,
    paddingHorizontal: 14,
    paddingVertical:   10,
    justifyContent:   'center',
    alignItems:       'center',
    minWidth:         60,
  },
  sendBtnDisabled: {
    borderColor: C.muted,
    opacity:     0.5,
  },
  sendBtnText: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      12,
    color:         C.accent,
    fontWeight:    '700',
    letterSpacing: 1,
  },

  // Groups
  createGroupBtn: {
    backgroundColor: C.panel,
    borderWidth:     1,
    borderColor:     C.green,
    margin:          16,
    paddingVertical: 12,
    alignItems:      'center',
  },
  createGroupBtnText: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      13,
    color:         C.accent,
    fontWeight:    '700',
    letterSpacing: 2,
  },
  createGroupForm: {
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    padding:          16,
    gap:              10,
  },
  formLabel: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      12,
    color:         C.accent,
    letterSpacing: 2,
    marginBottom:  4,
  },
  formBtnRow: {
    flexDirection: 'row',
    marginTop:     4,
  },

  // Bot
  botHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 16,
    paddingVertical:   10,
  },
  botHeaderText: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      14,
    fontWeight:    '700',
    color:         C.accent,
    letterSpacing: 3,
  },

  // Profile
  profileScroll: {
    padding:    16,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: C.surface,
    borderWidth:     1,
    borderColor:     C.border,
    padding:         14,
    marginBottom:    8,
  },
  profileLabel: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      10,
    color:         C.dim,
    letterSpacing: 2,
    marginBottom:  4,
  },
  profileValue: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:   15,
    color:      C.bright,
    fontWeight: '600',
  },
  profileDivider: {
    height:          1,
    backgroundColor: C.border,
    marginVertical:  20,
  },
  inviteUrlBox: {
    backgroundColor: C.panel,
    borderWidth:     1,
    borderColor:     C.borderBright,
    padding:         14,
    marginTop:       12,
    gap:             8,
  },
  inviteUrlLabel: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      10,
    color:         C.accent,
    letterSpacing: 2,
  },
  inviteUrlText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:   12,
    color:      C.text,
    lineHeight: 18,
  },
  copyBtn: {
    backgroundColor: C.surface,
    borderWidth:     1,
    borderColor:     C.border,
    paddingVertical: 8,
    alignItems:      'center',
    marginTop:       4,
  },
  copyBtnText: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      11,
    color:         C.accent,
    letterSpacing: 1,
  },
  logoutBtn: {
    backgroundColor: 'transparent',
    borderWidth:     1,
    borderColor:     C.red,
    paddingVertical: 14,
    alignItems:      'center',
  },
  logoutBtnText: {
    fontFamily:    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize:      14,
    fontWeight:    '700',
    color:         C.red,
    letterSpacing: 2,
  },
});
