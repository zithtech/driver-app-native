import React, { useState } from 'react';
import {
    View,
    ScrollView,
    Pressable,
    TouchableOpacity,
    Platform,
    UIManager,
    Image,
    StyleSheet,
} from 'react-native';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../context/ThemeContext';
import { Text, Input } from '../../../Components';
import AppStatusBar from '../../../Components/AppStatusBar';
import { hS as s, vS as vs, mS as ms } from '../../../lib/scale';
import { ContactSupport_Nav, ChatbotScreen_Nav } from '../../../Navigations/navigations';

const getBrowseTopics = (t: any) => [
    {
        id: 1,
        title: t('faq_topic_payments', 'Payments & Earnings'),
        subtitle: t('faq_topic_payments_count', '12 questions'),
        icon: 'wallet-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
        category: 'Payments',
    },
    {
        id: 2,
        title: t('faq_topic_account', 'Account & Documents'),
        subtitle: t('faq_topic_account_count', '10 questions'),
        icon: 'document-text-outline',
        color: '#10B981',
        bgColor: '#ECFDF5',
        category: 'Account',
    },
    {
        id: 3,
        title: t('faq_topic_trips', 'Trips & Bookings'),
        subtitle: t('faq_topic_trips_count', '14 questions'),
        icon: 'car-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
        category: 'Trips',
    },
    {
        id: 4,
        title: t('faq_topic_subscription', 'Subscription & Plans'),
        subtitle: t('faq_topic_subscription_count', '10 questions'),
        icon: 'star-outline',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
        category: 'Subscription',
    },
    {
        id: 5,
        title: t('faq_topic_safety', 'Safety & Guidelines'),
        subtitle: t('faq_topic_safety_count', '10 questions'),
        icon: 'shield-checkmark-outline',
        color: '#EF4444',
        bgColor: '#FEF2F2',
        category: 'General',
    },
];

const getFaqCategories = (t: any) => [
    { key: 'All', label: t('faq_all', 'All') },
    { key: 'Payments', label: t('faq_payments', 'Payments') },
    { key: 'Trips', label: t('faq_trips', 'Trips') },
    { key: 'Account', label: t('faq_account', 'Account') },
    { key: 'Subscription', label: t('faq_subscription', 'Subscription') },
    { key: 'General', label: t('faq_general', 'General') },
];

