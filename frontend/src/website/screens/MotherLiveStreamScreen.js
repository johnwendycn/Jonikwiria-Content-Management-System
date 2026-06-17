import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  TextInput,
  Image,
  ScrollView,
  FlatList
} from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export default function MotherLiveStreamScreen({
  streamRoomId,
  isHost,
  currentUser,
  sessionToken,
  onGoBack
}) {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768 || Platform.OS !== 'web';
  const isSuperAdmin = currentUser && currentUser.email === 'root-administrator@system.local';

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [streamStatusMsg, setStreamStatusMsg] = useState('Initializing stream...');
  const [participantsCount, setParticipantsCount] = useState(1);
  const [hostName, setHostName] = useState(isHost ? currentUser?.display_name : 'Host');
  const [hostAvatar, setHostAvatar] = useState(isHost ? currentUser?.avatar_url : '');
  const [pointsBalance, setPointsBalance] = useState(0);
  const [mediaStates, setMediaStates] = useState(new Map()); // userId -> { camMuted, micMuted }
  const [isHostOffline, setIsHostOffline] = useState(false);

  // Interaction states
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [likeCount, setLikeCount] = useState(0);
  const [floatingHearts, setFloatingHearts] = useState([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Layout and drawing canvas states
  const [currentLayout, setCurrentLayout] = useState('tiktok');
  const [subhosts, setSubhosts] = useState([]);
  const [commentsBlocked, setCommentsBlocked] = useState(false);
  const [roomUsers, setRoomUsers] = useState([]);
  const [drawColor, setDrawColor] = useState('#FFFFF2');
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);

  // Settings & Moderation states
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedCommentForMod, setSelectedCommentForMod] = useState(null);
  const [showCommentModModal, setShowCommentModModal] = useState(false);
  const [censorCommentText, setCensorCommentText] = useState('');

  // Private Chat states
  const [showPrivateChat, setShowPrivateChat] = useState(false);
  const [privateChatRecipient, setPrivateChatRecipient] = useState(null);
  const [privateInput, setPrivateInput] = useState('');
  const [privateMessages, setPrivateMessages] = useState([]);

  // Local media control & filters states
  const [micMuted, setMicMuted] = useState(false);
  const [camMuted, setCamMuted] = useState(false);
  const [makeupFilter, setMakeupFilter] = useState('none');
  const [showSidebarControls, setShowSidebarControls] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showControlsMenu, setShowControlsMenu] = useState(false);

  // Recording & Video effects
  const [videoEffect, setVideoEffect] = useState('none'); // 'none' | 'blur' | 'sepia' | 'grayscale'
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);

  // WebRTC & Socket refs
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const iceCandidatesQueueRef = useRef(new Map()); // userId -> candidate[]
  const mockStreamCanvasIntervalRef = useRef(null);
  const flatListRef = useRef(null);
  const canvasRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Fetch initial points balance
  useEffect(() => {
    if (!currentUser?.id) return;
    const fetchPoints = async () => {
      try {
        const h = { 'Content-Type': 'application/json', ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}) };
        const res = await fetch(`${API_URL}/api/wallets?user_id=${currentUser.id}&limit=1`, { headers: h });
        const json = await res.json();
        if (json.success && json.data.wallets?.length > 0) {
          setPointsBalance(parseInt(json.data.wallets[0].points_balance || 0, 10));
        }
      } catch (err) {
        console.error('Failed to fetch points balance for streaming:', err);
      }
    };
    fetchPoints();
  }, [currentUser, sessionToken]);

  // Connect socket and handle signaling
  useEffect(() => {
    if (!sessionToken) return;

    const socket = io(API_URL, {
      transports: ['websocket']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Socket connected to signaling server. Emitting authenticate.');
      socket.emit('authenticate', sessionToken);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    socket.on('authenticated', (res) => {
      console.log('[Socket] authenticated response received:', res);
      if (res.success) {
        if (isHost) {
          console.log('[Socket] Emitting create_stream for room:', streamRoomId);
          socket.emit('create_stream', { streamId: streamRoomId });
        } else {
          console.log('[Socket] Emitting join_stream for room:', streamRoomId);
          socket.emit('join_stream', { streamId: streamRoomId });
        }
      } else {
        setStreamStatusMsg(`Authentication failed: ${res.message}`);
      }
    });

    socket.on('create_stream_response', (res) => {
      console.log('[Socket] create_stream_response details: success =', res.success, 'remainingPoints =', res.remainingPoints, 'message =', res.message || 'none');
      if (res.success) {
        setStreamStatusMsg('Broadcast started successfully!');
        setPointsBalance(res.remainingPoints);
        startLocalMedia();
        if (res.participantsList) {
          setRoomUsers(res.participantsList);
          res.participantsList.forEach(user => {
            if (user.id !== currentUser?.id) {
              initiatePeerConnection(user.id);
            }
          });
        }
      } else {
        setStreamStatusMsg(`Error hosting: ${res.message}`);
      }
    });

    socket.on('join_stream_response', (res) => {
      if (res.success) {
        setStreamStatusMsg(`Connected to ${res.hostName}'s broadcast.`);
        setHostName(res.hostName);
        if (res.hostAvatar) {
          setHostAvatar(res.hostAvatar);
        }
        setCurrentLayout(res.layout || 'tiktok');
        setCommentsBlocked(!!res.commentsBlocked);
        setSubhosts(res.subhosts || []);
        if (res.participantsList) {
          setRoomUsers(res.participantsList);
          const hostUser = res.participantsList.find(u => u.id === res.hostUserId);
          if (hostUser) {
            setHostAvatar(hostUser.avatar_url);
          }
        }
      } else {
        setStreamStatusMsg(`Error joining stream: ${res.message}`);
      }
    });

    socket.on('user_joined_stream', (payload) => {
      const { userId, display_name, user } = payload;
      setParticipantsCount(prev => Math.min(10, prev + 1));
      addSystemComment(`${display_name} joined the stream.`);
      
      if (user) {
        setRoomUsers(prev => {
          if (prev.find(u => u.id === user.id)) return prev;
          return [...prev, user];
        });
      }

      // Every participant initiates peer connection to the new user who joined
      initiatePeerConnection(userId);
    });

    socket.on('user_left_stream', (payload) => {
      const { userId, display_name } = payload;
      setParticipantsCount(prev => Math.max(1, prev - 1));
      addSystemComment(`${display_name || 'A user'} left the stream.`);
      closePeerConnection(userId);
      setRoomUsers(prev => prev.filter(u => u.id !== userId));
    });

    socket.on('stream_ended', () => {
      setStreamStatusMsg('The host has ended this live stream.');
      alert('The live stream has ended.');
      onGoBack();
    });

    // Signaling
    socket.on('rtc_offer', (payload) => {
      const { senderUserId, sdp } = payload;
      handleIncomingOffer(senderUserId, sdp);
    });

    socket.on('rtc_answer', (payload) => {
      const { senderUserId, sdp } = payload;
      handleIncomingAnswer(senderUserId, sdp);
    });

    socket.on('rtc_ice_candidate', (payload) => {
      const { senderUserId, candidate } = payload;
      handleIncomingIceCandidate(senderUserId, candidate);
    });

    // Real-Time Interaction Listeners
    socket.on('stream_comment', (payload) => {
      setComments(prev => [...prev, {
        id: Math.random().toString(),
        commentId: payload.commentId,
        type: 'user',
        userId: payload.userId,
        name: payload.display_name,
        avatar: payload.avatar_url,
        comment: payload.comment
      }]);
    });

    socket.on('stream_comment_edited', (payload) => {
      setComments(prev => prev.map(c => {
        if (c.commentId === payload.commentId || c.id === payload.commentId) {
          return { ...c, comment: payload.newComment + ' (edited by moderator)' };
        }
        return c;
      }));
    });

    socket.on('stream_comment_deleted', (payload) => {
      setComments(prev => prev.filter(c => c.commentId !== payload.commentId && c.id !== payload.commentId));
    });

    socket.on('stream_like', (payload) => {
      setLikeCount(prev => prev + 1);
      triggerFloatingHeart();
    });

    socket.on('stream_tipped', (payload) => {
      const { senderName, amount, hostUserId, giftEmoji, giftName } = payload;
      if (giftEmoji && giftName) {
        addSystemComment(`🎁 ${senderName} sent a ${giftEmoji} ${giftName} (${amount} points) to the host!`);
      } else {
        addSystemComment(`🎁 ${senderName} tipped ${amount} points to the host!`);
      }
      if (currentUser?.id === hostUserId) {
        setPointsBalance(prev => prev + amount);
      }
    });

    socket.on('wallet_updated', (payload) => {
      setPointsBalance(payload.points_balance);
    });

    socket.on('host_temporary_offline', (payload) => {
      addSystemComment(`⚠️ Host is temporarily offline. Waiting up to ${payload.gracePeriod}s for reconnection...`);
      setIsHostOffline(true);
    });

    socket.on('host_reconnected', () => {
      addSystemComment(`✨ Host reconnected! Stream resuming.`);
      setIsHostOffline(false);
      if (hostUserIdRef.current) {
        closePeerConnection(hostUserIdRef.current);
      }
    });

    socket.on('user_media_state_changed', (payload) => {
      setMediaStates(prev => {
        const newMap = new Map(prev);
        newMap.set(payload.userId, { camMuted: payload.camMuted, micMuted: payload.micMuted });
        return newMap;
      });
    });

    // Moderation & Layout Listeners
    socket.on('layout_changed', (payload) => {
      setCurrentLayout(payload.layout);
    });

    socket.on('comments_moderated', (payload) => {
      setCommentsBlocked(payload.commentsBlocked);
      addSystemComment(payload.commentsBlocked ? '🔇 Comments are frozen by the moderator.' : '💬 Commenting has been resumed.');
    });

    socket.on('subhosts_updated', (payload) => {
      setSubhosts(payload.subhosts);
    });

    socket.on('user_moderated', (payload) => {
      const { userId, action } = payload;
      setRoomUsers(prev => prev.filter(u => u.id !== userId));
      addSystemComment(`🛡️ A user has been ${action}ed by the moderator.`);
    });

    socket.on('kicked_from_stream', (payload) => {
      alert(`You have been ${payload.reason}ed from this live stream.`);
      onGoBack();
    });

    socket.on('force_mute_participant', (payload) => {
      const { userId, mediaType } = payload;
      if (currentUser?.id === userId) {
        if (mediaType === 'audio') {
          setMicMuted(true);
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = false; });
          }
          const isCamMuted = localStreamRef.current ? !localStreamRef.current.getVideoTracks()[0]?.enabled : true;
          socketRef.current?.emit('toggle_media_state', {
            streamId: streamRoomId,
            camMuted: isCamMuted,
            micMuted: true
          });
          if (Platform.OS === 'web' && typeof window !== 'undefined' && window.showToast) {
            window.showToast('Muted by Host 🔇', 'The host has muted your microphone.', 'warning');
          }
        } else if (mediaType === 'video') {
          setCamMuted(true);
          if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(track => { track.enabled = false; });
          }
          const isMicMuted = localStreamRef.current ? !localStreamRef.current.getAudioTracks()[0]?.enabled : true;
          socketRef.current?.emit('toggle_media_state', {
            streamId: streamRoomId,
            camMuted: true,
            micMuted: isMicMuted
          });
          if (Platform.OS === 'web' && typeof window !== 'undefined' && window.showToast) {
            window.showToast('Camera Disabled by Host 🚫', 'The host has disabled your camera.', 'warning');
          }
        }
      }
    });

    // Drawing Sync Listeners
    socket.on('draw', (drawData) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (drawData.type === 'start') {
        ctx.beginPath();
        ctx.moveTo(drawData.x, drawData.y);
      } else if (drawData.type === 'draw') {
        ctx.strokeStyle = drawData.color;
        ctx.lineWidth = drawData.width;
        ctx.lineTo(drawData.x, drawData.y);
        ctx.stroke();
      }
    });

    socket.on('draw_clear', () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    // Private Chat Message Listener
    socket.on('chat_message', (msg) => {
      if (msg.recipient_id) {
        setPrivateMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });

    socket.on('error', (err) => {
      alert(err);
    });

    return () => {
      stopStream();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [sessionToken, streamRoomId, isHost]);

  // Scroll comments to bottom
  useEffect(() => {
    if (flatListRef.current) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [comments]);

  // Auto-toggle local stream when subhost status changes
  useEffect(() => {
    if (!currentUser) return;
    const isMeSubhost = subhosts.includes(currentUser.id);
    if (isMeSubhost && !isHost && !localStream) {
      startLocalMedia();
    } else if (!isMeSubhost && !isHost && localStream) {
      stopLocalPublishing();
    }
  }, [subhosts, currentUser]);

  const addSystemComment = (text) => {
    setComments(prev => [...prev, {
      id: Math.random().toString(),
      type: 'system',
      comment: text
    }]);
  };

  // WebRTC capture and signaling
  const startLocalMedia = async () => {
    console.log('[Media] startLocalMedia called.');
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        console.warn('[Media] navigator or mediaDevices undefined.');
        return;
      }
      console.log('[Media] Requesting getUserMedia...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('[Media] getUserMedia succeeded!');
      setLocalStream(stream);
      localStreamRef.current = stream;
      addLocalStreamToAllPeers();
    } catch (err) {
      console.warn('[Media] getUserMedia failed, initializing animated mock canvas:', err);
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = 360;
        canvas.height = 640;
        const ctx = canvas.getContext('2d');
        let frame = 0;
        const intervalId = setInterval(() => {
          ctx.fillStyle = '#0F0E17';
          ctx.fillRect(0, 0, 360, 640);
          
          // Draw HSL animated ring
          ctx.strokeStyle = `hsl(${(frame * 2) % 360}, 80%, 65%)`;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(180, 280, 70 + Math.sin(frame * 0.1) * 8, 0, Math.PI * 2);
          ctx.stroke();

          // Draw inner pulsing circle
          ctx.fillStyle = `rgba(255, 101, 132, ${0.4 + Math.sin(frame * 0.1) * 0.2})`;
          ctx.beginPath();
          ctx.arc(180, 280, 40, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFF2';
          ctx.font = 'bold 20px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('LIVE STREAMING', 180, 420);

          ctx.fillStyle = '#A8A4CE';
          ctx.font = '14px sans-serif';
          ctx.fillText(`Host: ${hostName}`, 180, 450);
          ctx.fillText(`Room: ${streamRoomId}`, 180, 475);
          
          frame++;
        }, 100);
        
        console.log('[Media] Capturing stream from mock canvas...');
        const mockStream = canvas.captureStream(15);
        console.log('[Media] Mock stream captured successfully!');
        setLocalStream(mockStream);
        localStreamRef.current = mockStream;
        mockStreamCanvasIntervalRef.current = intervalId;
        addLocalStreamToAllPeers();
      }
    }
  };

  const getOrCreatePeerConnection = (targetUserId) => {
    let pc = peerConnectionsRef.current.get(targetUserId);
    if (pc) return pc;

    pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('rtc_ice_candidate', {
          targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.set(targetUserId, event.streams[0]);
        return newMap;
      });
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    peerConnectionsRef.current.set(targetUserId, pc);
    return pc;
  };

  const renegotiate = async (targetUserId) => {
    try {
      const pc = peerConnectionsRef.current.get(targetUserId);
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (socketRef.current) {
        socketRef.current.emit('rtc_offer', {
          targetUserId,
          sdp: offer
        });
      }
    } catch (err) {
      console.error('Renegotiation failed for user:', targetUserId, err);
    }
  };

  const addLocalStreamToAllPeers = () => {
    if (!localStreamRef.current) return;
    peerConnectionsRef.current.forEach((pc, targetUserId) => {
      // Remove existing tracks first to avoid duplicates
      const senders = pc.getSenders();
      senders.forEach(sender => pc.removeTrack(sender));

      // Add new tracks
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });

      // Renegotiate
      renegotiate(targetUserId);
    });
  };

  const stopLocalPublishing = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (mockStreamCanvasIntervalRef.current) {
      clearInterval(mockStreamCanvasIntervalRef.current);
      mockStreamCanvasIntervalRef.current = null;
    }
    setLocalStream(null);

    peerConnectionsRef.current.forEach((pc, targetUserId) => {
      const senders = pc.getSenders();
      senders.forEach(sender => {
        try {
          pc.removeTrack(sender);
        } catch (e) {
          console.warn('[WebRTC] Error removing track on demote:', e);
        }
      });
      renegotiate(targetUserId);
    });
  };

  const initiatePeerConnection = async (targetUserId) => {
    try {
      const pc = getOrCreatePeerConnection(targetUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (socketRef.current) {
        socketRef.current.emit('rtc_offer', {
          targetUserId,
          sdp: offer
        });
      }
    } catch (err) {
      console.error('Error initiating connection:', err);
    }
  };

  const handleIncomingOffer = async (senderUserId, sdp) => {
    try {
      const pc = getOrCreatePeerConnection(senderUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      
      // Flush queued candidates
      const queue = iceCandidatesQueueRef.current.get(senderUserId) || [];
      for (const cand of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('[WebRTC] Error adding queued ICE candidate:', e);
        }
      }
      iceCandidatesQueueRef.current.delete(senderUserId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (socketRef.current) {
        socketRef.current.emit('rtc_answer', {
          targetUserId: senderUserId,
          sdp: answer
        });
      }
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  };

  const handleIncomingAnswer = async (senderUserId, sdp) => {
    try {
      const pc = peerConnectionsRef.current.get(senderUserId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Flush queued candidates
        const queue = iceCandidatesQueueRef.current.get(senderUserId) || [];
        for (const cand of queue) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            console.warn('[WebRTC] Error adding queued ICE candidate:', e);
          }
        }
        iceCandidatesQueueRef.current.delete(senderUserId);
      }
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  };

  const handleIncomingIceCandidate = async (senderUserId, candidate) => {
    try {
      const pc = peerConnectionsRef.current.get(senderUserId);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        // Queue candidate
        if (!iceCandidatesQueueRef.current.has(senderUserId)) {
          iceCandidatesQueueRef.current.set(senderUserId, []);
        }
        iceCandidatesQueueRef.current.get(senderUserId).push(candidate);
        console.log(`[WebRTC] Queued ICE candidate from ${senderUserId} — remoteDescription not yet set.`);
      }
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  };

  const closePeerConnection = (targetUserId) => {
    const pc = peerConnectionsRef.current.get(targetUserId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(targetUserId);
    }
    setRemoteStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(targetUserId);
      return newMap;
    });
  };

  const stopStream = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (mockStreamCanvasIntervalRef.current) {
      clearInterval(mockStreamCanvasIntervalRef.current);
      mockStreamCanvasIntervalRef.current = null;
    }
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    setLocalStream(null);
    setRemoteStreams(new Map());
    if (socketRef.current) {
      socketRef.current.emit('leave_stream', { streamId: streamRoomId });
    }
  };

  const handleCloseOrEndStream = () => {
    const performLeave = () => {
      stopStream();
      onGoBack();
    };

    if (isHost) {
      const msg = 'Are you sure you want to end this live stream for all participants?';
      if (Platform.OS === 'web') {
        if (window.confirm(msg)) {
          if (socketRef.current) {
            socketRef.current.emit('end_stream', { streamId: streamRoomId });
          }
          performLeave();
        }
      } else {
        performLeave();
      }
    } else {
      const isMeSubhost = subhosts.includes(currentUser?.id);
      const msg = isMeSubhost 
        ? 'Are you sure you want to leave the live stream? You will lose subhost status.' 
        : 'Are you sure you want to leave this room?';
      if (Platform.OS === 'web') {
        if (window.confirm(msg)) {
          performLeave();
        }
      } else {
        performLeave();
      }
    }
  };

  // Interactions
  const handleSendComment = () => {
    if (!commentInput.trim() || !socketRef.current) return;
    socketRef.current.emit('send_stream_comment', {
      streamId: streamRoomId,
      comment: commentInput.trim()
    });
    setCommentInput('');
  };

  const handleLike = () => {
    if (isHost || subhosts.includes(currentUser?.id)) {
      alert("You cannot like this live stream.");
      return;
    }
    if (pointsBalance < 1 && !isSuperAdmin) {
      alert("Insufficient points balance. You need at least 1 point to like the stream.");
      return;
    }
    if (!socketRef.current) return;
    socketRef.current.emit('like_stream', { streamId: streamRoomId });
  };

  const triggerFloatingHeart = () => {
    const id = Math.random().toString();
    const x = Math.floor(Math.random() * 40) - 20; // Random x offset
    setFloatingHearts(prev => [...prev, { id, x }]);
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(h => h.id !== id));
    }, 1500);
  };

  const handleTip = (amount, giftEmoji = null, giftName = null) => {
    if (pointsBalance < amount && !isSuperAdmin) {
      alert(`Insufficient points balance. Gifting requires ${amount} points. Your current balance is ${pointsBalance} points.`);
      return;
    }
    if (!socketRef.current) return;
    
    const targetHostUserId = isHost ? currentUser?.id : hostUserIdRef.current;
    if (!targetHostUserId) {
      alert("Host details not synchronized yet. Please wait.");
      return;
    }

    socketRef.current.emit('tip_stream', {
      streamId: streamRoomId,
      hostUserId: targetHostUserId,
      amount,
      giftEmoji,
      giftName
    });

    setShowGiftModal(false);
  };

  const hostUserIdRef = useRef(isHost ? currentUser?.id : null);
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on('join_stream_response', (res) => {
        if (res.success) {
          hostUserIdRef.current = res.hostUserId;
        }
      });
    }
  }, [socketRef.current]);

  // Blackboard Canvas Drawing
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);

    socketRef.current?.emit('draw', { x, y, type: 'start', color: drawColor, width: lineWidth, streamId: streamRoomId });
  };

  const startDrawingTouch = (e) => {
    if (e.touches.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);

    socketRef.current?.emit('draw', { x, y, type: 'start', color: drawColor, width: lineWidth, streamId: streamRoomId });
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = lineWidth;
    ctx.lineTo(x, y);
    ctx.stroke();

    socketRef.current?.emit('draw', { x, y, type: 'draw', color: drawColor, width: lineWidth, streamId: streamRoomId });
  };

  const drawTouch = (e) => {
    if (!isDrawing || e.touches.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = lineWidth;
    ctx.lineTo(x, y);
    ctx.stroke();

    socketRef.current?.emit('draw', { x, y, type: 'draw', color: drawColor, width: lineWidth, streamId: streamRoomId });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    socketRef.current?.emit('draw', { type: 'stop', streamId: streamRoomId });
  };

  const clearDrawingBoard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socketRef.current?.emit('draw_clear', { streamId: streamRoomId });
  };

  // Moderation & Layout Controls
  const changeStreamLayout = (layout) => {
    setCurrentLayout(layout);
    socketRef.current?.emit('change_layout', { streamId: streamRoomId, layout });
  };

  const muteParticipant = (userId, mediaType) => {
    socketRef.current?.emit('mute_participant', {
      streamId: streamRoomId,
      userId,
      mediaType
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.showToast) {
      window.showToast(
        'Mute Request Sent',
        `Mute command for ${mediaType} sent successfully.`,
        'success'
      );
    }
  };

  const startRecording = async () => {
    try {
      if (Platform.OS !== 'web') {
        alert('Recording is supported on Web browsers only.');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stream-recording-${Date.now()}.webm`;
        a.click();
        
        // Stop all tracks on the capture stream
        stream.getTracks().forEach(track => track.stop());
        
        if (typeof window !== 'undefined' && window.showToast) {
          window.showToast('Recording Saved! 💾', 'Your stream recording has been downloaded successfully.', 'success');
        }
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      if (typeof window !== 'undefined' && window.showToast) {
        window.showToast('Recording Started ⏺️', 'Select the stream window/tab to capture video & audio.', 'info');
      }
    } catch (err) {
      console.error('Failed to start stream recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const toggleCommentFreeze = () => {
    const nextState = !commentsBlocked;
    setCommentsBlocked(nextState);
    socketRef.current?.emit('moderate_comments', { streamId: streamRoomId, commentsBlocked: nextState });
  };

  const toggleSubhostStatus = (userId) => {
    const isSub = subhosts.includes(userId);
    socketRef.current?.emit(isSub ? 'remove_subhost' : 'assign_subhost', { streamId: streamRoomId, userId });
  };

  const moderateUser = (userId, action) => {
    socketRef.current?.emit('moderate_user', { streamId: streamRoomId, userId, action });
  };

  const deleteComment = (commentId) => {
    socketRef.current?.emit('delete_stream_comment', { streamId: streamRoomId, commentId });
    setShowCommentModModal(false);
  };

  const editComment = (commentId) => {
    if (!censorCommentText.trim()) return;
    socketRef.current?.emit('edit_stream_comment', { streamId: streamRoomId, commentId, newComment: censorCommentText.trim() });
    setShowCommentModModal(false);
    setCensorCommentText('');
  };

  const handleCommentPress = (comment) => {
    const isMeHost = isHost;
    const isMeSub = subhosts.includes(currentUser?.id);
    if (!isMeHost && !isMeSub) return;
    
    setSelectedCommentForMod(comment);
    setShowCommentModModal(true);
  };

  // Private Chat Message Methods
  const sendPrivateMessage = () => {
    if (!privateInput.trim() || !privateChatRecipient || !socketRef.current) return;
    const msgPayload = {
      recipientId: privateChatRecipient.id,
      message: privateInput.trim(),
      messageType: 'text'
    };
    socketRef.current.emit('chat_message', msgPayload);
    // Optimistic local add
    setPrivateMessages(prev => [...prev, {
      id: Math.random().toString(),
      sender_id: currentUser.id,
      recipient_id: privateChatRecipient.id,
      message: privateInput.trim(),
      created_at: new Date().toISOString()
    }]);
    setPrivateInput('');
  };

  const openPrivateChatWithUser = (user) => {
    if (user.id === currentUser?.id) return;
    setPrivateChatRecipient(user);
    setShowPrivateChat(true);
    setShowSettingsModal(false);
  };

  // Local media control & filter methods
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const nextState = !micMuted;
        audioTrack.enabled = micMuted;
        setMicMuted(nextState);
        if (socketRef.current) {
          socketRef.current.emit('toggle_media_state', {
            streamId: streamRoomId,
            camMuted,
            micMuted: nextState
          });
        }
      }
    }
  };

  const toggleCam = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const nextState = !camMuted;
        videoTrack.enabled = camMuted;
        setCamMuted(nextState);
        if (socketRef.current) {
          socketRef.current.emit('toggle_media_state', {
            streamId: streamRoomId,
            camMuted: nextState,
            micMuted
          });
        }
      }
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  };

  const startScreenShare = async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        alert('Screen sharing is not supported in this browser/device.');
        return;
      }
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      screenTrack.onended = () => {
        stopScreenShare();
      };

      if (localStreamRef.current) {
        const localVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (localVideoTrack) {
          localStreamRef.current.removeTrack(localVideoTrack);
          localVideoTrack.stop(); // Stop original camera video track
        }
        localStreamRef.current.addTrack(screenTrack);
      }

      // Update peer connections with new screen track
      peerConnectionsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      setIsScreenSharing(true);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } catch (err) {
      console.error('Failed to start screen sharing:', err);
    }
  };

  const stopScreenShare = async () => {
    try {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }

      // Restore camera
      let cameraStream;
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err) {
        console.warn('Failed to access camera, fallback to mock track:', err);
        // Create a dummy canvas track if camera access fails
        if (typeof document !== 'undefined') {
          const canvas = document.createElement('canvas');
          canvas.width = 360;
          canvas.height = 640;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0F0E17';
          ctx.fillRect(0, 0, 360, 640);
          cameraStream = canvas.captureStream(15);
        }
      }

      const cameraTrack = cameraStream ? cameraStream.getVideoTracks()[0] : null;

      if (localStreamRef.current && cameraTrack) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach(t => {
          localStreamRef.current.removeTrack(t);
          t.stop();
        });
        localStreamRef.current.addTrack(cameraTrack);
      }

      // Update peer connections
      if (cameraTrack) {
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(cameraTrack);
          }
        });
      }

      setIsScreenSharing(false);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } catch (err) {
      console.error('Failed to stop screen sharing:', err);
    }
  };

  const getFilterStyle = () => {
    let filterString = '';
    switch (makeupFilter) {
      case 'smooth': filterString += 'contrast(1.05) brightness(1.04) saturate(1.02) blur(0.4px) '; break;
      case 'warm': filterString += 'sepia(0.15) brightness(1.06) saturate(1.15) '; break;
      case 'retro': filterString += 'sepia(0.3) contrast(0.9) brightness(1.03) '; break;
      case 'vibrant': filterString += 'saturate(1.35) contrast(1.1) '; break;
    }
    if (isHost) {
      switch (videoEffect) {
        case 'blur': filterString += 'blur(8px) '; break;
        case 'sepia': filterString += 'sepia(80%) '; break;
        case 'grayscale': filterString += 'grayscale(80%) '; break;
      }
    }
    return filterString.trim() ? { filter: filterString.trim() } : {};
  };

  // Invite
  const handleSendInvites = async () => {
    if (!inviteEmails.trim()) {
      setInviteMessage('⚠️ Please enter at least one email.');
      return;
    }
    setInviteLoading(true);
    setInviteMessage('');
    try {
      const emailList = inviteEmails.split(',').map(e => e.trim()).filter(Boolean);
      const origin = (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) ? window.location.origin : 'http://localhost:8081';
      const inviteLink = `${origin}/?joinStream=${streamRoomId}`;
      const response = await fetch(`${API_URL}/api/auth/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: emailList,
          streamId: streamRoomId,
          hostName: currentUser?.display_name || 'A user',
          inviteLink
        })
      });
      const json = await response.json();
      if (json.success) {
        setInviteMessage('✅ Invitation emails sent successfully!');
        setInviteEmails('');
      } else {
        setInviteMessage(`❌ Error: ${json.message}`);
      }
    } catch (err) {
      setInviteMessage('❌ Server connection failed.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyLink = () => {
    const origin = (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) ? window.location.origin : 'http://localhost:8081';
    const inviteLink = `${origin}/?joinStream=${streamRoomId}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(inviteLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Drawing toolbar helper
  const renderDrawingToolbar = () => {
    return (
      <View style={styles.drawingToolbar}>
        {['#FFFFF2', '#FFD166', '#EF476F', '#118AB2', '#06D6A0'].map(color => (
          <TouchableOpacity
            key={color}
            style={[styles.colorDot, { backgroundColor: color }, drawColor === color && styles.colorDotSelected]}
            onPress={() => setDrawColor(color)}
          />
        ))}
        <View style={styles.brushSizeContainer}>
          {[2, 4, 8].map(size => (
            <TouchableOpacity
              key={size}
              style={[styles.brushBtn, lineWidth === size && styles.brushBtnSelected]}
              onPress={() => setLineWidth(size)}
            >
              <Text style={styles.brushBtnText}>{size}px</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.clearCanvasBtn} onPress={clearDrawingBoard}>
          <Text style={styles.clearCanvasBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Layout switcher content helper
  const renderLayoutContent = () => {
    if (currentLayout === 'blackboard') {
      return (
        <View style={styles.blackboardLayoutContainer}>
          <View style={styles.blackboardCanvasWrapper}>
            <canvas
              ref={canvasRef}
              width={800}
              height={500}
              className="blackboard-canvas"
              onMouseDown={isHost ? startDrawing : undefined}
              onMouseMove={isHost ? draw : undefined}
              onMouseUp={isHost ? stopDrawing : undefined}
              onMouseLeave={isHost ? stopDrawing : undefined}
              onTouchStart={isHost ? startDrawingTouch : undefined}
              onTouchMove={isHost ? drawTouch : undefined}
              onTouchEnd={isHost ? stopDrawing : undefined}
            />
            {isHost && renderDrawingToolbar()}
          </View>
          <View style={styles.pipVideoContainer}>
            {renderMainVideo()}
          </View>
        </View>
      );
    }

    if (currentLayout === 'grid') {
      return (
        <View style={styles.gridLayoutContainer}>
          <View style={styles.gridItem}>
            {renderMainVideo()}
            <Text style={styles.gridItemLabel}>Host</Text>
          </View>
          {Array.from(remoteStreams.entries()).map(([userId, rStream]) => {
            const viewerUser = roomUsers.find(u => u.id === userId);
            const viewerName = viewerUser ? viewerUser.display_name : 'Presenter';
            const viewerAvatar = viewerUser ? viewerUser.avatar_url : '';
            const isCamMuted = mediaStates.get(userId)?.camMuted;

            return (
              <View key={userId} style={styles.gridItem}>
                {isCamMuted ? (
                  renderMediaPlaceholder(viewerName, viewerAvatar, false)
                ) : (
                  <video
                    ref={el => { if (el && el.srcObject !== rStream) el.srcObject = rStream; }}
                    autoPlay
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
                <Text style={styles.gridItemLabel}>{viewerName}</Text>
              </View>
            );
          })}
        </View>
      );
    }

    if (currentLayout === 'split') {
      return (
        <View style={styles.splitLayoutContainer}>
          <View style={styles.splitHalf}>
            {renderMainVideo()}
            <Text style={styles.splitLabel}>Host</Text>
          </View>
          <View style={styles.splitHalf}>
            {remoteStreams.size > 0 ? (() => {
              const guestUserId = Array.from(remoteStreams.keys())[0];
              const rStream = remoteStreams.get(guestUserId);
              const guestUser = roomUsers.find(u => u.id === guestUserId);
              const guestName = guestUser ? guestUser.display_name : 'Guest';
              const guestAvatar = guestUser ? guestUser.avatar_url : '';
              const isCamMuted = mediaStates.get(guestUserId)?.camMuted;

              return isCamMuted ? (
                renderMediaPlaceholder(guestName, guestAvatar, false)
              ) : (
                <video
                  ref={el => { if (el && el.srcObject !== rStream) el.srcObject = rStream; }}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              );
            })() : (
              <View style={styles.splitPlaceholder}>
                <Text style={styles.splitPlaceholderText}>No co-host active on split screen...</Text>
              </View>
            )}
            <Text style={styles.splitLabel}>Guest</Text>
          </View>
        </View>
      );
    }

    // Default 'tiktok'
    return (
      <View style={styles.videoContainer}>
        {renderMainVideo()}
      </View>
    );
  };

  // Helper to render media muted / offline placeholders
  const renderMediaPlaceholder = (displayName, avatarUrl, isOffline = false, isSmall = false) => {
    const defaultPlaceholderImage = 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=1000';
    return (
      <View style={[styles.mediaPlaceholderContainer, isSmall && styles.mediaPlaceholderContainerSmall]} dataSet={{ class: 'media-placeholder-card' }}>
        {isSmall ? (
          <Image
            source={{ uri: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200' }}
            style={styles.placeholderBlurBg}
            blurRadius={30}
          />
        ) : (
          <Image
            source={{ uri: defaultPlaceholderImage }}
            style={styles.placeholderStudioBg}
            resizeMode="cover"
          />
        )}
        
        {/* Glassmorphic Overlay Tint */}
        {!isSmall && <View style={styles.placeholderGlassOverlay} />}

        <View style={[styles.placeholderOverlayContent, isSmall && styles.placeholderOverlayContentSmall]}>
          <View style={[styles.avatarGlowWrapper, isSmall && styles.avatarGlowWrapperSmall]}>
            <Image
              source={{ uri: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200' }}
              style={[styles.placeholderAvatarLarge, isSmall && styles.placeholderAvatarSmall]}
            />
          </View>
          <Text style={[styles.placeholderNameText, isSmall && styles.placeholderNameTextSmall]} numberOfLines={1}>
            {displayName}
          </Text>
          {!isSmall ? (
            <View style={[styles.statusPill, isOffline && styles.statusPillOffline]}>
              <View style={[styles.statusDot, isOffline && { backgroundColor: '#FF6584' }]} />
              <Text style={styles.statusPillText}>
                {isOffline ? '🛰️ Host Temporarily Offline' : '🔇 Camera / Media Muted'}
              </Text>
            </View>
          ) : (
            <View style={styles.statusPillSmall}>
              <Text style={styles.statusPillTextSmall}>
                {isOffline ? 'Offline' : 'Muted'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Helper to render horizontal overlapping participants row in top header
  const renderOverlappingParticipants = () => {
    // Filter out host (host is already in hostPill)
    const activeViewers = roomUsers.filter(u => u.id !== hostUserIdRef.current);
    const maxVisible = 4;
    const visibleViewers = activeViewers.slice(0, maxVisible);
    const extraCount = activeViewers.length - maxVisible;

    return (
      <View style={styles.overlapContainer}>
        {visibleViewers.map((viewer, index) => {
          const isSub = subhosts.includes(viewer.id);
          return (
            <Image
              key={viewer.id}
              source={{ uri: viewer.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80' }}
              style={[
                styles.overlapAvatar,
                index > 0 && { marginLeft: -8 },
                isSub && { borderColor: '#F59E0B', borderWidth: 1.5 }
              ]}
              title={viewer.display_name}
            />
          );
        })}
        {extraCount > 0 && (
          <View style={[styles.overlapAvatar, styles.overlapExtra, { marginLeft: -8 }]}>
            <Text style={styles.overlapExtraText}>+{extraCount}</Text>
          </View>
        )}
      </View>
    );
  };

  // Video render helper
  const renderMainVideo = () => {
    if (isHost) {
      if (camMuted) {
        return renderMediaPlaceholder(currentUser?.display_name || hostName, currentUser?.avatar_url || hostAvatar, false);
      }
      return localStream ? (
        <video
          ref={el => { if (el && el.srcObject !== localStream) el.srcObject = localStream; }}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: '#0A090E',
            ...getFilterStyle(),
            transform: !isScreenSharing ? 'scaleX(-1)' : 'none'
          }}
        />
      ) : (
        <View style={styles.fullscreenPlaceholder}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=1000' }}
            style={styles.placeholderStudioBg}
            resizeMode="cover"
          />
          <View style={styles.placeholderGlassOverlay} />
          <View style={{ zIndex: 2, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#FF6584" />
            <Text style={styles.placeholderText}>Initializing Broadcast Camera...</Text>
          </View>
        </View>
      );
    } else {
      const hostStreamId = Array.from(remoteStreams.keys())[0];
      const rStream = hostStreamId ? remoteStreams.get(hostStreamId) : null;
      
      const hostUser = roomUsers.find(u => u.id === hostUserIdRef.current);
      const hostDisplayName = hostUser ? hostUser.display_name : hostName;
      const hostAvatarUrl = hostUser ? hostUser.avatar_url : hostAvatar;

      if (isHostOffline) {
        return renderMediaPlaceholder(hostDisplayName, hostAvatarUrl, true);
      }

      const isHostCamMuted = mediaStates.get(hostUserIdRef.current)?.camMuted;
      if (isHostCamMuted) {
        return renderMediaPlaceholder(hostDisplayName, hostAvatarUrl, false);
      }

      return rStream ? (
        <video
          ref={el => { if (el && el.srcObject !== rStream) el.srcObject = rStream; }}
          autoPlay
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: '#0A090E',
            ...getFilterStyle()
          }}
        />
      ) : (
        renderMediaPlaceholder(hostDisplayName, hostAvatarUrl, false)
      );
    }
  };

  const renderSubhostsList = () => {
    // 1. Get other subhosts from remoteStreams
    const remoteSubhosts = [];
    remoteStreams.forEach((rStream, userId) => {
      // Exclude host's stream for viewers/subhosts since the host is already in the main video
      if (!isHost && userId === hostUserIdRef.current) {
        return;
      }
      remoteSubhosts.push({ userId, stream: rStream, isLocal: false });
    });

    // 2. Add local stream if we are a subhost (i.e. not host, but we have localStream)
    const localSubhost = (!isHost && localStream) ? [{ userId: currentUser?.id, stream: localStream, isLocal: true }] : [];

    const allSubhosts = [...localSubhost, ...remoteSubhosts];

    if (allSubhosts.length === 0) return null;

    return (
      <View style={styles.participantsContainer}>
        {allSubhosts.map(({ userId, stream, isLocal }) => {
          const name = isLocal ? (currentUser?.display_name || 'Me') : (roomUsers.find(u => u.id === userId)?.display_name || 'Viewer');
          const avatar = isLocal ? currentUser?.avatar_url : (roomUsers.find(u => u.id === userId)?.avatar_url || '');
          const isCamMuted = isLocal ? camMuted : mediaStates.get(userId)?.camMuted;

          return (
            <View key={userId} style={styles.floatingViewerCard}>
              {isCamMuted ? (
                renderMediaPlaceholder(name, avatar, false, true)
              ) : (
                <video
                  ref={el => { if (el && el.srcObject !== stream) el.srcObject = stream; }}
                  autoPlay
                  playsInline
                  muted={isLocal}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: (isLocal && !isScreenSharing) ? 'scaleX(-1)' : 'none'
                  }}
                />
              )}
              <View style={styles.localParticipantLabel}>
                <Text style={styles.localLabelText}>{name}</Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[styles.tiktokContainer, { height }]}>
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{__html: `
          .heart-particle {
            position: absolute;
            bottom: 10px;
            font-size: 28px;
            animation: floatUp 1.5s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
            pointer-events: none;
            z-index: 100;
          }
          @keyframes floatUp {
            0% { transform: translateY(0) scale(1) rotate(0deg); opacity: 1; }
            50% { transform: translateY(-80px) scale(1.3) rotate(-15deg); opacity: 0.8; }
            100% { transform: translateY(-180px) scale(1.5) rotate(15deg); opacity: 0; }
          }
        `}} />
      )}

      {/* Main layout content */}
      {renderLayoutContent()}

      {/* Top Floating Header overlay */}
      <View style={styles.topHeader} dataSet={{ class: 'navbar-blur' }}>
        <View style={styles.hostPill}>
          <Image
            source={{ uri: hostAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }}
            style={styles.hostAvatar}
          />
          <View style={styles.hostInfo}>
            <Text style={styles.hostNameText} numberOfLines={1}>{hostName}</Text>
            <Text style={styles.liveIndicator}>🔴 LIVE</Text>
          </View>
        </View>

        {renderOverlappingParticipants()}
        
        <View style={styles.viewerBadge}>
          <Text style={styles.viewerText}>👥 {participantsCount} in room</Text>
        </View>

        <View style={styles.walletHeaderBadge}>
          <Text style={styles.walletHeaderText}>⭐ {isSuperAdmin ? 'Unlimited' : `${pointsBalance} pts`}</Text>
        </View>

        {isHost ? (
          <TouchableOpacity 
            style={[styles.closeBtn, { width: 'auto', height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#EF4444' }]} 
            onPress={handleCloseOrEndStream}
          >
            <Text style={[styles.closeBtnText, { fontSize: 13 }]}>🛑 End Live</Text>
          </TouchableOpacity>
        ) : subhosts.includes(currentUser?.id) ? (
          <TouchableOpacity 
            style={[styles.closeBtn, { width: 'auto', height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: '#FFB347' }]} 
            onPress={handleCloseOrEndStream}
          >
            <Text style={[styles.closeBtnText, { fontSize: 13, color: '#0F0E17' }]}>🚪 Leave</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.closeBtn} onPress={handleCloseOrEndStream}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Unified subhosts list (renders for both host and viewers/subhosts) */}
      {renderSubhostsList()}

      {/* Floating Controls Menu Toggle Button (Vertically centered on the right) */}
      <TouchableOpacity 
        style={styles.menuToggleBtn} 
        onPress={() => setShowControlsMenu(prev => !prev)}
        activeOpacity={0.8}
      >
        <Text style={styles.menuToggleIcon}>⚙️</Text>
      </TouchableOpacity>

      {/* Floating Controls Menu Modal / Card Overlay */}
      {showControlsMenu && (
        <View style={styles.floatingControlsMenu}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Controls Menu</Text>
            <TouchableOpacity 
              style={styles.menuCloseBtn} 
              onPress={() => setShowControlsMenu(false)}
            >
              <Text style={styles.menuCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.menuGrid}>
            {/* Gifting Button (Viewer only) */}
            {!isHost && (
              <TouchableOpacity style={styles.menuActionBtn} onPress={() => { setShowGiftModal(true); setShowControlsMenu(false); }}>
                <View style={[styles.menuIconCircle, { backgroundColor: '#FFB347' }]}>
                  <Text style={styles.menuActionIcon}>🎁</Text>
                </View>
                <Text style={[styles.menuActionText, { color: '#FFB347', fontWeight: 'bold' }]}>Gifts</Text>
              </TouchableOpacity>
            )}

            {/* Local Stream Mic Mute Button (Presenter only) */}
            {localStream && (
              <TouchableOpacity style={styles.menuActionBtn} onPress={toggleMic}>
                <View style={[styles.menuIconCircle, micMuted && { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.menuActionIcon}>{micMuted ? '🔇' : '🎙️'}</Text>
                </View>
                <Text style={styles.menuActionText}>{micMuted ? 'Muted' : 'Mic'}</Text>
              </TouchableOpacity>
            )}

            {/* Local Stream Cam Mute Button (Presenter only) */}
            {localStream && (
              <TouchableOpacity style={styles.menuActionBtn} onPress={toggleCam}>
                <View style={[styles.menuIconCircle, camMuted && { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.menuActionIcon}>{camMuted ? '🚫' : '📹'}</Text>
                </View>
                <Text style={styles.menuActionText}>{camMuted ? 'Cam Off' : 'Cam'}</Text>
              </TouchableOpacity>
            )}

            {/* Makeup Face Filters Toggle (Presenter only) */}
            {localStream && (
              <TouchableOpacity style={styles.menuActionBtn} onPress={() => {
                const filters = ['none', 'smooth', 'warm', 'retro', 'vibrant'];
                const nextIndex = (filters.indexOf(makeupFilter) + 1) % filters.length;
                setMakeupFilter(filters[nextIndex]);
              }}>
                <View style={styles.menuIconCircle}>
                  <Text style={styles.menuActionIcon}>✨</Text>
                </View>
                <Text style={styles.menuActionText}>Filter</Text>
              </TouchableOpacity>
            )}

            {/* Screen Share Button (Host only) */}
            {localStream && isHost && (
              <TouchableOpacity style={styles.menuActionBtn} onPress={toggleScreenShare}>
                <View style={[styles.menuIconCircle, isScreenSharing && { backgroundColor: '#06D6A0' }]}>
                  <Text style={styles.menuActionIcon}>🖥️</Text>
                </View>
                <Text style={styles.menuActionText}>{isScreenSharing ? 'Stop Share' : 'Share Screen'}</Text>
              </TouchableOpacity>
            )}

            {/* Virtual Background / Effect Toggle (Host only) */}
            {localStream && isHost && (
              <TouchableOpacity 
                style={styles.menuActionBtn} 
                onPress={() => {
                  const effects = ['none', 'blur', 'sepia', 'grayscale'];
                  const nextIndex = (effects.indexOf(videoEffect) + 1) % effects.length;
                  setVideoEffect(effects[nextIndex]);
                }}
              >
                <View style={[styles.menuIconCircle, videoEffect !== 'none' && { backgroundColor: '#FF6584' }]}>
                  <Text style={styles.menuActionIcon}>🖼️</Text>
                </View>
                <Text style={styles.menuActionText}>
                  {videoEffect === 'none' ? 'Effect' : videoEffect.charAt(0).toUpperCase() + videoEffect.slice(1)}
                </Text>
              </TouchableOpacity>
            )}

            {/* Recording Controls (Host only) */}
            {isHost && (
              <TouchableOpacity 
                style={styles.menuActionBtn} 
                onPress={isRecording ? stopRecording : startRecording}
              >
                <View style={[styles.menuIconCircle, isRecording && { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.menuActionIcon}>⏺️</Text>
                </View>
                <Text style={styles.menuActionText}>
                  {isRecording ? 'Stop Rec' : 'Record'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Settings/Configurations (Host/Subhost only) */}
            {(isHost || subhosts.includes(currentUser?.id)) && (
              <TouchableOpacity style={styles.menuActionBtn} onPress={() => { setShowSettingsModal(true); setShowControlsMenu(false); }}>
                <View style={styles.menuIconCircle}>
                  <Text style={styles.menuActionIcon}>⚙️</Text>
                </View>
                <Text style={styles.menuActionText}>Settings</Text>
              </TouchableOpacity>
            )}

            {/* Private Messages Drawer Toggle */}
            <TouchableOpacity style={styles.menuActionBtn} onPress={() => {
              setShowControlsMenu(false);
              if (!isHost) {
                openPrivateChatWithUser({ id: hostUserIdRef.current, display_name: hostName });
              } else {
                setShowSettingsModal(true);
              }
            }}>
              <View style={styles.menuIconCircle}>
                <Text style={styles.menuActionIcon}>✉️</Text>
              </View>
              <Text style={styles.menuActionText}>PMs</Text>
            </TouchableOpacity>

            {/* Invite Button */}
            <TouchableOpacity style={styles.menuActionBtn} onPress={() => { setShowInviteModal(true); setShowControlsMenu(false); }}>
              <View style={styles.menuIconCircle}>
                <Text style={styles.menuActionIcon}>🔗</Text>
              </View>
              <Text style={styles.menuActionText}>Invite</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Floating Hearts Animation Container */}
      <View style={styles.heartContainer} pointerEvents="none">
        {floatingHearts.map((heart) => (
          <Text
            key={heart.id}
            style={[
              { left: 15 + heart.x },
              Platform.OS === 'web' ? undefined : styles.fallbackHeart
            ]}
            pointerEvents="none"
            className="heart-particle"
          >
            ❤️
          </Text>
        ))}
      </View>

      {/* Bottom Actions Bar (TikTok Style) */}
      <View style={styles.bottomActionsBar}>
        <View style={{ flexDirection: 'column', gap: 6 }}>
          {/* Quick Emoji Bar */}
          <View style={styles.quickEmojiBar}>
            {['👍', '😂', '🔥', '❤️', '🙌', '🎉', '😮', '👏'].map(emoji => (
              <TouchableOpacity 
                key={emoji} 
                style={styles.quickEmojiBtn} 
                onPress={() => setCommentInput(prev => prev + emoji)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickEmojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Comment Input */}
          <View style={styles.bottomChatInputContainer}>
            <TextInput
              style={styles.bottomChatInput}
              placeholder="Add comment..."
              placeholderTextColor="#A8A4CE"
              value={commentInput}
              onChangeText={setCommentInput}
              onSubmitEditing={handleSendComment}
            />
            <TouchableOpacity style={styles.bottomSendBtn} onPress={handleSendComment}>
              <Text style={styles.bottomSendText}>✉️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Spacer to push Like Button to the right */}
        <View style={{ flex: 1 }} />

        {/* Fixed Like Button on the right (Viewer only) */}
        {!isHost && !subhosts.includes(currentUser?.id) && (
          <TouchableOpacity style={styles.bottomActionBtn} onPress={handleLike}>
            <View style={styles.bottomIconCircle}>
              <Text style={styles.bottomActionIcon}>❤️</Text>
            </View>
            <Text style={styles.bottomActionText}>{likeCount}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom Left Comments Overlay */}
      <View style={styles.bottomLeftPanel}>
        <View style={{ height: 180, width: '100%' }}>
          <FlatList
            ref={flatListRef}
            data={comments}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              if (item.type === 'system') {
                return (
                  <View style={styles.systemMessageBubble}>
                    <Text style={styles.systemMessageText}>{item.comment}</Text>
                  </View>
                );
              }
              const isCommentHost = item.userId === hostUserIdRef.current;
              const isCommentSubhost = subhosts.includes(item.userId);
              return (
                <TouchableOpacity 
                  onPress={() => handleCommentPress(item)} 
                  style={[
                    styles.commentBubble,
                    isCommentHost && styles.commentBubbleHost,
                    isCommentSubhost && styles.commentBubbleSubhost
                  ]}
                >
                  <Image 
                    source={{ uri: item.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80' }} 
                    style={styles.commentAvatar} 
                  />
                  <View style={styles.commentContentColumn}>
                    <View style={styles.commentHeaderRow}>
                      <Text style={[
                        styles.commentUser,
                        isCommentHost && styles.commentUserHost,
                        isCommentSubhost && styles.commentUserSubhost
                      ]}>
                        {item.name || 'Anonymous'}
                      </Text>
                      {isCommentHost && (
                        <View style={styles.badgeHost}>
                          <Text style={styles.badgeText}>👑 Host</Text>
                        </View>
                      )}
                      {isCommentSubhost && (
                        <View style={styles.badgeSubhost}>
                          <Text style={styles.badgeText}>⭐ Subhost</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.commentText}>{item.comment}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>


      {/* Gift Modal Overlay */}
      {showGiftModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} dataSet={Platform.OS === 'web' ? { class: 'carousel-glass-box' } : undefined}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowGiftModal(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>🎁 Send a Gift to Host</Text>
            <Text style={styles.giftBalanceText}>Your Balance: {isSuperAdmin ? 'Unlimited' : `${pointsBalance} pts`}</Text>

            <View style={styles.giftsGrid}>
              {[
                { name: 'Rose', emoji: '🌹', points: 2 },
                { name: 'Ice Cream', emoji: '🍦', points: 5 },
                { name: 'Donut', emoji: '🍩', points: 10 },
                { name: 'Cheers', emoji: '🥂', points: 20 },
                { name: 'Gift Box', emoji: '🎁', points: 50 },
                { name: 'Crown', emoji: '👑', points: 100 },
              ].map((gift) => (
                <TouchableOpacity
                  key={gift.name}
                  style={styles.giftCard}
                  onPress={() => handleTip(gift.points, gift.emoji, gift.name)}
                >
                  <Text style={styles.giftEmoji}>{gift.emoji}</Text>
                  <Text style={styles.giftName}>{gift.name}</Text>
                  <View style={styles.giftPointsPill}>
                    <Text style={styles.giftPointsText}>{gift.points} pts</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Invite Modal Overlay */}
      {showInviteModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard} dataSet={Platform.OS === 'web' ? { class: 'carousel-glass-box' } : undefined}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setShowInviteModal(false); setInviteMessage(''); }}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>🔗 Share Broadcast Room</Text>
            <Text style={styles.modalSubtitle}>Invite colleagues or viewers to join your low-latency WebRTC stream.</Text>

            {inviteMessage ? (
              <View style={styles.statusBox}>
                <Text style={styles.statusBoxText}>{inviteMessage}</Text>
              </View>
            ) : null}

            {/* Link Copy Widget */}
            <Text style={styles.modalLabel}>Direct Join Link</Text>
            <View style={styles.copyLinkRow}>
              <TextInput
                style={styles.copyLinkInput}
                value={`${(Platform.OS === 'web' && typeof window !== 'undefined' && window.location) ? window.location.origin : 'http://localhost:8081'}/?joinStream=${streamRoomId}`}
                editable={false}
              />
              <TouchableOpacity style={styles.copyLinkBtn} onPress={handleCopyLink}>
                <Text style={styles.copyLinkBtnText}>{copiedLink ? 'Copied!' : 'Copy'}</Text>
              </TouchableOpacity>
            </View>

            {/* Email invitation widget */}
            <Text style={styles.modalLabel}>Invite via Email</Text>
            <Text style={styles.helperText}>Enter recipient email addresses (comma-separated).</Text>
            <TextInput
              style={[styles.copyLinkInput, { marginBottom: 16 }]}
              placeholder="e.g. john@email.com, wendy@email.com"
              placeholderTextColor="#6F6C8F"
              value={inviteEmails}
              onChangeText={setInviteEmails}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TouchableOpacity style={styles.sendEmailsBtn} onPress={handleSendInvites} disabled={inviteLoading}>
              {inviteLoading ? (
                <ActivityIndicator size="small" color="#0F0E17" />
              ) : (
                <Text style={styles.sendEmailsBtnText}>✉️ Send Invitations</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Settings Modal Overlay */}
      {showSettingsModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 500 }]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowSettingsModal(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>⚙️ Stream Configurations</Text>
            <Text style={styles.modalSubtitle}>Manage streaming layouts, block comments, and moderate participants.</Text>

            {/* Layout selection */}
            <Text style={styles.modalLabel}>Stream Layout</Text>
            <View style={styles.layoutBtnGroup} className="layout-btn-group">
              {['tiktok', 'grid', 'split', 'blackboard']
                .filter(lay => lay !== 'blackboard' || isHost)
                .map(lay => (
                  <TouchableOpacity
                    key={lay}
                    style={[styles.layoutBtn, currentLayout === lay && styles.layoutBtnActive]}
                    className={`layout-btn ${currentLayout === lay ? 'layout-btn-active' : ''}`}
                    onPress={() => changeStreamLayout(lay)}
                  >
                    <Text style={[styles.layoutBtnText, currentLayout === lay && styles.layoutBtnTextActive]}>
                      {lay.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>

            {/* Comment Blocking */}
            <Text style={styles.modalLabel}>Comments Moderation</Text>
            <TouchableOpacity
              style={[styles.toggleBtn, commentsBlocked && styles.toggleBtnActive]}
              className={`toggle-btn ${commentsBlocked ? 'toggle-btn-active' : ''}`}
              onPress={toggleCommentFreeze}
            >
              <Text style={styles.toggleBtnText}>
                {commentsBlocked ? '🚫 Comments FROZEN (Blocked)' : '💬 Comments ENABLED'}
              </Text>
            </TouchableOpacity>

            {/* Room participants list */}
            <Text style={styles.modalLabel}>Participants List ({roomUsers.length})</Text>
            <Text style={styles.helperText}>Click a user to send a private message (PM).</Text>
            <ScrollView style={{ maxHeight: 150, marginBottom: 12 }}>
              {roomUsers.length === 0 ? (
                <Text style={styles.helperText}>No other participants in the room.</Text>
              ) : (
                roomUsers.map(u => (
                  <View key={u.id} style={styles.participantRow} className="participant-row">
                    <TouchableOpacity onPress={() => openPrivateChatWithUser(u)}>
                      <Text style={styles.participantName}>
                        👤 {u.display_name} {subhosts.includes(u.id) && '⭐ (Subhost)'}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.participantActions} className="participant-actions">
                      {isHost && (
                        <>
                          <TouchableOpacity
                            style={styles.actionBadgeBtn}
                            className="action-badge-btn"
                            onPress={() => toggleSubhostStatus(u.id)}
                          >
                            <Text style={styles.actionBadgeText}>
                              {subhosts.includes(u.id) ? 'Remove Subhost' : 'Make Subhost'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBadgeBtn, { backgroundColor: '#10B981' }]}
                            className="action-badge-btn"
                            onPress={() => muteParticipant(u.id, 'audio')}
                          >
                            <Text style={styles.actionBadgeText}>🎙️ Mute</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBadgeBtn, { backgroundColor: '#3B82F6' }]}
                            className="action-badge-btn"
                            onPress={() => muteParticipant(u.id, 'video')}
                          >
                            <Text style={styles.actionBadgeText}>📹 Mute</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      <TouchableOpacity
                        style={[styles.actionBadgeBtn, { backgroundColor: '#EF4444' }]}
                        className="action-badge-btn"
                        onPress={() => moderateUser(u.id, 'block')}
                      >
                        <Text style={styles.actionBadgeText}>Block</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBadgeBtn, { backgroundColor: '#F59E0B' }]}
                        className="action-badge-btn"
                        onPress={() => moderateUser(u.id, 'suspend')}
                      >
                        <Text style={styles.actionBadgeText}>Suspend</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Comment Mod Modal Overlay */}
      {showCommentModModal && selectedCommentForMod && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowCommentModModal(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.modalTitle}>🛡️ Moderate Comment</Text>
            <Text style={styles.modalSubtitle}>Comment by {selectedCommentForMod.name}: "{selectedCommentForMod.comment}"</Text>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: '#EF4444', marginBottom: 16 }]}
              onPress={() => deleteComment(selectedCommentForMod.commentId || selectedCommentForMod.id)}
            >
              <Text style={styles.submitBtnText}>🗑️ Delete Comment</Text>
            </TouchableOpacity>

            <Text style={styles.modalLabel}>Censor / Edit Comment Content</Text>
            <TextInput
              style={styles.copyLinkInput}
              value={censorCommentText}
              onChangeText={setCensorCommentText}
              placeholder="Enter replacement text..."
              placeholderTextColor="#6F6C8F"
            />
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: '#6C63FF', marginTop: 12 }]}
              onPress={() => editComment(selectedCommentForMod.commentId || selectedCommentForMod.id)}
            >
              <Text style={styles.submitBtnText}>✏️ Update Comment</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Private Chat Overlay Drawer */}
      {showPrivateChat && privateChatRecipient && (
        <View style={styles.privateChatOverlay} className="private-chat-overlay">
          <View style={styles.privateChatCard} className="private-chat-card">
            <View style={styles.privateChatHeader} className="private-chat-header">
              <Text style={styles.privateChatTitle} className="private-chat-title">💬 PM: {privateChatRecipient.display_name}</Text>
              <TouchableOpacity onPress={() => setShowPrivateChat(false)}>
                <Text style={styles.privateChatCloseText} className="private-chat-close-text">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.privateMessagesList} className="private-messages-list">
              {privateMessages
                .filter(m => 
                  (m.sender_id === currentUser.id && m.recipient_id === privateChatRecipient.id) ||
                  (m.sender_id === privateChatRecipient.id && m.recipient_id === currentUser.id)
                )
                .map((m, idx) => {
                  const isMe = m.sender_id === currentUser.id;
                  return (
                    <View key={idx} style={[styles.privateMsgBubble, isMe ? styles.privateMsgMe : styles.privateMsgOther]} className={`private-msg-bubble ${isMe ? 'private-msg-me' : 'private-msg-other'}`}>
                      <Text style={styles.privateMsgText} className="private-msg-text">{m.message}</Text>
                    </View>
                  );
                })}
            </ScrollView>

            <View style={styles.privateInputRow} className="private-input-row">
              <TextInput
                style={styles.privateInput}
                className="private-input"
                placeholder="Send message..."
                placeholderTextColor="#A8A4CE"
                value={privateInput}
                onChangeText={setPrivateInput}
                onSubmitEditing={sendPrivateMessage}
              />
              <TouchableOpacity style={styles.privateSendBtn} className="private-send-btn" onPress={sendPrivateMessage}>
                <Text style={styles.privateSendBtnText} className="private-send-btn-text">Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tiktokContainer: {
    width: '100%',
    backgroundColor: '#0F0E17',
    position: 'relative',
    overflow: 'hidden'
  },
  videoContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1
  },
  tiktokVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    backgroundColor: '#0A090E'
  },
  fullscreenPlaceholder: {
    flex: 1,
    backgroundColor: '#0F0E17',
    justifyContent: 'center',
    alignItems: 'center'
  },
  placeholderText: {
    color: '#A8A4CE',
    fontSize: 14.5,
    marginTop: 16,
    fontWeight: '600'
  },

  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    backgroundColor: 'rgba(15, 14, 23, 0.3)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }
    })
  },
  hostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  hostAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8
  },
  hostInfo: {
    flexDirection: 'column',
    maxWidth: 100
  },
  hostNameText: {
    color: '#FFFFF2',
    fontSize: 12.5,
    fontWeight: 'bold'
  },
  liveIndicator: {
    color: '#FF6584',
    fontSize: 9,
    fontWeight: '900'
  },
  viewerBadge: {
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  viewerText: {
    color: '#A8A4CE',
    fontSize: 12,
    fontWeight: '700'
  },
  walletHeaderBadge: {
    backgroundColor: 'rgba(26, 26, 46, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(6, 214, 160, 0.25)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  walletHeaderText: {
    color: '#06D6A0',
    fontSize: 12,
    fontWeight: 'bold'
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  closeBtnText: {
    color: '#FFFFF2',
    fontSize: 16,
    fontWeight: 'bold'
  },
  localParticipantCard: {
    position: 'absolute',
    top: 95,
    right: 20,
    width: 90,
    height: 140,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FF6584',
    overflow: 'hidden',
    zIndex: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  localParticipantLabel: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(10, 9, 14, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  localLabelText: {
    color: '#FFFFF2',
    fontSize: 9,
    fontWeight: 'bold'
  },
  participantsContainer: {
    position: 'absolute',
    top: 95,
    right: 20,
    width: 90,
    flexDirection: 'column',
    gap: 12,
    zIndex: 5
  },
  floatingViewerCard: {
    width: 90,
    height: 140,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#6C63FF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  rightSidebar: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    zIndex: 10
  },
  sidebarAvatarWrapper: {
    position: 'relative',
    marginBottom: 8
  },
  sidebarAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FF6584'
  },
  avatarAddBtn: {
    position: 'absolute',
    bottom: -6,
    left: 14,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6584',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarAddText: {
    color: '#0F0E17',
    fontSize: 11,
    fontWeight: 'bold',
    lineHeight: 14
  },
  sidebarBtn: {
    alignItems: 'center'
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(26, 26, 46, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6
  },
  sidebarIcon: {
    fontSize: 20
  },
  sidebarText: {
    color: '#FFFFF2',
    fontSize: 11.5,
    fontWeight: 'bold',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3
  },
  tipGoldBtn: {
    marginTop: 10
  },
  heartContainer: {
    position: 'absolute',
    bottom: 100,
    right: 120,
    width: 100,
    height: 300,
    zIndex: 1,
    pointerEvents: 'none'
  },
  fallbackHeart: {
    position: 'absolute',
    bottom: 10,
    fontSize: 28
  },
  bottomLeftPanel: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 110 : 170, // Sit above the stacked quick emoji + chat input bar
    left: 16,
    width: '85%',
    maxWidth: 360,
    zIndex: 10,
    flexDirection: 'column'
  },
  bottomActionsBar: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 12 : 72,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10
  },
  bottomChatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.65)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    height: 40,
    width: Platform.OS === 'web' ? 240 : 180
  },
  bottomChatInput: {
    flex: 1,
    color: '#FFFFF2',
    fontSize: 13,
    backgroundColor: 'transparent',
    borderWidth: 0,
    outlineWidth: 0
  },
  bottomSendBtn: {
    paddingLeft: 6
  },
  bottomSendText: {
    fontSize: 15,
    color: '#FF6584'
  },
  bottomScrollActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 16
  },
  bottomActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 46
  },
  bottomIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  bottomActionIcon: {
    fontSize: 18,
    color: '#FFFFF2',
    lineHeight: 22
  },
  bottomActionText: {
    color: '#A8A4CE',
    fontSize: 9,
    marginTop: 2,
    fontWeight: '600',
    textAlign: 'center'
  },
  commentBubble: {
    flexDirection: 'row',
    backgroundColor: 'rgba(26, 26, 46, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8
  },
  commentBubbleHost: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF6584',
    backgroundColor: 'rgba(255, 101, 132, 0.12)'
  },
  commentBubbleSubhost: {
    borderLeftWidth: 3,
    borderLeftColor: '#06D6A0',
    backgroundColor: 'rgba(6, 214, 160, 0.12)'
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  commentContentColumn: {
    flexDirection: 'column',
    flex: 1
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2
  },
  commentUser: {
    color: '#A8A4CE',
    fontWeight: 'bold',
    fontSize: 12
  },
  commentUserHost: {
    color: '#FF6584'
  },
  commentUserSubhost: {
    color: '#06D6A0'
  },
  badgeHost: {
    backgroundColor: '#FF6584',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6
  },
  badgeSubhost: {
    backgroundColor: '#06D6A0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6
  },
  badgeText: {
    color: '#0F0E17',
    fontSize: 8,
    fontWeight: 'bold'
  },
  commentText: {
    color: '#FFFFF2',
    fontSize: 12.5,
    lineHeight: 16
  },
  systemMessageBubble: {
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderWidth: 0.5,
    borderColor: 'rgba(108, 99, 255, 0.3)',
    borderLeftWidth: 3,
    borderLeftColor: '#6C63FF'
  },
  systemMessageText: {
    color: '#A8A4CE',
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic'
  },
  quickEmojiBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    width: Platform.OS === 'web' ? 240 : 180
  },
  quickEmojiBtn: {
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center'
  },
  quickEmojiText: {
    fontSize: 16
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%'
  },
  chatInput: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#FFFFF2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13.5
  },
  sendCommentBtn: {
    backgroundColor: '#FF6584',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendCommentBtnText: {
    color: '#0F0E17',
    fontSize: 13,
    fontWeight: 'bold'
  },
  walletWidget: {
    position: 'absolute',
    top: 95,
    left: 20,
    backgroundColor: 'rgba(26, 26, 46, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 10
  },
  walletText: {
    color: '#FFFFF2',
    fontSize: 12,
    fontWeight: '700'
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 14, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#161521',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 28,
    position: 'relative'
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 12,
    zIndex: 100
  },
  modalCloseText: {
    color: '#A8A4CE',
    fontSize: 18,
    fontWeight: 'bold'
  },
  modalTitle: {
    color: '#FFFFF2',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center'
  },
  modalSubtitle: {
    color: '#A8A4CE',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20
  },
  modalLabel: {
    color: '#FFFFF2',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 10
  },
  helperText: {
    color: '#6F6C8F',
    fontSize: 11,
    marginBottom: 8
  },
  copyLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 16
  },
  copyLinkInput: {
    flex: 1,
    backgroundColor: '#0F0E17',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8,
    color: '#FFFFF2',
    padding: 10,
    fontSize: 13
  },
  copyLinkBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  copyLinkBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold'
  },
  sendEmailsBtn: {
    backgroundColor: '#FF6584',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6584',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8
  },
  sendEmailsBtnText: {
    color: '#0F0E17',
    fontWeight: 'bold',
    fontSize: 14
  },
  statusBox: {
    backgroundColor: 'rgba(6, 214, 160, 0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(6, 214, 160, 0.25)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16
  },
  statusBoxText: {
    color: '#80F5D2',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center'
  },
  // Blackboard & layout styles
  blackboardLayoutContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    backgroundColor: '#071f12',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  blackboardCanvasWrapper: {
    flex: 1,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    paddingTop: 80
  },
  drawingToolbar: {
    marginTop: 15,
    backgroundColor: 'rgba(26, 26, 46, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 100
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  colorDotSelected: {
    borderColor: '#FFFFF2',
    shadowColor: '#FFFFF2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8
  },
  brushSizeContainer: {
    flexDirection: 'row',
    gap: 6,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.15)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12
  },
  brushBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 8
  },
  brushBtnSelected: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF'
  },
  brushBtnText: {
    color: '#FFFFF2',
    fontSize: 11,
    fontWeight: '600'
  },
  clearCanvasBtn: {
    backgroundColor: '#EF476F',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12
  },
  clearCanvasBtnText: {
    color: '#FFFFF2',
    fontSize: 11,
    fontWeight: 'bold'
  },
  pipVideoContainer: {
    position: 'absolute',
    top: 95,
    left: 20,
    width: 100,
    height: 150,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF6584',
    overflow: 'hidden',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 20
  },
  gridLayoutContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 95,
    paddingHorizontal: 20,
    paddingBottom: 20,
    width: '100%',
    height: '100%',
    backgroundColor: '#0F0E17',
    justifyContent: 'center',
    alignContent: 'center'
  },
  gridItem: {
    flex: 1,
    minWidth: 280,
    maxWidth: '48%',
    aspectRatio: 16/9,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0A090E'
  },
  gridItemLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(10, 9, 14, 0.6)',
    color: '#FFFFF2',
    fontSize: 11,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontWeight: 'bold'
  },
  splitLayoutContainer: {
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    backgroundColor: '#0F0E17',
    paddingTop: 80
  },
  splitHalf: {
    flex: 1,
    position: 'relative',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    backgroundColor: '#0A090E'
  },
  splitLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(10, 9, 14, 0.6)',
    color: '#FFFFF2',
    fontSize: 11,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontWeight: 'bold'
  },
  splitPlaceholder: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  splitPlaceholderText: {
    color: '#6F6C8F',
    fontSize: 14,
    fontStyle: 'italic'
  },
  layoutBtnGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15
  },
  layoutBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 8
  },
  layoutBtnActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    borderColor: '#6C63FF'
  },
  layoutBtnText: {
    color: '#A8A4CE',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  layoutBtnTextActive: {
    color: '#FFFFF2'
  },
  toggleBtn: {
    width: '100%',
    padding: 10,
    backgroundColor: 'rgba(6, 214, 160, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 214, 160, 0.25)',
    borderRadius: 8,
    marginBottom: 15
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.25)'
  },
  toggleBtnText: {
    color: '#06D6A0',
    fontSize: 12.5,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    marginBottom: 6
  },
  participantName: {
    color: '#FFFFF2',
    fontSize: 12,
    fontWeight: '600'
  },
  participantActions: {
    flexDirection: 'row',
    gap: 6
  },
  actionBadgeBtn: {
    backgroundColor: '#6C63FF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4
  },
  actionBadgeText: {
    color: '#FFFFF2',
    fontSize: 10,
    fontWeight: 'bold'
  },
  privateChatOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 14, 23, 0.8)',
    zIndex: 15,
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  privateChatCard: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: '#161521',
    height: '100%',
    flexDirection: 'column',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.1)',
    padding: 20
  },
  privateChatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 8
  },
  privateChatTitle: {
    color: '#FFFFF2',
    fontSize: 14,
    fontWeight: 'bold'
  },
  privateChatCloseText: {
    color: '#EF476F',
    fontSize: 18,
    fontWeight: 'bold'
  },
  privateMessagesList: {
    flex: 1,
    marginBottom: 15
  },
  privateMsgBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '80%'
  },
  privateMsgMe: {
    backgroundColor: '#6C63FF',
    alignSelf: 'flex-end'
  },
  privateMsgOther: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'flex-start'
  },
  privateMsgText: {
    color: '#FFFFF2',
    fontSize: 12.5
  },
  privateInputRow: {
    flexDirection: 'row',
    gap: 8
  },
  privateInput: {
    flex: 1,
    backgroundColor: '#0F0E17',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    color: '#FFFFF2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 12
  },
  privateSendBtn: {
    backgroundColor: '#FF6584',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  privateSendBtnText: {
    color: '#0F0E17',
    fontSize: 11,
    fontWeight: 'bold'
  },
  giftsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16
  },
  giftCard: {
    width: '30%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  giftEmoji: {
    fontSize: 28
  },
  giftName: {
    color: '#FFFFF2',
    fontSize: 11,
    fontWeight: 'bold'
  },
  giftPointsPill: {
    backgroundColor: '#FFB34722',
    borderWidth: 1,
    borderColor: '#FFB34755',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  giftPointsText: {
    color: '#FFB347',
    fontSize: 9,
    fontWeight: 'bold'
  },
  giftBalanceText: {
    color: '#A8A4CE',
    fontSize: 12,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 8
  },
  overlapContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8
  },
  overlapAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E1B4B',
    backgroundColor: '#0F0E17'
  },
  overlapExtra: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF6584'
  },
  overlapExtraText: {
    color: '#0F0E17',
    fontSize: 9,
    fontWeight: 'bold'
  },
  mediaPlaceholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F0E17',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  placeholderBlurBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.45
  },
  placeholderStudioBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.55
  },
  placeholderGlassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 14, 23, 0.5)'
  },
  statusPillOffline: {
    borderColor: '#FF6584',
    backgroundColor: 'rgba(255, 101, 132, 0.15)'
  },
  placeholderOverlayContent: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2
  },
  avatarGlowWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FF6584',
    padding: 4,
    shadowColor: '#FF6584',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 101, 132, 0.1)'
  },
  placeholderAvatarLarge: {
    width: '100%',
    height: '100%',
    borderRadius: 55
  },
  placeholderNameText: {
    color: '#FFFFF2',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 14, 23, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)'
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6584',
    marginRight: 6,
    shadowColor: '#FF6584',
    shadowOpacity: 0.8,
    shadowRadius: 4
  },
  statusPillText: {
    color: '#A8A4CE',
    fontSize: 12,
    fontWeight: '600'
  },
  menuToggleBtn: {
    position: 'absolute',
    top: '50%',
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6584',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    shadowColor: '#FF6584',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8
  },
  menuToggleIcon: {
    fontSize: 22,
    color: '#0F0E17'
  },
  floatingControlsMenu: {
    position: 'absolute',
    top: '30%',
    left: '10%',
    right: '10%',
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 101, 132, 0.3)',
    padding: 20,
    zIndex: 1000,
    maxWidth: 400,
    alignSelf: 'center',
    shadowColor: '#FF6584',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 10
  },
  menuTitle: {
    color: '#FFFFF2',
    fontSize: 16,
    fontWeight: 'bold'
  },
  menuCloseBtn: {
    padding: 4
  },
  menuCloseText: {
    color: '#A8A4CE',
    fontSize: 18,
    fontWeight: 'bold'
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    width: '100%'
  },
  menuActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    marginVertical: 4
  },
  menuIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3F3D56',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4
  },
  menuActionIcon: {
    fontSize: 18,
    color: '#FFFFF2'
  },
  menuActionText: {
    fontSize: 11,
    color: '#A8A4CE',
    textAlign: 'center'
  },
  mediaPlaceholderContainerSmall: {
    padding: 2
  },
  placeholderOverlayContentSmall: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    padding: 4
  },
  avatarGlowWrapperSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#FF6584',
    padding: 2,
    shadowColor: '#FF6584',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    marginBottom: 6,
    backgroundColor: 'rgba(255, 101, 132, 0.1)'
  },
  placeholderAvatarSmall: {
    width: '100%',
    height: '100%',
    borderRadius: 22
  },
  placeholderNameTextSmall: {
    color: '#FFFFF2',
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
    width: '100%',
    overflow: 'hidden'
  },
  statusPillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 14, 23, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  statusPillTextSmall: {
    color: '#A8A4CE',
    fontSize: 7.5,
    fontWeight: '600'
  }
});
