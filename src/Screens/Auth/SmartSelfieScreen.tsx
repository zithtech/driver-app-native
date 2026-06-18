import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Dimensions } from 'react-native';
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector, FrameFaceDetectionOptions } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Text } from '../../Components';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const MASK_WIDTH = width * 0.75;
const MASK_HEIGHT = MASK_WIDTH * 1.3;

const SmartSelfieScreen = ({ navigation, route }: any) => {
  const { onCapture } = route.params;
  const { t } = useTranslation();

  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice('front');
  const camera = useRef<Camera>(null);
  
  const [feedback, setFeedback] = useState('Position your face in the oval');
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Use a ref to track stability to avoid instant captures
  const stabilityCounter = useRef(0);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const faceDetectorOptions: FrameFaceDetectionOptions = {
    performanceMode: 'fast',
    contourMode: 'none',
    landmarkMode: 'none',
    classificationMode: 'all',
  };

  const { detectFaces } = useFaceDetector(faceDetectorOptions);

  const isCapturingRef = useRef(isCapturing);
  const capturedPhotoRef = useRef(capturedPhoto);

  useEffect(() => {
    isCapturingRef.current = isCapturing;
    capturedPhotoRef.current = capturedPhoto;
  }, [isCapturing, capturedPhoto]);

  const takePhoto = async () => {
    if (isCapturingRef.current || !camera.current) return;
    setIsCapturing(true);
    try {
      const photo = await camera.current.takePhoto({
        flash: 'off',
      });
      setCapturedPhoto('file://' + photo.path);
    } catch (e) {
      console.error('Selfie Capture Error:', e);
      setFeedback('Capture failed. Please try again.');
      setIsCapturing(false);
      stabilityCounter.current = 0;
    }
  };

  const handleDetectedFaceCallback = React.useCallback((faces: any[]) => {
    if (isCapturingRef.current || capturedPhotoRef.current) return;

    if (faces.length === 0) {
      setFeedback('No face detected');
      stabilityCounter.current = 0;
    } else if (faces.length > 1) {
      setFeedback('Ensure only one person is in the frame');
      stabilityCounter.current = 0;
    } else {
      const face = faces[0];
      
      if (Math.abs(face.yawAngle) > 15 || Math.abs(face.pitchAngle) > 15) {
        setFeedback('Look straight at the camera');
        stabilityCounter.current = 0;
      } else {
        setFeedback('Perfect! Hold still...');
        stabilityCounter.current += 1;
        
        if (stabilityCounter.current > 10) {
          takePhoto();
        }
      }
    }
  }, [takePhoto]);

  const handleDetectedFace = React.useMemo(() => Worklets.createRunOnJS(handleDetectedFaceCallback), [handleDetectedFaceCallback]);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    const faces = detectFaces(frame);
    handleDetectedFace(faces);
  }, [detectFaces, handleDetectedFace]);

  const confirmPhoto = () => {
    if (capturedPhoto) {
      onCapture(capturedPhoto);
      navigation.goBack();
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setIsCapturing(false);
    stabilityCounter.current = 0;
    setFeedback('Position your face in the oval');
  };

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={{ marginTop: 10 }}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.center}>
        <Text>No Front Camera Found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {!capturedPhoto ? (
        <>
          <Camera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={!capturedPhoto}
            frameProcessor={frameProcessor}
            photo={true}
            pixelFormat="yuv"
          />
          
          <View style={styles.overlay}>
            <View style={styles.maskContainer}>
              <View style={styles.maskOval} />
            </View>
            <View style={styles.feedbackContainer}>
              <Text style={styles.feedbackText}>{feedback}</Text>
              {isCapturing && <ActivityIndicator size="small" color="#FFF" style={{ marginTop: 10 }} />}
            </View>
          </View>
          
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
          <View style={styles.previewActions}>
            <TouchableOpacity style={[styles.actionBtn, styles.retakeBtn]} onPress={retakePhoto}>
              <Ionicons name="refresh" size={20} color="#FFF" />
              <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.confirmBtn]} onPress={confirmPhoto}>
              <Ionicons name="checkmark" size={20} color="#FFF" />
              <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default SmartSelfieScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maskContainer: {
    width: MASK_WIDTH,
    height: MASK_HEIGHT,
    borderRadius: MASK_WIDTH / 2,
    borderWidth: 4,
    borderColor: 'rgba(16, 185, 129, 0.8)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  maskOval: {
    flex: 1,
    backgroundColor: 'transparent',
    // We would ideally use @react-native-masked-view/masked-view for a true dimming overlay around the oval
    // For simplicity, we just draw the dashed oval boundary.
  },
  feedbackContainer: {
    position: 'absolute',
    bottom: 100,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  feedbackText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewImage: {
    flex: 1,
    resizeMode: 'cover',
  },
  previewActions: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    elevation: 5,
  },
  retakeBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  confirmBtn: {
    backgroundColor: '#10B981',
  },
  actionText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});
