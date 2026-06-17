const { Server } = require('socket.io');
const authService = require('./services/authService');
const chatService = require('./services/chatService');
const attendanceService = require('./services/attendanceService');
const supportSessionService = require('./services/supportSessionService');
const liveStreamService = require('./services/liveStreamService');
const chatbotService = require('./services/chatbotService');
const Wallet = require('./models/wallet');
const Role = require('./models/role');
const UserRole = require('./models/userRole');

// Live session variables
const onlineUsers = new Map(); // userId -> { socketId, user: { id, email, display_name, avatar_url } }
const activeSupportSessions = new Map(); // supportSessionId -> { staffSocketId, guestSocketId, messages: [] }
const raisedHands = new Set(); // Set of userIds who raised hand
const hostReconnectionTimers = new Map(); // streamId -> setTimeout timerId state for late joiners
let blackboardLines = [];       // Cache current whiteboard state for late joiners

// Optional Mediasoup SFU setup
let mediasoup = null;
let mediasoupWorker = null;
let mediasoupRouter = null;

try {
  mediasoup = require('mediasoup');
  console.log('✅ Mediasoup module loaded successfully.');
} catch (err) {
  console.warn('⚠️ Mediasoup module not compiled/available. WebRTC will run in Peer-to-Peer signalling fallback mode.');
}

async function initMediasoup() {
  if (!mediasoup) return;
  try {
    mediasoupWorker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 20000,
      rtcMaxPort: 20100
    });
    
    mediasoupRouter = await mediasoupWorker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000
          }
        }
      ]
    });
    console.log('🚀 Mediasoup worker and media router initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Mediasoup server context:', err);
    mediasoup = null; // Mark unavailable
  }
}

