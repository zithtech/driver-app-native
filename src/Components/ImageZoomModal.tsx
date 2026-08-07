import React, { useState } from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from './index';

interface ImageZoomModalProps {
  visible: boolean;
  onClose: () => void;
  imageUris: (string | number)[];
  title?: string;
}

const { width, height } = Dimensions.get('window');

const ImageNode = ({ uri }: { uri: string | number }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <View style={styles.imageContainer}>
      {loading && !error && (
        <ActivityIndicator size="large" color="#2563EB" style={StyleSheet.absoluteFill} />
      )}
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="image-outline" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.errorText}>Unable to load image</Text>
        </View>
      ) : (
        <Image
          source={typeof uri === 'string' ? { uri } : uri}
          style={styles.image}
          resizeMode="contain"
          onLoadStart={() => { setLoading(true); setError(false); }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
        />
      )}
    </View>
  );
};

const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  visible,
  onClose,
  imageUris,
  title,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!imageUris || imageUris.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.title}>{title || 'Document Preview'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={{ flex: 1 }}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setActiveIndex(index);
              }}
            >
              {imageUris.map((uri, idx) => (
                <ImageNode key={`${uri}-${idx}`} uri={uri} />
              ))}
            </ScrollView>

            {/* Pagination Dots */}
            {imageUris.length > 1 && (
              <View style={styles.pagination}>
                {imageUris.map((_, i) => (
                  <View 
                    key={i} 
                    style={[
                      styles.dot, 
                      activeIndex === i ? styles.activeDot : styles.inactiveDot
                    ]} 
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Ensure all details are clearly visible and not blurry.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

export default ImageZoomModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 5,
  },
  imageContainer: {
    width: width,
    height: height * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: width,
    height: height * 0.7,
  },
  errorContainer: {
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: '#3B82F6',
    width: 12,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textAlign: 'center',
  },
});
