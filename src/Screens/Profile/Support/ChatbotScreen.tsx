import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator, FlatList, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../../context/ThemeContext';
import { Text } from '../../../Components';
import AppStatusBar from '../../../Components/AppStatusBar';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';
import { API_URL } from '../../../constant/config';
import { ChatHistoryScreen_Nav } from '../../../Navigations/navigations';

const TOPICS = [
    { id: 1, title: 'Payments & Earnings', subtitle: 'Payouts, earnings, invoices', icon: 'wallet-outline', color: '#3B82F6', bgColor: '#EFF6FF' },
    { id: 2, title: 'Trips & Bookings', subtitle: 'Ride issues, changes, cancellations', icon: 'car-outline', color: '#F59E0B', bgColor: '#FFFBEB' },
    { id: 3, title: 'Account & Documents', subtitle: 'KYC, documents, verification', icon: 'document-text-outline', color: '#10B981', bgColor: '#ECFDF5' },
    { id: 4, title: 'Subscription & Plans', subtitle: 'Plans, renewals, benefits', icon: 'star-outline', color: '#8B5CF6', bgColor: '#F5F3FF' },
    { id: 5, title: 'Incentives & Bonuses', subtitle: 'Bonuses, offers, targets', icon: 'gift-outline', color: '#F59E0B', bgColor: '#FFFBEB' },
    { id: 6, title: 'Safety & Guidelines', subtitle: 'Safety tips, rules, guidelines', icon: 'shield-checkmark-outline', color: '#EF4444', bgColor: '#FEF2F2' },
];

const QUICK_ACTIONS = [
    { id: 1, label: 'Talk to Agent', icon: 'headset-outline' },
    { id: 2, label: 'Track Payout', icon: 'cash-outline' },
    { id: 3, label: 'View Earnings', icon: 'bar-chart-outline' },
    { id: 4, label: 'More', icon: 'grid-outline' },
];

interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    content: string;
    timestamp: string;
}

