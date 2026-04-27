import React from 'react';
import { StatusBar, StatusBarProps } from 'react-native';
import { useAppTheme } from '../context/ThemeContext';

interface AppStatusBarProps extends StatusBarProps {
    forceLight?: boolean;
    forceDark?: boolean;
}

/**
 * A themed StatusBar component that automatically handles barStyle based on the current theme.
 * Use `forceLight` or `forceDark` for specific screens (like image headers or gradients).
 */
const AppStatusBar: React.FC<AppStatusBarProps> = ({
    forceLight,
    forceDark,
    ...props
}) => {
    const { isDark } = useAppTheme();

    // Determine the bar style:
    // 1. If forced, use that.
    // 2. Otherwise, if dark theme is active, use light-content (white icons).
    // 3. Otherwise, use dark-content (black icons).
    let barStyle: 'light-content' | 'dark-content' = isDark ? 'light-content' : 'dark-content';

    if (forceLight) barStyle = 'light-content';
    if (forceDark) barStyle = 'dark-content';

    return (
        <StatusBar
            animated={false}
            barStyle={barStyle}
            backgroundColor="transparent"
            translucent={true}
            {...props}
        />
    );
};

export default AppStatusBar;
