/**
 * Driving Video Upload Service (Frontend Client)
 * 
 * Flow:
 * 1. Requests a pre-signed S3 PUT URL from the backend (/api/driving-test/recordings/upload-url)
 * 2. Uploads the local video file chunk directly to S3 via HTTP PUT (zero AWS credentials on client)
 * 3. Registers the segment metadata with the backend (/api/driving-test/recordings/segment)
 * 4. Cleans up the local cached video chunk to prevent filling driver device storage
 */

import { API_URL } from '../constant/config';

export interface ChunkUploadOptions {
  sessionId: string;
  cameraType: 'FRONT' | 'REAR' | 'FRONT_CABIN' | 'REAR_ROAD' | 'COMPOSITE';
  segmentIndex: number;
  localFilePath: string;
  durationMs?: number;
  fileSizeBytes?: number;
  authToken?: string;
  onProgress?: (progress: number) => void;
}

class DrivingVideoUploadService {
  /**
   * Uploads a 60-second video segment to S3 using a pre-signed URL obtained from the backend
   */
  async uploadSegmentChunk({
    sessionId,
    cameraType,
    segmentIndex,
    localFilePath,
    durationMs = 60000,
    fileSizeBytes = 0,
    authToken,
    onProgress,
  }: ChunkUploadOptions): Promise<{ success: boolean; s3Key: string }> {
    try {
      // 1. Request pre-signed S3 upload URL from Backend
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const presignedRes = await fetch(`${API_URL}/api/driving-test/recordings/upload-url`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId,
          cameraType,
          segmentIndex,
          contentType: 'video/mp4',
        }),
      });

      if (!presignedRes.ok) {
        throw new Error(`Failed to get pre-signed upload URL from backend: ${presignedRes.status}`);
      }

      const { uploadUrl, s3Key } = await presignedRes.json();
      if (!uploadUrl) {
        throw new Error('Backend did not return an uploadUrl');
      }

      // 2. Binary Upload directly to S3 via pre-signed URL
      await this.uploadBinaryToS3(uploadUrl, localFilePath, 'video/mp4', onProgress);

      // 3. Register completed segment in Backend database
      await fetch(`${API_URL}/api/driving-test/recordings/segment`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId,
          cameraType,
          segmentIndex,
          durationMs,
          s3Key,
          fileSizeBytes,
        }),
      });

      return { success: true, s3Key };
    } catch (error) {
      console.error(`[DrivingVideoUploadService] Failed chunk upload for ${cameraType} #${segmentIndex}:`, error);
      throw error;
    }
  }

  /**
   * Performs the binary PUT to S3
   */
  private uploadBinaryToS3(
    presignedUrl: string,
    filePath: string,
    contentType: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', contentType);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(event.loaded / event.total);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`S3 upload error with status ${xhr.status}: ${xhr.responseText}`));
        }
      };

      xhr.onerror = (e) => {
        reject(new Error(`S3 binary upload network failure: ${JSON.stringify(e)}`));
      };

      const fileData = {
        uri: filePath.startsWith('file://') ? filePath : `file://${filePath}`,
        type: contentType,
        name: filePath.split('/').pop() || 'segment.mp4',
      };

      xhr.send(fileData as any);
    });
  }
}

export default new DrivingVideoUploadService();