const FAQS_DATA = [
    {
        id: 1,
        category: 'Payments',
        question: 'Does t2drive take a commission from my rides?',
        answer: 'No! t2drive is a 100% commission-free platform. You keep exactly what you earn on every single trip. You only pay a fixed subscription fee to use the app.',
        icon: 'star-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
    },
    {
        id: 2,
        category: 'Payments',
        question: 'How do I receive payments from customers?',
        answer: 'You receive payments directly from the customer at the end of the trip. Customers can pay you in cash or via direct online transfer (like UPI) using your personal QR code.',
        icon: 'cash-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
    },
    {
        id: 3,
        category: 'Payments',
        question: 'How do online payments work?',
        answer: 'Since there is no middleman, riders will scan your personal UPI QR code or use your transfer details to send the money directly to your bank account at drop-off.',
        icon: 'phone-portrait-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
    },
    {
        id: 4,
        category: 'Payments',
        question: 'What happens if a rider pays with cash?',
        answer: 'You collect the full cash amount directly from the rider. Because we charge zero commission, no platform fees will ever be deducted from your earnings for cash trips.',
        icon: 'wallet-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
    },
    {
        id: 5,
        category: 'Payments',
        question: 'How is my total earnings calculated?',
        answer: 'Your total earnings shown in the app are calculated by summing up the final fares of all your completed trips to help you track your daily and weekly performance.',
        icon: 'calculator-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
    },
    {
        id: 6,
        category: 'Payments',
        question: 'What is the Available Balance in my wallet for?',
        answer: 'Your in-app wallet is used to manage your platform subscription renewals and to receive any promotional or referral bonuses from t2drive.',
        icon: 'card-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
    },
    {
        id: 7,
        category: 'Payments',
        question: 'Are tips included in my earnings?',
        answer: 'Yes! Any extra amount or tip the customer gives you is 100% yours to keep directly.',
        icon: 'heart-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
    },
    {
        id: 8,
        category: 'Payments',
        question: 'How can I view a detailed breakdown of a specific trip?',
        answer: 'Navigate to the Earnings tab, tap on Recent Transactions, and select any specific trip to see the detailed fare breakdown (distance, time, and tolls) that was billed to the customer.',
        icon: 'list-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
    },
    {
        id: 9,
        category: 'Payments',
        question: 'Why was my trip payment adjusted after completion?',
        answer: 'The final bill may adjust automatically if the route changes significantly. Always ensure you collect the final updated amount shown on your screen at the end of the trip.',
        icon: 'sync-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
    },
    {
        id: 10,
        category: 'Payments',
        question: 'Do I earn money for waiting time?',
        answer: 'Yes, if the rider makes you wait beyond the complimentary initial waiting period, a per-minute wait time charge will automatically be added to the bill you collect from the customer.',
        icon: 'time-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
    },
    {
        id: 11,
        category: 'Payments',
        question: 'How do toll charges work?',
        answer: 'Tolls incurred during an active trip are automatically added to the rider\'s final fare. You should collect this total amount directly from the customer.',
        icon: 'map-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
    },
    {
        id: 12,
        category: 'Payments',
        question: 'Where can I see my daily and weekly earnings trends?',
        answer: 'The Earnings screen features an interactive chart showing your Earnings Trend based on your completed trips. You can filter this by Today, This Week, This Month, or Lifetime.',
        icon: 'bar-chart-outline',
        color: '#3B82F6',
        bgColor: '#EFF6FF',
    },
    {
        id: 13,
        category: 'Account',
        question: 'How do I upload or update my KYC documents?',
        answer: 'Navigate to Profile -> Documents to safely upload or update your Driver License, RC, Insurance, and other required documents.',
        icon: 'document-text-outline',
        color: '#10B981',
        bgColor: '#ECFDF5',
    },
    {
        id: 14,
        category: 'Account',
        question: 'How long does document verification take?',
        answer: 'Verification typically takes 24-48 hours. You will receive a notification in the app once your documents are approved by the t2drive team.',
        icon: 'time-outline',
        color: '#10B981',
        bgColor: '#ECFDF5',
    },
    {
        id: 15,
        category: 'Account',
        question: 'Why was my document rejected?',
        answer: 'Documents are usually rejected if they are blurry, expired, or mismatch your profile details. Please check the rejection reason and re-upload a clear, valid copy.',
        icon: 'alert-circle-outline',
        color: '#10B981',
        bgColor: '#ECFDF5',
    },
    {
        id: 16,
        category: 'Account',
        question: 'How do I change my registered phone number?',
        answer: 'To change your registered mobile number, please contact t2drive Support directly for security verification before the update can be processed.',
        icon: 'call-outline',
        color: '#10B981',
        bgColor: '#ECFDF5',
    },
    {
        id: 17,
        category: 'Account',
        question: 'How can I update my profile picture?',
        answer: 'Go to Profile -> Personal Details to update your profile picture. Ensure it is a clear selfie showing your full face with no sunglasses or hats.',
        icon: 'person-circle-outline',
        color: '#10B981',
        bgColor: '#ECFDF5',
    },
    {
        id: 18,
        category: 'Account',
        question: 'Can I drive a different vehicle on my account?',
        answer: 'Yes, but you must first add the new vehicle in the app and upload its RC and Insurance for verification. Wait for approval before accepting rides with it.',
        icon: 'car-sport-outline',
        color: '#10B981',
        bgColor: '#ECFDF5',
    },
    {
        id: 19,
        category: 'Account',
        question: 'How do I delete my t2drive account?',
        answer: 'You can request account deletion from the Profile Settings menu. Note that this action is permanent and all your driving history will be erased.',
        icon: 'trash-bin-outline',
        color: '#10B981',
        bgColor: '#ECFDF5',
    },
    {
        id: 20,
        category: 'Account',
        question: 'What do I do if I forget my login PIN/password?',
        answer: 'On the login screen, tap \'Forgot Password\' to receive an OTP on your registered mobile number to reset your access.',
        icon: 'key-outline',
        color: '#10B981',
        bgColor: '#ECFDF5',
    },
    {
        id: 21,
        category: 'Account',
        question: 'Are my personal data and documents secure?',
        answer: 'Absolutely. All your uploaded documents and personal information are securely encrypted and stored following strict privacy regulations.',
        icon: 'shield-checkmark-outline',
        color: '#10B981',
        bgColor: '#ECFDF5',
    },
    {
        id: 22,
        category: 'Account',
        question: 'Can I share my driver account with someone else?',
        answer: 'No, sharing your account violates t2drive policies. Only the verified driver matching the profile photo is permitted to operate the vehicle for rides.',
        icon: 'people-outline',
        color: '#10B981',
        bgColor: '#ECFDF5',
    },
    {
        id: 23,
        category: 'Trips',
        question: 'How do I accept a ride request?',
        answer: 'When a new request appears on your Dashboard, tap \'Accept\' before the timer runs out to claim the trip. The app will immediately show the pickup route.',
        icon: 'checkmark-circle-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 24,
        category: 'Trips',
        question: 'How does the Pickup navigation work?',
        answer: 'Once accepted, use the in-app map to navigate to the exact pickup location. Always tap the \'Arrived\' button exactly when you reach the customer\'s spot.',
        icon: 'navigate-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 25,
        category: 'Trips',
        question: 'Why do I need an OTP to start the trip?',
        answer: 'To ensure passenger safety and avoid wrong pickups, you must ask the rider for their 4-digit OTP and enter it in the app to officially start the ride.',
        icon: 'keypad-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 26,
        category: 'Trips',
        question: 'What if the rider\'s OTP is not working?',
        answer: 'Double-check the number with the rider. If the issue persists, you can contact t2drive Support directly via the headset icon on the OTP verification screen.',
        icon: 'warning-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 27,
        category: 'Trips',
        question: 'How do I navigate to the drop-off location?',
        answer: 'After successful OTP verification, the app will automatically switch to the Drop-off map, providing turn-by-turn guidance to the rider\'s destination.',
        icon: 'map-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 28,
        category: 'Trips',
        question: 'Can a rider change their destination during the trip?',
        answer: 'Yes, riders can update their drop-off location from their app during the ride. Your map and the final calculated fare will automatically adjust to the new route.',
        icon: 'git-branch-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 29,
        category: 'Trips',
        question: 'What is a Return Trip?',
        answer: 'You can set a specific destination you are heading towards (like going home). The app will then only assign you new trips that match your return route.',
        icon: 'return-down-back-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 30,
        category: 'Trips',
        question: 'What do I do when I reach the drop-off location?',
        answer: 'Slide or tap \'End Trip\' on your screen. The app will immediately calculate the final bill, including any extra wait time charges or tolls.',
        icon: 'location-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 31,
        category: 'Trips',
        question: 'How do I collect payment at the end of the trip?',
        answer: 'Collect the final fare shown on the Payment Collection screen directly from the rider via cash or your personal UPI QR code since we charge 0% commission.',
        icon: 'cash-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 32,
        category: 'Trips',
        question: 'When should I cancel a trip?',
        answer: 'Only cancel if the rider doesn\'t show up after the 5-minute waiting period, or in emergencies. Frequent driver cancellations may negatively affect your rating.',
        icon: 'close-circle-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 33,
        category: 'Trips',
        question: 'How do I cancel a trip after arriving?',
        answer: 'Tap the options menu (three dots) on the Pickup screen and select \'Cancel Trip\'. Be sure to choose the correct reason for the cancellation.',
        icon: 'trash-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 34,
        category: 'Trips',
        question: 'Is there a cancellation fee?',
        answer: 'If the rider cancels after you\'ve arrived and waited, a cancellation fee will be added to your next trip with them, or directly credited to your wallet balance.',
        icon: 'card-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 35,
        category: 'Trips',
        question: 'What if the rider refuses to pay the full amount?',
        answer: 'Politely show them the final fare calculation on your app. If they still refuse, collect what you can and immediately report the issue to t2drive Support.',
        icon: 'alert-circle-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 36,
        category: 'Trips',
        question: 'How do I report a safety issue during a trip?',
        answer: 'Use the SOS or Emergency Support button available on the map screen at any time during an active trip to instantly alert our 24/7 safety response team.',
        icon: 'shield-outline',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
    },
    {
        id: 37,
        category: 'Subscription',
        question: 'Why do I need a subscription plan?',
        answer: 'Since t2drive charges 0% commission on your rides, the subscription plan is a small, fixed fee that allows you to access unlimited ride requests on our platform.',
        icon: 'star-outline',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
    },
    {
        id: 38,
        category: 'Subscription',
        question: 'What happens if my subscription expires?',
        answer: 'If your plan expires, you will temporarily stop receiving new ride requests. Once you renew your plan, your account will be instantly reactivated for driving.',
        icon: 'timer-outline',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
    },
    {
        id: 39,
        category: 'Subscription',
        question: 'How do I purchase or renew a subscription?',
        answer: 'Navigate to Profile -> Subscription Plans to view available plans. Select the one that suits you best and pay securely using your preferred online payment method.',
        icon: 'card-outline',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
    },
    {
        id: 40,
        category: 'Subscription',
        question: 'Are there different types of plans available?',
        answer: 'Yes, we offer flexible plans such as Daily, Weekly, and Monthly passes. You can choose the plan that best fits your expected driving schedule.',
        icon: 'calendar-outline',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
    },
    {
        id: 41,
        category: 'Subscription',
        question: 'Can I upgrade my plan before it expires?',
        answer: 'Yes, you can purchase a new plan at any time. The new plan\'s validity will automatically start as soon as your current active plan expires.',
        icon: 'arrow-up-circle-outline',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
    },
    {
        id: 42,
        category: 'Subscription',
        question: 'Will I lose money if I don\'t drive every day?',
        answer: 'Your subscription is based on calendar days, not driving days. However, because you keep 100% of your earnings, the fixed fee is typically recovered within just a few trips.',
        icon: 'cash-outline',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
    },
    {
        id: 43,
        category: 'Subscription',
        question: 'Is the subscription fee refundable?',
        answer: 'No, subscription fees are non-refundable once purchased, as they instantly grant you full access to the t2drive driver network for the specified duration.',
        icon: 'refresh-circle-outline',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
    },
    {
        id: 44,
        category: 'Subscription',
        question: 'How can I check my current plan\'s validity?',
        answer: 'You can view your active plan details, including the exact expiration date and time, directly on your Home Dashboard or in the Subscription section of your Profile.',
        icon: 'information-circle-outline',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
    },
    {
        id: 45,
        category: 'Subscription',
        question: 'Can I pay my subscription fee using my wallet balance?',
        answer: 'Yes! If you have promotional bonuses or referral earnings in your t2drive wallet, you can use that balance to pay for your next subscription renewal.',
        icon: 'wallet-outline',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
    },
    {
        id: 46,
        category: 'Subscription',
        question: 'Do I need a subscription to accept cash rides?',
        answer: 'Yes, your subscription grants you access to the platform to receive all types of ride requests, including both cash and direct online payments from customers.',
        icon: 'car-sport-outline',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
    },
    {
        id: 47,
        category: 'General',
        question: 'What are the basic safety guidelines for drivers?',
        answer: 'Always wear your seatbelt, strictly follow traffic rules, avoid using your phone while driving unless mounted for navigation, and ensure your vehicle is regularly maintained.',
        icon: 'checkmark-done-outline',
        color: '#EF4444',
        bgColor: '#FEF2F2',
    },
    {
        id: 48,
        category: 'General',
        question: 'How does the in-app SOS button work?',
        answer: 'In an emergency, tap the red SOS shield icon on the map screen. This instantly shares your live location with our 24/7 safety response team and your registered emergency contacts.',
        icon: 'warning-outline',
        color: '#EF4444',
        bgColor: '#FEF2F2',
    },
    {
        id: 49,
        category: 'General',
        question: 'What should I do if a passenger is behaving aggressively?',
        answer: 'Do not engage in an argument. Find a safe, well-lit public place to pull over, end the trip, and immediately report the incident using the SOS or Support button.',
        icon: 'alert-circle-outline',
        color: '#EF4444',
        bgColor: '#FEF2F2',
    },
    {
        id: 50,
        category: 'General',
        question: 'Is it mandatory to wear a mask?',
        answer: 'Please follow your local health and government guidelines regarding masks. We strongly encourage maintaining good hygiene and keeping your vehicle clean and well-ventilated.',
        icon: 'medkit-outline',
        color: '#EF4444',
        bgColor: '#FEF2F2',
    },
    {
        id: 51,
        category: 'General',
        question: 'Can I carry extra passengers beyond my vehicle\'s capacity?',
        answer: 'No, for safety and strict insurance reasons, you must never exceed the legal seating capacity of your registered vehicle. Politely ask the rider to book an additional vehicle.',
        icon: 'people-outline',
        color: '#EF4444',
        bgColor: '#FEF2F2',
    },
    {
        id: 52,
        category: 'General',
        question: 'What if a rider brings a child without a car seat?',
        answer: 'If local laws require a car seat for the child\'s age/height and the rider doesn\'t have one, you should politely decline the trip for safety reasons and select the appropriate cancellation reason.',
        icon: 'hand-left-outline',
        color: '#EF4444',
        bgColor: '#FEF2F2',
    },
    {
        id: 53,
        category: 'General',
        question: 'Are pets allowed in the vehicle?',
        answer: 'Service animals are always permitted by law. For other pets, it is entirely up to your discretion. If you prefer not to carry pets, politely inform the rider before starting the trip.',
        icon: 'paw-outline',
        color: '#EF4444',
        bgColor: '#FEF2F2',
    },
    {
        id: 54,
        category: 'General',
        question: 'What do I do if I am involved in a traffic accident?',
        answer: 'First, ensure you and your passengers are safe and call local emergency services immediately. Then, report the accident to t2drive Support so we can assist with insurance records.',
        icon: 'car-sport-outline',
        color: '#EF4444',
        bgColor: '#FEF2F2',
    },
    {
        id: 55,
        category: 'General',
        question: 'How is my location data used?',
        answer: 'Your location is tracked during active trips to provide accurate navigation to the rider, calculate final fares, and ensure the safety of both you and the passenger via our monitoring systems.',
        icon: 'location-outline',
        color: '#EF4444',
        bgColor: '#FEF2F2',
    },
    {
        id: 56,
        category: 'General',
        question: 'What are the rules regarding driving under the influence?',
        answer: 't2drive has a strict zero-tolerance policy. Driving under the influence of drugs or alcohol is strictly prohibited and will result in immediate and permanent deactivation of your account.',
        icon: 'wine-outline',
        color: '#EF4444',
        bgColor: '#FEF2F2',
    },
];