function init(server) {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Try to bootstrap mediasoup in background
  initMediasoup();

  io.on('connection', (socket) => {
    let currentUser = null;

    console.log(`[Socket] Connection attempt: ${socket.id}`);

    // Handle authentication
    socket.on('authenticate', async (token) => {
      try {
        if (!token) throw new Error('Token required');
        const user = await authService.validateSession(token);
        currentUser = user;

        // Fetch user active roles
        let roles = [];
        try {
          const userRoles = await UserRole.findAll({
            where: { user_id: user.id, is_active: true },
            include: [{ model: Role, as: 'role' }]
          });
          roles = userRoles.map(ur => ur.role ? ur.role.name : '').filter(Boolean);
        } catch (roleErr) {
          console.error('[Socket] Error fetching user roles on authenticate:', roleErr);
        }

        // Register online status
        onlineUsers.set(user.id, {
          socketId: socket.id,
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            roles: roles,
            security_clearance: user.security_clearance
          }
        });

        console.log(`[Socket] Authenticated: ${user.display_name} (${user.id})`);

        // Record attendance log
        await attendanceService.logJoin(user.id, 'general-room');

        // Broadcast updated users list
        await broadcastLiveUsers();

        // Sync current raised hands list & blackboard state to the new client
        socket.emit('initial_state', {
          raisedHands: Array.from(raisedHands),
          blackboardLines
        });

        // Notify client authentication succeeded
        socket.emit('authenticated', { success: true });

        // Send active streams list
        socket.emit('active_streams_list', await liveStreamService.getAllActiveStreams());

        // If staff, sync pending and active support sessions
        if (user.security_clearance >= 20) {
          const pending = await supportSessionService.getPendingSessions();
          const active = await supportSessionService.getActiveSessionsForStaff(user.id);
          socket.emit('support_sessions_state', {
            pendingSessions: pending,
            activeSessions: active
          });
        }
      } catch (err) {
        console.error(`[Socket] Authentication failed: ${err.message}`);
        socket.emit('authenticated', { success: false, message: err.message });
      }
    });

    // Public and Private Chat message handler
    socket.on('chat_message', async (payload) => {
      if (!currentUser) return socket.emit('error', 'Unauthenticated');
      try {
        const { recipientId, message, messageType } = payload;
        
        if (recipientId) {
          // If message is private, ensure support session is active or pending
        }

        // Save to DB (normal active/pending human session)
        const saved = await chatService.saveMessage({
          sender_id: currentUser.id,
          recipient_id: recipientId || null,
          message,
          message_type: messageType || 'text'
        });

        if (recipientId) {
          // Private Message: Send to sender socket AND recipient socket if online
          const recipient = onlineUsers.get(recipientId);
          if (recipient) {
            io.to(recipient.socketId).emit('chat_message', saved);
          }
          socket.emit('chat_message', saved);
        } else {
          // Public Message: Broadcast to everyone
          io.emit('chat_message', saved);
        }
      } catch (err) {
        console.error('Error handling chat_message socket event:', err);
      }
    });

    // Real-time message edit handler
    socket.on('edit_message', async (payload) => {
      if (!currentUser) return socket.emit('error', 'Unauthenticated');
      try {
        const { messageId, newMessage } = payload;
        if (!messageId || !newMessage || newMessage.trim() === '') return;
        
        const updated = await chatService.editMessage(messageId, currentUser.id, newMessage);
        if (updated) {
          if (updated.recipient_id) {
            const recipient = onlineUsers.get(updated.recipient_id);
            if (recipient) {
              io.to(recipient.socketId).emit('message_edited', updated);
            }
          }
          socket.emit('message_edited', updated);
        }
      } catch (err) {
        console.error('Error handling edit_message socket event:', err);
      }
    });

    // Real-time read receipts marker
    socket.on('mark_read', async (payload) => {
      if (!currentUser) return socket.emit('error', 'Unauthenticated');
      try {
        const { partnerId } = payload;
        if (!partnerId) return;

        const updatedCount = await chatService.markAsRead(partnerId, currentUser.id);
        if (updatedCount > 0) {
          const partner = onlineUsers.get(partnerId);
          if (partner) {
            io.to(partner.socketId).emit('messages_read', {
              readerId: currentUser.id,
              partnerId: partnerId
            });
          }
          socket.emit('messages_read', {
            readerId: currentUser.id,
            partnerId: partnerId
          });
        }
      } catch (err) {
        console.error('Error handling mark_read socket event:', err);
      }
    });
    socket.on('request_support', async (payload) => {
      const { guestId, name, email } = payload;
      console.log(`[Socket] Support requested by Guest: ${name} (${guestId})`);
      try {
        const session = await supportSessionService.createOrUpdateSession(guestId);

        let assigned = false;
        
        // Find if any online agent has < 5 active sessions
        const onlineStaffList = [];
        for (const entry of onlineUsers.values()) {
          if (entry.user && entry.user.security_clearance >= 20) {
            const count = await supportSessionService.getActiveSessionCountForStaff(entry.user.id);
            if (count < 5) {
              onlineStaffList.push(entry);
            }
          }
        }

        if (onlineStaffList.length > 0) {
          // Auto-claim to first available staff
          const assignedEntry = onlineStaffList[0];
          await supportSessionService.claimSession(guestId, assignedEntry.user.id);
          assigned = true;

          socket.emit('support_claimed', {
            staff: {
              id: assignedEntry.user.id,
              display_name: assignedEntry.user.display_name,
              email: assignedEntry.user.email
            }
          });

          const systemMsg = await chatService.saveMessage({
            sender_id: assignedEntry.user.id,
            recipient_id: guestId,
            message: `System: Support Agent ${assignedEntry.user.display_name} has joined the chat.`,
            message_type: 'system'
          });
          io.to(assignedEntry.socketId).emit('chat_message', systemMsg);
          socket.emit('chat_message', systemMsg);

          // Broadcast that the request has been claimed
          io.emit('support_request_claimed', {
            guestId,
            staffId: assignedEntry.user.id,
            staffName: assignedEntry.user.display_name
          });
        }

        if (!assigned) {
          // Place in queue
          const queueMsg = `System: All customer service agents are currently busy or offline. You have been placed in the queue. Please wait...`;
          const savedQueueMsg = await chatService.saveMessage({
            sender_id: '017b63bc-795c-4a8d-ae0b-6864257e406a',
            recipient_id: guestId,
            message: queueMsg,
            message_type: 'system'
          });
          socket.emit('chat_message', savedQueueMsg);
        }

        await broadcastSessionsStateToStaff();
        await broadcastLiveUsers();
      } catch (err) {
        console.error('Error handling request_support socket:', err);
      }
    });

    // Real-time Support Claim routing (first staff to accept wins)
    socket.on('claim_support', async (payload) => {
      const { guestId, staffId } = payload;
      if (!currentUser) return;

      try {
        if (currentUser.security_clearance >= 20) {
          // Human staff claiming a pending guest ticket
          const activeCount = await supportSessionService.getActiveSessionCountForStaff(currentUser.id);
          if (activeCount >= 5) {
            return socket.emit('error', 'You cannot claim more than 5 active chats. Please close or transfer some sessions first.');
          }

          await supportSessionService.claimSession(guestId, currentUser.id);

          const staffEntry = onlineUsers.get(currentUser.id);
          const staffName = staffEntry?.user?.display_name || 'Staff Support';

          // Save system message to chat history
          const systemMsg = await chatService.saveMessage({
            sender_id: currentUser.id,
            recipient_id: guestId,
            message: `System: Support Agent ${staffName} has joined the chat.`,
            message_type: 'system'
          });

          // Broadcast that the request has been claimed
          io.emit('support_request_claimed', { guestId, staffId: currentUser.id, staffName });

          // Notify the guest directly
          const guestEntry = onlineUsers.get(guestId);
          if (guestEntry) {
            io.to(guestEntry.socketId).emit('support_claimed', {
              staff: {
                id: currentUser.id,
                display_name: staffName,
                email: staffEntry?.user?.email || ''
              }
            });
            io.to(guestEntry.socketId).emit('chat_message', systemMsg);
          }

          socket.emit('chat_message', systemMsg);

          // Always sync all staff members' sessions state and live users
          await broadcastSessionsStateToStaff();
          await broadcastLiveUsers();
        } else {
          // Guest or user selecting an agent
          const session = await supportSessionService.createOrUpdateSession(guestId);
          if (staffId) {
            await session.update({
              settings: { ...session.settings, preferred_staff_id: staffId }
            });
          }

          let assigned = false;
          
          // Try auto-claiming to target agent first
          const targetAgent = onlineUsers.get(staffId);
          if (targetAgent && targetAgent.user && targetAgent.user.security_clearance >= 20) {
            const activeCount = await supportSessionService.getActiveSessionCountForStaff(staffId);
            if (activeCount < 5) {
              await supportSessionService.claimSession(guestId, staffId);
              assigned = true;

              socket.emit('support_claimed', {
                staff: {
                  id: staffId,
                  display_name: targetAgent.user.display_name,
                  email: targetAgent.user.email
                }
              });

              const systemMsg = await chatService.saveMessage({
                sender_id: staffId,
                recipient_id: guestId,
                message: `System: Support Agent ${targetAgent.user.display_name} has joined the chat.`,
                message_type: 'system'
              });
              io.to(targetAgent.socketId).emit('chat_message', systemMsg);
              socket.emit('chat_message', systemMsg);

              // Broadcast that the request has been claimed
              io.emit('support_request_claimed', {
                guestId,
                staffId: staffId,
                staffName: targetAgent.user.display_name
              });
            }
          }

          if (!assigned) {
            // Find any online agent with < 5 active sessions
            const onlineStaffList = [];
            for (const entry of onlineUsers.values()) {
              if (entry.user && entry.user.security_clearance >= 20) {
                const count = await supportSessionService.getActiveSessionCountForStaff(entry.user.id);
                if (count < 5) {
                  onlineStaffList.push(entry);
                }
              }
            }

            if (onlineStaffList.length > 0) {
              const assignedEntry = onlineStaffList[0];
              await supportSessionService.claimSession(guestId, assignedEntry.user.id);
              assigned = true;

              socket.emit('support_claimed', {
                staff: {
                  id: assignedEntry.user.id,
                  display_name: assignedEntry.user.display_name,
                  email: assignedEntry.user.email
                }
              });

              const systemMsg = await chatService.saveMessage({
                sender_id: assignedEntry.user.id,
                recipient_id: guestId,
                message: `System: Support Agent ${assignedEntry.user.display_name} has joined the chat.`,
                message_type: 'system'
              });
              io.to(assignedEntry.socketId).emit('chat_message', systemMsg);
              socket.emit('chat_message', systemMsg);

              // Broadcast that the request has been claimed
              io.emit('support_request_claimed', {
                guestId,
                staffId: assignedEntry.user.id,
                staffName: assignedEntry.user.display_name
              });
            }
          }

          if (!assigned) {
            // Placed in queue
            const queueMsg = `System: All customer service agents are currently busy or offline. You have been placed in the queue. Please wait...`;
            const savedQueueMsg = await chatService.saveMessage({
              sender_id: staffId || '017b63bc-795c-4a8d-ae0b-6864257e406a',
              recipient_id: guestId,
              message: queueMsg,
              message_type: 'system'
            });
            socket.emit('chat_message', savedQueueMsg);
          }

          await broadcastSessionsStateToStaff();
          await broadcastLiveUsers();
        }
      } catch (err) {
        console.error('Error handling claim_support socket:', err);
      }
    });

    // Real-time Support Transfer routing
    socket.on('transfer_support', async (payload) => {
      const { guestId, targetStaffId } = payload;
      if (!currentUser) return socket.emit('error', 'Unauthenticated');

      console.log(`[Socket] Support transfer requested for Guest ${guestId} to Staff ${targetStaffId} by ${currentUser.display_name}`);

      try {
        // Enforce transfer capacity checks on target agent
        const activeCount = await supportSessionService.getActiveSessionCountForStaff(targetStaffId);
        if (activeCount >= 5) {
          return socket.emit('error', 'Cannot transfer: Target agent is busy with 5 or more active chats.');
        }

        await supportSessionService.transferSession(guestId, targetStaffId);

        const targetStaffEntry = onlineUsers.get(targetStaffId);
        const targetStaffName = targetStaffEntry?.user?.display_name || 'Staff Support';
        const oldStaffName = currentUser.display_name;

        // Save system message to chat history
        const systemMsg = await chatService.saveMessage({
          sender_id: targetStaffId,
          recipient_id: guestId,
          message: `System: This chat has been transferred from ${oldStaffName} to ${targetStaffName}.`,
          message_type: 'system'
        });

        // Notify guest of transfer
        const guestEntry = onlineUsers.get(guestId);
        if (guestEntry) {
          io.to(guestEntry.socketId).emit('support_transferred_guest', {
            staff: {
              id: targetStaffId,
              display_name: targetStaffName,
              email: targetStaffEntry?.user?.email || ''
            }
          });
          io.to(guestEntry.socketId).emit('chat_message', systemMsg);
        }

        // Notify old staff to remove from active list
        socket.emit('support_transferred_out', { guestId });
        socket.emit('chat_message', systemMsg);

        // Notify new staff to add to active list
        if (targetStaffEntry) {
          io.to(targetStaffEntry.socketId).emit('support_transferred_in', {
            guest: {
              id: guestId,
              display_name: guestEntry?.user?.display_name || 'Guest',
              email: guestEntry?.user?.email || ''
            }
          });
          io.to(targetStaffEntry.socketId).emit('chat_message', systemMsg);
        }

        // Always sync all staff members' sessions state and live users
        await broadcastSessionsStateToStaff();
        await broadcastLiveUsers();
      } catch (err) {
        console.error('Error handling transfer_support socket:', err);
      }
    });

    // Real-time Support Close routing
    socket.on('close_support', async (payload) => {
      const { guestId } = payload;
      if (!currentUser) return socket.emit('error', 'Unauthenticated');

      console.log(`[Socket] Support session closed for Guest ${guestId}`);
      try {
        await supportSessionService.closeSession(guestId);

        const systemMsg = await chatService.saveMessage({
          sender_id: currentUser.id,
          recipient_id: guestId,
          message: `System: The support session has been closed.`,
          message_type: 'system'
        });

        // Notify guest
        const guestEntry = onlineUsers.get(guestId);
        if (guestEntry) {
          io.to(guestEntry.socketId).emit('support_closed', { guestId });
          io.to(guestEntry.socketId).emit('chat_message', systemMsg);
        }

        // Notify staff
        socket.emit('support_closed', { guestId });
        socket.emit('chat_message', systemMsg);

        // Always sync all staff members' sessions state and live users
        await broadcastSessionsStateToStaff();
        await broadcastLiveUsers();
      } catch (err) {
        console.error('Error handling close_support socket:', err);
      }
    });

    // Blackboard drawing events sync
    socket.on('draw', (drawData) => {
      if (!currentUser) return;
      blackboardLines.push(drawData);
      // Cap cached drawing strokes to prevent memory bloat
      if (blackboardLines.length > 5000) blackboardLines.shift();
      // Broadcast draw event to all OTHER clients
      socket.broadcast.emit('draw', drawData);
    });

    socket.on('draw_clear', () => {
      if (!currentUser) return;
      blackboardLines = [];
      io.emit('draw_clear');
    });

    // Raise hand interaction loggers
    socket.on('hand_raise', () => {
      if (!currentUser) return;
      raisedHands.add(currentUser.id);
      io.emit('hand_status_changed', { userId: currentUser.id, raised: true });
    });

    socket.on('hand_lower', () => {
      if (!currentUser) return;
      raisedHands.delete(currentUser.id);
      io.emit('hand_status_changed', { userId: currentUser.id, raised: false });
    });

    // ─── LIVE STREAM SOCKET HANDLERS ───
    socket.on('create_stream', async (payload) => {
      if (!currentUser) return socket.emit('error', 'Unauthenticated');
      const { streamId } = payload;
      if (!streamId) return socket.emit('error', 'Stream ID is required');

      try {
        // Handle host reconnection and re-claiming the active stream
        const existingStream = await liveStreamService.getStream(streamId);
        if (existingStream && existingStream.hostUserId === currentUser.id) {
          const pendingTimer = hostReconnectionTimers.get(streamId);
          if (pendingTimer) {
            clearTimeout(pendingTimer);
            hostReconnectionTimers.delete(streamId);
          }
          console.log(`[Socket] Host re-claiming active stream ${streamId}.`);
          
          existingStream.participants.add(socket.id);
          await liveStreamService.saveStream(existingStream);
          
          socket.join(`stream-${streamId}`);
          
          io.to(`stream-${streamId}`).emit('host_reconnected', { streamId });
          
          const hostWallet = await Wallet.findOne({ where: { user_id: currentUser.id } });
          
          const participantsList = Array.from(existingStream.participants).map(sid => {
            const entry = Array.from(onlineUsers.values()).find(e => e.socketId === sid);
            return entry ? entry.user : null;
          }).filter(Boolean);

          return socket.emit('create_stream_response', { 
            success: true, 
            streamId, 
            remainingPoints: hostWallet ? hostWallet.points_balance : 0, 
            feeCharged: 0,
            layout: existingStream.layout || 'tiktok',
            commentsBlocked: !!existingStream.commentsBlocked,
            subhosts: existingStream.subhosts || [],
            participantsList
          });
        }

        const isHosting = await liveStreamService.isUserHosting(currentUser.id);
        if (isHosting) {
          return socket.emit('create_stream_response', { success: false, message: 'You are already hosting an active live stream.' });
        }

        const chargeRes = await liveStreamService.chargeHostStreamFee(currentUser.id);

        const stream = {
          streamId,
          hostUserId: currentUser.id,
          hostName: currentUser.display_name,
          participants: new Set([socket.id]),
          maxParticipants: 10,
          subhosts: [],
          commentsBlocked: false,
          layout: 'tiktok',
          blockedUsers: [],
          suspendedUsers: []
        };
        await liveStreamService.saveStream(stream);

        socket.join(`stream-${streamId}`);
        console.log(`[Socket] Stream created: ${streamId} by ${currentUser.display_name}`);

        socket.emit('create_stream_response', { 
          success: true, 
          streamId, 
          remainingPoints: chargeRes.remainingPoints,
          feeCharged: chargeRes.feeCharged,
          layout: 'tiktok',
          commentsBlocked: false,
          subhosts: []
        });

        await broadcastActiveStreams();
      } catch (err) {
        console.error('[Socket] Error in create_stream:', err.message);
        socket.emit('create_stream_response', { success: false, message: err.message });
      }
    });

    socket.on('join_stream', async (payload) => {
      if (!currentUser) return socket.emit('error', 'Unauthenticated');
      const { streamId } = payload;
      if (!streamId) return socket.emit('error', 'Stream ID is required');

      try {
        const stream = await liveStreamService.getStream(streamId);
        if (!stream) {
          return socket.emit('join_stream_response', { success: false, message: 'Live stream not found.' });
        }

        if (stream.blockedUsers?.includes(currentUser.id)) {
          return socket.emit('join_stream_response', { success: false, message: 'You are blocked from joining this stream.' });
        }

        if (stream.suspendedUsers?.includes(currentUser.id)) {
          return socket.emit('join_stream_response', { success: false, message: 'You are suspended from this stream.' });
        }

        if (stream.participants.size >= stream.maxParticipants) {
          return socket.emit('join_stream_response', { success: false, message: `Room limit reached. Maximum participants: ${stream.maxParticipants}.` });
        }

        stream.participants.add(socket.id);
        await liveStreamService.saveStream(stream);

        socket.join(`stream-${streamId}`);
        console.log(`[Socket] Client joined stream: ${streamId} — User: ${currentUser.display_name}`);

        const participantsList = Array.from(stream.participants).map(sid => {
          const entry = Array.from(onlineUsers.values()).find(e => e.socketId === sid);
          return entry ? entry.user : null;
        }).filter(Boolean);

        const hostEntry = onlineUsers.get(stream.hostUserId);
        const hostAvatar = hostEntry?.user?.avatar_url || '';

        socket.emit('join_stream_response', { 
          success: true, 
          streamId, 
          hostName: stream.hostName, 
          hostUserId: stream.hostUserId,
          hostAvatar,
          layout: stream.layout || 'tiktok',
          commentsBlocked: !!stream.commentsBlocked,
          subhosts: stream.subhosts || [],
          participantsList
        });

        socket.to(`stream-${streamId}`).emit('user_joined_stream', { 
          userId: currentUser.id, 
          socketId: socket.id,
          display_name: currentUser.display_name,
          user: {
            id: currentUser.id,
            display_name: currentUser.display_name,
            avatar_url: currentUser.avatar_url
          }
        });

        await broadcastActiveStreams();
      } catch (err) {
        console.error('[Socket] Error in join_stream:', err.message);
        socket.emit('join_stream_response', { success: false, message: err.message });
      }
    });

    socket.on('leave_stream', async (payload) => {
      if (!currentUser) return;
      const { streamId } = payload;
      if (!streamId) return;

      try {
        const stream = await liveStreamService.getStream(streamId);
        if (stream) {
          stream.participants.delete(socket.id);
          socket.leave(`stream-${streamId}`);

          const isHostUser = stream.hostUserId === currentUser.id;

          if (isHostUser) {
            console.log(`[Socket] Host left stream: ${streamId}`);
            const ended = await checkAndEndStreamIfAbandoned(stream);
            if (!ended) {
              await liveStreamService.saveStream(stream);
              io.to(`stream-${streamId}`).emit('host_temporary_offline', { streamId, gracePeriod: 999999 });
            }
          } else {
            if (stream.subhosts && stream.subhosts.includes(currentUser.id)) {
              stream.subhosts = stream.subhosts.filter(id => id !== currentUser.id);
              io.to(`stream-${streamId}`).emit('subhosts_updated', { subhosts: stream.subhosts });
            }
            await liveStreamService.saveStream(stream);
            socket.to(`stream-${streamId}`).emit('user_left_stream', { 
              userId: currentUser.id, 
              socketId: socket.id 
            });
            console.log(`[Socket] Viewer/Subhost left stream: ${streamId}`);
            await checkAndEndStreamIfAbandoned(stream);
          }

          await broadcastActiveStreams();
        }
      } catch (err) {
        console.error('[Socket] Error in leave_stream:', err.message);
      }
    });

    socket.on('end_stream', async (payload) => {
      if (!currentUser) return;
      const { streamId } = payload;
      if (!streamId) return;

      try {
        const stream = await liveStreamService.getStream(streamId);
        if (!stream) return;

        if (stream.hostUserId !== currentUser.id) {
          return socket.emit('error', 'Only the main host can end the live stream.');
        }

        console.log(`[Socket] Host explicitly ended stream: ${streamId}`);
        io.to(`stream-${streamId}`).emit('stream_ended', { streamId });
        await liveStreamService.removeStream(streamId);
        await broadcastActiveStreams();
      } catch (err) {
        console.error('[Socket] Error in end_stream:', err.message);
      }
    });

    // Subhost management
    socket.on('assign_subhost', async (payload) => {
      if (!currentUser) return;
      const { streamId, userId } = payload;
      try {
        const stream = await liveStreamService.getStream(streamId);
        if (!stream) return;
        if (stream.hostUserId !== currentUser.id) {
          return socket.emit('error', 'Only the host can assign subhosts.');
        }
        if (!stream.subhosts) stream.subhosts = [];
        if (!stream.subhosts.includes(userId)) {
          stream.subhosts.push(userId);
          await liveStreamService.saveStream(stream);
        }
        io.to(`stream-${streamId}`).emit('subhosts_updated', { subhosts: stream.subhosts });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('remove_subhost', async (payload) => {
      if (!currentUser) return;
      const { streamId, userId } = payload;
      try {
        const stream = await liveStreamService.getStream(streamId);
        if (!stream) return;
        if (stream.hostUserId !== currentUser.id) {
          return socket.emit('error', 'Only the host can remove subhosts.');
        }
        if (stream.subhosts) {
          stream.subhosts = stream.subhosts.filter(id => id !== userId);
          await liveStreamService.saveStream(stream);
        }
        io.to(`stream-${streamId}`).emit('subhosts_updated', { subhosts: stream.subhosts || [] });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('mute_participant', async (payload) => {
      if (!currentUser) return;
      const { streamId, userId, mediaType } = payload;
      try {
        const stream = await liveStreamService.getStream(streamId);
        if (!stream) return;
        if (stream.hostUserId !== currentUser.id) {
          return socket.emit('error', 'Only the host can mute other participants.');
        }
        io.to(`stream-${streamId}`).emit('force_mute_participant', { userId, mediaType });
      } catch (err) {
        console.error('[Socket] Error in mute_participant:', err);
      }
    });

    // Layout management (Host and Subhosts can change)
    socket.on('change_layout', async (payload) => {
      if (!currentUser) return;
      const { streamId, layout } = payload;
      try {
        const stream = await liveStreamService.getStream(streamId);
        if (!stream) return;
        
        const isHost = stream.hostUserId === currentUser.id;
        const isSubhost = stream.subhosts?.includes(currentUser.id);
        
        if (!isHost && !isSubhost) {
          return socket.emit('error', 'Unauthorized to change layout.');
        }

        stream.layout = layout;
        await liveStreamService.saveStream(stream);
        io.to(`stream-${streamId}`).emit('layout_changed', { layout });
      } catch (err) {
        console.error(err);
      }
    });

    // Moderation (Only Host)
    socket.on('moderate_user', async (payload) => {
      if (!currentUser) return;
      const { streamId, userId, action } = payload; // 'block', 'suspend', 'unblock'
      try {
        const stream = await liveStreamService.getStream(streamId);
        if (!stream) return;
        
        if (stream.hostUserId !== currentUser.id) {
          return socket.emit('error', 'Only the host can moderate users.');
        }

        if (!stream.blockedUsers) stream.blockedUsers = [];
        if (!stream.suspendedUsers) stream.suspendedUsers = [];

        if (action === 'block') {
          if (!stream.blockedUsers.includes(userId)) {
            stream.blockedUsers.push(userId);
          }
          stream.suspendedUsers = stream.suspendedUsers.filter(id => id !== userId);
        } else if (action === 'suspend') {
          if (!stream.suspendedUsers.includes(userId)) {
            stream.suspendedUsers.push(userId);
          }
        } else if (action === 'unblock') {
          stream.blockedUsers = stream.blockedUsers.filter(id => id !== userId);
          stream.suspendedUsers = stream.suspendedUsers.filter(id => id !== userId);
        }

        await liveStreamService.saveStream(stream);
        
        // Broadcast moderation event
        io.to(`stream-${streamId}`).emit('user_moderated', { userId, action });
        
        // Disconnect moderated user from stream room
        const targetUserEntry = onlineUsers.get(userId);
        if (targetUserEntry) {
          const targetSocket = io.sockets.sockets.get(targetUserEntry.socketId);
          if (targetSocket) {
            targetSocket.leave(`stream-${streamId}`);
            targetSocket.emit('kicked_from_stream', { streamId, reason: action });
          }
        }
      } catch (err) {
        console.error(err);
      }
    });

    // Comment blockage configuration (Only Host)
    socket.on('moderate_comments', async (payload) => {
      if (!currentUser) return;
      const { streamId, commentsBlocked } = payload;
      try {
        const stream = await liveStreamService.getStream(streamId);
        if (!stream) return;
        
        if (stream.hostUserId !== currentUser.id) {
          return socket.emit('error', 'Only the host can block comments.');
        }

        stream.commentsBlocked = commentsBlocked;
        await liveStreamService.saveStream(stream);
        io.to(`stream-${streamId}`).emit('comments_moderated', { commentsBlocked });
      } catch (err) {
        console.error(err);
      }
    });

    // Subhost Invite viewer
    socket.on('invite_user', async (payload) => {
      if (!currentUser) return;
      const { streamId, targetUserId } = payload;
      try {
        const stream = await liveStreamService.getStream(streamId);
        if (!stream) return;

        const isHost = stream.hostUserId === currentUser.id;
        const isSubhost = stream.subhosts?.includes(currentUser.id);
        if (!isHost && !isSubhost) {
          return socket.emit('error', 'Unauthorized to invite users.');
        }

        const targetUserEntry = onlineUsers.get(targetUserId);
        if (targetUserEntry) {
          io.to(targetUserEntry.socketId).emit('stream_invite', {
            streamId,
            invitedBy: currentUser.display_name,
            hostName: stream.hostName
          });
        }
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('send_stream_comment', async (payload) => {
      if (!currentUser) return;
      const { streamId, comment } = payload;
      if (!streamId || !comment) return;

      try {
        const stream = await liveStreamService.getStream(streamId);
        if (stream) {
          if (stream.commentsBlocked) {
            return socket.emit('error', 'Commenting is blocked in this stream.');
          }
          if (stream.blockedUsers?.includes(currentUser.id) || stream.suspendedUsers?.includes(currentUser.id)) {
            return socket.emit('error', 'You are blocked or suspended from this stream.');
          }
        }

        // Log interaction to DB
        await liveStreamService.logInteraction(streamId, currentUser.id, 'chat', comment);

        const commentId = Math.random().toString(36).substring(2, 11);
        io.to(`stream-${streamId}`).emit('stream_comment', {
          commentId,
          userId: currentUser.id,
          display_name: currentUser.display_name,
          avatar_url: currentUser.avatar_url,
          comment,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('edit_stream_comment', async (payload) => {
      if (!currentUser) return;
      const { streamId, commentId, newComment } = payload;
      if (!streamId || !commentId || !newComment) return;

      try {
        const stream = await liveStreamService.getStream(streamId);
        const isHost = stream && stream.hostUserId === currentUser.id;
        const isSubhost = stream && stream.subhosts?.includes(currentUser.id);

        io.to(`stream-${streamId}`).emit('stream_comment_edited', {
          commentId,
          newComment,
          editedBy: currentUser.id,
          isModeratorEdit: isHost || isSubhost
        });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('delete_stream_comment', async (payload) => {
      if (!currentUser) return;
      const { streamId, commentId } = payload;
      if (!streamId || !commentId) return;

      try {
        const stream = await liveStreamService.getStream(streamId);
        const isHost = stream && stream.hostUserId === currentUser.id;
        const isSubhost = stream && stream.subhosts?.includes(currentUser.id);

        io.to(`stream-${streamId}`).emit('stream_comment_deleted', {
          commentId,
          deletedBy: currentUser.id,
          isModeratorDelete: isHost || isSubhost
        });
      } catch (err) {
        console.error(err);
      }
    });

    socket.on('like_stream', async (payload) => {
      if (!currentUser) return;
      const { streamId } = payload;
      if (!streamId) return;
      
      try {
        const result = await liveStreamService.logInteraction(streamId, currentUser.id, 'like');
        
        io.to(`stream-${streamId}`).emit('stream_like', {
          userId: currentUser.id,
          display_name: currentUser.display_name
        });

        // Update viewer's wallet points balance
        socket.emit('wallet_updated', {
          points_balance: result.viewerNewPoints
        });

        if (result && result.milestoneReached) {
          const stream = await liveStreamService.getStream(streamId);
          const hostUserId = stream?.hostUserId;
          
          if (hostUserId) {
            const hostEntry = onlineUsers.get(hostUserId);
            if (hostEntry) {
              io.to(hostEntry.socketId).emit('wallet_updated', {
                points_balance: result.hostNewPoints
              });
            }
          }

          io.to(`stream-${streamId}`).emit('stream_comment', {
            commentId: 'milestone-' + Date.now(),
            type: 'system',
            comment: `🎉 Milestone reached! This stream has received ${result.likeCount} likes from viewers. Host awarded 10 bonus points!`
          });
        }
      } catch (err) {
        console.error('Error in like_stream socket event:', err);
        socket.emit('error', err.message);
      }
    });

    socket.on('tip_stream', async (payload) => {
      if (!currentUser) return;
      const { streamId, hostUserId, amount, giftEmoji, giftName } = payload;
      if (!streamId || !hostUserId || !amount) return;

      try {
        const result = await liveStreamService.tipHostPoints(currentUser.id, hostUserId, amount);
        io.to(`stream-${streamId}`).emit('stream_tipped', {
          senderUserId: currentUser.id,
          senderName: currentUser.display_name,
          hostUserId,
          amount,
          giftEmoji: giftEmoji || null,
          giftName: giftName || null,
          senderRemainingPoints: result.senderRemainingPoints
        });
        
        // Update host wallet points
        const hostEntry = onlineUsers.get(hostUserId);
        if (hostEntry) {
          io.to(hostEntry.socketId).emit('wallet_updated', {
            points_balance: result.hostNewPoints
          });
        }

        // Update sender wallet points
        socket.emit('wallet_updated', {
          points_balance: result.senderRemainingPoints
        });
      } catch (err) {
        socket.emit('error', err.message);
      }
    });

    socket.on('toggle_media_state', (payload) => {
      if (!currentUser) return;
      const { streamId, camMuted, micMuted } = payload;
      if (!streamId) return;

      socket.to(`stream-${streamId}`).emit('user_media_state_changed', {
        userId: currentUser.id,
        camMuted,
        micMuted
      });
    });

    // WebRTC Peer-to-Peer Signalling Fallback logic
    socket.on('rtc_offer', (payload) => {
      if (!currentUser) return;
      const { targetUserId, sdp } = payload;
      const recipient = onlineUsers.get(targetUserId);
      if (recipient) {
        io.to(recipient.socketId).emit('rtc_offer', {
          senderUserId: currentUser.id,
          sdp
        });
      }
    });

    socket.on('rtc_answer', (payload) => {
      if (!currentUser) return;
      const { targetUserId, sdp } = payload;
      const recipient = onlineUsers.get(targetUserId);
      if (recipient) {
        io.to(recipient.socketId).emit('rtc_answer', {
          senderUserId: currentUser.id,
          sdp
        });
      }
    });

    socket.on('rtc_ice_candidate', (payload) => {
      if (!currentUser) return;
      const { targetUserId, candidate } = payload;
      const recipient = onlineUsers.get(targetUserId);
      if (recipient) {
        io.to(recipient.socketId).emit('rtc_ice_candidate', {
          senderUserId: currentUser.id,
          candidate
        });
      }
    });

    // Mediasoup SFU Signaling (Optional handlers mapped if Mediasoup is running)
    socket.on('getRouterRtpCapabilities', (callback) => {
      if (mediasoupRouter) {
        callback(mediasoupRouter.rtpCapabilities);
      } else {
        callback(null);
      }
    });

    // Handle Client Disconnect
    socket.on('disconnect', async (reason) => {
      console.log(`[Socket] Disconnected: ${socket.id} — Reason: ${reason}`);
      if (currentUser) {
        // Log leave session
        await attendanceService.logLeave(currentUser.id, 'general-room');
        
        // Remove from online mapping
        onlineUsers.delete(currentUser.id);
        raisedHands.delete(currentUser.id);
        
        // Clean up user's active streams
        try {
          const activeStreams = await liveStreamService.getAllActiveStreams();
          for (const sSummary of activeStreams) {
            const stream = await liveStreamService.getStream(sSummary.streamId);
            if (stream && stream.participants.has(socket.id)) {
              stream.participants.delete(socket.id);
              
              const isHostUser = stream.hostUserId === currentUser.id;

              if (isHostUser) {
                console.log(`[Socket] Host disconnected from stream ${stream.streamId}.`);
                
                let hasActiveSubhost = false;
                if (stream.subhosts && stream.subhosts.length > 0) {
                  for (const sid of stream.participants) {
                    const entry = Array.from(onlineUsers.values()).find(e => e.socketId === sid);
                    if (sid !== socket.id && entry && entry.user && stream.subhosts.includes(entry.user.id)) {
                      hasActiveSubhost = true;
                      break;
                    }
                  }
                }

                if (hasActiveSubhost) {
                  console.log(`[Socket] Host disconnected, keeping stream alive due to active subhosts.`);
                  await liveStreamService.saveStream(stream);
                  io.to(`stream-${stream.streamId}`).emit('host_temporary_offline', { streamId: stream.streamId, gracePeriod: 999999 });
                } else {
                  console.log(`[Socket] Host disconnected. No active subhosts. Starting 15s grace period.`);
                  io.to(`stream-${stream.streamId}`).emit('host_temporary_offline', { streamId: stream.streamId, gracePeriod: 15 });
                  
                  const timer = setTimeout(async () => {
                    hostReconnectionTimers.delete(stream.streamId);
                    console.log(`[Socket] Host grace period expired. Ending stream.`);
                    io.to(`stream-${stream.streamId}`).emit('stream_ended', { streamId: stream.streamId });
                    await liveStreamService.removeStream(stream.streamId);
                    await broadcastActiveStreams();
                  }, 15000);
                  
                  hostReconnectionTimers.set(stream.streamId, timer);
                  await liveStreamService.saveStream(stream);
                }
              } else {
                if (stream.subhosts && stream.subhosts.includes(currentUser.id)) {
                  stream.subhosts = stream.subhosts.filter(id => id !== currentUser.id);
                  io.to(`stream-${stream.streamId}`).emit('subhosts_updated', { subhosts: stream.subhosts });
                }
                await liveStreamService.saveStream(stream);
                io.to(`stream-${stream.streamId}`).emit('user_left_stream', { userId: currentUser.id, socketId: socket.id, display_name: currentUser.display_name });
                await checkAndEndStreamIfAbandoned(stream);
              }
            }
          }
          await broadcastActiveStreams();
        } catch (streamCleanErr) {
          console.error('[Socket] Error cleaning streams on disconnect:', streamCleanErr);
        }

        // Broadcast change
        broadcastLiveUsers();
      }
    });

    async function checkAndEndStreamIfAbandoned(stream) {
      let isHostActive = false;
      let hasActiveSubhost = false;
      
      for (const sid of stream.participants) {
        const entry = Array.from(onlineUsers.values()).find(e => e.socketId === sid);
        if (entry && entry.user) {
          if (entry.user.id === stream.hostUserId) {
            isHostActive = true;
          } else if (stream.subhosts && stream.subhosts.includes(entry.user.id)) {
            hasActiveSubhost = true;
          }
        }
      }
      
      if (!isHostActive && !hasActiveSubhost) {
        console.log(`[Socket] Stream ${stream.streamId} has no active host or subhosts. Ending stream.`);
        io.to(`stream-${stream.streamId}`).emit('stream_ended', { streamId: stream.streamId });
        await liveStreamService.removeStream(stream.streamId);
        await broadcastActiveStreams();
        return true;
      }
      return false;
    }

    async function broadcastLiveUsers() {
      try {
        const list = [];
        for (const entry of onlineUsers.values()) {
          const u = { ...entry.user };
          if (u.security_clearance >= 20) {
            u.activeSessionCount = await supportSessionService.getActiveSessionCountForStaff(u.id);
            u.isBusy = u.activeSessionCount >= 5;
          }
          list.push(u);
        }
        io.emit('live_users_list', list);
      } catch (err) {
        console.error('Error broadcasting live users list:', err);
      }
    }

    async function broadcastActiveStreams() {
      const list = await liveStreamService.getAllActiveStreams();
      io.emit('active_streams_list', list);
    }

    async function broadcastSessionsStateToStaff() {
      try {
        const pending = await supportSessionService.getPendingSessions();
        for (const [userId, entry] of onlineUsers.entries()) {
          if (entry.user && entry.user.security_clearance >= 20) {
            const active = await supportSessionService.getActiveSessionsForStaff(userId);
            io.to(entry.socketId).emit('support_sessions_state', {
              pendingSessions: pending,
              activeSessions: active
            });
          }
        }
      } catch (err) {
        console.error('Error broadcasting sessions state to staff:', err);
      }
    }
  });

  return io;
}

module.exports = { init };
