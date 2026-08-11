import React, { useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAppTheme } from '../../../context/ThemeContext';
import { Text } from '../../../Components';
import AppStatusBar from '../../../Components/AppStatusBar';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';
import { TicketChatScreen_Nav } from '../../../Navigations/navigations';
import { useGetMyTicketsQuery } from '../../../service/driverApi';
import { useSelector } from 'react-redux';
import { RootState } from '../../../redux/store';
import moment from 'moment';

const getCategoryDetails = (category: string) => {
    switch (category?.toLowerCase()) {
        case 'earnings':
            return { icon: 'wallet-outline', color: '#3B82F6', bgColor: '#EFF6FF' };
        case 'rides':
            return { icon: 'car-outline', color: '#F59E0B', bgColor: '#FFFBEB' };
        case 'documents':
            return { icon: 'document-text-outline', color: '#10B981', bgColor: '#ECFDF5' };
        case 'account':
            return { icon: 'person-outline', color: '#8B5CF6', bgColor: '#F5F3FF' };
        default:
            return { icon: 'chatbubble-ellipses-outline', color: '#3B82F6', bgColor: '#EFF6FF' };
    }
};

const ChatHistoryScreen = ({ navigation }: any) => {
    const { theme, isDark } = useAppTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('All');
    const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

    const user = useSelector((state: RootState) => state.userSlice.user);
    const driverId = user?.driverId || user?._id || user?.id || '';

    const { data: ticketsResponse, isLoading, isError } = useGetMyTicketsQuery(driverId, {
        skip: !driverId,
    });

    const tickets = ticketsResponse?.data || [];

    const groupedData = useMemo(() => {
        const sections: { title: string, data: any[] }[] = [
            { title: 'Today', data: [] },
            { title: 'Yesterday', data: [] },
            { title: 'This Week', data: [] },
            { title: 'Older', data: [] },
        ];

        const today = moment().startOf('day');
        const yesterday = moment().subtract(1, 'days').startOf('day');
        const thisWeekStart = moment().startOf('week');

        tickets.forEach((ticket: any) => {
            const ticketDate = moment(ticket.created_at);
            const formattedItem = {
                id: ticket.id || ticket._id,
                question: ticket.subject,
                snippet: ticket.description,
                time: ticketDate.format('hh:mm A'),
                fullDate: ticketDate,
                category: ticket.category || 'General',
                ...getCategoryDetails(ticket.category),
            };

            if (ticketDate.isSameOrAfter(today)) {
                sections[0].data.push(formattedItem);
            } else if (ticketDate.isSameOrAfter(yesterday)) {
                sections[1].data.push(formattedItem);
            } else if (ticketDate.isSameOrAfter(thisWeekStart)) {
                sections[2].data.push(formattedItem);
            } else {
                sections[3].data.push(formattedItem);
            }
        });

        // Filter based on selected time filter
        return sections.filter(section => {
            if (filterType === 'Today') return section.title === 'Today';
            if (filterType === 'Week') return section.title === 'Today' || section.title === 'Yesterday' || section.title === 'This Week';
            return true; // All or Month
        }).map(section => ({
            ...section,
            data: section.data.filter(item => {
                const searchLower = searchQuery.toLowerCase();
                return (item.question || '').toLowerCase().includes(searchLower) || 
                       (item.snippet || '').toLowerCase().includes(searchLower) ||
                       (item.category || '').toLowerCase().includes(searchLower);
            })
        })).filter(section => section.data.length > 0);
    }, [tickets, searchQuery, filterType]);

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <AppStatusBar />
            
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.card }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={s(24)} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Chat History</Text>
                <TouchableOpacity style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={s(22)} color={theme.colors.text} />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                {/* Search & Filter */}
                <View style={styles.searchRow}>
                    <View style={[styles.searchContainer, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                        <Ionicons name="search" size={s(20)} color="#94A3B8" style={styles.searchIcon} />
                        <TextInput
                            style={[styles.searchInput, { color: theme.colors.text }]}
                            placeholder="Search chats..."
                            placeholderTextColor="#94A3B8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    <TouchableOpacity 
                        style={[
                            styles.filterBtn, 
                            { backgroundColor: filterType !== 'All' ? '#3B82F6' : (isDark ? '#1E293B' : '#FFFFFF'), borderColor: isDark ? '#334155' : '#E2E8F0' }
                        ]}
                        onPress={() => setIsFilterModalVisible(true)}
                    >
                        <Ionicons name="options-outline" size={s(20)} color={filterType !== 'All' ? '#FFFFFF' : theme.colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Banner */}
                <View style={[styles.bannerCard, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
                    <View style={styles.bannerIconContainer}>
                        <Ionicons name="time-outline" size={s(24)} color="#3B82F6" />
                    </View>
                    <View style={styles.bannerTexts}>
                        <Text style={[styles.bannerTitle, { color: theme.colors.text }]}>Your conversations are saved</Text>
                        <Text style={[styles.bannerDesc, { color: theme.colors.paragraphText }]}>You can revisit any chat anytime.</Text>
                    </View>
                </View>

                {/* History List */}
                {isLoading ? (
                    <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: vs(20) }} />
                ) : isError ? (
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyText, { color: theme.colors.error }]}>Failed to load tickets.</Text>
                    </View>
                ) : groupedData.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={s(48)} color="#CBD5E1" />
                        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>No tickets found.</Text>
                    </View>
                ) : null}

                {!isLoading && !isError && groupedData.map((section, sectionIndex) => (
                    <View key={sectionIndex} style={styles.sectionContainer}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{section.title}</Text>
                        
                        <View style={[styles.cardsContainer, { backgroundColor: theme.colors.card, borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                            {section.data.map((item: any, index: number) => (
                                <TouchableOpacity 
                                    key={item.id} 
                                    style={[
                                        styles.historyItem, 
                                        index !== section.data.length - 1 ? { borderBottomWidth: 1, borderBottomColor: isDark ? '#334155' : '#F1F5F9' } : {}
                                    ]}
                                    onPress={() => navigation.navigate(TicketChatScreen_Nav, { ticketId: item.id, ticketSubject: item.question })}
                                >
                                    <View style={[styles.iconBox, { backgroundColor: isDark ? item.color + '20' : item.bgColor }]}>
                                        <Ionicons name={item.icon} size={s(16)} color={item.color} />
                                    </View>
                                    
                                    <View style={styles.itemContent}>
                                        <View style={styles.itemHeaderRow}>
                                            <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={1}>{item.question}</Text>
                                            <Text style={styles.timeText}>{item.time}</Text>
                                        </View>
                                        <Text style={[styles.itemSnippet, { color: theme.colors.paragraphText }]} numberOfLines={2}>{item.snippet}</Text>
                                        
                                        <View style={styles.badgeRow}>
                                            <View style={[styles.badge, { backgroundColor: isDark ? item.color + '20' : item.bgColor }]}>
                                                <Text style={[styles.badgeText, { color: item.color }]}>{item.category}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    
                                    <Ionicons name="chevron-forward" size={s(16)} color="#94A3B8" />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ))}

            </ScrollView>

            {/* Filter Modal */}
            <Modal
                visible={isFilterModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsFilterModalVisible(false)}
            >
                <Pressable style={styles.modalBackdrop} onPress={() => setIsFilterModalVisible(false)} />
                <View style={[styles.modalSheet, { backgroundColor: isDark ? '#1F2937' : '#fff' }]}>
                    <View style={[styles.sheetIndicator, { backgroundColor: isDark ? '#374151' : '#cbd5e1' }]} />
                    <View style={styles.sheetContent}>
                        <Text style={[styles.sheetTitle, { color: isDark ? '#fff' : '#0f172a' }]}>Filter by Time</Text>
                        
                        {['All', 'Today', 'Week', 'Month'].map((opt) => (
                            <TouchableOpacity
                                key={opt}
                                style={[
                                    styles.filterOptionItem,
                                    filterType === opt && { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF' }
                                ]}
                                onPress={() => {
                                    setFilterType(opt);
                                    setIsFilterModalVisible(false);
                                }}
                            >
                                <Text style={[
                                    styles.filterOptionText, 
                                    { color: filterType === opt ? '#3B82F6' : (isDark ? '#CBD5E1' : '#475569') },
                                    filterType === opt && { fontWeight: '700' }
                                ]}>
                                    {opt === 'All' ? 'All Time' : opt === 'Today' ? 'Today' : opt === 'Week' ? 'This Week' : 'This Month'}
                                </Text>
                                {filterType === opt && (
                                    <Ionicons name="checkmark" size={s(20)} color="#3B82F6" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: s(12),
        paddingVertical: vs(12),
    },
    iconBtn: {
        padding: s(4),
    },
    headerTitle: {
        fontSize: ms(16),
        fontWeight: '700',
    },
    scrollContent: {
        padding: s(16),
        paddingBottom: vs(40),
    },
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: vs(20),
        gap: s(12),
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: vs(46),
        borderRadius: ms(12),
        borderWidth: 1,
        paddingHorizontal: s(12),
    },
    searchIcon: {
        marginRight: s(8),
    },
    searchInput: {
        flex: 1,
        fontSize: ms(14),
        height: '100%',
    },
    filterBtn: {
        width: s(46),
        height: vs(46),
        borderRadius: ms(12),
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    bannerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: s(12),
        borderRadius: ms(10),
        marginBottom: vs(16),
    },
    bannerIconContainer: {
        width: s(36),
        height: s(36),
        borderRadius: s(18),
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: s(10),
    },
    bannerTexts: {
        flex: 1,
    },
    bannerTitle: {
        fontSize: ms(14),
        fontWeight: '700',
        marginBottom: vs(4),
    },
    bannerDesc: {
        fontSize: ms(11),
    },
    sectionContainer: {
        marginBottom: vs(16),
    },
    sectionTitle: {
        fontSize: ms(15),
        fontWeight: '700',
        marginBottom: vs(12),
        marginLeft: s(4),
    },
    cardsContainer: {
        borderRadius: ms(12),
        borderWidth: 1,
        overflow: 'hidden',
    },
    historyItem: {
        flexDirection: 'row',
        padding: s(12),
        alignItems: 'flex-start',
    },
    iconBox: {
        width: s(32),
        height: s(32),
        borderRadius: s(16),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: s(10),
    },
    itemContent: {
        flex: 1,
        marginRight: s(8),
    },
    itemHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: vs(4),
    },
    itemTitle: {
        flex: 1,
        fontSize: ms(13),
        fontWeight: '700',
        marginRight: s(8),
    },
    timeText: {
        fontSize: ms(10),
        color: '#94A3B8',
    },
    itemSnippet: {
        fontSize: ms(11),
        lineHeight: ms(16),
        marginBottom: vs(6),
    },
    badgeRow: {
        flexDirection: 'row',
    },
    badge: {
        paddingHorizontal: s(10),
        paddingVertical: vs(4),
        borderRadius: ms(12),
    },
    badgeText: {
        fontSize: ms(10),
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: vs(40),
    },
    emptyText: {
        fontSize: ms(14),
        marginTop: vs(12),
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalSheet: {
        borderTopLeftRadius: ms(24),
        borderTopRightRadius: ms(24),
        position: 'absolute',
        bottom: 0,
        width: '100%',
        paddingBottom: vs(34),
    },
    sheetIndicator: {
        width: s(40),
        height: vs(4),
        borderRadius: ms(2),
        alignSelf: 'center',
        marginTop: vs(12),
        marginBottom: vs(8),
    },
    sheetContent: {
        paddingHorizontal: s(24),
        paddingTop: vs(8),
    },
    sheetTitle: {
        fontSize: ms(18),
        fontWeight: '700',
        marginBottom: vs(20),
    },
    filterOptionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: vs(16),
        paddingHorizontal: s(16),
        borderRadius: ms(12),
        marginBottom: vs(8),
    },
    filterOptionText: {
        fontSize: ms(15),
        fontWeight: '500',
    },
});

export default ChatHistoryScreen;
