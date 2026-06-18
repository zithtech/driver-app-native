import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { mS, vS, hS } from '../../lib/scale';
import { HapticFeedbackTypes } from 'react-native-haptic-feedback';
import { useHaptic } from '../../hooks/useHaptic';
import { useCreateSupportTicketMutation, useLazyGetTicketMessagesQuery } from '../../service/driverApi';
import { useSelector } from 'react-redux';
import { DocumentScreen_Nav } from '../../Navigations/navigations';
import { socket } from '../../Socket/socket';
import moment from 'moment';

type Message = {
  id: string;
  text: string;
  sender: 'me' | 'bot' | 'admin' | 'system';
  timestamp: number;
  action?: 'create_ticket' | 'go_documents' | 'return_ai' | 'pick_category' | null;
};

const CATEGORY_OPTIONS = [
  { key: 'payment', label: '💰 Payment', icon: 'card-outline' },
  { key: 'documents', label: '📄 Documents', icon: 'document-text-outline' },
  { key: 'app_crash', label: '🐛 App Issue', icon: 'bug-outline' },
  { key: 'account', label: '👤 Account', icon: 'person-outline' },
  { key: 'subscription', label: '📦 Subscription', icon: 'cube-outline' },
  { key: 'rides', label: '🚗 Rides', icon: 'car-outline' },
  { key: 'general', label: '❓ Other', icon: 'help-circle-outline' },
];

const INITIAL_BOT_MESSAGE = "Hi there! 👋 I'm your VDrive Assistant. How can I help you today?";
const AGENT_TIMEOUT_MS = 30000; // 30 seconds

const QUICK_REPLIES = [
  { label: '📦 Subscription Plan', text: 'What is the subscription plan?' },
  { label: '💰 Check Earnings', text: 'How do I get paid?' },
  { label: '🚗 Accept Rides', text: 'How do I accept a ride?' },
  { label: '📄 Documents', text: 'Why was my document rejected?' },
  { label: '🎧 Live Agent', text: 'Talk to an agent' },
];

const TypingIndicator = ({ color }: { color: string }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(dot, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            Animated.delay(600),
          ])
        )
      ]);
    };
    Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 150),
      animateDot(dot3, 300),
    ]).start();
  }, [dot1, dot2, dot3]);

  const dotStyle = (dot: Animated.Value) => ({
    transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
    backgroundColor: color,
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: vS(20), paddingHorizontal: hS(4), paddingVertical: vS(4) }}>
      <Animated.View style={[styles.typingDot, dotStyle(dot1)]} />
      <Animated.View style={[styles.typingDot, dotStyle(dot2)]} />
      <Animated.View style={[styles.typingDot, dotStyle(dot3)]} />
    </View>
  );
};

