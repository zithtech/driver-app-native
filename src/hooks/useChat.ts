import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

import { useSocket } from "../Socket/SocketContext";

export const useChat = (rideId: string, userId: string) => {
    const { socket } = useSocket();
    const appState = useRef(AppState.currentState);
    useEffect(() => {
        socket.emit("joinChat", { rideId, userId });
       
const handleAppStateChange = (nextAppState: AppStateStatus) => {
            appState.current = nextAppState;
            socket.emit("chatPresence", {
                rideId,
                userId,
                appState: nextAppState,
            });
        };

        const subscription = AppState.addEventListener("change", handleAppStateChange);
        
        

        return () => {
            subscription.remove();
            socket.off("receiveChatMessage");
            socket.off("typingUpdate");
            socket.off("messageDelivered");
            socket.off("messageDeliveredToUser");
            socket.off("messageSeenUpdate");
        };
    }, []);

      const setChatScreenPresence = (isActive: boolean) => {
        socket.emit("chatPresence", {
            rideId,
            userId,
            appState: appState.current,
            currentScreen: isActive ? "ChatScreen" : null,
        });
    };
    
    

    const sendMessage = (text: string) => {
        const payload = {
            messageId: Date.now().toString(),
            rideId,
            senderId: userId,
            text,
            timestamp: Date.now(),
        };

        socket.emit("sendChatMessage", payload);
        return payload;
    };

    const sendImage = (imageUrl: string) => {
        const payload = {
            messageId: Date.now().toString(),
            rideId,
            senderId: userId,
            image: imageUrl,
            timestamp: Date.now(),
        };
        socket.emit("sendChatMessage", payload);
        return payload;
    };

    const sendLocation = (latitude: number, longitude: number) => {
        const payload = {
            messageId: Date.now().toString(),
            rideId,
            senderId: userId,
            location: { latitude, longitude },
            timestamp: Date.now(),
        };
        socket.emit("sendChatMessage", payload);
        return payload;
    };


    const sendTyping = (isTyping: boolean) => {
        socket.emit("typing", { rideId, userId, isTyping });
    };

    const sendSeen = (messageId: string) => {
        socket.emit("messageSeen", { rideId, messageId, seenBy: userId });
    };

    const onMessage = (cb: (msg: any) => void) =>
        socket.on("receiveChatMessage", cb);

    const onTyping = (cb: (data: any) => void) =>
        socket.on("typingUpdate", cb);

    const onDelivered = (cb: (data: any) => void) =>
        socket.on("messageDelivered", cb);

    const onDeliveredToUser = (cb: (data: any) => void) =>
        socket.on("messageDeliveredToUser", cb);

    const onSeen = (cb: (data: any) => void) =>
        socket.on("messageSeenUpdate", cb);

    const onHistory = (cb: (msgs: any[]) => void) =>
        socket.on("chatHistory", cb);

    return {
        sendMessage,
        sendImage,
        sendLocation,
        sendTyping,
        sendSeen,
        onMessage,
        onTyping,
        onDelivered,
        onDeliveredToUser,
        onSeen,
        onHistory,
        setChatScreenPresence,
    };
};