import http from "http";
import express, { Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import {
  PairLabState,
  PairLabUser,
  PairLabRole,
  PairLabChatMessage,
  PairLabNotebookEntry,
} from "./src/types/pairLab";

interface ConnectedClient {
  ws: WebSocket;
  user: PairLabUser;
  roomId: string;
}

// In-memory store of rooms
const rooms = new Map<string, PairLabState>();
// Map roomId -> Set of connected clients
const roomClients = new Map<string, Set<ConnectedClient>>();

export function createDefaultPairLabState(roomId: string, experimentId: string = "exp-pcr-gel"): PairLabState {
  return {
    roomId,
    experimentId,
    createdAt: new Date().toISOString(),
    activeStage: 1,
    selectedScenario: "scenario_a",
    selectedComponents: [],
    tubeContents: {
      sample: {},
      pos_ctrl: {},
      neg_ctrl: {},
    },
    contaminationDetected: false,
    contaminationReason: "",
    dropletsOnWall: true,
    hasVortexed: false,
    hasCentrifuged: false,
    thermocycler: {
      annealingTemp: 55.0,
      cycleCount: 30,
      heatedLidOn: true,
      pcrRunning: false,
      currentCycle: 0,
      currentStepPhase: "idle",
      currentBlockTemp: 25.0,
      pcrCompleted: false,
    },
    gel: {
      loadingDyeAdded: false,
      loadedWells: {},
      isRunToRed: true,
      electrophoresisVoltage: 100,
      gelRunning: false,
      migrationPercent: 0,
      electrophoresisComplete: false,
    },
    uv: {
      uvTransilluminatorOn: false,
      selectedLadderRung: null,
      studentEstimatedSize: 500,
      studentDiagnosis: "",
      analysisSubmitted: false,
    },
    coordination: {
      stage1VerifiedByA: false,
      stage1VerifiedByB: false,
      masterMixSubmittedByA: false,
      masterMixVerifiedByB: false,
      vortexDone: false,
      centrifugeDone: false,
      thermocyclerArmedByB: false,
      thermocyclerAuthorizedByA: false,
      polarityCheckedByA: false,
      polarityCheckedByB: false,
      diagnosisSignedByA: false,
      diagnosisSignedByB: false,
    },
    notebookLogs: [
      {
        id: `log-init-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        stage: 1,
        author: "System",
        role: "observer",
        action: "Pair Lab Session Initialized",
        details: `Room ${roomId} initialized. Partner A (Bench Chemist) and Partner B (Instrument Engineer) ready.`,
        flag: "normal",
      },
    ],
    chatMessages: [
      {
        id: `chat-sys-${Date.now()}`,
        senderId: "system",
        senderName: "SimLab Assistant",
        senderRole: "observer",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `Welcome to Pair Lab! Partner A leads pipetting and gel loading. Partner B manages mixing, thermal cycling, and transillumination. Coordinate with each other to unlock shared gates.`,
        isSystem: true,
      },
    ],
  };
}

export function getOrCreateRoom(roomId: string): PairLabState {
  const normalizedId = roomId.trim().toUpperCase();
  let room = rooms.get(normalizedId);
  if (!room) {
    room = createDefaultPairLabState(normalizedId);
    rooms.set(normalizedId, room);
  }
  return room;
}

export function broadcastToRoom(roomId: string, message: any, excludeWs?: WebSocket) {
  const clients = roomClients.get(roomId);
  if (!clients) return;

  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function getRoomUsers(roomId: string): PairLabUser[] {
  const clients = roomClients.get(roomId);
  if (!clients) return [];
  return Array.from(clients).map((c) => c.user);
}

export function setupPairLabServer(server: http.Server, app: express.Express) {
  // REST API Routes
  app.get("/api/pair-lab/rooms/:roomId", (req: Request, res: Response) => {
    const roomId = (req.params.roomId || "").toUpperCase();
    const room = rooms.get(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    const activeUsers = getRoomUsers(roomId);
    return res.json({ success: true, room, activeUsers });
  });

  app.post("/api/pair-lab/rooms", (req: Request, res: Response) => {
    const customId = req.body.roomId ? String(req.body.roomId).trim().toUpperCase() : null;
    const randomCode = `LAB-${Math.floor(100 + Math.random() * 900)}`;
    const roomId = customId || randomCode;

    const room = getOrCreateRoom(roomId);
    return res.status(201).json({ success: true, roomId, room });
  });

  app.post("/api/pair-lab/rooms/:roomId/reset", (req: Request, res: Response) => {
    const roomId = (req.params.roomId || "").toUpperCase();
    const freshRoom = createDefaultPairLabState(roomId);
    rooms.set(roomId, freshRoom);
    broadcastToRoom(roomId, {
      type: "state_reset",
      state: freshRoom,
      users: getRoomUsers(roomId),
      message: "Experiment reset by student.",
    });
    return res.json({ success: true, room: freshRoom });
  });

  // WebSocket Server Setup
  const wss = new WebSocketServer({ server, path: "/ws/pair-lab" });

  wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
    const parsedUrl = new URL(req.url || "", "http://localhost:3000");
    const rawRoomId = parsedUrl.searchParams.get("roomId") || "LAB-101";
    const roomId = rawRoomId.trim().toUpperCase();
    const userId = parsedUrl.searchParams.get("userId") || `stu-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const userName = parsedUrl.searchParams.get("name") || "Student";
    const requestedRole = (parsedUrl.searchParams.get("role") || "partner_a") as PairLabRole;

    const room = getOrCreateRoom(roomId);

    // Determine role: if role already occupied, negotiate or allow takeover/observer
    if (!roomClients.has(roomId)) {
      roomClients.set(roomId, new Set());
    }
    const clientsSet = roomClients.get(roomId)!;

    // Check if user is reconnecting
    let assignedRole: PairLabRole = requestedRole;
    const existingClients = Array.from(clientsSet);
    const existingWithRole = existingClients.find((c) => c.user.role === requestedRole && c.user.id !== userId);

    if (existingWithRole) {
      // Suggest alternate role
      if (requestedRole === "partner_a") {
        const hasPartnerB = existingClients.some((c) => c.user.role === "partner_b");
        assignedRole = hasPartnerB ? "observer" : "partner_b";
      } else if (requestedRole === "partner_b") {
        const hasPartnerA = existingClients.some((c) => c.user.role === "partner_a");
        assignedRole = hasPartnerA ? "observer" : "partner_a";
      }
    }

    const roleTitle =
      assignedRole === "partner_a"
        ? "Bench Chemist & Pipetting Lead"
        : assignedRole === "partner_b"
        ? "Instrument Engineer & Thermal Cycler Lead"
        : "Laboratory Observer";

    const user: PairLabUser = {
      id: userId,
      name: userName,
      role: assignedRole,
      roleTitle,
      connectedAt: new Date().toISOString(),
      lastPing: Date.now(),
    };

    const client: ConnectedClient = { ws, user, roomId };
    clientsSet.add(client);

    // Notify new client with current authoritative state
    ws.send(
      JSON.stringify({
        type: "init",
        roomId,
        yourUser: user,
        state: room,
        users: getRoomUsers(roomId),
      })
    );

    // Broadcast user joined to room
    broadcastToRoom(
      roomId,
      {
        type: "user_joined",
        user,
        users: getRoomUsers(roomId),
      },
      ws
    );

    // Also add system log and chat notification
    const joinLog: PairLabNotebookEntry = {
      id: `log-join-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      stage: room.activeStage,
      author: userName,
      role: assignedRole,
      action: "Connected to Station",
      details: `${userName} joined as ${roleTitle}.`,
      flag: "normal",
    };
    room.notebookLogs.push(joinLog);

    const joinChat: PairLabChatMessage = {
      id: `chat-join-${Date.now()}`,
      senderId: "system",
      senderName: "SimLab",
      senderRole: "observer",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      text: `${userName} connected as ${roleTitle}.`,
      isSystem: true,
    };
    room.chatMessages.push(joinChat);

    broadcastToRoom(roomId, {
      type: "chat_message",
      message: joinChat,
    });

    // Handle incoming client messages
    ws.on("message", (rawMessage: string) => {
      try {
        const data = JSON.parse(rawMessage.toString());
        const actionType = data.type;

        if (actionType === "ping") {
          user.lastPing = Date.now();
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }

        if (actionType === "sync_state") {
          // Merge partial state into server room
          const partial = data.partialState || {};
          if (partial.tubeContents) room.tubeContents = partial.tubeContents;
          if (partial.selectedComponents) room.selectedComponents = partial.selectedComponents;
          if (partial.contaminationDetected !== undefined) room.contaminationDetected = partial.contaminationDetected;
          if (partial.contaminationReason !== undefined) room.contaminationReason = partial.contaminationReason;
          if (partial.dropletsOnWall !== undefined) room.dropletsOnWall = partial.dropletsOnWall;
          if (partial.hasVortexed !== undefined) room.hasVortexed = partial.hasVortexed;
          if (partial.hasCentrifuged !== undefined) room.hasCentrifuged = partial.hasCentrifuged;
          if (partial.thermocycler) room.thermocycler = { ...room.thermocycler, ...partial.thermocycler };
          if (partial.gel) room.gel = { ...room.gel, ...partial.gel };
          if (partial.uv) room.uv = { ...room.uv, ...partial.uv };
          if (partial.coordination) room.coordination = { ...room.coordination, ...partial.coordination };
          if (partial.activeStage !== undefined) room.activeStage = partial.activeStage;
          if (partial.selectedScenario) room.selectedScenario = partial.selectedScenario;

          // If action log provided, record it
          if (data.logEntry) {
            const entry: PairLabNotebookEntry = {
              id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              stage: room.activeStage,
              author: user.name,
              role: user.role,
              action: data.logEntry.action || "Action Performed",
              details: data.logEntry.details || "",
              flag: data.logEntry.flag || "normal",
            };
            room.notebookLogs.push(entry);
          }

          broadcastToRoom(
            roomId,
            {
              type: "state_update",
              state: room,
              senderId: user.id,
              senderName: user.name,
              reason: data.reason || "state_sync",
            },
            data.broadcastToSelf ? undefined : ws
          );
          return;
        }

        if (actionType === "stage_change") {
          room.activeStage = Number(data.stage) || 1;
          const stageLog: PairLabNotebookEntry = {
            id: `log-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            stage: room.activeStage,
            author: user.name,
            role: user.role,
            action: `Navigated to Stage ${room.activeStage}`,
            details: `${user.name} advanced the team to Stage ${room.activeStage}.`,
            flag: "normal",
          };
          room.notebookLogs.push(stageLog);

          broadcastToRoom(roomId, {
            type: "state_update",
            state: room,
            senderId: user.id,
            reason: "stage_change",
          });
          return;
        }

        if (actionType === "coordination_action") {
          const action = data.action;

          if (action === "submit_master_mix") {
            room.coordination.masterMixSubmittedByA = true;
            room.notebookLogs.push({
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              stage: 2,
              author: user.name,
              role: user.role,
              action: "Submitted Master Mix for Verification",
              details: "Partner A completed pipetting and requested Partner B review.",
              flag: "normal",
            });
          } else if (action === "verify_master_mix") {
            room.coordination.masterMixVerifiedByB = true;
            room.notebookLogs.push({
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              stage: 2,
              author: user.name,
              role: user.role,
              action: "Master Mix Verified & Co-Signed",
              details: "Partner B verified reaction chemistry and volume totals (25 µL).",
              flag: "success",
            });
          } else if (action === "arm_thermocycler") {
            room.coordination.thermocyclerArmedByB = true;
            room.thermocycler.annealingTemp = data.annealingTemp || room.thermocycler.annealingTemp;
            room.notebookLogs.push({
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              stage: 4,
              author: user.name,
              role: user.role,
              action: "Thermocycler Armed",
              details: `Partner B programmed profile: Annealing ${room.thermocycler.annealingTemp}°C, 30 cycles. Awaiting Partner A authorization.`,
              flag: "normal",
            });
          } else if (action === "authorize_thermocycler") {
            room.coordination.thermocyclerAuthorizedByA = true;
            room.thermocycler.pcrRunning = true;
            room.notebookLogs.push({
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              stage: 4,
              author: user.name,
              role: user.role,
              action: "Thermocycler Run Authorized",
              details: "Partner A authorized run! Heated lid active (105°C), beginning 30 cycles.",
              flag: "success",
            });
          } else if (action === "check_polarity") {
            if (user.role === "partner_a") {
              room.coordination.polarityCheckedByA = true;
            } else {
              room.coordination.polarityCheckedByB = true;
            }
            room.notebookLogs.push({
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              stage: 6,
              author: user.name,
              role: user.role,
              action: "Run-to-Red Polarity Confirmed",
              details: `${user.name} inspected electrodes: Cathode (-) at wells, Anode (+) at buffer end.`,
              flag: "normal",
            });
          } else if (action === "sign_diagnosis") {
            if (user.role === "partner_a") {
              room.coordination.diagnosisSignedByA = true;
            } else {
              room.coordination.diagnosisSignedByB = true;
            }
            if (data.diagnosis) {
              room.uv.studentDiagnosis = data.diagnosis;
              room.uv.studentEstimatedSize = data.estimatedSize || room.uv.studentEstimatedSize;
            }
            room.notebookLogs.push({
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              stage: 7,
              author: user.name,
              role: user.role,
              action: "Clinical Diagnosis Co-Signed",
              details: `${user.name} endorsed diagnosis: ${room.uv.studentDiagnosis} (~${room.uv.studentEstimatedSize} bp).`,
              flag: "success",
            });
          }

          broadcastToRoom(roomId, {
            type: "state_update",
            state: room,
            senderId: user.id,
            reason: `coordination:${action}`,
          });
          return;
        }

        if (actionType === "chat_message") {
          const text = (data.text || "").trim();
          if (!text) return;

          const chatMsg: PairLabChatMessage = {
            id: `chat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            senderId: user.id,
            senderName: user.name,
            senderRole: user.role,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            text,
          };
          room.chatMessages.push(chatMsg);
          // Keep chat history trimmed to last 100
          if (room.chatMessages.length > 100) {
            room.chatMessages.shift();
          }

          broadcastToRoom(roomId, {
            type: "chat_message",
            message: chatMsg,
          });
          return;
        }

        if (actionType === "cursor_move") {
          broadcastToRoom(
            roomId,
            {
              type: "partner_cursor",
              userId: user.id,
              userName: user.name,
              userRole: user.role,
              cursor: data.cursor,
            },
            ws
          );
          return;
        }
      } catch (err) {
        console.error("[PairLab] WS parse error:", err);
      }
    });

    ws.on("close", () => {
      clientsSet.delete(client);
      if (clientsSet.size === 0) {
        // Keep room around for reconnection
      }

      broadcastToRoom(roomId, {
        type: "user_left",
        userId: user.id,
        userName: user.name,
        users: getRoomUsers(roomId),
      });

      const leaveChat: PairLabChatMessage = {
        id: `chat-leave-${Date.now()}`,
        senderId: "system",
        senderName: "SimLab",
        senderRole: "observer",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: `${user.name} disconnected.`,
        isSystem: true,
      };
      room.chatMessages.push(leaveChat);
      broadcastToRoom(roomId, {
        type: "chat_message",
        message: leaveChat,
      });
    });
  });

  console.log("[SimLab] Pair Lab WebSocket server initialized on path /ws/pair-lab");
}
