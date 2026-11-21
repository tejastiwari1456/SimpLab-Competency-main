import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PairLabState,
  PairLabUser,
  PairLabRole,
  PairLabChatMessage,
  PairLabNotebookEntry,
} from '../types/pairLab';

interface UsePairLabOptions {
  roomId: string | null;
  userName?: string;
  preferredRole?: PairLabRole;
  enabled?: boolean;
}

export function usePairLab({
  roomId,
  userName = 'Student',
  preferredRole = 'partner_a',
  enabled = true,
}: UsePairLabOptions) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<PairLabState | null>(null);
  const [myUser, setMyUser] = useState<PairLabUser | null>(null);
  const [activeUsers, setActiveUsers] = useState<PairLabUser[]>([]);
  const [partnerCursor, setPartnerCursor] = useState<{
    userId: string;
    userName: string;
    userRole: string;
    cursor: { x: number; y: number; targetId?: string };
  } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  // Generate persistent userId per browser tab session
  const userIdRef = useRef<string>(
    (() => {
      let id = sessionStorage.getItem('simlab_pair_user_id');
      if (!id) {
        id = `stu-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        sessionStorage.setItem('simlab_pair_user_id', id);
      }
      return id;
    })()
  );

  const connect = useCallback(() => {
    if (!roomId || !enabled) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/ws/pair-lab?roomId=${encodeURIComponent(
        roomId
      )}&userId=${encodeURIComponent(userIdRef.current)}&name=${encodeURIComponent(
        userName
      )}&role=${encodeURIComponent(preferredRole)}`;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Start ping heartbeat every 20 seconds
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'init') {
            setRoomState(msg.state);
            setMyUser(msg.yourUser);
            setActiveUsers(msg.users || []);
          } else if (msg.type === 'state_update') {
            setRoomState(msg.state);
            if (msg.reason && msg.senderName && msg.senderId !== userIdRef.current) {
              setNotification(`${msg.senderName}: ${msg.reason}`);
            }
          } else if (msg.type === 'user_joined') {
            setActiveUsers(msg.users || []);
            setNotification(`${msg.user.name} joined as ${msg.user.roleTitle}`);
          } else if (msg.type === 'user_left') {
            setActiveUsers(msg.users || []);
            setNotification(`${msg.userName} disconnected`);
          } else if (msg.type === 'chat_message') {
            setRoomState((prev) => {
              if (!prev) return prev;
              // Check if already in list
              const exists = prev.chatMessages.some((m) => m.id === msg.message.id);
              if (exists) return prev;
              return {
                ...prev,
                chatMessages: [...prev.chatMessages, msg.message],
              };
            });
          } else if (msg.type === 'partner_cursor') {
            setPartnerCursor({
              userId: msg.userId,
              userName: msg.userName,
              userRole: msg.userRole,
              cursor: msg.cursor,
            });
          } else if (msg.type === 'state_reset') {
            setRoomState(msg.state);
            setActiveUsers(msg.users || []);
            setNotification('Session was reset by partner');
          }
        } catch (err) {
          console.error('[usePairLab] Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        // Auto-reconnect after 3s if enabled
        reconnectTimeoutRef.current = setTimeout(() => {
          if (enabled && roomId) {
            connect();
          }
        }, 3000);
      };

      ws.onerror = (err) => {
        console.warn('[usePairLab] WebSocket encountered error:', err);
      };
    } catch (err) {
      console.error('[usePairLab] Failed to connect WebSocket:', err);
    }
  }, [roomId, userName, preferredRole, enabled]);

  useEffect(() => {
    if (enabled && roomId) {
      connect();
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect, enabled, roomId]);

  // Methods to send mutations
  const updateSharedState = useCallback(
    (
      partialState: Partial<PairLabState>,
      reason?: string,
      logEntry?: { action: string; details: string; flag?: 'normal' | 'warning' | 'critical' | 'success' },
      broadcastToSelf: boolean = true
    ) => {
      // Optimistic update
      setRoomState((prev) => (prev ? ({ ...prev, ...partialState } as PairLabState) : prev));

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'sync_state',
            partialState,
            reason,
            logEntry,
            broadcastToSelf,
          })
        );
      }
    },
    []
  );

  const changeStage = useCallback((stage: number) => {
    setRoomState((prev) => (prev ? { ...prev, activeStage: stage } : prev));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stage_change', stage }));
    }
  }, []);

  const sendCoordinationAction = useCallback(
    (action: 'submit_master_mix' | 'verify_master_mix' | 'arm_thermocycler' | 'authorize_thermocycler' | 'check_polarity' | 'sign_diagnosis', data?: any) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'coordination_action',
            action,
            ...data,
          })
        );
      }
    },
    []
  );

  const sendChatMessage = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'chat_message',
          text,
        })
      );
    }
  }, []);

  const sendCursor = useCallback((cursor: { x: number; y: number; targetId?: string }) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'cursor_move',
          cursor,
        })
      );
    }
  }, []);

  const resetRoom = useCallback(() => {
    if (roomId) {
      fetch(`/api/pair-lab/rooms/${encodeURIComponent(roomId)}/reset`, { method: 'POST' }).catch((err) =>
        console.error('Reset error:', err)
      );
    }
  }, [roomId]);

  // Derived partner user
  const partnerUser = activeUsers.find((u) => u.id !== myUser?.id) || null;

  return {
    isConnected,
    roomState,
    myUser,
    partnerUser,
    activeUsers,
    partnerCursor,
    chatMessages: roomState?.chatMessages || [],
    notification,
    clearNotification: () => setNotification(null),
    updateSharedState,
    changeStage,
    sendCoordinationAction,
    sendChatMessage,
    sendCursor,
    resetRoom,
  };
}
