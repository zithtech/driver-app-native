sed -i '' -n '1,/const getStyles = (theme: any) => StyleSheet.create({/!p; /const getStyles = (theme: any) => StyleSheet.create({/q' "src/Screens/Dashboard/dashComponents/SubscriptionCard.tsx"
cat << 'INNER_EOF' >> "src/Screens/Dashboard/dashComponents/SubscriptionCard.tsx"
const getStyles = (theme: any) => StyleSheet.create({
    walletCard: {
        marginHorizontal: s(16),
        marginTop: vs(12),
        backgroundColor: theme.colors.card,
        borderRadius: ms(16),
        padding: ms(16),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.dark ? '#334155' : '#E5E7EB',
    },
    urgentCardBackground: {
        backgroundColor: theme.dark ? 'rgba(234, 88, 12, 0.05)' : '#FFF7ED',
        borderColor: theme.dark ? '#9a3412' : '#FFEDD5',
        borderWidth: 1,
    },
    walletRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    walletTitle: {
        fontSize: ms(16),
        fontWeight: '600',
        color: theme.colors.text,
        textTransform: 'capitalize',
    },
    durationBadge: {
        marginLeft: s(8),
        backgroundColor: theme.dark ? 'rgba(255, 255, 255, 0.1)' : '#F3F4F6',
        paddingHorizontal: s(6),
        paddingVertical: vs(2),
        borderRadius: ms(6),
    },
    durationText: {
        fontSize: ms(10),
        fontWeight: '600',
        color: theme.dark ? '#9CA3AF' : '#6B7280',
        textTransform: 'uppercase',
    },
    tierIconWrap: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    upgradeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.dark ? 'rgba(109, 40, 217, 0.1)' : '#F5F3FF',
        padding: ms(10),
        borderRadius: ms(8),
        marginTop: vs(16),
        gap: s(8),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.dark ? 'rgba(109, 40, 217, 0.3)' : '#EBE0FF'
    },
    upgradeText: {
        fontSize: ms(12),
        fontWeight: '500',
        color: theme.dark ? '#c4b5fd' : '#5B21B6',
        flex: 1,
    },
    planInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: vs(16),
        justifyContent: 'space-between',
        paddingTop: vs(16),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.dark ? '#2C2C2E' : '#E5E7EB',
        flexWrap: 'wrap',
        gap: 12,
    },
    expiryLabel: {
        color: theme.colors.textMuted || '#6B7280',
        fontSize: ms(12),
        fontWeight: '500',
    },
    expiryDateText: {
        fontWeight: '600',
        color: theme.colors.text,
    },
    daysLeftText: {
        fontSize: ms(13),
        fontWeight: '700',
        marginTop: vs(4),
    },
    statusBadge: {
        paddingHorizontal: s(8),
        paddingVertical: vs(4),
        borderRadius: ms(6),
    },
    statusText: {
        fontSize: ms(10),
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    ctaBtn: {
        paddingHorizontal: s(16),
        paddingVertical: vs(10),
        borderRadius: ms(10),
        minWidth: s(100),
        alignItems: 'center',
    },
    ctaText: {
        color: '#FFFFFF',
        fontSize: ms(13),
        fontWeight: '600',
    },
});
INNER_EOF
sh patch_styles.sh
rm patch_styles.sh
