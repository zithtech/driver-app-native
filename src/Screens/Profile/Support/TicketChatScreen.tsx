import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../../context/ThemeContext';
import { Text } from '../../../Components';
import AppStatusBar from '../../../Components/AppStatusBar';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';
import { useGetTicketMessagesQuery } from '../../../service/driverApi';

const TicketChatScreen = ({ navigation, route }: any) => {
    const { ticketId, ticketSubject } = route.params || {};
    const { theme, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();
    const [message, setMessage] = useState('');
    const scrollViewRef = useRef<ScrollView>(null);

    const { data: messagesData, isLoading, isError } = useGetTicketMessagesQuery(ticketId, {
        skip: !ticketId,
        refetchOnMountOrArgChange: true,
        pollingInterval: 5000, // simple polling to get new messages
    });

    const messages = messagesData?.data || [];

    const scrollToBottom = () => {
        if (scrollViewRef.current) {
            scrollViewRef.current.scrollToEnd({ animated: true });
        }
    };

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(scrollToBottom, 200);
        }
    }, [messages.length]);

    const handleSendMessage = () => {
        // TODO: Implement actual reply functionality when API is ready
        console.log("Send message:", message);
        setMessage('');
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
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {ticketSubject || 'Ticket Conversation'}
                    </Text>
                    <View style={styles.statusRow}>
                        <Text style={[styles.subtitleText, { color: theme.colors.paragraphText }]}>
                            ID: {ticketId?.substring(0, 8)?.toUpperCase()}
                        </Text>
                    </View>
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
                    onContentSizeChange={scrollToBottom}
                >
                    {isLoading ? (
                        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: vs(20) }} />
                    ) : isError ? (
                        <Text style={[styles.errorText, { color: theme.colors.error }]}>Failed to load messages.</Text>
                    ) : messages.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="chatbubbles-outline" size={s(48)} color="#CBD5E1" />
                            <Text style={[styles.emptyText, { color: theme.colors.paragraphText }]}>No messages yet.</Text>
                        </View>
                    ) : (
                        <View style={styles.chatArea}>
                            {messages.map((msg: any) => {
                                const isUser = msg.sender_type === 'user' || msg.sender_type === 'driver';
                                return (
                                    <View key={msg.id || msg._id}>
                                        {isUser ? (
                                            <View style={styles.userMessageRow}>
                                                <View style={styles.userBubble}>
                                                    <Text style={styles.userMessageText}>{msg.message || msg.content}</Text>
                                                </View>
                                            </View>
                                        ) : (
                                            <View style={styles.botMessageRow}>
                                                <View style={[styles.botBubble, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                                                    <Text style={[styles.messageText, { color: theme.colors.text }]}>{msg.message || msg.content}</Text>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </ScrollView>

                {/* Input Area */}
                <View style={[styles.inputRow, { backgroundColor: theme.colors.card, paddingBottom: Math.max(insets.bottom, vs(16)) }]}>
                    <View style={[styles.inputContainer, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                        <TextInput
                            style={[styles.input, { color: theme.colors.text }]}
                            placeholder="Type a reply..."
                            placeholderTextColor="#94A3B8"
                            value={message}
                            onChangeText={setMessage}
                            multiline
                            // editable={false} // uncomment if we strictly want read-only
                        />
                    </View>
                    <TouchableOpacity 
                        style={[styles.sendBtn, (!message.trim()) && { opacity: 0.5 }]}
                        onPress={handleSendMessage}
                        disabled={!message.trim()}
                    >
                        <Ionicons name="send" size={s(18)} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: s(12),
        paddingVertical: vs(10),
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    backBtn: { padding: s(4) },
    headerTitleContainer: {
        flex: 1,
        marginLeft: s(8),
        marginRight: s(8),
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
    subtitleText: {
        fontSize: ms(12),
        fontWeight: '500',
    },
    scrollContent: {
        padding: s(16),
        paddingBottom: vs(24),
    },
    chatArea: {
        marginTop: vs(8),
    },
    botMessageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: vs(12),
        maxWidth: '85%',
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
    userMessageRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: vs(12),
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
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: s(16),
        paddingTop: vs(12),
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
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
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: vs(100),
    },
    emptyText: {
        marginTop: vs(12),
        fontSize: ms(14),
    },
    errorText: {
        textAlign: 'center',
        marginTop: vs(40),
        fontSize: ms(14),
    },
});

export default TicketChatScreen;
