import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput,
    TouchableOpacity, KeyboardAvoidingView, Platform,
    Image, Dimensions,
    ActivityIndicator,
    Linking,
    Alert,
    Animated,
    ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocation } from '../../hooks/useLocation';
import { useDispatch } from 'react-redux';
import { resetUnreadCount } from '../../redux/chatSlice';
import ImagePicker from "react-native-image-crop-picker";
import { useChat } from '../../hooks/useChat';
import { ChatMessage } from '../../Socket/socket.types';
import { useSocket } from '../../Socket/SocketContext';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../context/ThemeContext';
import AppStatusBar from '../../Components/AppStatusBar';
import { useHaptic } from '../../hooks/useHaptic';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import moment from 'moment';
import Clipboard from '@react-native-clipboard/clipboard';


export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

export const hS = (size: number) => (SCREEN_WIDTH / guidelineBaseWidth) * size;
export const vS = (size: number) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;
export const mS = (size: number, factor = 0.5) => size + (hS(size) - size) * factor;

// Platform helper
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';


const ChatScreen = ({ route, navigation }: any) => {
    const dispatch = useDispatch();
    const { socket } = useSocket();
    const { t } = useTranslation();
    const { theme, isDark } = useAppTheme();
    const { triggerHaptic } = useHaptic();
    const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const anim1 = useRef(new Animated.Value(0.3)).current;
    const anim2 = useRef(new Animated.Value(0.3)).current;
    const anim3 = useRef(new Animated.Value(0.3)).current;
    const pulseAnim = useRef(new Animated.Value(0.4)).current;


    const { userName, rideId, userId, userPhone, userImage } = route.params;
    const insets = useSafeAreaInsets();
    const { getCurrentLocation } = useLocation();

    const getInitials = (name: string) => {
        if (!name) return 'R';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const QUICK_REPLIES = [
        t('chat_on_my_way') || "I'm on my way",
        t('chat_arrived') || "I've arrived",
        t('chat_in_traffic') || "I'm in traffic",
        t('chat_ok_thanks') || "Ok, thanks",
        t('chat_where_are_you') || "Where are you?",
    ];

    const {
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
    } = useChat(rideId, userId);

    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [showMenu, setShowMenu] = useState(false);
    const [typingUser, setTypingUser] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isChatDisabled, setIsChatDisabled] = useState(false);

    // Reset unread count when entering this chat
    useEffect(() => {
        if (rideId) {
            dispatch(resetUnreadCount(rideId.toString()));
        }
    }, [rideId, dispatch]);


    const flatListRef = useRef<FlatList>(null);

    const AttachmentOption = ({ icon, color, label, onPress }: any) => (
        <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => {
                triggerHaptic(HapticFeedbackTypes.impactLight);
                onPress();
            }}
        >
            <View style={[styles.iconCircle, { backgroundColor: color }]}>
                <MaterialCommunityIcons name={icon} size={mS(24)} color="#FFF" />
            </View>
            <Text style={styles.menuLabel}>{label}</Text>
        </TouchableOpacity>
    );

    const openInExternalMap = (lat: number, lng: number) => {
        const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
        const latLng = `${lat},${lng}`;
        const label = 'Shared Location';
        const url = Platform.select({
            ios: `${scheme}${label}@${latLng}`,
            android: `${scheme}${latLng}(${label})`
        });

        if (url) Linking.openURL(url);
    };

    // --- Camera & Gallery Actions ---

    const handleImageSelection = (image: any) => {
        const msg = sendImage(image.path);

        const newMessage: ChatMessage = {
            id: msg.messageId,
            sender: 'me',
            time: moment(msg.timestamp).fromNow(),
            timestamp: msg.timestamp,
            image: msg.image, // Path provided by image-crop-picker
        };

        setMessages(prev => [...prev, newMessage]);
        // Scroll to bottom after state update
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    };

    const handleCameraLaunch = async () => {
        setShowMenu(false); // Close menu first
        try {
            const image = await ImagePicker.openCamera({
                width: 1000,
                height: 1000,
                cropping: true,
                compressImageQuality: 0.8,
            });
            handleImageSelection(image);
        } catch (error: any) {
            // Handle "User cancelled" error gracefully
            if (error.message !== 'User cancelled image selection') {
                console.warn("Camera Error:", error);
            }
        }
    };

    const handleGalleryLaunch = async () => {
        setShowMenu(false); // Close menu first
        try {
            const image = await ImagePicker.openPicker({
                width: 1000,
                height: 1000,
                cropping: true,
                compressImageQuality: 0.8,
                mediaType: 'photo',
            });
            handleImageSelection(image);
        } catch (error: any) {
            if (error.message !== 'User cancelled image selection') {
                console.warn("Gallery Error:", error);
            }
        }
    };

    // --- Actions ---
    const shareCurrentLocation = async () => {
        try {
            const position = await getCurrentLocation();
            const { latitude, longitude } = position.coords;

            const msg = sendLocation(latitude, longitude);
            const newMessage: ChatMessage = {
                id: msg.messageId,
                sender: 'me',
                time: moment(msg.timestamp).fromNow(),
                timestamp: msg.timestamp,
                location: msg.location,
            };

            setMessages(prev => [...prev, newMessage]);
            setTimeout(() => flatListRef.current?.scrollToEnd(), 200);
        } catch (error) {
            console.warn("Location error", error);
        }
    };

    const handleSendMessage = () => {
        if (message.trim().length === 0) return;
        
        if (!socket?.connected) {
            Alert.alert('error', 'Connection lost. Please wait...');
            return;
        }

        const msg = sendMessage(message);
        const newMessage: ChatMessage = {
            id: msg.messageId,
            text: msg.text,
            sender: 'me',
            time: moment(msg.timestamp).fromNow(),
            timestamp: msg.timestamp,
            status: 'pending',
        };

        setMessages(prev => [...prev, newMessage]);
        setMessage('');
        setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    };

    const handleQuickReply = (text: string) => {
        if (!socket?.connected) {
            Alert.alert('error', 'Connection lost. Please wait...');
            return;
        }
        triggerHaptic(HapticFeedbackTypes.selection);
        const msg = sendMessage(text);
        const newMessage: ChatMessage = {
            id: msg.messageId,
            text: msg.text,
            sender: 'me',
            time: moment(msg.timestamp).fromNow(),
            timestamp: msg.timestamp,
            status: 'pending',
        };

        setMessages(prev => [...prev, newMessage]);
        setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    };

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: theme.colors.primary + '10' }]}>
                <MaterialCommunityIcons name="message-text-outline" size={mS(48)} color={theme.colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                {t('chat_no_messages') || "No messages yet"}
            </Text>
            <Text style={[styles.emptyDesc, { color: theme.colors.paragraphText }]}>
                {t('chat_start_desc') || "Start the conversation with the rider."}
            </Text>
        </View>
    );

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isUser = item.sender === 'me';
        const lat = item.location?.latitude ? Number(item.location.latitude) : null;
        const lng = item.location?.longitude ? Number(item.location.longitude) : null;

        const copyToClipboard = () => {
            if (item.text) {
                Clipboard.setString(item.text);
                triggerHaptic(HapticFeedbackTypes.notificationSuccess);
                Alert.alert(t('common.success') || 'Success', t('chat_message_copied') || 'Message copied to clipboard');
            }
        };

        return (
            <TouchableOpacity 
                activeOpacity={0.9} 
                onLongPress={copyToClipboard}
                delayLongPress={500}
            >
                <View style={[
                    styles.messageBubble,
                    isUser ? styles.meBubble : styles.otherBubble,
                    item.location && { width: hS(220), padding: mS(4) },
                    { backgroundColor: isUser ? theme.colors.primary : theme.colors.card }
                ]}>
                    {/* 1. Map Content */}
                    {lat && lng ? (
                        <View style={styles.mapWrapper}>
                            <MapView
                                provider={PROVIDER_GOOGLE}
                                style={styles.miniMap}
                                region={{
                                    latitude: lat,
                                    longitude: lng,
                                    latitudeDelta: 0.01,
                                    longitudeDelta: 0.01,
                                }}
                                scrollEnabled={false}
                                liteMode={true}
                                pitchEnabled={false}
                                rotateEnabled={false}
                            >
                                <Marker
                                    coordinate={{ latitude: lat, longitude: lng }}
                                />
                            </MapView>
                            <TouchableOpacity
                                style={StyleSheet.absoluteFill}
                                onPress={() => openInExternalMap(lat, lng)}
                            />
                        </View>
                    ) : item.location ? (
                        <View style={[styles.miniMap, { justifyContent: 'center', backgroundColor: isDark ? '#1E293B' : '#f0f0f0' }]}>
                            <ActivityIndicator size="small" color={theme.colors.primary} />
                        </View>
                    ) : null}

                    {/* 2. Image Content */}
                    {item.image && (
                        <Image source={{ uri: item.image }} style={styles.messageImage} />
                    )}

                    {/* 3. Text Content */}
                    {item.text ? (
                        <Text style={[
                            styles.messageText,
                            { color: isUser ? '#FFF' : theme.colors.text }
                        ]}>
                            {item.text}
                        </Text>
                    ) : null}

                    {/* 4. Footer Info (Time + Status) */}
                    <View style={styles.messageFooter}>
                        <Text
                            style={[
                                styles.timeText,
                                { color: isUser ? 'rgba(255,255,255,0.7)' : theme.colors.paragraphText }
                            ]}
                        >
                            {moment(item.timestamp).fromNow()}
                        </Text>

                        {isUser && (
                            <MaterialCommunityIcons
                                name={
                                    item.status === 'seen'
                                        ? 'check-all'
                                        : item.status === 'delivered'
                                            ? 'check-all'
                                            : item.status === 'sent'
                                                ? 'check'
                                                : 'clock-outline'
                                }
                                size={mS(14)}
                                color={
                                    item.status === 'seen'
                                        ? '#FFF'
                                        : 'rgba(255,255,255,0.6)'
                                }
                                style={{ marginLeft: hS(4) }}
                            />
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const handleCall = () => {
        if (!userPhone) {
            Alert.alert('Error', 'Contact number not available');
            return;
        }
        Linking.openURL(`tel:${userPhone}`).catch(() =>
            Alert.alert('Error', 'Call feature is not supported on this device')
        );
    };

    useEffect(() => {
        const animateDot = (anim: Animated.Value, delay: number) => {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(anim, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
                    Animated.timing(anim, { toValue: 0.3, duration: 300, useNativeDriver: true }),
                ])
            ).start();
        };

        animateDot(anim1, 0);
        animateDot(anim2, 200);
        animateDot(anim3, 400);

        // Status Pulse Animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    useEffect(() => {
        onHistory((history: any[]) => {
            const mapped: ChatMessage[] = history.map((m) => ({
                id: m.messageId,
                text: m.text ?? undefined,
                image: m.image ?? undefined,
                location: m.location ?? undefined,
                sender: m.senderId === userId ? "me" : "other",
                timestamp: m.timestamp,
                time: moment(m.timestamp).fromNow(),
                status: m.status ?? "seen",
            }));

            setMessages(mapped);
            setIsLoading(false);

            // Mark all unread messages as seen
            history.forEach(m => {
                if (m.senderId !== userId && m.status !== 'seen') {
                    sendSeen(m.messageId);
                }
            });

            // Scroll to bottom without animation (instant load)
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
        });

        onMessage((msg) => {
            // Avoid duplicate message if the server echos our own message back
            if (msg.senderId === userId) return;

            setMessages((prev) => [...prev, {
                id: msg.messageId,
                text: msg.text,
                image: msg.image,
                location: msg.location,
                sender: msg.senderId === userId ? "me" : "other",
                timestamp: msg.timestamp,
                time: moment(msg.timestamp).fromNow(),
                status: "seen",
            }]);

            // Mark incoming message as seen instantly
            sendSeen(msg.messageId);
        });

        onTyping((data) => {
            if (data.userId !== userId) {
                setTypingUser(data.isTyping ? "typing" : "");
            }
        });

        onDelivered((data) => {
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === data.messageId
                        ? { ...msg, status: 'sent' }
                        : msg
                )
            );
        });

        onDeliveredToUser((data) => {
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === data.messageId
                        ? { ...msg, status: 'delivered' }
                        : msg
                )
            );
        });

        onSeen((data) => {
            setMessages(prev =>
                prev.map(msg =>
                    msg.id === data.messageId
                        ? { ...msg, status: 'seen' }
                        : msg
                )
            );
        });

        const handleCancellation = (data: any) => {
            // Only disable chat if the event is for THIS ride
            if (data.rideId && data.rideId.toString() !== rideId.toString()) return;
            
            const status = data.status || data.trip_status;
            if (status === 'CANCELLED' || status === 'CANCEL' || status === 'COMPLETED' || status === 'COMPLETE') {
                setIsChatDisabled(true);
            }
        };

        socket?.on('trip_updated', handleCancellation);
        socket?.on('TRIP_CANCELLED', handleCancellation);

        return () => {
            socket?.off('trip_updated');
            socket?.off('TRIP_CANCELLED');
        };
    }, [socket, rideId, userId]);

    return (
        <View style={[styles.container, {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            backgroundColor: theme.colors.background
        }]}>
            <AppStatusBar />
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <TouchableOpacity 
                    onPress={() => {
                        triggerHaptic(HapticFeedbackTypes.selection);
                        navigation.goBack();
                    }} 
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.headerBackBtn}
                >
                    <MaterialCommunityIcons name="chevron-left" size={mS(30)} color={theme.colors.text} />
                </TouchableOpacity>

                <View style={styles.headerAvatarContainer}>
                    {userImage ? (
                        <Image source={{ uri: userImage }} style={styles.riderAvatar} />
                    ) : (
                        <View style={[styles.riderAvatar, styles.initialsContainer, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30' }]}>
                            <Text style={[styles.initialsText, { color: theme.colors.primary }]}>{getInitials(userName)}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.headerInfo}>
                    <View style={styles.nameRow}>
                        <Text style={[styles.headerName, { color: theme.colors.text }]} numberOfLines={1}>{userName || 'Rider'}</Text>
                        <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
                    </View>
                    <Text style={[styles.headerStatusText, { color: theme.colors.success || '#10B981' }]}>{t('online') || 'Online'} • {t('rider') || 'Rider'}</Text>
                    {typingUser !== "" && (
                        <View style={styles.typingOverlay}>
                             <View style={styles.typingDots}>
                                <Animated.View style={[styles.miniDot, { opacity: anim1 }]} />
                                <Animated.View style={[styles.miniDot, { opacity: anim2 }]} />
                                <Animated.View style={[styles.miniDot, { opacity: anim3 }]} />
                            </View>
                            <Text style={styles.typingText}>{t('typing') || 'typing...'}</Text>
                        </View>
                    )}
                </View>

                <TouchableOpacity 
                    style={[styles.callIcon, { backgroundColor: theme.colors.primary + '15' }, isChatDisabled && { opacity: 0.5 }]} 
                    onPress={handleCall}
                    disabled={isChatDisabled}
                >
                    <MaterialCommunityIcons name="phone" size={mS(22)} color={isChatDisabled ? theme.colors.paragraphText : theme.colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Chat Messages */}
            {isLoading ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item, index) => index.toString()}
                    contentContainerStyle={[styles.listContent, messages.length === 0 && { flex: 1 }]}
                    ListEmptyComponent={renderEmptyState}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    onLayout={() => flatListRef.current?.scrollToEnd()}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Input Footer */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? vS(90) : 0}
            >
                {!isChatDisabled ? (
                    <View style={[styles.footerWrapper, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
                        {/* Quick Replies */}
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.quickReplyScroll}
                        >
                            {QUICK_REPLIES.map((reply, index) => (
                                <TouchableOpacity 
                                    key={index}
                                    style={[styles.quickReplyChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC', borderColor: theme.colors.border }]}
                                    onPress={() => handleQuickReply(reply)}
                                >
                                    <Text style={[styles.quickReplyText, { color: theme.colors.text }]}>{reply}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <View style={[styles.inputContainer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
                            <TouchableOpacity
                                style={styles.attachBtn}
                                onPress={() => {
                                    triggerHaptic(HapticFeedbackTypes.impactLight);
                                    setShowMenu(true);
                                }}
                            >
                                <MaterialCommunityIcons name="plus-circle" size={mS(28)} color={theme.colors.primary} />
                            </TouchableOpacity>

                            <TextInput
                                style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', color: theme.colors.text }]}
                                placeholder={t('type_message') || "Type a message..."}
                                placeholderTextColor={theme.colors.paragraphText}
                                value={message}
                                onChangeText={(text) => {
                                    setMessage(text);
                                    sendTyping(true);
                                    typingTimeout?.current && clearTimeout(typingTimeout.current);
                                    typingTimeout.current = setTimeout(() => sendTyping(false), 1500);
                                }}
                                multiline
                                autoCapitalize="sentences"
                                autoCorrect={true}
                                enablesReturnKeyAutomatically={true}
                                keyboardAppearance={isDark ? 'dark' : 'light'}
                                spellCheck={true}
                            />

                            <TouchableOpacity
                                style={[styles.sendBtn, { backgroundColor: message ? theme.colors.primary : (isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9') }]}
                                onPress={() => {
                                    triggerHaptic(HapticFeedbackTypes.impactLight);
                                    handleSendMessage();
                                }}
                                disabled={!message}
                            >
                                <MaterialCommunityIcons
                                    name="send"
                                    size={mS(20)}
                                    color={message ? "#FFF" : theme.colors.paragraphText}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View style={[styles.closedChatContainer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border, paddingBottom: insets.bottom + vS(12) }]}>
                        <View style={[styles.closedChatContent, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: theme.colors.border }]}>
                            <MaterialCommunityIcons name="information-outline" size={mS(20)} color={theme.colors.paragraphText} />
                            <Text style={[styles.closedChatText, { color: theme.colors.paragraphText }]}>
                                {t('chat_closed_msg') || "This chat is now closed."}
                            </Text>
                        </View>
                    </View>
                )}
            </KeyboardAvoidingView>


            {/* Attachment Menu Modal */}
            {showMenu && (
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                >
                    <View style={[styles.attachmentMenu, { backgroundColor: theme.colors.card }]}>
                        <View style={styles.menuGrid}>
                            <AttachmentOption
                                icon="camera"
                                color="#FF4B4B"
                                label={t('camera') || "Camera"}
                                onPress={() => {
                                    setShowMenu(false);
                                    handleCameraLaunch();
                                }}
                            />
                            <AttachmentOption
                                icon="image"
                                color="#A855F7"
                                label={t('gallery') || "Gallery"}
                                onPress={() => {
                                    setShowMenu(false);
                                    handleGalleryLaunch();
                                }}
                            />
                            <AttachmentOption
                                icon="map-marker"
                                color="#10B981"
                                label={t('location') || "Location"}
                                onPress={() => {
                                    setShowMenu(false);
                                    shareCurrentLocation();
                                }}
                            />
                        </View>
                    </View>
                </TouchableOpacity>
            )}
        </View>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: mS(16),
        borderBottomWidth: 1,
    },
    headerBackBtn: { marginRight: hS(4) },
    headerAvatarContainer: { marginRight: hS(12) },
    headerInfo: { flex: 1 },
    headerName: { fontSize: mS(17), fontWeight: '700' },
    headerStatusText: { fontSize: mS(11), fontWeight: '500' },
    riderAvatar: {
        width: mS(42),
        height: mS(42),
        borderRadius: mS(21),
    },
    initialsContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    initialsText: {
        fontSize: mS(16),
        fontWeight: '700',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    pulseDot: {
        width: mS(8),
        height: mS(8),
        borderRadius: mS(4),
        backgroundColor: '#10B981',
        marginLeft: hS(6),
    },
    typingOverlay: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: vS(2),
    },
    typingDots: {
        flexDirection: 'row',
        marginRight: hS(4),
    },
    miniDot: {
        width: mS(4),
        height: mS(4),
        borderRadius: mS(2),
        backgroundColor: '#10B981',
        marginHorizontal: mS(1),
    },
    typingText: {
        fontSize: mS(10),
        color: '#10B981',
        fontWeight: '600',
        fontStyle: 'italic',
    },
    callIcon: { padding: mS(8), borderRadius: mS(12) },
    listContent: { padding: mS(16), paddingBottom: vS(20) },
    messageBubble: {
        maxWidth: '80%',
        padding: mS(12),
        borderRadius: mS(20),
        marginBottom: vS(12),
    },
    meBubble: {
        alignSelf: 'flex-end',
        borderBottomRightRadius: vS(4),
    },
    otherBubble: {
        alignSelf: 'flex-start',
        borderBottomLeftRadius: vS(4),
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: mS(4),
    },
    messageText: { fontSize: mS(15), lineHeight: vS(20) },
    timeText: { fontSize: mS(10), marginTop: vS(4) },
    messageFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: vS(2),
    },
    footerWrapper: {
        borderTopWidth: 1,
    },
    quickReplyScroll: {
        paddingHorizontal: hS(12),
        paddingVertical: vS(10),
    },
    quickReplyChip: {
        paddingHorizontal: hS(16),
        paddingVertical: vS(8),
        borderRadius: mS(20),
        borderWidth: 1,
        marginRight: hS(8),
    },
    quickReplyText: {
        fontSize: mS(13),
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: hS(40),
    },
    emptyIconCircle: {
        width: mS(100),
        height: mS(100),
        borderRadius: mS(50),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: vS(20),
    },
    emptyTitle: {
        fontSize: mS(18),
        fontWeight: '700',
        marginBottom: vS(8),
        textAlign: 'center',
    },
    emptyDesc: {
        fontSize: mS(14),
        textAlign: 'center',
        lineHeight: vS(20),
        opacity: 0.7,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: mS(12),
    },
    attachBtn: { padding: mS(8) },
    input: {
        flex: 1,
        borderRadius: mS(20),
        paddingHorizontal: hS(16),
        paddingVertical: vS(8),
        marginHorizontal: hS(8),
        maxHeight: vS(100),
        fontSize: mS(15),
    },
    sendBtn: {
        width: hS(44),
        height: vS(44),
        borderRadius: mS(22),
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapWrapper: {
        height: vS(150),
        width: '100%',
        borderRadius: mS(12),
        overflow: 'hidden',
        backgroundColor: '#E2E8F0',
    },
    miniMap: {
        ...StyleSheet.absoluteFillObject,
    },
    messageImage: {
        width: hS(200),
        height: vS(150),
        borderRadius: mS(12),
        marginBottom: vS(4),
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    attachmentMenu: {
        borderTopLeftRadius: mS(24),
        borderTopRightRadius: mS(24),
        padding: mS(20),
        paddingBottom: vS(40),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 20,
    },
    menuGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    menuItem: {
        alignItems: 'center',
        width: hS(80),
    },
    iconCircle: {
        width: mS(54),
        height: mS(54),
        borderRadius: mS(27),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: vS(8),
    },
    menuLabel: {
        fontSize: mS(13),
        color: '#475569',
        fontWeight: '500',
    },
    closedChatContainer: {
        borderTopWidth: 1,
        padding: mS(16),
        alignItems: 'center',
        justifyContent: 'center',
    },
    closedChatContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: vS(10),
        paddingHorizontal: hS(16),
        borderRadius: mS(12),
        borderWidth: 1,
    },
    closedChatText: {
        fontSize: mS(14),
        marginLeft: hS(10),
        fontWeight: '500',
    },
});

export default ChatScreen;