const ChatbotScreen = ({ navigation, route }: any) => {
    const { theme, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();
    const [message, setMessage] = useState('');
    const [showAllTopics, setShowAllTopics] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);
    const scrollViewRef = useRef<ScrollView>(null);

    // Typing dots animation
    const dot1Anim = useRef(new Animated.Value(0.3)).current;
    const dot2Anim = useRef(new Animated.Value(0.3)).current;
    const dot3Anim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        if (!isLoading) return;

        const createPulse = (animValue: Animated.Value, delay: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(animValue, { toValue: 1, duration: 300, useNativeDriver: true }),
                    Animated.timing(animValue, { toValue: 0.3, duration: 300, useNativeDriver: true }),
                ])
            );
        };

        const anim1 = createPulse(dot1Anim, 0);
        const anim2 = createPulse(dot2Anim, 200);
        const anim3 = createPulse(dot3Anim, 400);

        anim1.start();
        anim2.start();
        anim3.start();

        return () => {
            anim1.stop();
            anim2.stop();
            anim3.stop();
            dot1Anim.setValue(0.3);
            dot2Anim.setValue(0.3);
            dot3Anim.setValue(0.3);
        };
    }, [isLoading]);

    const displayedTopics = showAllTopics ? TOPICS : TOPICS.slice(0, 2);

    const formatTime = () => {
        const now = new Date();
        let hours = now.getHours();
        const mins = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${mins} ${ampm}`;
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const sendMessage = async (text: string) => {
        if (!text.trim()) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: text.trim(),
            timestamp: formatTime(),
        };

        setMessages(prev => [...prev, userMsg]);
        setMessage('');
        setShowWelcome(false);
        setIsLoading(true);
        scrollToBottom();

        try {
            // Build history for context (cap at last 20 messages)
            const history = messages.slice(-20).map(m => ({
                role: m.role,
                content: m.content,
            }));

            const response = await fetch(`${API_URL}/api/support/chatbot/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text.trim(),
                    history,
                }),
            });

            const data = await response.json();
            
            const botMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: data?.data?.reply || "I'm sorry, I couldn't process your request. Please try again.",
                timestamp: formatTime(),
            };

            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                content: "I'm having trouble connecting right now. Please check your internet connection and try again.",
                timestamp: formatTime(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
            scrollToBottom();
        }
    };

    // Handle deep link or initial search query
    useEffect(() => {
        if (route.params?.initialMessage) {
            sendMessage(route.params.initialMessage);
            // Clear the param so it doesn't trigger again on re-focus
            navigation.setParams({ initialMessage: undefined });
        }
    }, [route.params?.initialMessage, navigation]);

    const handleTopicPress = (topic: typeof TOPICS[0]) => {
        sendMessage(`I need help with ${topic.title}`);
    };

    const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
        if (action.label === 'Talk to Agent') {
            sendMessage("I'd like to talk to a live support agent");
        } else if (action.label === 'Track Payout') {
            sendMessage("How can I track my payout status?");
        } else if (action.label === 'View Earnings') {
            sendMessage("How do I view my earnings breakdown?");
        } else {
            sendMessage(`Tell me about ${action.label}`);
        }
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF' }]} edges={['top']}>
            <AppStatusBar />
            
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={s(24)} color={theme.colors.text} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Support Assistant</Text>
                    <View style={styles.statusRow}>
                        <View style={styles.onlineDot} />
                        <Text style={styles.onlineText}>Online</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate(ChatHistoryScreen_Nav)}>
                        <Ionicons name="time-outline" size={s(22)} color={theme.colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}>
                        <Ionicons name="ellipsis-horizontal" size={s(22)} color={theme.colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            <KeyboardAvoidingView 
                style={styles.container} 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView 
                    ref={scrollViewRef}
                    showsVerticalScrollIndicator={false} 
                    contentContainerStyle={styles.scrollContent}
                    onContentSizeChange={() => scrollToBottom()}
                >
                    {/* Welcome Banner — only show when no messages */}
                    {showWelcome ? (
                        <>
                            <View style={[styles.bannerCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
                                <View style={styles.bannerTop}>
                                    <View style={styles.robotContainer}>
                                        <Image 
                                            source={require('../../../assets/images/chatbot.png')} 
                                            style={styles.robotImage}
                                            resizeMode="contain"
                                        />
                                    </View>
                                    <View style={styles.bannerTexts}>
                                        <Text style={[styles.bannerTitle, { color: theme.colors.text }]}>Hi, I'm your Support Assistant 👋</Text>
                                        <Text style={[styles.bannerDesc, { color: theme.colors.paragraphText }]}>
                                            I can help you with your queries. Ask me anything or choose a topic below.
                                        </Text>
                                    </View>
                                </View>
                                
                                <View style={styles.featuresRow}>
                                    <View style={styles.featurePill}>
                                        <Ionicons name="flash-outline" size={s(16)} color="#3B82F6" />
                                        <View style={styles.featurePillTexts}>
                                            <Text style={[styles.featurePillTitle, { color: theme.colors.text }]}>Quick Answers</Text>
                                            <Text style={[styles.featurePillDesc, { color: theme.colors.paragraphText }]}>Get instant help</Text>
                                        </View>
                                    </View>
                                    <View style={styles.featurePill}>
                                        <Ionicons name="shield-checkmark-outline" size={s(16)} color="#3B82F6" />
                                        <View style={styles.featurePillTexts}>
                                            <Text style={[styles.featurePillTitle, { color: theme.colors.text }]}>Secure & Private</Text>
                                            <Text style={[styles.featurePillDesc, { color: theme.colors.paragraphText }]}>Your data is safe</Text>
                                        </View>
                                    </View>
                                    <View style={styles.featurePill}>
                                        <Ionicons name="time-outline" size={s(16)} color="#3B82F6" />
                                        <View style={styles.featurePillTexts}>
                                            <Text style={[styles.featurePillTitle, { color: theme.colors.text }]}>24/7 Available</Text>
                                            <Text style={[styles.featurePillDesc, { color: theme.colors.paragraphText }]}>We're here anytime</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Popular Topics */}
                            <View style={styles.topicsSection}>
                                <View style={styles.sectionHeader}>
                                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Popular Topics</Text>
                                    <TouchableOpacity onPress={() => setShowAllTopics(!showAllTopics)}>
                                        <Text style={styles.viewAllText}>{showAllTopics ? 'View Less' : 'View All'}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.topicsGrid}>
                                    {displayedTopics.map((topic) => (
                                        <TouchableOpacity 
                                            key={topic.id} 
                                            style={[styles.topicCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}
                                            onPress={() => handleTopicPress(topic)}
                                        >
                                            <View style={[styles.topicIconBg, { backgroundColor: isDark ? topic.color + '20' : topic.bgColor }]}>
                                                <Ionicons name={topic.icon} size={s(18)} color={topic.color} />
                                            </View>
                                            <View style={styles.topicTexts}>
                                                <Text style={[styles.topicTitle, { color: theme.colors.text }]} numberOfLines={1}>{topic.title}</Text>
                                                <Text style={[styles.topicSubtitle, { color: theme.colors.paragraphText }]} numberOfLines={1}>{topic.subtitle}</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={s(16)} color="#94A3B8" />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </>
                    ) : null}

                    {/* Chat Messages */}
                    {messages.length > 0 ? (
                        <View style={styles.chatArea}>
                            <Text style={[styles.dateSeparator, { color: theme.colors.paragraphText }]}>Today</Text>

                            {messages.map((msg) => (
                                <View key={msg.id}>
                                    {msg.role === 'user' ? (
                                        <>
                                            <View style={styles.userMessageRow}>
                                                <View style={styles.userBubble}>
                                                    <Text style={styles.userMessageText}>{msg.content}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.timeTextRightRow}>
                                                <Text style={styles.timeTextRight}>{msg.timestamp}</Text>
                                                <Ionicons name="checkmark-done" size={s(14)} color="#3B82F6" style={{ marginLeft: 4 }} />
                                            </View>
                                        </>
                                    ) : (
                                        <>
                                            <View style={styles.botMessageRow}>
                                                <View style={styles.botAvatarSmall}>
                                                    <Image 
                                                        source={require('../../../assets/images/chatbot.png')} 
                                                        style={styles.robotImageSmall}
                                                    />
                                                </View>
                                                <View style={[styles.botBubble, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
                                                    <Text style={[styles.messageText, { color: theme.colors.text }]}>{msg.content}</Text>
                                                    <Text style={styles.bubbleTimeRight}>{msg.timestamp}</Text>
                                                </View>
                                            </View>
                                        </>
                                    )}
                                </View>
                            ))}

                            {/* Typing Indicator */}
                            {isLoading ? (
                                <View style={styles.botMessageRow}>
                                    <View style={styles.botAvatarSmall}>
                                        <Image 
                                            source={require('../../../assets/images/chatbot.png')} 
                                            style={styles.robotImageSmall}
                                        />
                                    </View>
                                    <View style={[styles.botBubble, styles.typingBubble, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
                                        <View style={styles.typingDots}>
                                            <Animated.View style={[styles.typingDot, { opacity: dot1Anim }]} />
                                            <Animated.View style={[styles.typingDot, { opacity: dot2Anim }]} />
                                            <Animated.View style={[styles.typingDot, { opacity: dot3Anim }]} />
                                        </View>
                                        <Text style={[styles.typingText, { color: theme.colors.paragraphText }]}>Typing...</Text>
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    ) : null}
                </ScrollView>

                {/* Quick Actions Scroll */}
                <View style={[styles.quickActionsContainer, { backgroundColor: theme.colors.card }]}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsScroll}>
                        {QUICK_ACTIONS.map((action) => (
                            <TouchableOpacity 
                                key={action.id} 
                                style={[styles.quickActionChip, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: theme.colors.border }]}
                                onPress={() => handleQuickAction(action)}
                            >
                                <Ionicons name={action.icon} size={s(16)} color="#3B82F6" />
                                <Text style={[styles.quickActionText, { color: theme.colors.text }]}>{action.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Input Area */}
                    <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, vs(16)) }]}>
                        <TouchableOpacity style={styles.attachBtn}>
                            <Ionicons name="attach" size={s(24)} color="#94A3B8" />
                        </TouchableOpacity>
                        <View style={[styles.inputContainer, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                            <TextInput
                                style={[styles.input, { color: theme.colors.text }]}
                                placeholder="Type your message..."
                                placeholderTextColor="#94A3B8"
                                value={message}
                                onChangeText={setMessage}
                                multiline
                                editable={!isLoading}
                            />
                        </View>
                        <TouchableOpacity 
                            style={[styles.sendBtn, (!message.trim() || isLoading) && { opacity: 0.5 }]}
                            onPress={() => sendMessage(message)}
                            disabled={!message.trim() || isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Ionicons name="send" size={s(18)} color="#FFFFFF" />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: s(12),
        paddingVertical: vs(10),
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backBtn: {
        padding: s(4),
    },
    headerTitleContainer: {
        flex: 1,
        marginLeft: s(8),
    },
    headerTitle: {
        fontSize: ms(16),
        fontWeight: '700',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: vs(2),
    },
    onlineDot: {
        width: s(8),
        height: s(8),
        borderRadius: s(4),
        backgroundColor: '#22C55E',
        marginRight: s(6),
    },
    onlineText: {
        fontSize: ms(12),
        color: '#22C55E',
        fontWeight: '500',
    },
    headerRight: {
        flexDirection: 'row',
        gap: s(8),
    },
    iconBtn: {
        padding: s(4),
    },
    scrollContent: {
        padding: s(16),
        paddingBottom: vs(24),
    },
    bannerCard: {
        borderRadius: ms(12),
        padding: s(12),
        marginBottom: vs(16),
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    bannerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: vs(10),
    },
    robotContainer: {
        width: s(60),
        height: s(60),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: s(12),
    },
    robotImage: {
        width: s(60),
        height: s(60),
    },
    bannerTexts: {
        flex: 1,
    },
    bannerTitle: {
        fontSize: ms(14),
        fontWeight: '700',
        marginBottom: vs(2),
    },
    bannerDesc: {
        fontSize: ms(11),
        lineHeight: vs(16),
    },
    featuresRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: vs(8),
    },
    featurePill: {
        flex: 1,
        alignItems: 'center',
    },
    featurePillTexts: {
        alignItems: 'center',
        marginTop: vs(6),
    },
    featurePillTitle: {
        fontSize: ms(11),
        fontWeight: '600',
        textAlign: 'center',
    },
    featurePillDesc: {
        fontSize: ms(10),
        textAlign: 'center',
        marginTop: vs(2),
    },
    topicsSection: {
        marginBottom: vs(24),
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: vs(12),
    },
    sectionTitle: {
        fontSize: ms(15),
        fontWeight: '700',
    },
    viewAllText: {
        fontSize: ms(13),
        color: '#3B82F6',
        fontWeight: '600',
    },
    topicsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    topicCard: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        padding: s(8),
        borderRadius: ms(10),
        marginBottom: vs(8),
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    topicIconBg: {
        width: s(28),
        height: s(28),
        borderRadius: s(6),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: s(8),
    },
    topicTexts: {
        flex: 1,
    },
    topicTitle: {
        fontSize: ms(11),
        fontWeight: '600',
        marginBottom: vs(1),
    },
    topicSubtitle: {
        fontSize: ms(9),
    },
    chatArea: {
        marginTop: vs(8),
    },
    dateSeparator: {
        textAlign: 'center',
        fontSize: ms(12),
        fontWeight: '600',
        marginBottom: vs(16),
    },
    botMessageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: vs(4),
        maxWidth: '85%',
    },
    botAvatarSmall: {
        width: s(32),
        height: s(32),
        borderRadius: s(16),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: s(8),
    },
    robotImageSmall: {
        width: s(28),
        height: s(28),
        resizeMode: 'contain',
    },
    botBubble: {
        padding: s(12),
        borderRadius: ms(16),
        borderBottomLeftRadius: ms(4),
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    messageText: {
        fontSize: ms(14),
        lineHeight: vs(20),
    },
    timeTextLeft: {
        fontSize: ms(11),
        color: '#94A3B8',
        marginLeft: s(40),
        marginBottom: vs(16),
    },
    userMessageRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: vs(4),
    },
    userBubble: {
        backgroundColor: '#3B82F6',
        padding: s(12),
        borderRadius: ms(16),
        borderBottomRightRadius: ms(4),
        maxWidth: '80%',
    },
    userMessageText: {
        color: '#FFFFFF',
        fontSize: ms(14),
        lineHeight: vs(20),
    },
    timeTextRightRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: vs(16),
    },
    timeTextRight: {
        fontSize: ms(11),
        color: '#94A3B8',
    },
    bubbleTimeRight: {
        fontSize: ms(10),
        color: '#94A3B8',
        textAlign: 'right',
        marginTop: vs(8),
    },
    typingBubble: {
        paddingVertical: vs(8),
        paddingHorizontal: s(16),
    },
    typingDots: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(4),
    },
    typingDot: {
        width: s(8),
        height: s(8),
        borderRadius: s(4),
        backgroundColor: '#94A3B8',
    },
    typingText: {
        fontSize: ms(11),
        marginTop: vs(4),
    },
    quickActionsContainer: {
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: vs(12),
    },
    quickActionsScroll: {
        paddingHorizontal: s(16),
        marginBottom: vs(12),
    },
    quickActionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: s(12),
        paddingVertical: vs(8),
        borderRadius: ms(20),
        borderWidth: 1,
        marginRight: s(8),
    },
    quickActionText: {
        fontSize: ms(13),
        fontWeight: '500',
        marginLeft: s(6),
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: s(16),
        paddingTop: vs(4),
    },
    attachBtn: {
        padding: s(8),
        marginRight: s(4),
        marginBottom: vs(4),
    },
    inputContainer: {
        flex: 1,
        borderRadius: ms(20),
        paddingHorizontal: s(16),
        paddingVertical: Platform.OS === 'ios' ? vs(10) : vs(4),
        marginRight: s(12),
        minHeight: vs(40),
        maxHeight: vs(100),
        justifyContent: 'center',
    },
    input: {
        fontSize: ms(14),
        paddingTop: 0,
        paddingBottom: 0,
    },
    sendBtn: {
        width: s(40),
        height: s(40),
        borderRadius: s(20),
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: vs(2),
    },
});

export default ChatbotScreen;