const FaqChatbotModal = ({ visible, onClose }: any) => {
  const { colors, fonts, dark }: any = useTheme();
  const { t } = useTranslation();
  const { triggerHaptic } = useHaptic();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  
  // Live Chat State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const timeoutTimerRef = useRef<any>(null);

  const driver = useSelector((state: any) => state.userSlice?.user);
  const [createTicket] = useCreateSupportTicketMutation();

  useEffect(() => {
    if (visible && messages.length === 0) {
      const firstName = (driver?.full_name || driver?.name || '').split(' ')[0] || '';
      const greetingName = firstName ? ` ${firstName}` : ' there';
      setMessages([
        {
          id: Date.now().toString(),
          text: `Hi${greetingName}! 👋 I'm your VDrive Assistant. How can I help you today?`,
          sender: 'bot',
          timestamp: Date.now(),
        },
      ]);
    }
  }, [visible, messages.length, driver]);

  useEffect(() => {
    if (isLiveMode && activeTicketId) {
      if (!socket.connected) socket.connect();

      socket.emit("joinSupportTicket", {
        ticketId: activeTicketId,
        userId: driver?.driverId || driver?.userId,
        userType: 'driver'
      });

      startTimeoutTimer();

      const handleReceive = (data: any) => {
        if (data.sender_type === 'admin') {
          clearTimeoutTimer();
        }

        const isFromMe = data.sender_id === (driver?.driverId || driver?.userId);
        if (isFromMe) return; 

        setMessages((prev) => {
          if (prev.find(m => m.id === data.id)) return prev;
          return [...prev, {
            id: data.id,
            text: data.message,
            sender: data.sender_type === 'admin' ? 'admin' : 'system',
            timestamp: new Date(data.created_at).getTime()
          }];
        });
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      };

      const handleSwitch = (data: any) => {
        if (data.ticketId === activeTicketId) {
          setIsLiveMode(false);
          setActiveTicketId(null);
          clearTimeoutTimer();
          setMessages((prev) => [...prev, 
            {
              id: 'sys-end-' + Date.now(),
              text: "Live support chat closed.",
              sender: 'system',
              timestamp: Date.now()
            },
            {
              id: Date.now().toString(),
              text: "I am back! Is there anything else I can help you with?",
              sender: 'bot',
              timestamp: Date.now()
            }
          ]);
          triggerHaptic(HapticFeedbackTypes.notificationSuccess);
        }
      };

      socket.on("receiveSupportMessage", handleReceive);
      socket.on("SWITCH_TO_AI", handleSwitch);

      return () => {
        socket.off("receiveSupportMessage", handleReceive);
        socket.off("SWITCH_TO_AI", handleSwitch);
        clearTimeoutTimer();
      };
    }
  }, [isLiveMode, activeTicketId, driver]);

  const startTimeoutTimer = () => {
    clearTimeoutTimer();
    timeoutTimerRef.current = setTimeout(() => {
      handleAgentTimeout();
    }, AGENT_TIMEOUT_MS);
  };

  const clearTimeoutTimer = () => {
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  };

  const handleAgentTimeout = () => {
    const fallbackMsg: Message = {
      id: 'timeout-' + Date.now(),
      text: "⌛ All our agents are currently busy assisting other drivers. Your ticket is recorded, and we will notify you when an agent replies. You can close this chat or return to the bot helper.",
      sender: 'bot',
      timestamp: Date.now(),
      action: 'return_ai'
    };
    setMessages((prev) => [...prev, fallbackMsg]);
    triggerHaptic(HapticFeedbackTypes.notificationWarning);
  };

  const generateBotResponse = (userText: string): { text: string; action?: Message['action'] } => {
    const text = userText.toLowerCase();

    // Greeting Intent detection (supports hii, hellooo, helo, heyy, yo, etc.)
    const greetingRegex = /\b(hi+|hello+|he+y+|helo+|hola|yo|greetings|good\s*(morning|afternoon|evening))\b/i;
    if (greetingRegex.test(text)) {
      const firstName = (driver?.full_name || driver?.name || '').split(' ')[0] || '';
      const greetingName = firstName ? ` ${firstName}` : '';
      return { text: `Hello${greetingName}! 👋 How can I assist you today?` };
    }

    // Advanced AI Logic Additions
    if (text.includes('plan') || text.includes('subscription') || text.includes('package') || text.includes('renewal')) {
      return { text: "We offer Weekly and Monthly subscription plans for drivers. You can view, upgrade, or renew your active plan directly from the 'Subscription' section in your Driver App menu." };
    }
    
    if (text.includes('price') || text.includes('fare') || text.includes('earnings') || text.includes('money') || text.includes('paid')) {
      return { text: "Your earnings are calculated based on the base fare, distance traveled, and trip time. Fares are deposited directly to your registered bank account weekly. You can track daily earnings in the 'Wallet' tab." };
    }
    
    if (text.includes('ride') || text.includes('trip') || text.includes('booking') || text.includes('accept')) {
      return { text: "To accept rides, simply toggle your status to 'Online' at the top of the home screen. When a ride request appears, you have 10 seconds to tap 'Accept'. Once the rider boards, swipe to 'Start Trip'." };
    }
    
    if (text.includes('document') || text.includes('rc') || text.includes('license') || text.includes('upload') || text.includes('reject')) {
      return { text: "Document verification typically takes 24-48 hours. If a document was rejected, please navigate to the 'Documents' page to see the specific reason and re-upload a clear photo." };
    }

    if (text.includes('ticket') || text.includes('human') || text.includes('agent') || text.includes('talk to')) {
      return {
        text: "I'll connect you to our support team right away. Tap the button below to start a live chat.",
        action: 'create_ticket',
      };
    }

    // Tiered Misunderstanding Logic
    const nextFail = failCount + 1;
    setFailCount(nextFail);

    if (nextFail === 1) {
      return { text: "I'm sorry, I didn't quite get that. Could you try rephrasing? I can help with rides, earnings, documents, and subscriptions." };
    }
    
    if (nextFail === 2) {
      return { text: "I'm still having trouble understanding. Maybe one of the quick options below is what you need?" };
    }

    if (nextFail >= 3) {
      return { 
        text: "I'm still learning! 😅 Since I can't find a clear answer, let's talk to a real person from our support team.",
        action: 'create_ticket'
      };
    }

    return {
      text: "I want to make sure you get the help you need. Let's connect you to an agent.",
      action: 'create_ticket',
    };
  };

  const handleShowCategoryPicker = () => {
    setShowCategoryPicker(true);
    setMessages((prev) => [...prev, {
      id: 'cat-prompt-' + Date.now(),
      text: "Before connecting you, please select your issue category so we can help you faster:",
      sender: 'bot',
      timestamp: Date.now(),
      action: 'pick_category',
    }]);
    triggerHaptic(HapticFeedbackTypes.impactLight);
  };

  const handleCategorySelected = async (categoryKey: string) => {
    const categoryLabel = CATEGORY_OPTIONS.find(c => c.key === categoryKey)?.label || categoryKey;
    setShowCategoryPicker(false);

    setMessages((prev) => [...prev, 
      {
        id: 'cat-selected-' + Date.now(),
        text: categoryLabel,
        sender: 'me',
        timestamp: Date.now(),
      },
      {
        id: 'sys-transfer-' + Date.now(),
        text: "Transferring you to a live agent...",
        sender: 'system',
        timestamp: Date.now(),
      }
    ]);

    const driverId = driver?.driverId || driver?.userId;
    if (!driverId) {
      Alert.alert('Error', 'Please log in to create a ticket.');
      return;
    }

    try {
      const res = await createTicket({
        driver_id: driverId,
        subject: `${categoryLabel} - Live Support`,
        description: `Driver requested live support via chatbot. Category: ${categoryKey}`,
        priority: 'high',
        category: categoryKey,
      }).unwrap();

      const ticketId = res.data.id;
      setActiveTicketId(ticketId);
      setIsLiveMode(true);
      triggerHaptic(HapticFeedbackTypes.notificationSuccess);
    } catch (error) {
      Alert.alert('Error', 'Could not start live chat. Please try again later.');
    }
  };

  const handleReturnToAI = () => {
    if (activeTicketId) {
      socket.emit("endSupportChat", { ticketId: activeTicketId, driverId: driver?.driverId || driver?.userId });
    }
    setIsLiveMode(false);
    setActiveTicketId(null);
    clearTimeoutTimer();
    setMessages((prev) => [...prev, 
      {
        id: 'sys-end-' + Date.now(),
        text: "Live support chat closed.",
        sender: 'system',
        timestamp: Date.now()
      },
      {
        id: Date.now().toString(),
        text: "I am back! Is there anything else I can help you with?",
        sender: 'bot',
        timestamp: Date.now()
      }
    ]);
  };

  const confirmEndChat = () => {
    Alert.alert(
      "End Support Chat",
      "Has your issue been resolved?",
      [
        { text: "Issue Solved", onPress: handleReturnToAI, style: "destructive" },
        { text: "Need More Help", style: "default" },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'me',
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    triggerHaptic(HapticFeedbackTypes.impactLight);

    if (isLiveMode && activeTicketId) {
      socket.emit("sendSupportMessage", {
        ticketId: activeTicketId,
        senderId: driver?.driverId || driver?.userId,
        senderType: 'driver',
        message: text.trim()
      });
      if (!timeoutTimerRef.current) startTimeoutTimer();
    } else {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const response = generateBotResponse(text);
        setMessages((prev) => [...prev, {
          id: Date.now().toString(),
          text: response.text,
          sender: 'bot',
          timestamp: Date.now(),
          action: response.action || null,
        }]);
        triggerHaptic(HapticFeedbackTypes.notificationSuccess);
      }, 1500);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isBot = item.sender === 'bot';
    const isAdmin = item.sender === 'admin';
    const isMe = item.sender === 'me';
    const isSystem = item.sender === 'system';

    if (isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={[styles.systemMessagePill, { backgroundColor: dark ? '#374151' : '#F3F4F6' }]}>
            <Text style={[styles.systemMessageText, { color: colors.text + '90' }]}>{item.text.toUpperCase()}</Text>
          </View>
        </View>
      );
    }

    return (
      <View>
        <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowBot]}>
          {(isBot || isAdmin) && (
            <View style={[styles.botAvatar, { backgroundColor: isAdmin ? '#10B98120' : colors.primary + '15' }]}>
              {isAdmin && <View style={[styles.onlineDot, { position: 'absolute', top: 0, right: 0, width: mS(8), height: mS(8), backgroundColor: '#10B981' }]} />}
              <Ionicons name={isAdmin ? "person" : "sparkles"} size={mS(14)} color={isAdmin ? "#10B981" : colors.primary} />
            </View>
          )}
          
          <View style={[
            styles.messageBubble,
            isMe ? [styles.bubbleMe, { backgroundColor: colors.primary }] : [styles.bubbleBot, { backgroundColor: dark ? '#2A2A2A' : '#F9FAFB' }]
          ]}>
            {isAdmin && <Text style={[styles.senderName, { color: '#10B981' }]}>Support Agent</Text>}
            <Text style={[styles.messageText, { color: isMe ? '#FFFFFF' : colors.text }]}>
              {item.text}
            </Text>
            
            <View style={styles.timeContainer}>
              <Text style={[styles.timeText, { color: isMe ? 'rgba(255,255,255,0.75)' : colors.text + '60' }]}>
                {moment(item.timestamp).format('HH:mm')}
              </Text>
              {isMe && isLiveMode && (
                <Ionicons name="checkmark-done" size={mS(12)} color="rgba(255,255,255,0.9)" style={{ marginLeft: hS(4) }} />
              )}
            </View>
          </View>
        </View>

        {item.action && (
          <View style={styles.actionButtonsContainer}>
            {item.action === 'create_ticket' && !isLiveMode && !showCategoryPicker && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#EF444415', borderColor: '#EF444440' }]}
                onPress={handleShowCategoryPicker}
              >
                <Ionicons name="headset-outline" size={mS(16)} color="#EF4444" />
                <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Connect to Live Agent</Text>
              </TouchableOpacity>
            )}
            {item.action === 'pick_category' && showCategoryPicker && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingLeft: hS(44), gap: mS(8), marginTop: vS(4) }}>
                {CATEGORY_OPTIONS.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.actionButton, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}
                    onPress={() => handleCategorySelected(cat.key)}
                  >
                    <Text style={{ fontSize: mS(13) }}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {item.action === 'return_ai' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}
                onPress={handleReturnToAI}
              >
                <Ionicons name="chatbubble-outline" size={mS(16)} color={colors.primary} />
                <Text style={[styles.actionButtonText, { color: colors.primary }]}>Return to AI Helper</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: Math.max(insets.top, vS(16)) }]}>
          {isLiveMode ? (
            <View style={{ width: mS(60) }} />
          ) : (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={mS(24)} color={colors.text} />
            </TouchableOpacity>
          )}
          
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: colors.text, ...fonts.bold }]}>
              {isLiveMode ? 'Live Support' : 'VDrive Assistant'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: vS(4) }}>
              <View style={[styles.onlineDot, { backgroundColor: isLiveMode ? '#10B981' : colors.primary }]} />
              <Text style={[styles.headerSubtitle, { color: isLiveMode ? '#10B981' : colors.primary, marginLeft: hS(6) }]}>
                {isLiveMode ? 'Agent Connected' : 'AI Bot Online'}
              </Text>
            </View>
          </View>
          
          {isLiveMode ? (
            <TouchableOpacity onPress={confirmEndChat} style={[styles.endChatBtn, { backgroundColor: '#EF444415' }]}>
              <Text style={{ color: '#EF4444', fontSize: mS(12), fontWeight: '700' }}>End Chat</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: mS(60) }} />
          )}
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListFooterComponent={isTyping ? (
            <View style={[styles.messageRow, styles.messageRowBot]}>
              <View style={[styles.botAvatar, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="sparkles" size={mS(14)} color={colors.primary} />
              </View>
              <View style={[styles.bubbleBot, styles.typingBubble, { backgroundColor: dark ? '#2A2A2A' : '#F9FAFB' }]}>
                <TypingIndicator color={colors.primary} />
              </View>
            </View>
          ) : null}
        />

        {!isLiveMode && !isTyping && (
          <View style={styles.quickRepliesContainer}>
            <FlatList
              data={QUICK_REPLIES}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: hS(16), gap: hS(8) }}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.quickReplyChip, { borderColor: colors.border, backgroundColor: dark ? colors.card : '#FFFFFF' }]}
                  onPress={() => handleSend(item.text)}
                >
                  <Text style={[styles.quickReplyText, { color: colors.text }]}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.inputWrapper, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, vS(10)) }]}>
            <View style={[styles.inputContainer, { backgroundColor: dark ? colors.card : '#F3F4F6' }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={isLiveMode ? "Message support agent..." : "Ask me anything..."}
                placeholderTextColor={colors.text + '60'}
                value={inputText}
                onChangeText={setInputText}
                multiline
              />
              <TouchableOpacity 
                style={[styles.sendBtn, { backgroundColor: inputText.trim() ? colors.primary : colors.text + '20' }]}
                onPress={() => handleSend(inputText)}
                disabled={!inputText.trim()}
              >
                <Ionicons name="send" size={mS(14)} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: hS(16), paddingVertical: vS(16), borderBottomWidth: 1 },
  closeBtn: { padding: mS(4), width: mS(40) },
  endChatBtn: { paddingHorizontal: hS(12), paddingVertical: vS(8), borderRadius: mS(8) },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: mS(16) },
  headerSubtitle: { fontSize: mS(11), fontWeight: '700' },
  onlineDot: { width: mS(6), height: mS(6), borderRadius: mS(3) },
  listContent: { padding: mS(16), paddingBottom: vS(20) },
  messageRow: { flexDirection: 'row', marginBottom: vS(16), width: '100%' },
  messageRowBot: { justifyContent: 'flex-start' },
  messageRowMe: { justifyContent: 'flex-end' },
  botAvatar: { width: mS(28), height: mS(28), borderRadius: mS(14), justifyContent: 'center', alignItems: 'center', marginRight: hS(10), alignSelf: 'flex-end', marginBottom: vS(4) },
  messageBubble: { maxWidth: '80%', paddingHorizontal: hS(16), paddingVertical: vS(12), shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  bubbleBot: { borderTopLeftRadius: mS(18), borderTopRightRadius: mS(18), borderBottomRightRadius: mS(18), borderBottomLeftRadius: mS(4) },
  bubbleMe: { borderTopLeftRadius: mS(18), borderTopRightRadius: mS(18), borderBottomLeftRadius: mS(18), borderBottomRightRadius: mS(4) },
  senderName: { fontSize: mS(11), fontWeight: '800', marginBottom: vS(4) },
  messageText: { fontSize: mS(14), lineHeight: vS(20) },
  timeContainer: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: vS(4) },
  timeText: { fontSize: mS(10), fontWeight: '500' },
  typingBubble: { paddingVertical: vS(10), paddingHorizontal: hS(16) },
  typingDot: { width: mS(6), height: mS(6), borderRadius: mS(3), marginHorizontal: hS(2) },
  systemMessageContainer: { alignItems: 'center', marginVertical: vS(16), width: '100%' },
  systemMessagePill: { paddingHorizontal: hS(16), paddingVertical: vS(6), borderRadius: mS(16) },
  systemMessageText: { fontSize: mS(10), fontWeight: '700', letterSpacing: 0.5 },
  quickRepliesContainer: { marginBottom: vS(12) },
  quickReplyChip: { paddingHorizontal: hS(16), paddingVertical: vS(10), borderRadius: mS(24), borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  quickReplyText: { fontSize: mS(13), fontWeight: '600' },
  actionButtonsContainer: { flexDirection: 'row', paddingLeft: hS(44), marginBottom: vS(16), flexWrap: 'wrap' },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: hS(14), paddingVertical: vS(8), borderRadius: mS(20), borderWidth: 1, marginRight: hS(8), marginTop: vS(6) },
  actionButtonText: { fontSize: mS(12), fontWeight: '700', marginLeft: hS(6) },
  inputWrapper: { borderTopWidth: 1, paddingHorizontal: hS(16), paddingTop: vS(12) },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: mS(24), paddingHorizontal: hS(12), paddingVertical: vS(6) },
  input: { flex: 1, minHeight: vS(40), maxHeight: vS(120), paddingTop: vS(10), paddingBottom: vS(10), fontSize: mS(14) },
  sendBtn: { width: mS(36), height: mS(36), borderRadius: mS(18), justifyContent: 'center', alignItems: 'center', marginLeft: hS(8) },
});

export default FaqChatbotModal;
