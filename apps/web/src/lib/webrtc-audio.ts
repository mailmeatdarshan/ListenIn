import { getSocket } from "./socket";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

let localStream: MediaStream | null = null;
let peerConnections: Map<string, RTCPeerConnection> = new Map();
let listenerPeerConnection: RTCPeerConnection | null = null;
let audioPlayerElement: HTMLAudioElement | null = null;

export function getAudioPlayerElement(): HTMLAudioElement {
  if (!audioPlayerElement && typeof document !== "undefined") {
    audioPlayerElement = document.getElementById("listenin-live-audio") as HTMLAudioElement;
    if (!audioPlayerElement) {
      audioPlayerElement = document.createElement("audio");
      audioPlayerElement.id = "listenin-live-audio";
      audioPlayerElement.autoplay = true;
      audioPlayerElement.playsInline = true;
      audioPlayerElement.muted = false;
      audioPlayerElement.style.display = "none";
      document.body.appendChild(audioPlayerElement);
    }
  }
  return audioPlayerElement!;
}

export function unlockAudioPlayback(): Promise<boolean> {
  const audioEl = getAudioPlayerElement();
  if (audioEl) {
    audioEl.muted = false;
    audioEl.playsInline = true;
    if (audioEl.srcObject) {
      return audioEl
        .play()
        .then(() => true)
        .catch((err) => {
          console.warn("Audio unlock failed:", err);
          return false;
        });
    }
  }
  return Promise.resolve(true);
}

// HOST: Start broadcasting local MediaStream over WebRTC to listeners
export async function startHostAudioStream(stream: MediaStream, roomId: string) {
  localStream = stream;
  const socket = getSocket();

  // Notify everyone in the room that broadcast started
  socket.emit("relay:start", { roomId });
}

// HOST: Handle offer creation when listener joins
export async function createHostOfferForListener(targetSocketId: string, roomId: string) {
  if (!localStream) return;

  // If previous PC exists for this listener, close it
  const existingPc = peerConnections.get(targetSocketId);
  if (existingPc) {
    existingPc.close();
    peerConnections.delete(targetSocketId);
  }

  const pc = new RTCPeerConnection(RTC_CONFIG);
  peerConnections.set(targetSocketId, pc);

  localStream.getAudioTracks().forEach((track) => {
    pc.addTrack(track, localStream!);
  });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const socket = getSocket();
      socket.emit("webrtc:ice-candidate", {
        targetSocketId,
        candidate: event.candidate,
      });
    }
  };

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const socket = getSocket();
    socket.emit("webrtc:offer", {
      targetSocketId,
      sdp: offer,
      roomId,
    });
  } catch (err) {
    console.warn("Error creating host offer:", err);
  }
}

// HOST: Handle answer received from listener
export async function handleHostAnswer(senderSocketId: string, sdp: RTCSessionDescriptionInit) {
  const pc = peerConnections.get(senderSocketId);
  if (pc) {
    if (pc.signalingState !== "have-local-offer") {
      console.warn("Ignoring SDP answer because signalingState is:", pc.signalingState);
      return;
    }
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (err) {
      console.warn("Error setting remote description on host:", err);
    }
  }
}

// LISTENER: Handle incoming offer from host
export async function handleListenerOffer(senderSocketId: string, sdp: RTCSessionDescriptionInit) {
  if (listenerPeerConnection) {
    listenerPeerConnection.close();
    listenerPeerConnection = null;
  }

  const pc = new RTCPeerConnection(RTC_CONFIG);
  listenerPeerConnection = pc;

  pc.ontrack = (event) => {
    console.log("WebRTC Audio track received from host:", event.streams[0]);
    const audioEl = getAudioPlayerElement();
    if (event.streams && event.streams[0]) {
      audioEl.srcObject = event.streams[0];
      audioEl.play().catch((err) => {
        console.warn("Autoplay blocked, user gesture required to unlock:", err);
      });
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const socket = getSocket();
      socket.emit("webrtc:ice-candidate", {
        targetSocketId: senderSocketId,
        candidate: event.candidate,
      });
    }
  };

  try {
    if (pc.signalingState !== "stable") {
      console.warn("Ignoring offer in state:", pc.signalingState);
      return;
    }
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const socket = getSocket();
    socket.emit("webrtc:answer", {
      targetSocketId: senderSocketId,
      sdp: answer,
    });
  } catch (err) {
    console.warn("Error handling listener offer:", err);
  }
}

// Handle ICE candidate for both Host & Listener
export async function handleIceCandidate(senderSocketId: string, candidate: RTCIceCandidateInit) {
  if (listenerPeerConnection && listenerPeerConnection.remoteDescription) {
    try {
      await listenerPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("Error adding listener ICE candidate:", e);
    }
  }

  const hostPc = peerConnections.get(senderSocketId);
  if (hostPc && hostPc.remoteDescription) {
    try {
      await hostPc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn("Error adding host ICE candidate:", e);
    }
  }
}

// HOST: Stop broadcasting audio
export function stopHostAudioStream(roomId: string) {
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }

  peerConnections.forEach((pc) => pc.close());
  peerConnections.clear();

  const socket = getSocket();
  socket.emit("relay:stop", { roomId });
}

// LISTENER: Stop receiving audio stream
export function stopListenerAudioStream() {
  if (listenerPeerConnection) {
    listenerPeerConnection.close();
    listenerPeerConnection = null;
  }
  if (audioPlayerElement) {
    audioPlayerElement.pause();
    audioPlayerElement.srcObject = null;
  }
}
