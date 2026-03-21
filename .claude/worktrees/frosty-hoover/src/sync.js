/**
 * src/sync.js — Delta sync layer for SYNAPTYC
 * Fetches messages since the last stored cursor from the Elixir backend,
 * decrypts them, and persists them to the local SQLCipher database.
 *
 * syncDM and syncGroup now return the count of new messages from OTHER users
 * (not self) so the caller can update unread badge counts.
 */

const { upsertMessages, getLastMsgId, updateCursor, persistMessage } = require('./db');
const { BASE_URL } = require('./constants');

async function apiFetch(path, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json().catch(() => []);
}

/**
 * Sync new DM messages since the last cursor.
 * decryptFn: async (envelopeStr, senderId, token) => plaintext | null
 * @returns {number} count of new messages from the peer (not self)
 */
async function syncDM(peerId, token, decryptFn, myUserId) {
  try {
    const lastId = await getLastMsgId(`dm_${peerId}`);
    const msgs = await apiFetch(`/api/messages/${peerId}?after_id=${lastId}`, token);
    if (!Array.isArray(msgs) || msgs.length === 0) return 0;

    // Decrypt SEQUENTIALLY — Double Ratchet is stateful, concurrent decrypt corrupts session
    const resolved = [];
    let newFromOthers = 0;
    for (const m of msgs) {
      let content = m.content;
      try {
        const sid = String(m.from_user?.id ?? m.from_user ?? m.from ?? '');
        const plain = await decryptFn(m.content, sid, token);
        if (plain !== null) content = plain;
      } catch {}
      // Always persist — even if still encrypted. UI will retry decryption later.
      resolved.push({ ...m, content });
      // Count messages from the peer (not from self)
      const fromId = String(m.from_user?.id ?? m.from_user ?? m.from ?? '');
      if (myUserId && fromId !== String(myUserId)) newFromOthers++;
    }

    if (resolved.length > 0) await upsertMessages(`dm_${peerId}`, resolved);
    const maxId = Math.max(...msgs.map(m => m.id));
    if (maxId > 0) await updateCursor(`dm_${peerId}`, maxId);
    return newFromOthers;
  } catch (e) {
    console.warn('[Sync] syncDM error:', e?.message);
    return 0;
  }
}

/**
 * Sync new group messages since the last cursor.
 * decryptFn: async (envelopeStr, _unused, senderId, groupId) => plaintext | null
 * @returns {number} count of new messages from others (not self)
 */
async function syncGroup(groupId, token, decryptFn, myUserId) {
  try {
    const lastId = await getLastMsgId(`group_${groupId}`);
    const msgs = await apiFetch(`/api/groups/${groupId}/messages?after_id=${lastId}`, token);
    if (!Array.isArray(msgs) || msgs.length === 0) return 0;

    // Decrypt SEQUENTIALLY — sender key chain is stateful, concurrent decrypt corrupts state
    const resolved = [];
    let newFromOthers = 0;
    for (const m of msgs) {
      let content = m.content;
      try {
        const sid = String(m.from_user?.id ?? m.from_user ?? m.from ?? '');
        const plain = await decryptFn(m.content, null, sid, groupId);
        if (plain !== null) content = plain;
      } catch {}
      // Always persist — even if still encrypted. UI batch-decrypt will retry later.
      resolved.push({ ...m, content });
      const fromId = String(m.from_user?.id ?? m.from_user ?? m.from ?? '');
      if (myUserId && fromId !== String(myUserId)) newFromOthers++;
    }

    if (resolved.length > 0) await upsertMessages(`group_${groupId}`, resolved);
    const maxId = Math.max(...msgs.map(m => m.id));
    if (maxId > 0) await updateCursor(`group_${groupId}`, maxId);
    return newFromOthers;
  } catch (e) {
    console.warn('[Sync] syncGroup error:', e?.message);
    return 0;
  }
}

/**
 * Run a full sync pass for a set of DM peers and group IDs.
 * Called on WS connect/reconnect.
 * @returns {{ dm: Object, group: Object }} counts of new messages per conversation
 *   e.g. { dm: { '5': 3, '12': 1 }, group: { '2': 4 } }
 */
async function syncOnConnect(token, dmPeerIds, groupIds, decryptDM, decryptGroup, myUserId) {
  const dmCounts = {};
  const groupCounts = {};

  await Promise.allSettled([
    ...dmPeerIds.map(pid =>
      syncDM(pid, token, decryptDM, myUserId).then(count => {
        if (count > 0) dmCounts[String(pid)] = count;
      })
    ),
    ...groupIds.map(gid =>
      syncGroup(gid, token, decryptGroup, myUserId).then(count => {
        if (count > 0) groupCounts[String(gid)] = count;
      })
    ),
  ]);

  return { dm: dmCounts, group: groupCounts };
}

/**
 * Persist a single incoming WS message after it has been decrypted in App.js.
 * convoKey: 'dm_{peerId}' | 'group_{groupId}'
 */
async function persistIncomingMessage(convoKey, msg, plaintext) {
  try {
    const fromId = String(msg.from_user?.id ?? msg.from_user ?? msg.from ?? '');
    const fromUsername = msg.from_username ?? msg.fromUsername ?? null;
    const fromDisplay = msg.from_display ?? msg.fromDisplay ?? null;
    await persistMessage(convoKey, msg.id, fromId, plaintext, msg.created_at, fromUsername, fromDisplay);
  } catch (e) {
    console.warn('[Sync] persistIncomingMessage error:', e?.message);
  }
}

module.exports = {
  syncDM,
  syncGroup,
  syncOnConnect,
  persistIncomingMessage,
};