const FAQScreen = ({ navigation, route }: any) => {
    const { t } = useTranslation();
    const { theme, isDark } = useAppTheme();

    const BROWSE_TOPICS = getBrowseTopics(t);
    const FAQ_CATEGORIES = getFaqCategories(t);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(route?.params?.category || 'All');
    const [expandedFaqId, setExpandedFaqId] = useState<number | null>(1);

    const filteredFaqs = FAQS_DATA.filter((faq) => {
        const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
        const matchesSearch = searchQuery.trim() === '' || 
            faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
            faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <AppStatusBar />
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={s(24)} color={theme.colors.text} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{t('faqs', 'FAQs')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate(ChatbotScreen_Nav)} style={styles.backBtn}>
                    <Ionicons name="chatbubble-ellipses-outline" size={s(24)} color="#3B82F6" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Search */}
                <View style={styles.searchContainer}>
                    <Input
                        placeholder={t('search_answers', 'Search for answers...')}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        LeadingAccessory={
                            <Ionicons name="search" size={s(18)} color="#94A3B8" style={{ marginRight: s(8) }} />
                        }
                        inputContainerStyle={[styles.searchInput, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0', borderWidth: 1 }]}
                        placeholderTextColor="#94A3B8"
                        style={{ fontSize: ms(13), color: isDark ? '#F8FAFC' : '#1E293B', height: '100%' }}
                    />
                </View>

                {/* Hero Section */}
                <View style={[styles.heroCard, { backgroundColor: isDark ? '#1E293B' : '#F0F9FF' }]}>
                    <View style={styles.heroLeft}>
                        <Text style={[styles.heroTitleMain, { color: isDark ? '#F8FAFC' : '#0B193C' }]}>
                            {t('how_can', 'How can')} <Text style={styles.heroTitleHighlight}>{t('we_help', 'we help?')}</Text>
                        </Text>
                        <Text style={[styles.heroSubtitle, { color: isDark ? '#94A3B8' : '#3B82F6' }]}>
                            {t('faq_help_subtitle', 'Find quick answers to common questions or get help from our support team.')}
                        </Text>
                    </View>
                    <View style={styles.heroRight}>
                        <Image
                            source={require('../../../assets/images/supporti.png')}
                            style={styles.heroImage}
                            resizeMode="contain"
                        />
                    </View>
                </View>

                {/* Browse by Topics */}
                <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0B193C' }]}>{t('browse_topics', 'Browse by Topics')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicsScroll}>
                        {BROWSE_TOPICS.map((topic) => (
                            <TouchableOpacity 
                                key={topic.id} 
                                style={[styles.topicCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}
                                onPress={() => setSelectedCategory(topic.category)}
                            >
                                <View style={[styles.topicIconContainer, { backgroundColor: isDark ? `${topic.color}20` : topic.bgColor }]}>
                                    <Ionicons name={topic.icon} size={s(20)} color={topic.color} />
                                </View>
                                <Text style={[styles.topicCardTitle, { color: theme.colors.text }]} numberOfLines={1}>{topic.title}</Text>
                                <Text style={[styles.topicCardSubtitle, { color: '#3B82F6' }]} numberOfLines={1}>{topic.subtitle}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* FAQ Categories */}
                <View style={styles.sectionContainer}>
                    <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0B193C' }]}>{t('frequently_asked', 'Frequently Asked Questions')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
                        {FAQ_CATEGORIES.map((cat) => {
                            const isSelected = selectedCategory === cat.key;
                            return (
                                <TouchableOpacity
                                    key={cat.key}
                                    style={[
                                        styles.categoryTab,
                                        {
                                            backgroundColor: isSelected ? '#0052FF' : (isDark ? '#1E293B' : '#FFFFFF'),
                                            borderColor: isSelected ? '#0052FF' : (isDark ? '#334155' : '#E2E8F0'),
                                        }
                                    ]}
                                    onPress={() => setSelectedCategory(cat.key)}
                                >
                                    <Text style={[
                                        styles.categoryText,
                                        { color: isSelected ? '#FFFFFF' : (isDark ? '#94A3B8' : '#64748B') }
                                    ]}>{cat.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* FAQs List */}
                    <View style={styles.faqsList}>
                        {filteredFaqs.map((faq) => {
                            const isExpanded = expandedFaqId === faq.id;
                            return (
                                <TouchableOpacity
                                    key={faq.id}
                                    style={[
                                        styles.faqItem,
                                        {
                                            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                                            borderColor: isDark ? '#334155' : '#E2E8F0',
                                        }
                                    ]}
                                    onPress={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                                >
                                    <View style={styles.faqHeaderRow}>
                                        <View style={[styles.faqIconContainer, { backgroundColor: isDark ? `${faq.color}20` : faq.bgColor }]}>
                                            <Ionicons name={faq.icon} size={s(16)} color={faq.color} />
                                        </View>
                                        <Text style={[styles.faqQuestionText, { color: theme.colors.text }]} numberOfLines={2}>
                                            {faq.question}
                                        </Text>
                                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={s(16)} color={isDark ? '#94A3B8' : '#0B193C'} />
                                    </View>
                                    {isExpanded && (
                                        <View style={styles.faqAnswerContainer}>
                                            <Text style={[styles.faqAnswerText, { color: isDark ? '#94A3B8' : '#475569' }]}>
                                                {faq.answer}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Contact Support Footer */}
                <View style={[styles.footerCard, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
                    <View style={styles.footerIconBg}>
                        <Ionicons name="chatbubble-ellipses-outline" size={s(20)} color="#3B82F6" />
                    </View>
                    <View style={styles.footerInfo}>
                        <Text style={[styles.footerTitle, { color: theme.colors.text }]} numberOfLines={1}>{t('cant_find', "Can't find what you're looking for?")}</Text>
                        <Text style={[styles.footerDesc, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>{t('team_here', 'Our support team is here to help you.')}</Text>
                    </View>
                    <TouchableOpacity style={[styles.contactSupportBtn]} onPress={() => navigation.navigate(ChatbotScreen_Nav)}>
                        <Ionicons name="chatbubble-outline" size={s(16)} color="#FFFFFF" />
                        <Text style={styles.contactSupportBtnText}>{t('chat_now', 'Chat Now')}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
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
        height: vs(56),
        paddingHorizontal: s(16),
        zIndex: 100,
    },
    backBtn: {
        padding: s(4),
    },
    headerTitle: {
        fontSize: ms(18),
        fontWeight: '600',
    },
    scrollContent: {
        paddingBottom: vs(40),
    },
    searchContainer: {
        paddingHorizontal: s(16),
        marginTop: vs(12),
        marginBottom: vs(16),
    },
    searchInput: {
        borderRadius: ms(12),
        height: vs(44),
        paddingHorizontal: s(12),
    },
    heroCard: {
        flexDirection: 'row',
        marginHorizontal: s(16),
        marginBottom: vs(24),
        borderRadius: ms(16),
        padding: s(16),
        justifyContent: 'space-between',
        alignItems: 'center',
        overflow: 'hidden',
    },
    heroLeft: {
        flex: 1,
        marginRight: s(12),
    },
    heroTitleMain: {
        fontSize: ms(20),
        fontWeight: '700',
        marginBottom: vs(4),
    },
    heroTitleHighlight: {
        color: '#3B82F6',
    },
    heroSubtitle: {
        fontSize: ms(12),
        lineHeight: ms(18),
        marginTop: vs(4),
    },
    heroRight: {
        width: s(80),
        height: s(80),
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    sectionContainer: {
        marginBottom: vs(24),
    },
    sectionTitle: {
        fontSize: ms(16),
        fontWeight: '700',
        paddingHorizontal: s(16),
        marginBottom: vs(12),
    },
    topicsScroll: {
        paddingHorizontal: s(16),
        gap: s(12),
    },
    topicCard: {
        paddingVertical: vs(8),
        paddingHorizontal: s(10),
        borderRadius: ms(12),
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topicIconContainer: {
        width: s(28),
        height: s(28),
        borderRadius: s(14),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: vs(4),
    },
    topicCardTitle: {
        fontSize: ms(11),
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: ms(14),
        marginBottom: vs(2),
    },
    topicCardSubtitle: {
        fontSize: ms(10),
    },
    categoriesScroll: {
        paddingHorizontal: s(16),
        marginBottom: vs(16),
        gap: s(8),
    },
    categoryTab: {
        paddingHorizontal: s(16),
        paddingVertical: vs(8),
        borderRadius: ms(20),
        borderWidth: 1,
    },
    categoryText: {
        fontSize: ms(12),
        fontWeight: '500',
    },
    faqsList: {
        paddingHorizontal: s(16),
        gap: vs(8),
    },
    faqItem: {
        borderWidth: 1,
        borderRadius: ms(12),
        padding: s(12),
    },
    faqHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    faqIconContainer: {
        width: s(28),
        height: s(28),
        borderRadius: s(14),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: s(12),
    },
    faqQuestionText: {
        flex: 1,
        fontSize: ms(12),
        fontWeight: '600',
        lineHeight: ms(16),
        paddingRight: s(12),
    },
    faqAnswerContainer: {
        marginTop: vs(8),
        paddingLeft: s(40),
    },
    faqAnswerText: {
        fontSize: ms(11),
        lineHeight: ms(16),
    },
    footerCard: {
        marginHorizontal: s(16),
        backgroundColor: '#F8FAFC',
        borderRadius: ms(16),
        padding: s(16),
        flexDirection: 'row',
        alignItems: 'center',
    },
    footerIconBg: {
        width: s(40),
        height: s(40),
        borderRadius: s(20),
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: s(12),
    },
    footerInfo: {
        flex: 1,
    },
    footerTitle: {
        fontSize: ms(13),
        fontWeight: '700',
        marginBottom: vs(2),
    },
    footerDesc: {
        fontSize: ms(11),
    },
    contactSupportBtn: {
        backgroundColor: '#0052FF',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: s(16),
        paddingVertical: vs(10),
        borderRadius: ms(8),
        gap: s(6),
    },
    contactSupportBtnText: {
        color: '#FFFFFF',
        fontSize: ms(12),
        fontWeight: '600',
    },
});

export default FAQScreen;
