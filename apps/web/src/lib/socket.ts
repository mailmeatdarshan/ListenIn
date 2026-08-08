import { io, Socket } from "socket.io-client";
import { useAuthStore } from "./stores/auth-store";
// In a real implementation, we would import types from @listenin/shared here

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  const envSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  const { accessToken } = useAuthStore.getState();
  
  let socketUrl = envSocketUrl && envSocketUrl.startsWith("http") ? envSocketUrl : "http://localhost:4001";

  if (!envSocketUrl && typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      socketUrl = "http://localhost:4001";
    } else if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      socketUrl = `http://${hostname}:4001`;
    }
  }

  if (!socket) {
    socket = io(socketUrl, {
      autoConnect: false,
      auth: {
        token: accessToken
      }
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connect error:", err);
    });
  } else if (accessToken && (!socket.auth || (socket.auth as any).token !== accessToken)) {
    socket.auth = { token: accessToken };
  }

  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
