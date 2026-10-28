import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import useAppStore from '../store/useAppStore';
import { getSession } from '../api/endpoints';

/**
 * Socket origin. In dev this resolves to the page origin so Vite's `/socket.io`
 * proxy handles it; in production it must come from VITE_API_URL.
 */
function resolveSocketUrl() {
  const raw = import.meta.env.VITE_API_URL?.trim();

  if (!raw) {
    if (import.meta.env.PROD) {
      console.error('[socket] VITE_API_URL is not set — falling back to page origin.');
    }
    return window.location.origin;
  }

  try {
    return new URL(raw, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

const SOCKET_URL = resolveSocketUrl();

let socketInstance: Socket | null = null;
let listenersAttached = false;

function attachListeners(sock: Socket) {
  sock.off('message');
  sock.off('partner_typing');
  sock.off('partner_joined');
  sock.off('partner_left');
  sock.off('call_started');
  sock.off('match_found');
  sock.off('match_waiting');
  sock.off('match_cancelled');
  sock.off('match_no_partner_yet');
  sock.off('waiting_update');
  sock.off('limit_reached');
  sock.off('speaking_topic_changed');
  sock.off('private_room_waiting');
  sock.off('connect_error');
  sock.off('error');

  sock.on('private_room_waiting', () => {
    useAppStore.getState().setMatchingStatus('searching');
  });

  sock.on('match_no_partner_yet', () => {
    useAppStore.getState().setNoPartnerYet(true);
  });

  sock.on('message', (msg) => {
    useAppStore.getState().addMessage(msg);
  });

  sock.on('speaking_topic_changed', ({ topic_id, part, question_index }) => {
    useAppStore.getState().setSpeakingState(topic_id, part, question_index);
  });

  sock.on('partner_typing', () => {
    useAppStore.getState().setPartnerTyping(true);
    setTimeout(() => useAppStore.getState().setPartnerTyping(false), 2000);
  });

  sock.on('partner_joined', () => {
    useAppStore.getState().setPartnerConnected(true);
  });

  sock.on('partner_left', () => {
    const store = useAppStore.getState();
    store.setPartnerConnected(false);
    const { screen, session } = store;
    if (screen === 'chat' || screen === 'matching') {
      if (session) {
        const elapsed = (session as any).startedAt
          ? Math.floor((Date.now() - new Date((session as any).startedAt).getTime()) / 1000)
          : null;
        store.navigate('session_end', { sessionId: session.id, reason: 'partner_left', elapsed });
      } else {
        store.navigate('home');
      }
    }
  });

  sock.on('call_started', ({ livekit_url, livekit_token }) => {
    const store = useAppStore.getState();
    store.setLivekitCredentials(livekit_token, livekit_url);
    store.setCallActive(true);
  });

  sock.on('match_found', ({ session_id, livekit_url, livekit_token }) => {
    const store = useAppStore.getState();
    if (store.screen === 'chat') return;

    store.setMatchingStatus('matched');
    store.setPartnerConnected(false);
    store.setLivekitCredentials(livekit_token, livekit_url);
    store.setCallActive(true);
    store.setSession({ id: session_id, user1_id: 0, user2_id: 0 });
    store.setMessages([]);
    store.navigate('chat', { sessionId: session_id });
    sock.emit('join_session', { session_id });

    getSession(session_id)
      .then((data) => {
        const s = useAppStore.getState();
        if (s.screen !== 'chat') return;
        s.setSession(data.session);
        s.setMessages(data.messages || []);
      })
      .catch((err) => {
        console.error('match_found getSession error:', err);
      });
  });

  sock.on('match_waiting', () => {
    useAppStore.getState().setMatchingStatus('searching');
  });

  sock.on('waiting_update', ({ count }) => {
    useAppStore.getState().setWaitingCount(count || 0);
  });

  sock.on('limit_reached', () => {
    useAppStore.getState().setMatchingStatus('limit_reached');
  });

  sock.off('connect');
  sock.off('disconnect');
  sock.on('connect', () => {
    useAppStore.getState().setConnected(true);
  });
  sock.on('disconnect', (reason) => {
    useAppStore.getState().setConnected(false);
    console.warn('Socket disconnected:', reason);
  });

  sock.on('connect_error', (err) => {
    useAppStore.getState().setConnected(false);
    console.warn('Socket connect error:', err.message);
  });

  sock.on('error', ({ code }) => {
    if (code === 'DUPLICATE_SESSION') {
      console.warn('Duplicate session detected — disconnected by server');
      const store = useAppStore.getState();
      store.clearSession();
      store.navigate('home');
    }
  });

  // 'reconnect' is a MANAGER event in socket.io-client v3+, not a Socket event.
  // `sock.on('reconnect', ...)` never fired, so after a dropped connection the client
  // never re-emitted start_matching / join_session and the user was stuck.
  sock.io.off('reconnect', onReconnect);
  sock.io.on('reconnect', onReconnect);

  listenersAttached = true;
}

function onReconnect() {
  console.log('Socket reconnected — restoring session state');

  const sock = socketInstance;
  if (!sock) return;

  const { matchingStatus, partnerPref, screen, session } = useAppStore.getState();
  if (matchingStatus === 'searching') {
    sock.emit('start_matching', { partnerPref: partnerPref || 'any' });
  } else if (screen === 'chat' && session?.id) {
    sock.emit('join_session', { session_id: session.id });
  }
}

export function useSocket() {
  const token = useAppStore((s) => s.token);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        socketRef.current = null;
        listenersAttached = false;
      }
      return;
    }

    if (socketInstance?.connected) {
      socketRef.current = socketInstance;
      if (!listenersAttached) {
        attachListeners(socketInstance);
      }
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketInstance = socket;
    socketRef.current = socket;
    listenersAttached = false;

    attachListeners(socket);
  }, [token]);

  useEffect(() => {
    const handleAppActive = () => {
      if (document.visibilityState === 'visible' && socketInstance) {
        if (!socketInstance.connected) {
          socketInstance.connect();
        }
      }
    };

    window.addEventListener('online', handleAppActive);
    document.addEventListener('visibilitychange', handleAppActive);
    window.addEventListener('focus', handleAppActive);

    return () => {
      window.removeEventListener('online', handleAppActive);
      document.removeEventListener('visibilitychange', handleAppActive);
      window.removeEventListener('focus', handleAppActive);
    };
  }, []);

  if (socketInstance && !socketRef.current) {
    socketRef.current = socketInstance;
  }

  const joinSession = useCallback((sessionId: string | number) => {
    socketRef.current?.emit('join_session', { session_id: sessionId });
  }, []);

  const sendMessage = useCallback((sessionId: string | number, content: string) => {
    socketRef.current?.emit('send_message', { session_id: sessionId, content });
  }, []);

  const sendTyping = useCallback((sessionId: string | number) => {
    socketRef.current?.emit('typing', { session_id: sessionId });
  }, []);

  const startCall = useCallback((sessionId: string | number) => {
    socketRef.current?.emit('start_call', { session_id: sessionId });
  }, []);

  const startMatching = useCallback((partnerPref = 'any') => {
    socketRef.current?.emit('start_matching', { partnerPref });
  }, []);

  const cancelMatching = useCallback(() => {
    socketRef.current?.emit('cancel_matching');
  }, []);

  const disconnect = useCallback(() => {
    socketInstance?.disconnect();
    socketInstance = null;
    socketRef.current = null;
    listenersAttached = false;
  }, []);

  const changeSpeakingTopic = useCallback(
    (sessionId: string | number, topicId: string, part: number, questionIndex: number) => {
      socketRef.current?.emit('change_speaking_topic', {
        session_id: sessionId,
        topic_id: topicId,
        part,
        question_index: questionIndex,
      });
    },
    []
  );

  const joinPrivateRoom = useCallback((roomCode: string) => {
    socketRef.current?.emit('join_private_room', { room_code: roomCode });
  }, []);

  const leavePrivateRoom = useCallback((roomCode?: string) => {
    socketRef.current?.emit('leave_private_room', { room_code: roomCode });
  }, []);

  return {
    socket: socketRef.current,
    joinSession,
    sendMessage,
    sendTyping,
    startCall,
    startMatching,
    cancelMatching,
    joinPrivateRoom,
    leavePrivateRoom,
    disconnect,
    changeSpeakingTopic,
  };
}
