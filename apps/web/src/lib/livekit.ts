import { Room, RoomEvent, Track, LocalAudioTrack } from "livekit-client";

let livekitRoom: Room | null = null;
let currentLocalAudioTrack: LocalAudioTrack | MediaStreamTrack | null = null;

export function getLivekitRoom(): Room {
  if (!livekitRoom) {
    livekitRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
  }
  return livekitRoom;
}

export async function connectLivekitRoom(
  token: string,
  livekitUrl: string,
  onTrackSubscribed?: (track: Track) => void,
  onTrackUnsubscribed?: (track: Track) => void
): Promise<Room> {
  const room = getLivekitRoom();

  if (room.state === "connected") {
    return room;
  }

  // Handle incoming remote audio tracks
  room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (track.kind === Track.Kind.Audio) {
      const audioElement = track.attach();
      audioElement.id = `livekit-audio-${participant.identity}`;
      document.body.appendChild(audioElement);
      audioElement.play().catch(err => {
        console.warn("Autoplay prevented by browser:", err);
      });
      if (onTrackSubscribed) onTrackSubscribed(track);
    }
  });

  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    if (track.kind === Track.Kind.Audio) {
      track.detach().forEach(el => el.remove());
      if (onTrackUnsubscribed) onTrackUnsubscribed(track);
    }
  });

  await room.connect(livekitUrl, token);
  return room;
}

export async function publishSystemAudio(stream: MediaStream): Promise<boolean> {
  const room = getLivekitRoom();
  if (room.state !== "connected") {
    console.warn("LiveKit room not connected yet");
    return false;
  }

  const audioTrack = stream.getAudioTracks()[0];
  if (!audioTrack) {
    throw new Error("No audio track found in captured stream");
  }

  currentLocalAudioTrack = audioTrack;

  // Publish audio track to LiveKit room
  await room.localParticipant.publishTrack(audioTrack, {
    name: "system-audio",
  });

  return true;
}

export async function stopPublishingAudio() {
  const room = getLivekitRoom();
  if (currentLocalAudioTrack && room.state === "connected") {
    try {
      await room.localParticipant.unpublishTrack(currentLocalAudioTrack as any);
      if ("stop" in currentLocalAudioTrack) {
        currentLocalAudioTrack.stop();
      }
    } catch (e) {
      console.error("Error unpublishing audio track:", e);
    }
    currentLocalAudioTrack = null;
  }
}

export async function disconnectLivekitRoom() {
  if (livekitRoom) {
    await stopPublishingAudio();
    livekitRoom.disconnect();
    livekitRoom = null;
  }
}
